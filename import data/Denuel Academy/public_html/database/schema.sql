CREATE DATABASE IF NOT EXISTS academy;
USE academy;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS renewals;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS students;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS attendance;
DROP TABLE IF EXISTS transactions;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(30) NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CHECK (role IN ('admin', 'teacher'))
);

CREATE TABLE IF NOT EXISTS students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(120) NULL,
  phone VARCHAR(30) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  CONSTRAINT fk_payments_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS renewals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  status VARCHAR(20) NOT NULL,
  last_checked DATETIME NOT NULL,
  UNIQUE KEY uq_renewals_student (student_id),
  CONSTRAINT fk_renewals_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CHECK (status IN ('active', 'expired'))
);

INSERT INTO users (name, email, password, role)
SELECT 'Administrator', 'admin@academy.local', '$2y$10$V7Y9fXyDYU8fA6QYW2mdSOyQta31vPB6nhR9B8I2N/x4OnfLSdL8i', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@academy.local');

