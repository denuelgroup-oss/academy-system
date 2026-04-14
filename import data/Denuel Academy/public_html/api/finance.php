<?php
require_once __DIR__ . '/config.php';

function ensure_table_column(mysqli $conn, string $table, string $column, string $alterSql): void
{
    $safeTable = preg_replace('/[^a-zA-Z0-9_]/', '', $table);
    $safeColumn = preg_replace('/[^a-zA-Z0-9_]/', '', $column);
    $result = $conn->query("SHOW COLUMNS FROM {$safeTable} LIKE '{$safeColumn}'");
    if ($result && $result->num_rows > 0) {
        return;
    }
    $conn->query($alterSql);
}

function normalize_currency_code($currency, string $default = 'USD'): string
{
    $value = strtoupper(trim((string)$currency));
    return in_array($value, ['USD', 'CDF'], true) ? $value : $default;
}

function ensure_app_settings_table(mysqli $conn): void
{
    $conn->query(
        'CREATE TABLE IF NOT EXISTS app_settings (
            setting_key VARCHAR(100) PRIMARY KEY,
            setting_value VARCHAR(255) NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )'
    );

    $conn->query(
        "INSERT INTO app_settings (setting_key, setting_value)
         SELECT 'cdf_to_usd_rate', '0.00035'
         WHERE NOT EXISTS (SELECT 1 FROM app_settings WHERE setting_key = 'cdf_to_usd_rate')"
    );

    $conn->query(
        "INSERT INTO app_settings (setting_key, setting_value)
         SELECT 'usd_to_cdf_rate', '2857.14285714'
         WHERE NOT EXISTS (SELECT 1 FROM app_settings WHERE setting_key = 'usd_to_cdf_rate')"
    );
}

function ensure_exchange_rate_tables(mysqli $conn): void
{
    ensure_app_settings_table($conn);

    $conn->query(
        'CREATE TABLE IF NOT EXISTS exchange_rate_history (
            rate_date DATE PRIMARY KEY,
            cdf_to_usd_rate DECIMAL(18,8) NOT NULL,
            usd_to_cdf_rate DECIMAL(18,8) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )'
    );
}

function get_exchange_rate_settings(mysqli $conn): array
{
    ensure_exchange_rate_tables($conn);

    $result = $conn->query(
        "SELECT setting_key, setting_value, updated_at
           FROM app_settings
          WHERE setting_key IN ('cdf_to_usd_rate', 'usd_to_cdf_rate')"
    );

    $rates = [
        'cdf_to_usd_rate' => 0.00035,
        'usd_to_cdf_rate' => 2857.14285714,
        'updated_at' => null,
    ];

    if ($result) {
        while ($row = $result->fetch_assoc()) {
            if ($row['setting_key'] === 'cdf_to_usd_rate') {
                $rates['cdf_to_usd_rate'] = floatval($row['setting_value']);
            }
            if ($row['setting_key'] === 'usd_to_cdf_rate') {
                $rates['usd_to_cdf_rate'] = floatval($row['setting_value']);
            }
            if (!empty($row['updated_at']) && ($rates['updated_at'] === null || $row['updated_at'] > $rates['updated_at'])) {
                $rates['updated_at'] = $row['updated_at'];
            }
        }
    }

    return $rates;
}

function upsert_exchange_rate_for_date(mysqli $conn, string $rateDate, float $cdfToUsdRate, float $usdToCdfRate): void
{
    ensure_exchange_rate_tables($conn);

    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $rateDate)) {
        return;
    }

    $cdfToUsd = number_format($cdfToUsdRate, 8, '.', '');
    $usdToCdf = number_format($usdToCdfRate, 8, '.', '');

    $stmt = $conn->prepare(
        'INSERT INTO exchange_rate_history (rate_date, cdf_to_usd_rate, usd_to_cdf_rate)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE
             cdf_to_usd_rate = VALUES(cdf_to_usd_rate),
             usd_to_cdf_rate = VALUES(usd_to_cdf_rate)'
    );
    if ($stmt) {
        $stmt->bind_param('sdd', $rateDate, $cdfToUsd, $usdToCdf);
        $stmt->execute();
        $stmt->close();
    }
}

function ensure_exchange_rate_for_date(mysqli $conn, string $rateDate): void
{
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $rateDate)) {
        return;
    }

    $rates = get_exchange_rate_settings($conn);
    $stmt = $conn->prepare(
        'INSERT IGNORE INTO exchange_rate_history (rate_date, cdf_to_usd_rate, usd_to_cdf_rate)
         VALUES (?, ?, ?)'
    );
    if ($stmt) {
        $stmt->bind_param('sdd', $rateDate, $rates['cdf_to_usd_rate'], $rates['usd_to_cdf_rate']);
        $stmt->execute();
        $stmt->close();
    }
}

