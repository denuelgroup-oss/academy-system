<?php
require_once __DIR__ . '/../finance.php';
require_auth();
require_method('GET');

$conn = db();
ensure_exchange_rate_tables($conn);
ensure_payment_currency_column($conn);
ensure_payment_extra_columns($conn);
$studentId = intval($_GET['student_id'] ?? 0);

$hasPaymentModeCol = false;
$hasNoteCol = false;
$hasPaidAtCol = false;
$hasPeriodStartCol = false;
$hasPeriodEndCol = false;
$colsRes = $conn->query("SHOW COLUMNS FROM payments");
if ($colsRes) {
    while ($colRow = $colsRes->fetch_assoc()) {
        $name = strtolower((string)($colRow['Field'] ?? ''));
        if ($name === 'payment_mode') {
            $hasPaymentModeCol = true;
        } elseif ($name === 'note') {
            $hasNoteCol = true;
        } elseif ($name === 'paid_at') {
            $hasPaidAtCol = true;
        } elseif ($name === 'period_start') {
            $hasPeriodStartCol = true;
        } elseif ($name === 'period_end') {
            $hasPeriodEndCol = true;
        }
    }
}

$modeSelect = $hasPaymentModeCol ? 'p.payment_mode AS payment_mode' : "'cash' AS payment_mode";
$noteSelect = $hasNoteCol ? 'p.note AS note' : "'' AS note";
$paidAtSelect = $hasPaidAtCol ? 'p.paid_at AS paid_at' : "CONCAT(p.payment_date, ' 00:00:00') AS paid_at";
$periodStartSelect = $hasPeriodStartCol ? 'p.period_start AS period_start' : 'NULL AS period_start';
$periodEndSelect = $hasPeriodEndCol ? 'p.period_end AS period_end' : 'NULL AS period_end';
$subStartExpr = $hasPeriodStartCol ? 'COALESCE(p.period_start, s.sub_start) AS sub_start' : 's.sub_start AS sub_start';
$subEndExpr = $hasPeriodEndCol ? 'COALESCE(p.period_end, p.expiry_date, s.sub_end) AS sub_end' : 's.sub_end AS sub_end';

if ($studentId > 0) {
    $stmt = $conn->prepare(
        "SELECT p.id, p.student_id, s.name AS student_name, s.roll_no, s.plan_id,
            p.amount, p.currency, {$modeSelect}, {$noteSelect}, p.payment_date, {$paidAtSelect}, {$periodStartSelect}, {$periodEndSelect}, p.expiry_date,
            pl.title AS plan_title, pl.currency AS plan_currency, {$subStartExpr}, {$subEndExpr}
         FROM payments p
         INNER JOIN students s ON s.id = p.student_id
         LEFT JOIN plans pl ON pl.id = s.plan_id
         WHERE p.student_id = ?
         ORDER BY p.payment_date DESC"
    );
    $stmt->bind_param('i', $studentId);
    $stmt->execute();
    $result = $stmt->get_result();
} else {
    $result = $conn->query(
        "SELECT p.id, p.student_id, s.name AS student_name, s.roll_no, s.plan_id,
            p.amount, p.currency, {$modeSelect}, {$noteSelect}, p.payment_date, {$paidAtSelect}, {$periodStartSelect}, {$periodEndSelect}, p.expiry_date,
            pl.title AS plan_title, pl.currency AS plan_currency, {$subStartExpr}, {$subEndExpr}
         FROM payments p
         INNER JOIN students s ON s.id = p.student_id
         LEFT JOIN plans pl ON pl.id = s.plan_id
         ORDER BY p.payment_date DESC"
    );
}

$rows = [];
if ($result) {
    while ($row = $result->fetch_assoc()) {
        $rows[] = $row;
    }
}

json_response($rows);
