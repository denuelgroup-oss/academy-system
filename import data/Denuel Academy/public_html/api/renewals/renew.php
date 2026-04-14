<?php
require_once __DIR__ . '/../config.php';
require_auth();
require_method('POST');

$body      = body_json();
$studentId = intval($body['student_id'] ?? 0);

if ($studentId <= 0) {
    json_response(['message' => 'student_id is required'], 400);
}

$conn = db();

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

// Ensure sub_end exists
$chk = $conn->query("SHOW COLUMNS FROM students LIKE 'sub_end'");
if ($chk && $chk->num_rows === 0) {
    $conn->query("ALTER TABLE students ADD COLUMN sub_end DATE NULL");
}

// Ensure invoice columns exist in student_subscription_periods for per-period invoice tracking
$chkInvNo = $conn->query("SHOW COLUMNS FROM student_subscription_periods LIKE 'invoice_no'");
if ($chkInvNo && $chkInvNo->num_rows === 0) {
    $conn->query("ALTER TABLE student_subscription_periods ADD COLUMN invoice_no INT NULL");
}
$chkInvDate = $conn->query("SHOW COLUMNS FROM student_subscription_periods LIKE 'invoice_date'");
if ($chkInvDate && $chkInvDate->num_rows === 0) {
    $conn->query("ALTER TABLE student_subscription_periods ADD COLUMN invoice_date DATE NULL");
}

// Get student + plan billing_cycle and subscription metadata to keep fields synchronized.
$stmt = $conn->prepare(
    'SELECT s.sub_start, s.sub_end, s.invoice_no, s.invoice_prefix, s.invoice_date,
            p.billing_cycle
     FROM students s
     LEFT JOIN plans p ON p.id = s.plan_id
     WHERE s.id = ? LIMIT 1'
);
if (!$stmt) json_response(['message' => 'Query failed: ' . $conn->error], 500);
$stmt->bind_param('i', $studentId);
$stmt->execute();
$student = $stmt->get_result()->fetch_assoc();
if (!$student) json_response(['message' => 'Student not found'], 404);

// Parse billing_cycle e.g. "1 Month", "3 Month", "1 Week"
$cycle = trim($student['billing_cycle'] ?? '1 Month');
$parts = explode(' ', $cycle);
$num   = max(1, intval($parts[0] ?? 1));
$unit  = strtolower($parts[1] ?? 'month');

// Manual renew must always start from the next subscription period,
// not from the date the button is clicked.
$today    = new DateTime();
$subEnd   = $student['sub_end'] ? new DateTime($student['sub_end']) : null;
$newStart = $subEnd ? (clone $subEnd)->modify('+1 day') : clone $today;
$newEnd   = clone $newStart;

if (strpos($unit, 'month') !== false) {
    $newEnd->modify("+{$num} month");
    $newEnd->modify('-1 day');
} elseif (strpos($unit, 'week') !== false) {
    $days = $num * 7 - 1;
    $newEnd->modify("+{$days} day");
} else {
    $newEnd->modify('+' . ($num - 1) . ' day');
}

$newSubEnd   = $newEnd->format('Y-m-d');
$newSubStart = $newStart->format('Y-m-d');

// Capture old invoice info before incrementing — needed to stamp the history record.
$oldInvoiceNo   = intval($student['invoice_no'] ?? 0);
$oldInvoiceDate = trim((string)($student['invoice_date'] ?? ''));

// Keep invoice cycle synchronized with the new subscription window.
$invoicePrefix = trim((string)($student['invoice_prefix'] ?? ''));
if ($invoicePrefix === '') {
    $invoicePrefix = 'INV-';
}

$invoiceNo = intval($student['invoice_no'] ?? 0);
if ($invoiceNo <= 0) {
    $maxInvoiceRes = $conn->query('SELECT COALESCE(MAX(invoice_no), 0) AS max_invoice_no FROM students');
    $maxInvoice = $maxInvoiceRes ? intval(($maxInvoiceRes->fetch_assoc()['max_invoice_no'] ?? 0)) : 0;
    $invoiceNo = $maxInvoice + 1;
} else {
    $invoiceNo += 1;
}

$invoiceDate = $newSubStart;
$dueDate = $newSubEnd;

// Keep a history of previous subscription windows so profile can list all past periods.
$oldSubStart = trim((string)($student['sub_start'] ?? ''));
$oldSubEnd = trim((string)($student['sub_end'] ?? ''));
if ($oldSubStart !== '' && $oldSubEnd !== '') {
    $hist = $conn->prepare(
        'INSERT INTO student_subscription_periods (student_id, sub_start, sub_end, source, invoice_no, invoice_date)
         VALUES (?, ?, ?, "manual_renew", ?, ?)
         ON DUPLICATE KEY UPDATE invoice_no = VALUES(invoice_no), invoice_date = VALUES(invoice_date)'
    );
    if ($hist) {
        $oldInvoiceDateBind = $oldInvoiceDate !== '' ? $oldInvoiceDate : null;
        $hist->bind_param('issis', $studentId, $oldSubStart, $oldSubEnd, $oldInvoiceNo, $oldInvoiceDateBind);
        $hist->execute();
    }
}

// Update both boundaries of the new subscription period.
$upd = $conn->prepare(
    'UPDATE students
     SET sub_start = ?,
         sub_end   = ?,
         invoice_date = ?,
         invoice_prefix = ?,
         invoice_no = ?,
         due_date = ?
     WHERE id = ?'
);
if (!$upd) json_response(['message' => 'Update prepare failed'], 500);
$upd->bind_param('ssssisi', $newSubStart, $newSubEnd, $invoiceDate, $invoicePrefix, $invoiceNo, $dueDate, $studentId);
if (!$upd->execute()) json_response(['message' => $upd->error], 500);

// Mark as recently renewed so Renewals page can display it for 2 days.
$conn->query(
    'CREATE TABLE IF NOT EXISTS renewals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        student_id INT NOT NULL UNIQUE,
        status VARCHAR(20) NOT NULL DEFAULT "pending",
        last_checked TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )'
);
$mark = $conn->prepare(
    'INSERT INTO renewals (student_id, status, last_checked)
     VALUES (?, "renewed", NOW())
     ON DUPLICATE KEY UPDATE status = "renewed", last_checked = NOW()'
);
if ($mark) {
    $mark->bind_param('i', $studentId);
    $mark->execute();
}

json_response([
    'message' => 'Student renewed',
    'sub_start' => $newSubStart,
    'sub_end' => $newSubEnd,
    'invoice_date' => $invoiceDate,
    'invoice_prefix' => $invoicePrefix,
    'invoice_no' => $invoiceNo,
    'invoice_label' => $invoicePrefix . $invoiceNo,
    'due_date' => $dueDate
]);
