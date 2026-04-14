<?php
require_once __DIR__ . '/../finance.php';
require_super_admin();
require_method('POST');

$input = body_json();
$studentId = intval($input['student_id'] ?? 0);
$amount = floatval($input['amount'] ?? 0);

if ($studentId <= 0 || $amount <= 0) {
    json_response(['message' => 'student_id and amount are required'], 400);
}

$conn = db();
ensure_exchange_rate_tables($conn);
ensure_payment_currency_column($conn);
ensure_payment_extra_columns($conn);

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

// Use the student's current subscription end date when available.
$studentStmt = $conn->prepare(
    'SELECT s.sub_end, COALESCE(pl.currency, "CDF") AS plan_currency
     FROM students s
     LEFT JOIN plans pl ON pl.id = s.plan_id
     WHERE s.id = ?
     LIMIT 1'
);
$studentStmt->bind_param('i', $studentId);
$studentStmt->execute();
$studentResult = $studentStmt->get_result();
$studentRow = $studentResult ? $studentResult->fetch_assoc() : null;
$currency = normalize_currency_code($studentRow['plan_currency'] ?? 'CDF', 'CDF');
$rawMode = strtolower(trim((string)($input['payment_mode'] ?? 'cash')));
$modeMap = [
    'cash' => 'cash',
    'cheque' => 'cheque',
    'other' => 'other',
    'card' => 'card',
    'bank_transfer' => 'bank_transfer',
    'bank transfer' => 'bank_transfer',
    'online' => 'online',
];
$paymentMode = $modeMap[$rawMode] ?? 'cash';

$rawPaidAt = trim((string)($input['paid_at'] ?? ''));
if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $rawPaidAt)) {
    $paidAt = $rawPaidAt . ' 00:00:00';
} else {
    $normalizedRawPaidAt = str_replace('T', ' ', $rawPaidAt);
    $parsedPaidAt = strtotime($normalizedRawPaidAt);
    $paidAt = $parsedPaidAt ? date('Y-m-d H:i:s', $parsedPaidAt) : date('Y-m-d H:i:s');
}

$paymentDate = substr($paidAt, 0, 10);
$periodStart = trim((string)($input['period_start'] ?? ''));
$periodEnd = trim((string)($input['period_end'] ?? ''));
$periodStartForInsert = null;
$periodEndForInsert = null;
if (
    preg_match('/^\d{4}-\d{2}-\d{2}$/', $periodStart)
    && preg_match('/^\d{4}-\d{2}-\d{2}$/', $periodEnd)
    && strcmp($periodStart, $periodEnd) <= 0
) {
    $periodStartForInsert = $periodStart;
    $periodEndForInsert = $periodEnd;
    if (strcmp($paymentDate, $periodStart) < 0) {
        $paymentDate = $periodStart;
    }
    if (strcmp($paymentDate, $periodEnd) > 0) {
        $paymentDate = $periodEnd;
    }
}

$note = trim((string)($input['note'] ?? ''));
if (function_exists('mb_substr')) {
    $note = mb_substr($note, 0, 500);
} else {
    $note = substr($note, 0, 500);
}

$expiryDate = trim((string)($studentRow['sub_end'] ?? ''));
if ($periodEndForInsert !== null) {
    $expiryDate = $periodEndForInsert;
}
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $expiryDate)) {
    $expiryDate = date('Y-m-d', strtotime($paymentDate . ' +30 days'));
}
ensure_exchange_rate_for_date($conn, $paymentDate);

if ($hasPaymentModeCol && $hasNoteCol && $hasPaidAtCol && $hasPeriodStartCol && $hasPeriodEndCol) {
    $stmt = $conn->prepare('INSERT INTO payments (student_id, amount, currency, payment_mode, note, payment_date, paid_at, period_start, period_end, expiry_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->bind_param('idssssssss', $studentId, $amount, $currency, $paymentMode, $note, $paymentDate, $paidAt, $periodStartForInsert, $periodEndForInsert, $expiryDate);
} elseif ($hasPaymentModeCol && $hasNoteCol && $hasPaidAtCol) {
    $stmt = $conn->prepare('INSERT INTO payments (student_id, amount, currency, payment_mode, note, payment_date, paid_at, expiry_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->bind_param('idssssss', $studentId, $amount, $currency, $paymentMode, $note, $paymentDate, $paidAt, $expiryDate);
} else {
    // Fallback for databases where ALTER TABLE is blocked.
    $stmt = $conn->prepare('INSERT INTO payments (student_id, amount, currency, payment_date, expiry_date) VALUES (?, ?, ?, ?, ?)');
    $stmt->bind_param('idsss', $studentId, $amount, $currency, $paymentDate, $expiryDate);
}
if (!$stmt->execute()) {
    json_response(['message' => 'Failed to create payment'], 500);
}

json_response(['message' => 'Payment recorded', 'id' => $conn->insert_id], 201);
