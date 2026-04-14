<?php
require_once __DIR__ . '/../config.php';
require_super_admin();
require_method('POST');

$conn = db();

$conn->query(
    'CREATE TABLE IF NOT EXISTS plans (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(120) NOT NULL,
        plan_type VARCHAR(30) NOT NULL,
        duration_unit VARCHAR(20) NOT NULL DEFAULT "month",
        classes_count INT NOT NULL DEFAULT 0,
        clients_count INT NOT NULL DEFAULT 0,
        make_up TINYINT(1) NOT NULL DEFAULT 0,
        amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        currency VARCHAR(3) NOT NULL DEFAULT "CDF",
        billing_cycle VARCHAR(40) NOT NULL DEFAULT "1 Month",
        auto_renew_clients TINYINT(1) NOT NULL DEFAULT 0,
        control_available_start_dates TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CHECK (plan_type IN ("subscription", "trial", "one-time"))
    )'
);

function ensure_plan_column($conn, $columnName, $alterSql)
{
    $safe = preg_replace('/[^a-zA-Z0-9_]/', '', $columnName);
    $check = $conn->query("SHOW COLUMNS FROM plans LIKE '{$safe}'");
    if ($check && $check->num_rows > 0) {
        return;
    }
    $conn->query($alterSql);
}

ensure_plan_column($conn, 'duration_unit', 'ALTER TABLE plans ADD COLUMN duration_unit VARCHAR(20) NOT NULL DEFAULT "month"');
ensure_plan_column($conn, 'auto_renew_clients', 'ALTER TABLE plans ADD COLUMN auto_renew_clients TINYINT(1) NOT NULL DEFAULT 0');
ensure_plan_column($conn, 'control_available_start_dates', 'ALTER TABLE plans ADD COLUMN control_available_start_dates TINYINT(1) NOT NULL DEFAULT 0');
ensure_plan_column($conn, 'currency', 'ALTER TABLE plans ADD COLUMN currency VARCHAR(3) NOT NULL DEFAULT "CDF"');

$input = body_json();
$title = trim($input['title'] ?? '');
$type = strtolower(trim($input['type'] ?? 'subscription'));
$durationUnit = strtolower(trim($input['duration_unit'] ?? 'month'));
$classesCount = intval($input['classes_count'] ?? 0);
$clientsCount = intval($input['clients_count'] ?? 0);
$makeUp = !empty($input['make_up']) ? 1 : 0;
$amount = floatval($input['amount'] ?? 0);
$currency = strtoupper(trim($input['currency'] ?? 'CDF'));
$autoRenewClients = !empty($input['auto_renew_clients']) ? 1 : 0;
$controlAvailableStartDates = !empty($input['control_available_start_dates']) ? 1 : 0;

$durationAllowed = ['day', 'week', 'month', 'year'];
if (!in_array($durationUnit, $durationAllowed, true)) {
    $durationUnit = 'month';
}

$billingCycle = '1 ' . ucfirst($durationUnit);

$allowed = ['subscription', 'trial', 'one-time'];
$allowedCurrencies = ['USD', 'CDF'];
if (!in_array($currency, $allowedCurrencies, true)) {
    $currency = 'CDF';
}
if ($title === '' || !in_array($type, $allowed, true) || $amount <= 0) {
    json_response(['message' => 'title, valid type and positive amount are required'], 400);
}

$stmt = $conn->prepare(
    'INSERT INTO plans (
        title, plan_type, duration_unit, classes_count, clients_count, make_up, amount, currency, billing_cycle,
        auto_renew_clients, control_available_start_dates
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
);
$stmt->bind_param(
    'sssiiidssii',
    $title,
    $type,
    $durationUnit,
    $classesCount,
    $clientsCount,
    $makeUp,
    $amount,
    $currency,
    $billingCycle,
    $autoRenewClients,
    $controlAvailableStartDates
);

if (!$stmt->execute()) {
    json_response(['message' => 'Failed to create plan'], 500);
}

json_response(['message' => 'Plan created', 'id' => $conn->insert_id], 201);
