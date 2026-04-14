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
    json_error('Method not allowed', 405);
}

require_once __DIR__ . '/../config/db.php';
$conn = db_connect();
$input = read_json_body();

$amount = floatval($input['amount'] ?? 0);
if ($amount <= 0) {
    json_error('Amount must be greater than 0', 400);
}

$type = 'expense';
$stmt = $conn->prepare('INSERT INTO transactions (type, amount) VALUES (?, ?)');
if (!$stmt) {
    json_error('Query preparation failed', 500, $conn->error);
}

$stmt->bind_param('sd', $type, $amount);
if (!$stmt->execute()) {
    json_error('Failed to add expense', 500, $stmt->error);
}

json_ok(['message' => 'Expense added'], 201);
