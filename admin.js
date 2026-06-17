/* ============================================================
   admin.js — NAHIMS SW Admin Dashboard
   ============================================================ */
'use strict';

const API_BASE = 'https://himmedia.ng/NAHIMSAPI';

/* ── Auth guard ─────────────────────────────────────────── */
let adminToken = localStorage.getItem('nahims_admin_token');

if (!adminToken) {
  showLoginPrompt();
}

/* ── Show Login Prompt if no token ──────────────────────── */
function showLoginPrompt() {
  document.body.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f0f2f5;">
      <div style="background:#fff;border-radius:12px;padding:2.5rem;width:90%;max-width:380px;box-shadow:0 8px 32px rgba(0,0,0,.12);">
        <div style="text-align:center;margin-bottom:1.75rem;">
          <i class="fas fa-shield-alt" style="font-size:2.5rem;color:var(--purple);"></i>
          <h2 style="color:var(--navy);margin:.75rem 0 .25rem;font-size:1.3rem;">Admin Login</h2>
          <p style="color:var(--gray-600);font-size:.85rem;">NAHIMS SW Membership Portal</p>
        </div>
        <form id="adminLoginForm">
          <div class="form-group">
            <label>Email</label>
            <input type="email" id="adminEmail" placeholder="admin@nahimssw.org" style="width:100%;padding:.75rem;border:2px solid var(--gray-200);border-radius:8px;font-size:.9rem;font-family:inherit;outline:none;" />
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" id="adminPassword" placeholder="••••••••" style="width:100%;padding:.75rem;border:2px solid var(--gray-200);border-radius:8px;font-size:.9rem;font-family:inherit;outline:none;" />
          </div>
          <button type="submit" class="btn btn-navy" style="width:100%;justify-content:center;margin-top:1rem;">
            <i class="fas fa-sign-in-alt"></i> Login
          </button>
          <div id="adminLoginMsg" style="margin-top:1rem;font-size:.85rem;text-align:center;color:#c53030;"></div>
        </form>
      </div>
    </div>
    <link rel="stylesheet" href="style.css" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" />
  `;

  document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email    = document.getElementById('adminEmail').value.trim();
    const password = document.getElementById('adminPassword').value;
    const msg      = document.getElementById('adminLoginMsg');

    try {
      const res  = await fetch(`${API_BASE}/admin/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('nahims_admin_token', data.token);
        localStorage.setItem('nahims_admin_name',  data.username);
        window.location.reload();
      } else {
        msg.textContent = data.message || 'Login failed.';
      }
    } catch {
      msg.textContent = 'Network error. Please try again.';
    }
  });
}

/* ── Init Dashboard ─────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  if (!adminToken) return;

  const name = localStorage.getItem('nahims_admin_name') || 'Admin';
  const el   = document.getElementById('adminName');
  if (el) el.textContent = `Logged in as: ${name}`;

  await loadStats();
});

function showSection(section) {
  document.querySelectorAll('.section-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.admin-nav a').forEach(a => a.classList.remove('active'));
  document.getElementById(`section-${section}`).classList.add('active');
  document.getElementById(`nav-${section}`).classList.add('active');

  const titles = { overview:'Dashboard Overview', members:'Manage Members', payments:'Payment History', export:'Export Data' };
  document.getElementById('sectionTitle').textContent = titles[section] || '';

  if (section === 'members')  loadMembers();
  if (section === 'payments') loadPayments();
}

/* ── Stats ──────────────────────────────────────────────── */
async function loadStats() {
  try {
    const data = await adminFetch('/admin/stats');
    if (!data.success) return;
    const s = data.stats;
    document.getElementById('statTotal').textContent   = s.total;
    document.getElementById('statActive').textContent  = s.active;
    document.getElementById('statInactive').textContent = s.inactive;
    document.getElementById('statMonthly').textContent = s.monthly;
    document.getElementById('statAnnual').textContent  = s.annual;
    document.getElementById('statRevenue').textContent = `₦${Number(s.revenue).toLocaleString()}`;
  } catch (err) {
    console.error('loadStats error:', err);
  }
}

/* ── Members ─────────────────────────────────────────────── */
let allMembers = [];

async function loadMembers(search = '') {
  const tbody = document.getElementById('membersBody');
  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--gray-500);">Loading…</td></tr>';
  try {
    const data = await adminFetch(`/admin/members?search=${encodeURIComponent(search)}`);
    allMembers = data.members || [];
    renderMembers(allMembers);
  } catch (err) {
    console.error('loadMembers error:', err);
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--gray-500);">Error loading members.</td></tr>';
  }
}

