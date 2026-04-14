<?php
require_once __DIR__ . '/../finance.php';
require_auth();
require_method('GET');

$conn = db();
ensure_payment_extra_columns($conn);
backfill_legacy_payment_period_links($conn);

// Ensure invoice columns exist on students
$chk = $conn->query("SHOW COLUMNS FROM students LIKE 'invoice_no'");
if ($chk && $chk->num_rows === 0) {
    $conn->query("ALTER TABLE students ADD COLUMN invoice_no INT NULL");
}
$chk = $conn->query("SHOW COLUMNS FROM students LIKE 'invoice_prefix'");
if ($chk && $chk->num_rows === 0) {
    $conn->query("ALTER TABLE students ADD COLUMN invoice_prefix VARCHAR(20) NULL");
}
$chk = $conn->query("SHOW COLUMNS FROM students LIKE 'invoice_date'");
if ($chk && $chk->num_rows === 0) {
    $conn->query("ALTER TABLE students ADD COLUMN invoice_date DATE NULL");
}

// Ensure subscription periods table and invoice columns exist
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
$chk = $conn->query("SHOW COLUMNS FROM student_subscription_periods LIKE 'invoice_no'");
if ($chk && $chk->num_rows === 0) {
    $conn->query("ALTER TABLE student_subscription_periods ADD COLUMN invoice_no INT NULL");
}
$chk = $conn->query("SHOW COLUMNS FROM student_subscription_periods LIKE 'invoice_date'");
if ($chk && $chk->num_rows === 0) {
    $conn->query("ALTER TABLE student_subscription_periods ADD COLUMN invoice_date DATE NULL");
}

// Backfill missing student invoice numbers
$maxRes = $conn->query('SELECT COALESCE(MAX(invoice_no), 0) AS m FROM students');
$nextInvoiceNo = $maxRes ? intval(($maxRes->fetch_assoc()['m'] ?? 0)) + 1 : 1;
$missingStudents = $conn->query("SELECT id FROM students WHERE plan_id IS NOT NULL AND (invoice_no IS NULL OR invoice_no = 0) ORDER BY id ASC");
if ($missingStudents && $missingStudents->num_rows > 0) {
    $updStudent = $conn->prepare(
        "UPDATE students SET invoice_no = ?, invoice_prefix = COALESCE(NULLIF(invoice_prefix,''), 'INV-'), invoice_date = COALESCE(invoice_date, sub_start, CURDATE()) WHERE id = ?"
    );
    if ($updStudent) {
        while ($row = $missingStudents->fetch_assoc()) {
            $sid = intval($row['id'] ?? 0);
            if ($sid <= 0) continue;
            $updStudent->bind_param('ii', $nextInvoiceNo, $sid);
            $updStudent->execute();
            $nextInvoiceNo++;
        }
    }
}

// Backfill missing period invoice numbers using global max across students and periods
$maxStudentsRes = $conn->query('SELECT COALESCE(MAX(invoice_no), 0) AS m FROM students');
$maxPeriodsRes = $conn->query('SELECT COALESCE(MAX(invoice_no), 0) AS m FROM student_subscription_periods');
$maxStudents = $maxStudentsRes ? intval(($maxStudentsRes->fetch_assoc()['m'] ?? 0)) : 0;
$maxPeriods = $maxPeriodsRes ? intval(($maxPeriodsRes->fetch_assoc()['m'] ?? 0)) : 0;
$nextPeriodInvoiceNo = max($maxStudents, $maxPeriods) + 1;

$missingPeriods = $conn->query(
    'SELECT id
       FROM student_subscription_periods
      WHERE invoice_no IS NULL OR invoice_no = 0
      ORDER BY sub_start ASC, id ASC'
);
if ($missingPeriods && $missingPeriods->num_rows > 0) {
    $updPeriod = $conn->prepare(
        'UPDATE student_subscription_periods
            SET invoice_no = ?,
                invoice_date = COALESCE(invoice_date, sub_start, CURDATE())
          WHERE id = ?'
    );
    if ($updPeriod) {
        while ($row = $missingPeriods->fetch_assoc()) {
            $pid = intval($row['id'] ?? 0);
            if ($pid <= 0) continue;
            $updPeriod->bind_param('ii', $nextPeriodInvoiceNo, $pid);
            $updPeriod->execute();
            $nextPeriodInvoiceNo++;
        }
    }
}

