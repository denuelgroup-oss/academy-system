<?php
require_once __DIR__ . '/../config.php';
require_auth();
require_method('POST');

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

$body     = body_json();
$class_id = intval($body['class_id'] ?? 0);
$date     = trim($body['date'] ?? '');
$records  = $body['records'] ?? [];

if (!$class_id) {
    json_response(['message' => 'class_id is required'], 400);
}

if (!$date || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
    json_response(['message' => 'Valid date is required'], 400);
}

if (!is_array($records) || count($records) === 0) {
    json_response(['message' => 'records array is required'], 400);
}

$allowed = ['present', 'absent', 'late', 'excused'];

$conn->begin_transaction();
try {
    $stmt = $conn->prepare(
        'INSERT INTO attendance (class_id, student_id, date, status, notes)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status = VALUES(status), notes = VALUES(notes)'
    );
    if (!$stmt) {
        throw new Exception('Prepare failed: ' . $conn->error);
    }

    foreach ($records as $rec) {
        $student_id = intval($rec['student_id'] ?? 0);
        $status     = in_array($rec['status'] ?? '', $allowed) ? $rec['status'] : 'present';
        $notes      = trim($rec['notes'] ?? '');

        if (!$student_id) continue;

        $stmt->bind_param('iisss', $class_id, $student_id, $date, $status, $notes);
        if (!$stmt->execute()) {
            throw new Exception('Save failed: ' . $stmt->error);
        }
    }

    $conn->commit();
    json_response(['message' => 'Attendance saved']);
} catch (Exception $e) {
    $conn->rollback();
    json_response(['message' => $e->getMessage()], 500);
}
