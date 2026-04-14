<?php
require_once __DIR__ . '/../config.php';
require_auth();
require_method('GET');

$conn = db();

function ensure_student_col($conn, $col, $sql) {
    $safe = preg_replace('/[^a-zA-Z0-9_]/', '', $col);
    $r = $conn->query("SHOW COLUMNS FROM students LIKE '$safe'");
    if ($r && $r->num_rows > 0) return;
    $conn->query($sql);
}

function ensure_student_plan_map_table_read($conn) {
    $conn->query(
        'CREATE TABLE IF NOT EXISTS student_one_time_plans (
            student_id INT NOT NULL,
            plan_id INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (student_id, plan_id),
            KEY idx_sotp_plan (plan_id)
        )'
    );
}

ensure_student_col($conn, 'gender',          "ALTER TABLE students ADD COLUMN gender VARCHAR(10) NULL");
ensure_student_col($conn, 'roll_no',         "ALTER TABLE students ADD COLUMN roll_no VARCHAR(30) NULL");
ensure_student_col($conn, 'class_id',        "ALTER TABLE students ADD COLUMN class_id INT NULL");
ensure_student_col($conn, 'plan_id',         "ALTER TABLE students ADD COLUMN plan_id INT NULL");
ensure_student_col($conn, 'sub_start',       "ALTER TABLE students ADD COLUMN sub_start DATE NULL");
ensure_student_col($conn, 'sub_end',         "ALTER TABLE students ADD COLUMN sub_end DATE NULL");
ensure_student_col($conn, 'phone_code',      "ALTER TABLE students ADD COLUMN phone_code VARCHAR(10) NULL DEFAULT '+355'");
ensure_student_col($conn, 'level',           "ALTER TABLE students ADD COLUMN level VARCHAR(50) NULL");
ensure_student_col($conn, 'plan_type',       "ALTER TABLE students ADD COLUMN plan_type VARCHAR(20) NULL DEFAULT 'subscription'");
ensure_student_col($conn, 'autorenew',       "ALTER TABLE students ADD COLUMN autorenew TINYINT(1) NOT NULL DEFAULT 0");
ensure_student_col($conn, 'one_time_plan_id',"ALTER TABLE students ADD COLUMN one_time_plan_id INT NULL");
ensure_student_col($conn, 'invoice_date',    "ALTER TABLE students ADD COLUMN invoice_date DATE NULL");
ensure_student_col($conn, 'invoice_prefix',  "ALTER TABLE students ADD COLUMN invoice_prefix VARCHAR(20) NULL");
ensure_student_col($conn, 'invoice_no',      "ALTER TABLE students ADD COLUMN invoice_no INT NULL");
ensure_student_col($conn, 'discount_type',   "ALTER TABLE students ADD COLUMN discount_type VARCHAR(20) NULL DEFAULT 'none'");
ensure_student_col($conn, 'discount_value',  "ALTER TABLE students ADD COLUMN discount_value DECIMAL(10,2) NULL DEFAULT 0");
ensure_student_col($conn, 'payment_type',    "ALTER TABLE students ADD COLUMN payment_type VARCHAR(20) NULL DEFAULT 'full'");
ensure_student_col($conn, 'due_date',        "ALTER TABLE students ADD COLUMN due_date DATE NULL");
ensure_student_col($conn, 'client_notes',    "ALTER TABLE students ADD COLUMN client_notes TEXT NULL");
ensure_student_col($conn, 'photo',           "ALTER TABLE students ADD COLUMN photo MEDIUMTEXT NULL");
ensure_student_col($conn, 'date_of_birth',   "ALTER TABLE students ADD COLUMN date_of_birth DATE NULL");
ensure_student_plan_map_table_read($conn);

// Backfill: assign invoice numbers to students with a plan but no invoice_no.
// Uses a cursor-style approach to assign unique incrementing numbers.
$maxInvoiceRow = $conn->query('SELECT COALESCE(MAX(invoice_no), 0) AS m FROM students');
if ($maxInvoiceRow) {
    $nextInvoiceNo = intval($maxInvoiceRow->fetch_assoc()['m']) + 1;
    $needsInvoice = $conn->query(
        "SELECT id, sub_start FROM students WHERE plan_id IS NOT NULL AND (invoice_no IS NULL OR invoice_no = 0) ORDER BY id ASC"
    );
    if ($needsInvoice && $needsInvoice->num_rows > 0) {
        $backfillStmt = $conn->prepare(
            "UPDATE students SET invoice_no = ?, invoice_prefix = 'INV-', invoice_date = COALESCE(invoice_date, sub_start, CURDATE()) WHERE id = ?"
        );
        if ($backfillStmt) {
            while ($nr = $needsInvoice->fetch_assoc()) {
                $nid = intval($nr['id']);
                $backfillStmt->bind_param('ii', $nextInvoiceNo, $nid);
                $backfillStmt->execute();
                $nextInvoiceNo++;
            }
        }
    }
}

