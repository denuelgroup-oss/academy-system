<?php
require_once __DIR__ . '/../finance.php';

function ensure_expense_tables(mysqli $conn): void
{
    ensure_exchange_rate_tables($conn);

    $conn->query(
        'CREATE TABLE IF NOT EXISTS expense_categories (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(120) NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )'
    );

    $conn->query(
        'CREATE TABLE IF NOT EXISTS expenses (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(160) NOT NULL,
            amount DECIMAL(10,2) NOT NULL,
            currency VARCHAR(3) NOT NULL DEFAULT "CDF",
            category_id INT NULL,
            expense_date DATE NOT NULL,
            payment_method VARCHAR(30) NOT NULL,
            notes TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_expense_date (expense_date),
            INDEX idx_expense_category (category_id)
        )'
    );

    ensure_table_column(
        $conn,
        'expenses',
        'currency',
        'ALTER TABLE expenses ADD COLUMN currency VARCHAR(3) NOT NULL DEFAULT "CDF" AFTER amount'
    );

    // Seed default categories once.
    $defaults = ['Equipment', 'Salaries', 'Transport', 'Maintenance', 'Rent'];
    $stmt = $conn->prepare('INSERT IGNORE INTO expense_categories (name) VALUES (?)');
    if ($stmt) {
        foreach ($defaults as $name) {
            $stmt->bind_param('s', $name);
            $stmt->execute();
        }
    }
}
