<?php
/**
 * NAHIMS SW — One-time setup script
 * ─────────────────────────────────
 * 1. Upload this file to your server inside the api/ folder
 * 2. Visit https://ahrimpn.org/api/setup.php in your browser
 * 3. It will create all tables and insert the default admin account
 * 4. DELETE this file from the server immediately after running it
 */

define('DB_HOST', 'localhost');
define('DB_NAME', 'siuxgjee_nahims');
define('DB_USER', 'siuxgjee_nahims_user');
define('DB_PASS', 'Leader@12345');

// ── Change these before running ───────────────────────────────────────────────
define('ADMIN_EMAIL',    'admin@ahrimpn.org');
define('ADMIN_USERNAME', 'NAHIMS Admin');
define('ADMIN_PASSWORD', 'Admin@nahims2026'); // Change this after first login!
// ─────────────────────────────────────────────────────────────────────────────

header('Content-Type: text/plain; charset=utf-8');

try {
    $pdo = new PDO(
        'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
        DB_USER, DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );

    echo "Connected to database successfully.\n\n";

    $pdo->exec("CREATE TABLE IF NOT EXISTS members (
        id            INT          AUTO_INCREMENT PRIMARY KEY,
        member_id     VARCHAR(20)  NOT NULL UNIQUE,
        full_name     VARCHAR(150) NOT NULL,
        email         VARCHAR(150) NOT NULL UNIQUE,
        phone         VARCHAR(30),
        state         VARCHAR(100),
        institution   VARCHAR(200),
        role          VARCHAR(100),
        interest      TEXT,
        password_hash VARCHAR(255) NOT NULL,
        is_active     TINYINT(1)   NOT NULL DEFAULT 1,
        joined_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email     (email),
        INDEX idx_member_id (member_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    echo "✓ Table 'members' ready.\n";

    $pdo->exec("CREATE TABLE IF NOT EXISTS payments (
        id                  INT          AUTO_INCREMENT PRIMARY KEY,
        member_id           VARCHAR(20)  NOT NULL,
        plan_type           ENUM('monthly','annual') NOT NULL DEFAULT 'monthly',
        months_paid         INT          NOT NULL DEFAULT 1,
        amount              DECIMAL(10,2) NOT NULL,
        payment_reference   VARCHAR(120) NOT NULL UNIQUE,
        payment_status      ENUM('pending','successful','failed') NOT NULL DEFAULT 'pending',
        flw_transaction_id  VARCHAR(100),
        payment_date        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_member    (member_id),
        INDEX idx_reference (payment_reference),
        FOREIGN KEY (member_id) REFERENCES members(member_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    echo "✓ Table 'payments' ready.\n";

    $pdo->exec("CREATE TABLE IF NOT EXISTS admins (
        id            INT          AUTO_INCREMENT PRIMARY KEY,
        email         VARCHAR(150) NOT NULL UNIQUE,
        username      VARCHAR(100) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    echo "✓ Table 'admins' ready.\n\n";

    // Insert default admin (skip if already exists)
    $stmt = $pdo->prepare("SELECT id FROM admins WHERE email = ?");
    $stmt->execute([ADMIN_EMAIL]);
    if (!$stmt->fetch()) {
        $hash = password_hash(ADMIN_PASSWORD, PASSWORD_BCRYPT, ['cost' => 12]);
        $pdo->prepare("INSERT INTO admins (email, username, password_hash) VALUES (?, ?, ?)")
            ->execute([ADMIN_EMAIL, ADMIN_USERNAME, $hash]);
        echo "✓ Admin account created.\n";
        echo "  Email:    " . ADMIN_EMAIL    . "\n";
        echo "  Password: " . ADMIN_PASSWORD . "\n\n";
    } else {
        echo "ℹ Admin account already exists — skipped.\n\n";
    }

    echo "═══════════════════════════════════════════\n";
    echo "Setup complete! DELETE this file now.\n";
    echo "═══════════════════════════════════════════\n";

} catch (PDOException $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
