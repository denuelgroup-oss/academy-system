<?php
require_once __DIR__ . '/../public_html/api/config.php';

function ensure_student_col_csv($conn, $col, $sql)
{
    $safe = preg_replace('/[^a-zA-Z0-9_]/', '', $col);
    $r = $conn->query("SHOW COLUMNS FROM students LIKE '$safe'");
    if ($r && $r->num_rows > 0) {
        return;
    }
    $conn->query($sql);
}

function get_column_exists_csv($conn, $table, $column)
{
    $safeTable = preg_replace('/[^a-zA-Z0-9_]/', '', $table);
    $safeCol = preg_replace('/[^a-zA-Z0-9_]/', '', $column);
    $res = $conn->query("SHOW COLUMNS FROM $safeTable LIKE '$safeCol'");
    return $res && $res->num_rows > 0;
}

function normalize_name_csv($value)
{
    $value = strtoupper(trim((string)$value));
    $value = preg_replace('/\s+/', ' ', $value);
    return $value;
}

function normalize_phone_csv($value)
{
    return preg_replace('/\D+/', '', (string)$value);
}

function parse_date_csv($value)
{
    $value = trim((string)$value);
    if ($value === '') {
        return null;
    }

    $formats = ['n/j/Y', 'j/n/Y', 'Y-m-d', 'm/d/Y', 'd/m/Y'];
    foreach ($formats as $format) {
        $dt = DateTime::createFromFormat($format, $value);
        if ($dt instanceof DateTime) {
            return $dt->format('Y-m-d');
        }
    }

    $ts = strtotime($value);
    return $ts ? date('Y-m-d', $ts) : null;
}

function ensure_default_course_csv($conn)
{
    $res = $conn->query('SELECT id FROM courses ORDER BY id ASC LIMIT 1');
    if ($res && ($row = $res->fetch_assoc())) {
        return intval($row['id']);
    }

    $conn->query("INSERT INTO courses (title, duration, price) VALUES ('General English', 30, 0)");
    return intval($conn->insert_id);
}

function build_existing_indexes_csv($conn)
{
    $rows = [];
    $result = $conn->query('SELECT id, name, phone FROM students ORDER BY id ASC');
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $rows[] = $row;
        }
    }

    $byName = [];
    $byNamePhone = [];
    foreach ($rows as $row) {
        $nameKey = normalize_name_csv($row['name'] ?? '');
        $phoneKey = normalize_phone_csv($row['phone'] ?? '');
        if ($nameKey !== '' && !isset($byName[$nameKey])) {
            $byName[$nameKey] = intval($row['id']);
        }
        if ($nameKey !== '' && $phoneKey !== '' && !isset($byNamePhone[$nameKey . '|' . $phoneKey])) {
            $byNamePhone[$nameKey . '|' . $phoneKey] = intval($row['id']);
        }
    }

    return [$byName, $byNamePhone];
}

function cleanup_duplicate_names_csv($conn)
{
    $groups = [];
    $result = $conn->query('SELECT id, name FROM students ORDER BY id ASC');
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $key = normalize_name_csv($row['name'] ?? '');
            if ($key === '') {
                continue;
            }
            if (!isset($groups[$key])) {
                $groups[$key] = [];
            }
            $groups[$key][] = intval($row['id']);
        }
    }

    $deleted = 0;
    $deleteStmt = $conn->prepare('DELETE FROM students WHERE id = ?');
    if (!$deleteStmt) {
        return 0;
    }

    foreach ($groups as $ids) {
        if (count($ids) < 2) {
            continue;
        }
        sort($ids);
        $keepId = array_shift($ids);
        foreach ($ids as $id) {
            if ($id === $keepId) {
                continue;
            }
            $deleteStmt->bind_param('i', $id);
            if ($deleteStmt->execute()) {
                $deleted++;
            }
        }
    }

    return $deleted;
}

$conn = db();

