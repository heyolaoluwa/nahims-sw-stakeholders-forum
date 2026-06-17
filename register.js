/* ============================================================
   register.js — NAHIMS SW Registration Page
   ============================================================ */
'use strict';

const API_BASE = 'https://himmedia.ng/NAHIMSAPI';

/* Redirect if already logged in */
if (localStorage.getItem('nahims_token')) {
  window.location.href = 'dashboard.html';
}

document.addEventListener('DOMContentLoaded', () => {

  /* Password visibility toggle */
  ['password', 'confirmPassword'].forEach(id => {
    const input = document.getElementById(id);
    if (!input) return;
    const wrap = input.parentElement;
    if (wrap.tagName !== 'DIV') return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.innerHTML = '<i class="fas fa-eye"></i>';
    btn.setAttribute('aria-label', 'Toggle password visibility');
    btn.style.cssText = 'position:absolute;right:.75rem;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--gray-500);font-size:.95rem;';
    wrap.style.position = 'relative';
    wrap.appendChild(btn);
    btn.addEventListener('click', () => {
      const shown = input.type === 'text';
      input.type = shown ? 'password' : 'text';
      btn.innerHTML = `<i class="fas fa-eye${shown ? '' : '-slash'}"></i>`;
    });
  });

  const form = document.getElementById('registerForm');
  const btn  = document.getElementById('registerBtn');

  form && form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!clientValidate()) return;

    const password        = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (password !== confirmPassword) {
      showFieldError('confirmPasswordError', 'Passwords do not match.');
      return;
    }

    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account…';
    btn.disabled  = true;

    const payload = {
      fullName:    document.getElementById('fullName').value.trim(),
      email:       document.getElementById('email').value.trim(),
      phone:       document.getElementById('phone').value.trim(),
      state:       document.getElementById('state').value,
      institution: document.getElementById('institution').value.trim(),
      role:        document.getElementById('role').value.trim(),
      interest:    document.getElementById('interest').value.trim(),
      password,
    };

    try {
      const res  = await fetch(`${API_BASE}/register`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        showFormMessage(
          `<i class="fas fa-check-circle"></i> Account created! Your Member ID is <strong>${data.memberId}</strong>. Redirecting to login…`,
          'success'
        );
        setTimeout(() => { window.location.href = 'login.html'; }, 3000);
      } else {
        showFormMessage(`<i class="fas fa-exclamation-circle"></i> ${data.message}`, 'error');
        btn.innerHTML = orig;
        btn.disabled  = false;
      }
    } catch (err) {
      console.error(err);
      showFormMessage('<i class="fas fa-exclamation-circle"></i> Network error. Please try again.', 'error');
      btn.innerHTML = orig;
      btn.disabled  = false;
    }
  });

  /* Real-time validation */
  form && form.querySelectorAll('input, select, textarea').forEach(f => {
    f.addEventListener('blur',  () => validateSingleField(f));
    f.addEventListener('input', () => clearFieldError(f));
  });
});

function clientValidate() {
  let ok = true;
  ['fullName','email','phone','state','institution','role','password','confirmPassword'].forEach(id => {
    const f = document.getElementById(id);
    if (f && !validateSingleField(f)) ok = false;
  });
  return ok;
}

function validateSingleField(field) {
  const val = field.value.trim();
  let msg = '';
  if (field.required && !val) {
    msg = 'This field is required.';
  } else if (field.type === 'email' && val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
    msg = 'Enter a valid email address.';
  } else if (field.type === 'tel' && val && !/^[\d\s\+\-\(\)]{7,15}$/.test(val)) {
    msg = 'Enter a valid phone number.';
  } else if (field.id === 'password' && val && val.length < 8) {
    msg = 'Password must be at least 8 characters.';
  }
  if (msg) {
    showFieldError(field.id + 'Error', msg);
    field.classList.add('error');
    return false;
  }
  clearFieldError(field);
  return true;
}

function showFieldError(errId, msg) {
  const el = document.getElementById(errId);
  if (el) { el.textContent = msg; el.classList.add('show'); }
}
function clearFieldError(field) {
  field.classList.remove('error');
  const el = document.getElementById(field.id + 'Error');
  if (el) el.classList.remove('show');
}
function showFormMessage(html, type) {
  const el = document.getElementById('formMessage');
  if (!el) return;
  el.className = 'form-message ' + type;
  el.innerHTML = html;
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
