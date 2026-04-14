<?php
require_once __DIR__ . '/../config.php';
require_super_admin();
require_method('POST');

$conn = db();

function ensure_schedule_column_update($conn, $columnName, $alterSql)
{
    $safe = preg_replace('/[^a-zA-Z0-9_]/', '', $columnName);
    $check = $conn->query("SHOW COLUMNS FROM class_schedules LIKE '{$safe}'");
    if ($check && $check->num_rows > 0) {
        return;
    }
    $conn->query($alterSql);
}

ensure_schedule_column_update($conn, 'class_id', 'ALTER TABLE class_schedules ADD COLUMN class_id INT NOT NULL DEFAULT 0');
ensure_schedule_column_update($conn, 'center', "ALTER TABLE class_schedules ADD COLUMN center VARCHAR(120) NOT NULL DEFAULT ''");
ensure_schedule_column_update($conn, 'from_date', 'ALTER TABLE class_schedules ADD COLUMN from_date DATE NOT NULL DEFAULT (CURDATE())');
ensure_schedule_column_update($conn, 'upto_date', 'ALTER TABLE class_schedules ADD COLUMN upto_date DATE NULL');
ensure_schedule_column_update($conn, 'sun_start', 'ALTER TABLE class_schedules ADD COLUMN sun_start TIME NULL');
ensure_schedule_column_update($conn, 'sun_end', 'ALTER TABLE class_schedules ADD COLUMN sun_end TIME NULL');
ensure_schedule_column_update($conn, 'mon_start', 'ALTER TABLE class_schedules ADD COLUMN mon_start TIME NULL');
ensure_schedule_column_update($conn, 'mon_end', 'ALTER TABLE class_schedules ADD COLUMN mon_end TIME NULL');
ensure_schedule_column_update($conn, 'tue_start', 'ALTER TABLE class_schedules ADD COLUMN tue_start TIME NULL');
ensure_schedule_column_update($conn, 'tue_end', 'ALTER TABLE class_schedules ADD COLUMN tue_end TIME NULL');
ensure_schedule_column_update($conn, 'wed_start', 'ALTER TABLE class_schedules ADD COLUMN wed_start TIME NULL');
ensure_schedule_column_update($conn, 'wed_end', 'ALTER TABLE class_schedules ADD COLUMN wed_end TIME NULL');
ensure_schedule_column_update($conn, 'thu_start', 'ALTER TABLE class_schedules ADD COLUMN thu_start TIME NULL');
ensure_schedule_column_update($conn, 'thu_end', 'ALTER TABLE class_schedules ADD COLUMN thu_end TIME NULL');
ensure_schedule_column_update($conn, 'fri_start', 'ALTER TABLE class_schedules ADD COLUMN fri_start TIME NULL');
ensure_schedule_column_update($conn, 'fri_end', 'ALTER TABLE class_schedules ADD COLUMN fri_end TIME NULL');
ensure_schedule_column_update($conn, 'sat_start', 'ALTER TABLE class_schedules ADD COLUMN sat_start TIME NULL');
ensure_schedule_column_update($conn, 'sat_end', 'ALTER TABLE class_schedules ADD COLUMN sat_end TIME NULL');

$input = body_json();
$id = (int)($input['id'] ?? 0);
$classId = (int)($input['class_id'] ?? 0);
$fromDate = trim($input['from_date'] ?? '');
$uptoDate = trim($input['upto_date'] ?? '');

if ($id <= 0) {
    json_response(['message' => 'Invalid schedule id'], 400);
}
if ($classId <= 0) {
    json_response(['message' => 'Please select a class'], 400);
}
if ($fromDate === '') {
    json_response(['message' => 'Date is required'], 400);
}
if ($uptoDate !== '' && $uptoDate < $fromDate) {
    json_response(['message' => 'Upto date cannot be before Date'], 400);
}

$existsStmt = $conn->prepare('SELECT id FROM class_schedules WHERE id = ? LIMIT 1');
if (!$existsStmt) {
    json_response(['message' => 'Failed to prepare schedule lookup: ' . $conn->error], 500);
}
$existsStmt->bind_param('i', $id);
$existsStmt->execute();
$exists = $existsStmt->get_result()->fetch_assoc();
if (!$exists) {
    json_response(['message' => 'Schedule not found'], 404);
}

