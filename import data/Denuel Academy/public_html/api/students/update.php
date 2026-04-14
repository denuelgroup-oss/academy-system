<?php
require_once __DIR__ . '/../config.php';
require_super_admin();
require_method('POST');

function ensure_student_plan_map_table_update($conn) {
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

$input           = body_json();
$id              = intval($input['id']           ?? 0);
$name            = trim($input['name']           ?? '');
$gender          = trim($input['gender']         ?? '');
$email           = trim($input['email']          ?? '');
$phone_code      = trim($input['phone_code']     ?? '+355');
$phone           = trim($input['phone']          ?? '');
$roll_no         = trim($input['roll_no']        ?? '');
$level           = trim($input['level']          ?? '');
$class_id        = intval($input['class_id']     ?? 0);
$plan_id         = intval($input['plan_id']      ?? 0);
$one_time_plan_id= intval($input['one_time_plan_id'] ?? 0);
$one_time_plan_ids_in = $input['one_time_plan_ids'] ?? [];
$plan_type       = trim($input['plan_type']      ?? 'subscription');
$autorenew       = intval($input['autorenew']    ?? 0);
$sub_start       = trim($input['sub_start']      ?? '');
$sub_end         = trim($input['sub_end']        ?? '');
$invoice_date    = trim($input['invoice_date']   ?? '');
$invoice_prefix  = trim($input['invoice_prefix'] ?? '');
$invoice_no      = intval($input['invoice_no']   ?? 0);
$discount_type   = trim($input['discount_type']  ?? 'none');
$discount_value  = floatval($input['discount_value'] ?? 0);
$payment_type    = trim($input['payment_type']   ?? 'full');
$due_date        = trim($input['due_date']       ?? '');
$client_notes    = trim($input['client_notes']   ?? '');
$photo           = $input['photo'] ?? '';
$date_of_birth   = trim($input['date_of_birth']  ?? '');

if ($id <= 0 || $name === '') json_response(['message' => 'id and name are required'], 400);

$allowed_plan_types = ['subscription','trial','one-time'];
if (!in_array($plan_type, $allowed_plan_types, true)) $plan_type = 'subscription';
$allowed_discount = ['none','fixed','percentage'];
if (!in_array($discount_type, $allowed_discount, true)) $discount_type = 'none';
$allowed_payment = ['full','installment'];
if (!in_array($payment_type, $allowed_payment, true)) $payment_type = 'full';

// Keep manually provided subscription dates per student; do not force global defaults.

$conn = db();
ensure_student_plan_map_table_update($conn);
$r = $conn->query("SHOW COLUMNS FROM students LIKE 'date_of_birth'");
if ($r && $r->num_rows === 0) { $conn->query("ALTER TABLE students ADD COLUMN date_of_birth DATE NULL"); }

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

// Auto-assign invoice number when not provided and student currently has none.
if ($invoice_no <= 0 && $plan_id > 0) {
    $existRes = $conn->prepare('SELECT invoice_no FROM students WHERE id = ? LIMIT 1');
    if ($existRes) {
        $existRes->bind_param('i', $id);
        $existRes->execute();
        $existRow = $existRes->get_result()->fetch_assoc();
        $currentInvoiceNo = intval($existRow['invoice_no'] ?? 0);
        if ($currentInvoiceNo <= 0) {
            $maxRes = $conn->query('SELECT COALESCE(MAX(invoice_no), 0) AS m FROM students');
            $invoice_no = $maxRes ? intval($maxRes->fetch_assoc()['m']) + 1 : 1;
        } else {
            $invoice_no = $currentInvoiceNo; // keep existing
        }
    }
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
    'UPDATE students
     SET name=?, gender=?, email=?, phone_code=?, phone=?, roll_no=?, level=?,
         class_id=?, plan_id=?, one_time_plan_id=?, plan_type=?, autorenew=?,
         sub_start=?, sub_end=?, invoice_date=?, invoice_prefix=?, invoice_no=?,
         discount_type=?, discount_value=?, payment_type=?, due_date=?,
         client_notes=?, photo=?, date_of_birth=?
     WHERE id=?'
);
if (!$stmt) {
    json_response(['message' => 'Failed to prepare student update: ' . $conn->error], 500);
}
$stmt->bind_param(
    'sssssssiiisissssisdsssssi',
    $name, $gender, $email, $phone_code, $phone, $roll_no, $level,
    $classIdSql, $planIdSql, $oneTimePlanIdSql, $plan_type,
    $autorenew,
    $subStartSql, $subEndSql,
    $invoiceDateSql, $invoice_prefix, $invoiceNoSql,
    $discount_type, $discount_value, $payment_type,
    $dueDateSql, $client_notes, $photoSql, $dobSql,
    $id
);

if (!$stmt->execute()) {
    json_response(['message' => 'Failed to update student: ' . $stmt->error], 500);
}

$conn->query('DELETE FROM student_one_time_plans WHERE student_id = ' . intval($id));
if (count($one_time_plan_ids) > 0) {
    $mapStmt = $conn->prepare('INSERT IGNORE INTO student_one_time_plans (student_id, plan_id) VALUES (?, ?)');
    if ($mapStmt) {
        foreach ($one_time_plan_ids as $pid) {
            $pidInt = intval($pid);
            $mapStmt->bind_param('ii', $id, $pidInt);
            $mapStmt->execute();
        }
    }
}

json_response(['message' => 'Student updated']);