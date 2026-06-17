<?php
// ── DATABASE ──────────────────────────────────────────────────────────────────
define('DB_HOST', 'localhost');
define('DB_NAME', 'siuxgjee_nahims');
define('DB_USER', 'siuxgjee_nahims_user');
define('DB_PASS', 'Leader@12345');

// ── JWT & PAYMENT ─────────────────────────────────────────────────────────────
define('JWT_SECRET',    'nahims_sw_2026_K9x#mPqL!zR4vT8wY3nB7cD1eF6j');
define('FLW_SECRET_KEY','FLWSECK-XXXXXXXX'); // TODO: paste your Flutterwave secret key here
define('MONTHLY_RATE',  600);
define('ANNUAL_RATE',   6000);

// ── CORS ──────────────────────────────────────────────────────────────────────
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed_origins = ['https://himmedia.ng', 'https://www.himmedia.ng', 'http://localhost', 'http://127.0.0.1', 'http://localhost:5500'];
if (in_array($origin, $allowed_origins) || str_contains($origin, 'himmedia.ng')) {
    header('Access-Control-Allow-Origin: ' . $origin);
} else {
    header('Access-Control-Allow-Origin: https://himmedia.ng');
}
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ── DATABASE CONNECTION ───────────────────────────────────────────────────────
function db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
        } catch (PDOException $e) {
            respond(['success' => false, 'message' => 'Database unavailable.'], 503);
        }
    }
    return $pdo;
}

// ── JWT HELPERS ───────────────────────────────────────────────────────────────
function b64url(string $s): string {
    return rtrim(strtr(base64_encode($s), '+/', '-_'), '=');
}
function b64url_d(string $s): string {
    return base64_decode(strtr($s, '-_', '+/') . str_repeat('=', (4 - strlen($s) % 4) % 4));
}
function makeToken(array $payload, int $ttl = 86400 * 30): string {
    $h = b64url(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $p = b64url(json_encode(array_merge($payload, ['exp' => time() + $ttl, 'iat' => time()])));
    $s = b64url(hash_hmac('sha256', "$h.$p", JWT_SECRET, true));
    return "$h.$p.$s";
}
function verifyToken(string $token): ?array {
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    [$h, $p, $s] = $parts;
    $expected = b64url(hash_hmac('sha256', "$h.$p", JWT_SECRET, true));
    if (!hash_equals($expected, $s)) return null;
    $data = json_decode(b64url_d($p), true);
    if (!$data || $data['exp'] < time()) return null;
    return $data;
}
function getBearerToken(): ?string {
    $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/Bearer\s+(.+)/i', $auth, $m)) return $m[1];
    return null;
}

// ── GUARDS ────────────────────────────────────────────────────────────────────
function requireAuth(): array {
    $token = getBearerToken();
    if (!$token) respond(['success' => false, 'message' => 'Not authenticated.'], 401);
    $data = verifyToken($token);
    if (!$data || empty($data['member_id'])) respond(['success' => false, 'message' => 'Session expired.'], 401);
    return $data;
}
function requireAdmin(): array {
    $token = getBearerToken();
    if (!$token) respond(['success' => false, 'message' => 'Not authenticated.'], 401);
    $data = verifyToken($token);
    if (!$data || empty($data['is_admin'])) respond(['success' => false, 'message' => 'Forbidden.'], 403);
    return $data;
}

// ── RESPONSE & INPUT ──────────────────────────────────────────────────────────
function respond(array $data, int $code = 200): never {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}
function body(): array {
    static $b = null;
    if ($b === null) $b = json_decode(file_get_contents('php://input'), true) ?? [];
    return $b;
}

// ── SUBSCRIPTION STATUS ───────────────────────────────────────────────────────
function subscriptionStatus(string $member_id): array {
    $pdo = db();

    $stmt = $pdo->prepare("SELECT joined_at FROM members WHERE member_id = ?");
    $stmt->execute([$member_id]);
    $member = $stmt->fetch();
    if (!$member) return [];

    $joinedAt = new DateTime($member['joined_at']);
    $now      = new DateTime();

    $stmt = $pdo->prepare("SELECT COALESCE(SUM(months_paid), 0) FROM payments WHERE member_id = ? AND payment_status = 'successful'");
    $stmt->execute([$member_id]);
    $monthsPaid = (int)$stmt->fetchColumn();

    // Subscription end = join date + months paid
    $subEnd = clone $joinedAt;
    $subEnd->modify("+{$monthsPaid} months");

    $isActive = $monthsPaid > 0 && $subEnd > $now;

    // Full months elapsed since joining
    $diff          = $joinedAt->diff($now);
    $monthsElapsed = $diff->y * 12 + $diff->m;
    $monthsOwed    = max(0, $monthsElapsed - $monthsPaid);

    // Date from which arrears are counted
    $oweFromDate = $monthsPaid > 0 ? clone $subEnd : clone $joinedAt;
    $oweFrom     = $oweFromDate->format('M Y');

    return [
        'isActive'        => $isActive,
        'monthsPaid'      => $monthsPaid,
        'monthsOwed'      => $monthsOwed,
        'subscriptionEnd' => $monthsPaid > 0 ? $subEnd->format('Y-m-d H:i:s') : null,
        'oweFrom'         => $oweFrom,
        'arrearsAmount'   => $monthsOwed * MONTHLY_RATE,
    ];
}
