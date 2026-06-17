/* ============================================================
   NAHIMS SW STAKEHOLDERS FORUM — script.js  v2.0
   Flutterwave INLINE popup — now backed by MySQL API
   ============================================================ */

const CONFIG = {
  // ⚠️ Replace with your live Flutterwave PUBLIC key
  FLW_PUBLIC_KEY: 'FLWPUBK-395ccf450326f007990d9bd823ea5230-X',

  PLANS: {
    monthly: { label: 'Monthly', amount: 600,  currency: 'NGN' },
    annual:  { label: 'Annual',  amount: 6000, currency: 'NGN' },
  },

  // ⚠️ Set to your backend URL if hosted separately, otherwise keep as '/api'
  API_BASE:    'https://himmedia.ng/NAHIMSAPI',
  FORUM_EMAIL: 'nahimsstakeholders@gmail.com',
  FORUM_NAME:  'NAHIMS SW Stakeholders Forum',
};

/* ── State ── */
let paymentVerified   = false;
let paymentReference  = '';
let selectedPlan      = '';  // 'monthly' | 'annual'
let registeredMember  = null; // set after successful registration

/* ════════════════════════════════════════
   STICKY NAV + HAMBURGER + ACTIVE LINK
════════════════════════════════════════ */
(function initNav() {
  const navbar    = document.querySelector('.navbar');
  const hamburger = document.querySelector('.hamburger');
  const mobileNav = document.querySelector('.mobile-nav');

  if (navbar) {
    window.addEventListener('scroll', () => {
      navbar.classList.toggle('scrolled', window.scrollY > 30);
    });
  }

  if (hamburger && mobileNav) {
    hamburger.addEventListener('click', () => {
      const open = hamburger.classList.toggle('open');
      mobileNav.classList.toggle('open', open);
      hamburger.setAttribute('aria-expanded', String(open));
    });
    mobileNav.querySelectorAll('a').forEach(l => {
      l.addEventListener('click', () => {
        hamburger.classList.remove('open');
        mobileNav.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  const page = window.location.pathname.split('/').pop() || 'stake.html';
  document.querySelectorAll('.nav-links a, .mobile-nav a').forEach(l => {
    if (l.getAttribute('href') === page) l.classList.add('active');
  });
})();

/* ════════════════════════════════════════
   SCROLL REVEAL
════════════════════════════════════════ */
(function initScrollReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  els.forEach(el => obs.observe(el));
})();

/* ════════════════════════════════════════
   LIGHTBOX (Gallery page)
════════════════════════════════════════ */
(function initLightbox() {
  const lightbox = document.getElementById('lightbox');
  if (!lightbox) return;
  const content  = lightbox.querySelector('.lightbox-content');
  const closeBtn = lightbox.querySelector('.lightbox-close');
  const prevBtn  = lightbox.querySelector('.lightbox-prev');
  const nextBtn  = lightbox.querySelector('.lightbox-next');
  const items    = Array.from(document.querySelectorAll('.gallery-item'));
  let current    = 0;

  function open(i) {
    current = i;
    const item = items[i];
    const src  = item.dataset.src;
    const alt  = item.dataset.alt || 'Gallery image';
    content.innerHTML = src
      ? `<img src="${src}" alt="${alt}">`
      : `<div class="lightbox-placeholder"><i class="fas fa-image"></i><span>${alt}</span></div>`;
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function close() { lightbox.classList.remove('open'); document.body.style.overflow = ''; }
  function nav(dir) { open((current + dir + items.length) % items.length); }

  items.forEach((item, i) => {
    item.addEventListener('click', () => open(i));
    item.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') open(i); });
  });
  closeBtn && closeBtn.addEventListener('click', close);
  prevBtn  && prevBtn.addEventListener('click', () => nav(-1));
  nextBtn  && nextBtn.addEventListener('click', () => nav(1));
  lightbox.addEventListener('click', e => { if (e.target === lightbox) close(); });
  document.addEventListener('keydown', e => {
    if (!lightbox.classList.contains('open')) return;
    if (e.key === 'Escape')     close();
    if (e.key === 'ArrowLeft')  nav(-1);
    if (e.key === 'ArrowRight') nav(1);
  });
})();

/* ════════════════════════════════════════
   FLUTTERWAVE INLINE POPUP
   Called when user clicks a plan pay button
════════════════════════════════════════ */
function launchFlutterwave(plan) {
  const emailQuickInput = document.getElementById('emailQuick');
  const emailInput      = document.getElementById('email');
  const nameInput       = document.getElementById('fullName');
  const phoneInput      = document.getElementById('phone');

  let email = '';
  if (emailQuickInput && emailQuickInput.value.trim()) {
    email = emailQuickInput.value.trim();
    if (emailInput) emailInput.value = email;
  } else if (emailInput && emailInput.value.trim()) {
    email = emailInput.value.trim();
    if (emailQuickInput) emailQuickInput.value = email;
  }

  const name  = nameInput  ? nameInput.value.trim()  : '';
  const phone = phoneInput ? phoneInput.value.trim() : '';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast('Please enter a valid email address first.', 'error');
    if (emailQuickInput) emailQuickInput.focus();
    return;
  }

  const planData = CONFIG.PLANS[plan];
  selectedPlan   = plan;

  document.querySelectorAll('.plan-card').forEach(c => c.classList.remove('selected'));
  const card = document.getElementById(plan + 'Card');
  if (card) card.classList.add('selected');

  // Generate tx_ref — backend will match this after payment
  const txRef = `NAHIMS-${plan.toUpperCase()}-GUEST-${Date.now()}`;

  FlutterwaveCheckout({
    public_key:      CONFIG.FLW_PUBLIC_KEY,
    tx_ref:          txRef,
    amount:          planData.amount,
    currency:        planData.currency,
    payment_options: 'card,ussd,banktransfer',
    customer: {
      email:        email,
      phone_number: phone || '',
      name:         name  || '',
    },
    customizations: {
      title:       CONFIG.FORUM_NAME,
      description: planData.label + ' Membership — ' + (plan === 'monthly' ? '₦600' : '₦6,000'),
      logo:        '',
    },
    callback: function (response) {
      if (response.status === 'successful' || response.status === 'completed') {
        paymentVerified  = true;
        paymentReference = String(response.transaction_id || response.flw_ref || ('NAHIMS-' + Date.now()));
        onPaymentSuccess(plan, paymentReference, txRef);
      } else {
        showToast('Payment was not completed. Please try again.', 'error');
      }
    },
    onclose: function () {
      if (!paymentVerified) {
        showToast('Payment window closed. Select a plan and try again when ready.', 'info');
      }
    },
  });
}

/* Called after Flutterwave confirms payment */
function onPaymentSuccess(plan, transactionId, txRef) {
  const confirmedBar = document.getElementById('paymentConfirmedBar');
  const submitBtn    = document.getElementById('submitBtn');
  const planLabel    = CONFIG.PLANS[plan].label;
  const planAmount   = plan === 'monthly' ? '₦600' : '₦6,000';

  if (confirmedBar) {
    confirmedBar.innerHTML = `
      <i class="fas fa-check-circle"></i>
      <span>
        <strong>${planLabel} plan payment confirmed</strong> (${planAmount}).
        Reference: <code>${txRef}</code>
      </span>`;
    confirmedBar.classList.add('show');
    confirmedBar.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Store tx_ref for backend verification after registration
  paymentReference = txRef;
  window._flwTransactionId = transactionId;

  if (submitBtn) submitBtn.disabled = false;
  showToast('Payment successful! Please complete your registration below.', 'success');

  setTimeout(() => {
    const form = document.getElementById('membershipForm');
    if (form) form.scrollIntoView({ behavior: 'smooth' });
  }, 500);
}

/* ════════════════════════════════════════
   PAY BUTTONS — wire up on load
════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  const payMonthly = document.getElementById('payMonthlyBtn');
  const payAnnual  = document.getElementById('payAnnualBtn');
  if (payMonthly) payMonthly.addEventListener('click', () => launchFlutterwave('monthly'));
  if (payAnnual)  payAnnual.addEventListener('click',  () => launchFlutterwave('annual'));
});

/* ════════════════════════════════════════
   MEMBERSHIP REGISTRATION FORM — now posts to MySQL API
════════════════════════════════════════ */
function initMembershipForm() {
  const form = document.getElementById('membershipForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!paymentVerified) {
      showToast('Please complete payment before submitting.', 'error');
      document.getElementById('planSection') &&
        document.getElementById('planSection').scrollIntoView({ behavior: 'smooth' });
      return;
    }

    if (!validateForm(form)) {
      showToast('Please fill in all required fields correctly.', 'error');
      return;
    }

    const submitBtn = document.getElementById('submitBtn');
    const orig      = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting…';
    submitBtn.disabled  = true;

    const payload = {
      fullName:    document.getElementById('fullName').value.trim(),
      email:       document.getElementById('email').value.trim(),
      phone:       document.getElementById('phone').value.trim(),
      state:       document.getElementById('state').value.trim(),
      institution: document.getElementById('institution').value.trim(),
      role:        document.getElementById('role').value.trim(),
      interest:    document.getElementById('interest').value.trim(),
      plan:        selectedPlan,
      paymentRef:  paymentReference,
      transactionId: window._flwTransactionId || '',
    };

    try {
      // Step 1: Register member
      const regRes  = await fetch(`${CONFIG.API_BASE}/register`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          fullName:    payload.fullName,
          email:       payload.email,
          phone:       payload.phone,
          state:       payload.state,
          institution: payload.institution,
          role:        payload.role,
          interest:    payload.interest,
          password:    generateTempPassword(), // auto-generated, user resets via login
        }),
      });
      const regData = await regRes.json();

      if (!regData.success && regRes.status !== 409) {
        // 409 = already exists — allow flow to continue to save payment
        showFormMessage(
          `<i class="fas fa-exclamation-circle"></i> Registration failed: ${regData.message}`,
          'error'
        );
        submitBtn.innerHTML = orig;
        submitBtn.disabled  = false;
        return;
      }

      const memberId = regData.memberId;

      showFormMessage(
        `<i class="fas fa-check-circle"></i> Registration successful! <strong>Member ID: ${memberId}</strong>. <br>
         You can now <a href="login.html" style="color:var(--purple);font-weight:600;">login to your dashboard</a> to manage payments. 
         A temporary password has been sent — please change it after login.`,
        'success'
      );

      form.reset();
      paymentVerified  = false;
      paymentReference = '';
      selectedPlan     = '';
      submitBtn.disabled = true;
      document.querySelectorAll('.plan-card').forEach(c => c.classList.remove('selected'));
      const bar = document.getElementById('paymentConfirmedBar');
      if (bar) bar.classList.remove('show');

    } catch (err) {
      console.error(err);
      showFormMessage(
        `<i class="fas fa-exclamation-circle"></i> Submission failed. Please try again or email ${CONFIG.FORUM_EMAIL}`,
        'error'
      );
      submitBtn.innerHTML = orig;
      submitBtn.disabled  = false;
    }
  });

  form.querySelectorAll('input, select, textarea').forEach(field => {
    field.addEventListener('blur',  () => validateField(field));
    field.addEventListener('input', () => {
      field.classList.remove('error');
      const err = document.getElementById(field.id + 'Error');
      if (err) err.classList.remove('show');
    });
  });
}

