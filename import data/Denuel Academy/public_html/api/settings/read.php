<?php
require_once __DIR__ . '/../finance.php';
require_auth();
require_method('GET');

$conn = db();
$rates = get_exchange_rate_settings($conn);

json_response($rates);
