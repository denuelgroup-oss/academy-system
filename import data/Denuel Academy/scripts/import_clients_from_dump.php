<?php
// One-time importer: moves clients from SQL dump into the app students table.
require_once __DIR__ . '/../public_html/api/config.php';

function ensure_student_col_import($conn, $col, $sql)
{
    $safe = preg_replace('/[^a-zA-Z0-9_]/', '', $col);
    $r = $conn->query("SHOW COLUMNS FROM students LIKE '$safe'");
    if ($r && $r->num_rows > 0) {
        return;
    }
    $conn->query($sql);
}

function table_exists($conn, $table)
{
    $safe = preg_replace('/[^a-zA-Z0-9_]/', '', $table);
    $res = $conn->query("SHOW TABLES LIKE '$safe'");
    return $res && $res->num_rows > 0;
}

function get_column_exists($conn, $table, $column)
{
    $safeTable = preg_replace('/[^a-zA-Z0-9_]/', '', $table);
    $safeCol = preg_replace('/[^a-zA-Z0-9_]/', '', $column);
    $res = $conn->query("SHOW COLUMNS FROM $safeTable LIKE '$safeCol'");
    return $res && $res->num_rows > 0;
}

function sql_unescape($value)
{
    return str_replace(
        ["\\'", '\\"', '\\\\', '\\n', '\\r', '\\t'],
        ["'", '"', '\\', "\n", "\r", "\t"],
        $value
    );
}

function parse_value_token($token)
{
    $token = trim($token);
    if ($token === 'NULL') {
        return null;
    }
    if (strlen($token) >= 2 && $token[0] === "'" && $token[strlen($token) - 1] === "'") {
        $inner = substr($token, 1, -1);
        return sql_unescape($inner);
    }
    return $token;
}

function parse_values_group($group)
{
    $values = [];
    $cur = '';
    $inStr = false;
    $escape = false;
    $len = strlen($group);

    for ($i = 0; $i < $len; $i++) {
        $ch = $group[$i];

        if ($escape) {
            $cur .= $ch;
            $escape = false;
            continue;
        }

        if ($ch === '\\') {
            $cur .= $ch;
            $escape = true;
            continue;
        }

        if ($ch === "'") {
            $cur .= $ch;
            $inStr = !$inStr;
            continue;
        }

        if (!$inStr && $ch === ',') {
            $values[] = parse_value_token($cur);
            $cur = '';
            continue;
        }

        $cur .= $ch;
    }

    if ($cur !== '') {
        $values[] = parse_value_token($cur);
    }

    return $values;
}

function parse_insert_rows($sqlContent, $table)
{
    $pattern = "/INSERT INTO `" . preg_quote($table, '/') . "` VALUES\\s*(.+?);/s";
    if (!preg_match($pattern, $sqlContent, $m)) {
        return [];
    }

    $blob = trim($m[1]);
    $rows = [];
    $depth = 0;
    $inStr = false;
    $escape = false;
    $cur = '';
    $len = strlen($blob);

    for ($i = 0; $i < $len; $i++) {
        $ch = $blob[$i];

        if ($escape) {
            if ($depth > 0) {
                $cur .= $ch;
            }
            $escape = false;
            continue;
        }

        if ($ch === '\\') {
            if ($depth > 0) {
                $cur .= $ch;
            }
            $escape = true;
            continue;
        }

        if ($ch === "'") {
            if ($depth > 0) {
                $cur .= $ch;
            }
            $inStr = !$inStr;
            continue;
        }

        if (!$inStr && $ch === '(') {
            if ($depth === 0) {
                $cur = '';
            } else {
                $cur .= $ch;
            }
            $depth++;
            continue;
        }

        if (!$inStr && $ch === ')') {
            $depth--;
            if ($depth === 0) {
                $rows[] = parse_values_group($cur);
                $cur = '';
            } else {
                $cur .= $ch;
            }
            continue;
        }

        if ($depth > 0) {
            $cur .= $ch;
        }
    }

    return $rows;
}

$conn = db();

