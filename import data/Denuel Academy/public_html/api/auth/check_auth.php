<?php
require_once __DIR__ . '/../config.php';
require_method('GET');

if (empty($_SESSION['user_id'])) {
    json_response(['authenticated' => false]);
}

json_response([
    'authenticated' => true,
    'user' => [
        'id' => $_SESSION['user_id'],
        'name' => $_SESSION['name'] ?? '',
        'email' => $_SESSION['email'] ?? '',
        'role' => $_SESSION['role'] ?? ''
    ]
]);
