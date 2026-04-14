<?php
header('Content-Type: application/json');

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

function db()
{
    static $conn = null;
    if ($conn !== null) {
        return $conn;
    }

    $host = getenv('DB_HOST') ?: 'localhost';
    $user = getenv('DB_USER') ?: 'root';
    $pass = getenv('DB_PASSWORD') ?: 'Pouce@123456789';
    $name = getenv('DB_NAME') ?: 'academy';

    $conn = new mysqli($host, $user, $pass, $name);
    if ($conn->connect_error) {
        json_response(['message' => 'Database connection failed'], 500);
    }
    $conn->set_charset('utf8mb4');
    return $conn;
}

function body_json()
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function json_response($payload, $status = 200)
{
    http_response_code($status);
    echo json_encode($payload);
    exit;
}

function require_method($method)
{
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit;
    }
    if ($_SERVER['REQUEST_METHOD'] !== $method) {
        json_response(['message' => 'Method not allowed'], 405);
    }
}

function require_auth()
{
    if (empty($_SESSION['user_id'])) {
        json_response(['authenticated' => false, 'message' => 'Unauthorized'], 401);
    }
}

function require_super_admin()
{
    require_auth();

    $role = strtolower(trim((string)($_SESSION['role'] ?? '')));
    if ($role !== 'super_admin' && !empty($_SESSION['user_id'])) {
        // Session role can be stale after DB role updates; refresh it from DB.
        $conn = db();
        $uid = intval($_SESSION['user_id']);
        $stmt = $conn->prepare('SELECT role FROM users WHERE id = ? LIMIT 1');
        if ($stmt) {
            $stmt->bind_param('i', $uid);
            $stmt->execute();
            $result = $stmt->get_result();
            $row = $result ? $result->fetch_assoc() : null;
            if ($row && isset($row['role'])) {
                $_SESSION['role'] = $row['role'];
                $role = strtolower(trim((string)$row['role']));
            }
        }
    }

    if ($role !== 'super_admin') {
        json_response(['message' => 'Forbidden: super admin privileges required'], 403);
    }
}
