<?php
require_once __DIR__ . '/../config.php';
require_super_admin();
require_method('POST');

$conn = db();
$input = body_json();
$id = (int)($input['id'] ?? 0);

if ($id <= 0) {
    json_response(['message' => 'Invalid schedule id'], 400);
}

$stmt = $conn->prepare('DELETE FROM class_schedules WHERE id = ? LIMIT 1');
if (!$stmt) {
    json_response(['message' => 'Failed to prepare schedule delete: ' . $conn->error], 500);
}
$stmt->bind_param('i', $id);

if (!$stmt->execute()) {
    json_response(['message' => 'Failed to delete schedule: ' . $stmt->error], 500);
}

if ($stmt->affected_rows === 0) {
    json_response(['message' => 'Schedule not found'], 404);
}

json_response(['message' => 'Schedule deleted']);
