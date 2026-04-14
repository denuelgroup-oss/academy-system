<?php
require_once __DIR__ . '/../public_html/api/expenses/_bootstrap.php';

$conn = db();
ensure_expense_tables($conn);

$jsonPath = __DIR__ . '/livre_expenses_import.json';
if (!file_exists($jsonPath)) {
    fwrite(STDERR, "JSON file not found: $jsonPath\n");
    exit(1);
}

$content = file_get_contents($jsonPath);
if ($content === false) {
    fwrite(STDERR, "Unable to read JSON file\n");
    exit(1);
}

// PowerShell may write BOM; strip it before decoding JSON.
$content = preg_replace('/^\xEF\xBB\xBF/', '', $content);
$data = json_decode($content, true);
if (!is_array($data)) {
    fwrite(STDERR, "Invalid JSON content: " . json_last_error_msg() . "\n");
    exit(1);
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

$inserted = 0;
$skipped = 0;

foreach ($data as $row) {
    $title = trim((string)($row['title'] ?? ''));
    $amount = floatval($row['amount'] ?? 0);
    $currency = strtoupper(trim((string)($row['currency'] ?? 'CDF')));
    $expenseDate = trim((string)($row['expense_date'] ?? ''));
    $mode = trim((string)($row['mode'] ?? ''));
    $sourceKey = trim((string)($row['source_key'] ?? ''));

    if ($title === '' || $amount <= 0 || $expenseDate === '' || $sourceKey === '') {
        $skipped++;
        continue;
    }

    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $expenseDate)) {
        $skipped++;
        continue;
    }

    if ($currency !== 'USD') {
        $currency = 'CDF';
    }

    $notes = 'Source: ' . $sourceKey;
    if ($mode !== '') {
        $notes = 'Mode: ' . $mode . ' | ' . $notes;
    }

    $like = '%' . $sourceKey . '%';
    $checkStmt->bind_param('s', $like);
    $checkStmt->execute();
    if ($checkStmt->get_result()->fetch_assoc()) {
        $skipped++;
        continue;
    }

    $paymentMethod = 'cash';
    $insertStmt->bind_param('sdsisss', $title, $amount, $currency, $categoryId, $expenseDate, $paymentMethod, $notes);
    if ($insertStmt->execute()) {
        $inserted++;
    } else {
        $skipped++;
    }
}

echo "Import completed\n";
echo "Total source rows: " . count($data) . "\n";
echo "Inserted: $inserted\n";
echo "Skipped: $skipped\n";