function renderMembers(members) {
  const tbody = document.getElementById('membersBody');
  if (!members.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--gray-500);">No members found.</td></tr>';
    return;
  }
  tbody.innerHTML = members.map(m => `
    <tr>
      <td style="font-weight:600;font-size:.8rem;">${m.member_id}</td>
      <td>${m.full_name}</td>
      <td style="font-size:.82rem;">${m.email}</td>
      <td>${m.state}</td>
      <td><span class="badge ${m.sub_status || 'none'}">${m.sub_status || 'none'}</span></td>
      <td style="font-size:.8rem;">${m.subscription_end ? new Date(m.subscription_end).toLocaleDateString('en-NG') : '—'}</td>
      <td><span class="badge ${m.is_active ? 'active' : 'expired'}">${m.is_active ? 'Active' : 'Inactive'}</span></td>
      <td style="display:flex;gap:.4rem;flex-wrap:wrap;">
        <button class="action-btn" onclick="openEditModal(${JSON.stringify(m).replace(/"/g,'&quot;')})"><i class="fas fa-edit"></i></button>
        <button class="action-btn ${m.is_active ? 'danger' : ''}" onclick="toggleMember('${m.member_id}', ${m.is_active})">
          <i class="fas fa-${m.is_active ? 'ban' : 'check'}"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

function searchMembers(val) {
  clearTimeout(window._searchTimer);
  window._searchTimer = setTimeout(() => loadMembers(val), 350);
}

async function toggleMember(memberId, isActive) {
  const action = isActive ? 'deactivate' : 'activate';
  if (!confirm(`Are you sure you want to ${action} member ${memberId}?`)) return;
  try {
    const data = await adminFetch(`/admin/members/${memberId}/toggle`, 'PATCH');
    if (data.success) {
      showToast(`Member ${action}d successfully.`, 'success');
      loadMembers();
    } else {
      showToast(data.message || 'Error toggling member.', 'error');
    }
  } catch (err) {
    console.error('toggleMember error:', err);
    showToast('Network error.', 'error');
  }
}

/* ── Edit Modal ─────────────────────────────────────────── */
function openEditModal(member) {
  document.getElementById('editMemberId').value   = member.member_id;
  document.getElementById('editFullName').value   = member.full_name;
  document.getElementById('editPhone').value      = member.phone;
  document.getElementById('editState').value      = member.state;
  document.getElementById('editInstitution').value = member.institution;
  document.getElementById('editRole').value       = member.role;
  document.getElementById('editModal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('editModal').style.display = 'none';
  document.getElementById('editMessage').className = 'form-message';
  document.getElementById('editMessage').innerHTML = '';
}

document.getElementById('editForm') && document.getElementById('editForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const memberId = document.getElementById('editMemberId').value;
  const payload  = {
    fullName:    document.getElementById('editFullName').value.trim(),
    phone:       document.getElementById('editPhone').value.trim(),
    state:       document.getElementById('editState').value.trim(),
    institution: document.getElementById('editInstitution').value.trim(),
    role:        document.getElementById('editRole').value.trim(),
  };
  try {
    const data = await adminFetch(`/admin/members/${memberId}`, 'PUT', payload);
    if (data.success) {
      showEditMessage('<i class="fas fa-check-circle"></i> Member updated successfully.', 'success');
      loadMembers();
      setTimeout(closeModal, 1500);
    } else {
      showEditMessage(data.message || 'Update failed.', 'error');
    }
  } catch (err) {
    showEditMessage('Network error.', 'error');
  }
});

function showEditMessage(html, type) {
  const el = document.getElementById('editMessage');
  if (el) { el.className = 'form-message ' + type; el.innerHTML = html; }
}

/* ── Payments ────────────────────────────────────────────── */
async function loadPayments() {
  const tbody = document.getElementById('paymentsBody');
  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--gray-500);">Loading…</td></tr>';
  try {
    const data = await adminFetch('/admin/payments');
    if (!data.payments.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--gray-500);">No payments found.</td></tr>';
      return;
    }
    tbody.innerHTML = data.payments.map(p => `
      <tr>
        <td style="font-size:.8rem;">${new Date(p.payment_date).toLocaleDateString('en-NG')}</td>
        <td>${p.full_name}</td>
        <td style="font-size:.78rem;font-weight:600;">${p.member_id}</td>
        <td><span class="badge ${p.plan_type}">${p.plan_type}</span></td>
        <td style="text-align:center;">${p.months_paid}</td>
        <td style="font-weight:700;">₦${Number(p.amount).toLocaleString()}</td>
        <td style="font-size:.75rem;color:var(--gray-500);">${p.payment_reference}</td>
        <td><span class="badge ${p.payment_status}">${p.payment_status}</span></td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('loadPayments error:', err);
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--gray-500);">Error.</td></tr>';
  }
}

/* ── Export ──────────────────────────────────────────────── */
function exportMembers(e) {
  e.preventDefault();
  window.open(`${API_BASE}/admin/export/csv?token=${adminToken}`, '_blank');
}

/* ── Logout ──────────────────────────────────────────────── */
function adminLogout() {
  localStorage.removeItem('nahims_admin_token');
  localStorage.removeItem('nahims_admin_name');
  window.location.reload();
}

/* ── Helpers ─────────────────────────────────────────────── */
async function adminFetch(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${adminToken}`,
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res  = await fetch(`${API_BASE}${path}`, opts);
  if (res.status === 401) { adminLogout(); return {}; }
  return res.json();
}

function showToast(msg, type = 'info') {
  let t = document.getElementById('nahims-admin-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'nahims-admin-toast';
    t.style.cssText = 'position:fixed;bottom:2rem;right:2rem;z-index:99999;padding:.9rem 1.6rem;border-radius:50px;font-size:.88rem;font-family:"Poppins",sans-serif;font-weight:600;max-width:360px;box-shadow:0 8px 32px rgba(0,0,0,.25);transform:translateY(80px);opacity:0;transition:all .35s ease;display:flex;align-items:center;gap:.5rem;';
    document.body.appendChild(t);
  }
  const s = { success:{bg:'#2F855A',c:'#fff',i:'✓'}, error:{bg:'#C53030',c:'#fff',i:'✕'}, info:{bg:'#1E003E',c:'#fff',i:'ℹ'} };
  const st = s[type] || s.info;
  t.style.background = st.bg; t.style.color = st.c;
  t.innerHTML = `${st.i} ${msg}`;
  requestAnimationFrame(() => { t.style.transform = 'translateY(0)'; t.style.opacity = '1'; });
  setTimeout(() => { t.style.transform = 'translateY(80px)'; t.style.opacity = '0'; }, 5000);
}
