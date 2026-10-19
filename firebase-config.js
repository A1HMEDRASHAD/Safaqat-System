// ==========================================================================
// Safaqat System - Firebase Configuration & Super Admins Lock
// ==========================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { 
  getFirestore, 
  collection, 
  doc, 
  addDoc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
   onSnapshot, 
  query, 
  orderBy, 
  where, 
  increment, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// 1. إعدادات مشروع فايربيس الخاص بنظام صفقات
const firebaseConfig = {
  apiKey: "AIzaSyDtdAxJqFhc1nsViYRkMVw9FXzCKeYhT5I",
  authDomain: "safaqat-system.firebaseapp.com",
  projectId: "safaqat-system",
  storageBucket: "safaqat-system.firebasestorage.app",
  messagingSenderId: "847357037344",
  appId: "1:847357037344:web:fe71887332dfe8f35b2545",
  measurementId: "G-1KQB3XREKE"
};

// 2. القائمة الحديدية للإدارة العليا المطلقة (غير قابلة للحذف أو نزع الصلاحية)
export const SUPER_ADMINS = [
  "rawialshamal@gmail.com",
  "a1hmedrashad@gmail.com",
  "safaqatkitabiya@gmail.com"
];

// دالة مساعدة للتحقق هل البريد من الإدارة العليا المطلقة
export function isSuperAdminEmail(email) {
  if (!email) return false;
  return SUPER_ADMINS.includes(email.trim().toLowerCase());
}

// 3. تهيئة خدمات فايربيس
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
const db = getFirestore(app);

// تصدير الأدوات لاستخدامها في المحرك الرئيسي (app.js)
export {
  auth,
  googleProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  db,
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  increment,
  serverTimestamp
};
