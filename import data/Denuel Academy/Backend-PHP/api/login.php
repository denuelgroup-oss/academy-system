<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['message' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/../config/db.php';

$conn = db_connect();
$input = read_json_body();

$email = trim($input['email'] ?? '');
$password = trim($input['password'] ?? '');

if ($email === '' || $password === '') {
    json_error('Email and password are required', 400);
}

$stmt = $conn->prepare('SELECT id, name, email, role, created_at FROM users WHERE email = ? AND password = ? LIMIT 1');
if (!$stmt) {
    json_error('Query preparation failed', 500, $conn->error);
}

$stmt->bind_param('ss', $email, $password);
$stmt->execute();
$result = $stmt->get_result();
$user = $result ? $result->fetch_assoc() : null;

if (!$user) {
    json_error('Invalid email or password', 401);
}

json_ok($user);
