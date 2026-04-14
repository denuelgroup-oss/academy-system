<?php
require_once __DIR__ . '/../finance.php';
require_auth();
require_method('GET');

$conn = db();
ensure_exchange_rate_tables($conn);

$from = trim((string)($_GET['from'] ?? ''));
$to = trim((string)($_GET['to'] ?? ''));
$useRange = $from !== '' && $to !== ''
    && preg_match('/^\d{4}-\d{2}-\d{2}$/', $from)
    && preg_match('/^\d{4}-\d{2}-\d{2}$/', $to);

$where = '';
$types = '';
$params = [];
if ($useRange) {
    $where = ' WHERE i.paid_at BETWEEN ? AND ? ';
    $types = 'ss';
    $params = [$from, $to];
}


$incomeSql =
    'SELECT "All Income" AS category,
            ROUND(SUM(' . convert_amount_to_usd_sql('si.total_amount', 'si.currency', 'si.issue_date') . '), 2) AS total_income
     FROM sales_invoice si '
    . $where .
    ' AND si.status IN ("sent", "paid") '
    . 'GROUP BY category
     ORDER BY total_income DESC';

$expenseSql =
    'SELECT COALESCE(c.name, "Uncategorized") AS category,
            ROUND(SUM(' . convert_amount_to_usd_sql('e.amount', 'e.currency', 'e.expense_date') . '), 2) AS total_expense
     FROM expenses e
     LEFT JOIN expense_categories c ON c.id = e.category_id ' .
    ($useRange ? ' WHERE e.expense_date BETWEEN ? AND ? ' : '') .
    'GROUP BY COALESCE(c.name, "Uncategorized")
     ORDER BY total_expense DESC';

// Fetch income by category
$incomeByCat = [];
$incomeStmt = $conn->prepare($incomeSql);
if ($incomeStmt) {
    if ($types !== '') $incomeStmt->bind_param($types, ...$params);
    $incomeStmt->execute();
    $res = $incomeStmt->get_result();
    while ($row = $res->fetch_assoc()) {
        $incomeByCat[$row['category']] = $row['total_income'];
    }
    $res->free();
    $incomeStmt->close();
}

// Fetch expense by category
$expenseByCat = [];
$expenseStmt = $conn->prepare($expenseSql);
if ($expenseStmt) {
    if ($types !== '') $expenseStmt->bind_param($types, ...$params);
    $expenseStmt->execute();
    $res = $expenseStmt->get_result();
    while ($row = $res->fetch_assoc()) {
        $expenseByCat[$row['category']] = $row['total_expense'];
    }
    $res->free();
    $expenseStmt->close();
}

// Merge categories
$allCategories = array_unique(array_merge(array_keys($incomeByCat), array_keys($expenseByCat)));
$profitByCat = [];
$totalIncome = 0;
$totalExpense = 0;
foreach ($allCategories as $cat) {
    $income = floatval($incomeByCat[$cat] ?? 0);
    $expense = floatval($expenseByCat[$cat] ?? 0);
    $profit = $income - $expense;
    $profitByCat[] = [
        'category' => $cat,
        'income' => $income,
        'expense' => $expense,
        'profit' => $profit
    ];
    $totalIncome += $income;
    $totalExpense += $expense;
}

json_response([
    'by_category' => $profitByCat,
    'total_income' => $totalIncome,
    'total_expense' => $totalExpense,
    'net_income' => $totalIncome - $totalExpense
]);
