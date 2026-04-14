<?php
require_once __DIR__ . '/../finance.php';
require_once __DIR__ . '/../expenses/_bootstrap.php';
require_auth();
require_method('GET');

$conn = db();
ensure_exchange_rate_tables($conn);
ensure_payment_currency_column($conn);
ensure_expense_tables($conn);

$total_students = 0;
$r = $conn->query('SELECT COUNT(*) AS cnt FROM students');
if ($r) $total_students = intval($r->fetch_assoc()['cnt']);

$total_revenue = 0;
$revenueUsdExpr = convert_amount_to_usd_sql('p.amount', 'p.currency', 'p.payment_date');
$r = $conn->query('SELECT COALESCE(ROUND(SUM(' . $revenueUsdExpr . '), 2), 0) AS total FROM payments p');
if ($r) $total_revenue = floatval($r->fetch_assoc()['total']);

$total_transactions = 0;
$r = $conn->query('SELECT COUNT(*) AS cnt FROM payments');
if ($r) $total_transactions = intval($r->fetch_assoc()['cnt']);

$monthly_revenue = 0;
$r = $conn->query('SELECT COALESCE(ROUND(SUM(' . $revenueUsdExpr . '), 2), 0) AS total FROM payments p WHERE YEAR(p.payment_date) = YEAR(CURDATE()) AND MONTH(p.payment_date) = MONTH(CURDATE())');
if ($r) $monthly_revenue = floatval($r->fetch_assoc()['total']);

$total_expenses = 0;
$expenseUsdExpr = convert_amount_to_usd_sql('e.amount', 'e.currency', 'e.expense_date');
$r = $conn->query('SELECT COALESCE(ROUND(SUM(' . $expenseUsdExpr . '), 2), 0) AS total FROM expenses e');
if ($r) $total_expenses = floatval($r->fetch_assoc()['total']);

$net_income = $total_revenue - $total_expenses;

// Expired: students whose latest payment expiry_date is in the past (or have no payment)
$expired_students = 0;
$r = $conn->query(
    'SELECT COUNT(*) AS cnt FROM students s
     LEFT JOIN (
         SELECT student_id, MAX(expiry_date) AS latest_expiry
         FROM payments
         GROUP BY student_id
     ) p ON p.student_id = s.id
     WHERE p.latest_expiry IS NULL OR p.latest_expiry < CURDATE()'
);
if ($r) $expired_students = intval($r->fetch_assoc()['cnt']);

$new_students_month = 0;
$r = $conn->query('SELECT COUNT(*) AS cnt FROM students WHERE YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())');
if ($r) $new_students_month = intval($r->fetch_assoc()['cnt']);

$active_students = max(0, $total_students - $expired_students);

// Birthday reminder: students with birthday within the next 7 days (today inclusive).
$upcoming_birthdays = [];
$r = $conn->query("SHOW COLUMNS FROM students LIKE 'date_of_birth'");
if ($r && $r->num_rows > 0) {
    $bday_result = $conn->query(
        "SELECT id, name, date_of_birth FROM students WHERE date_of_birth IS NOT NULL"
    );
    if ($bday_result) {
        $today = new DateTime('today');
        $todayYear = (int)$today->format('Y');
        while ($row = $bday_result->fetch_assoc()) {
            $dob = DateTime::createFromFormat('Y-m-d', $row['date_of_birth']);
            if (!$dob) continue;
            $mday = $dob->format('m-d');
            // Build this year's birthday; handle Feb 29 on non-leap years by using Mar 1.
            $birthdayStr = $todayYear . '-' . $mday;
            $birthday = DateTime::createFromFormat('Y-m-d', $birthdayStr);
            if (!$birthday) {
                // e.g. Feb 29 in non-leap year → Mar 1
                $birthday = new DateTime($todayYear . '-03-01');
            }
            if ($birthday < $today) {
                $birthday->modify('+1 year');
            }
            $diff = (int)$today->diff($birthday)->days;
            if ($diff <= 6) {
                $upcoming_birthdays[] = [
                    'id'            => intval($row['id']),
                    'name'          => $row['name'],
                    'date_of_birth' => $row['date_of_birth'],
                    'days_until'    => $diff,
                ];
            }
        }
        usort($upcoming_birthdays, fn($a, $b) => $a['days_until'] - $b['days_until']);
    }
}

json_response([
    'total_students'   => $total_students,
    'total_revenue'    => $total_revenue,
    'expired_students' => $expired_students,
    'active_students'  => $active_students,
    'new_students_month' => $new_students_month,
    'total_transactions' => $total_transactions,
    'monthly_revenue' => $monthly_revenue,
    'total_expenses' => $total_expenses,
    'net_income' => $net_income,
    'report_currency' => 'USD',
    'upcoming_birthdays' => $upcoming_birthdays,
]);
