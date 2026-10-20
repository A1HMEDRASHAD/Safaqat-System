// ==========================================================================
// Safaqat Kitabiya ERP - All-in-One Master Engine (3-File Architecture)
// Embedded Firebase + Dynamic PWA + Auto-Save Drafts + 8 Granular Permissions
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

// ==========================================================================
// 1. الإعدادات المركزية، الشعارات الرسمية، والحاكم الخفي (Firebase & Branding)
// ==========================================================================
const firebaseConfig = {
  apiKey: "AIzaSyDtdAxJqFhc1nsViYRkMVw9FXzCKeYhT5I",
  authDomain: "safaqat-system.firebaseapp.com",
  projectId: "safaqat-system",
  storageBucket: "safaqat-system.firebasestorage.app",
  messagingSenderId: "847357037344",
  appId: "1:847357037344:web:fe71887332dfe8f35b2545",
  measurementId: "G-1KQB3XREKE"
};

// الإيميلات الثلاثة للإدارة العليا المطلقة (مخفية تماماً عن واجهة الموظفين)
const HIDDEN_SUPER_ADMINS = [
  "rawialshamal@gmail.com",
  "a1hmedrashad@gmail.com",
  "safaqatkitabiya@gmail.com"
];

function isSuperAdminEmail(email) {
  if (!email) return false;
  return HIDDEN_SUPER_ADMINS.includes(email.trim().toLowerCase());
}

const IMGBB_API_KEY = "8daac9827176202a80700d2e41aaebd8";

// توليد نسخة SVG مدمجة عالية الدقة مطابقة لشعار الأيقونة وشعار الموقع لضمان عمل الروابط دائماً
const APP_ICON_SVG = `data:image/svg+xml;utf8,` + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
  <rect width="240" height="240" rx="44" fill="#fbf9f5"/>
  <text x="28" y="168" font-family="Arial, sans-serif" font-weight="900" font-size="122" fill="#3f3f46">$</text>
  <path d="M128 38 C138 58 142 75 130 92 L142 115 L125 138 L125 98 M125 138 C148 105 188 95 208 135 L214 152 L132 152 C118 175 90 195 55 182 C38 176 26 164 20 156 C42 170 82 184 114 152 Z" fill="#b91c1c"/>
  <circle cx="125" cy="112" r="5" fill="#fbf9f5"/>
</svg>`);

const SITE_LOGO_SVG = `data:image/svg+xml;utf8,` + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 180">
  <rect width="520" height="180" rx="18" fill="#050608"/>
  <text x="330" y="68" text-anchor="end" font-family="Tajawal, Arial" font-weight="800" font-size="40" fill="#facc15">صفقات كتابية</text>
  <text x="330" y="102" text-anchor="end" font-family="Tajawal, Arial" font-weight="700" font-size="24" fill="#fde047">للنشر والتوزيع</text>
  <text x="330" y="128" text-anchor="end" font-family="monospace" font-weight="700" font-size="19" fill="#fef08a">safaqat-kitabia</text>
  <text x="250" y="162" text-anchor="end" font-family="Arial, sans-serif" font-weight="900" font-style="italic" font-size="34" fill="#f59e0b">system</text>
  <path d="M395 25 C406 42 408 58 398 74 L410 96 L392 118 L392 82 M392 118 C414 88 452 80 472 116 L478 132 L398 132 C382 154 352 170 315 156 C295 148 282 138 274 130 C298 144 342 156 378 128 Z" fill="#facc15"/>
  <circle cx="392" cy="94" r="4.5" fill="#050608"/>
</svg>`);

// تهيئة فايربيس
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
const db = getFirestore(app);

// ==========================================================================
// 2. دمج تطبيق الويب (PWA Manifest) وتفعيل الشعارات والوضع الليلي
// ==========================================================================
function setupEmbeddedBrandingAndPWA() {
  // معالجة روابط ibb.co لضمان عدم ظهور أيقونة صورة مكسورة أبداً
  document.querySelectorAll(".js-app-icon").forEach((img) => {
    img.onerror = () => { img.src = APP_ICON_SVG; };
    if (img.src.includes("ibb.co/bMJHDmfg")) img.src = APP_ICON_SVG;
  });

  document.querySelectorAll(".js-site-logo").forEach((img) => {
    img.onerror = () => { img.src = SITE_LOGO_SVG; };
    if (img.src.includes("ibb.co/39hSSp9t")) img.src = SITE_LOGO_SVG;
  });

  const fav = document.getElementById("app-favicon");
  const touchIcon = document.getElementById("apple-touch-icon");
  if (fav) fav.href = APP_ICON_SVG;
  if (touchIcon) touchIcon.href = APP_ICON_SVG;

  // إنشاء ملف Manifest.json ديناميكياً داخل الكود (بدون الحاجة لملف خارجي)
  const dynamicManifest = {
    name: "نظام صفقات كتابية | الإدارة المالية والتعاقدات",
    short_name: "نظام صفقات",
    description: "النظام الداخلي لتوثيق المبيعات والعقود المالية لدار صفقات كتابية",
    start_url: window.location.href.split("?")[0],
    display: "standalone",
    background_color: "#090a0d",
    theme_color: "#090a0d",
    dir: "rtl",
    lang: "ar",
    icons: [
      { src: APP_ICON_SVG, sizes: "192x192", type: "image/svg+xml", purpose: "any maskable" },
      { src: APP_ICON_SVG, sizes: "512x512", type: "image/svg+xml", purpose: "any maskable" }
    ]
  };

  const blob = new Blob([JSON.stringify(dynamicManifest)], { type: "application/json" });
  const manifestURL = URL.createObjectURL(blob);
  let linkEl = document.querySelector('link[rel="manifest"]');
  if (!linkEl) {
    linkEl = document.createElement("link");
    linkEl.rel = "manifest";
    document.head.appendChild(linkEl);
  }
  linkEl.href = manifestURL;

  // استعادة الوضع الليلي / النهاري المحفوظ
  const savedTheme = localStorage.getItem("safaqat_theme") || "light";
  applyTheme(savedTheme);
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("safaqat_theme", theme);
  const icon = document.getElementById("theme-toggle-icon");
  if (icon) {
    icon.className = theme === "dark" ? "ri-sun-fill" : "ri-moon-clear-line";
    icon.style.color = theme === "dark" ? "#facc15" : "";
  }
}

document.getElementById("btn-theme-toggle").addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  applyTheme(current);
  renderMainChart();
});

setupEmbeddedBrandingAndPWA();

// ==========================================================================
// 3. حالة النظام المركزية ومصفوفة الصلاحيات الـ 8 (Application State)
// ==========================================================================
const DEFAULT_PERMS = {
  sell: true,
  addBook: true,
  deleteBook: true,
  authors: true,
  payouts: true,
  expenses: true,
  financeView: true,
  reports: true
};

const state = {
  currentUser: null,
  userEmail: "",
  userRole: null, // 'super_admin' | 'employee' | 'author'
  permissions: { ...DEFAULT_PERMS },
  userProfile: {
    displayName: "",
    avatarUrl: APP_ICON_SVG
  },
  currentAuthorProfile: null,
  selectedAuthorDetailId: null,
  inspectingStaffEmail: null,
  previousViewBeforePdf: "view-contracts",

  authors: [],
  books: [],
  sales: [],
  expenses: [],
  payouts: [],
  staff: [],
  notifications: [],
  activityLogs: [],

  chartInstance: null,
  currentChartType: "bar",
  confirmCallback: null,
  deferredPwaPrompt: null,
  unsubscribers: []
};

// ==========================================================================
// 4. محرك الحفظ المؤقت التلقائي في المتصفح (LocalStorage Draft Auto-Save)
// ==========================================================================
const DRAFT_PREFIX = "safaqat_draft_";
const DRAFT_VIEW_KEY = "safaqat_active_draft_view";

function initAutoSaveDrafts() {
  document.querySelectorAll("[data-draft]").forEach((input) => {
    const key = input.getAttribute("data-draft");
    const savedVal = localStorage.getItem(DRAFT_PREFIX + key);
    if (savedVal !== null && input.value === "") {
      input.value = savedVal;
    }

    input.addEventListener("input", () => {
      localStorage.setItem(DRAFT_PREFIX + key, input.value);
      const parentView = input.closest(".app-view");
      if (parentView && parentView.id) {
        localStorage.setItem(DRAFT_VIEW_KEY, parentView.id);
      }
    });
  });

  // أزرار مسح المسودة يدوياً
  document.querySelectorAll(".js-clear-draft").forEach((btn) => {
    btn.addEventListener("click", () => {
      const prefix = btn.getAttribute("data-prefix");
      clearFormDraftByPrefix(prefix);
      const form = btn.closest("form");
      if (form) form.reset();
      showToast("تم مسح المسودة المحفوظة بنجاح.");
    });
  });

  // أزرار الرجوع من صفحات الإدخال
  document.querySelectorAll(".js-cancel-form").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetView = btn.getAttribute("data-return") || "view-dashboard";
      switchView(targetView);
    });
  });
}

function clearFormDraftByPrefix(prefix) {
  Object.keys(localStorage).forEach((k) => {
    if (k.startsWith(DRAFT_PREFIX + prefix)) {
      localStorage.removeItem(k);
    }
  });
  localStorage.removeItem(DRAFT_VIEW_KEY);
  document.getElementById("draft-restore-bar").style.display = "none";
}

function restoreDraftValuesToInputs(prefix) {
  document.querySelectorAll(`[data-draft^="${prefix}"]`).forEach((input) => {
    const key = input.getAttribute("data-draft");
    const saved = localStorage.getItem(DRAFT_PREFIX + key);
    if (saved !== null) input.value = saved;
  });
}

function checkPendingDraftBanner() {
  const activeDraftView = localStorage.getItem(DRAFT_VIEW_KEY);
  const bar = document.getElementById("draft-restore-bar");
  if (!activeDraftView || state.userRole === "author") {
    bar.style.display = "none";
    return;
  }

  // التحقق من وجود نص محفوظ فعلياً
  const hasContent = Object.keys(localStorage).some(
    (k) => k.startsWith(DRAFT_PREFIX) && (localStorage.getItem(k) || "").trim() !== ""
  );

  if (!hasContent) {
    localStorage.removeItem(DRAFT_VIEW_KEY);
    bar.style.display = "none";
    return;
  }

  const viewNames = {
    "view-form-book": "إضافة عقد كتاب",
    "view-form-author": "إضافة ملف كاتب",
    "view-form-payout": "تسجيل دفعة مالية",
    "view-form-expense": "تسجيل مصروف",
    "view-form-staff": "إضافة موظف",
    "view-form-notif": "إرسال تنبيه"
  };

  document.getElementById("draft-restore-text").textContent =
    `لديك مسودة محفوظة تلقائياً في صفحة (${viewNames[activeDraftView] || "إدخال بيانات"}) لم يتم حفظها بعد!`;
  bar.style.display = "flex";

  document.getElementById("btn-restore-draft-now").onclick = () => {
    bar.style.display = "none";
    if (activeDraftView === "view-form-book") populateAuthorSelect("");
    switchView(activeDraftView);
  };

  document.getElementById("btn-discard-draft-now").onclick = () => {
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith(DRAFT_PREFIX)) localStorage.removeItem(k);
    });
    localStorage.removeItem(DRAFT_VIEW_KEY);
    bar.style.display = "none";
    showToast("تم تجاهل المسودة المؤقتة.");
  };
}