$classStmt = $conn->prepare('SELECT title, center, level FROM classes WHERE id = ? LIMIT 1');
if (!$classStmt) {
    json_response(['message' => 'Failed to prepare class lookup: ' . $conn->error], 500);
}
$classStmt->bind_param('i', $classId);
$classStmt->execute();
$classRow = $classStmt->get_result()->fetch_assoc();
if (!$classRow) {
    json_response(['message' => 'Selected class not found'], 400);
}
$className = $classRow['title'];
$center = $classRow['center'];
$level = $classRow['level'];

$sunStart = trim($input['sun_start'] ?? '');
$sunEnd = trim($input['sun_end'] ?? '');
$monStart = trim($input['mon_start'] ?? '');
$monEnd = trim($input['mon_end'] ?? '');
$tueStart = trim($input['tue_start'] ?? '');
$tueEnd = trim($input['tue_end'] ?? '');
$wedStart = trim($input['wed_start'] ?? '');
$wedEnd = trim($input['wed_end'] ?? '');
$thuStart = trim($input['thu_start'] ?? '');
$thuEnd = trim($input['thu_end'] ?? '');
$friStart = trim($input['fri_start'] ?? '');
$friEnd = trim($input['fri_end'] ?? '');
$satStart = trim($input['sat_start'] ?? '');
$satEnd = trim($input['sat_end'] ?? '');

$dayPairs = [
    ['Sun', $sunStart, $sunEnd],
    ['Mon', $monStart, $monEnd],
    ['Tue', $tueStart, $tueEnd],
    ['Wed', $wedStart, $wedEnd],
    ['Thu', $thuStart, $thuEnd],
    ['Fri', $friStart, $friEnd],
    ['Sat', $satStart, $satEnd],
];
$hasAnyTiming = false;
foreach ($dayPairs as $pair) {
    $start = $pair[1];
    $end = $pair[2];
    if (($start !== '' && $end === '') || ($start === '' && $end !== '')) {
        json_response(['message' => $pair[0] . ': both start and end times are required'], 400);
    }
    if ($start !== '' && $end !== '') {
        if ($end <= $start) {
            json_response(['message' => $pair[0] . ': end time must be after start time'], 400);
        }
        $hasAnyTiming = true;
    }
}
if (!$hasAnyTiming) {
    json_response(['message' => 'Set start and end timing for at least one day'], 400);
}

$uptoDateSql = $uptoDate === '' ? null : $uptoDate;
$sunStartSql = $sunStart === '' ? null : $sunStart;
$sunEndSql = $sunEnd === '' ? null : $sunEnd;
$monStartSql = $monStart === '' ? null : $monStart;
$monEndSql = $monEnd === '' ? null : $monEnd;
$tueStartSql = $tueStart === '' ? null : $tueStart;
$tueEndSql = $tueEnd === '' ? null : $tueEnd;
$wedStartSql = $wedStart === '' ? null : $wedStart;
$wedEndSql = $wedEnd === '' ? null : $wedEnd;
$thuStartSql = $thuStart === '' ? null : $thuStart;
$thuEndSql = $thuEnd === '' ? null : $thuEnd;
$friStartSql = $friStart === '' ? null : $friStart;
$friEndSql = $friEnd === '' ? null : $friEnd;
$satStartSql = $satStart === '' ? null : $satStart;
$satEndSql = $satEnd === '' ? null : $satEnd;

$updateStmt = $conn->prepare(
    'UPDATE class_schedules
     SET class_id=?, class_name=?, level=?, center=?, from_date=?, upto_date=?,
         sun_start=?, sun_end=?, mon_start=?, mon_end=?, tue_start=?, tue_end=?,
         wed_start=?, wed_end=?, thu_start=?, thu_end=?, fri_start=?, fri_end=?,
         sat_start=?, sat_end=?
     WHERE id=?'
);
if (!$updateStmt) {
    json_response(['message' => 'Failed to prepare schedule update: ' . $conn->error], 500);
}
$updateStmt->bind_param(
    'isssssssssssssssssssi',
    $classId, $className, $level, $center,
    $fromDate, $uptoDateSql,
    $sunStartSql, $sunEndSql,
    $monStartSql, $monEndSql,
    $tueStartSql, $tueEndSql,
    $wedStartSql, $wedEndSql,
    $thuStartSql, $thuEndSql,
    $friStartSql, $friEndSql,
    $satStartSql, $satEndSql,
    $id
);

if (!$updateStmt->execute()) {
    json_response(['message' => 'Failed to update schedule: ' . $updateStmt->error], 500);
}

json_response(['message' => 'Schedule updated']);