function ensure_payment_currency_column(mysqli $conn): void
{
    ensure_table_column(
        $conn,
        'payments',
        'currency',
        'ALTER TABLE payments ADD COLUMN currency VARCHAR(3) NULL AFTER amount'
    );

    $conn->query(
        "UPDATE payments p
         INNER JOIN students s ON s.id = p.student_id
         LEFT JOIN plans pl ON pl.id = s.plan_id
            SET p.currency = CASE
                WHEN UPPER(COALESCE(pl.currency, 'CDF')) IN ('USD', 'CDF') THEN UPPER(COALESCE(pl.currency, 'CDF'))
                ELSE 'CDF'
            END
          WHERE p.currency IS NULL OR TRIM(p.currency) = ''"
    );
}

function ensure_payment_extra_columns(mysqli $conn): void
{
    ensure_table_column(
        $conn,
        'payments',
        'payment_mode',
        'ALTER TABLE payments ADD COLUMN payment_mode VARCHAR(30) NULL AFTER currency'
    );

    ensure_table_column(
        $conn,
        'payments',
        'note',
        'ALTER TABLE payments ADD COLUMN note TEXT NULL AFTER payment_mode'
    );

    ensure_table_column(
        $conn,
        'payments',
        'paid_at',
        'ALTER TABLE payments ADD COLUMN paid_at DATETIME NULL AFTER payment_date'
    );

    ensure_table_column(
        $conn,
        'payments',
        'period_start',
        'ALTER TABLE payments ADD COLUMN period_start DATE NULL AFTER paid_at'
    );

    ensure_table_column(
        $conn,
        'payments',
        'period_end',
        'ALTER TABLE payments ADD COLUMN period_end DATE NULL AFTER period_start'
    );

    $conn->query(
        "UPDATE payments
            SET payment_mode = 'cash'
          WHERE payment_mode IS NULL OR TRIM(payment_mode) = ''"
    );

    $conn->query(
        "UPDATE payments
            SET paid_at = CONCAT(payment_date, ' 00:00:00')
          WHERE paid_at IS NULL
            AND payment_date IS NOT NULL"
    );
}

