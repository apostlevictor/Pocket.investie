// ===== FIREBASE CONFIGURATION =====
const firebaseConfig = {
  apiKey: "AIzaSyA5LqCUYEaAX5lR5x25D7nxu63loA-goFc",
  authDomain: "pocket-investie-412fe.firebaseapp.com",
  projectId: "pocket-investie-412fe",
  storageBucket: "pocket-investie-412fe.firebasestorage.app",
  messagingSenderId: "218119968222",
  appId: "1:218119968222:web:522cc4142df3a90cb0'USD'
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const functions = firebase.functions();

// ===== GLOBAL VARIABLES =====
let currentUser = null;
let userData = null;

// ===== UTILITY FUNCTIONS =====
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'NGN'
  }).format(amount);
}

function showAlert(message, type = 'success') {
  const alertBox = document.createElement('div');
  alertBox.className = `alert alert-${type}`;
  alertBox.textContent = message;
  document.body.appendChild(alertBox);
  
  setTimeout(() => {
    alertBox.remove();
  }, 3000);
}

// ===== AUTHENTICATION FUNCTIONS =====
function initAuth() {
  // Only run on auth.html
  if (!document.getElementById('auth-form')) return;
  
  const authForm = document.getElementById('auth-form');
  const loginTab = document.getElementById('login-tab');
  const registerTab = document.getElementById('register-tab');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  
  // Tab switching
  loginTab.addEventListener('click', () => {
    loginTab.classList.add('active');
    registerTab.classList.remove('active');
    loginForm.classList.remove('d-none');
    registerForm.classList.add('d-none');
  });
  
  registerTab.addEventListener('click', () => {
    registerTab.classList.add('active');
    loginTab.classList.remove('active');
    registerForm.classList.remove('d-none');
    loginForm.classList.add('d-none');
  });
  
  // Login handler
  document.getElementById('login-btn').addEventListener('click', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    try {
      const userCredential = await auth.signInWithEmailAndPassword(email, password);
      window.location.href = 'dashboard.html';
    } catch (error) {
      showAlert(error.message, 'danger');
    }
  });
  
  // Registration handler
  document.getElementById('register-btn').addEventListener('click', async (e) => {
    e.preventDefault();
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    
    try {
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      
      // Create user document in Firestore
      await db.collection('users').doc(userCredential.user.uid).set({
        name,
        email,
        balance: 0,
        investments: [],
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      window.location.href = 'dashboard.html';
    } catch (error) {
      showAlert(error.message, 'danger');
    }
  });
}

// ===== DASHBOARD FUNCTIONS =====
function initDashboard() {
  // Only run on dashboard.html
  if (!document.getElementById('dashboard')) return;
  
  // DOM Elements
  const balanceElement = document.getElementById('user-balance');
  const investmentsList = document.getElementById('investments-list');
  const depositBtn = document.getElementById('deposit-btn');
  const withdrawBtn = document.getElementById('withdraw-btn');
  const investBtn = document.getElementById('invest-btn');
  
  // Navigation
  depositBtn.addEventListener('click', () => window.location.href = 'deposit.html');
  withdrawBtn.addEventListener('click', () => window.location.href = 'withdraw.html');
  investBtn.addEventListener('click', () => window.location.href = 'invest.html');
  
  // Load user data
  loadUserData();
  
  // Load investment plans
  loadInvestmentPlans();
  
  // Load recent transactions
  loadRecentTransactions();
}

async function loadUserData() {
  if (!currentUser) return;
  
  const userDoc = await db.collection('users').doc(currentUser.uid).get();
  userData = userDoc.data();
  
  // Update UI
  document.getElementById('user-balance').textContent = formatCurrency(userData.balance);
  document.getElementById('user-name').textContent = userData.name;
}

async function loadInvestmentPlans() {
  const plansContainer = document.getElementById('investment-plans');
  if (!plansContainer) return;
  
  const plansSnapshot = await db.collection('investment_plans').get();
  
  plansSnapshot.forEach(doc => {
    const plan = doc.data();
    const planCard = document.createElement('div');
    planCard.className = 'plan-card';
    planCard.innerHTML = `
      <div class="plan-header">
        <h3>${plan.name}</h3>
        <div class="plan-returns">${plan.returnRate}% return</div>
      </div>
      <div class="plan-body">
        <p>Duration: ${plan.duration} days</p>
        <p>Minimum: ${formatCurrency(plan.minAmount)}</p>
        <p>Maximum: ${formatCurrency(plan.maxAmount)}</p>
      </div>
      <button class="btn btn-primary invest-plan-btn" data-id="${doc.id}">Invest Now</button>
    `;
    
    plansContainer.appendChild(planCard);
  });
  
  // Add event listeners to invest buttons
  document.querySelectorAll('.invest-plan-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const planId = e.target.dataset.id;
      localStorage.setItem('selectedPlanId', planId);
      window.location.href = 'invest.html';
    });
  });
}