ensure_student_col_csv($conn, 'gender', "ALTER TABLE students ADD COLUMN gender VARCHAR(10) NULL");
ensure_student_col_csv($conn, 'roll_no', "ALTER TABLE students ADD COLUMN roll_no VARCHAR(30) NULL");
ensure_student_col_csv($conn, 'class_id', "ALTER TABLE students ADD COLUMN class_id INT NULL");
ensure_student_col_csv($conn, 'plan_id', "ALTER TABLE students ADD COLUMN plan_id INT NULL");
ensure_student_col_csv($conn, 'sub_start', "ALTER TABLE students ADD COLUMN sub_start DATE NULL");
ensure_student_col_csv($conn, 'sub_end', "ALTER TABLE students ADD COLUMN sub_end DATE NULL");
ensure_student_col_csv($conn, 'phone_code', "ALTER TABLE students ADD COLUMN phone_code VARCHAR(10) NULL DEFAULT '+355'");
ensure_student_col_csv($conn, 'level', "ALTER TABLE students ADD COLUMN level VARCHAR(50) NULL");
ensure_student_col_csv($conn, 'plan_type', "ALTER TABLE students ADD COLUMN plan_type VARCHAR(20) NULL DEFAULT 'subscription'");
ensure_student_col_csv($conn, 'autorenew', "ALTER TABLE students ADD COLUMN autorenew TINYINT(1) NOT NULL DEFAULT 0");
ensure_student_col_csv($conn, 'one_time_plan_id', "ALTER TABLE students ADD COLUMN one_time_plan_id INT NULL");
ensure_student_col_csv($conn, 'invoice_date', "ALTER TABLE students ADD COLUMN invoice_date DATE NULL");
ensure_student_col_csv($conn, 'invoice_prefix', "ALTER TABLE students ADD COLUMN invoice_prefix VARCHAR(20) NULL");
ensure_student_col_csv($conn, 'invoice_no', "ALTER TABLE students ADD COLUMN invoice_no INT NULL");
ensure_student_col_csv($conn, 'discount_type', "ALTER TABLE students ADD COLUMN discount_type VARCHAR(20) NULL DEFAULT 'none'");
ensure_student_col_csv($conn, 'discount_value', "ALTER TABLE students ADD COLUMN discount_value DECIMAL(10,2) NULL DEFAULT 0");
ensure_student_col_csv($conn, 'payment_type', "ALTER TABLE students ADD COLUMN payment_type VARCHAR(20) NULL DEFAULT 'full'");
ensure_student_col_csv($conn, 'due_date', "ALTER TABLE students ADD COLUMN due_date DATE NULL");
ensure_student_col_csv($conn, 'client_notes', "ALTER TABLE students ADD COLUMN client_notes TEXT NULL");
ensure_student_col_csv($conn, 'photo', "ALTER TABLE students ADD COLUMN photo MEDIUMTEXT NULL");

$csvPath = __DIR__ . '/../import data/Academy App/import data/20260322_103427_Spyn-data_.csv';
if (!file_exists($csvPath)) {
    fwrite(STDERR, "CSV file not found: $csvPath\n");
    exit(1);
}

$needsCourseId = get_column_exists_csv($conn, 'students', 'course_id');
$defaultCourseId = $needsCourseId ? ensure_default_course_csv($conn) : null;

$handle = fopen($csvPath, 'r');
if (!$handle) {
    fwrite(STDERR, "Failed to open CSV file.\n");
    exit(1);
}

$headers = fgetcsv($handle);
if (!$headers) {
    fclose($handle);
    fwrite(STDERR, "CSV headers missing.\n");
    exit(1);
}

[$existingByName, $existingByNamePhone] = build_existing_indexes_csv($conn);

