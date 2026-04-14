<?php
require_once __DIR__ . '/../config.php';
require_method('POST');

$input = body_json();
$email = trim($input['email'] ?? '');
$password = trim($input['password'] ?? '');

if ($email === '' || $password === '') {
    json_response(['message' => 'Email and password are required'], 400);
}

$conn = db();
$stmt = $conn->prepare('SELECT id, name, email, password, role FROM users WHERE email = ? LIMIT 1');
$stmt->bind_param('s', $email);
$stmt->execute();
$result = $stmt->get_result();
$user = $result ? $result->fetch_assoc() : null;

if (!$user || !password_verify($password, $user['password'])) {
    json_response(['message' => 'Invalid email or password'], 401);
}

$_SESSION['user_id'] = (int) $user['id'];
$_SESSION['name'] = $user['name'];
$_SESSION['email'] = $user['email'];
$_SESSION['role'] = strtolower(trim((string)($user['role'] ?? '')));

unset($user['password']);

json_response(['message' => 'Login successful', 'user' => $user]);
