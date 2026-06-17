'use strict';

const API_BASE = 'https://himmedia.ng/NAHIMSAPI';
const FLW_PUBLIC_KEY = 'FLWPUBK-395ccf450326f007990d9bd823ea5230-X';
const MONTHLY_RATE = 600;
const ANNUAL_RATE = 6000;

const token = localStorage.getItem('nahims_token');
if (!token) {
  window.location.href = 'login.html';
}

let currentPlan = 'monthly';
let memberData = null;
let paymentStatusData = null;
let pendingTxRef = null;

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('nahims_token');
    localStorage.removeItem('nahims_member');
    window.location.href = 'login.html';
  });

  await loadProfile();
  await loadPaymentStatus();
  await loadPayments();
  updateAmount();
});

async function loadProfile() {
  try {
    const res = await fetch(API_BASE + '/member', {
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    if (!data.success) {
      if (res.status === 401) { logout(); return; }
      return;
    }
    memberData = data.member;
    const firstName = memberData.full_name.split(' ')[0];
    document.getElementById('welcomeName').textContent = firstName;
    document.getElementById('navMemberName').textContent = memberData.full_name;
    document.getElementById('sidebarName').textContent = memberData.full_name;
    document.getElementById('sidebarMemberId').textContent = memberData.member_id;
    document.getElementById('avatarInitial').textContent = memberData.full_name.charAt(0).toUpperCase();
    document.getElementById('statMemberId').textContent = memberData.member_id;
    document.getElementById('pFullName').textContent = memberData.full_name;
    document.getElementById('pEmail').textContent = memberData.email;
    document.getElementById('pPhone').textContent = memberData.phone;
    document.getElementById('pState').textContent = memberData.state;
    document.getElementById('pInstitution').textContent = memberData.institution;
    document.getElementById('pRole').textContent = memberData.role;
  } catch (err) {
    console.error('loadProfile error:', err);
  }
}

async function loadPaymentStatus() {
  try {
    const res = await fetch(API_BASE + '/payment-status', {
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    if (!data.success) return;

    paymentStatusData = data.status;
    const s = data.status;

    // Update status badge
    const statusColor = s.isActive ? 'active' : (s.monthsPaid > 0 ? 'pending' : 'none');
    const statusLabel = s.isActive ? 'Active' : (s.monthsPaid > 0 ? 'Arrears Owed' : 'Not Subscribed');
    document.getElementById('statStatus').innerHTML = '<span class="status-badge ' + statusColor + '">' + statusLabel + '</span>';
    document.getElementById('statSubEnd').textContent = s.isActive
      ? new Date(s.subscriptionEnd).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'Not active';

    // Show arrears warning if owing
    const paymentSection = document.getElementById('payment');
    let arrearsHtml = '';
    if (!s.isActive && s.monthsOwed > 0) {
      arrearsHtml = `
        <div style="background:#fff3cd;border:1px solid #ffc107;border-radius:10px;padding:1.25rem;margin-bottom:1.25rem;">
          <h4 style="color:#856404;margin:0 0 .5rem;font-size:.95rem;">
            <i class="fas fa-exclamation-triangle"></i> Arrears Outstanding
          </h4>
          <p style="color:#856404;margin:0 0 .75rem;font-size:.88rem;">
            Your subscription runs from <strong>${s.oweFrom}</strong>. 
            You owe <strong>${s.monthsOwed} month(s)</strong> totalling <strong>₦${s.arrearsAmount.toLocaleString()}</strong>.
            Membership will only be activated when all arrears are cleared.
          </p>
          <p style="color:#856404;margin:0;font-size:.85rem;">
            <i class="fas fa-info-circle"></i> You can pay in instalments but your account stays <strong>pending</strong> until fully paid.
          </p>
        </div>`;

      // Set minimum months to arrears owed
      const monthsInput = document.getElementById('monthsInput');
      if (monthsInput) {
        monthsInput.min = 1;
        monthsInput.placeholder = 'Min 1 month';
      }

      // Show suggested payment = full arrears
      const suggestBtn = document.createElement('button');
      suggestBtn.className = 'pay-btn';
      suggestBtn.style.cssText = 'background:#ffc107;color:#000;margin-bottom:1rem;';
      suggestBtn.innerHTML = '<i class="fas fa-exclamation-circle"></i> Pay All Arrears Now — ₦' + s.arrearsAmount.toLocaleString();
      suggestBtn.onclick = () => {
        currentPlan = 'monthly';
        document.getElementById('btnMonthly').classList.add('active');
        document.getElementById('btnAnnual').classList.remove('active');
        document.getElementById('monthsRow').style.display = 'flex';
        document.getElementById('monthsInput').value = s.monthsOwed;
        updateAmount();
      };

      const payCard = document.querySelector('#payment .card');
      const payBtn  = document.getElementById('payNowBtn');
      if (payCard && payBtn) payCard.insertBefore(suggestBtn, payBtn);
    }

    // Insert arrears warning at top of payment section
    const card = document.querySelector('#payment .card');
    if (card && arrearsHtml) {
      card.insertAdjacentHTML('afterbegin', arrearsHtml);
    }

    // Update payment section message
    document.getElementById('statSubEnd').textContent = s.isActive
      ? new Date(s.subscriptionEnd).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
      : s.monthsPaid > 0
        ? 'Pending — ₦' + s.arrearsAmount.toLocaleString() + ' arrears owed'
        : 'Not subscribed';

  } catch (err) {
    console.error('loadPaymentStatus error:', err);
  }
}

async function loadPayments() {
  const tbody = document.getElementById('paymentsBody');
  try {
    const res = await fetch(API_BASE + '/payments', {
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    if (!data.payments || !data.payments.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--gray-500);">No payments yet.</td></tr>';
      return;
    }
    tbody.innerHTML = data.payments.map(p => `
      <tr>
        <td>${new Date(p.payment_date).toLocaleDateString('en-NG')}</td>
        <td><span class="badge ${p.plan_type}">${p.plan_type}</span></td>
        <td>${p.months_paid}</td>
        <td style="font-weight:700;">₦${Number(p.amount).toLocaleString()}</td>
        <td style="font-size:.78rem;color:var(--gray-500);">${p.payment_reference}</td>
        <td><span class="badge ${p.payment_status}">${p.payment_status}</span></td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('loadPayments error:', err);
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--gray-500);">Error loading payments.</td></tr>';
  }
}

function selectPlan(plan) {
  currentPlan = plan;
  document.getElementById('btnMonthly').classList.toggle('active', plan === 'monthly');
  document.getElementById('btnAnnual').classList.toggle('active', plan === 'annual');
  document.getElementById('monthsRow').style.display = plan === 'monthly' ? 'flex' : 'none';
  document.getElementById('annualInfo').style.display = plan === 'annual' ? 'block' : 'none';
  updateAmount();
}

function updateAmount() {
  const months = parseInt(document.getElementById('monthsInput').value) || 1;
  const amount = currentPlan === 'annual' ? ANNUAL_RATE : months * MONTHLY_RATE;
  document.getElementById('amountDisplay').textContent = '₦' + amount.toLocaleString();
  document.getElementById('payBtnAmount').textContent = '₦' + amount.toLocaleString();
}

async function initiateDashboardPayment() {
  if (!memberData) { alert('Profile not loaded yet. Please wait.'); return; }

  const months = currentPlan === 'annual' ? 12 : (parseInt(document.getElementById('monthsInput').value) || 1);
  const amount = currentPlan === 'annual' ? ANNUAL_RATE : months * MONTHLY_RATE;

  const btn = document.getElementById('payNowBtn');
  const orig = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparing…';
  btn.disabled = true;

  try {
    const res = await fetch(API_BASE + '/create-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ planType: currentPlan, months })
    });
    const data = await res.json();
    if (!data.success) {
      alert(data.message || 'Error creating payment.');
      btn.innerHTML = orig; btn.disabled = false;
      return;
    }
    pendingTxRef = data.txRef;
    FlutterwaveCheckout({
      public_key: FLW_PUBLIC_KEY,
      tx_ref: pendingTxRef,
      amount: data.amount,
      currency: 'NGN',
      payment_options: 'card,ussd,banktransfer',
      customer: {
        email: memberData.email,
        phone_number: memberData.phone || '',
        name: memberData.full_name,
      },
      customizations: {
        title: 'NAHIMS SW Stakeholders Forum',
        description: currentPlan + ' Subscription — ' + data.monthsPaid + ' month(s)',
        logo: '',
      },
      callback: async (response) => {
        if (response.status === 'successful' || response.status === 'completed') {
          await handlePaymentCallback(response);
        } else {
          alert('Payment was not completed. Please try again.');
          btn.innerHTML = orig; btn.disabled = false;
        }
      },
      onclose: () => { btn.innerHTML = orig; btn.disabled = false; },
    });
  } catch (err) {
    console.error('initiateDashboardPayment error:', err);
    alert('Network error. Please try again.');
    btn.innerHTML = orig; btn.disabled = false;
  }
}

async function handlePaymentCallback(response) {
  const bar = document.getElementById('paymentBar');
  bar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying payment…';
  bar.classList.add('show');
  try {
    const res = await fetch(API_BASE + '/verify-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ transaction_id: response.transaction_id, tx_ref: pendingTxRef })
    });
    const data = await res.json();
    if (data.success) {
      if (data.isActive) {
        bar.innerHTML = '<i class="fas fa-check-circle"></i> <strong>Membership Active!</strong> Subscription valid until ' +
          new Date(data.subscriptionEnd).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' });
        bar.style.background = 'rgba(47,133,90,.12)';
        bar.style.color = '#2f855a';
      } else {
        bar.innerHTML = '<i class="fas fa-info-circle"></i> Payment recorded. You still owe <strong>' +
          data.monthsOwed + ' month(s) (₦' + data.arrearsAmount.toLocaleString() + ')</strong> to activate membership.';
        bar.style.background = 'rgba(255,193,7,.12)';
        bar.style.color = '#856404';
      }
      await loadProfile();
      await loadPaymentStatus();
      await loadPayments();
      document.getElementById('payNowBtn').innerHTML = '<i class="fas fa-lock"></i> Pay Now — <span id="payBtnAmount">₦600</span>';
      document.getElementById('payNowBtn').disabled = false;
      updateAmount();
    } else {
      bar.innerHTML = '<i class="fas fa-times-circle"></i> Verification failed: ' + data.message;
      bar.style.background = 'rgba(197,48,48,.12)';
      bar.style.color = '#c53030';
      document.getElementById('payNowBtn').innerHTML = '<i class="fas fa-lock"></i> Pay Now';
      document.getElementById('payNowBtn').disabled = false;
    }
  } catch (err) {
    console.error('verify error:', err);
    alert('Verification network error. Contact admin.');
    document.getElementById('payNowBtn').innerHTML = '<i class="fas fa-lock"></i> Pay Now';
    document.getElementById('payNowBtn').disabled = false;
  }
}

function logout() {
  localStorage.removeItem('nahims_token');
  localStorage.removeItem('nahims_member');
  window.location.href = 'login.html';
}