$result = $conn->query(
    "SELECT * FROM (
        SELECT
            s.id AS id,
            s.name,
            s.invoice_date,
            COALESCE(NULLIF(s.invoice_prefix, ''), 'INV-') AS invoice_prefix,
            s.invoice_no,
                        s.sub_start,
                        s.sub_end,
            pl.title AS plan_title,
            cl.title AS class_title,
            s.sub_end AS due_date,
            COALESCE(pl.amount, 0) AS plan_amount,
            pl.currency AS plan_currency,
                        COALESCE((
                                SELECT SUM(pay.amount)
                                    FROM payments pay
                                 WHERE pay.student_id = s.id
                                                                     AND s.sub_start IS NOT NULL
                                                                     AND (
                                                                         (pay.period_start IS NOT NULL AND pay.period_end IS NOT NULL
                                                                            AND pay.period_start = s.sub_start
                                                                            AND pay.period_end = s.sub_end)
                                                                         OR
                                                                         (pay.period_start IS NULL
                                                                            AND pay.payment_date >= s.sub_start
                                                                            AND (s.sub_end IS NULL OR pay.payment_date <= s.sub_end))
                                                                     )
                        ), 0) AS paid_amount,
                        (
                                SELECT MAX(pay.payment_date)
                                    FROM payments pay
                                 WHERE pay.student_id = s.id
                                                                     AND s.sub_start IS NOT NULL
                                                                     AND (
                                                                         (pay.period_start IS NOT NULL AND pay.period_end IS NOT NULL
                                                                            AND pay.period_start = s.sub_start
                                                                            AND pay.period_end = s.sub_end)
                                                                         OR
                                                                         (pay.period_start IS NULL
                                                                            AND pay.payment_date >= s.sub_start
                                                                            AND (s.sub_end IS NULL OR pay.payment_date <= s.sub_end))
                                                                     )
                        ) AS last_payment_date,
            GREATEST(0, COALESCE(pl.amount, 0) - COALESCE((
                SELECT SUM(pay.amount)
                  FROM payments pay
                 WHERE pay.student_id = s.id
                                     AND s.sub_start IS NOT NULL
                                     AND (
                                         (pay.period_start IS NOT NULL AND pay.period_end IS NOT NULL
                                            AND pay.period_start = s.sub_start
                                            AND pay.period_end = s.sub_end)
                                         OR
                                         (pay.period_start IS NULL
                                            AND pay.payment_date >= s.sub_start
                                            AND (s.sub_end IS NULL OR pay.payment_date <= s.sub_end))
                                     )
            ), 0)) AS receivable,
            0 AS invoice_sort_group,
            COALESCE(s.invoice_date, s.sub_end, s.created_at) AS invoice_sort_date
        FROM students s
        LEFT JOIN plans pl ON pl.id = s.plan_id
        LEFT JOIN classes cl ON cl.id = s.class_id
        WHERE s.invoice_no IS NOT NULL AND s.invoice_no > 0

        UNION ALL

        SELECT
            s.id AS id,
            s.name,
            sp.invoice_date,
            COALESCE(NULLIF(s.invoice_prefix, ''), 'INV-') AS invoice_prefix,
            sp.invoice_no,
                        sp.sub_start,
                        sp.sub_end,
            pl.title AS plan_title,
            cl.title AS class_title,
            sp.sub_end AS due_date,
            COALESCE(pl.amount, 0) AS plan_amount,
            pl.currency AS plan_currency,
                        COALESCE((
                                SELECT SUM(pay.amount)
                                    FROM payments pay
                                 WHERE pay.student_id = s.id
                                                                     AND (
                                                                         (pay.period_start IS NOT NULL AND pay.period_end IS NOT NULL
                                                                            AND pay.period_start = sp.sub_start
                                                                            AND pay.period_end = sp.sub_end)
                                                                         OR
                                                                         (pay.period_start IS NULL
                                                                            AND pay.payment_date >= sp.sub_start
                                                                            AND pay.payment_date <= sp.sub_end)
                                                                     )
                        ), 0) AS paid_amount,
                        (
                                SELECT MAX(pay.payment_date)
                                    FROM payments pay
                                 WHERE pay.student_id = s.id
                                                                     AND (
                                                                         (pay.period_start IS NOT NULL AND pay.period_end IS NOT NULL
                                                                            AND pay.period_start = sp.sub_start
                                                                            AND pay.period_end = sp.sub_end)
                                                                         OR
                                                                         (pay.period_start IS NULL
                                                                            AND pay.payment_date >= sp.sub_start
                                                                            AND pay.payment_date <= sp.sub_end)
                                                                     )
                        ) AS last_payment_date,
            GREATEST(0, COALESCE(pl.amount, 0) - COALESCE((
                SELECT SUM(pay.amount)
                  FROM payments pay
                 WHERE pay.student_id = s.id
                                     AND (
                                         (pay.period_start IS NOT NULL AND pay.period_end IS NOT NULL
                                            AND pay.period_start = sp.sub_start
                                            AND pay.period_end = sp.sub_end)
                                         OR
                                         (pay.period_start IS NULL
                                            AND pay.payment_date >= sp.sub_start
                                            AND pay.payment_date <= sp.sub_end)
                                     )
            ), 0)) AS receivable,
            1 AS invoice_sort_group,
            COALESCE(sp.invoice_date, sp.sub_end, sp.created_at) AS invoice_sort_date
        FROM student_subscription_periods sp
        INNER JOIN students s ON s.id = sp.student_id
        LEFT JOIN plans pl ON pl.id = s.plan_id
        LEFT JOIN classes cl ON cl.id = s.class_id
        WHERE sp.invoice_no IS NOT NULL AND sp.invoice_no > 0
    ) q
    ORDER BY q.invoice_no DESC, q.invoice_sort_date DESC, q.id DESC"
);

if (!$result) {
    json_response(['message' => 'Failed to read invoices: ' . $conn->error], 500);
}

$rows = [];
while ($row = $result->fetch_assoc()) {
    unset($row['invoice_sort_group'], $row['invoice_sort_date']);
    $rows[] = $row;
}

json_response($rows);
