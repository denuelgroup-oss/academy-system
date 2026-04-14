<?php
require_once __DIR__ . '/_bootstrap.php';
require_auth();
require_method('POST');

$input = body_json();
$title = trim((string)($input['title'] ?? ''));
$amount = floatval($input['amount'] ?? 0);
$currency = normalize_currency_code($input['currency'] ?? 'CDF', 'CDF');
$categoryId = intval($input['category_id'] ?? 0);
$expenseDate = trim((string)($input['expense_date'] ?? ''));
$paymentMethod = strtolower(trim((string)($input['payment_method'] ?? '')));
$notes = trim((string)($input['notes'] ?? ''));

$allowedMethods = ['cash', 'mobile_money', 'bank'];
if ($title === '' || $amount <= 0 || $expenseDate === '' || !in_array($paymentMethod, $allowedMethods, true)) {
    json_response(['message' => 'title, amount, category, date and payment method are required'], 400);
}
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $expenseDate)) {
    json_response(['message' => 'Invalid expense date'], 400);
}
if ($categoryId <= 0) {
    json_response(['message' => 'Please select a category'], 400);
}

$conn = db();
ensure_expense_tables($conn);
ensure_exchange_rate_for_date($conn, $expenseDate);

$cat = $conn->prepare('SELECT id FROM expense_categories WHERE id = ? LIMIT 1');
$cat->bind_param('i', $categoryId);
$cat->execute();
if (!($cat->get_result()->fetch_assoc())) {
    json_response(['message' => 'Category not found'], 400);
}

$stmt = $conn->prepare(
    'INSERT INTO expenses (title, amount, currency, category_id, expense_date, payment_method, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)' 
);
if (!$stmt) {
    json_response(['message' => 'Failed to prepare insert'], 500);
}
$stmt->bind_param('sdsisss', $title, $amount, $currency, $categoryId, $expenseDate, $paymentMethod, $notes);
if (!$stmt->execute()) {
    json_response(['message' => 'Failed to save expense'], 500);
}

json_response(['message' => 'Expense saved', 'id' => $conn->insert_id], 201);
