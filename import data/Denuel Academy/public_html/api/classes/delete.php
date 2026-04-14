<?php
require_once __DIR__ . '/../config.php';
require_super_admin();
require_method('POST');

$input = body_json();
$id = intval($input['id'] ?? 0);

if ($id <= 0) {
    json_response(['message' => 'id is required'], 400);
}

$conn = db();

$classStmt = $conn->prepare('SELECT title FROM classes WHERE id = ? LIMIT 1');
if (!$classStmt) {
    json_response(['message' => 'Failed to prepare class lookup: ' . $conn->error], 500);
}
$classStmt->bind_param('i', $id);
$classStmt->execute();
$classRow = $classStmt->get_result()->fetch_assoc();
if (!$classRow) {
    json_response(['message' => 'Class not found'], 404);
}

$classTitle = trim((string)($classRow['title'] ?? ''));

$hasScheduleTable = $conn->query("SHOW TABLES LIKE 'class_schedules'");

$conn->begin_transaction();
try {
    if ($hasScheduleTable && $hasScheduleTable->num_rows > 0) {
        // Remove schedules linked by class_id.
        $delScheduleById = $conn->prepare('DELETE FROM class_schedules WHERE class_id = ?');
        if (!$delScheduleById) {
            throw new Exception('Failed to prepare schedule cleanup: ' . $conn->error);
        }
        $delScheduleById->bind_param('i', $id);
        if (!$delScheduleById->execute()) {
            throw new Exception('Failed to delete attached schedules: ' . $delScheduleById->error);
        }

        // Legacy rows can have class_id = 0/NULL and only class_name populated.
        if ($classTitle !== '') {
            $delLegacyByName = $conn->prepare('DELETE FROM class_schedules WHERE (class_id = 0 OR class_id IS NULL) AND class_name = ?');
            if (!$delLegacyByName) {
                throw new Exception('Failed to prepare legacy schedule cleanup: ' . $conn->error);
            }
            $delLegacyByName->bind_param('s', $classTitle);
            if (!$delLegacyByName->execute()) {
                throw new Exception('Failed to delete legacy schedules: ' . $delLegacyByName->error);
            }
        }
    }

    $stmt = $conn->prepare('DELETE FROM classes WHERE id = ?');
    if (!$stmt) {
        throw new Exception('Failed to prepare class delete: ' . $conn->error);
    }
    $stmt->bind_param('i', $id);

    if (!$stmt->execute()) {
        throw new Exception('Failed to delete class: ' . $stmt->error);
    }

    if ($stmt->affected_rows === 0) {
        throw new Exception('Class not found');
    }

    $conn->commit();
    json_response(['message' => 'Class deleted']);
} catch (Exception $e) {
    $conn->rollback();
    $msg = $e->getMessage();
    $status = stripos($msg, 'not found') !== false ? 404 : 500;
    json_response(['message' => $msg], $status);
}