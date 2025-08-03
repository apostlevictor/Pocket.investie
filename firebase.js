// firebase.js - Pocket-Investie Firebase Integration

// Firebase App (the core Firebase SDK) must be listed first
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js";

// Add Firebase products you want to use
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/9.6.0/firebase-auth.js";

import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  onSnapshot,
  increment,
  serverTimestamp,
  Timestamp
} from "https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js";

import { 
  getFunctions, 
  httpsCallable 
} from "https://www.gstatic.com/firebasejs/9.6.0/firebase-functions.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA5LqCUYEaAX5lR5x25D7nxu63loA-goFc",
  authDomain: "pocket-investie-412fe.firebaseapp.com",
  projectId: "pocket-investie-412fe",
  storageBucket: "pocket-investie-412fe.firebasestorage.app",
  messagingSenderId: "218119968222",
  appId: "1:218119968222:web:522cc4142df3a90cb0f94f",
  measurementId: "G-Z4QQ0NC2QM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);

// =====================
// Authentication Service
// =====================

/**
 * Register a new user with additional details
 * @param {string} name - User's full name
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @param {string} phone - User's phone number
 * @param {string} country - User's country
 * @returns {Promise} - Firebase user credential
 */
export const registerUser = async (name, email, password, phone, country) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // Create detailed user document in Firestore
    await setDoc(doc(db, "users", userCredential.user.uid), {
      uid: userCredential.user.uid,
      name,
      email,
      phone,
      country,
      balance: 0,
      totalInvested: 0,
      totalWithdrawn: 0,
      totalEarnings: 0,
      referralCode: generateReferralCode(),
      kycStatus: "pending", // pending, verified, rejected
      accountStatus: "active", // active, suspended, banned
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
      isAdmin: false,
      lastInvestmentDate: null,
      walletAddress: "",
      bankDetails: {
        bankName: "",
        accountNumber: "",
        accountName: ""
      }
    };
    
    return userCredential;
  } catch (error) {
    throw error;
  }
};

// Generate a unique referral code
function generateReferralCode() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

/**
 * Login a user and update last login time
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @returns {Promise} - Firebase user credential
 */
export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    
    // Update last login time
    await updateDoc(doc(db, "users", userCredential.user.uid), {
      lastLogin: serverTimestamp()
    });
    
    return userCredential;
  } catch (error) {
    throw error;
  }
};

/**
 * Logout current user
 */
export const logoutUser = async () => {
  await signOut(auth);
};

/**
 * Reset user password
 * @param {string} email - User's email
 */
export const resetPassword = async (email) => {
  await sendPasswordResetEmail(auth, email);
};

/**
 * Listen for authentication state changes
 * @param {Function} callback - Function to call when auth state changes
 */
export const onAuthStateChange = (callback) => {
  return onAuthStateChanged(auth, callback);
};

// =====================
// User Profile Service
// =====================

/**
 * Get user document by ID
 * @param {string} userId - User ID
 * @returns {Promise} - User document data
 */
