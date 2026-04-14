<?php
require_once __DIR__ . '/../config.php';
require_auth();
require_method('POST');

$input = body_json();
$id = intval($input['id'] ?? 0);
$studentId = intval($input['student_id'] ?? 0);
$subStart = trim((string)($input['sub_start'] ?? ''));
$subEnd = trim((string)($input['sub_end'] ?? ''));

if ($id <= 0 || $studentId <= 0 || $subStart === '' || $subEnd === '') {
    json_response(['message' => 'id, student_id, sub_start and sub_end are required'], 400);
}

$startDt = DateTime::createFromFormat('Y-m-d', $subStart);
$endDt = DateTime::createFromFormat('Y-m-d', $subEnd);
if (!$startDt || !$endDt || $startDt->format('Y-m-d') !== $subStart || $endDt->format('Y-m-d') !== $subEnd) {
    json_response(['message' => 'Dates must be in YYYY-MM-DD format'], 400);
}
if ($startDt > $endDt) {
    json_response(['message' => 'sub_start must be before or equal to sub_end'], 400);
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

$stmt = $conn->prepare(
    'UPDATE student_subscription_periods
        SET sub_start = ?,
            sub_end = ?,
            source = "manual_fix"
      WHERE id = ?
        AND student_id = ?'
);
if (!$stmt) {
    json_response(['message' => 'Prepare failed: ' . $conn->error], 500);
}
$stmt->bind_param('ssii', $subStart, $subEnd, $id, $studentId);
if (!$stmt->execute()) {
    json_response(['message' => 'Update failed: ' . $stmt->error], 500);
}

json_response(['message' => 'Past subscription updated']);