function backfill_legacy_payment_period_links(mysqli $conn): void
{
    // Requires period mapping columns.
    $cols = ['period_start' => false, 'period_end' => false];
    $colsRes = $conn->query("SHOW COLUMNS FROM payments");
    if ($colsRes) {
        while ($row = $colsRes->fetch_assoc()) {
            $field = strtolower((string)($row['Field'] ?? ''));
            if (array_key_exists($field, $cols)) {
                $cols[$field] = true;
            }
        }
    }
    if (!$cols['period_start'] || !$cols['period_end']) {
        return;
    }

    $studentsRes = $conn->query(
        'SELECT DISTINCT student_id
           FROM payments
          WHERE student_id IS NOT NULL
            AND (period_start IS NULL OR period_end IS NULL)
          ORDER BY student_id ASC'
    );
    if (!$studentsRes) {
        return;
    }

    $periodsStmt = $conn->prepare(
        'SELECT p.sub_start, p.sub_end, p.plan_amount
           FROM (
                 SELECT s.sub_start AS sub_start,
                        s.sub_end AS sub_end,
                        COALESCE(pl.amount, 0) AS plan_amount
                   FROM students s
                   LEFT JOIN plans pl ON pl.id = s.plan_id
                  WHERE s.id = ?
                    AND s.sub_start IS NOT NULL
                    AND s.sub_end IS NOT NULL

                 UNION ALL

                 SELECT sp.sub_start AS sub_start,
                        sp.sub_end AS sub_end,
                        COALESCE(pl.amount, 0) AS plan_amount
                   FROM student_subscription_periods sp
                   INNER JOIN students s ON s.id = sp.student_id
                   LEFT JOIN plans pl ON pl.id = s.plan_id
                  WHERE sp.student_id = ?
            ) p
          ORDER BY p.sub_start ASC, p.sub_end ASC'
    );

    $mappedPaidStmt = $conn->prepare(
        'SELECT period_start, period_end, COALESCE(SUM(amount), 0) AS paid
           FROM payments
          WHERE student_id = ?
            AND period_start IS NOT NULL
            AND period_end IS NOT NULL
          GROUP BY period_start, period_end'
    );

    $legacyStmt = $conn->prepare(
        'SELECT id, amount
           FROM payments
          WHERE student_id = ?
            AND (period_start IS NULL OR period_end IS NULL)
          ORDER BY COALESCE(paid_at, CONCAT(payment_date, " 00:00:00")) ASC, id ASC'
    );

    $updateStmt = $conn->prepare(
        'UPDATE payments
            SET period_start = ?,
                period_end = ?,
                expiry_date = COALESCE(expiry_date, ?)
          WHERE id = ?'
    );

    if (!$periodsStmt || !$mappedPaidStmt || !$legacyStmt || !$updateStmt) {
        return;
    }

    while ($srow = $studentsRes->fetch_assoc()) {
        $studentId = intval($srow['student_id'] ?? 0);
        if ($studentId <= 0) {
            continue;
        }

        $periodsStmt->bind_param('ii', $studentId, $studentId);
        $periodsStmt->execute();
        $periodsRes = $periodsStmt->get_result();
        if (!$periodsRes) {
            continue;
        }

        $periods = [];
        while ($prow = $periodsRes->fetch_assoc()) {
            $ps = (string)($prow['sub_start'] ?? '');
            $pe = (string)($prow['sub_end'] ?? '');
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $ps) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $pe)) {
                continue;
            }
            $periods[] = [
                'start' => $ps,
                'end' => $pe,
                'due' => max(0, floatval($prow['plan_amount'] ?? 0)),
                'remaining' => max(0, floatval($prow['plan_amount'] ?? 0)),
            ];
        }
        if (count($periods) === 0) {
            continue;
        }

        $mappedPaidStmt->bind_param('i', $studentId);
        $mappedPaidStmt->execute();
        $mappedPaidRes = $mappedPaidStmt->get_result();
        if ($mappedPaidRes) {
            while ($mrow = $mappedPaidRes->fetch_assoc()) {
                $k = (string)($mrow['period_start'] ?? '') . '|' . (string)($mrow['period_end'] ?? '');
                $paid = floatval($mrow['paid'] ?? 0);
                for ($i = 0; $i < count($periods); $i++) {
                    $pk = $periods[$i]['start'] . '|' . $periods[$i]['end'];
                    if ($pk === $k) {
                        $periods[$i]['remaining'] = max(0, floatval($periods[$i]['due']) - $paid);
                        break;
                    }
                }
            }
        }

        $legacyStmt->bind_param('i', $studentId);
        $legacyStmt->execute();
        $legacyRes = $legacyStmt->get_result();
        if (!$legacyRes) {
            continue;
        }

        while ($lrow = $legacyRes->fetch_assoc()) {
            $paymentId = intval($lrow['id'] ?? 0);
            $amount = max(0, floatval($lrow['amount'] ?? 0));
            if ($paymentId <= 0) {
                continue;
            }

            // Assign to oldest period still owing, else fallback to latest period.
            $targetIdx = -1;
            for ($i = 0; $i < count($periods); $i++) {
                if (floatval($periods[$i]['remaining']) > 0.0001) {
                    $targetIdx = $i;
                    break;
                }
            }
            if ($targetIdx < 0) {
                $targetIdx = count($periods) - 1;
            }

            $targetStart = $periods[$targetIdx]['start'];
            $targetEnd = $periods[$targetIdx]['end'];
            $expiry = $targetEnd;
            $updateStmt->bind_param('sssi', $targetStart, $targetEnd, $expiry, $paymentId);
            $updateStmt->execute();

            $periods[$targetIdx]['remaining'] = max(0, floatval($periods[$targetIdx]['remaining']) - $amount);
        }
    }
}

function cdf_to_usd_rate_sql(string $dateExpr): string
{
    return "COALESCE((SELECT erh.cdf_to_usd_rate
                       FROM exchange_rate_history erh
                      WHERE erh.rate_date <= {$dateExpr}
                      ORDER BY erh.rate_date DESC
                      LIMIT 1),
                     (SELECT CAST(s.setting_value AS DECIMAL(18,8))
                        FROM app_settings s
                       WHERE s.setting_key = 'cdf_to_usd_rate'
                       LIMIT 1),
                     0)";
}

function convert_amount_to_usd_sql(string $amountExpr, string $currencyExpr, string $dateExpr): string
{
    $rateExpr = cdf_to_usd_rate_sql($dateExpr);
    return "(CASE
                WHEN UPPER(COALESCE({$currencyExpr}, 'USD')) = 'CDF' THEN ({$amountExpr}) * ({$rateExpr})
                ELSE ({$amountExpr})
            END)";
}