async function loadRecentTransactions() {
  const transactionsList = document.getElementById('transactions-list');
  if (!transactionsList) return;
  
  const transactionsSnapshot = await db.collection('transactions')
    .where('userId', '==', currentUser.uid)
    .orderBy('timestamp', 'desc')
    .limit(5)
    .get();
  
  transactionsSnapshot.forEach(doc => {
    const transaction = doc.data();
    const transactionItem = document.createElement('div');
    transactionItem.className = 'transaction-item';
    
    transactionItem.innerHTML = `
      <div class="transaction-info">
        <div class="transaction-type">${transaction.type}</div>
        <div class="transaction-date">${new Date(transaction.timestamp.toDate()).toLocaleDateString()}</div>
      </div>
      <div class="transaction-amount ${transaction.type}">${formatCurrency(transaction.amount)}</div>
    `;
    
    transactionsList.appendChild(transactionItem);
  });
}

// ===== DEPOSIT FUNCTIONS =====
function initDeposit() {
  // Only run on deposit.html
  if (!document.getElementById('deposit-form')) return;
  
  const depositForm = document.getElementById('deposit-form');
  const amountInput = document.getElementById('deposit-amount');
  
  depositForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = parseFloat(amountInput.value);
    
    if (amount < 2000) {
      showAlert('Minimum deposit amount is ₦2000', 'danger');
      return;
    }
    
    try {
      // Create transaction record
      await db.collection('transactions').add({
        userId: currentUser.uid,
        type: 'deposit',
        amount: amount,
        status: 'pending',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      showAlert(`Deposit request for ${formatCurrency(amount)} submitted successfully!`, 'success');
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 3000);
    } catch (error) {
      showAlert('Deposit failed: ' + error.message, 'danger');
    }
  });
}

// ===== WITHDRAWAL FUNCTIONS =====
function initWithdraw() {
  // Only run on withdraw.html
  if (!document.getElementById('withdraw-form')) return;
  
  const withdrawForm = document.getElementById('withdraw-form');
  const amountInput = document.getElementById('withdraw-amount');
  
  withdrawForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = parseFloat(amountInput.value);
    
    if (amount < 2000) {
      showAlert('Minimum withdrawal amount is ₦2000', 'danger');
      return;
    }
    
    if (amount > userData.balance) {
      showAlert('Insufficient balance', 'danger');
      return;
    }
    
    try {
      // Create withdrawal record
      await db.collection('withdrawals').add({
        userId: currentUser.uid,
        amount: amount,
        status: 'pending',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      // Deduct from user balance
      await db.collection('users').doc(currentUser.uid).update({
        balance: firebase.firestore.FieldValue.increment(-amount)
      });
      
      showAlert(`Withdrawal request for ${formatCurrency(amount)} submitted successfully!`, 'success');
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 3000);
    } catch (error) {
      showAlert('Withdrawal failed: ' + error.message, 'danger');
    }
  });
}