initAutoSaveDrafts();

// ==========================================================================
// 5. دوال مساعدة (العملة ج.م، ضغط الصور، جوجل درايف، الترحيب المصري)
// ==========================================================================
function formatEGP(amount) {
  const val = Number(amount || 0);
  return val.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + " ج.م";
}

function getTodayDate() {
  return new Date().toISOString().split("T")[0];
}

function getBaseSiteUrl() {
  return `${window.location.origin}${window.location.pathname}`;
}

function showToast(msg, icon = "ri-checkbox-circle-fill") {
  const stack = document.getElementById("toast-stack");
  if (!stack) return;
  const el = document.createElement("div");
  el.className = "toast-msg";
  el.innerHTML = `<i class="${icon}" style="color: #facc15; font-size: 18px;"></i><span>${msg}</span>`;
  stack.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 250);
  }, 3200);
}

function openDialog(id) {
  const d = document.getElementById(id);
  if (d) d.classList.add("show");
}

function closeDialog(id) {
  const d = document.getElementById(id);
  if (d) d.classList.remove("show");
}

function askConfirmation(title, msg, onYes) {
  document.getElementById("confirm-dialog-title").textContent = title;
  document.getElementById("confirm-dialog-msg").textContent = msg;
  state.confirmCallback = onYes;
  openDialog("dialog-confirm");
}

document.getElementById("btn-confirm-yes").addEventListener("click", async () => {
  closeDialog("dialog-confirm");
  if (typeof state.confirmCallback === "function") {
    await state.confirmCallback();
    state.confirmCallback = null;
  }
});

// ضغط الصور تلقائياً ورفعها عبر ImgBB API
async function compressAndUploadImage(file, maxWidth = 900, quality = 0.78) {
  if (!file) return null;
  const base64Data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (ev) => {
      const img = new Image();
      img.src = ev.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) {
          h = Math.round((h * maxWidth) / w);
          w = maxWidth;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality).split(",")[1]);
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });

  const form = new FormData();
  form.append("key", IMGBB_API_KEY);
  form.append("image", base64Data);

  const res = await fetch("https://api.imgbb.com/1/upload", { method: "POST", body: form });
  const json = await res.json();
  if (json && json.success && json.data && json.data.url) {
    return json.data.url;
  }
  throw new Error("Upload Failed");
}

// تحويل رابط جوجل درايف إلى عرض مدمج وتحميل مباشر
function parseGoogleDriveLink(rawUrl) {
  if (!rawUrl || !rawUrl.trim()) return null;
  const url = rawUrl.trim();
  const match = url.match(/[-\w]{25,}/);
  if (match && match[0]) {
    const fileId = match[0];
    return {
      previewUrl: `https://drive.google.com/file/d/${fileId}/preview`,
      downloadUrl: `https://drive.google.com/uc?export=download&id=${fileId}`
    };
  }
  return { previewUrl: url, downloadUrl: url };
}

function calculateContractStatus(startDateStr, durationMonths) {
  if (!startDateStr || !durationMonths) {
    return { endDateStr: "غير محدد", daysLeft: 0, label: "غير محدد", pillClass: "blue" };
  }
  const start = new Date(startDateStr);
  const end = new Date(start);
  end.setMonth(end.getMonth() + Number(durationMonths));
  const diffDays = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const endDateStr = end.toISOString().split("T")[0];

  if (diffDays < 0) {
    return { endDateStr, daysLeft: diffDays, label: `منتهي منذ ${Math.abs(diffDays)} يوم`, pillClass: "red" };
  } else if (diffDays <= 30) {
    return { endDateStr, daysLeft: diffDays, label: `ينتهي خلال ${diffDays} يوم`, pillClass: "amber" };
  }
  return { endDateStr, daysLeft: diffDays, label: `عقد ساري (${diffDays} يوم)`, pillClass: "green" };
}

function updateEgyptianGreeting() {
  const h = new Date().getHours();
  const name = state.userProfile.displayName || "يا غالي";
  let title = "";
  let sub = "";

  if (h >= 4 && h < 12) {
    title = `يا صباح الفل والياسمين يا أ. ${name}! ☀️`;
    sub = "نهارك نادي ومليان بركة ورزق.. شغل موفق النهاردة بإذن الله";
  } else if (h >= 12 && h < 17) {
    title = `يا مساء النشاط والجمال يا أ. ${name}! ✨`;
    sub = "تسلم إيدك على مجهودك الجميل.. ربنا يبارك في شغلك";
  } else {
    title = `يا مساء الفل والروقان يا أ. ${name}! 🌙`;
    sub = "يعطيك العافية على تعبك النهاردة.. بالتوفيق دايماً في صفقات كتابية";
  }

  document.getElementById("greeting-title").textContent = title;
  document.getElementById("greeting-sub").textContent = sub;
}

function sortDesc(list) {
  return [...list].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

async function logActivity(actionTitle, detailsText) {
  if (!state.userEmail) return;
  try {
    await addDoc(collection(db, "activity_logs"), {
      actorEmail: state.userEmail,
      actorName: state.userProfile.displayName || state.userEmail,
      actorRole: state.userRole,
      actionTitle,
      detailsText,
      dateString: getTodayDate(),
      createdAt: serverTimestamp()
    });
  } catch (e) {
    console.warn("Log warning:", e);
  }
}

function clearSubscriptions() {
  state.unsubscribers.forEach((u) => typeof u === "function" && u());
  state.unsubscribers = [];
}

// ==========================================================================
// 6. المصادقة وحارس البوابة وفحص الصلاحيات الـ 8 (Auth & Role Gatekeeper)
// ==========================================================================
document.getElementById("btn-google-login").addEventListener("click", async () => {
  document.getElementById("auth-error-box").style.display = "none";
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (err) {
    console.error("Login Error:", err);
    const box = document.getElementById("auth-error-box");
    document.getElementById("auth-error-text").textContent =
      "تعذر تسجيل الدخول. تأكد من تفعيل Google في Firebase وإضافة دومين موقعك.";
    box.style.display = "block";
  }
});

document.getElementById("btn-topbar-logout").addEventListener("click", () => {
  openDialog("dialog-logout");
});

document.getElementById("btn-exec-logout").addEventListener("click", async () => {
  closeDialog("dialog-logout");
  clearSubscriptions();
  await signOut(auth);
});

onAuthStateChanged(auth, async (user) => {
  clearSubscriptions();
  const authScreen = document.getElementById("auth-screen");
  const appScreen = document.getElementById("app-screen");
  const errBox = document.getElementById("auth-error-box");
  const errText = document.getElementById("auth-error-text");

  if (!user || !user.email) {
    state.currentUser = null;
    authScreen.style.display = "flex";
    appScreen.style.display = "none";
    return;
  }

  const email = user.email.trim().toLowerCase();
  state.currentUser = user;
  state.userEmail = email;

  try {
    // جلب الملف الشخصي
    const profSnap = await getDoc(doc(db, "user_profiles", email));
    if (profSnap.exists()) {
      const d = profSnap.data();
      state.userProfile.displayName = d.displayName || user.displayName || email.split("@")[0];
      state.userProfile.avatarUrl = d.avatarUrl || user.photoURL || APP_ICON_SVG;
    } else {
      state.userProfile.displayName = user.displayName || email.split("@")[0];
      state.userProfile.avatarUrl = user.photoURL || APP_ICON_SVG;
    }

    // 1. فحص الحاكم الخفي (الإدارة العليا المطلقة)
    if (isSuperAdminEmail(email)) {
      state.userRole = "super_admin";
      state.permissions = { ...DEFAULT_PERMS };
      launchAppWorkspace();
      return;
    }

    // 2. فحص هل هو موظف في القائمة البيضاء
    const staffSnap = await getDocs(query(collection(db, "staff"), where("email", "==", email)));
    if (!staffSnap.empty) {
      const sData = staffSnap.docs[0].data();
      if (sData.restricted) {
        await signOut(auth);
        errText.textContent = "تم تقييد وتجميد حسابك مؤقتاً من قِبل الإدارة.";
        errBox.style.display = "block";
        authScreen.style.display = "flex";
        appScreen.style.display = "none";
        return;
      }

      state.userRole = "employee";
      const p = sData.permissions || {};
      state.permissions = {
        sell: p.sell !== undefined ? !!p.sell : true,
        addBook: p.addBook !== undefined ? !!p.addBook : !!p.books,
        deleteBook: p.deleteBook !== undefined ? !!p.deleteBook : false,
        authors: p.authors !== undefined ? !!p.authors : true,
        payouts: p.payouts !== undefined ? !!p.payouts : false,
        expenses: p.expenses !== undefined ? !!p.expenses : false,
        financeView: p.financeView !== undefined ? !!p.financeView : !!p.finance,
        reports: p.reports !== undefined ? !!p.reports : true
      };

      if (!profSnap.exists() && sData.name) {
        state.userProfile.displayName = sData.name;
      }
      launchAppWorkspace();
      return;
    }

    // 3. فحص هل هو كاتب معتمد
    const authorSnap = await getDocs(query(collection(db, "authors"), where("email", "==", email)));
    if (!authorSnap.empty) {
      const aDoc = authorSnap.docs[0];
      state.userRole = "author";
      state.currentAuthorProfile = { id: aDoc.id, ...aDoc.data() };
      state.userProfile.displayName = state.currentAuthorProfile.name || state.userProfile.displayName;
      if (state.currentAuthorProfile.avatarUrl) {
        state.userProfile.avatarUrl = state.currentAuthorProfile.avatarUrl;
      }
      launchAppWorkspace();
      return;
    }

    // 4. غير مصرح له بالدخول
    await signOut(auth);
    errText.textContent = `البريد (${email}) غير مسجل في النظام. الدخول للحسابات المعتمدة فقط.`;
    errBox.style.display = "block";
    authScreen.style.display = "flex";
    appScreen.style.display = "none";
  } catch (err) {
    console.error("Auth check error:", err);
    errText.textContent = "حدث خطأ أثناء الاتصال بقاعدة البيانات. تأكد من تفعيل Firestore Rules.";
    errBox.style.display = "block";
  }
});

// ==========================================================================
// 7. تشغيل الواجهة وتكييفها مع صلاحيات المستخدم (Workspace Launch)
// ==========================================================================
function launchAppWorkspace() {
  document.getElementById("auth-screen").style.display = "none";
  document.getElementById("app-screen").style.display = "flex";

  refreshUserTopbarAndProfile();
  updateEgyptianGreeting();
  renderSmartGuideContent();

  const navDash = document.getElementById("nav-dashboard");
  const navContracts = document.getElementById("nav-contracts");
  const navAuthors = document.getElementById("nav-authors");
  const navFinance = document.getElementById("nav-finance");
  const navStaff = document.getElementById("nav-staff");
  const navNotif = document.getElementById("nav-notifications");

  if (state.userRole === "author") {
    navDash.style.display = "none";
    navContracts.style.display = "none";
    navAuthors.style.display = "none";
    navFinance.style.display = "none";
    navStaff.style.display = "none";
    navNotif.style.display = "none";
    document.getElementById("btn-quick-new-sale-jump").style.display = "none";

    switchView("view-author-portal");
    startAuthorRealtimeListeners(state.currentAuthorProfile.id);
    return;
  }

  const p = state.permissions;
  navDash.style.display = "flex";
  navContracts.style.display = "flex";
  navAuthors.style.display = p.authors ? "flex" : "none";
  navFinance.style.display = p.financeView || p.expenses ? "flex" : "none";
  navStaff.style.display = state.userRole === "super_admin" ? "flex" : "none";
  navNotif.style.display = "flex";
  document.getElementById("btn-quick-new-sale-jump").style.display = "inline-flex";

  // إظهار وإخفاء الأزرار حسب الصلاحيات الـ 8 الدقيقة
  document.getElementById("btn-goto-add-book").style.display = p.addBook ? "inline-flex" : "none";
  document.getElementById("btn-goto-add-author").style.display = p.authors ? "inline-flex" : "none";
  document.getElementById("btn-detail-add-contract").style.display = p.addBook ? "inline-flex" : "none";
  document.getElementById("btn-detail-add-payout").style.display = p.payouts ? "inline-flex" : "none";
  document.getElementById("btn-detail-send-report").style.display = p.reports ? "inline-flex" : "none";
  document.getElementById("btn-goto-add-expense").style.display = p.expenses ? "inline-flex" : "none";
  document.getElementById("btn-notif-page-new").style.display = state.userRole === "super_admin" ? "inline-flex" : "none";
  document.getElementById("dashboard-metrics-box").style.display = p.financeView ? "grid" : "none";

  checkPendingDraftBanner();
  switchView("view-dashboard");
  startAdminAndStaffListeners();
}

function refreshUserTopbarAndProfile() {
  const roleLabel =
    state.userRole === "super_admin"
      ? "إدارة النظام"
      : state.userRole === "employee"
      ? "موظف معتمد"
      : "بوابة المؤلف";

  document.getElementById("topbar-user-name").textContent = state.userProfile.displayName;
  document.getElementById("topbar-user-role").textContent = roleLabel;
  const avatarEl = document.getElementById("topbar-user-avatar");
  avatarEl.src = state.userProfile.avatarUrl || APP_ICON_SVG;
  avatarEl.onerror = () => { avatarEl.src = APP_ICON_SVG; };

  document.getElementById("profile-view-name").textContent = state.userProfile.displayName;
  document.getElementById("profile-view-email").textContent = state.userEmail;
  document.getElementById("profile-view-role").textContent = roleLabel;
  const profImg = document.getElementById("profile-view-avatar");
  profImg.src = state.userProfile.avatarUrl || APP_ICON_SVG;
  profImg.onerror = () => { profImg.src = APP_ICON_SVG; };
  document.getElementById("profile-name-input").value = state.userProfile.displayName;
}

function switchView(viewId) {
  document.querySelectorAll(".app-view").forEach((v) => (v.style.display = "none"));
  const target = document.getElementById(viewId);
  if (target) target.style.display = "block";

  document.querySelectorAll("#main-nav-menu .nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-view") === viewId);
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll("#main-nav-menu .nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    switchView(btn.getAttribute("data-view"));
  });
});

