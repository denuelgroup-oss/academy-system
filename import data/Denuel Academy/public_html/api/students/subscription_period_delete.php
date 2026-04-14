<?php
require_once __DIR__ . '/../config.php';
require_auth();
require_method('POST');

$input = body_json();
$id = intval($input['id'] ?? 0);
$studentId = intval($input['student_id'] ?? 0);

if ($id <= 0 || $studentId <= 0) {
    json_response(['message' => 'id and student_id are required'], 400);
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
    'DELETE FROM student_subscription_periods
      WHERE id = ?
        AND student_id = ?'
);
if (!$stmt) {
    json_response(['message' => 'Prepare failed: ' . $conn->error], 500);
}
$stmt->bind_param('ii', $id, $studentId);
if (!$stmt->execute()) {
    json_response(['message' => 'Delete failed: ' . $stmt->error], 500);
}

json_response(['message' => 'Past subscription deleted']);
