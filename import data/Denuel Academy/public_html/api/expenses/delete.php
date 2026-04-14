<?php
require_once __DIR__ . '/_bootstrap.php';
require_auth();
require_method('POST');

$input = body_json();
$id = intval($input['id'] ?? 0);
if ($id <= 0) {
    json_response(['message' => 'Expense id is required'], 400);
}

$conn = db();
ensure_expense_tables($conn);

$stmt = $conn->prepare('DELETE FROM expenses WHERE id = ?');
if (!$stmt) {
    json_response(['message' => 'Failed to prepare delete'], 500);
}
$stmt->bind_param('i', $id);
if (!$stmt->execute()) {
    json_response(['message' => 'Failed to delete expense'], 500);
}

json_response(['message' => 'Expense deleted']);