document.getElementById("topbar-user-avatar").addEventListener("click", () => {
  if (state.userRole === "author") return;
  state.inspectingStaffEmail = null;
  document.getElementById("activity-log-heading").innerHTML = `<i class="ri-history-line" style="color: var(--brand-crimson);"></i> <span>سجل نشاطي والعمليات الموثقة</span>`;
  document.getElementById("btn-Reset-my-logs").style.display = "none";
  renderActivityLogs();
  switchView("view-profile");
});

document.getElementById("btn-topbar-notif").addEventListener("click", () => {
  if (state.userRole === "author") return;
  switchView("view-notifications");
});

document.getElementById("btn-quick-new-sale-jump").addEventListener("click", () => {
  switchView("view-contracts");
});

document.getElementById("btn-dash-all-books").addEventListener("click", () => {
  switchView("view-contracts");
});

// ==========================================================================
// 8. الاستماع الفوري لقاعدة البيانات (Real-time Firestore Listeners)
// ==========================================================================
function startAdminAndStaffListeners() {
  const unsubAuthors = onSnapshot(collection(db, "authors"), (snap) => {
    state.authors = sortDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    populateAuthorSelect("");
    renderAuthorsDirectory();
    if (state.selectedAuthorDetailId) renderSingleAuthorDetail(state.selectedAuthorDetailId);
    updateDashboardMetrics();
  });

  const unsubBooks = onSnapshot(collection(db, "books"), (snap) => {
    state.books = sortDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    renderBooksGrid();
    renderFavBooksGrid();
    renderAuthorsDirectory();
    if (state.selectedAuthorDetailId) renderSingleAuthorDetail(state.selectedAuthorDetailId);
    updateDashboardMetrics();
    renderMainChart();
  });

  const unsubSales = onSnapshot(collection(db, "sales"), (snap) => {
    state.sales = sortDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    renderFinanceList();
    updateDashboardMetrics();
  });

  const unsubExpenses = onSnapshot(collection(db, "expenses"), (snap) => {
    state.expenses = sortDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    renderFinanceList();
    updateDashboardMetrics();
  });

  const unsubPayouts = onSnapshot(collection(db, "payouts"), (snap) => {
    state.payouts = sortDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    renderFinanceList();
    if (state.selectedAuthorDetailId) renderSingleAuthorDetail(state.selectedAuthorDetailId);
    updateDashboardMetrics();
  });

  const unsubNotifs = onSnapshot(collection(db, "notifications"), (snap) => {
    state.notifications = sortDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    renderNotifications();
  });

  const unsubLogs = onSnapshot(collection(db, "activity_logs"), (snap) => {
    state.activityLogs = sortDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    renderActivityLogs();
    if (state.userRole === "super_admin") renderStaffGrid();
  });

  if (state.userRole === "super_admin") {
    const unsubStaff = onSnapshot(collection(db, "staff"), (snap) => {
      state.staff = sortDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      renderStaffGrid();
      populateNotifTargets();
    });
    state.unsubscribers.push(unsubStaff);
  }

  state.unsubscribers.push(
    unsubAuthors,
    unsubBooks,
    unsubSales,
    unsubExpenses,
    unsubPayouts,
    unsubNotifs,
    unsubLogs
  );
}

function startAuthorRealtimeListeners(authorId) {
  const unsubA = onSnapshot(doc(db, "authors", authorId), (s) => {
    if (s.exists()) {
      state.currentAuthorProfile = { id: s.id, ...s.data() };
      renderAuthorPortal();
    }
  });

  const unsubB = onSnapshot(query(collection(db, "books"), where("authorId", "==", authorId)), (s) => {
    state.books = sortDesc(s.docs.map((d) => ({ id: d.id, ...d.data() })));
    renderAuthorPortal();
  });

  const unsubP = onSnapshot(query(collection(db, "payouts"), where("authorId", "==", authorId)), (s) => {
    state.payouts = sortDesc(s.docs.map((d) => ({ id: d.id, ...d.data() })));
    renderAuthorPortal();
  });

  state.unsubscribers.push(unsubA, unsubB, unsubP);
}

// ==========================================================================
// 9. الحسابات المالية والرسوم البيانية التفاعلية (Metrics & Chart.js)
// ==========================================================================
function updateDashboardMetrics() {
  let totalRevenue = 0;
  let totalCopies = 0;
  let totalAuthorsEarned = 0;

  state.books.forEach((b) => {
    const sold = Number(b.copiesSold || 0);
    const price = Number(b.price || 0);
    const rate = Number(b.royaltyRate || 0);
    const rev = sold * price;
    totalCopies += sold;
    totalRevenue += rev;
    totalAuthorsEarned += rev * (rate / 100);
  });

  const totalPaid = state.payouts.reduce((s, p) => s + Number(p.amount || 0), 0);
  const unpaid = Math.max(0, totalAuthorsEarned - totalPaid);
  const totalExp = state.expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const netProfit = totalRevenue - totalAuthorsEarned - totalExp;

  document.getElementById("stat-total-revenue").textContent = formatEGP(totalRevenue);
  document.getElementById("stat-total-copies").textContent = `${totalCopies} نسخة مباعة`;
  document.getElementById("stat-net-profit").textContent = formatEGP(netProfit);
  document.getElementById("stat-authors-unpaid").textContent = formatEGP(unpaid);
  document.getElementById("stat-authors-paid-sub").textContent = `سُدد: ${formatEGP(totalPaid)}`;
  document.getElementById("stat-total-expenses").textContent = formatEGP(totalExp);
}

function renderMainChart() {
  const canvas = document.getElementById("mainSalesChart");
  if (!canvas || typeof Chart === "undefined") return;

  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const textColor = isDark ? "#e2e8f0" : "#334155";

  const topBooks = [...state.books]
    .sort((a, b) => Number(b.copiesSold || 0) - Number(a.copiesSold || 0))
    .slice(0, 6);

  const labels = topBooks.length ? topBooks.map((b) => b.title) : ["لا توجد مبيعات مسجلة بعد"];
  const revData = topBooks.length ? topBooks.map((b) => Number(b.copiesSold || 0) * Number(b.price || 0)) : [0];
  const copiesData = topBooks.length ? topBooks.map((b) => Number(b.copiesSold || 0)) : [0];

  if (state.chartInstance) state.chartInstance.destroy();

  const colors = ["#b91c1c", "#eab308", "#059669", "#2563eb", "#7c3aed", "#db2777"];

  const datasets =
    state.currentChartType === "doughnut"
      ? [{ label: "إجمالي المبيعات (ج.م)", data: revData, backgroundColor: colors, borderWidth: 2 }]
      : [
          {
            label: "الإيرادات (ج.م)",
            data: revData,
            backgroundColor: "rgba(185, 28, 28, 0.82)",
            borderColor: "#b91c1c",
            borderWidth: 2,
            borderRadius: 6,
            tension: 0.35
          },
          {
            label: "النسخ المباعة",
            data: copiesData,
            backgroundColor: "rgba(234, 179, 8, 0.85)",
            borderColor: "#eab308",
            borderWidth: 2,
            borderRadius: 6,
            tension: 0.35
          }
        ];

  state.chartInstance = new Chart(canvas, {
    type: state.currentChartType,
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: textColor, font: { family: "Tajawal", weight: "bold", size: 12 } }
        }
      },
      scales:
        state.currentChartType === "doughnut"
          ? {}
          : {
              x: { ticks: { color: textColor, font: { family: "Tajawal" } } },
              y: { ticks: { color: textColor, font: { family: "Tajawal" } } }
            }
    }
  });
}

document.querySelectorAll(".chart-switch-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".chart-switch-btn").forEach((b) => {
      b.className = "btn btn-outline chart-switch-btn";
    });
    btn.className = "btn btn-crimson chart-switch-btn";
    state.currentChartType = btn.getAttribute("data-type");
    renderMainChart();
  });
});

