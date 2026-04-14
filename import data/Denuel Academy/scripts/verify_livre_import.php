<?php
require_once __DIR__ . '/../public_html/api/config.php';
require_once __DIR__ . '/../public_html/api/expenses/_bootstrap.php';

$conn = db();
ensure_expense_tables($conn);

$countRes = $conn->query("SELECT COUNT(*) AS c FROM expenses WHERE notes LIKE '%LIVRE2025|%'");
$count = $countRes ? intval(($countRes->fetch_assoc()['c'] ?? 0)) : 0;
echo "Imported rows in DB: $count\n";

$sample = $conn->query("SELECT expense_date, title, amount, currency FROM expenses WHERE notes LIKE '%LIVRE2025|%' ORDER BY expense_date ASC, id ASC LIMIT 5");
if ($sample) {
    while ($row = $sample->fetch_assoc()) {
        echo $row['expense_date'] . ' | ' . $row['title'] . ' | ' . $row['amount'] . ' ' . $row['currency'] . "\n";
    }
}
