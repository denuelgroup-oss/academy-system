<?php
require_once __DIR__ . '/../config.php';
require_super_admin();
require_method('POST');

$input = body_json();
$id = intval($input['id'] ?? 0);

if ($id <= 0) {
    json_response(['message' => 'id is required'], 400);
}

$conn = db();
$stmt = $conn->prepare('DELETE FROM plans WHERE id = ?');
$stmt->bind_param('i', $id);

if (!$stmt->execute()) {
    json_response(['message' => 'Failed to delete plan'], 500);
}

json_response(['message' => 'Plan deleted']);