<?php
require __DIR__ . '/config.php';

$uri    = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$uri    = preg_replace('#^/NAHIMSAPI#', '', $uri);   // strip /NAHIMSAPI prefix
$uri    = rtrim($uri, '/') ?: '/';
$method = $_SERVER['REQUEST_METHOD'];

// ═══════════════════════════════════════════════════════════════════════════════
//  POST /register
// ═══════════════════════════════════════════════════════════════════════════════
if ($method === 'POST' && $uri === '/register') {
    $b           = body();
    $fullName    = trim($b['fullName']    ?? '');
    $email       = strtolower(trim($b['email']       ?? ''));
    $phone       = trim($b['phone']       ?? '');
    $state       = trim($b['state']       ?? '');
    $institution = trim($b['institution'] ?? '');
    $role        = trim($b['role']        ?? '');
    $interest    = trim($b['interest']    ?? '');
    $password    = $b['password'] ?? '';

    if (!$fullName || !$email || !$password || !$state || !$institution || !$role)
        respond(['success' => false, 'message' => 'All required fields must be filled.']);
    if (!filter_var($email, FILTER_VALIDATE_EMAIL))
        respond(['success' => false, 'message' => 'Invalid email address.']);
    if (strlen($password) < 8)
        respond(['success' => false, 'message' => 'Password must be at least 8 characters.']);

    $pdo  = db();
    $stmt = $pdo->prepare("SELECT id FROM members WHERE email = ?");
    $stmt->execute([$email]);
    if ($stmt->fetch())
        respond(['success' => false, 'message' => 'An account with this email already exists.']);

    $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

    // Insert with temp member_id, then update using auto-increment id
    $stmt = $pdo->prepare("INSERT INTO members
        (member_id, full_name, email, phone, state, institution, role, interest, password_hash, is_active, joined_at)
        VALUES ('TEMP', ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())");
    $stmt->execute([$fullName, $email, $phone, $state, $institution, $role, $interest, $hash]);

    $autoId   = (int)$pdo->lastInsertId();
    $memberId = 'NHS-' . str_pad($autoId, 4, '0', STR_PAD_LEFT);
    $pdo->prepare("UPDATE members SET member_id = ? WHERE id = ?")->execute([$memberId, $autoId]);

    respond(['success' => true, 'memberId' => $memberId]);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  POST /login
// ═══════════════════════════════════════════════════════════════════════════════
if ($method === 'POST' && $uri === '/login') {
    $b        = body();
    $email    = strtolower(trim($b['email']    ?? ''));
    $password = $b['password'] ?? '';

    if (!$email || !$password)
        respond(['success' => false, 'message' => 'Email and password are required.']);

    $pdo  = db();
    $stmt = $pdo->prepare("SELECT * FROM members WHERE email = ?");
    $stmt->execute([$email]);
    $member = $stmt->fetch();

    if (!$member || !password_verify($password, $member['password_hash']))
        respond(['success' => false, 'message' => 'Invalid email or password.']);
    if (!$member['is_active'])
        respond(['success' => false, 'message' => 'Your account has been deactivated. Contact admin.']);

    $token = makeToken(['member_id' => $member['member_id'], 'email' => $member['email']]);

    respond([
        'success' => true,
        'token'   => $token,
        'member'  => [
            'member_id'   => $member['member_id'],
            'full_name'   => $member['full_name'],
            'email'       => $member['email'],
            'phone'       => $member['phone'],
            'state'       => $member['state'],
            'institution' => $member['institution'],
            'role'        => $member['role'],
        ],
    ]);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /member
// ═══════════════════════════════════════════════════════════════════════════════
if ($method === 'GET' && $uri === '/member') {
    $auth = requireAuth();
    $pdo  = db();
    $stmt = $pdo->prepare("SELECT member_id, full_name, email, phone, state, institution, role FROM members WHERE member_id = ?");
    $stmt->execute([$auth['member_id']]);
    $member = $stmt->fetch();
    if (!$member) respond(['success' => false, 'message' => 'Member not found.'], 404);
    respond(['success' => true, 'member' => $member]);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /payment-status
// ═══════════════════════════════════════════════════════════════════════════════
if ($method === 'GET' && $uri === '/payment-status') {
    $auth   = requireAuth();
    $status = subscriptionStatus($auth['member_id']);
    respond(['success' => true, 'status' => $status]);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /payments
// ═══════════════════════════════════════════════════════════════════════════════
if ($method === 'GET' && $uri === '/payments') {
    $auth = requireAuth();
    $pdo  = db();
    $stmt = $pdo->prepare(
        "SELECT payment_date, plan_type, months_paid, amount, payment_reference, payment_status
         FROM payments WHERE member_id = ? ORDER BY payment_date DESC"
    );
    $stmt->execute([$auth['member_id']]);
    respond(['success' => true, 'payments' => $stmt->fetchAll()]);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  POST /create-payment
// ═══════════════════════════════════════════════════════════════════════════════
if ($method === 'POST' && $uri === '/create-payment') {
    $auth     = requireAuth();
    $b        = body();
    $planType = in_array($b['planType'] ?? '', ['monthly', 'annual']) ? $b['planType'] : 'monthly';
    $months   = $planType === 'annual' ? 12 : max(1, (int)($b['months'] ?? 1));
    $amount   = $planType === 'annual' ? ANNUAL_RATE : $months * MONTHLY_RATE;
    $txRef    = 'NAHIMS-' . strtoupper($planType) . '-' . $auth['member_id'] . '-' . time();

    $pdo  = db();
    $stmt = $pdo->prepare(
        "INSERT INTO payments (member_id, plan_type, months_paid, amount, payment_reference, payment_status, payment_date)
         VALUES (?, ?, ?, ?, ?, 'pending', NOW())"
    );
    $stmt->execute([$auth['member_id'], $planType, $months, $amount, $txRef]);

    respond(['success' => true, 'txRef' => $txRef, 'amount' => $amount, 'monthsPaid' => $months]);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  POST /verify-payment
// ═══════════════════════════════════════════════════════════════════════════════
if ($method === 'POST' && $uri === '/verify-payment') {
    $auth          = requireAuth();
    $b             = body();
    $transactionId = $b['transaction_id'] ?? '';
    $txRef         = $b['tx_ref']         ?? '';

    if (!$txRef) respond(['success' => false, 'message' => 'Missing transaction reference.']);

    $pdo  = db();
    $stmt = $pdo->prepare(
        "SELECT * FROM payments WHERE member_id = ? AND payment_reference = ? AND payment_status = 'pending'"
    );
    $stmt->execute([$auth['member_id'], $txRef]);
    $payment = $stmt->fetch();
    if (!$payment) respond(['success' => false, 'message' => 'Payment record not found or already processed.']);

    $verified = false;
    $flwKey   = FLW_SECRET_KEY;

    if ($transactionId && $flwKey !== 'FLWSECK-XXXXXXXX') {
        // Live Flutterwave verification
        $ch = curl_init("https://api.flutterwave.com/v3/transactions/{$transactionId}/verify");
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER     => [
                "Authorization: Bearer {$flwKey}",
                "Content-Type: application/json",
            ],
        ]);
        $resp = json_decode(curl_exec($ch), true);

        if (($resp['status'] ?? '') === 'success' && ($resp['data']['status'] ?? '') === 'successful') {
            if ((float)$resp['data']['amount'] >= (float)$payment['amount']) {
                $verified = true;
            } else {
                respond(['success' => false, 'message' => 'Payment amount mismatch — contact admin.']);
            }
        } else {
            respond(['success' => false, 'message' => 'Flutterwave could not verify this payment.']);
        }
    } else {
        // Flutterwave secret key not yet set — accept for testing
        $verified = true;
    }

    if ($verified) {
        $pdo->prepare("UPDATE payments SET payment_status = 'successful', flw_transaction_id = ? WHERE payment_reference = ?")
            ->execute([$transactionId ?: 'TEST', $txRef]);

        $status = subscriptionStatus($auth['member_id']);
        respond(array_merge(['success' => true], $status));
    }

    respond(['success' => false, 'message' => 'Verification failed.']);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  POST /admin/login
// ═══════════════════════════════════════════════════════════════════════════════
if ($method === 'POST' && $uri === '/admin/login') {
    $b        = body();
    $email    = strtolower(trim($b['email']    ?? ''));
    $password = $b['password'] ?? '';

    $pdo  = db();
    $stmt = $pdo->prepare("SELECT * FROM admins WHERE email = ?");
    $stmt->execute([$email]);
    $admin = $stmt->fetch();

    if (!$admin || !password_verify($password, $admin['password_hash']))
        respond(['success' => false, 'message' => 'Invalid admin credentials.']);

    $token = makeToken(['is_admin' => true, 'admin_id' => $admin['id'], 'username' => $admin['username']], 86400 * 7);
    respond(['success' => true, 'token' => $token, 'username' => $admin['username']]);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /admin/stats
// ═══════════════════════════════════════════════════════════════════════════════
if ($method === 'GET' && $uri === '/admin/stats') {
    requireAdmin();
    $pdo = db();

    $total    = $pdo->query("SELECT COUNT(*) FROM members")->fetchColumn();
    $active   = $pdo->query("SELECT COUNT(*) FROM members WHERE is_active = 1")->fetchColumn();
    $inactive = $pdo->query("SELECT COUNT(*) FROM members WHERE is_active = 0")->fetchColumn();
    $monthly  = $pdo->query("SELECT COALESCE(SUM(months_paid),0) FROM payments WHERE plan_type='monthly' AND payment_status='successful'")->fetchColumn();
    $annual   = $pdo->query("SELECT COUNT(*) FROM payments WHERE plan_type='annual' AND payment_status='successful'")->fetchColumn();
    $revenue  = $pdo->query("SELECT COALESCE(SUM(amount),0) FROM payments WHERE payment_status='successful'")->fetchColumn();

    respond(['success' => true, 'stats' => compact('total', 'active', 'inactive', 'monthly', 'annual', 'revenue')]);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /admin/members
// ═══════════════════════════════════════════════════════════════════════════════
if ($method === 'GET' && $uri === '/admin/members') {
    requireAdmin();
    $search = trim($_GET['search'] ?? '');
    $pdo    = db();

    $sql = "SELECT m.member_id, m.full_name, m.email, m.phone, m.state, m.institution, m.role,
                   m.is_active, m.joined_at,
                   COALESCE((SELECT SUM(p.months_paid) FROM payments p WHERE p.member_id = m.member_id AND p.payment_status = 'successful'), 0) AS months_paid
            FROM members m";

    if ($search) {
        $q    = "%{$search}%";
        $stmt = $pdo->prepare($sql . " WHERE m.full_name LIKE ? OR m.email LIKE ? OR m.member_id LIKE ? OR m.state LIKE ? ORDER BY m.joined_at DESC");
        $stmt->execute([$q, $q, $q, $q]);
    } else {
        $stmt = $pdo->query($sql . " ORDER BY m.joined_at DESC");
    }

    $members = $stmt->fetchAll();
    $now     = new DateTime();

    foreach ($members as &$m) {
        $monthsPaid = (int)$m['months_paid'];
        $joinedAt   = new DateTime($m['joined_at']);
        $subEnd     = clone $joinedAt;
        $subEnd->modify("+{$monthsPaid} months");

        $isSubActive        = $monthsPaid > 0 && $subEnd > $now;
        $m['subscription_end'] = $monthsPaid > 0 ? $subEnd->format('Y-m-d') : null;
        $m['sub_status']    = $isSubActive ? 'active' : ($monthsPaid > 0 ? 'pending' : 'none');
        unset($m['months_paid'], $m['joined_at']);
    }
    unset($m);

    respond(['success' => true, 'members' => $members]);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PATCH /admin/members/:id/toggle
// ═══════════════════════════════════════════════════════════════════════════════
if ($method === 'PATCH' && preg_match('#^/admin/members/([^/]+)/toggle$#', $uri, $m)) {
    requireAdmin();
    $memberId = $m[1];
    $pdo      = db();

    $stmt = $pdo->prepare("SELECT is_active FROM members WHERE member_id = ?");
    $stmt->execute([$memberId]);
    $member = $stmt->fetch();
    if (!$member) respond(['success' => false, 'message' => 'Member not found.'], 404);

    $newStatus = $member['is_active'] ? 0 : 1;
    $pdo->prepare("UPDATE members SET is_active = ? WHERE member_id = ?")->execute([$newStatus, $memberId]);
    respond(['success' => true, 'is_active' => (bool)$newStatus]);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PUT /admin/members/:id
// ═══════════════════════════════════════════════════════════════════════════════
if ($method === 'PUT' && preg_match('#^/admin/members/([^/]+)$#', $uri, $m)) {
    requireAdmin();
    $memberId = $m[1];
    $b        = body();

    $pdo  = db();
    $stmt = $pdo->prepare(
        "UPDATE members SET full_name = ?, phone = ?, state = ?, institution = ?, role = ? WHERE member_id = ?"
    );
    $stmt->execute([
        trim($b['fullName']    ?? ''),
        trim($b['phone']       ?? ''),
        trim($b['state']       ?? ''),
        trim($b['institution'] ?? ''),
        trim($b['role']        ?? ''),
        $memberId,
    ]);
    respond(['success' => true]);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /admin/payments
// ═══════════════════════════════════════════════════════════════════════════════
if ($method === 'GET' && $uri === '/admin/payments') {
    requireAdmin();
    $pdo  = db();
    $stmt = $pdo->query(
        "SELECT p.payment_date, m.full_name, p.member_id, p.plan_type, p.months_paid,
                p.amount, p.payment_reference, p.payment_status
         FROM payments p JOIN members m ON m.member_id = p.member_id
         ORDER BY p.payment_date DESC LIMIT 500"
    );
    respond(['success' => true, 'payments' => $stmt->fetchAll()]);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /admin/export/csv  (token via query string, not header)
// ═══════════════════════════════════════════════════════════════════════════════
if ($method === 'GET' && $uri === '/admin/export/csv') {
    $token = $_GET['token'] ?? '';
    if (!$token) { http_response_code(401); echo 'Unauthorized'; exit; }
    $data  = verifyToken($token);
    if (!$data || empty($data['is_admin'])) { http_response_code(403); echo 'Forbidden'; exit; }

    $pdo  = db();
    $stmt = $pdo->query(
        "SELECT m.member_id, m.full_name, m.email, m.phone, m.state, m.institution, m.role,
                m.is_active, m.joined_at,
                COALESCE((SELECT SUM(p.months_paid) FROM payments p WHERE p.member_id=m.member_id AND p.payment_status='successful'),0) AS months_paid,
                COALESCE((SELECT SUM(p.amount)      FROM payments p WHERE p.member_id=m.member_id AND p.payment_status='successful'),0) AS total_paid
         FROM members m ORDER BY m.joined_at DESC"
    );

    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="nahims_members_' . date('Y-m-d') . '.csv"');

    $out = fopen('php://output', 'w');
    fputcsv($out, ['Member ID', 'Full Name', 'Email', 'Phone', 'State', 'Institution', 'Role', 'Account Active', 'Joined', 'Months Paid', 'Total Paid (NGN)']);
    while ($row = $stmt->fetch()) {
        fputcsv($out, [
            $row['member_id'],   $row['full_name'],   $row['email'],
            $row['phone'],       $row['state'],        $row['institution'],
            $row['role'],        $row['is_active'] ? 'Yes' : 'No',
            date('Y-m-d', strtotime($row['joined_at'])),
            $row['months_paid'], $row['total_paid'],
        ]);
    }
    fclose($out);
    exit;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  404
// ═══════════════════════════════════════════════════════════════════════════════
respond(['success' => false, 'message' => 'Endpoint not found.'], 404);