// ===== INVESTMENT FUNCTIONS =====
function initInvest() {
  // Only run on invest.html
  if (!document.getElementById('investment-form')) return;
  
  const planId = localStorage.getItem('selectedPlanId');
  if (!planId) {
    window.location.href = 'dashboard.html';
    return;
  }
  
  const investmentForm = document.getElementById('investment-form');
  const amountInput = document.getElementById('investment-amount');
  
  // Load plan details
  loadPlanDetails(planId);
  
  investmentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = parseFloat(amountInput.value);
    
    const planDoc = await db.collection('investment_plans').doc(planId).get();
    const plan = planDoc.data();
    
    if (amount < plan.minAmount) {
      showAlert(`Minimum investment for this plan is ${formatCurrency(plan.minAmount)}`, 'danger');
      return;
    }
    
    if (amount > plan.maxAmount) {
      showAlert(`Maximum investment for this plan is ${formatCurrency(plan.maxAmount)}`, 'danger');
      return;
    }
    
    if (amount > userData.balance) {
      showAlert('Insufficient balance', 'danger');
      return;
    }
    
    try {
      // Create investment
      await db.collection('investments').add({
        userId: currentUser.uid,
        planId: planId,
        planName: plan.name,
        amount: amount,
        returnRate: plan.returnRate,
        startDate: firebase.firestore.FieldValue.serverTimestamp(),
        endDate: new Date(Date.now() + plan.duration * 24 * 60 * 60 * 1000),
        status: 'active'
      });
      
      // Deduct from user balance
      await db.collection('users').doc(currentUser.uid).update({
        balance: firebase.firestore.FieldValue.increment(-amount)
      });
      
      // Create transaction record
      await db.collection('transactions').add({
        userId: currentUser.uid,
        type: 'investment',
        amount: amount,
        status: 'completed',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      showAlert(`Investment of ${formatCurrency(amount)} in ${plan.name} started successfully!`, 'success');
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 3000);
    } catch (error) {
      showAlert('Investment failed: ' + error.message, 'danger');
    }
  });
}

async function loadPlanDetails(planId) {
  const planDoc = await db.collection('investment_plans').doc(planId).get();
  if (!planDoc.exists) {
    window.location.href = 'dashboard.html';
    return;
  }
  
  const plan = planDoc.data();
  document.getElementById('plan-name').textContent = plan.name;
  document.getElementById('plan-return').textContent = `${plan.returnRate}% return`;
  document.getElementById('plan-duration').textContent = `${plan.duration} days`;
  document.getElementById('min-amount').textContent = formatCurrency(plan.minAmount);
  document.getElementById('max-amount').textContent = formatCurrency(plan.maxAmount);
}

// ===== PROFILE FUNCTIONS =====
function initProfile() {
  // Only run on profile.html
  if (!document.getElementById('profile-form')) return;
  
  const profileForm = document.getElementById('profile-form');
  const nameInput = document.getElementById('profile-name');
  const emailInput = document.getElementById('profile-email');
  
  // Pre-fill form with user data
  nameInput.value = userData.name || '';
  emailInput.value = userData.email || '';
  
  profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    
    try {
      await db.collection('users').doc(currentUser.uid).update({ name });
      showAlert('Profile updated successfully!', 'success');
    } catch (error) {
      showAlert('Failed to update profile: ' + error.message, 'danger');
    }
  });
}

// ===== ADMIN DASHBOARD FUNCTIONS =====
function initAdminDashboard() {
  // Only run on admin_dashboard.html
  if (!document.getElementById('admin-dashboard')) return;
  
  // Logout button
  document.getElementById('logout-btn').addEventListener('click', () => {
    auth.signOut().then(() => {
      window.location.href = 'auth.html';
    });
  });
  
  // Load admin data
  loadAdminStats();
  loadPendingWithdrawals();
  loadPendingKYC();
}

async function loadAdminStats() {
  const usersSnapshot = await db.collection('users').count().get();
  document.getElementById('total-users').textContent = usersSnapshot.data().count;
  
  const investmentsSnapshot = await db.collection('investments').where('status', '==', 'active').get();
  let totalInvestments = 0;
  investmentsSnapshot.forEach(doc => {
    totalInvestments += doc.data().amount;
  });
  document.getElementById('total-investments').textContent = formatCurrency(totalInvestments);
  
  const withdrawalsSnapshot = await db.collection('withdrawals').where('status', '==', 'pending').count().get();
  document.getElementById('pending-withdrawals').textContent = withdrawalsSnapshot.data().count;
  
  const kycSnapshot = await db.collection('kyc').where('status', '==', 'pending').count().get();
  document.getElementById('kyc-requests').textContent = kycSnapshot.data().count;
}

