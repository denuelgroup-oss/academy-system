<?php
require_once __DIR__ . '/../config.php';
require_auth();
require_method('GET');

$conn = db();

$conn->query(
    'CREATE TABLE IF NOT EXISTS class_schedules (
        id INT AUTO_INCREMENT PRIMARY KEY,
        class_name VARCHAR(120) NOT NULL,
        level VARCHAR(50) NOT NULL,
        center VARCHAR(120) NOT NULL,
        from_date DATE NOT NULL,
        upto_date DATE NULL,
        sun_start TIME NULL,
        sun_end TIME NULL,
        mon_start TIME NULL,
        mon_end TIME NULL,
        tue_start TIME NULL,
        tue_end TIME NULL,
        wed_start TIME NULL,
        wed_end TIME NULL,
        thu_start TIME NULL,
        thu_end TIME NULL,
        fri_start TIME NULL,
        fri_end TIME NULL,
        sat_start TIME NULL,
        sat_end TIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )'
);

function ensure_schedule_column_read($conn, $columnName, $alterSql)
{
    $safe = preg_replace('/[^a-zA-Z0-9_]/', '', $columnName);
    $check = $conn->query("SHOW COLUMNS FROM class_schedules LIKE '{$safe}'");
    if ($check && $check->num_rows > 0) {
        return;
    }
    $conn->query($alterSql);
}

ensure_schedule_column_read($conn, 'class_id', 'ALTER TABLE class_schedules ADD COLUMN class_id INT NOT NULL DEFAULT 0');
ensure_schedule_column_read($conn, 'center', "ALTER TABLE class_schedules ADD COLUMN center VARCHAR(120) NOT NULL DEFAULT ''");
ensure_schedule_column_read($conn, 'from_date', 'ALTER TABLE class_schedules ADD COLUMN from_date DATE NOT NULL DEFAULT (CURDATE())');
ensure_schedule_column_read($conn, 'upto_date', 'ALTER TABLE class_schedules ADD COLUMN upto_date DATE NULL');
ensure_schedule_column_read($conn, 'sun_start', 'ALTER TABLE class_schedules ADD COLUMN sun_start TIME NULL');
ensure_schedule_column_read($conn, 'sun_end', 'ALTER TABLE class_schedules ADD COLUMN sun_end TIME NULL');
ensure_schedule_column_read($conn, 'mon_start', 'ALTER TABLE class_schedules ADD COLUMN mon_start TIME NULL');
ensure_schedule_column_read($conn, 'mon_end', 'ALTER TABLE class_schedules ADD COLUMN mon_end TIME NULL');
ensure_schedule_column_read($conn, 'tue_start', 'ALTER TABLE class_schedules ADD COLUMN tue_start TIME NULL');
ensure_schedule_column_read($conn, 'tue_end', 'ALTER TABLE class_schedules ADD COLUMN tue_end TIME NULL');
ensure_schedule_column_read($conn, 'wed_start', 'ALTER TABLE class_schedules ADD COLUMN wed_start TIME NULL');
ensure_schedule_column_read($conn, 'wed_end', 'ALTER TABLE class_schedules ADD COLUMN wed_end TIME NULL');
ensure_schedule_column_read($conn, 'thu_start', 'ALTER TABLE class_schedules ADD COLUMN thu_start TIME NULL');
ensure_schedule_column_read($conn, 'thu_end', 'ALTER TABLE class_schedules ADD COLUMN thu_end TIME NULL');
ensure_schedule_column_read($conn, 'fri_start', 'ALTER TABLE class_schedules ADD COLUMN fri_start TIME NULL');
ensure_schedule_column_read($conn, 'fri_end', 'ALTER TABLE class_schedules ADD COLUMN fri_end TIME NULL');
ensure_schedule_column_read($conn, 'sat_start', 'ALTER TABLE class_schedules ADD COLUMN sat_start TIME NULL');
ensure_schedule_column_read($conn, 'sat_end', 'ALTER TABLE class_schedules ADD COLUMN sat_end TIME NULL');

$result = $conn->query(
    'SELECT cs.id,
            cs.class_id,
            COALESCE(c.title, cs.class_name) AS class_title,
            COALESCE(c.center, cs.center) AS center,
            COALESCE(c.coach, "") AS coach,
            COALESCE((SELECT COUNT(*) FROM students s WHERE s.class_id = cs.class_id), 0) AS student_count,
            cs.from_date, cs.upto_date,
            TIME_FORMAT(cs.sun_start, "%H:%i") AS sun_start,
            TIME_FORMAT(cs.sun_end,   "%H:%i") AS sun_end,
            TIME_FORMAT(cs.mon_start, "%H:%i") AS mon_start,
            TIME_FORMAT(cs.mon_end,   "%H:%i") AS mon_end,
            TIME_FORMAT(cs.tue_start, "%H:%i") AS tue_start,
            TIME_FORMAT(cs.tue_end,   "%H:%i") AS tue_end,
            TIME_FORMAT(cs.wed_start, "%H:%i") AS wed_start,
            TIME_FORMAT(cs.wed_end,   "%H:%i") AS wed_end,
            TIME_FORMAT(cs.thu_start, "%H:%i") AS thu_start,
            TIME_FORMAT(cs.thu_end,   "%H:%i") AS thu_end,
            TIME_FORMAT(cs.fri_start, "%H:%i") AS fri_start,
            TIME_FORMAT(cs.fri_end,   "%H:%i") AS fri_end,
            TIME_FORMAT(cs.sat_start, "%H:%i") AS sat_start,
            TIME_FORMAT(cs.sat_end,   "%H:%i") AS sat_end
     FROM class_schedules cs
     LEFT JOIN classes c ON c.id = cs.class_id
     ORDER BY cs.id DESC'
);

$rows = [];
if ($result) {
    while ($row = $result->fetch_assoc()) {
        $rows[] = $row;
    }
}

json_response($rows);