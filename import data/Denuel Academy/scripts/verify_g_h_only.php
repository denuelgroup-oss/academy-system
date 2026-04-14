<?php
require_once __DIR__ . '/../public_html/api/config.php';
require_once __DIR__ . '/../public_html/api/expenses/_bootstrap.php';

$conn = db();
ensure_expense_tables($conn);

$total = 0;
$r1 = $conn->query("SELECT COUNT(*) AS c FROM expenses WHERE notes LIKE '%LIVRE2025|%'");
if ($r1) $total = intval($r1->fetch_assoc()['c'] ?? 0);

$gRows = 0;
$r2 = $conn->query("SELECT COUNT(*) AS c FROM expenses WHERE notes LIKE '%LIVRE2025|%' AND notes LIKE '%|G%'");
if ($r2) $gRows = intval($r2->fetch_assoc()['c'] ?? 0);

$hRows = 0;
$r3 = $conn->query("SELECT COUNT(*) AS c FROM expenses WHERE notes LIKE '%LIVRE2025|%' AND notes LIKE '%|H%'");
if ($r3) $hRows = intval($r3->fetch_assoc()['c'] ?? 0);

$eRows = 0;
$r4 = $conn->query("SELECT COUNT(*) AS c FROM expenses WHERE notes LIKE '%LIVRE2025|%' AND notes LIKE '%|E%'");
if ($r4) $eRows = intval($r4->fetch_assoc()['c'] ?? 0);

$fRows = 0;
$r5 = $conn->query("SELECT COUNT(*) AS c FROM expenses WHERE notes LIKE '%LIVRE2025|%' AND notes LIKE '%|F%'");
if ($r5) $fRows = intval($r5->fetch_assoc()['c'] ?? 0);

echo "Imported total: $total\n";
echo "From G: $gRows\n";
echo "From H: $hRows\n";
echo "From E: $eRows\n";
echo "From F: $fRows\n";
