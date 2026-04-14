<?php
require_once __DIR__ . '/../finance.php';
require_super_admin();
require_method('POST');

$conn = db();
ensure_exchange_rate_tables($conn);

$input = body_json();
$rate = floatval($input['cdf_to_usd_rate'] ?? 0);
$inverseRate = floatval($input['usd_to_cdf_rate'] ?? 0);

if (!is_finite($rate) || $rate <= 0) {
    json_response(['message' => 'CDF to USD rate must be greater than 0'], 400);
}
if (!is_finite($inverseRate) || $inverseRate <= 0) {
    json_response(['message' => 'USD to CDF rate must be greater than 0'], 400);
}

$rateStr = number_format($rate, 8, '.', '');
$inverseRateStr = number_format($inverseRate, 8, '.', '');

$stmt = $conn->prepare(
    'INSERT INTO app_settings (setting_key, setting_value)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)'
);
if (!$stmt) {
    json_response(['message' => 'Failed to prepare exchange rate update'], 500);
}

$key = 'cdf_to_usd_rate';
$stmt->bind_param('ss', $key, $rateStr);

if (!$stmt->execute()) {
    json_response(['message' => 'Failed to update CDF to USD rate'], 500);
}

$key = 'usd_to_cdf_rate';
$stmt->bind_param('ss', $key, $inverseRateStr);

if (!$stmt->execute()) {
    json_response(['message' => 'Failed to update USD to CDF rate'], 500);
}

upsert_exchange_rate_for_date($conn, date('Y-m-d'), $rate, $inverseRate);

json_response([
    'message' => 'Exchange rate updated',
    'cdf_to_usd_rate' => floatval($rateStr),
    'usd_to_cdf_rate' => floatval($inverseRateStr),
]);
