<?php
require_once __DIR__ . '/../config.php';
require_auth();
require_method('GET');

$conn = db();

$conn->query(
    'CREATE TABLE IF NOT EXISTS classes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(120) NOT NULL,
        skill VARCHAR(120) NOT NULL,
        center VARCHAR(120) NOT NULL,
        level VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )'
);

$conn->query(
    'CREATE TABLE IF NOT EXISTS plans (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(120) NOT NULL,
        plan_type VARCHAR(30) NOT NULL,
        amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )'
);

function ensure_class_column_read($conn, $columnName, $alterSql)
{
    $safe = preg_replace('/[^a-zA-Z0-9_]/', '', $columnName);
    $check = $conn->query("SHOW COLUMNS FROM classes LIKE '{$safe}'");
    if ($check && $check->num_rows > 0) {
        return;
    }
    $conn->query($alterSql);
}

ensure_class_column_read($conn, 'skill', 'ALTER TABLE classes ADD COLUMN skill VARCHAR(120) NOT NULL DEFAULT ""');
ensure_class_column_read($conn, 'center', 'ALTER TABLE classes ADD COLUMN center VARCHAR(120) NOT NULL DEFAULT ""');
ensure_class_column_read($conn, 'plan_id', 'ALTER TABLE classes ADD COLUMN plan_id INT NULL');

$result = $conn->query(
    'SELECT c.id, c.title, c.skill, c.center, c.plan_id, c.level, c.created_at,
            p.title AS plan_title
     FROM classes c
    LEFT JOIN plans p ON p.id = c.plan_id
    ORDER BY c.id DESC'
);

$rows = [];
if ($result) {
    while ($row = $result->fetch_assoc()) {
        $rows[] = $row;
    }
}

json_response($rows);