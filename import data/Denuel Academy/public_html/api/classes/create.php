<?php
require_once __DIR__ . '/../config.php';
require_super_admin();
require_method('POST');

$conn = db();

$conn->query(
    'CREATE TABLE IF NOT EXISTS classes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(120) NOT NULL,
        skill VARCHAR(120) NOT NULL,
        center VARCHAR(120) NOT NULL,
        level VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )'
);

$conn->query(
    'CREATE TABLE IF NOT EXISTS plans (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(120) NOT NULL,
        plan_type VARCHAR(30) NOT NULL,
        amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )'
);

function ensure_class_column_create($conn, $columnName, $alterSql)
{
    $safe = preg_replace('/[^a-zA-Z0-9_]/', '', $columnName);
    $check = $conn->query("SHOW COLUMNS FROM classes LIKE '{$safe}'");
    if ($check && $check->num_rows > 0) {
        return;
    }
    $conn->query($alterSql);
}

ensure_class_column_create($conn, 'skill', 'ALTER TABLE classes ADD COLUMN skill VARCHAR(120) NOT NULL DEFAULT ""');
ensure_class_column_create($conn, 'center', 'ALTER TABLE classes ADD COLUMN center VARCHAR(120) NOT NULL DEFAULT ""');
ensure_class_column_create($conn, 'plan_id', 'ALTER TABLE classes ADD COLUMN plan_id INT NULL');

function has_class_column_create($conn, $columnName)
{
    $safe = preg_replace('/[^a-zA-Z0-9_]/', '', $columnName);
    $check = $conn->query("SHOW COLUMNS FROM classes LIKE '{$safe}'");
    return ($check && $check->num_rows > 0);
}

$input = body_json();
$title = trim($input['title'] ?? '');
$skill = trim($input['skill'] ?? '');
$center = trim($input['center'] ?? '');
$planId = intval($input['plan_id'] ?? 0);
$level = trim($input['level'] ?? '');

if ($title === '' || $skill === '' || $center === '' || $planId <= 0 || $level === '') {
    json_response(['message' => 'title, skill, center, plan and level are required'], 400);
}

$planStmt = $conn->prepare('SELECT title FROM plans WHERE id = ? LIMIT 1');
$planStmt->bind_param('i', $planId);
$planStmt->execute();
$planResult = $planStmt->get_result();
$planRow = $planResult ? $planResult->fetch_assoc() : null;
if (!$planRow) {
    json_response(['message' => 'Selected plan not found'], 400);
}
$planTitle = trim($planRow['title'] ?? '');

$hasDays = has_class_column_create($conn, 'days');
$hasPlans = has_class_column_create($conn, 'plans');
$hasCoach = has_class_column_create($conn, 'coach');
$hasEnrolled = has_class_column_create($conn, 'enrolled');
$hasPlanId = has_class_column_create($conn, 'plan_id');

if ($hasDays && $hasPlans && $hasCoach) {
    // Legacy schema compatibility: fill old required columns.
    $days = '';
    $plans = $planTitle;
    $coach = '';
    $enrolled = 0;

    if ($hasEnrolled && $hasPlanId) {
        $stmt = $conn->prepare(
            'INSERT INTO classes (title, skill, center, level, plan_id, days, plans, coach, enrolled)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->bind_param('ssssisssi', $title, $skill, $center, $level, $planId, $days, $plans, $coach, $enrolled);
    } else if ($hasEnrolled) {
        $stmt = $conn->prepare(
            'INSERT INTO classes (title, skill, center, level, days, plans, coach, enrolled)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->bind_param('sssssssi', $title, $skill, $center, $level, $days, $plans, $coach, $enrolled);
    } else {
        $stmt = $conn->prepare(
            'INSERT INTO classes (title, skill, center, level, days, plans, coach)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->bind_param('sssssss', $title, $skill, $center, $level, $days, $plans, $coach);
    }
} else if ($hasPlanId) {
    $stmt = $conn->prepare(
        'INSERT INTO classes (title, skill, center, plan_id, level)
         VALUES (?, ?, ?, ?, ?)'
    );
    $stmt->bind_param('sssis', $title, $skill, $center, $planId, $level);
} else {
    $stmt = $conn->prepare(
        'INSERT INTO classes (title, skill, center, level)
         VALUES (?, ?, ?, ?)'
    );
    $stmt->bind_param('ssss', $title, $skill, $center, $level);
}

if (!$stmt->execute()) {
    json_response(['message' => 'Failed to create class: ' . $stmt->error], 500);
}

json_response(['message' => 'Class created', 'id' => $conn->insert_id], 201);