<?php
require_once __DIR__ . '/../public_html/api/expenses/_bootstrap.php';

$conn = db();
ensure_expense_tables($conn);

$workbookPath = __DIR__ . '/../import data/livre de caisse denuel academy au mois 2025.xlsx';
if (!file_exists($workbookPath)) {
    fwrite(STDERR, "Workbook not found: $workbookPath\n");
    exit(1);
}

$zip = new ZipArchive();
if ($zip->open($workbookPath) !== true) {
    fwrite(STDERR, "Unable to open workbook zip\n");
    exit(1);
}

function zip_read_entry(ZipArchive $zip, string $name): string
{
    $content = $zip->getFromName($name);
    return $content === false ? '' : $content;
}

function parse_xml(string $xml): ?SimpleXMLElement
{
    if ($xml === '') {
        return null;
    }
    libxml_use_internal_errors(true);
    $sx = simplexml_load_string($xml);
    if ($sx === false) {
        return null;
    }
    return $sx;
}

function excel_serial_to_date($serial): ?string
{
    if (!is_numeric($serial)) {
        return null;
    }
    $days = (int)floor((float)$serial);
    if ($days <= 0) {
        return null;
    }
    $base = new DateTime('1899-12-30');
    $base->modify('+' . $days . ' days');
    return $base->format('Y-m-d');
}

function parse_expense_date(string $raw): ?string
{
    $value = trim($raw);
    if ($value === '') {
        return null;
    }

    if (is_numeric($value)) {
        return excel_serial_to_date($value);
    }

    $formats = ['d/m/Y', 'j/n/Y', 'd-m-Y', 'j-n-Y', 'Y-m-d'];
    foreach ($formats as $fmt) {
        $dt = DateTime::createFromFormat($fmt, $value);
        if ($dt instanceof DateTime) {
            return $dt->format('Y-m-d');
        }
    }

    $ts = strtotime($value);
    if ($ts !== false) {
        return date('Y-m-d', $ts);
    }

    return null;
}

function parse_amount($raw): float
{
    $value = trim((string)$raw);
    if ($value === '') {
        return 0.0;
    }
    $value = str_replace([',', ' '], ['.', ''], $value);
    $value = preg_replace('/[^0-9.\-]/', '', $value);
    if ($value === '' || $value === '.' || $value === '-') {
        return 0.0;
    }
    return round((float)$value, 2);
}

function column_from_ref(string $cellRef): string
{
    if (preg_match('/^[A-Z]+/', strtoupper($cellRef), $m)) {
        return $m[0];
    }
    return '';
}