// ==========================================================================
// 10. عرض بطاقات الكتب والعقود والمفضلة (Books & Contracts Cards)
// ==========================================================================
function createBookCardHTML(b) {
  const sold = Number(b.copiesSold || 0);
  const price = Number(b.price || 0);
  const rate = Number(b.royaltyRate || 0);
  const totalRev = sold * price;
  const authorShare = totalRev * (rate / 100);
  const contract = calculateContractStatus(b.contractDate, b.contractMonths);

  const hasStock = b.stock !== undefined && b.stock !== null && b.stock !== "";
  const stockBadge = hasStock
    ? Number(b.stock) <= 15
      ? `<span class="pill red">المخزون: ${b.stock}</span>`
      : `<span class="pill blue">المخزون: ${b.stock}</span>`
    : "";

  const thumb = b.coverUrl
    ? `<img src="${b.coverUrl}" class="book-thumb" alt="${b.title}" />`
    : `<div class="book-thumb"><i class="ri-book-2-fill"></i></div>`;

  const p = state.permissions;

  return `
    <div class="entity-card ${b.isFavorite ? "fav-card" : ""}">
      <div>
        <div class="card-head">
          ${thumb}
          <div class="card-title-area">
            <div style="display: flex; gap: 5px; flex-wrap: wrap;">
              <span class="pill ${contract.pillClass}">${contract.label}</span>
              ${stockBadge}
            </div>
            <div class="card-title">${b.title}</div>
            <div class="card-sub"><i class="ri-quill-pen-line"></i> المؤلف: <strong>${b.authorName || "غير محدد"}</strong></div>
          </div>
          <button class="star-btn ${b.isFavorite ? "active" : ""}" data-action="toggle-fav" data-id="${b.id}" title="إضافة للمفضلة">
            <i class="${b.isFavorite ? "ri-star-fill" : "ri-star-line"}"></i>
          </button>
        </div>

        <div class="card-stats-grid">
          <div class="stat-cell"><span>سعر البيع</span><strong>${formatEGP(price)}</strong></div>
          <div class="stat-cell"><span>النسخ المباعة</span><strong style="color: var(--brand-crimson);">${sold} نسخة</strong></div>
          <div class="stat-cell"><span>نسبة المؤلف (${rate}%)</span><strong style="color: var(--success);">${formatEGP(authorShare)}</strong></div>
          <div class="stat-cell"><span>إجمالي المبيعات</span><strong>${formatEGP(totalRev)}</strong></div>
        </div>
      </div>

      <div class="card-actions">
        ${
          p.sell
            ? `<button class="btn btn-success" style="flex: 1; padding: 9px 12px;" data-action="sell-book" data-id="${b.id}">
                 <i class="ri-add-circle-fill" style="font-size: 16px;"></i><span>بيع نسخة</span>
               </button>`
            : ""
        }
        ${
          b.drivePdfUrl
            ? `<button class="tool-btn" title="عرض وتحميل عقد الـ PDF" data-action="open-pdf" data-id="${b.id}" style="color: var(--brand-crimson);">
                 <i class="ri-file-pdf-2-fill"></i>
               </button>`
            : ""
        }
        ${
          p.addBook
            ? `<button class="tool-btn" title="تعديل الكتاب والعقد" data-action="edit-book" data-id="${b.id}">
                 <i class="ri-edit-box-line"></i>
               </button>`
            : ""
        }
        ${
          p.deleteBook
            ? `<button class="tool-btn danger" title="حذف العقد" data-action="delete-book" data-id="${b.id}">
                 <i class="ri-delete-bin-6-line"></i>
               </button>`
            : ""
        }
      </div>
    </div>
  `;
}

function renderFavBooksGrid() {
  const el = document.getElementById("fav-books-grid");
  if (!el) return;
  const favs = state.books.filter((b) => b.isFavorite);
  const list = favs.length ? favs : state.books.slice(0, 4);
  if (!list.length) {
    el.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 28px; background: var(--bg-card); border-radius: 12px; color: var(--text-muted);">لا توجد عقود كتب مضافة حتى الآن.</div>`;
    return;
  }
  el.innerHTML = list.map(createBookCardHTML).join("");
}

function renderBooksGrid() {
  const el = document.getElementById("books-grid");
  if (!el) return;
  const q = (document.getElementById("search-books-input").value || "").trim().toLowerCase();
  const sorted = [...state.books].sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0));
  const filtered = sorted.filter(
    (b) =>
      (b.title || "").toLowerCase().includes(q) ||
      (b.authorName || "").toLowerCase().includes(q) ||
      (b.category || "").toLowerCase().includes(q)
  );

  if (!filtered.length) {
    el.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 34px; background: var(--bg-card); border-radius: 12px; color: var(--text-muted);">لا توجد كتب مطابقة للبحث.</div>`;
    return;
  }
  el.innerHTML = filtered.map(createBookCardHTML).join("");
}

document.getElementById("search-books-input").addEventListener("input", renderBooksGrid);

// ==========================================================================
// 11. عرض ملفات الكُتّاب وصفحة الكاتب المستقلة (Authors Directory & Detail)
// ==========================================================================
function renderAuthorsDirectory() {
  const el = document.getElementById("authors-grid");
  if (!el) return;
  const q = (document.getElementById("search-authors-input").value || "").trim().toLowerCase();
  const filtered = state.authors.filter(
    (a) => (a.name || "").toLowerCase().includes(q) || (a.email || "").toLowerCase().includes(q)
  );

  if (!filtered.length) {
    el.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 34px; background: var(--bg-card); border-radius: 12px; color: var(--text-muted);">لا يوجد كُتّاب مسجلون بعد. اضغط "إنشاء ملف كاتب جديد".</div>`;
    return;
  }

  el.innerHTML = filtered
    .map((a) => {
      const aBooks = state.books.filter((b) => b.authorId === a.id);
      const sold = aBooks.reduce((s, b) => s + Number(b.copiesSold || 0), 0);
      const earned = aBooks.reduce(
        (s, b) => s + Number(b.copiesSold || 0) * Number(b.price || 0) * (Number(b.royaltyRate || 0) / 100),
        0
      );
      const paid = state.payouts
        .filter((p) => p.authorId === a.id)
        .reduce((s, p) => s + Number(p.amount || 0), 0);
      const balance = Math.max(0, earned - paid);

      const avatar = a.avatarUrl
        ? `<img src="${a.avatarUrl}" class="author-thumb" alt="${a.name}" />`
        : `<div class="author-thumb">${(a.name || "ك")[0]}</div>`;

      return `
        <div class="entity-card">
          <div>
            <div class="card-head" style="cursor: pointer;" data-action="open-author" data-id="${a.id}">
              ${avatar}
              <div class="card-title-area">
                <span class="pill crimson">${aBooks.length} عقود كتب</span>
                <div class="card-title">${a.name}</div>
                <div class="card-sub" dir="ltr">${a.email}</div>
              </div>
            </div>

            <div class="card-stats-grid">
              <div class="stat-cell"><span>إجمالي المبيعات</span><strong>${sold} نسخة</strong></div>
              <div class="stat-cell"><span>الرصيد المستحق</span><strong style="color: var(--brand-crimson);">${formatEGP(balance)}</strong></div>
            </div>
          </div>

          <div class="card-actions">
            <button class="btn btn-crimson" style="flex: 1; padding: 9px 12px;" data-action="open-author" data-id="${a.id}">
              <i class="ri-folder-user-line"></i><span>فتح ملف وعقود الكاتب</span>
            </button>
            <button class="tool-btn" title="تعديل بيانات الكاتب" data-action="edit-author" data-id="${a.id}">
              <i class="ri-edit-box-line"></i>
            </button>
            <button class="tool-btn danger" title="حذف الكاتب" data-action="delete-author" data-id="${a.id}">
              <i class="ri-delete-bin-6-line"></i>
            </button>
          </div>
        </div>
      `;
    })
    .join("");
}

document.getElementById("search-authors-input").addEventListener("input", renderAuthorsDirectory);

