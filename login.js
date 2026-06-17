/* ============================================================
   login.js — NAHIMS SW Login Page
   ============================================================ */
'use strict';

const API_BASE = 'https://himmedia.ng/NAHIMSAPI';

/* Redirect if already logged in */
if (localStorage.getItem('nahims_token')) {
  window.location.href = 'dashboard.html';
}

document.addEventListener('DOMContentLoaded', () => {

  /* Password toggle */
  const toggleBtn = document.getElementById('togglePwd');
  const pwdInput  = document.getElementById('password');
  if (toggleBtn && pwdInput) {
    toggleBtn.addEventListener('click', () => {
      const shown = pwdInput.type === 'text';
      pwdInput.type = shown ? 'password' : 'text';
      toggleBtn.innerHTML = `<i class="fas fa-eye${shown ? '' : '-slash'}"></i>`;
    });
  }

  const form = document.getElementById('loginForm');
  const btn  = document.getElementById('loginBtn');

  form && form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
      showFormMessage('<i class="fas fa-exclamation-circle"></i> Please enter your email and password.', 'error');
      return;
    }

    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in…';
    btn.disabled  = true;

    try {
      const res  = await fetch(`${API_BASE}/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (data.success) {
        localStorage.setItem('nahims_token',  data.token);
        localStorage.setItem('nahims_member', JSON.stringify(data.member));
        window.location.href = 'dashboard.html';
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
});

function showFormMessage(html, type) {
  const el = document.getElementById('formMessage');
  if (!el) return;
  el.className = 'form-message ' + type;
  el.innerHTML = html;
}
