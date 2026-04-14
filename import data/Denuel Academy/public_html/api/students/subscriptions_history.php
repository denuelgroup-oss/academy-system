<?php
require_once __DIR__ . '/../finance.php';
require_auth();
require_method('GET');

$conn = db();
ensure_payment_extra_columns($conn);
backfill_legacy_payment_period_links($conn);
$studentId = intval($_GET['student_id'] ?? 0);
if ($studentId <= 0) {
    json_response(['message' => 'student_id is required'], 400);
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

// Backfill historical periods from payment windows to support existing data.
$backfill = $conn->prepare(
    'INSERT IGNORE INTO student_subscription_periods (student_id, sub_start, sub_end, source)
     SELECT p.student_id,
                        DATE(COALESCE(p.period_start, p.payment_date)) AS sub_start,
                        DATE(COALESCE(p.period_end, p.expiry_date, p.payment_date)) AS sub_end,
            "payment"
       FROM payments p
      WHERE p.student_id = ?
        AND p.payment_date IS NOT NULL'
);
if ($backfill) {
    $backfill->bind_param('i', $studentId);
    $backfill->execute();
}

// Ensure invoice columns exist on the periods table (added by renew.php, may not exist yet).
$chkInvNo = $conn->query("SHOW COLUMNS FROM student_subscription_periods LIKE 'invoice_no'");
if ($chkInvNo && $chkInvNo->num_rows === 0) {
    $conn->query("ALTER TABLE student_subscription_periods ADD COLUMN invoice_no INT NULL");
}
$chkInvDate = $conn->query("SHOW COLUMNS FROM student_subscription_periods LIKE 'invoice_date'");
if ($chkInvDate && $chkInvDate->num_rows === 0) {
    $conn->query("ALTER TABLE student_subscription_periods ADD COLUMN invoice_date DATE NULL");
}

// Backfill missing invoice numbers for subscription periods.
// Uses the global max invoice number across students and period history,
// then increments for each missing period.
$missingStmt = $conn->prepare(
    'SELECT id
       FROM student_subscription_periods
      WHERE student_id = ?
        AND (invoice_no IS NULL OR invoice_no = 0)
      ORDER BY sub_start ASC, id ASC'
);
if ($missingStmt) {
    $missingStmt->bind_param('i', $studentId);
    $missingStmt->execute();
    $missingRes = $missingStmt->get_result();

    if ($missingRes && $missingRes->num_rows > 0) {
        $maxStudentsRes = $conn->query('SELECT COALESCE(MAX(invoice_no), 0) AS m FROM students');
        $maxPeriodsRes = $conn->query('SELECT COALESCE(MAX(invoice_no), 0) AS m FROM student_subscription_periods');
        $maxStudents = $maxStudentsRes ? intval(($maxStudentsRes->fetch_assoc()['m'] ?? 0)) : 0;
        $maxPeriods = $maxPeriodsRes ? intval(($maxPeriodsRes->fetch_assoc()['m'] ?? 0)) : 0;
        $nextInvoiceNo = max($maxStudents, $maxPeriods) + 1;

        $updMissing = $conn->prepare(
            'UPDATE student_subscription_periods
                SET invoice_no = ?,
                    invoice_date = COALESCE(invoice_date, sub_start, CURDATE())
              WHERE id = ?'
        );
        if ($updMissing) {
            while ($miss = $missingRes->fetch_assoc()) {
                $periodId = intval($miss['id'] ?? 0);
                if ($periodId <= 0) continue;
                $updMissing->bind_param('ii', $nextInvoiceNo, $periodId);
                $updMissing->execute();
                $nextInvoiceNo++;
            }
        }
    }
}

$stmt = $conn->prepare(
    'SELECT id, sub_start, sub_end, source, invoice_no, invoice_date, created_at
       FROM student_subscription_periods
      WHERE student_id = ?
      ORDER BY sub_start DESC, sub_end DESC, id DESC'
);
if (!$stmt) {
    json_response(['message' => 'Query failed: ' . $conn->error], 500);
}
$stmt->bind_param('i', $studentId);
$stmt->execute();
$result = $stmt->get_result();

$rows = [];
if ($result) {
    while ($row = $result->fetch_assoc()) {
        $rows[] = $row;
    }
}

json_response($rows);
