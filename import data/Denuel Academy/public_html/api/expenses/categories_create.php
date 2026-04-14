<?php
require_once __DIR__ . '/_bootstrap.php';
require_auth();
require_method('POST');

$input = body_json();
$name = trim((string)($input['name'] ?? ''));
if ($name === '') {
    json_response(['message' => 'Category name is required'], 400);
}
if (strlen($name) > 120) {
    json_response(['message' => 'Category name is too long'], 400);
}

$conn = db();
ensure_expense_tables($conn);

$stmt = $conn->prepare('INSERT IGNORE INTO expense_categories (name) VALUES (?)');
if (!$stmt) {
    json_response(['message' => 'Failed to prepare category insert'], 500);
}
$stmt->bind_param('s', $name);
$stmt->execute();

$find = $conn->prepare('SELECT id, name FROM expense_categories WHERE name = ? LIMIT 1');
$find->bind_param('s', $name);
$find->execute();
$res = $find->get_result();
$row = $res ? $res->fetch_assoc() : null;
if (!$row) {
    json_response(['message' => 'Failed to create category'], 500);
}

json_response(['message' => 'Category saved', 'category' => $row], 201);