if ($needsCourseId) {
    $insertSql = 'INSERT INTO students
      (name, gender, email, phone_code, phone, roll_no, level,
       class_id, plan_id, one_time_plan_id, plan_type, autorenew,
       sub_start, sub_end, invoice_date, invoice_prefix, invoice_no,
       discount_type, discount_value, payment_type, due_date, client_notes, photo, course_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    $insertStmt = $conn->prepare($insertSql);
} else {
    $insertSql = 'INSERT INTO students
      (name, gender, email, phone_code, phone, roll_no, level,
       class_id, plan_id, one_time_plan_id, plan_type, autorenew,
       sub_start, sub_end, invoice_date, invoice_prefix, invoice_no,
       discount_type, discount_value, payment_type, due_date, client_notes, photo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    $insertStmt = $conn->prepare($insertSql);
}

$updateSql = 'UPDATE students
  SET name=?, gender=?, email=?, phone_code=?, phone=?, roll_no=?, level=?,
      class_id=?, plan_id=?, one_time_plan_id=?, plan_type=?, autorenew=?,
      sub_start=?, sub_end=?, invoice_date=?, invoice_prefix=?, invoice_no=?,
      discount_type=?, discount_value=?, payment_type=?, due_date=?, client_notes=?, photo=?
  WHERE id=?';
$updateStmt = $conn->prepare($updateSql);

if (!$insertStmt || !$updateStmt) {
    fclose($handle);
    fwrite(STDERR, "Failed to prepare import statements: " . $conn->error . "\n");
    exit(1);
}

$inserted = 0;
$updated = 0;
$skipped = 0;
$rowIndex = 0;

while (($data = fgetcsv($handle)) !== false) {
    $rowIndex++;
    if (count($data) !== count($headers)) {
        $skipped++;
        continue;
    }

    $row = array_combine($headers, $data);
    $name = trim((string)($row['Name'] ?? ''));
    if ($name === '') {
        $skipped++;
        continue;
    }

    $phone = trim((string)($row['Mobile'] ?? ''));
    $nameKey = normalize_name_csv($name);
    $phoneKey = normalize_phone_csv($phone);
    $existingId = null;
    if ($nameKey !== '' && $phoneKey !== '' && isset($existingByNamePhone[$nameKey . '|' . $phoneKey])) {
        $existingId = $existingByNamePhone[$nameKey . '|' . $phoneKey];
    } elseif ($nameKey !== '' && isset($existingByName[$nameKey])) {
        $existingId = $existingByName[$nameKey];
    }

    $subStart = parse_date_csv($row['Start date'] ?? '');
    $subEnd = parse_date_csv($row['End date'] ?? '');
    $invoiceDate = parse_date_csv($row['DOJ'] ?? '');
    if ($invoiceDate === null) {
        $invoiceDate = $subStart;
    }
    $pendingAmountRaw = trim((string)($row['Pending Amount'] ?? ''));
    $abonnement = trim((string)($row['Abonnement'] ?? ''));
    $clientNotes = $pendingAmountRaw !== '' ? 'Imported from CSV. Pending Amount: ' . $pendingAmountRaw : 'Imported from CSV.';
    $phoneCode = '+243';
    $rollNo = 'CSV-' . str_pad((string)$rowIndex, 3, '0', STR_PAD_LEFT);
    $level = $abonnement;
    $classId = null;
    $planId = null;
    $oneTimePlanId = null;
    $planType = 'subscription';
    $autorenew = 0;
    $invoicePrefix = 'CSV';
    $invoiceNo = $rowIndex;
    $discountType = 'none';
    $discountValue = 0.0;
    $paymentType = 'installment';
    $dueDate = $subEnd;
    $photo = null;
    $gender = '';
    $email = '';

    if ($existingId) {
        $updateStmt->bind_param(
            'sssssssiiisisssisssdsssi',
            $name, $gender, $email, $phoneCode, $phone, $rollNo, $level,
            $classId, $planId, $oneTimePlanId, $planType, $autorenew,
            $subStart, $subEnd, $invoiceDate, $invoicePrefix, $invoiceNo,
            $discountType, $discountValue, $paymentType, $dueDate, $clientNotes, $photo,
            $existingId
        );
        if ($updateStmt->execute()) {
            $updated++;
            $existingByName[$nameKey] = $existingId;
            if ($phoneKey !== '') {
                $existingByNamePhone[$nameKey . '|' . $phoneKey] = $existingId;
            }
        } else {
            $skipped++;
        }
        continue;
    }

    if ($needsCourseId) {
        $insertStmt->bind_param(
            'sssssssiiisisssisssdsssi',
            $name, $gender, $email, $phoneCode, $phone, $rollNo, $level,
            $classId, $planId, $oneTimePlanId, $planType, $autorenew,
            $subStart, $subEnd, $invoiceDate, $invoicePrefix, $invoiceNo,
            $discountType, $discountValue, $paymentType, $dueDate, $clientNotes, $photo,
            $defaultCourseId
        );
    } else {
        $insertStmt->bind_param(
            'sssssssiiisisssisssdsss',
            $name, $gender, $email, $phoneCode, $phone, $rollNo, $level,
            $classId, $planId, $oneTimePlanId, $planType, $autorenew,
            $subStart, $subEnd, $invoiceDate, $invoicePrefix, $invoiceNo,
            $discountType, $discountValue, $paymentType, $dueDate, $clientNotes, $photo
        );
    }

    if ($insertStmt->execute()) {
        $studentId = intval($conn->insert_id);
        $inserted++;
        $existingByName[$nameKey] = $studentId;
        if ($phoneKey !== '') {
            $existingByNamePhone[$nameKey . '|' . $phoneKey] = $studentId;
        }
    } else {
        $skipped++;
    }
}

fclose($handle);

$deletedDuplicates = cleanup_duplicate_names_csv($conn);

$countRes = $conn->query('SELECT COUNT(*) AS total FROM students');
$totalStudents = $countRes ? intval(($countRes->fetch_assoc()['total'] ?? 0)) : 0;

echo 'CSV import complete. Inserted: ' . $inserted
    . ', Updated: ' . $updated
    . ', Skipped: ' . $skipped
    . ', Deleted duplicates: ' . $deletedDuplicates
    . ', Total students: ' . $totalStudents . PHP_EOL;