<?php
require_once __DIR__ . '/../public_html/api/config.php';
require_once __DIR__ . '/../public_html/api/expenses/_bootstrap.php';

$conn = db();
ensure_expense_tables($conn);

echo "Category distribution (imported rows):\n";
$q = $conn->query("SELECT COALESCE(c.name,'(none)') AS category, COUNT(*) AS cnt FROM expenses e LEFT JOIN expense_categories c ON c.id=e.category_id WHERE e.notes LIKE '%LIVRE2025|%' GROUP BY c.name ORDER BY cnt DESC");
while ($q && ($r = $q->fetch_assoc())) {
    echo $r['category'] . ': ' . $r['cnt'] . "\n";
}

echo "\nFlagged sample rows:\n";
$q2 = $conn->query("SELECT expense_date, title, amount, currency FROM expenses WHERE notes LIKE '%FLAG:REVIEW_LABEL%' ORDER BY expense_date ASC LIMIT 10");
while ($q2 && ($r = $q2->fetch_assoc())) {
    echo $r['expense_date'] . ' | ' . $r['title'] . ' | ' . $r['amount'] . ' ' . $r['currency'] . "\n";
}
