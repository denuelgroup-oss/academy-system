<?php
require_once __DIR__ . '/_bootstrap.php';
require_auth();
require_method('GET');

$conn = db();
ensure_expense_tables($conn);

$monthParam = trim((string)($_GET['month'] ?? ''));
$hasMonth = preg_match('/^\d{4}-\d{2}$/', $monthParam) === 1;
$year  = $hasMonth ? intval(substr($monthParam, 0, 4)) : intval(date('Y'));
$month = $hasMonth ? intval(substr($monthParam, 5, 2)) : intval(date('m'));

$expUsd = convert_amount_to_usd_sql('amount', 'currency', 'expense_date');
$incUsd = convert_amount_to_usd_sql('p.amount', 'p.currency', 'p.payment_date');

$expFilter = "YEAR(expense_date) = $year AND MONTH(expense_date) = $month";
$r = $conn->query("SELECT COALESCE(ROUND(SUM($expUsd), 2), 0) AS total FROM expenses WHERE $expFilter");
$totalExpense = floatval($r ? $r->fetch_assoc()['total'] : 0);

$incFilter = "YEAR(p.payment_date) = $year AND MONTH(p.payment_date) = $month";
$r2 = $conn->query("SELECT COALESCE(ROUND(SUM($incUsd), 2), 0) AS total FROM payments p WHERE $incFilter");
$totalIncome = floatval($r2 ? $r2->fetch_assoc()['total'] : 0);

$closing = round($totalIncome - $totalExpense, 2);

json_response([
    'income'          => $totalIncome,
    'expense'         => $totalExpense,
    'closing_balance' => $closing,
    'opening_amount'  => 0.0,
    'cash_in_hand'    => max(0.0, $closing),
    'report_currency' => 'USD',
    'month'           => sprintf('%04d-%02d', $year, $month),
]);
