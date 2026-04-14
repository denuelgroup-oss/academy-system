<?php
require_once __DIR__ . '/../public_html/api/config.php';
require_once __DIR__ . '/../public_html/api/expenses/_bootstrap.php';

$conn = db();
ensure_expense_tables($conn);

function normalize_label(string $label): string
{
    $v = trim($label);
    $v = preg_replace('/\s+/u', ' ', $v);
    $v = preg_replace('/\s+([,.;:!?])/u', '$1', $v);
    if ($v === '' || stripos($v, 'System.Xml.XmlElement') !== false || stripos($v, 'Imported expense') !== false) {
        return 'Libelle non renseigne';
    }
    return $v;
}

function pick_category_name(string $label): string
{
    $t = strtolower($label);

    if (preg_match('/transport|deplacement|taxi|trajet|ville|carburant|essence|transfere|transfert/u', $t)) {
        return 'Transport';
    }
    if (preg_match('/salaire|staff|coach|agent|mensuel|prime|paie|paiement staff/u', $t)) {
        return 'Salaries';
    }
    if (preg_match('/location|loyer|rent/u', $t)) {
        return 'Rent';
    }
    if (preg_match('/maintenance|reparation|entretien|groupe electrogene|terrain|travaux/u', $t)) {
        return 'Maintenance';
    }
    if (preg_match('/achat|impression|photocopie|credit|materiel|clavier|affiche|eau|maillot|flocage/u', $t)) {
        return 'Equipment';
    }

    return 'Imported Cash Book';
}

$defaultCats = ['Equipment', 'Salaries', 'Transport', 'Maintenance', 'Rent', 'Imported Cash Book'];
$catInsert = $conn->prepare('INSERT IGNORE INTO expense_categories (name) VALUES (?)');
if ($catInsert) {
    foreach ($defaultCats as $n) {
        $catInsert->bind_param('s', $n);
        $catInsert->execute();
    }
}

$catMap = [];
$catRes = $conn->query('SELECT id, name FROM expense_categories');
if ($catRes) {
    while ($row = $catRes->fetch_assoc()) {
        $catMap[$row['name']] = intval($row['id']);
    }
}

$rowsRes = $conn->query("SELECT id, title, notes FROM expenses WHERE notes LIKE '%LIVRE2025|%'");
if (!$rowsRes) {
    fwrite(STDERR, "Failed to read imported rows\n");
    exit(1);
}

$updStmt = $conn->prepare('UPDATE expenses SET title = ?, category_id = ?, notes = ? WHERE id = ?');
if (!$updStmt) {
    fwrite(STDERR, "Failed to prepare update stmt\n");
    exit(1);
}

$updated = 0;
$flagged = 0;
$byCategory = [
    'Equipment' => 0,
    'Salaries' => 0,
    'Transport' => 0,
    'Maintenance' => 0,
    'Rent' => 0,
    'Imported Cash Book' => 0,
];

while ($r = $rowsRes->fetch_assoc()) {
    $id = intval($r['id']);
    $oldTitle = (string)$r['title'];
    $notes = (string)($r['notes'] ?? '');

    $newTitle = normalize_label($oldTitle);
    $categoryName = pick_category_name($newTitle);
    $categoryId = $catMap[$categoryName] ?? ($catMap['Imported Cash Book'] ?? 0);

    $isSuspicious = ($newTitle === 'Libelle non renseigne');
    if ($isSuspicious) {
        if (stripos($notes, 'FLAG:REVIEW_LABEL') === false) {
            $notes = trim($notes . ' | FLAG:REVIEW_LABEL');
        }
        $flagged++;
    }

    if (!isset($byCategory[$categoryName])) {
        $byCategory[$categoryName] = 0;
    }
    $byCategory[$categoryName]++;

    $updStmt->bind_param('sisi', $newTitle, $categoryId, $notes, $id);
    if ($updStmt->execute()) {
        $updated++;
    }
}

echo "Cleanup completed\n";
echo "Updated rows: $updated\n";
echo "Flagged rows: $flagged\n";
foreach ($byCategory as $cat => $count) {
    echo $cat . ': ' . $count . "\n";
}
