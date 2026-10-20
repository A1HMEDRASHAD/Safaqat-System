// ==========================================================================
// Safaqat ERP System - Firebase Config, Hidden Super Admins & ImgBB Engine
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
  where,
  increment,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// 1. إعدادات مشروع فايربيس (Safaqat System)
const firebaseConfig = {
  apiKey: "AIzaSyDtdAxJqFhc1nsViYRkMVw9FXzCKeYhT5I",
  authDomain: "safaqat-system.firebaseapp.com",
  projectId: "safaqat-system",
  storageBucket: "safaqat-system.firebasestorage.app",
  messagingSenderId: "847357037344",
  appId: "1:847357037344:web:fe71887332dfe8f35b2545",
  measurementId: "G-1KQB3XREKE"
};

// 2. القائمة الخفية للإدارة العليا المطلقة (لا تظهر في واجهة الموظفين أبداً)
const HIDDEN_SUPER_ADMINS = [
  "rawialshamal@gmail.com",
  "a1hmedrashad@gmail.com",
  "safaqatkitabiya@gmail.com"
];

export function isSuperAdminEmail(email) {
  if (!email) return false;
  return HIDDEN_SUPER_ADMINS.includes(email.trim().toLowerCase());
}

// 3. مفتاح منصة ImgBB لضغط ورفع الصور والإيصالات تلقائياً
const IMGBB_API_KEY = "8daac9827176202a80700d2e41aaebd8";

/**
 * دالة تضغط الصورة تلقائياً لتقليل حجمها وتسريع الرفع ثم ترفعها إلى ImgBB
 */
export async function compressAndUploadImage(file, maxWidth = 900, quality = 0.78) {
  if (!file) return null;

  const compressedBase64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        // استخراج كود Base64 الصافي بدون البادئة
        const base64String = dataUrl.split(",")[1];
        resolve(base64String);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });

  const formData = new FormData();
  formData.append("key", IMGBB_API_KEY);
  formData.append("image", compressedBase64);

  const response = await fetch("https://api.imgbb.com/1/upload", {
    method: "POST",
    body: formData
  });

  const result = await response.json();
  if (result && result.success && result.data && result.data.url) {
    return result.data.url;
  } else {
    throw new Error("فشل رفع الصورة إلى السيرفر");
  }
}

/**
 * دالة ذكية لتحويل أي رابط ملف من Google Drive إلى رابط عرض مدمج + رابط تحميل مباشر
 */
export function parseGoogleDriveUrl(rawUrl) {
  if (!rawUrl || !rawUrl.trim()) return null;
  const url = rawUrl.trim();

  // استخراج معرف الملف (File ID) من روابط جوجل درايف المختلفة
  const match = url.match(/[-\w]{25,}/);
  if (match && match[0]) {
    const fileId = match[0];
    return {
      fileId,
      previewUrl: `https://drive.google.com/file/d/${fileId}/preview`,
      downloadUrl: `https://drive.google.com/uc?export=download&id=${fileId}`,
      originalUrl: url
    };
  }

  return {
    fileId: null,
    previewUrl: url,
    downloadUrl: url,
    originalUrl: url
  };
}

// 4. تهيئة خدمات فايربيس
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
const db = getFirestore(app);

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
  where,
  increment,
  serverTimestamp
};
