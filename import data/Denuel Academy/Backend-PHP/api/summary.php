<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_error('Method not allowed', 405);
}

require_once __DIR__ . '/../config/db.php';
$conn = db_connect();

$sql = "SELECT 
COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END), 0) AS income,
COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0) AS expense,
COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0) AS balance
FROM transactions";

$result = $conn->query($sql);
if (!$result) {
    json_error('Failed to fetch summary', 500, $conn->error);
}

$row = $result->fetch_assoc();
json_ok([
    'income' => floatval($row['income'] ?? 0),
    'expense' => floatval($row['expense'] ?? 0),
    'balance' => floatval($row['balance'] ?? 0)
]);
