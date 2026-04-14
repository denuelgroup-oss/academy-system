<?php
require_once __DIR__ . '/../finance.php';
require_auth();
require_method('GET');

$conn = db();
ensure_exchange_rate_tables($conn);
ensure_payment_currency_column($conn);

$chk = $conn->query("SHOW COLUMNS FROM students LIKE 'invoice_date'");
if ($chk && $chk->num_rows === 0) {
    $conn->query("ALTER TABLE students ADD COLUMN invoice_date DATE NULL");
}

$conn->query(
    'CREATE TABLE IF NOT EXISTS student_subscription_periods (
        id INT AUTO_INCREMENT PRIMARY KEY,
        student_id INT NOT NULL,
        sub_start DATE NOT NULL,
        sub_end DATE NOT NULL,
        source VARCHAR(20) NOT NULL DEFAULT "manual_renew",
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_student_period (student_id, sub_start, sub_end),
        KEY idx_student_periods_student (student_id)
    )'
);

$chk = $conn->query("SHOW COLUMNS FROM student_subscription_periods LIKE 'invoice_date'");
if ($chk && $chk->num_rows === 0) {
    $conn->query("ALTER TABLE student_subscription_periods ADD COLUMN invoice_date DATE NULL");
}

$months = intval($_GET['months'] ?? 12);
if ($months < 1) $months = 12;
if ($months > 24) $months = 24;

$start = new DateTime('first day of this month');
$start->modify('-' . ($months - 1) . ' months');
$end = new DateTime('first day of next month');

$startSql = $conn->real_escape_string($start->format('Y-m-d'));
$endSql = $conn->real_escape_string($end->format('Y-m-d'));

$amountExprStudents = convert_amount_to_usd_sql('COALESCE(pl.amount, 0)', 'COALESCE(pl.currency, "USD")', 'COALESCE(s.invoice_date, s.sub_start, DATE(s.created_at), CURDATE())');
$amountExprPeriods = convert_amount_to_usd_sql('COALESCE(pl.amount, 0)', 'COALESCE(pl.currency, "USD")', 'COALESCE(sp.invoice_date, sp.sub_start, CURDATE())');

$sql = "
    SELECT month_key, month_label, ROUND(SUM(total_amount), 2) AS total_amount
      FROM (
        SELECT
            DATE_FORMAT(COALESCE(s.invoice_date, s.sub_start, DATE(s.created_at), CURDATE()), '%Y-%m-01') AS month_key,
            DATE_FORMAT(COALESCE(s.invoice_date, s.sub_start, DATE(s.created_at), CURDATE()), '%b %Y') AS month_label,
            {$amountExprStudents} AS total_amount
          FROM students s
          LEFT JOIN plans pl ON pl.id = s.plan_id
         WHERE s.plan_id IS NOT NULL
           AND COALESCE(s.invoice_date, s.sub_start, DATE(s.created_at), CURDATE()) >= '{$startSql}'
           AND COALESCE(s.invoice_date, s.sub_start, DATE(s.created_at), CURDATE()) < '{$endSql}'

        UNION ALL

        SELECT
            DATE_FORMAT(COALESCE(sp.invoice_date, sp.sub_start, CURDATE()), '%Y-%m-01') AS month_key,
            DATE_FORMAT(COALESCE(sp.invoice_date, sp.sub_start, CURDATE()), '%b %Y') AS month_label,
            {$amountExprPeriods} AS total_amount
          FROM student_subscription_periods sp
          INNER JOIN students s ON s.id = sp.student_id
          LEFT JOIN plans pl ON pl.id = s.plan_id
         WHERE s.plan_id IS NOT NULL
           AND COALESCE(sp.invoice_date, sp.sub_start, CURDATE()) >= '{$startSql}'
           AND COALESCE(sp.invoice_date, sp.sub_start, CURDATE()) < '{$endSql}'
      ) revenue_rows
     GROUP BY month_key, month_label
     ORDER BY month_key ASC
";

$result = $conn->query($sql);
$rawMap = [];
if ($result) {
    while ($row = $result->fetch_assoc()) {
        $rawMap[$row['month_key']] = [
            'month_key' => $row['month_key'],
            'month_label' => $row['month_label'],
            'amount' => floatval($row['total_amount'] ?? 0),
        ];
    }
}

$series = [];
$cursor = clone $start;
$previousAmount = null;
while ($cursor < $end) {
    $key = $cursor->format('Y-m-01');
    $label = $cursor->format('M Y');
    $amount = floatval($rawMap[$key]['amount'] ?? 0);
    $delta = null;
    if ($previousAmount !== null) {
        if (abs($previousAmount) < 0.00001) {
            $delta = $amount > 0 ? 100.0 : 0.0;
        } else {
            $delta = (($amount - $previousAmount) / $previousAmount) * 100;
        }
    }
    $series[] = [
        'month_key' => $key,
        'month_label' => $label,
        'amount' => round($amount, 2),
        'change_pct' => $delta === null ? null : round($delta, 2),
    ];
    $previousAmount = $amount;
    $cursor->modify('+1 month');
}

json_response([
    'report_currency' => 'USD',
    'period_label' => 'Last ' . $months . ' month',
    'series' => $series,
]);
