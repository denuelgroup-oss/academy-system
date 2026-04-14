<?php
require_once __DIR__ . '/../config.php';
require_auth();
require_method('POST');

$body   = body_json();
$sid    = intval($body['student_id'] ?? 0);
$status = trim($body['status'] ?? '');

$allowed = ['pending', 'renewed'];

if (!$sid) {
    json_response(['message' => 'student_id is required'], 400);
}
if (!in_array($status, $allowed)) {
    json_response(['message' => 'status must be pending or renewed'], 400);
}

$conn = db();

$conn->query(
    'CREATE TABLE IF NOT EXISTS renewals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        student_id INT NOT NULL UNIQUE,
        status VARCHAR(20) NOT NULL DEFAULT "pending",
        last_checked TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )'
);

// Remove legacy check constraint if present so all supported statuses can be stored.
try {
    $checkResult = $conn->query(
        "SELECT tc.CONSTRAINT_NAME
           FROM information_schema.TABLE_CONSTRAINTS tc
          WHERE tc.TABLE_SCHEMA = DATABASE()
            AND tc.TABLE_NAME = 'renewals'
            AND tc.CONSTRAINT_TYPE = 'CHECK'"
    );
    if ($checkResult) {
        while ($check = $checkResult->fetch_assoc()) {
            $constraintName = preg_replace('/[^a-zA-Z0-9_]/', '', $check['CONSTRAINT_NAME'] ?? '');
            if ($constraintName !== '') {
                $conn->query("ALTER TABLE renewals DROP CHECK {$constraintName}");
            }
        }
    }
} catch (Throwable $e) {
    // Ignore if the DB/version does not expose or support CHECK metadata changes.
}

$stmt = $conn->prepare(
    'INSERT INTO renewals (student_id, status, last_checked)
     VALUES (?, ?, NOW())
     ON DUPLICATE KEY UPDATE status = VALUES(status), last_checked = NOW()'
);
if (!$stmt) {
    json_response(['message' => 'Prepare failed: ' . $conn->error], 500);
}
$stmt->bind_param('is', $sid, $status);
if (!$stmt->execute()) {
    json_response(['message' => $stmt->error], 500);
}

json_response(['message' => 'Status updated']);