function renderSingleAuthorDetail(authorId) {
  const a = state.authors.find((x) => x.id === authorId);
  if (!a) return;

  const aBooks = state.books.filter((b) => b.authorId === authorId);
  const aPayouts = state.payouts.filter((p) => p.authorId === authorId);

  let copies = 0;
  let earned = 0;
  aBooks.forEach((b) => {
    const c = Number(b.copiesSold || 0);
    const rev = c * Number(b.price || 0);
    copies += c;
    earned += rev * (Number(b.royaltyRate || 0) / 100);
  });

  const paid = aPayouts.reduce((s, p) => s + Number(p.amount || 0), 0);
  const balance = Math.max(0, earned - paid);

  const avatar = a.avatarUrl
    ? `<img src="${a.avatarUrl}" class="author-thumb" />`
    : `<div class="author-thumb">${(a.name || "ك")[0]}</div>`;

  document.getElementById("author-detail-header").innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px;">
      ${avatar}
      <div>
        <h3 style="font-size: 18px; font-weight: 800;">أ. ${a.name}</h3>
        <p style="font-size: 12.5px; color: var(--text-secondary);" dir="ltr">${a.email} ${a.phone ? "• " + a.phone : ""}</p>
        ${a.bio ? `<p style="font-size: 12px; color: var(--text-muted); margin-top: 3px;">${a.bio}</p>` : ""}
      </div>
    </div>
    <span class="pill green">بوابة المؤلف نشطة</span>
  `;

  document.getElementById("detail-author-earned").textContent = formatEGP(earned);
  document.getElementById("detail-author-copies").textContent = `${copies} نسخة مباعة`;
  document.getElementById("detail-author-paid").textContent = formatEGP(paid);
  document.getElementById("detail-author-balance").textContent = formatEGP(balance);

  const booksEl = document.getElementById("detail-author-books");
  booksEl.innerHTML = aBooks.length
    ? aBooks.map(createBookCardHTML).join("")
    : `<div style="grid-column: 1/-1; text-align: center; padding: 24px; background: var(--bg-card); border-radius: 12px; color: var(--text-muted);">لا توجد عقود كتب مضافة لهذا الكاتب بعد. اضغط "إضافة عقد كتاب للمؤلف".</div>`;

  const payEl = document.getElementById("detail-author-payouts");
  payEl.innerHTML = aPayouts.length
    ? aPayouts
        .map(
          (p) => `
        <div class="list-row">
          <div>
            <h4 style="font-size: 14.5px; font-weight: 800; color: var(--success);">دفعة مسددة: ${formatEGP(p.amount)}</h4>
            <p style="font-size: 12px; color: var(--text-secondary);">الطريقة: ${p.method} • التاريخ: ${p.dateString} ${p.notes ? "• " + p.notes : ""}</p>
          </div>
          <div style="display: flex; gap: 6px; align-items: center;">
            ${
              p.receiptUrl
                ? `<a href="${p.receiptUrl}" target="_blank" class="btn btn-outline" style="padding: 6px 10px; font-size: 12px;">
                     <i class="ri-image-line"></i><span>عرض الإيصال</span>
                   </a>`
                : `<span class="pill amber">بدون إيصال</span>`
            }
            ${
              state.permissions.payouts
                ? `<button class="tool-btn danger" data-action="delete-payout" data-id="${p.id}"><i class="ri-delete-bin-line"></i></button>`
                : ""
            }
          </div>
        </div>
      `
        )
        .join("")
    : `<div style="text-align: center; padding: 20px; background: var(--bg-card); border-radius: 12px; color: var(--text-muted);">لا توجد دفعات مسجلة حتى الآن.</div>`;
}

document.getElementById("btn-back-to-authors").addEventListener("click", () => {
  state.selectedAuthorDetailId = null;
  switchView("view-authors");
});

// ==========================================================================
// 12. إدارة الأحداث والصفحات الكاملة للإدخال (Full-Page Forms & Actions)
// ==========================================================================
document.addEventListener("click", async (e) => {
  const closeDlg = e.target.closest("[data-close-dialog]");
  if (closeDlg) {
    closeDialog(closeDlg.getAttribute("data-close-dialog"));
    return;
  }

  const actBtn = e.target.closest("[data-action]");
  if (!actBtn) return;

  const action = actBtn.getAttribute("data-action");
  const id = actBtn.getAttribute("data-id");

  if (action === "sell-book") {
    openSellConfirmDialog(id);
  } else if (action === "toggle-fav") {
    const b = state.books.find((x) => x.id === id);
    if (b) {
      await updateDoc(doc(db, "books", id), { isFavorite: !b.isFavorite });
      showToast(!b.isFavorite ? "أُضيف الكتاب للمفضلة ⭐️" : "أُزيل من المفضلة");
    }
  } else if (action === "open-pdf") {
    openPdfFullPage(id);
  } else if (action === "edit-book") {
    openBookFormPage(id, null);
  } else if (action === "delete-book") {
    const b = state.books.find((x) => x.id === id);
    if (!b) return;
    askConfirmation("حذف عقد الكتاب", `هل أنت متأكد من حذف عقد وبيانات كتاب "${b.title}"؟`, async () => {
      await deleteDoc(doc(db, "books", id));
      await logActivity("حذف عقد كتاب", `حذف كتاب: ${b.title}`);
      showToast("تم حذف الكتاب.");
    });
  } else if (action === "open-author") {
    state.selectedAuthorDetailId = id;
    renderSingleAuthorDetail(id);
    switchView("view-author-detail");
  } else if (action === "edit-author") {
    openAuthorFormPage(id);
  } else if (action === "delete-author") {
    const a = state.authors.find((x) => x.id === id);
    if (!a) return;
    askConfirmation("حذف ملف الكاتب", `هل أنت متأكد من حذف ملف الكاتب "${a.name}"؟`, async () => {
      await deleteDoc(doc(db, "authors", id));
      await logActivity("حذف كاتب", `حذف ملف الكاتب: ${a.name}`);
      showToast("تم حذف ملف الكاتب.");
    });
  } else if (action === "delete-payout") {
    askConfirmation("حذف الدفعة المالية", "هل تريد حذف سجل هذه الدفعة؟", async () => {
      await deleteDoc(doc(db, "payouts", id));
      showToast("تم حذف الدفعة.");
    });
  } else if (action === "delete-sale") {
    const bookId = actBtn.getAttribute("data-book-id");
    const qty = Number(actBtn.getAttribute("data-qty") || 1);
    askConfirmation("إلغاء عملية بيع", `سيتم إلغاء بيع (${qty}) نسخة وإرجاعها للمخزون. هل أنت متأكد؟`, async () => {
      await deleteDoc(doc(db, "sales", id));
      if (bookId) await updateDoc(doc(db, "books", bookId), { copiesSold: increment(-qty) });
      await logActivity("إلغاء بيعة", `إلغاء بيع (${qty} نسخة)`);
      showToast("تم إلغاء عملية البيع.");
    });
  } else if (action === "delete-expense") {
    askConfirmation("حذف مصروف", "هل تريد حذف هذا المصروف التشغيلي؟", async () => {
      await deleteDoc(doc(db, "expenses", id));
      showToast("تم حذف المصروف.");
    });
  } else if (action === "edit-staff") {
    openStaffFormPage(id);
  } else if (action === "inspect-staff") {
    state.inspectingStaffEmail = actBtn.getAttribute("data-email");
    const name = actBtn.getAttribute("data-name");
    document.getElementById("activity-log-heading").innerHTML = `<i class="ri-eye-fill" style="color: var(--brand-crimson);"></i> <span>مراقبة سجل نشاط الموظف: ${name}</span>`;
    document.getElementById("btn-Reset-my-logs").style.display = "inline-flex";
    renderActivityLogs();
    switchView("view-profile");
  } else if (action === "delete-staff") {
    askConfirmation("حذف موظف", "هل أنت متأكد من سحب الصلاحية وحذف هذا الموظف؟", async () => {
      await deleteDoc(doc(db, "staff", id));
      showToast("تم حذف الموظف.");
    });
  }
});

// --- أ) تأكيد البيع السريع ---
function openSellConfirmDialog(bookId) {
  const b = state.books.find((x) => x.id === bookId);
  if (!b) return;
  document.getElementById("sell-dialog-book-id").value = b.id;
  document.getElementById("sell-dialog-book-name").textContent = `${b.title} (${formatEGP(b.price)})`;
  const qtyEl = document.getElementById("sell-dialog-qty");
  qtyEl.value = 1;
  document.getElementById("sell-dialog-total").textContent = formatEGP(b.price);

  qtyEl.oninput = () => {
    const q = Math.max(1, Number(qtyEl.value || 1));
    document.getElementById("sell-dialog-total").textContent = formatEGP(q * Number(b.price || 0));
  };
  openDialog("dialog-sell");
}

document.getElementById("form-confirm-sell").addEventListener("submit", async (e) => {
  e.preventDefault();
  const bookId = document.getElementById("sell-dialog-book-id").value;
  const qty = Math.max(1, Number(document.getElementById("sell-dialog-qty").value || 1));
  const channel = document.getElementById("sell-dialog-channel").value;
  const b = state.books.find((x) => x.id === bookId);
  if (!b) return;

  const totalAmount = Number(b.price || 0) * qty;
  const authorCut = Number((totalAmount * (Number(b.royaltyRate || 0) / 100)).toFixed(2));
  const houseCut = Number((totalAmount - authorCut).toFixed(2));

  closeDialog("dialog-sell");

  try {
    const upd = { copiesSold: increment(qty) };
    if (b.stock !== undefined && b.stock !== null && b.stock !== "") {
      upd.stock = Math.max(0, Number(b.stock) - qty);
    }
    await updateDoc(doc(db, "books", bookId), upd);

    await addDoc(collection(db, "sales"), {
      bookId: b.id,
      bookTitle: b.title,
      authorId: b.authorId,
      authorName: b.authorName,
      qty,
      unitPrice: Number(b.price || 0),
      totalAmount,
      channel,
      authorCut,
      houseCut,
      soldBy: state.userEmail,
      soldByName: state.userProfile.displayName,
      dateString: getTodayDate(),
      createdAt: serverTimestamp()
    });

    await logActivity("تسجيل مبيعات", `بيع (${qty} نسخة) من كتاب "${b.title}" عبر (${channel}) بقيمة ${formatEGP(totalAmount)}`);
    showToast(`تم توثيق بيع (${qty}) نسخة من "${b.title}"!`);
  } catch (err) {
    console.error(err);
    showToast("تعذر تسجيل البيع", "ri-error-warning-fill");
  }
});

// --- ب) صفحة إضافة / تعديل كاتب كاملة ---
document.getElementById("btn-goto-add-author").addEventListener("click", () => openAuthorFormPage(null));

function openAuthorFormPage(editId = null) {
  const form = document.getElementById("form-author");
  form.reset();
  if (editId) {
    const a = state.authors.find((x) => x.id === editId);
    if (!a) return;
    document.getElementById("author-id-input").value = a.id;
    document.getElementById("author-name-input").value = a.name || "";
    document.getElementById("author-email-input").value = a.email || "";
    document.getElementById("author-phone-input").value = a.phone || "";
    document.getElementById("author-bio-input").value = a.bio || "";
    document.getElementById("welcome-check-wrap").style.display = "none";
    document.getElementById("form-author-heading").textContent = `تعديل ملف الكاتب: ${a.name}`;
  } else {
    document.getElementById("author-id-input").value = "";
    document.getElementById("welcome-check-wrap").style.display = "flex";
    document.getElementById("form-author-heading").textContent = "إنشاء ملف شخصي لكاتب جديد";
    restoreDraftValuesToInputs("author_");
  }
  switchView("view-form-author");
}

document.getElementById("form-author").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("btn-submit-author");
  btn.disabled = true;

  const id = document.getElementById("author-id-input").value;
  const imgFile = document.getElementById("author-image-file").files[0];
  const sendWelcome = document.getElementById("author-welcome-check").checked;

  const payload = {
    name: document.getElementById("author-name-input").value.trim(),
    email: document.getElementById("author-email-input").value.trim().toLowerCase(),
    phone: document.getElementById("author-phone-input").value.trim(),
    bio: document.getElementById("author-bio-input").value.trim()
  };

  try {
    if (imgFile) {
      showToast("جاري ضغط ورفع صورة الكاتب...", "ri-upload-cloud-2-line");
      payload.avatarUrl = await compressAndUploadImage(imgFile);
    }

    if (id) {
      await updateDoc(doc(db, "authors", id), payload);
      await logActivity("تعديل كاتب", `تحديث ملف الكاتب: ${payload.name}`);
      clearFormDraftByPrefix("author_");
      showToast("تم تحديث ملف الكاتب بنجاح.");
      switchView("view-authors");
    } else {
      payload.createdAt = serverTimestamp();
      const ref = await addDoc(collection(db, "authors"), payload);
      await logActivity("إضافة كاتب جديد", `إنشاء ملف الكاتب: ${payload.name}`);
      clearFormDraftByPrefix("author_");
      showToast("تم إنشاء ملف الكاتب بنجاح!");
      if (sendWelcome) {
        openReportPage(ref.id, "welcome");
      } else {
        state.selectedAuthorDetailId = ref.id;
        switchView("view-author-detail");
      }
    }
  } catch (err) {
    console.error(err);
    showToast("حدث خطأ أثناء حفظ الكاتب", "ri-error-warning-fill");
  } finally {
    btn.disabled = false;
  }
});

// --- ج) صفحة إضافة / تعديل عقد كتاب كاملة ---
function populateAuthorSelect(filter = "") {
  const sel = document.getElementById("book-author-select");
  if (!sel) return;
  const cur = sel.value;
  const q = filter.trim().toLowerCase();
  const list = state.authors.filter(
    (a) => (a.name || "").toLowerCase().includes(q) || (a.email || "").toLowerCase().includes(q)
  );
  sel.innerHTML =
    `<option value="">-- اختر المؤلف صاحب العقد --</option>` +
    list.map((a) => `<option value="${a.id}">${a.name} (${a.email})</option>`).join("");
  if (cur && list.some((a) => a.id === cur)) sel.value = cur;
}

document.getElementById("book-author-search").addEventListener("input", (e) => {
  populateAuthorSelect(e.target.value);
});

document.getElementById("btn-goto-add-book").addEventListener("click", () => openBookFormPage(null, null));
document.getElementById("btn-detail-add-contract").addEventListener("click", () =>
  openBookFormPage(null, state.selectedAuthorDetailId)
);

function openBookFormPage(editBookId = null, preselectedAuthorId = null) {
  if (!state.authors.length) {
    showToast("أنشئ ملف كاتب واحد على الأقل قبل إضافة عقد كتاب!", "ri-error-warning-fill");
    openAuthorFormPage(null);
    return;
  }
  const form = document.getElementById("form-book");
  form.reset();
  populateAuthorSelect("");

  if (editBookId) {
    const b = state.books.find((x) => x.id === editBookId);
    if (!b) return;
    document.getElementById("book-id-input").value = b.id;
    document.getElementById("book-title-input").value = b.title || "";
    document.getElementById("book-author-select").value = b.authorId || "";
    document.getElementById("book-price-input").value = b.price || "";
    document.getElementById("book-royalty-input").value = b.royaltyRate ?? 20;
    document.getElementById("book-months-input").value = b.contractMonths || 24;
    document.getElementById("book-date-input").value = b.contractDate || getTodayDate();
    document.getElementById("book-fav-check").checked = !!b.isFavorite;
    document.getElementById("book-drive-input").value = b.drivePdfUrl || "";
    document.getElementById("book-isbn-input").value = b.isbn || "";
    document.getElementById("book-cat-input").value = b.category || "";
    document.getElementById("book-edition-input").value = b.edition || "";
    document.getElementById("book-pages-input").value = b.pages || "";
    document.getElementById("book-stock-input").value = b.stock ?? "";
    document.getElementById("book-notes-input").value = b.notes || "";
    document.getElementById("form-book-heading").textContent = `تعديل عقد وبيانات كتاب: ${b.title}`;
  } else {
    document.getElementById("book-id-input").value = "";
    document.getElementById("book-date-input").value = getTodayDate();
    restoreDraftValuesToInputs("book_");
    if (preselectedAuthorId) {
      document.getElementById("book-author-select").value = preselectedAuthorId;
    }
    document.getElementById("form-book-heading").textContent = "توثيق عقد كتاب جديد";
  }
  switchView("view-form-book");
}

document.getElementById("form-book").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("btn-submit-book");
  btn.disabled = true;

  const id = document.getElementById("book-id-input").value;
  const authorId = document.getElementById("book-author-select").value;
  const authorObj = state.authors.find((a) => a.id === authorId);
  const coverFile = document.getElementById("book-cover-file").files[0];
  const stockRaw = document.getElementById("book-stock-input").value;

  const payload = {
    title: document.getElementById("book-title-input").value.trim(),
    authorId,
    authorName: authorObj ? authorObj.name : "غير محدد",
    price: Number(document.getElementById("book-price-input").value),
    royaltyRate: Number(document.getElementById("book-royalty-input").value),
    contractMonths: Number(document.getElementById("book-months-input").value),
    contractDate: document.getElementById("book-date-input").value,
    isFavorite: document.getElementById("book-fav-check").checked,
    drivePdfUrl: document.getElementById("book-drive-input").value.trim(),
    isbn: document.getElementById("book-isbn-input").value.trim(),
    category: document.getElementById("book-cat-input").value.trim(),
    edition: document.getElementById("book-edition-input").value.trim(),
    pages: document.getElementById("book-pages-input").value.trim(),
    stock: stockRaw !== "" ? Number(stockRaw) : "",
    notes: document.getElementById("book-notes-input").value.trim()
  };

  try {
    if (coverFile) {
      showToast("جاري ضغط ورفع غلاف الكتاب...", "ri-upload-cloud-2-line");
      payload.coverUrl = await compressAndUploadImage(coverFile);
    }

    if (id) {
      await updateDoc(doc(db, "books", id), payload);
      await logActivity("تعديل عقد كتاب", `تعديل عقد كتاب: ${payload.title}`);
      clearFormDraftByPrefix("book_");
      showToast("تم تحديث الكتاب والعقد بنجاح.");
    } else {
      payload.copiesSold = 0;
      payload.createdAt = serverTimestamp();
      await addDoc(collection(db, "books"), payload);
      await logActivity("إضافة عقد كتاب", `توثيق عقد كتاب "${payload.title}" للمؤلف ${payload.authorName}`);
      clearFormDraftByPrefix("book_");
      showToast("تم توثيق عقد الكتاب بنجاح!");
    }

    if (state.selectedAuthorDetailId === authorId) {
      switchView("view-author-detail");
    } else {
      switchView("view-contracts");
    }
  } catch (err) {
    console.error(err);
    showToast("تعذر حفظ الكتاب", "ri-error-warning-fill");
  } finally {
    btn.disabled = false;
  }
});

// --- د) صفحة استعراض وتحميل عقد الـ PDF ---
function openPdfFullPage(bookId) {
  const b = state.books.find((x) => x.id === bookId);
  if (!b || !b.drivePdfUrl) return;
  const parsed = parseGoogleDriveLink(b.drivePdfUrl);
  document.getElementById("pdf-page-title").innerHTML = `<i class="ri-file-pdf-2-fill" style="color: var(--danger);"></i> عقد كتاب: ${b.title}`;
  document.getElementById("pdf-page-iframe").src = parsed.previewUrl;
  document.getElementById("btn-pdf-direct-download").href = parsed.downloadUrl;
  state.previousViewBeforePdf = state.userRole === "author" ? "view-author-portal" : "view-contracts";
  switchView("view-pdf-page");
}

document.getElementById("btn-close-pdf-page").addEventListener("click", () => {
  document.getElementById("pdf-page-iframe").src = "";
  switchView(state.previousViewBeforePdf);
});

// --- هـ) صفحة تسجيل دفعة مالية + إيصال ---
document.getElementById("btn-detail-add-payout").addEventListener("click", () => {
  if (!state.selectedAuthorDetailId) return;
  document.getElementById("form-payout").reset();
  document.getElementById("payout-author-id").value = state.selectedAuthorDetailId;
  restoreDraftValuesToInputs("payout_");
  switchView("view-form-payout");
});

document.getElementById("form-payout").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("btn-submit-payout");
  btn.disabled = true;

  const authorId = document.getElementById("payout-author-id").value;
  const author = state.authors.find((a) => a.id === authorId);
  const amount = Number(document.getElementById("payout-amount-input").value);
  const method = document.getElementById("payout-method-input").value;
  const notes = document.getElementById("payout-notes-input").value.trim();
  const receiptFile = document.getElementById("payout-receipt-file").files[0];

  try {
    let receiptUrl = "";
    if (receiptFile) {
      showToast("جاري ضغط ورفع صورة الإيصال...", "ri-upload-cloud-2-line");
      receiptUrl = await compressAndUploadImage(receiptFile, 1000, 0.8);
    }

    await addDoc(collection(db, "payouts"), {
      authorId,
      authorName: author ? author.name : "مؤلف",
      amount,
      method,
      notes,
      receiptUrl,
      paidBy: state.userEmail,
      dateString: getTodayDate(),
      createdAt: serverTimestamp()
    });

    await logActivity("تسديد دفعة لمؤلف", `تحويل ${formatEGP(amount)} للمؤلف (${author ? author.name : ""}) عبر ${method}`);
    clearFormDraftByPrefix("payout_");
    showToast("تم توثيق الدفعة المالية والإيصال!");
    switchView("view-author-detail");
  } catch (err) {
    console.error(err);
    showToast("تعذر حفظ الدفعة", "ri-error-warning-fill");
  } finally {
    btn.disabled = false;
  }
});

// --- و) صفحة تسجيل مصروف تشغيلي ---
document.getElementById("btn-goto-add-expense").addEventListener("click", () => {
  document.getElementById("form-expense").reset();
  restoreDraftValuesToInputs("exp_");
  switchView("view-form-expense");
});

document.getElementById("form-expense").addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = document.getElementById("expense-title-input").value.trim();
  const amount = Number(document.getElementById("expense-amount-input").value);
  const category = document.getElementById("expense-cat-input").value;

  try {
    await addDoc(collection(db, "expenses"), {
      title,
      amount,
      category,
      addedBy: state.userProfile.displayName || state.userEmail,
      dateString: getTodayDate(),
      createdAt: serverTimestamp()
    });
    await logActivity("تسجيل مصروف", `مصروف (${title}) بقيمة ${formatEGP(amount)}`);
    clearFormDraftByPrefix("exp_");
    showToast("تم توثيق المصروف التشغيلي.");
    switchView("view-finance");
  } catch (err) {
    console.error(err);
  }
});

function renderFinanceList() {
  const el = document.getElementById("finance-list");
  if (!el) return;
  const combined = sortDesc([
    ...state.sales.map((s) => ({ ...s, type: "sale" })),
    ...state.expenses.map((x) => ({ ...x, type: "expense" })),
    ...state.payouts.map((p) => ({ ...p, type: "payout" }))
  ]);

  if (!combined.length) {
    el.innerHTML = `<div style="text-align: center; padding: 30px; background: var(--bg-card); border-radius: 12px; color: var(--text-muted);">لا توجد حركات مالية مسجلة بعد.</div>`;
    return;
  }

  el.innerHTML = combined
    .slice(0, 75)
    .map((item) => {
      if (item.type === "sale") {
        const qty = Number(item.qty || 1);
        const tot = Number(item.totalAmount || item.price || 0);
        return `
          <div class="list-row">
            <div>
              <h4 style="font-size: 14.5px; font-weight: 800;">بيع (${qty} نسخة): ${item.bookTitle} <span class="pill green">+${formatEGP(tot)}</span></h4>
              <p style="font-size: 12px; color: var(--text-secondary);">المؤلف: ${item.authorName} • القناة: ${item.channel || "مباشر"} • بواسطة: ${item.soldByName || item.soldBy} • ${item.dateString}</p>
            </div>
            ${
              state.userRole === "super_admin"
                ? `<button class="tool-btn danger" data-action="delete-sale" data-id="${item.id}" data-book-id="${item.bookId}" data-qty="${qty}"><i class="ri-delete-bin-line"></i></button>`
                : ""
            }
          </div>
        `;
      } else if (item.type === "payout") {
        return `
          <div class="list-row">
            <div>
              <h4 style="font-size: 14.5px; font-weight: 800;">دفعة لمؤلف: ${item.authorName} <span class="pill crimson">-${formatEGP(item.amount)}</span></h4>
              <p style="font-size: 12px; color: var(--text-secondary);">الطريقة: ${item.method} • ${item.dateString} ${item.receiptUrl ? `• <a href="${item.receiptUrl}" target="_blank" style="color: var(--brand-crimson); font-weight: 800;">عرض الإيصال</a>` : ""}</p>
            </div>
          </div>
        `;
      } else {
        return `
          <div class="list-row">
            <div>
              <h4 style="font-size: 14.5px; font-weight: 800;">مصروف: ${item.title} <span class="pill red">-${formatEGP(item.amount)}</span></h4>
              <p style="font-size: 12px; color: var(--text-secondary);">${item.category} • بواسطة: ${item.addedBy} • ${item.dateString}</p>
            </div>
            ${
              state.permissions.expenses
                ? `<button class="tool-btn danger" data-action="delete-expense" data-id="${item.id}"><i class="ri-delete-bin-line"></i></button>`
                : ""
            }
          </div>
        `;
      }
    })
    .join("");
}

// ==========================================================================
// 13. إدارة الموظفين ومصفوفة الصلاحيات الـ 8 المرنة (Staff & 8 Permissions)
// ==========================================================================
document.getElementById("btn-goto-add-staff").addEventListener("click", () => openStaffFormPage(null));

document.getElementById("btn-perms-select-all").addEventListener("click", () => {
  ["perm-sell", "perm-add-book", "perm-delete-book", "perm-authors", "perm-payouts", "perm-expenses", "perm-finance-view", "perm-reports"].forEach((id) => {
    document.getElementById(id).checked = true;
  });
});

document.getElementById("btn-perms-sell-only").addEventListener("click", () => {
  ["perm-add-book", "perm-delete-book", "perm-authors", "perm-payouts", "perm-expenses", "perm-finance-view", "perm-reports"].forEach((id) => {
    document.getElementById(id).checked = false;
  });
  document.getElementById("perm-sell").checked = true;
});

function openStaffFormPage(editId = null) {
  const form = document.getElementById("form-staff");
  form.reset();
  if (editId) {
    const s = state.staff.find((x) => x.id === editId);
    if (!s) return;
    document.getElementById("staff-id-input").value = s.id;
    document.getElementById("staff-name-input").value = s.name || "";
    document.getElementById("staff-email-input").value = s.email || "";
    document.getElementById("staff-title-input").value = s.jobTitle || "";

    const p = s.permissions || DEFAULT_PERMS;
    document.getElementById("perm-sell").checked = !!p.sell;
    document.getElementById("perm-add-book").checked = p.addBook !== undefined ? !!p.addBook : true;
    document.getElementById("perm-delete-book").checked = !!p.deleteBook;
    document.getElementById("perm-authors").checked = p.authors !== undefined ? !!p.authors : true;
    document.getElementById("perm-payouts").checked = !!p.payouts;
    document.getElementById("perm-expenses").checked = !!p.expenses;
    document.getElementById("perm-finance-view").checked = !!p.financeView;
    document.getElementById("perm-reports").checked = p.reports !== undefined ? !!p.reports : true;
    document.getElementById("staff-restricted-check").checked = !!s.restricted;

    document.getElementById("form-staff-heading").textContent = `تعديل صلاحيات الموظف: ${s.name}`;
  } else {
    document.getElementById("staff-id-input").value = "";
    document.getElementById("form-staff-heading").textContent = "إضافة موظف وتخصيص صلاحياته";
    restoreDraftValuesToInputs("staff_");
  }
  switchView("view-form-staff");
}

document.getElementById("form-staff").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("staff-id-input").value;
  const email = document.getElementById("staff-email-input").value.trim().toLowerCase();

  if (isSuperAdminEmail(email)) {
    showToast("هذا البريد يتمتع بصلاحية عليا تلقائياً ولا يضاف كموظف.", "ri-shield-star-line");
    return;
  }

  const permissions = {
    sell: document.getElementById("perm-sell").checked,
    addBook: document.getElementById("perm-add-book").checked,
    deleteBook: document.getElementById("perm-delete-book").checked,
    authors: document.getElementById("perm-authors").checked,
    payouts: document.getElementById("perm-payouts").checked,
    expenses: document.getElementById("perm-expenses").checked,
    financeView: document.getElementById("perm-finance-view").checked,
    reports: document.getElementById("perm-reports").checked
  };

  const payload = {
    name: document.getElementById("staff-name-input").value.trim(),
    email,
    jobTitle: document.getElementById("staff-title-input").value.trim(),
    permissions,
    restricted: document.getElementById("staff-restricted-check").checked
  };

  try {
    if (id) {
      await updateDoc(doc(db, "staff", id), payload);
      showToast("تم تحديث صلاحيات الموظف فوراً.");
    } else {
      payload.createdAt = serverTimestamp();
      await addDoc(collection(db, "staff"), payload);
      showToast("تم اعتماد الموظف وصلاحياته بنجاح!");
    }
    clearFormDraftByPrefix("staff_");
    switchView("view-staff");
  } catch (err) {
    console.error(err);
  }
});

function renderStaffGrid() {
  const el = document.getElementById("staff-grid");
  if (!el) return;
  const visible = state.staff.filter((s) => !isSuperAdminEmail(s.email));

  if (!visible.length) {
    el.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 34px; background: var(--bg-card); border-radius: 12px; color: var(--text-muted);">لا يوجد موظفون مضافون حالياً. اضغط "إضافة موظف وتخصيص صلاحياته".</div>`;
    return;
  }

  el.innerHTML = visible
    .map((s) => {
      const count = state.activityLogs.filter((l) => l.actorEmail === s.email).length;
      const p = s.permissions || {};
      const activePermsCount = Object.values(p).filter(Boolean).length;

      return `
        <div class="entity-card">
          <div>
            <div class="card-head">
              <div class="author-thumb"><i class="ri-user-settings-fill"></i></div>
              <div class="card-title-area">
                ${s.restricted ? `<span class="pill red">مقيّد / مجمد</span>` : `<span class="pill green">نشط (${activePermsCount}/8 صلاحيات)</span>`}
                <div class="card-title">${s.name}</div>
                <div class="card-sub" dir="ltr">${s.email}</div>
                ${s.jobTitle ? `<span style="font-size: 11px; color: var(--text-muted);">${s.jobTitle}</span>` : ""}
              </div>
            </div>

            <div class="card-stats-grid">
              <div class="stat-cell"><span>العمليات الموثقة</span><strong style="color: var(--brand-crimson);">${count} عملية</strong></div>
              <div class="stat-cell"><span>حالة الحساب</span><strong>${s.restricted ? "موقوف" : "مفعل"}</strong></div>
            </div>
          </div>

          <div class="card-actions">
            <button class="btn btn-outline" style="flex: 1; padding: 8px 10px;" data-action="inspect-staff" data-email="${s.email}" data-name="${s.name}">
              <i class="ri-eye-line"></i><span>سجل نشاطه</span>
            </button>
            <button class="tool-btn" title="تعديل الصلاحيات" data-action="edit-staff" data-id="${s.id}">
              <i class="ri-equalizer-line"></i>
            </button>
            <button class="tool-btn danger" title="حذف الموظف" data-action="delete-staff" data-id="${s.id}">
              <i class="ri-delete-bin-line"></i>
            </button>
          </div>
        </div>
      `;
    })
    .join("");
}