export const getUser = async (userId) => {
  const docRef = doc(db, "users", userId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data() : null;
};

/**
 * Update user profile
 * @param {string} userId - User ID
 * @param {Object} data - Data to update
 */
export const updateUserProfile = async (userId, data) => {
  await updateDoc(doc(db, "users", userId), data);
};

/**
 * Update user bank details
 * @param {string} userId - User ID
 * @param {Object} bankDetails - Bank details object
 */
export const updateBankDetails = async (userId, bankDetails) => {
  await updateDoc(doc(db, "users", userId), {
    bankDetails: bankDetails
  });
};

/**
 * Update user wallet address
 * @param {string} userId - User ID
 * @param {string} walletAddress - Crypto wallet address
 */
export const updateWalletAddress = async (userId, walletAddress) => {
  await updateDoc(doc(db, "users", userId), {
    walletAddress: walletAddress
  });
};

// =====================
// Transaction Service
// =====================

/**
 * Create a new deposit request
 * @param {string} userId - User ID
 * @param {number} amount - Deposit amount
 * @param {string} method - Payment method (bank, crypto, etc.)
 * @param {string} transactionId - External transaction ID
 * @returns {Promise} - Firestore document ID
 */
export const createDeposit = async (userId, amount, method, transactionId) => {
  const transactionRef = await addDoc(collection(db, "transactions"), {
    userId,
    type: "deposit",
    amount,
    method,
    transactionId,
    status: "pending", // pending, completed, failed
    createdAt: serverTimestamp(),
    processedAt: null,
    adminNote: ""
  });
  
  return transactionRef.id;
};

/**
 * Create a withdrawal request
 * @param {string} userId - User ID
 * @param {number} amount - Withdrawal amount
 * @param {string} method - Withdrawal method (bank, crypto, etc.)
 * @returns {Promise} - Firestore document ID
 */
export const createWithdrawal = async (userId, amount, method) => {
  const transactionRef = await addDoc(collection(db, "transactions"), {
    userId,
    type: "withdrawal",
    amount,
    method,
    status: "pending",
    createdAt: serverTimestamp(),
    processedAt: null,
    adminNote: ""
  });
  
  // Deduct from user balance immediately
  await updateDoc(doc(db, "users", userId), {
    balance: increment(-amount)
  });
  
  return transactionRef.id;
};

/**
 * Get user transactions
 * @param {string} userId - User ID
 * @param {number} limit - Number of transactions to retrieve
 * @returns {Promise} - Array of transactions
 */
export const getUserTransactions = async (userId, limit = 20) => {
  const transactions = [];
  const q = query(
    collection(db, "transactions"), 
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(limit)
  );
  
  const querySnapshot = await getDocs(q);
  querySnapshot.forEach(doc => {
    transactions.push({ id: doc.id, ...doc.data() });
  });
  
  return transactions;
};

// =====================
// Investment Service
// =====================

/**
 * Get investment plans
 * @returns {Promise} - Array of investment plans
 */
export const getInvestmentPlans = async () => {
  const plans = [];
  const querySnapshot = await getDocs(collection(db, "investment_plans"));
  querySnapshot.forEach(doc => {
    plans.push({ id: doc.id, ...doc.data() });
  });
  return plans;
};

/**
 * Create a new investment
 * @param {string} userId - User ID
 * @param {string} planId - Investment plan ID
 * @param {number} amount - Investment amount
 * @returns {Promise} - Investment ID
 */
export const createInvestment = async (userId, planId, amount) => {
  const planDoc = await getDoc(doc(db, "investment_plans", planId));
  if (!planDoc.exists()) throw new Error("Investment plan not found");
  
  const plan = planDoc.data();
  
  // Calculate maturity date
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(startDate.getDate() + plan.duration);
  
  const investmentRef = await addDoc(collection(db, "investments"), {
    userId,
    planId,
    planName: plan.name,
    amount,
    returnRate: plan.returnRate,
    expectedReturn: amount * (plan.returnRate / 100),
    startDate: Timestamp.fromDate(startDate),
    endDate: Timestamp.fromDate(endDate),
    status: "active", // active, completed, cancelled
    createdAt: serverTimestamp(),
    lastPayout: null,
    payouts: []
  });
  
  // Deduct from user balance
  await updateDoc(doc(db, "users", userId), {
    balance: increment(-amount),
    totalInvested: increment(amount),
    lastInvestmentDate: serverTimestamp()
  });
  
  return investmentRef.id;
};

/**
 * Get user investments
 * @param {string} userId - User ID
 * @returns {Promise} - Array of investments
 */
export const getUserInvestments = async (userId) => {
  const investments = [];
  const q = query(
    collection(db, "investments"), 
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );
  
  const querySnapshot = await getDocs(q);
  querySnapshot.forEach(doc => {
    investments.push({ id: doc.id, ...doc.data() });
  });
  
  return investments;
};

// =====================
// KYC Service
// =====================

/**
 * Submit KYC documents
 * @param {string} userId - User ID
 * @param {Object} documents - KYC documents
 * @param {string} documents.idFront - URL of front ID image
 * @param {string} documents.idBack - URL of back ID image
 * @param {string} documents.selfie - URL of selfie with ID
 * @param {string} documentType - Type of ID (passport, driver's license, etc.)
 * @param {string} documentNumber - ID number
 * @returns {Promise} - KYC submission ID
 */
export const submitKYC = async (userId, documents, documentType, documentNumber) => {
  const kycRef = await addDoc(collection(db, "kyc_submissions"), {
    userId,
    documentType,
    documentNumber,
    documents,
    status: "pending", // pending, approved, rejected
    submittedAt: serverTimestamp(),
    reviewedAt: null,
    adminNote: ""
  });
  
  // Update user KYC status
  await updateDoc(doc(db, "users", userId), {
    kycStatus: "pending"
  });
  
  return kycRef.id;
};

// =====================
// Referral Service
// =====================

/**
 * Apply referral code
 * @param {string} userId - User ID
 * @param {string} referralCode - Referral code to apply
 * @returns {Promise} - Success status
 */
export const applyReferralCode = async (userId, referralCode) => {
  // Find user with this referral code
  const q = query(collection(db, "users"), where("referralCode", "==", referralCode));
  const querySnapshot = await getDocs(q);
  
  if (querySnapshot.empty) throw new Error("Invalid referral code");
  
  const referrer = querySnapshot.docs[0].data();
  
  // Add referral relationship
  await setDoc(doc(db, "referrals", `${referrer.uid}_${userId}`), {
    referrerId: referrer.uid,
    referredId: userId,
    appliedAt: serverTimestamp(),
    bonusPaid: false
  });
  
  // Update referrer's referral count
  await updateDoc(doc(db, "users", referrer.uid), {
    referralCount: increment(1)
  });
  
  // Add bonus to new user
  await updateDoc(doc(db, "users", userId), {
    balance: increment(10), // $10 signup bonus
    bonusFromReferral: true
  });
  
  return true;
};

// =====================
// Admin Service
// =====================

/**
 * Get all users (admin only)
 * @returns {Promise} - Array of users
 */
export const getAllUsers = async () => {
  const users = [];
  const querySnapshot = await getDocs(collection(db, "users"));
  querySnapshot.forEach(doc => {
    users.push({ id: doc.id, ...doc.data() });
  });
  return users;
};

/**
 * Update user account status (admin only)
 * @param {string} userId - User ID
 * @param {string} status - New status (active, suspended, banned)
 * @param {string} reason - Reason for status change
 */
export const updateUserStatus = async (userId, status, reason) => {
  await updateDoc(doc(db, "users", userId), { 
    accountStatus: status,
    statusChangeReason: reason,
    statusChangedAt: serverTimestamp()
  });
};

/**
 * Get pending transactions (admin only)
 * @returns {Promise} - Array of pending transactions
 */
export const getPendingTransactions = async () => {
  const transactions = [];
  const q = query(
    collection(db, "transactions"), 
    where("status", "==", "pending"),
    orderBy("createdAt", "desc")
  );
  
  const querySnapshot = await getDocs(q);
  querySnapshot.forEach(doc => {
    transactions.push({ id: doc.id, ...doc.data() });
  });
  
  return transactions;
};

/**
 * Approve a transaction (admin only)
 * @param {string} transactionId - Transaction ID
 * @param {string} note - Admin note
 */
export const approveTransaction = async (transactionId, note) => {
  const transactionRef = doc(db, "transactions", transactionId);
  const transactionSnap = await getDoc(transactionRef);
  
  if (!transactionSnap.exists()) throw new Error("Transaction not found");
  
  const transaction = transactionSnap.data();
  
  // Update transaction status
  await updateDoc(transactionRef, { 
    status: "completed",
    processedAt: serverTimestamp(),
    adminNote: note
  });
  
  // For deposits, add to user balance
  if (transaction.type === "deposit") {
    await updateDoc(doc(db, "users", transaction.userId), {
      balance: increment(transaction.amount)
    });
  }
};

/**
 * Reject a transaction (admin only)
 * @param {string} transactionId - Transaction ID
 * @param {string} note - Admin note
 */
export const rejectTransaction = async (transactionId, note) => {
  const transactionRef = doc(db, "transactions", transactionId);
  const transactionSnap = await getDoc(transactionRef);
  
  if (!transactionSnap.exists()) throw new Error("Transaction not found");
  
  const transaction = transactionSnap.data();
  
  // Update transaction status
  await updateDoc(transactionRef, { 
    status: "rejected",
    processedAt: serverTimestamp(),
    adminNote: note
  });
  
  // For withdrawals, return funds to user balance
  if (transaction.type === "withdrawal") {
    await updateDoc(doc(db, "users", transaction.userId), {
      balance: increment(transaction.amount)
    });
  }
};

/**
 * Get pending KYC submissions (admin only)
 * @returns {Promise} - Array of KYC submissions
 */
export const getPendingKYC = async () => {
  const submissions = [];
  const q = query(
    collection(db, "kyc_submissions"), 
    where("status", "==", "pending"),
    orderBy("submittedAt", "desc")
  );
  
  const querySnapshot = await getDocs(q);
  querySnapshot.forEach(doc => {
    submissions.push({ id: doc.id, ...doc.data() });
  });
  
  return submissions;
};

/**
 * Process KYC submission (admin only)
 * @param {string} submissionId - KYC submission ID
 * @param {string} status - New status (approved, rejected)
 * @param {string} note - Admin note
 */
export const processKYC = async (submissionId, status, note) => {
  const submissionRef = doc(db, "kyc_submissions", submissionId);
  const submissionSnap = await getDoc(submissionRef);
  
  if (!submissionSnap.exists()) throw new Error("KYC submission not found");
  
  const submission = submissionSnap.data();
  
  // Update KYC submission
  await updateDoc(submissionRef, { 
    status: status,
    reviewedAt: serverTimestamp(),
    adminNote: note
  });
  
  // Update user KYC status
  await updateDoc(doc(db, "users", submission.userId), {
    kycStatus: status
  });
};

// =====================
// Real-time Listeners
// =====================

/**
 * Listen for user data changes
 * @param {string} userId - User ID
 * @param {Function} callback - Function to call when data changes
 * @returns {Function} - Unsubscribe function
 */
export const onUserDataChange = (userId, callback) => {
  return onSnapshot(doc(db, "users", userId), (doc) => {
    if (doc.exists()) {
      callback(doc.data());
    }
  });
};

/**
 * Listen for user transactions
 * @param {string} userId - User ID
 * @param {Function} callback - Function to call when transactions change
 * @returns {Function} - Unsubscribe function
 */
export const onUserTransactionsChange = (userId, callback) => {
  const q = query(
    collection(db, "transactions"), 
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(20)
  );
  
  return onSnapshot(q, (snapshot) => {
    const transactions = [];
    snapshot.forEach(doc => {
      transactions.push({ id: doc.id, ...doc.data() });
    });
    callback(transactions);
  });
};

/**
 * Listen for user investments
 * @param {string} userId - User ID
 * @param {Function} callback - Function to call when investments change
 * @returns {Function} - Unsubscribe function
 */
export const onUserInvestmentsChange = (userId, callback) => {
  const q = query(
    collection(db, "investments"), 
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );
  
  return onSnapshot(q, (snapshot) => {
    const investments = [];
    snapshot.forEach(doc => {
      investments.push({ id: doc.id, ...doc.data() });
    });
    callback(investments);
  });
};

// =====================
// Helper Functions
// =====================

/**
 * Format currency
 * @param {number} amount - Amount to format
 * @returns {string} - Formatted currency string
 */
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
};

/**
 * Format date
 * @param {Date} date - Date to format
 * @returns {string} - Formatted date string
 */
export const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Calculate days remaining for an investment
 * @param {Date} endDate - Investment end date
 * @returns {number} - Days remaining
 */
export const calculateDaysRemaining = (endDate) => {
  const now = new Date();
  const end = new Date(endDate);
  const diffTime = end - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Calculate return on investment
 * @param {number} amount - Investment amount
 * @param {number} returnRate - Return rate percentage
 * @param {number} days - Number of days invested
 * @returns {number} - Calculated return
 */
export const calculateROI = (amount, returnRate, days) => {
  const dailyRate = returnRate / 36500; // Convert to daily decimal
  return amount * dailyRate * days;
};

// =====================
// Admin Authentication
// =====================

// Special admin login function
export const adminLogin = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = await getUser(userCredential.user.uid);
    
    if (!user.isAdmin) {
      await signOut(auth);
      throw new Error("Access denied. Admin privileges required.");
    }
    
    return userCredential;
  } catch (error) {
    throw error;
  }
};

// Check if user is admin
export const isAdmin = async (userId) => {
  const user = await getUser(userId);
  return user && user.isAdmin;
};
