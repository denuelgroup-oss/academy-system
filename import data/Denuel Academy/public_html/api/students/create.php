<?php
require_once __DIR__ . '/../config.php';
require_super_admin();
require_method('POST');

$conn = db();

function ensure_student_col_create($conn, $col, $sql) {
    $safe = preg_replace('/[^a-zA-Z0-9_]/', '', $col);
    $r = $conn->query("SHOW COLUMNS FROM students LIKE '$safe'");
    if ($r && $r->num_rows > 0) return;
    $conn->query($sql);
}

function ensure_student_plan_map_table($conn) {
    $conn->query(
        'CREATE TABLE IF NOT EXISTS student_one_time_plans (
            student_id INT NOT NULL,
            plan_id INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (student_id, plan_id),
            KEY idx_sotp_plan (plan_id)
        )'
    );
}

ensure_student_col_create($conn, 'gender',          "ALTER TABLE students ADD COLUMN gender VARCHAR(10) NULL");
ensure_student_col_create($conn, 'roll_no',         "ALTER TABLE students ADD COLUMN roll_no VARCHAR(30) NULL");
ensure_student_col_create($conn, 'class_id',        "ALTER TABLE students ADD COLUMN class_id INT NULL");
ensure_student_col_create($conn, 'plan_id',         "ALTER TABLE students ADD COLUMN plan_id INT NULL");
ensure_student_col_create($conn, 'sub_start',       "ALTER TABLE students ADD COLUMN sub_start DATE NULL");
ensure_student_col_create($conn, 'sub_end',         "ALTER TABLE students ADD COLUMN sub_end DATE NULL");
ensure_student_col_create($conn, 'phone_code',      "ALTER TABLE students ADD COLUMN phone_code VARCHAR(10) NULL DEFAULT '+355'");
ensure_student_col_create($conn, 'level',           "ALTER TABLE students ADD COLUMN level VARCHAR(50) NULL");
ensure_student_col_create($conn, 'plan_type',       "ALTER TABLE students ADD COLUMN plan_type VARCHAR(20) NULL DEFAULT 'subscription'");
ensure_student_col_create($conn, 'autorenew',       "ALTER TABLE students ADD COLUMN autorenew TINYINT(1) NOT NULL DEFAULT 0");
ensure_student_col_create($conn, 'one_time_plan_id',"ALTER TABLE students ADD COLUMN one_time_plan_id INT NULL");
ensure_student_col_create($conn, 'invoice_date',    "ALTER TABLE students ADD COLUMN invoice_date DATE NULL");
ensure_student_col_create($conn, 'invoice_prefix',  "ALTER TABLE students ADD COLUMN invoice_prefix VARCHAR(20) NULL");
ensure_student_col_create($conn, 'invoice_no',      "ALTER TABLE students ADD COLUMN invoice_no INT NULL");
ensure_student_col_create($conn, 'discount_type',   "ALTER TABLE students ADD COLUMN discount_type VARCHAR(20) NULL DEFAULT 'none'");
ensure_student_col_create($conn, 'discount_value',  "ALTER TABLE students ADD COLUMN discount_value DECIMAL(10,2) NULL DEFAULT 0");
ensure_student_col_create($conn, 'payment_type',    "ALTER TABLE students ADD COLUMN payment_type VARCHAR(20) NULL DEFAULT 'full'");
ensure_student_col_create($conn, 'due_date',        "ALTER TABLE students ADD COLUMN due_date DATE NULL");
ensure_student_col_create($conn, 'client_notes',    "ALTER TABLE students ADD COLUMN client_notes TEXT NULL");
ensure_student_col_create($conn, 'photo',           "ALTER TABLE students ADD COLUMN photo MEDIUMTEXT NULL");
ensure_student_col_create($conn, 'date_of_birth',   "ALTER TABLE students ADD COLUMN date_of_birth DATE NULL");
ensure_student_plan_map_table($conn);

$input           = body_json();
$name            = trim($input['name']          ?? '');
$gender          = trim($input['gender']        ?? '');
$email           = trim($input['email']         ?? '');
$phone_code      = trim($input['phone_code']    ?? '+355');
$phone           = trim($input['phone']         ?? '');
$level           = trim($input['level']         ?? '');
$class_id        = intval($input['class_id']    ?? 0);
$plan_id         = intval($input['plan_id']     ?? 0);
$one_time_plan_id= intval($input['one_time_plan_id'] ?? 0);
$one_time_plan_ids_in = $input['one_time_plan_ids'] ?? [];
$plan_type       = trim($input['plan_type']     ?? 'subscription');
$autorenew       = intval($input['autorenew']   ?? 0);
$sub_start       = trim($input['sub_start']     ?? '');
$sub_end         = trim($input['sub_end']       ?? '');
$invoice_date    = trim($input['invoice_date']  ?? '');
$invoice_prefix  = trim($input['invoice_prefix']?? '');
$invoice_no      = intval($input['invoice_no']  ?? 0);
$discount_type   = trim($input['discount_type'] ?? 'none');
$discount_value  = floatval($input['discount_value'] ?? 0);
$payment_type    = trim($input['payment_type']  ?? 'full');
$due_date        = trim($input['due_date']      ?? '');
$client_notes    = trim($input['client_notes']  ?? '');
$photo           = $input['photo'] ?? '';
$date_of_birth   = trim($input['date_of_birth'] ?? '');

