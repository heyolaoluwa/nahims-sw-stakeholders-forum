# UCH HIM Alumni Association — Website

Complete alumni management website for the School of Health Information Management,
University College Hospital (UCH), Ibadan, Nigeria.

---

## 📁 Project Structure

```
uch-him-alumni/
├── UCHhome.html          — Landing page
├── UCHabout.html         — About the association
├── UCHmembership.html    — Register / Login / Renew + Member Dashboard
├── UCHevents.html        — Events listing + RSVP
├── UCHcareers.html       — Job board + Post a Job
├── UCHdonation.html      — General & project-based donations
├── UCHexecutives.html    — Executive members
├── UCHcontact.html       — Contact form + FAQ + Map
├── UCHadmin.html         — Admin control panel (password protected)
│
├── assets/
│   ├── css/main.css      — All styles
│   ├── js/main.js        — Core JavaScript (payments, forms, modals)
│   └── js/components.js  — Shared navbar + footer
│
└── backend/
    ├── db/
    │   ├── connection.php — PDO connection + helpers
    │   └── schema.sql     — Full database schema + seed data
    │
    ├── api/               — Public endpoints (used by frontend)
    │   ├── register.php   — POST: member registration
    │   ├── login.php      — POST: member login
    │   ├── member.php     — GET/POST: member profile
    │   ├── verify-payment.php — POST: Flutterwave payment verification
    │   ├── payments.php   — GET: member payment history
    │   ├── rsvp.php       — POST: event RSVP
    │   ├── post-job.php   — POST: submit job listing
    │   └── contact.php    — POST: contact form
    │
    └── admin/             — Admin-only endpoints (require X-Admin-Token)
        ├── login.php      — POST: admin authentication
        ├── stats.php      — GET: dashboard statistics
        ├── members.php    — GET/POST: member management
        ├── payments.php   — GET: all payment records
        ├── events.php     — GET/POST: event management
        ├── jobs.php       — GET/POST: job management
        ├── executives.php — GET/POST: executive management
        ├── donations.php  — GET: donation records
        ├── projects.php   — GET/POST: donation projects
        ├── messages.php   — GET/POST: contact messages
        └── settings.php   — GET/POST: site settings
```

---

## ⚙️ Setup Instructions

### 1. Requirements
- PHP 8.0+ with PDO MySQL extension
- MySQL 5.7+ or MariaDB 10.3+
- Apache/Nginx web server (or PHP built-in server for local dev)
- A Flutterwave account (https://flutterwave.com)

### 2. Database Setup
```sql
-- Create the database
CREATE DATABASE uch_him_alumni CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Import the schema (includes seed data)
mysql -u root -p uch_him_alumni < backend/db/schema.sql
```

### 3. Configure Database Connection
Edit `backend/db/connection.php`:
```php
define('DB_HOST', 'localhost');
define('DB_NAME', 'uch_him_alumni');
define('DB_USER', 'your_db_user');
define('DB_PASS', 'your_db_password');
define('JWT_SECRET', 'change-this-to-a-long-random-string');
```

### 4. Configure Flutterwave
Edit `backend/api/verify-payment.php`:
```php
define('FLW_SECRET_KEY', 'FLWSECK_LIVE-your-secret-key-here');
```

In each HTML file, set your Flutterwave **public** key.
Search for `FLWPUBK_TEST-` in the HTML files and replace with your live key.

### 5. Admin Setup
Default admin credentials (change immediately after first login):
- **Email:** admin@uchhimalumni.org
- **Password:** admin1234

To generate a new admin password hash (run in PHP):
```php
echo password_hash('your_new_password', PASSWORD_BCRYPT, ['cost' => 12]);
```
Then update `admin_users` table directly.

### 6. Web Server

**Apache** — create `.htaccess` in project root:
```apache
Options -Indexes
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
```

**Nginx** — add to server block:
```nginx
location /backend/ {
    try_files $uri $uri/ =404;
}
```

**Local development (PHP built-in server):**
```bash
cd uch-him-alumni
php -S localhost:8080
# Visit: http://localhost:8080/UCHhome.html
```

---

## 💳 Payment Flow

### Membership Registration
1. User fills registration form → `POST /backend/api/register.php`
2. On success, Flutterwave modal opens (₦5,000 fee)
3. On payment, Flutterwave calls our callback
4. We verify via `POST /backend/api/verify-payment.php` with `payment_type: "membership"`
5. Member status updated to `active`, expiry set to Dec 31

### Donation
1. User selects amount and clicks donate
2. Flutterwave modal opens
3. On success, we call `verify-payment.php` with `payment_type: "donation"`
4. Donation recorded; project `raised_amount` updated if project donation

---

## 🔒 Security Notes

- All passwords hashed with `password_hash()` (bcrypt, cost 12)
- All admin endpoints require `X-Admin-Token` JWT header
- All inputs sanitised with `sanitize()` + PDO prepared statements
- CORS headers set — restrict `Access-Control-Allow-Origin` in production
- Change `JWT_SECRET` and admin password before going live
- Add HTTPS (SSL certificate) in production — Flutterwave requires it
- Consider adding rate limiting to `/api/login.php` and `/api/register.php`

---

## 🎨 Customisation

| What to change | Where |
|---|---|
| UCH Green colour | `--primary` in `assets/css/main.css` |
| Gold accent colour | `--gold` in `assets/css/main.css` |
| Logo | Replace `assets/images/logo.png` and update components.js |
| Membership fee | `settings` table or Settings panel in admin |
| Executives list | Admin panel → Executives |
| Events | Admin panel → Events |
| Donation projects | Admin panel → Projects |

---

## 📞 Pages Summary

| Page | Key Feature |
|---|---|
| Home | Hero, stats counter, events preview, membership CTA |
| About | Mission/vision, history timeline, governance |
| Membership | Register, login, renew, member dashboard, digital ID card |
| Events | Upcoming/past events, RSVP modal |
| Careers | Searchable job board, post a job |
| Donation | Quick donate + project-specific donations with progress bars |
| Executives | Principal officers + committee |
| Contact | Form, map, FAQ accordion |
| Admin | Full CRUD for all content, export CSV, stats dashboard |
