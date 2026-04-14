<?php
require_once __DIR__ . '/../config.php';
require_auth();
require_method('GET');

$conn = db();

$conn->query(
    'CREATE TABLE IF NOT EXISTS renewals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        student_id INT NOT NULL UNIQUE,
        status VARCHAR(20) NOT NULL DEFAULT "pending",
        last_checked TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )'
);

// Ensure students.sub_end column exists
$chk = $conn->query("SHOW COLUMNS FROM students LIKE 'sub_end'");
if ($chk && $chk->num_rows === 0) {
    $conn->query("ALTER TABLE students ADD COLUMN sub_end DATE NULL");
}

// Ensure students.autorenew exists for Auto/Manual filter
$chkAuto = $conn->query("SHOW COLUMNS FROM students LIKE 'autorenew'");
if ($chkAuto && $chkAuto->num_rows === 0) {
    $conn->query("ALTER TABLE students ADD COLUMN autorenew TINYINT(1) NOT NULL DEFAULT 0");
}

// Compute status at read-time with two buckets:
//   renewed => manually renewed within last 2 days
//   pending => subscription period is in the past (sub_end < today)

$result = $conn->query(
    "SELECT s.id, s.name, s.sub_start, s.sub_end,
            s.autorenew,
            cl.title AS class_title,
            pl.title AS plan_title,
            pl.amount AS plan_price,
            pl.currency AS plan_currency,
            IF(s.class_id IS NOT NULL, 1, 0) AS class_count,
            r.last_checked AS renewed_at,
            DATE_ADD(s.sub_end, INTERVAL 1 DAY) AS renewal_from,
            CASE
                WHEN COALESCE(r.status, '') = 'renewed'
                     AND r.last_checked >= DATE_SUB(NOW(), INTERVAL 2 DAY) THEN 'renewed'
                WHEN s.sub_end IS NOT NULL AND s.sub_end < CURDATE() THEN 'pending'
                ELSE 'active'
            END AS status
     FROM students s
     LEFT JOIN classes  cl ON cl.id = s.class_id
     LEFT JOIN plans    pl ON pl.id = s.plan_id
     LEFT JOIN renewals r  ON r.student_id = s.id
     ORDER BY
             FIELD(
                 CASE
                     WHEN COALESCE(r.status, '') = 'renewed'
                          AND r.last_checked >= DATE_SUB(NOW(), INTERVAL 2 DAY) THEN 'renewed'
                     WHEN s.sub_end IS NOT NULL AND s.sub_end < CURDATE() THEN 'pending'
                     ELSE 'active'
                 END,
                 'pending', 'renewed', 'active'
             ),
       s.sub_end ASC,
       s.name ASC"
);

if (!$result) {
    json_response(['message' => 'Failed to load renewals: ' . $conn->error], 500);
}

$rows   = [];
$counts = ['pending' => 0, 'renewed' => 0];
while ($row = $result->fetch_assoc()) {
    $st = $row['status'];
    if (!isset($counts[$st])) {
        continue;
    }
    if (isset($counts[$st])) $counts[$st]++;
    $rows[] = $row;
}

json_response(['rows' => $rows, 'counts' => $counts, 'total' => count($rows)]);