if ($name === '') json_response(['message' => 'Name is required'], 400);

// Auto-generate roll number in format DF001, DF002, etc.
$maxRollResult = $conn->query(
    "SELECT CAST(SUBSTRING(roll_no, 3) AS UNSIGNED) as num FROM students 
     WHERE roll_no LIKE 'DF%' ORDER BY num DESC LIMIT 1"
);
$nextNum = 1;
if ($maxRollResult && $maxRollResult->num_rows > 0) {
    $maxRow = $maxRollResult->fetch_assoc();
    $nextNum = intval($maxRow['num']) + 1;
}
$roll_no = 'DF' . str_pad($nextNum, 3, '0', STR_PAD_LEFT);
$allowed_plan_types = ['subscription','trial','one-time'];
if (!in_array($plan_type, $allowed_plan_types, true)) $plan_type = 'subscription';
$allowed_discount   = ['none','fixed','percentage'];
if (!in_array($discount_type, $allowed_discount, true)) $discount_type = 'none';
$allowed_payment    = ['full','installment'];
if (!in_array($payment_type, $allowed_payment, true)) $payment_type = 'full';

// Keep manually provided subscription dates per student; do not force global defaults.

$one_time_plan_ids = [];
if (is_array($one_time_plan_ids_in)) {
    foreach ($one_time_plan_ids_in as $pid) {
        $v = intval($pid);
        if ($v > 0) {
            $one_time_plan_ids[$v] = true;
        }
    }
}
if ($one_time_plan_id > 0) {
    $one_time_plan_ids[$one_time_plan_id] = true;
}
$one_time_plan_ids = array_keys($one_time_plan_ids);

$classIdSql        = $class_id         > 0   ? $class_id         : null;
$planIdSql         = $plan_id          > 0   ? $plan_id          : null;
$oneTimePlanIdSql  = count($one_time_plan_ids) > 0 ? intval($one_time_plan_ids[0]) : null;
$subStartSql       = $sub_start       !== '' ? $sub_start        : null;
$subEndSql         = $sub_end         !== '' ? $sub_end          : null;
$dueDateSql        = $due_date        !== '' ? $due_date         : null;
$photoSql          = $photo           !== '' ? $photo            : null;
$dobSql            = $date_of_birth   !== '' ? $date_of_birth    : null;

// Auto-assign invoice number when not provided — same logic as renewal.
if ($invoice_no <= 0 && $plan_id > 0) {
    $maxRes = $conn->query('SELECT COALESCE(MAX(invoice_no), 0) AS m FROM students');
    $invoice_no = $maxRes ? intval($maxRes->fetch_assoc()['m']) + 1 : 1;
}
if ($invoice_prefix === '' && $invoice_no > 0) {
    $invoice_prefix = 'INV-';
}
if ($invoice_date === '' && $sub_start !== '') {
    $invoice_date = $sub_start;
}

$invoiceDateSql    = $invoice_date    !== '' ? $invoice_date     : null;
$invoiceNoSql      = $invoice_no       > 0   ? $invoice_no       : null;

$stmt = $conn->prepare(
    'INSERT INTO students (name, gender, email, phone_code, phone, roll_no, level,
        class_id, plan_id, one_time_plan_id, plan_type, autorenew,
        sub_start, sub_end, invoice_date, invoice_prefix, invoice_no,
        discount_type, discount_value, payment_type, due_date, client_notes, photo, date_of_birth)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
);
if (!$stmt) {
    json_response(['message' => 'Failed to prepare student create: ' . $conn->error], 500);
}
$stmt->bind_param(
    'sssssssiiisissssisdsssss',
    $name, $gender, $email, $phone_code, $phone, $roll_no, $level,
    $classIdSql, $planIdSql, $oneTimePlanIdSql, $plan_type,
    $autorenew,
    $subStartSql, $subEndSql,
    $invoiceDateSql, $invoice_prefix, $invoiceNoSql,
    $discount_type, $discount_value, $payment_type,
    $dueDateSql, $client_notes, $photoSql, $dobSql
);

if (!$stmt->execute()) {
    json_response(['message' => 'Failed to create student: ' . $stmt->error], 500);
}

$studentId = intval($conn->insert_id);
$conn->query('DELETE FROM student_one_time_plans WHERE student_id = ' . $studentId);
if (count($one_time_plan_ids) > 0) {
    $mapStmt = $conn->prepare('INSERT IGNORE INTO student_one_time_plans (student_id, plan_id) VALUES (?, ?)');
    if ($mapStmt) {
        foreach ($one_time_plan_ids as $pid) {
            $pidInt = intval($pid);
            $mapStmt->bind_param('ii', $studentId, $pidInt);
            $mapStmt->execute();
        }
    }
}

json_response(['message' => 'Student created', 'id' => $studentId, 'roll_no' => $roll_no], 201);