// ==========================================================================
// 14. التنبيهات، الملف الشخصي، التقارير، وبوابة الكاتب، ولوحة التعليمات
// ==========================================================================
function populateNotifTargets() {
  const sel = document.getElementById("notif-target-select");
  if (!sel) return;
  sel.innerHTML =
    `<option value="all">جميع الموظفين وفريق العمل</option>` +
    state.staff
      .filter((s) => !isSuperAdminEmail(s.email))
      .map((s) => `<option value="${s.email}">${s.name} (${s.email})</option>`)
      .join("");
}

document.getElementById("btn-goto-send-notif").addEventListener("click", () => switchView("view-form-notif"));
document.getElementById("btn-notif-page-new").addEventListener("click", () => switchView("view-form-notif"));

document.getElementById("form-notif").addEventListener("submit", async (e) => {
  e.preventDefault();
  await addDoc(collection(db, "notifications"), {
    target: document.getElementById("notif-target-select").value,
    priority: document.getElementById("notif-priority-select").value,
    title: document.getElementById("notif-title-input").value.trim(),
    body: document.getElementById("notif-body-input").value.trim(),
    senderName: state.userProfile.displayName || "الإدارة",
    dateString: getTodayDate(),
    createdAt: serverTimestamp()
  });
  clearFormDraftByPrefix("notif_");
  showToast("تم إرسال التنبيه بنجاح!");
  switchView("view-notifications");
});