ensure_student_col_import($conn, 'gender', "ALTER TABLE students ADD COLUMN gender VARCHAR(10) NULL");
ensure_student_col_import($conn, 'roll_no', "ALTER TABLE students ADD COLUMN roll_no VARCHAR(30) NULL");
ensure_student_col_import($conn, 'class_id', "ALTER TABLE students ADD COLUMN class_id INT NULL");
ensure_student_col_import($conn, 'plan_id', "ALTER TABLE students ADD COLUMN plan_id INT NULL");
ensure_student_col_import($conn, 'sub_start', "ALTER TABLE students ADD COLUMN sub_start DATE NULL");
ensure_student_col_import($conn, 'sub_end', "ALTER TABLE students ADD COLUMN sub_end DATE NULL");
ensure_student_col_import($conn, 'phone_code', "ALTER TABLE students ADD COLUMN phone_code VARCHAR(10) NULL DEFAULT '+355'");
ensure_student_col_import($conn, 'level', "ALTER TABLE students ADD COLUMN level VARCHAR(50) NULL");
ensure_student_col_import($conn, 'plan_type', "ALTER TABLE students ADD COLUMN plan_type VARCHAR(20) NULL DEFAULT 'subscription'");
ensure_student_col_import($conn, 'autorenew', "ALTER TABLE students ADD COLUMN autorenew TINYINT(1) NOT NULL DEFAULT 0");
ensure_student_col_import($conn, 'one_time_plan_id', "ALTER TABLE students ADD COLUMN one_time_plan_id INT NULL");
ensure_student_col_import($conn, 'invoice_date', "ALTER TABLE students ADD COLUMN invoice_date DATE NULL");
ensure_student_col_import($conn, 'invoice_prefix', "ALTER TABLE students ADD COLUMN invoice_prefix VARCHAR(20) NULL");
ensure_student_col_import($conn, 'invoice_no', "ALTER TABLE students ADD COLUMN invoice_no INT NULL");
ensure_student_col_import($conn, 'discount_type', "ALTER TABLE students ADD COLUMN discount_type VARCHAR(20) NULL DEFAULT 'none'");
ensure_student_col_import($conn, 'discount_value', "ALTER TABLE students ADD COLUMN discount_value DECIMAL(10,2) NULL DEFAULT 0");
ensure_student_col_import($conn, 'payment_type', "ALTER TABLE students ADD COLUMN payment_type VARCHAR(20) NULL DEFAULT 'full'");
ensure_student_col_import($conn, 'due_date', "ALTER TABLE students ADD COLUMN due_date DATE NULL");
ensure_student_col_import($conn, 'client_notes', "ALTER TABLE students ADD COLUMN client_notes TEXT NULL");
ensure_student_col_import($conn, 'photo', "ALTER TABLE students ADD COLUMN photo MEDIUMTEXT NULL");

$dumpPath = __DIR__ . '/../import data/database-export/academypro-hostinger.sql';
if (!file_exists($dumpPath)) {
    fwrite(STDERR, "Dump file not found: $dumpPath\n");
    exit(1);
}

$sql = file_get_contents($dumpPath);
if ($sql === false) {
    fwrite(STDERR, "Failed to read dump file.\n");
    exit(1);
}

$clientsRows = parse_insert_rows($sql, 'clients_client');
$otpRows = parse_insert_rows($sql, 'clients_client_one_time_plans');

if (count($clientsRows) === 0) {
    fwrite(STDERR, "No clients found in dump.\n");
    exit(1);
}

$oneTimeByClient = [];
foreach ($otpRows as $r) {
    if (count($r) < 3) {
        continue;
    }
    $clientId = intval($r[1]);
    $planId = intval($r[2]);
    if ($clientId > 0 && $planId > 0 && !isset($oneTimeByClient[$clientId])) {
        $oneTimeByClient[$clientId] = $planId;
    }
}

$validClassIds = [];
if (table_exists($conn, 'classes')) {
    $res = $conn->query('SELECT id FROM classes');
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            $validClassIds[intval($row['id'])] = true;
        }
    }
}

$validPlanIds = [];
if (table_exists($conn, 'plans')) {
    $res = $conn->query('SELECT id FROM plans');
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            $validPlanIds[intval($row['id'])] = true;
        }
    }
}

$needsCourseId = get_column_exists($conn, 'students', 'course_id');
$defaultCourseId = null;
if ($needsCourseId) {
    $resCourse = $conn->query('SELECT id FROM courses ORDER BY id ASC LIMIT 1');
    if ($resCourse && ($r = $resCourse->fetch_assoc())) {
        $defaultCourseId = intval($r['id']);
    }
    if (!$defaultCourseId) {
        $conn->query("INSERT INTO courses (title, duration, price) VALUES ('General English', 30, 0)");
        $defaultCourseId = intval($conn->insert_id);
    }
}

$dupStmt = $conn->prepare(
    "SELECT id FROM students
     WHERE (email = ? AND ? <> '')
        OR ((email IS NULL OR email = '') AND name = ? AND phone = ?)
     LIMIT 1"
);
if (!$dupStmt) {
    fwrite(STDERR, "Failed preparing duplicate check: " . $conn->error . "\n");
    exit(1);
}

