<?php
require_once __DIR__ . '/_bootstrap.php';
require_auth();
require_method('GET');

$conn = db();
ensure_expense_tables($conn);

$search = trim((string)($_GET['search'] ?? ''));
$categoryId = intval($_GET['category_id'] ?? 0);
$currency = normalize_currency_code($_GET['currency'] ?? '', '');
$from = trim((string)($_GET['from'] ?? ''));
$to = trim((string)($_GET['to'] ?? ''));
$limit = intval($_GET['limit'] ?? 0);

$sql = 'SELECT e.id, e.title, e.amount, e.currency, e.category_id, c.name AS category_name,
               e.expense_date, e.payment_method, e.notes, e.created_at
        FROM expenses e
        LEFT JOIN expense_categories c ON c.id = e.category_id
        WHERE 1 = 1';
$types = '';
$params = [];

if ($search !== '') {
    $sql .= ' AND (e.title LIKE ? OR e.notes LIKE ? OR c.name LIKE ?)';
    $like = '%' . $search . '%';
    $types .= 'sss';
    $params[] = $like;
    $params[] = $like;
    $params[] = $like;
}
if ($categoryId > 0) {
    $sql .= ' AND e.category_id = ?';
    $types .= 'i';
    $params[] = $categoryId;
}
if ($currency !== '') {
    $sql .= ' AND e.currency = ?';
    $types .= 's';
    $params[] = $currency;
}
if ($from !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $from)) {
    $sql .= ' AND e.expense_date >= ?';
    $types .= 's';
    $params[] = $from;
}
if ($to !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $to)) {
    $sql .= ' AND e.expense_date <= ?';
    $types .= 's';
    $params[] = $to;
}

$sql .= ' ORDER BY e.expense_date DESC, e.id DESC';
if ($limit > 0) {
    $safeLimit = min(max($limit, 1), 200);
    $sql .= ' LIMIT ' . $safeLimit;
}

$stmt = $conn->prepare($sql);
if (!$stmt) {
    json_response(['message' => 'Failed to prepare list query'], 500);
}
if ($types !== '') {
    $stmt->bind_param($types, ...$params);
}
$stmt->execute();
$result = $stmt->get_result();

$rows = [];
if ($result) {
    while ($row = $result->fetch_assoc()) {
        $rows[] = $row;
    }
}

json_response($rows);