$sharedStrings = [];
$sst = parse_xml(zip_read_entry($zip, 'xl/sharedStrings.xml'));
if ($sst) {
    $sst->registerXPathNamespace('s', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main');
    $nodes = $sst->xpath('//s:si');
    if (is_array($nodes)) {
        foreach ($nodes as $si) {
            $textParts = [];
            $tNodes = $si->xpath('.//s:t');
            if (is_array($tNodes)) {
                foreach ($tNodes as $tn) {
                    $textParts[] = (string)$tn;
                }
            }
            $sharedStrings[] = trim(implode('', $textParts));
        }
    }
}

$workbook = parse_xml(zip_read_entry($zip, 'xl/workbook.xml'));
$rels = parse_xml(zip_read_entry($zip, 'xl/_rels/workbook.xml.rels'));
if (!$workbook || !$rels) {
    fwrite(STDERR, "Unable to read workbook metadata\n");
    exit(1);
}

$workbook->registerXPathNamespace('s', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main');
$workbook->registerXPathNamespace('r', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships');
$rels->registerXPathNamespace('p', 'http://schemas.openxmlformats.org/package/2006/relationships');

$relationMap = [];
$relNodes = $rels->xpath('//p:Relationship');
if (is_array($relNodes)) {
    foreach ($relNodes as $rel) {
        $rid = (string)$rel['Id'];
        $target = (string)$rel['Target'];
        if ($rid !== '' && $target !== '') {
            $relationMap[$rid] = 'xl/' . ltrim($target, '/');
        }
    }
}

$sheetTargets = [];
$sheetNodes = $workbook->xpath('//s:sheets/s:sheet');
if (is_array($sheetNodes)) {
    foreach ($sheetNodes as $sheet) {
        $name = trim((string)$sheet['name']);
        $rid = (string)$sheet->attributes('http://schemas.openxmlformats.org/officeDocument/2006/relationships')['id'];
        if ($name === '' || $rid === '' || !isset($relationMap[$rid])) {
            continue;
        }
        $sheetTargets[] = ['name' => $name, 'target' => $relationMap[$rid]];
    }
}

$conn->query("INSERT IGNORE INTO expense_categories (name) VALUES ('Imported Cash Book')");
$catRes = $conn->query("SELECT id FROM expense_categories WHERE name = 'Imported Cash Book' LIMIT 1");
$categoryId = $catRes ? intval(($catRes->fetch_assoc()['id'] ?? 0)) : 0;
if ($categoryId <= 0) {
    fwrite(STDERR, "Unable to resolve category id\n");
    exit(1);
}

$checkStmt = $conn->prepare('SELECT id FROM expenses WHERE notes LIKE ? LIMIT 1');
$insertStmt = $conn->prepare(
    'INSERT INTO expenses (title, amount, currency, category_id, expense_date, payment_method, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)'
);
if (!$checkStmt || !$insertStmt) {
    fwrite(STDERR, "Unable to prepare SQL statements\n");
    exit(1);
}

$totalRead = 0;
$totalInserted = 0;
$totalSkipped = 0;

foreach ($sheetTargets as $sheetMeta) {
    $sheetName = $sheetMeta['name'];
    $sheetXml = parse_xml(zip_read_entry($zip, $sheetMeta['target']));
    if (!$sheetXml) {
        continue;
    }

    $sheetXml->registerXPathNamespace('s', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main');
    $rowNodes = $sheetXml->xpath('//s:sheetData/s:row');
    if (!is_array($rowNodes)) {
        continue;
    }

    foreach ($rowNodes as $row) {
        $rowNum = intval((string)$row['r']);
        if ($rowNum < 5) {
            continue;
        }

        $cells = [];
        $cellNodes = $row->xpath('./s:c');
        if (!is_array($cellNodes)) {
            continue;
        }

        foreach ($cellNodes as $cell) {
            $ref = (string)$cell['r'];
            $col = column_from_ref($ref);
            if ($col === '') {
                continue;
            }

            $type = (string)$cell['t'];
            $value = '';
            if ($type === 's') {
                $idx = intval((string)$cell->v);
                $value = $sharedStrings[$idx] ?? '';
            } elseif ($type === 'inlineStr') {
                $value = trim((string)$cell->is->t);
            } else {
                $value = trim((string)$cell->v);
            }
            $cells[$col] = $value;
        }

        $date = parse_expense_date((string)($cells['B'] ?? ''));
        $titleRaw = trim((string)($cells['C'] ?? ''));
        $modeRaw = trim((string)($cells['D'] ?? ''));

        $usdExpense = parse_amount((string)($cells['G'] ?? ''));
        $fcExpense = parse_amount((string)($cells['H'] ?? ''));

        if (!$date) {
            $totalSkipped++;
            continue;
        }

        $title = $titleRaw !== '' ? $titleRaw : ('Imported expense ' . $sheetName . ' row ' . $rowNum);

        $entries = [];
        if ($usdExpense > 0) {
            $entries[] = ['amount' => $usdExpense, 'currency' => 'USD', 'col' => 'G'];
        }
        if ($fcExpense > 0) {
            $entries[] = ['amount' => $fcExpense, 'currency' => 'CDF', 'col' => 'H'];
        }

        if (count($entries) === 0) {
            continue;
        }

        foreach ($entries as $entry) {
            $totalRead++;
            $sourceKey = 'LIVRE2025|' . $sheetName . '|R' . $rowNum . '|' . $entry['col'];
            $noteParts = [];
            if ($modeRaw !== '') {
                $noteParts[] = 'Mode: ' . $modeRaw;
            }
            $noteParts[] = 'Source: ' . $sourceKey;
            $notes = implode(' | ', $noteParts);

            $like = '%' . $sourceKey . '%';
            $checkStmt->bind_param('s', $like);
            $checkStmt->execute();
            $existing = $checkStmt->get_result()->fetch_assoc();
            if ($existing) {
                $totalSkipped++;
                continue;
            }

            $paymentMethod = 'cash';
            $insertStmt->bind_param(
                'sdsisss',
                $title,
                $entry['amount'],
                $entry['currency'],
                $categoryId,
                $date,
                $paymentMethod,
                $notes
            );
            if ($insertStmt->execute()) {
                $totalInserted++;
            } else {
                $totalSkipped++;
            }
        }
    }
}

$zip->close();

echo "Import completed\n";
echo "Rows considered: $totalRead\n";
echo "Inserted: $totalInserted\n";
echo "Skipped: $totalSkipped\n";
