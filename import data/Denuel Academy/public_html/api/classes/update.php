<?php
require_once __DIR__ . '/../config.php';
require_super_admin();
require_method('POST');

$conn = db();

$conn->query(
    'CREATE TABLE IF NOT EXISTS plans (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(120) NOT NULL,
        plan_type VARCHAR(30) NOT NULL,
        amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )'
);

function has_class_column_update($conn, $columnName)
{
    $safe = preg_replace('/[^a-zA-Z0-9_]/', '', $columnName);
    $check = $conn->query("SHOW COLUMNS FROM classes LIKE '{$safe}'");
    return ($check && $check->num_rows > 0);
}

$input = body_json();
$id = intval($input['id'] ?? 0);
$title = trim($input['title'] ?? '');
$skill = trim($input['skill'] ?? '');
$center = trim($input['center'] ?? '');
$planId = intval($input['plan_id'] ?? 0);
$level = trim($input['level'] ?? '');

if ($id <= 0 || $title === '' || $skill === '' || $center === '' || $planId <= 0 || $level === '') {
    json_response(['message' => 'id, title, skill, center, plan and level are required'], 400);
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

$hasDays = has_class_column_update($conn, 'days');
$hasPlans = has_class_column_update($conn, 'plans');
$hasCoach = has_class_column_update($conn, 'coach');
 $hasPlanId = has_class_column_update($conn, 'plan_id');

if ($hasDays && $hasPlans && $hasCoach) {
    if ($hasPlanId) {
        $stmt = $conn->prepare(
            'UPDATE classes
             SET title = ?, skill = ?, center = ?, level = ?, plan_id = ?, days = ?, plans = ?, coach = ?
             WHERE id = ?'
        );
    } else {
        $stmt = $conn->prepare(
            'UPDATE classes
             SET title = ?, skill = ?, center = ?, level = ?, days = ?, plans = ?, coach = ?
             WHERE id = ?'
        );
    }
    $days = '';
    $plans = $planTitle;
    $coach = '';
    if ($hasPlanId) {
        $stmt->bind_param('ssssisssi', $title, $skill, $center, $level, $planId, $days, $plans, $coach, $id);
    } else {
        $stmt->bind_param('sssssssi', $title, $skill, $center, $level, $days, $plans, $coach, $id);
    }
} else if ($hasPlanId) {
    $stmt = $conn->prepare(
        'UPDATE classes
         SET title = ?, skill = ?, center = ?, plan_id = ?, level = ?
         WHERE id = ?'
    );
    $stmt->bind_param('sssisi', $title, $skill, $center, $planId, $level, $id);
} else {
    $stmt = $conn->prepare(
        'UPDATE classes
         SET title = ?, skill = ?, center = ?, level = ?
         WHERE id = ?'
    );
    $stmt->bind_param('ssssi', $title, $skill, $center, $level, $id);
}

if (!$stmt->execute()) {
    json_response(['message' => 'Failed to update class: ' . $stmt->error], 500);
}

json_response(['message' => 'Class updated']);