-- NAHIMS SW Stakeholders Forum — Database Schema
-- Run this once in cPanel > phpMyAdmin on database: siuxgjee_nahims

CREATE TABLE IF NOT EXISTS members (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payments (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admins (
    id            INT          AUTO_INCREMENT PRIMARY KEY,
    email         VARCHAR(150) NOT NULL UNIQUE,
    username      VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
