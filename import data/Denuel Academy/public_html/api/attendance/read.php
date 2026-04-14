<?php
require_once __DIR__ . '/../config.php';
require_auth();
require_method('GET');

$conn = db();

$conn->query(
    'CREATE TABLE IF NOT EXISTS attendance (
        id INT AUTO_INCREMENT PRIMARY KEY,
        class_id INT NOT NULL DEFAULT 0,
        student_id INT NOT NULL,
        date DATE NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT "present",
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_att (class_id, student_id, date)
    )'
);

$class_id = intval($_GET['class_id'] ?? 0);
$date = trim($_GET['date'] ?? '');

if (!$class_id || !$date) {
    json_response(['message' => 'class_id and date are required'], 400);
}

if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
    json_response(['message' => 'Invalid date format'], 400);
}

$stmt = $conn->prepare(
    'SELECT s.id, s.name, s.roll_no,
            a.status AS attendance_status,
            a.notes  AS attendance_notes
     FROM students s
     LEFT JOIN attendance a
            ON a.student_id = s.id
           AND a.class_id   = ?
           AND a.date        = ?
     WHERE s.class_id = ?
     ORDER BY s.name ASC'
);

if (!$stmt) {
    json_response(['message' => 'Query prepare failed: ' . $conn->error], 500);
}

$stmt->bind_param('isi', $class_id, $date, $class_id);
$stmt->execute();
$result = $stmt->get_result();

$rows = [];
while ($row = $result->fetch_assoc()) {
    $rows[] = $row;
}

json_response($rows);
