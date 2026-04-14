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

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = read_json_body();
    $studentId = intval($input['student_id'] ?? 0);
    $status = strtolower(trim($input['status'] ?? ''));

    if ($studentId <= 0 || ($status !== 'present' && $status !== 'absent')) {
        json_error('Valid student_id and status (present/absent) are required', 400);
    }

    $stmt = $conn->prepare('INSERT INTO attendance (student_id, date, status) VALUES (?, CURDATE(), ?)');
    if (!$stmt) {
        json_error('Query preparation failed', 500, $conn->error);
    }

    $stmt->bind_param('is', $studentId, $status);
    if (!$stmt->execute()) {
        json_error('Failed to record attendance', 500, $stmt->error);
    }

    json_ok(['message' => 'Attendance recorded'], 201);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $sql = "SELECT students.name, attendance.date, attendance.status
            FROM attendance
            INNER JOIN students ON students.id = attendance.student_id
            ORDER BY attendance.date DESC, attendance.id DESC";

    $result = $conn->query($sql);
    if (!$result) {
        json_error('Failed to fetch attendance', 500, $conn->error);
    }

    $records = [];
    while ($row = $result->fetch_assoc()) {
        $records[] = $row;
    }

    json_ok($records);
}

json_error('Method not allowed', 405);