if ($needsCourseId) {
    $insertSql = 'INSERT INTO students
        (name, gender, email, phone_code, phone, roll_no, level,
         class_id, plan_id, one_time_plan_id, plan_type, autorenew,
         sub_start, sub_end, invoice_date, invoice_prefix, invoice_no,
         discount_type, discount_value, payment_type, due_date, client_notes, photo, course_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    $insStmt = $conn->prepare($insertSql);
    if (!$insStmt) {
        fwrite(STDERR, "Failed preparing insert statement: " . $conn->error . "\n");
        exit(1);
    }
} else {
    $insertSql = 'INSERT INTO students
        (name, gender, email, phone_code, phone, roll_no, level,
         class_id, plan_id, one_time_plan_id, plan_type, autorenew,
         sub_start, sub_end, invoice_date, invoice_prefix, invoice_no,
         discount_type, discount_value, payment_type, due_date, client_notes, photo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    $insStmt = $conn->prepare($insertSql);
    if (!$insStmt) {
        fwrite(STDERR, "Failed preparing insert statement: " . $conn->error . "\n");
        exit(1);
    }
}

$inserted = 0;
$skipped = 0;

foreach ($clientsRows as $row) {
    if (count($row) < 21) {
        $skipped++;
        continue;
    }

    $srcId = intval($row[0]);
    $firstName = trim((string)($row[1] ?? ''));
    $lastName = trim((string)($row[2] ?? ''));
    $genderRaw = strtolower(trim((string)($row[4] ?? '')));
    $phone = trim((string)($row[5] ?? ''));
    $email = trim((string)($row[6] ?? ''));
    $photo = trim((string)($row[10] ?? ''));
    $enrollmentDate = trim((string)($row[11] ?? ''));
    $subStart = trim((string)($row[12] ?? ''));
    $subEnd = trim((string)($row[13] ?? ''));
    $notes = trim((string)($row[15] ?? ''));
    $classIdSrc = intval($row[18] ?? 0);
    $planIdSrc = intval($row[19] ?? 0);
    $autoRenew = intval($row[20] ?? 0) ? 1 : 0;

    $name = trim($firstName . ' ' . $lastName);
    if ($name === '') {
        $name = 'Client ' . $srcId;
    }

    $gender = '';
    if ($genderRaw === 'm' || $genderRaw === 'male') {
        $gender = 'Male';
    } elseif ($genderRaw === 'f' || $genderRaw === 'female') {
        $gender = 'Female';
    }

    $rollNo = 'CL-' . $srcId;
    $phoneCode = '+243';
    $level = '';
    $classId = (isset($validClassIds[$classIdSrc]) && $classIdSrc > 0) ? $classIdSrc : null;
    $planId = (isset($validPlanIds[$planIdSrc]) && $planIdSrc > 0) ? $planIdSrc : null;

    $oneTimeSrc = isset($oneTimeByClient[$srcId]) ? intval($oneTimeByClient[$srcId]) : 0;
    $oneTimePlanId = (isset($validPlanIds[$oneTimeSrc]) && $oneTimeSrc > 0) ? $oneTimeSrc : null;

    $planType = $planId ? 'subscription' : 'trial';
    $invoiceDate = $enrollmentDate !== '' ? $enrollmentDate : null;
    $invoicePrefix = 'INV';
    $invoiceNo = $srcId;
    $discountType = 'none';
    $discountValue = 0.0;
    $paymentType = 'full';
    $dueDate = $subEnd !== '' ? $subEnd : null;
    $clientNotes = $notes;
    $photoData = $photo !== '' ? $photo : null;

    $subStartSql = $subStart !== '' ? $subStart : null;
    $subEndSql = $subEnd !== '' ? $subEnd : null;

    $dupEmail = $email;
    $dupStmt->bind_param('ssss', $dupEmail, $dupEmail, $name, $phone);
    if (!$dupStmt->execute()) {
        fwrite(STDERR, "Duplicate check failed for $name: " . $dupStmt->error . "\n");
        $skipped++;
        continue;
    }
    $dupRes = $dupStmt->get_result();
    if ($dupRes && $dupRes->fetch_assoc()) {
        $skipped++;
        continue;
    }

    if ($needsCourseId) {
        $insStmt->bind_param(
            'sssssssiiisisssisssdsssi',
            $name, $gender, $email, $phoneCode, $phone, $rollNo, $level,
            $classId, $planId, $oneTimePlanId, $planType, $autoRenew,
            $subStartSql, $subEndSql, $invoiceDate, $invoicePrefix, $invoiceNo,
            $discountType, $discountValue, $paymentType, $dueDate,
            $clientNotes, $photoData, $defaultCourseId
        );
    } else {
        $insStmt->bind_param(
            'sssssssiiisisssisssdsss',
            $name, $gender, $email, $phoneCode, $phone, $rollNo, $level,
            $classId, $planId, $oneTimePlanId, $planType, $autoRenew,
            $subStartSql, $subEndSql, $invoiceDate, $invoicePrefix, $invoiceNo,
            $discountType, $discountValue, $paymentType, $dueDate,
            $clientNotes, $photoData
        );
    }

    if (!$insStmt->execute()) {
        fwrite(STDERR, "Insert failed for $name: " . $insStmt->error . "\n");
        $skipped++;
        continue;
    }

    $inserted++;
}

echo "Import complete. Inserted: $inserted, Skipped: $skipped\n";