async function loadPendingWithdrawals() {
  const tableBody = document.getElementById('withdrawals-table-body');
  if (!tableBody) return;
  
  const withdrawalsSnapshot = await db.collection('withdrawals')
    .where('status', '==', 'pending')
    .orderBy('timestamp', 'desc')
    .get();
  
  withdrawalsSnapshot.forEach(doc => {
    const withdrawal = doc.data();
    const row = document.createElement('tr');
    
    row.innerHTML = `
      <td>${doc.id.substring(0, 8)}</td>
      <td>${withdrawal.userName || withdrawal.userId}</td>
      <td>${formatCurrency(withdrawal.amount)}</td>
      <td>${new Date(withdrawal.timestamp.toDate()).toLocaleDateString()}</td>
      <td>
        <button class="btn btn-sm btn-success approve-withdrawal" data-id="${doc.id}">Approve</button>
        <button class="btn btn-sm btn-danger reject-withdrawal" data-id="${doc.id}">Reject</button>
      </td>
    `;
    
    tableBody.appendChild(row);
  });
  
  // Add event listeners to buttons
  document.querySelectorAll('.approve-withdrawal').forEach(btn => {
    btn.addEventListener('click', (e) => processWithdrawal(e.target.dataset.id, 'approved'));
  });
  
  document.querySelectorAll('.reject-withdrawal').forEach(btn => {
    btn.addEventListener('click', (e) => processWithdrawal(e.target.dataset.id, 'rejected'));
  });
}

async function processWithdrawal(withdrawalId, action) {
  try {
    await db.collection('withdrawals').doc(withdrawalId).update({ status: action });
    showAlert(`Withdrawal ${action} successfully!`, 'success');
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  } catch (error) {
    showAlert(`Failed to ${action} withdrawal: ${error.message}`, 'danger');
  }
}

async function loadPendingKYC() {
  const tableBody = document.getElementById('kyc-table-body');
  if (!tableBody) return;
  
  const kycSnapshot = await db.collection('kyc')
    .where('status', '==', 'pending')
    .orderBy('submittedAt', 'desc')
    .get();
  
  kycSnapshot.forEach(doc => {
    const kyc = doc.data();
    const row = document.createElement('tr');
    
    row.innerHTML = `
      <td>${kyc.userName || kyc.userId}</td>
      <td>${new Date(kyc.submittedAt.toDate()).toLocaleDateString()}</td>
      <td>${kyc.documentType}</td>
      <td>
        <button class="btn btn-sm btn-success approve-kyc" data-id="${doc.id}">Approve</button>
        <button class="btn btn-sm btn-danger reject-kyc" data-id="${doc.id}">Reject</button>
        <button class="btn btn-sm btn-info view-kyc" data-id="${doc.id}">View</button>
      </td>
    `;
    
    tableBody.appendChild(row);
  });
  
  // Add event listeners to buttons
  document.querySelectorAll('.approve-kyc').forEach(btn => {
    btn.addEventListener('click', (e) => processKYC(e.target.dataset.id, 'approved'));
  });
  
  document.querySelectorAll('.reject-kyc').forEach(btn => {
    btn.addEventListener('click', (e) => processKYC(e.target.dataset.id, 'rejected'));
  });
}

async function processKYC(kycId, action) {
  try {
    await db.collection('kyc').doc(kycId).update({ status: action });
    
    // Update user KYC status
    const kycDoc = await db.collection('kyc').doc(kycId).get();
    const userId = kycDoc.data().userId;
    
    await db.collection('users').doc(userId).update({ 
      kycStatus: action,
      kycVerified: action === 'approved'
    });
    
    showAlert(`KYC ${action} successfully!`, 'success');
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  } catch (error) {
    showAlert(`Failed to ${action} KYC: ${error.message}`, 'danger');
  }
}

// ===== MAIN INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
  // Initialize authentication state listener
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      currentUser = user;
      
      // For protected pages, load user data
      if (!['index.html', 'auth.html'].includes(window.location.pathname.split('/').pop())) {
        const userDoc = await db.collection('users').doc(user.uid).get();
        
        if (userDoc.exists) {
          userData = userDoc.data();
          
          // Initialize page-specific functionality
          initAuth();
          initDashboard();
          initDeposit();
          initWithdraw();
          initInvest();
          initProfile();
          initAdminDashboard();
        } else {
          // New user without profile data
          auth.signOut();
          window.location.href = 'auth.html';
        }
      }
    } else {
      // Redirect to auth if not on public pages
      if (!['index.html', 'auth.html'].includes(window.location.pathname.split('/').pop())) {
        window.location.href = 'auth.html';
      } else {
        // Initialize public pages
        initAuth();
      }
    }
  });
});