/* Generate a simple temp password for new registrations from ship.html */
function generateTempPassword() {
  return 'NAHIMS@' + Math.random().toString(36).slice(2, 10).toUpperCase();
}

function validateForm(form) {
  let ok = true;
  form.querySelectorAll('[required]').forEach(f => { if (!validateField(f)) ok = false; });
  return ok;
}

function validateField(field) {
  const errEl = document.getElementById(field.id + 'Error');
  const val   = field.value.trim();
  let msg = '';
  if (field.required && !val) {
    msg = 'This field is required.';
  } else if (field.type === 'email' && val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
    msg = 'Please enter a valid email address.';
  } else if (field.type === 'tel' && val && !/^[\d\s\+\-\(\)]{7,15}$/.test(val)) {
    msg = 'Please enter a valid phone number.';
  }
  if (msg) {
    field.classList.add('error');
    if (errEl) { errEl.textContent = msg; errEl.classList.add('show'); }
    return false;
  }
  field.classList.remove('error');
  if (errEl) errEl.classList.remove('show');
  return true;
}

function showFormMessage(html, type) {
  const el = document.getElementById('formMessage');
  if (!el) return;
  el.className = 'form-message ' + type;
  el.innerHTML = html;
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ════════════════════════════════════════
   TOAST NOTIFICATION
════════════════════════════════════════ */
function showToast(msg, type = 'info') {
  let t = document.getElementById('nahims-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'nahims-toast';
    t.style.cssText = `
      position:fixed; bottom:2rem; right:2rem; z-index:99999;
      padding:.9rem 1.6rem; border-radius:50px; font-size:.88rem;
      font-family:'Poppins',sans-serif; font-weight:600; max-width:380px;
      box-shadow:0 8px 32px rgba(0,0,0,.25); transform:translateY(80px); opacity:0;
      transition:all .35s cubic-bezier(0.4,0,0.2,1);
      display:flex; align-items:center; gap:.6rem;
    `;
    document.body.appendChild(t);
  }
  const s = {
    success: { bg: '#2F855A', c: '#fff', i: '✓' },
    error:   { bg: '#C53030', c: '#fff', i: '✕' },
    info:    { bg: '#1E003E', c: '#fff', i: 'ℹ' },
  };
  const st = s[type] || s.info;
  t.style.background = st.bg;
  t.style.color      = st.c;
  t.innerHTML        = `${st.i} ${msg}`;
  requestAnimationFrame(() => { t.style.transform = 'translateY(0)'; t.style.opacity = '1'; });
  setTimeout(() => { t.style.transform = 'translateY(80px)'; t.style.opacity = '0'; }, 5000);
}

/* ════════════════════════════════════════
   COUNTER ANIMATION
════════════════════════════════════════ */
function initCounters() {
  const counters = document.querySelectorAll('[data-counter]');
  if (!counters.length) return;
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el     = e.target;
      const target = parseInt(el.dataset.counter);
      const suffix = el.dataset.suffix || '';
      let start;
      const step = ts => {
        if (!start) start = ts;
        const p = Math.min((ts - start) / 1800, 1);
        el.textContent = Math.floor((1 - Math.pow(1 - p, 3)) * target).toLocaleString() + suffix;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      obs.unobserve(el);
    });
  }, { threshold: 0.5 });
  counters.forEach(c => obs.observe(c));
}

/* ── Init on DOM ready ── */
document.addEventListener('DOMContentLoaded', () => {
  initMembershipForm();
  initCounters();

  const quickEmail = document.getElementById('emailQuick');
  const formEmail  = document.getElementById('email');
  if (quickEmail && formEmail) {
    quickEmail.addEventListener('input', () => { formEmail.value = quickEmail.value; });
    formEmail.addEventListener('input',  () => { quickEmail.value = formEmail.value; });
  }
});
