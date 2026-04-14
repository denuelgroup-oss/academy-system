<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../config/db.php';
$conn = db_connect();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $result = $conn->query('SELECT id, name, course, status FROM students ORDER BY id DESC');
    if (!$result) {
        json_error('Failed to fetch students', 500, $conn->error);
    }

    $students = [];
    while ($row = $result->fetch_assoc()) {
        $students[] = $row;
    }

    json_ok($students);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = read_json_body();
    $name = trim($input['name'] ?? '');
    $course = trim($input['course'] ?? '');

    if ($name === '' || $course === '') {
        json_error('Name and course are required', 400);
    }

    $status = 'active';
    $stmt = $conn->prepare('INSERT INTO students (name, course, status) VALUES (?, ?, ?)');
    if (!$stmt) {
        json_error('Query preparation failed', 500, $conn->error);
    }

    $stmt->bind_param('sss', $name, $course, $status);
    if (!$stmt->execute()) {
        json_error('Failed to add student', 500, $stmt->error);
    }

    json_ok(['message' => 'Student added'], 201);
}

json_error('Method not allowed', 405);