function renderNotifications() {
  const el = document.getElementById("notifications-list");
  if (!el) return;
  const mine = state.notifications.filter(
    (n) => state.userRole === "super_admin" || n.target === "all" || n.target === state.userEmail
  );

  const badge = document.getElementById("nav-notif-badge");
  const dot = document.getElementById("topbar-notif-dot");
  if (mine.length) {
    badge.textContent = mine.length;
    badge.style.display = "inline-block";
    dot.style.display = "block";
  } else {
    badge.style.display = "none";
    dot.style.display = "none";
  }

  el.innerHTML = mine.length
    ? mine
        .map(
          (n) => `
        <div class="list-row" style="border-right: 4px solid ${n.priority === "urgent" ? "var(--danger)" : "var(--brand-gold)"};">
          <div>
            <div style="display: flex; gap: 6px; align-items: center; margin-bottom: 4px;">
              <span class="pill ${n.priority === "urgent" ? "red" : "amber"}">${n.priority === "urgent" ? "تنبيه عاجل" : "توجيه إداري"}</span>
              <span style="font-size: 11.5px; color: var(--text-muted);">${n.dateString} • إلى: ${n.target === "all" ? "الجميع" : n.target}</span>
            </div>
            <h4 style="font-size: 15px; font-weight: 800;">${n.title}</h4>
            <p style="font-size: 13px; color: var(--text-secondary);">${n.body}</p>
          </div>
        </div>
      `
        )
        .join("")
    : `<div style="text-align: center; padding: 30px; background: var(--bg-card); border-radius: 12px; color: var(--text-muted);">لا توجد تنبيهات حالياً.</div>`;
}

// الملف الشخصي وسجل النشاط
document.getElementById("form-update-profile").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("btn-save-profile");
  btn.disabled = true;

  const newName = document.getElementById("profile-name-input").value.trim();
  const file = document.getElementById("profile-avatar-file").files[0];

  try {
    let avatarUrl = state.userProfile.avatarUrl;
    if (file) {
      showToast("جاري ضغط ورفع صورتك...", "ri-upload-cloud-2-line");
      avatarUrl = await compressAndUploadImage(file, 500, 0.8);
    }
    await setDoc(doc(db, "user_profiles", state.userEmail), { displayName: newName, avatarUrl, updatedAt: serverTimestamp() }, { merge: true });
    state.userProfile.displayName = newName;
    state.userProfile.avatarUrl = avatarUrl;
    refreshUserTopbarAndProfile();
    updateEgyptianGreeting();
    showToast("تم حفظ تعديلات ملفك الشخصي!");
  } catch (err) {
    console.error(err);
  } finally {
    btn.disabled = false;
  }
});

document.getElementById("btn-Reset-my-logs").addEventListener("click", () => {
  state.inspectingStaffEmail = null;
  document.getElementById("activity-log-heading").innerHTML = `<i class="ri-history-line" style="color: var(--brand-crimson);"></i> <span>سجل نشاطي والعمليات الموثقة</span>`;
  document.getElementById("btn-Reset-my-logs").style.display = "none";
  renderActivityLogs();
});

function renderActivityLogs() {
  const el = document.getElementById("activity-log-list");
  if (!el) return;
  const target = state.inspectingStaffEmail || state.userEmail;
  const list = state.activityLogs.filter((l) => l.actorEmail === target);

  el.innerHTML = list.length
    ? list
        .slice(0, 60)
        .map(
          (l) => `
        <div class="list-row">
          <div>
            <h4 style="font-size: 14px; font-weight: 800;">${l.actionTitle}</h4>
            <p style="font-size: 12.5px; color: var(--text-secondary);">${l.detailsText}</p>
          </div>
          <span class="pill blue">${l.dateString}</span>
        </div>
      `
        )
        .join("")
    : `<div style="text-align: center; padding: 24px; background: var(--bg-card); border-radius: 12px; color: var(--text-muted);">لا توجد عمليات موثقة لهذا الحساب بعد.</div>`;
}

// صفحة التقارير والترحيب بالكاتب
document.getElementById("btn-detail-send-report").addEventListener("click", () => {
  if (state.selectedAuthorDetailId) openReportPage(state.selectedAuthorDetailId, "full_sales");
});

document.getElementById("btn-detail-copy-link").addEventListener("click", () => {
  const url = getBaseSiteUrl();
  navigator.clipboard.writeText(url);
  showToast(`تم نسخ رابط النظام (${url})! أرسله للكاتب ليسجل دخوله ببريده.`);
});

