<?php
require_once __DIR__ . '/_bootstrap.php';
require_auth();
require_method('GET');

$conn = db();
ensure_expense_tables($conn);

$result = $conn->query('SELECT id, name FROM expense_categories ORDER BY name ASC');
$rows = [];
if ($result) {
    while ($row = $result->fetch_assoc()) {
        $rows[] = $row;
    }
}

json_response($rows);
