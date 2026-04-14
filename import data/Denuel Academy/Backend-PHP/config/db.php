<?php
if (function_exists('mysqli_report')) {
    mysqli_report(MYSQLI_REPORT_OFF);
}

function db_connect()
{
    if (!class_exists('mysqli')) {
        json_error('MySQLi extension is not enabled on this server', 500);
    }

    $host = getenv('DB_HOST') ?: 'localhost';
    $user = getenv('DB_USER') ?: 'root';
    $pass = getenv('DB_PASSWORD') ?: 'Pouce@123456789';
    $name = getenv('DB_NAME') ?: 'academy';

    $conn = new mysqli($host, $user, $pass, $name);
    if ($conn->connect_error) {
        json_error('Database connection failed', 500, $conn->connect_error);
    }

    $conn->set_charset('utf8mb4');
    return $conn;
}

function read_json_body()
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }

    $data = json_decode($raw, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        json_error('Invalid JSON payload', 400);
    }

    return is_array($data) ? $data : [];
}

function json_ok($data, $status = 200)
{
    http_response_code($status);
    echo json_encode($data);
    exit;
}

function json_error($message, $status = 400, $details = null)
{
    $payload = ['message' => $message];
    if ($details !== null) {
        $payload['error'] = $details;
    }
    http_response_code($status);
    echo json_encode($payload);
    exit;
}