function openReportPage(authorId, type = "full_sales") {
  document.getElementById("report-author-id").value = authorId;
  document.getElementById("report-type-select").value = type;
  buildReportText();
  switchView("view-form-report");
}

document.getElementById("report-type-select").addEventListener("change", buildReportText);

function buildReportText() {
  const authorId = document.getElementById("report-author-id").value;
  const type = document.getElementById("report-type-select").value;
  const a = state.authors.find((x) => x.id === authorId);
  if (!a) return;

  const siteUrl = getBaseSiteUrl();
  const aBooks = state.books.filter((b) => b.authorId === authorId);
  const aPayouts = state.payouts.filter((p) => p.authorId === authorId);

  let copies = 0;
  let earned = 0;
  const lines = aBooks
    .map((b) => {
      const c = Number(b.copiesSold || 0);
      const roy = c * Number(b.price || 0) * (Number(b.royaltyRate || 0) / 100);
      copies += c;
      earned += roy;
      const st = calculateContractStatus(b.contractDate, b.contractMonths);
      return `• كتاب (${b.title}): المباع ${c} نسخة | نسبتك (${b.royaltyRate}%): ${formatEGP(roy)} | العقد: ${st.label}`;
    })
    .join("\n");

  const paid = aPayouts.reduce((s, p) => s + Number(p.amount || 0), 0);
  const balance = Math.max(0, earned - paid);

  let text = "";
  if (type === "welcome") {
    text = `أهلاً ومرحباً بك أ. ${a.name} في دار صفقات كتابية للنشر والتوزيع! 🌟\n\nيسعدنا إبلاغكم بتفعيل حسابكم الشخصي في "نظام صفقات" لمتابعة عقود مؤلفاتكم، المبيعات اللحظية، والحوالات المالية بكل شفافية.\n\n🔹 خطوات الدخول وتثبيت التطبيق:\n1. افتح الرابط الرسمي:\n${siteUrl}\n2. سجل الدخول بحساب Google المعتمد (${a.email}).\n3. اضغط زر "تثبيت التطبيق" بأعلى النظام ليصبح على شاشة هاتفك مباشرة.\n\nمع خالص التحية،\nإدارة صفقات كتابية`;
  } else if (type === "full_sales") {
    text = `تحية طيبة أ. ${a.name}،\nإليكم التقرير المالي المحدث لمؤلفاتكم لدى دار صفقات كتابية حتى (${getTodayDate()}):\n\n${lines || "• لا توجد كتب مسجلة بعد."}\n\n📊 الملخص المالي:\n- إجمالي النسخ المباعة: ${copies} نسخة\n- إجمالي الأرباح المحققة: ${formatEGP(earned)}\n- إجمالي الحوالات المسددة لكم: ${formatEGP(paid)}\n- الرصيد المتبقي المستحق لكم: ${formatEGP(balance)}\n\nبوابتكم المباشرة:\n${siteUrl}\n\nإدارة صفقات كتابية`;
  } else {
    text = `إشعار عقود النشر | أ. ${a.name} المحترم،\nفيما يلي بيان حالة عقود مؤلفاتكم المسجلة في دار صفقات كتابية:\n\n${lines || "-"}\n\nللدخول واستعراض نسخ العقود (PDF):\n${siteUrl}\n\nإدارة صفقات كتابية`;
  }

  document.getElementById("report-text-area").value = text;
}

document.getElementById("btn-copy-report-text").addEventListener("click", () => {
  navigator.clipboard.writeText(document.getElementById("report-text-area").value);
  showToast("تم نسخ نص الرسالة بنجاح!");
});

document.getElementById("btn-send-report-mailto").addEventListener("click", () => {
  const authorId = document.getElementById("report-author-id").value;
  const a = state.authors.find((x) => x.id === authorId);
  if (!a) return;
  const subject = `دار صفقات كتابية | إشعار رسمي - أ. ${a.name}`;
  const body = document.getElementById("report-text-area").value;
  window.location.href = `mailto:${encodeURIComponent(a.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
});

// بوابة الكاتب الخاصة
function renderAuthorPortal() {
  const prof = state.currentAuthorProfile;
  if (!prof) return;

  document.getElementById("portal-author-name").textContent = `أهلاً بك، أ. ${prof.name}`;
  if (prof.avatarUrl) document.getElementById("portal-author-img").src = prof.avatarUrl;

  let copies = 0;
  let earned = 0;
  state.books.forEach((b) => {
    const c = Number(b.copiesSold || 0);
    copies += c;
    earned += c * Number(b.price || 0) * (Number(b.royaltyRate || 0) / 100);
  });

  const paid = state.payouts.reduce((s, p) => s + Number(p.amount || 0), 0);
  const balance = Math.max(0, earned - paid);

  document.getElementById("portal-copies").textContent = `${copies} نسخة`;
  document.getElementById("portal-earned").textContent = formatEGP(earned);
  document.getElementById("portal-paid").textContent = `تم تحويل: ${formatEGP(paid)}`;
  document.getElementById("portal-balance").textContent = formatEGP(balance);

  const bGrid = document.getElementById("portal-books-grid");
  bGrid.innerHTML = state.books.length
    ? state.books
        .map((b) => {
          const sold = Number(b.copiesSold || 0);
          const price = Number(b.price || 0);
          const rate = Number(b.royaltyRate || 0);
          const roy = sold * price * (rate / 100);
          const st = calculateContractStatus(b.contractDate, b.contractMonths);
          return `
            <div class="entity-card">
              <div>
                <div class="card-head">
                  ${b.coverUrl ? `<img src="${b.coverUrl}" class="book-thumb" />` : `<div class="book-thumb"><i class="ri-book-read-fill"></i></div>`}
                  <div class="card-title-area">
                    <span class="pill ${st.pillClass}">${st.label}</span>
                    <div class="card-title">${b.title}</div>
                    <div class="card-sub">بداية العقد: ${b.contractDate} (${b.contractMonths} شهر)</div>
                  </div>
                </div>
                <div class="card-stats-grid">
                  <div class="stat-cell"><span>سعر الكتاب</span><strong>${formatEGP(price)}</strong></div>
                  <div class="stat-cell"><span>نسبتك بالعقد</span><strong>${rate}%</strong></div>
                  <div class="stat-cell"><span>النسخ المباعة</span><strong style="color: var(--brand-crimson);">${sold} نسخة</strong></div>
                  <div class="stat-cell"><span>إجمالي أرباحك</span><strong style="color: var(--success);">${formatEGP(roy)}</strong></div>
                </div>
              </div>
              ${
                b.drivePdfUrl
                  ? `<div class="card-actions">
                       <button class="btn btn-crimson" style="width: 100%;" data-action="open-pdf" data-id="${b.id}">
                         <i class="ri-file-pdf-2-fill"></i><span>استعراض وتحميل العقد (PDF)</span>
                       </button>
                     </div>`
                  : ""
              }
            </div>
          `;
        })
        .join("")
    : `<div style="grid-column: 1/-1; text-align: center; padding: 24px; background: var(--bg-card); border-radius: 12px;">لا توجد عقود كتب مسجلة حالياً.</div>`;

  const pList = document.getElementById("portal-payouts-list");
  pList.innerHTML = state.payouts.length
    ? state.payouts
        .map(
          (p) => `
        <div class="list-row">
          <div>
            <h4 style="font-size: 14.5px; font-weight: 800; color: var(--success);">دفعة محولة لك: ${formatEGP(p.amount)}</h4>
            <p style="font-size: 12px; color: var(--text-secondary);">الطريقة: ${p.method} • التاريخ: ${p.dateString}</p>
          </div>
          ${p.receiptUrl ? `<a href="${p.receiptUrl}" target="_blank" class="btn btn-outline" style="padding: 6px 12px; font-size: 12px;"><i class="ri-image-line"></i><span>عرض الإيصال</span></a>` : ""}
        </div>
      `
        )
        .join("")
    : `<div style="text-align: center; padding: 20px; background: var(--bg-card); border-radius: 12px; color: var(--text-muted);">لا توجد دفعات محولة مسجلة حتى الآن.</div>`;
}

document.getElementById("portal-author-photo-input").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file || !state.currentAuthorProfile) return;
  try {
    showToast("جاري تحديث صورتك الشخصية...", "ri-upload-cloud-2-line");
    const url = await compressAndUploadImage(file, 500, 0.8);
    await updateDoc(doc(db, "authors", state.currentAuthorProfile.id), { avatarUrl: url });
    document.getElementById("portal-author-img").src = url;
    document.getElementById("topbar-user-avatar").src = url;
    showToast("تم تحديث صورتك الشخصية بنجاح!");
  } catch (err) {
    console.error(err);
  }
});

// لوحة التعليمات الذكية حسب الصلاحيات الـ 8
function renderSmartGuideContent() {
  const el = document.getElementById("smart-guide-content");
  if (!el) return;
  const p = state.permissions;

  const item = (allowed, label) =>
    `<div class="perm-item"><span>${allowed ? "✅" : "❌"}</span><span>${label}</span></div>`;

  el.innerHTML = `
    <div class="fullpage-form-card">
      <div class="form-page-header">
        <h3 style="font-size: 16px; font-weight: 800;"><i class="ri-shield-check-fill" style="color: var(--brand-crimson);"></i> صلاحياتك المعتمدة ودليل العمل في النظام</h3>
      </div>
      <div class="form-page-body">
        <div class="perm-grid" style="margin-bottom: 16px;">
          ${item(p.sell, "تسجيل مبيعات الكتب")}
          ${item(p.addBook, "إضافة وتعديل عقود الكتب")}
          ${item(p.deleteBook, "حذف عقود الكتب")}
          ${item(p.authors, "إدارة ملفات الكُتّاب")}
          ${item(p.payouts, "تسديد دفعات وإيصالات الكُتّاب")}
          ${item(p.expenses, "تسجيل المصاريف التشغيلية")}
          ${item(p.financeView, "الاطلاع على أرباح الدار والمالية")}
          ${item(p.reports, "إرسال التقارير للكُتّاب")}
        </div>
        <div class="form-section-box" style="margin-bottom: 0;">
          <div class="form-section-title"><i class="ri-save-3-fill"></i> ميزة الحفظ المؤقت التلقائي</div>
          <p style="font-size: 13px;">جميع صفحات الإدخال تحفظ ما تكتبه تلقائياً في متصفحك؛ إذا خرجت من المتصفح أو الجوال بالخطأ وعدت لاحقاً، سيظهر لك شريط لاستكمال بياناتك من حيث توقفت دون ضياع أي حرف.</p>
        </div>
      </div>
    </div>
  `;
}

// ==========================================================================
// 15. تثبيت التطبيق السريع (PWA Install Triggers)
// ==========================================================================
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  state.deferredPwaPrompt = e;
});

async function handleInstallClick() {
  if (state.deferredPwaPrompt) {
    state.deferredPwaPrompt.prompt();
    await state.deferredPwaPrompt.userChoice;
    state.deferredPwaPrompt = null;
  } else {
    switchView("view-guide");
    showToast("اتبع خطوات التثبيت الموضحة أمامك حسب نوع هاتفك", "ri-smartphone-line");
  }
}

document.getElementById("btn-topbar-install").addEventListener("click", handleInstallClick);
document.getElementById("btn-sidebar-install").addEventListener("click", handleInstallClick);
document.getElementById("btn-guide-install-now").addEventListener("click", handleInstallClick);
