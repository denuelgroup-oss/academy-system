<?php
require_once __DIR__ . '/../config.php';
require_auth();
require_method('GET');

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

$conn->query(
        "INSERT INTO plans (title, plan_type, duration_unit, classes_count, clients_count, make_up, amount, currency, billing_cycle, auto_renew_clients, control_available_start_dates)
         SELECT 'U13', 'subscription', 'month', 1, 1, 0, 25.00, 'CDF', '1 Month', 0, 0
     WHERE NOT EXISTS (
       SELECT 1 FROM plans WHERE title = 'U13' AND plan_type = 'subscription'
     )"
);

$type = strtolower(trim($_GET['type'] ?? 'subscription'));
$allowed = ['subscription', 'trial', 'one-time'];
if (!in_array($type, $allowed, true)) {
    $type = 'subscription';
}

$stmt = $conn->prepare(
    'SELECT id, title, plan_type, duration_unit, classes_count, clients_count, make_up, amount, billing_cycle,
            currency, auto_renew_clients, control_available_start_dates
     FROM plans
     WHERE plan_type = ?
     ORDER BY id DESC'
);
$stmt->bind_param('s', $type);
$stmt->execute();
$result = $stmt->get_result();

$rows = [];
if ($result) {
    while ($row = $result->fetch_assoc()) {
        $currency = strtoupper(trim((string)($row['currency'] ?? 'CDF')));
        if (!in_array($currency, ['USD', 'CDF'], true)) {
            $currency = 'CDF';
        }
        $row['currency'] = $currency;
        $row['make_up'] = intval($row['make_up']) === 1 ? 'Yes' : '-';
        $row['auto_renew_clients'] = intval($row['auto_renew_clients']) === 1;
        $row['control_available_start_dates'] = intval($row['control_available_start_dates']) === 1;
        $rows[] = $row;
    }
}

json_response([
    'type' => $type,
    'plans' => $rows,
    'count' => count($rows),
]);