$result = $conn->query(
    'SELECT s.id, s.name, s.gender, s.roll_no, s.email, s.phone, s.phone_code,
            s.level, s.class_id, s.plan_id, s.one_time_plan_id,
                        (SELECT GROUP_CONCAT(DISTINCT sop.plan_id ORDER BY sop.plan_id SEPARATOR ",")
                             FROM student_one_time_plans sop
                            WHERE sop.student_id = s.id) AS one_time_plan_ids,
                        (SELECT GROUP_CONCAT(DISTINCT otp.title ORDER BY otp.title SEPARATOR ", ")
                             FROM student_one_time_plans sop2
                             LEFT JOIN plans otp ON otp.id = sop2.plan_id
                            WHERE sop2.student_id = s.id) AS one_time_plan_titles,
                        (SELECT COUNT(*)
                            FROM student_one_time_plans sop3
                           WHERE sop3.student_id = s.id) AS one_time_plan_count,
                        (SELECT COALESCE(SUM(otp2.amount), 0)
                            FROM student_one_time_plans sop4
                            LEFT JOIN plans otp2 ON otp2.id = sop4.plan_id
                           WHERE sop4.student_id = s.id) AS one_time_plan_total,
            s.plan_type, s.autorenew, s.sub_start, s.sub_end,
            s.invoice_date, s.invoice_prefix, s.invoice_no,
            s.discount_type, s.discount_value, s.payment_type, s.due_date,
            s.client_notes, s.photo,
            cl.title  AS class_title,
            cl.level  AS class_level,
            pl.title  AS plan_title,
            pl.amount AS plan_amount,
            pl.currency AS plan_currency,
              otp_legacy.title AS one_time_plan_legacy_title,
              otp_legacy.amount AS one_time_plan_legacy_amount,
            s.date_of_birth,
            DATEDIFF(CURDATE(), s.sub_start) AS days_elapsed,
                        GREATEST(0, COALESCE(pl.amount, 0) - COALESCE((
                                SELECT SUM(pay.amount)
                                    FROM payments pay
                                 WHERE pay.student_id = s.id
                                     AND s.sub_start IS NOT NULL
                                     AND pay.payment_date >= s.sub_start
                                     AND (s.sub_end IS NULL OR pay.payment_date <= s.sub_end)
                        ), 0)) AS receivable,
            s.created_at
     FROM students s
     LEFT JOIN classes  cl  ON cl.id = s.class_id
     LEFT JOIN plans    pl  ON pl.id = s.plan_id
    LEFT JOIN plans otp_legacy ON otp_legacy.id = s.one_time_plan_id
     ORDER BY s.id DESC'
);

if (!$result) {
    json_response(['message' => 'Failed to read students: ' . $conn->error], 500);
}

$rows = [];
while ($row = $result->fetch_assoc()) {
    $ids = [];
    if (!empty($row['one_time_plan_ids'])) {
        foreach (explode(',', $row['one_time_plan_ids']) as $pid) {
            $v = intval($pid);
            if ($v > 0) $ids[] = $v;
        }
    }
    if (empty($ids) && !empty($row['one_time_plan_id'])) {
        $ids[] = intval($row['one_time_plan_id']);
    }

    if (empty($row['one_time_plan_titles']) && !empty($row['one_time_plan_legacy_title'])) {
        $row['one_time_plan_titles'] = $row['one_time_plan_legacy_title'];
    }

    $row['one_time_plan_count'] = count($ids);

    $oneTimeTotal = floatval($row['one_time_plan_total'] ?? 0);
    if ($row['one_time_plan_count'] > 0 && $oneTimeTotal <= 0 && !empty($row['one_time_plan_legacy_amount'])) {
        $oneTimeTotal = floatval($row['one_time_plan_legacy_amount']);
    }
    $row['one_time_plan_total'] = $oneTimeTotal;

    $row['one_time_plan_ids'] = $ids;
    unset($row['one_time_plan_legacy_title'], $row['one_time_plan_legacy_amount']);
    $rows[] = $row;
}

json_response($rows);