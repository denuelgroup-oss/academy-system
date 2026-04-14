<?php
require_once __DIR__ . '/_bootstrap.php';
require_auth();
require_method('GET');

$conn = db();
ensure_expense_tables($conn);

$from = trim((string)($_GET['from'] ?? ''));
$to = trim((string)($_GET['to'] ?? ''));
$useRange = $from !== '' && $to !== ''
    && preg_match('/^\d{4}-\d{2}-\d{2}$/', $from)
    && preg_match('/^\d{4}-\d{2}-\d{2}$/', $to);

$where = '';
$types = '';
$params = [];
if ($useRange) {
    $where = ' WHERE e.expense_date BETWEEN ? AND ? ';
    $types = 'ss';
    $params = [$from, $to];
}

$usdAmountExpr = convert_amount_to_usd_sql('e.amount', 'e.currency', 'e.expense_date');

$monthSql =
    'SELECT DATE_FORMAT(e.expense_date, "%Y-%m") AS period,
            ROUND(SUM(' . $usdAmountExpr . '), 2) AS total
     FROM expenses e' .
    $where .
    'GROUP BY DATE_FORMAT(e.expense_date, "%Y-%m")
     ORDER BY period ASC';

$catSql =
    'SELECT COALESCE(c.name, "Uncategorized") AS category,
            ROUND(SUM(' . $usdAmountExpr . '), 2) AS total
     FROM expenses e
     LEFT JOIN expense_categories c ON c.id = e.category_id ' .
    $where .
    'GROUP BY COALESCE(c.name, "Uncategorized")
     ORDER BY total DESC';

$byMonth = [];
$byCategory = [];

$monthStmt = $conn->prepare($monthSql);
if (!$monthStmt) {
    json_response(['message' => 'Failed to prepare monthly report query'], 500);
}
if ($types !== '') {
    $monthStmt->bind_param($types, ...$params);
}
$monthStmt->execute();
$monthRes = $monthStmt->get_result();
if ($monthRes) {
    while ($row = $monthRes->fetch_assoc()) {
        $byMonth[] = $row;
    }
    $monthRes->free();
}
$monthStmt->close();

$catStmt = $conn->prepare($catSql);
if (!$catStmt) {
    json_response(['message' => 'Failed to prepare category report query'], 500);
}
if ($types !== '') {
    $catStmt->bind_param($types, ...$params);
}
$catStmt->execute();
$catRes = $catStmt->get_result();
if ($catRes) {
    while ($row = $catRes->fetch_assoc()) {
        $byCategory[] = $row;
    }
    $catRes->free();
}
$catStmt->close();

json_response([
    'by_month' => $byMonth,
    'by_category' => $byCategory,
    'report_currency' => 'USD'
]);
