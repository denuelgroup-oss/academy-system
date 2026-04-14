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

$studentId = intval($_GET['student_id'] ?? 0);
if ($studentId <= 0) {
    json_response(['message' => 'student_id is required'], 400);
}

$summaryStmt = $conn->prepare(
    'SELECT COUNT(*) AS total_sessions,
            SUM(CASE WHEN status = "present" THEN 1 ELSE 0 END) AS present_count,
            SUM(CASE WHEN status = "absent" THEN 1 ELSE 0 END) AS absent_count,
            SUM(CASE WHEN status = "late" THEN 1 ELSE 0 END) AS late_count,
            SUM(CASE WHEN status = "excused" THEN 1 ELSE 0 END) AS excused_count
     FROM attendance
     WHERE student_id = ?'
);

if (!$summaryStmt) {
    json_response(['message' => 'Failed to prepare attendance summary'], 500);
}

$summaryStmt->bind_param('i', $studentId);
$summaryStmt->execute();
$summaryResult = $summaryStmt->get_result();
$summary = $summaryResult ? ($summaryResult->fetch_assoc() ?: []) : [];

$historyStmt = $conn->prepare(
    'SELECT a.id, a.class_id, a.student_id, a.date, a.status, a.notes,
            c.title AS class_title,
            c.level AS class_level
     FROM attendance a
     LEFT JOIN classes c ON c.id = a.class_id
     WHERE a.student_id = ?
     ORDER BY a.date DESC, a.id DESC
     LIMIT 50'
);

if (!$historyStmt) {
    json_response(['message' => 'Failed to prepare attendance history'], 500);
}

$historyStmt->bind_param('i', $studentId);
$historyStmt->execute();
$historyResult = $historyStmt->get_result();

$rows = [];
if ($historyResult) {
    while ($row = $historyResult->fetch_assoc()) {
        $rows[] = $row;
    }
}

$total = intval($summary['total_sessions'] ?? 0);
$present = intval($summary['present_count'] ?? 0);
$late = intval($summary['late_count'] ?? 0);
$effectivePresent = $present + $late;
$rate = $total > 0 ? round(($effectivePresent / $total) * 100, 2) : 0;

json_response([
    'summary' => [
        'total_sessions' => $total,
        'present_count' => $present,
        'absent_count' => intval($summary['absent_count'] ?? 0),
        'late_count' => $late,
        'excused_count' => intval($summary['excused_count'] ?? 0),
        'attendance_rate' => $rate,
    ],
    'rows' => $rows,
]);