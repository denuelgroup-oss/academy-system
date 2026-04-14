<?php
require_once __DIR__ . '/_bootstrap.php';
require_auth();
require_method('GET');

$conn = db();
ensure_expense_tables($conn);

$selectedCurrency = normalize_currency_code($_GET['currency'] ?? '', '');
$usdAmountExpr = convert_amount_to_usd_sql('amount', 'currency', 'expense_date');
$monthParam = trim((string)($_GET['month'] ?? ''));
$hasMonthParam = preg_match('/^\d{4}-\d{2}$/', $monthParam) === 1;

$monthYear = null;
$monthNum = null;
if ($hasMonthParam) {
  $monthYear = intval(substr($monthParam, 0, 4));
  $monthNum = intval(substr($monthParam, 5, 2));
}

$amountExpr = $selectedCurrency !== '' ? 'amount' : $usdAmountExpr;
$topAmountExpr = $selectedCurrency !== ''
  ? 'e.amount'
  : convert_amount_to_usd_sql('e.amount', 'e.currency', 'e.expense_date');

$currencyFilter = $selectedCurrency !== ''
  ? (" AND currency = '" . $conn->real_escape_string($selectedCurrency) . "'")
  : '';
$currencyFilterE = $selectedCurrency !== ''
  ? (" AND e.currency = '" . $conn->real_escape_string($selectedCurrency) . "'")
  : '';

$todayRow = $conn->query(
  'SELECT COALESCE(ROUND(SUM(' . $amountExpr . '), 2), 0) AS total_today
     FROM expenses
     WHERE expense_date = CURDATE()' . $currencyFilter
)->fetch_assoc();

$monthSqlFilter = $hasMonthParam
  ? ('YEAR(expense_date) = ' . intval($monthYear) . ' AND MONTH(expense_date) = ' . intval($monthNum))
  : 'YEAR(expense_date) = YEAR(CURDATE()) AND MONTH(expense_date) = MONTH(CURDATE())';

$monthRow = $conn->query(
  'SELECT COALESCE(ROUND(SUM(' . $amountExpr . '), 2), 0) AS total_month
     FROM expenses
    WHERE ' . $monthSqlFilter . $currencyFilter
)->fetch_assoc();

$topCategoryRow = $conn->query(
  'SELECT c.name, COALESCE(ROUND(SUM(' . $topAmountExpr . '), 2), 0) AS total_amount
     FROM expenses e
     LEFT JOIN expense_categories c ON c.id = e.category_id
    WHERE ' . str_replace('expense_date', 'e.expense_date', $monthSqlFilter) . $currencyFilterE . '
     GROUP BY c.name
     ORDER BY total_amount DESC
     LIMIT 1'
)->fetch_assoc();

json_response([
    'total_today' => floatval($todayRow['total_today'] ?? 0),
    'total_month' => floatval($monthRow['total_month'] ?? 0),
    'top_category' => $topCategoryRow['name'] ?? '-',
  'top_category_total' => floatval($topCategoryRow['total_amount'] ?? 0),
    'report_currency' => $selectedCurrency !== '' ? $selectedCurrency : 'USD',
    'selected_month' => $hasMonthParam ? $monthParam : date('Y-m'),
    'selected_currency' => $selectedCurrency
]);
