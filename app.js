// ==========================================================================
// Safaqat ERP System - Master Application Engine (app.js)
// Currency: EGP (ج.م) | Full Audit Log, ImgBB, Drive PDF & Granular Roles
// ==========================================================================

import {
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
  serverTimestamp,
  isSuperAdminEmail,
  compressAndUploadImage,
  parseGoogleDriveUrl
} from "./firebase-config.js";

// ==========================================================================
// 1. حالة النظام المركزية (Central Application State)
// ==========================================================================
const state = {
  currentUser: null,
  userEmail: "",
  userRole: null, // 'super_admin' | 'employee' | 'author'
  permissions: {
    sell: true,
    books: true,
    authors: true,
    finance: true
  },
  userProfile: {
    displayName: "",
    avatarUrl: "https://cdn-icons-png.flaticon.com/512/149/149071.png"
  },
  currentAuthorProfile: null,
  selectedAuthorDetailId: null,
  inspectingStaffEmail: null,

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

const DEFAULT_AVATAR = "https://cdn-icons-png.flaticon.com/512/149/149071.png";

// تسجيل Service Worker لتفعيل تثبيت التطبيق (PWA)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

// ==========================================================================
// 2. دوال مساعدة (Currency EGP, Dates, Egyptian Greeting, Modals, Toasts)
// ==========================================================================
function formatEGP(num) {
  const val = Number(num || 0);
  return val.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + " ج.م";
}

function getTodayDate() {
  return new Date().toISOString().split("T")[0];
}

function getCurrentSiteBaseUrl() {
  return `${window.location.origin}${window.location.pathname}`;
}

function updateEgyptianGreeting() {
  const hour = new Date().getHours();
  const name = state.userProfile.displayName || "يا بطل";
  let greeting = "";
  let sub = "";

  if (hour >= 4 && hour < 12) {
    greeting = `يا صباح الفل والياسمين يا أ. ${name}! ☀️`;
    sub = "نهارك نادي ومليان بركة ورزق.. شغل موفق النهاردة بإذن الله";
  } else if (hour >= 12 && hour < 17) {
    greeting = `يا مساء النشاط والجمال يا أ. ${name}! ✨`;
    sub = "يعطيك العافية على مجهودك الجميل.. ربنا يبارك في شغلك";
  } else {
    greeting = `يا مساء الفل والروقان يا أ. ${name}! 🌙`;
    sub = "تسلم إيدك على تعبك النهاردة.. بالتوفيق دايماً في صفقات كتابية";
  }

  const titleEl = document.getElementById("egyptian-greeting-title");
  const subEl = document.getElementById("egyptian-greeting-sub");
  if (titleEl) titleEl.textContent = greeting;
  if (subEl) subEl.textContent = sub;
}

function calculateContractStatus(startDateStr, durationMonths) {
  if (!startDateStr || !durationMonths) {
    return { endDateStr: "غير محدد", daysLeft: 0, label: "غير محدد", badgeClass: "blue" };
  }
  const start = new Date(startDateStr);
  const end = new Date(start);
  end.setMonth(end.getMonth() + Number(durationMonths));

  const now = new Date();
  const diffTime = end.getTime() - now.getTime();
  const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const endDateStr = end.toISOString().split("T")[0];

  if (daysLeft < 0) {
    return { endDateStr, daysLeft, label: `منتهي منذ ${Math.abs(daysLeft)} يوم`, badgeClass: "red" };
  } else if (daysLeft <= 30) {
    return { endDateStr, daysLeft, label: `ينتهي خلال ${daysLeft} يوم`, badgeClass: "amber" };
  } else {
    return { endDateStr, daysLeft, label: `عقد ساري (${daysLeft} يوم)`, badgeClass: "green" };
  }
}

function showToast(message, icon = "ri-checkbox-circle-fill") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `<i class="${icon}" style="font-size: 19px; color: #38bdf8;"></i><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 250);
  }, 3400);
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("show");
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("show");
}

function askCustomConfirmation(title, message, onConfirmCallback) {
  document.getElementById("confirm-action-title").textContent = title;
  document.getElementById("confirm-action-msg").textContent = message;
  state.confirmCallback = onConfirmCallback;
  openModal("modal-confirm-action");
}

document.getElementById("btn-confirm-action-yes").addEventListener("click", async () => {
  closeModal("modal-confirm-action");
  if (typeof state.confirmCallback === "function") {
    await state.confirmCallback();
    state.confirmCallback = null;
  }
});

function sortByTimestampDesc(arr) {
  return [...arr].sort((a, b) => {
    const tA = a.createdAt?.seconds || 0;
    const tB = b.createdAt?.seconds || 0;
    return tB - tA;
  });
}

// توثيق نشاط الموظف أو الإداري في سجل الرقابة (Audit Log)
async function logUserActivity(actionTitle, detailsText) {
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
  } catch (err) {
    console.warn("Audit log error:", err);
  }
}

function clearSubscriptions() {
  state.unsubscribers.forEach((u) => typeof u === "function" && u());
  state.unsubscribers = [];
}

// ==========================================================================
// 3. نظام المصادقة والتحقق من القائمة البيضاء والحاكم الخفي (Auth & Whitelist)
// ==========================================================================
document.getElementById("btn-google-login").addEventListener("click", async () => {
  document.getElementById("auth-error-box").style.display = "none";
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (err) {
    console.error("Google Auth Error:", err);
    const errBox = document.getElementById("auth-error-box");
    document.getElementById("auth-error-text").textContent =
      "تعذر فتح نافذة تسجيل الدخول. تأكد من تفعيل Google في Firebase وإضافة الدومين.";
    errBox.style.display = "block";
  }
});

// نافذة تأكيد تسجيل الخروج المخصصة
document.getElementById("btn-trigger-logout").addEventListener("click", () => {
  openModal("modal-confirm-logout");
});

document.getElementById("btn-confirm-logout-exec").addEventListener("click", async () => {
  closeModal("modal-confirm-logout");
  clearSubscriptions();
  await signOut(auth);
});

onAuthStateChanged(auth, async (user) => {
  clearSubscriptions();
  const authScreen = document.getElementById("auth-screen");
  const appScreen = document.getElementById("app-screen");
  const authErrorBox = document.getElementById("auth-error-box");
  const authErrorText = document.getElementById("auth-error-text");

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
    // جلب الملف الشخصي المخصص إن وجد
    const profileSnap = await getDoc(doc(db, "user_profiles", email));
    if (profileSnap.exists()) {
      const pData = profileSnap.data();
      state.userProfile.displayName = pData.displayName || user.displayName || email.split("@")[0];
      state.userProfile.avatarUrl = pData.avatarUrl || user.photoURL || DEFAULT_AVATAR;
    } else {
      state.userProfile.displayName = user.displayName || email.split("@")[0];
      state.userProfile.avatarUrl = user.photoURL || DEFAULT_AVATAR;
    }

    // 1. فحص الحاكم الخفي (الإدارة العليا المطلقة - الثلاث إيميلات)
    if (isSuperAdminEmail(email)) {
      state.userRole = "super_admin";
      state.permissions = { sell: true, books: true, authors: true, finance: true };
      initializeWorkspaceUI();
      return;
    }

    // 2. فحص هل هو موظف في القائمة البيضاء (staff)
    const staffQ = query(collection(db, "staff"), where("email", "==", email));
    const staffSnap = await getDocs(staffQ);
    if (!staffSnap.empty) {
      const staffData = staffSnap.docs[0].data();
      if (staffData.restricted) {
        await signOut(auth);
        authErrorText.textContent = "تم تقييد وتجميد حسابك مؤقتاً من قِبل الإدارة. يرجى مراجعة المسؤول.";
        authErrorBox.style.display = "block";
        authScreen.style.display = "flex";
        appScreen.style.display = "none";
        return;
      }

      state.userRole = "employee";
      if (staffData.permMode === "custom" && staffData.permissions) {
        state.permissions = {
          sell: !!staffData.permissions.sell,
          books: !!staffData.permissions.books,
          authors: !!staffData.permissions.authors,
          finance: !!staffData.permissions.finance
        };
      } else {
        state.permissions = { sell: true, books: true, authors: true, finance: true };
      }

      if (!profileSnap.exists() && staffData.name) {
        state.userProfile.displayName = staffData.name;
      }
      initializeWorkspaceUI();
      return;
    }

    // 3. فحص هل هو كاتب مسجل في قاعدة البيانات (authors)
    const authorQ = query(collection(db, "authors"), where("email", "==", email));
    const authorSnap = await getDocs(authorQ);
    if (!authorSnap.empty) {
      const aDoc = authorSnap.docs[0];
      state.userRole = "author";
      state.currentAuthorProfile = { id: aDoc.id, ...aDoc.data() };
      state.userProfile.displayName = state.currentAuthorProfile.name || state.userProfile.displayName;
      if (state.currentAuthorProfile.avatarUrl) {
        state.userProfile.avatarUrl = state.currentAuthorProfile.avatarUrl;
      }
      initializeWorkspaceUI();
      return;
    }

    // 4. غير مصرح له بالدخول -> رفض فوري
    await signOut(auth);
    authErrorText.textContent = `البريد (${email}) غير معتمد في النظام. الدخول مقتصر على الحسابات المضافة من الإدارة.`;
    authErrorBox.style.display = "block";
    authScreen.style.display = "flex";
    appScreen.style.display = "none";
  } catch (err) {
    console.error("Access Check Error:", err);
    authErrorText.textContent = "حدث خطأ أثناء الاتصال بقاعدة البيانات. تأكد من تفعيل Firestore Rules.";
    authErrorBox.style.display = "block";
  }
});

// ==========================================================================
// 4. تهيئة واجهة العمل حسب الصلاحيات (Workspace & Role UI Adaptation)
// ==========================================================================
function initializeWorkspaceUI() {
  document.getElementById("auth-screen").style.display = "none";
  document.getElementById("app-screen").style.display = "flex";

  updateHeaderAndProfileDisplay();
  updateEgyptianGreeting();
  renderSmartGuide();

  // إظهار أو إخفاء عناصر القائمة الجانبية حسب الصلاحيات
  const navDashboard = document.getElementById("nav-dashboard");
  const navContracts = document.getElementById("nav-contracts");
  const navAuthors = document.getElementById("nav-authors");
  const navFinance = document.getElementById("nav-finance");
  const navStaff = document.getElementById("nav-staff");
  const navNotif = document.getElementById("nav-notifications");
  const navProfile = document.getElementById("nav-profile");

  if (state.userRole === "author") {
    navDashboard.style.display = "none";
    navContracts.style.display = "none";
    navAuthors.style.display = "none";
    navFinance.style.display = "none";
    navStaff.style.display = "none";
    navNotif.style.display = "none";
    navProfile.style.display = "none";

    switchView("view-author-portal");
    startAuthorRealtimeListeners(state.currentAuthorProfile.id);
    return;
  }

  // للإدارة والموظفين
  navDashboard.style.display = "flex";
  navContracts.style.display = "flex";
  navAuthors.style.display = state.permissions.authors ? "flex" : "none";
  navFinance.style.display = state.permissions.finance ? "flex" : "none";
  navStaff.style.display = state.userRole === "super_admin" ? "flex" : "none";
  navNotif.style.display = "flex";
  navProfile.style.display = "flex";

  // التحكم في أزرار الإضافة حسب الصلاحية المجزأة
  document.getElementById("btn-open-new-contract").style.display = state.permissions.books ? "inline-flex" : "none";
  document.getElementById("btn-open-new-author").style.display = state.permissions.authors ? "inline-flex" : "none";
  document.getElementById("btn-send-notif-from-page").style.display = state.userRole === "super_admin" ? "inline-flex" : "none";

  // إخفاء كروت الأرباح الحساسة عن الموظف الذي لا يملك صلاحية مالية
  document.getElementById("dashboard-stats-container").style.display = state.permissions.finance ? "grid" : "none";

  switchView("view-dashboard");
  startAdminAndStaffListeners();
}

function updateHeaderAndProfileDisplay() {
  const roleLabel =
    state.userRole === "super_admin"
      ? "إدارة النظام"
      : state.userRole === "employee"
      ? "فريق العمل"
      : "مؤلف معتمد";

  document.getElementById("header-user-name").textContent = state.userProfile.displayName;
  document.getElementById("header-user-role").textContent = roleLabel;
  document.getElementById("header-user-avatar").src = state.userProfile.avatarUrl || DEFAULT_AVATAR;

  document.getElementById("profile-page-name").textContent = state.userProfile.displayName;
  document.getElementById("profile-page-email").textContent = state.userEmail;
  document.getElementById("profile-page-role-badge").textContent = roleLabel;
  document.getElementById("profile-page-avatar").src = state.userProfile.avatarUrl || DEFAULT_AVATAR;
  document.getElementById("profile-input-name").value = state.userProfile.displayName;
}

function switchView(viewId) {
  document.querySelectorAll(".app-view").forEach((v) => (v.style.display = "none"));
  const target = document.getElementById(viewId);
  if (target) target.style.display = "block";

  document.querySelectorAll(".sidebar-nav .nav-item").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-view") === viewId);
  });
}

// التنقل عبر القائمة الجانبية
document.querySelectorAll(".sidebar-nav .nav-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    const viewId = btn.getAttribute("data-view");
    if (viewId === "view-profile") {
      state.inspectingStaffEmail = null;
      document.getElementById("activity-log-title").textContent = "سجل نشاطي والعمليات الموثقة في النظام";
      renderUserActivityLogs();
    }
    switchView(viewId);
  });
});

document.getElementById("btn-header-profile").addEventListener("click", () => {
  if (state.userRole === "author") return;
  state.inspectingStaffEmail = null;
  document.getElementById("activity-log-title").textContent = "سجل نشاطي والعمليات الموثقة في النظام";
  renderUserActivityLogs();
  switchView("view-profile");
});

document.getElementById("btn-header-notif").addEventListener("click", () => {
  if (state.userRole === "author") return;
  switchView("view-notifications");
});

document.getElementById("btn-go-all-books").addEventListener("click", () => {
  switchView("view-contracts");
});

// ==========================================================================
// 5. الاستماع اللحظي لقاعدة البيانات بدون تعليق (Real-time Listeners)
// ==========================================================================
function startAdminAndStaffListeners() {
  // 1. الكُتّاب
  const unsubAuthors = onSnapshot(collection(db, "authors"), (snap) => {
    state.authors = sortByTimestampDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    populateAuthorSelect();
    renderAuthorsGrid();
    if (state.selectedAuthorDetailId) renderAuthorDetailView(state.selectedAuthorDetailId);
    updateFinancialDashboard();
  });

  // 2. الكتب والعقود
  const unsubBooks = onSnapshot(collection(db, "books"), (snap) => {
    state.books = sortByTimestampDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    renderBooksAndContractsGrid();
    renderFavoriteBooksGrid();
    renderAuthorsGrid();
    if (state.selectedAuthorDetailId) renderAuthorDetailView(state.selectedAuthorDetailId);
    updateFinancialDashboard();
    renderMainChart();
  });

  // 3. المبيعات
  const unsubSales = onSnapshot(collection(db, "sales"), (snap) => {
    state.sales = sortByTimestampDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    renderFinanceTimeline();
    updateFinancialDashboard();
  });

  // 4. المصاريف
  const unsubExpenses = onSnapshot(collection(db, "expenses"), (snap) => {
    state.expenses = sortByTimestampDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    renderFinanceTimeline();
    updateFinancialDashboard();
  });

  // 5. الدفعات المسددة للكُتّاب (Payouts)
  const unsubPayouts = onSnapshot(collection(db, "payouts"), (snap) => {
    state.payouts = sortByTimestampDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    renderFinanceTimeline();
    if (state.selectedAuthorDetailId) renderAuthorDetailView(state.selectedAuthorDetailId);
    updateFinancialDashboard();
  });

  // 6. التنبيهات الإدارية
  const unsubNotifs = onSnapshot(collection(db, "notifications"), (snap) => {
    state.notifications = sortByTimestampDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    renderNotificationsList();
  });

  // 7. سجل نشاط الموظفين والعمليات
  const unsubLogs = onSnapshot(collection(db, "activity_logs"), (snap) => {
    state.activityLogs = sortByTimestampDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    renderUserActivityLogs();
  });

  // 8. الموظفون (للإدارة العليا فقط)
  if (state.userRole === "super_admin") {
    const unsubStaff = onSnapshot(collection(db, "staff"), (snap) => {
      state.staff = sortByTimestampDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      renderStaffManagementGrid();
      populateNotificationTargets();
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
  const unsubAuthor = onSnapshot(doc(db, "authors", authorId), (docSnap) => {
    if (docSnap.exists()) {
      state.currentAuthorProfile = { id: docSnap.id, ...docSnap.data() };
      renderAuthorPortalView();
    }
  });

  const unsubBooks = onSnapshot(query(collection(db, "books"), where("authorId", "==", authorId)), (snap) => {
    state.books = sortByTimestampDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    renderAuthorPortalView();
  });

  const unsubPayouts = onSnapshot(query(collection(db, "payouts"), where("authorId", "==", authorId)), (snap) => {
    state.payouts = sortByTimestampDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    renderAuthorPortalView();
  });

  state.unsubscribers.push(unsubAuthor, unsubBooks, unsubPayouts);
}

// ==========================================================================
// 6. لوحة الإحصائيات والرسوم البيانية التفاعلية (Dashboard & Chart.js)
// ==========================================================================
function updateFinancialDashboard() {
  let totalRevenue = 0;
  let totalCopies = 0;
  let totalAuthorsEarned = 0;

  state.books.forEach((b) => {
    const sold = Number(b.copiesSold || 0);
    const price = Number(b.price || 0);
    const rate = Number(b.royaltyRate || 0);
    const rev = sold * price;
    const authorCut = rev * (rate / 100);

    totalCopies += sold;
    totalRevenue += rev;
    totalAuthorsEarned += authorCut;
  });

  const totalAuthorsPaid = state.payouts.reduce((s, p) => s + Number(p.amount || 0), 0);
  const unpaidRoyalties = Math.max(0, totalAuthorsEarned - totalAuthorsPaid);
  const totalExpenses = state.expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const netHouseProfit = totalRevenue - totalAuthorsEarned - totalExpenses;

  document.getElementById("stat-total-revenue").textContent = formatEGP(totalRevenue);
  document.getElementById("stat-total-copies").textContent = `${totalCopies} نسخة مباعة`;
  document.getElementById("stat-net-profit").textContent = formatEGP(netHouseProfit);
  document.getElementById("stat-authors-unpaid").textContent = formatEGP(unpaidRoyalties);
  document.getElementById("stat-authors-paid-sub").textContent = `تم سداد: ${formatEGP(totalAuthorsPaid)}`;
  document.getElementById("stat-total-expenses").textContent = formatEGP(totalExpenses);
}

function renderMainChart() {
  const canvas = document.getElementById("mainSalesChart");
  if (!canvas || typeof Chart === "undefined") return;

  const topBooks = [...state.books]
    .sort((a, b) => Number(b.copiesSold || 0) - Number(a.copiesSold || 0))
    .slice(0, 7);

  const labels = topBooks.length ? topBooks.map((b) => b.title) : ["لا توجد بيانات مبيعات بعد"];
  const copiesData = topBooks.length ? topBooks.map((b) => Number(b.copiesSold || 0)) : [0];
  const revenueData = topBooks.length ? topBooks.map((b) => Number(b.copiesSold || 0) * Number(b.price || 0)) : [0];

  if (state.chartInstance) {
    state.chartInstance.destroy();
  }

  const palette = ["#2563eb", "#10b981", "#7c3aed", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];

  const datasets =
    state.currentChartType === "doughnut"
      ? [
          {
            label: "إجمالي المبيعات (ج.م)",
            data: revenueData,
            backgroundColor: palette,
            borderWidth: 2
          }
        ]
      : [
          {
            label: "إيرادات الكتاب (ج.م)",
            data: revenueData,
            backgroundColor: "rgba(37, 99, 235, 0.78)",
            borderColor: "#2563eb",
            borderWidth: 2,
            borderRadius: 6,
            tension: 0.35,
            fill: state.currentChartType === "line"
          },
          {
            label: "عدد النسخ المباعة",
            data: copiesData,
            backgroundColor: "rgba(16, 185, 129, 0.78)",
            borderColor: "#10b981",
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
          position: "top",
          labels: { font: { family: "Tajawal", weight: "bold", size: 12 } }
        }
      }
    }
  });
}

document.querySelectorAll(".chart-type-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".chart-type-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.currentChartType = btn.getAttribute("data-chart-type");
    renderMainChart();
  });
});

// ==========================================================================
// 7. بناء البطاقات المربعة للكتب والعقود والمفضلة (Square Book Cards)
// ==========================================================================
function buildBookSquareCardHTML(b) {
  const sold = Number(b.copiesSold || 0);
  const price = Number(b.price || 0);
  const rate = Number(b.royaltyRate || 0);
  const totalRev = sold * price;
  const authorEarned = totalRev * (rate / 100);
  const contract = calculateContractStatus(b.contractDate, b.contractMonths);

  const hasStock = b.stock !== undefined && b.stock !== null && b.stock !== "";
  const stockNum = hasStock ? Number(b.stock) : null;
  const stockBadge =
    stockNum !== null
      ? stockNum <= 15
        ? `<span class="badge red"><i class="ri-alarm-warning-line"></i> المخزون: ${stockNum}</span>`
        : `<span class="badge blue">المخزون: ${stockNum}</span>`
      : "";

  const coverHtml = b.coverUrl
    ? `<img src="${b.coverUrl}" class="book-cover-thumb" alt="${b.title}" />`
    : `<div class="book-cover-thumb"><i class="ri-book-2-line"></i></div>`;

  const pdfBtnHtml = b.drivePdfUrl
    ? `<button class="icon-btn" title="استعراض وتحميل عقد الـ PDF" data-action="view-pdf" data-id="${b.id}" style="color: var(--purple); border-color: #ddd6fe;">
         <i class="ri-file-pdf-2-line"></i>
       </button>`
    : "";

  return `
    <div class="sq-card ${b.isFavorite ? "favorite-highlight" : ""}">
      <div>
        <div class="sq-card-top">
          ${coverHtml}
          <div style="flex: 1; min-width: 0;">
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 4px;">
              <span class="badge ${contract.badgeClass}">${contract.label}</span>
              ${stockBadge}
            </div>
            <h4 style="font-size: 16px; font-weight: 800; color: var(--text-main); line-height: 1.3; margin-bottom: 4px;">${b.title}</h4>
            <p style="font-size: 12.5px; color: var(--text-secondary);">
              <i class="ri-quill-pen-line"></i> المؤلف: <strong>${b.authorName || "غير محدد"}</strong>
            </p>
            ${b.category ? `<span style="font-size: 11px; color: var(--text-muted);">${b.category} ${b.isbn ? "• ISBN: " + b.isbn : ""}</span>` : ""}
          </div>
          <button class="fav-star-btn ${b.isFavorite ? "active" : ""}" title="تمييز في المفضلة" data-action="toggle-fav" data-id="${b.id}">
            <i class="${b.isFavorite ? "ri-star-fill" : "ri-star-line"}"></i>
          </button>
        </div>

        <div class="sq-metrics-box">
          <div class="sq-metric">
            <span>سعر البيع</span>
            <strong>${formatEGP(price)}</strong>
          </div>
          <div class="sq-metric">
            <span>النسخ المباعة</span>
            <strong style="color: var(--primary);">${sold} نسخة</strong>
          </div>
          <div class="sq-metric">
            <span>نسبة المؤلف (${rate}%)</span>
            <strong style="color: var(--success);">${formatEGP(authorEarned)}</strong>
          </div>
          <div class="sq-metric">
            <span>إجمالي المبيعات</span>
            <strong>${formatEGP(totalRev)}</strong>
          </div>
        </div>
      </div>

      <div class="sq-card-footer">
        ${
          state.permissions.sell
            ? `<button class="btn btn-success" style="flex: 1;" data-action="open-sell-modal" data-id="${b.id}">
                 <i class="ri-add-circle-line" style="font-size: 17px;"></i>
                 <span>بيع نسخة</span>
               </button>`
            : ""
        }
        ${pdfBtnHtml}
        ${
          state.permissions.books
            ? `<button class="icon-btn" title="تعديل الكتاب والعقد" data-action="edit-book" data-id="${b.id}">
                 <i class="ri-edit-box-line"></i>
               </button>
               <button class="icon-btn danger" title="حذف العقد والكتاب" data-action="delete-book" data-id="${b.id}">
                 <i class="ri-delete-bin-6-line"></i>
               </button>`
            : ""
        }
      </div>
    </div>
  `;
}

function renderFavoriteBooksGrid() {
  const container = document.getElementById("favorite-books-grid");
  if (!container) return;
  const favs = state.books.filter((b) => b.isFavorite);
  const listToShow = favs.length > 0 ? favs : state.books.slice(0, 4);

  if (listToShow.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 32px; background: #fff; border-radius: 12px; color: var(--text-muted);">لا توجد كتب مضافة بعد. ابدأ بإضافة كاتب ثم توثيق عقد كتاب.</div>`;
    return;
  }
  container.innerHTML = listToShow.map(buildBookSquareCardHTML).join("");
}

function renderBooksAndContractsGrid() {
  const container = document.getElementById("books-grid-container");
  if (!container) return;
  const q = (document.getElementById("search-books-input").value || "").trim().toLowerCase();

  // ترتيب المفضلة في الأعلى دائماً
  const sorted = [...state.books].sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0));
  const filtered = sorted.filter(
    (b) =>
      (b.title || "").toLowerCase().includes(q) ||
      (b.authorName || "").toLowerCase().includes(q) ||
      (b.category || "").toLowerCase().includes(q)
  );

  if (filtered.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; background: #fff; border-radius: 12px; color: var(--text-muted);">لا توجد كتب أو عقود مطابقة للبحث.</div>`;
    return;
  }
  container.innerHTML = filtered.map(buildBookSquareCardHTML).join("");
}

document.getElementById("search-books-input").addEventListener("input", renderBooksAndContractsGrid);

// ==========================================================================
// 8. إدارة ملفات الكُتّاب وصفحة الكاتب المستقلة (Authors & Detail Page)
// ==========================================================================
function renderAuthorsGrid() {
  const container = document.getElementById("authors-grid-container");
  if (!container) return;
  const q = (document.getElementById("search-authors-input").value || "").trim().toLowerCase();

  const filtered = state.authors.filter(
    (a) => (a.name || "").toLowerCase().includes(q) || (a.email || "").toLowerCase().includes(q)
  );

  if (filtered.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; background: #fff; border-radius: 12px; color: var(--text-muted);">لا يوجد مؤلفون مسجلون حالياً. اضغط على "إنشاء ملف كاتب جديد".</div>`;
    return;
  }

  container.innerHTML = filtered
    .map((a) => {
      const aBooks = state.books.filter((b) => b.authorId === a.id);
      const totalCopies = aBooks.reduce((s, b) => s + Number(b.copiesSold || 0), 0);
      const totalEarned = aBooks.reduce((s, b) => {
        const rev = Number(b.copiesSold || 0) * Number(b.price || 0);
        return s + rev * (Number(b.royaltyRate || 0) / 100);
      }, 0);
      const totalPaid = state.payouts
        .filter((p) => p.authorId === a.id)
        .reduce((s, p) => s + Number(p.amount || 0), 0);
      const balance = Math.max(0, totalEarned - totalPaid);

      const avatarHtml = a.avatarUrl
        ? `<img src="${a.avatarUrl}" class="author-avatar-lg" alt="${a.name}" />`
        : `<div class="author-avatar-lg">${(a.name || "ك")[0]}</div>`;

      return `
        <div class="sq-card">
          <div>
            <div class="sq-card-top" style="cursor: pointer;" data-action="open-author-detail" data-id="${a.id}">
              ${avatarHtml}
              <div style="flex: 1;">
                <span class="badge purple">${aBooks.length} عقود كتب</span>
                <h4 style="font-size: 16.5px; font-weight: 800; margin-top: 4px;">${a.name}</h4>
                <p style="font-size: 12px; color: var(--text-secondary);" dir="ltr">${a.email}</p>
              </div>
            </div>

            <div class="sq-metrics-box">
              <div class="sq-metric">
                <span>إجمالي المبيعات</span>
                <strong>${totalCopies} نسخة</strong>
              </div>
              <div class="sq-metric">
                <span>الرصيد المستحق له</span>
                <strong style="color: var(--purple);">${formatEGP(balance)}</strong>
              </div>
            </div>
          </div>

          <div class="sq-card-footer">
            <button class="btn btn-dark" style="flex: 1;" data-action="open-author-detail" data-id="${a.id}">
              <i class="ri-folder-user-line"></i>
              <span>فتح ملف وعقود الكاتب</span>
            </button>
            <button class="icon-btn" title="تعديل الملف الشخصي للكاتب" data-action="edit-author" data-id="${a.id}">
              <i class="ri-edit-box-line"></i>
            </button>
            <button class="icon-btn danger" title="حذف الكاتب" data-action="delete-author" data-id="${a.id}">
              <i class="ri-delete-bin-6-line"></i>
            </button>
          </div>
        </div>
      `;
    })
    .join("");
}

document.getElementById("search-authors-input").addEventListener("input", renderAuthorsGrid);

// فتح صفحة الكاتب المستقلة والتفصيلية
function openAuthorDetailPage(authorId) {
  state.selectedAuthorDetailId = authorId;
  renderAuthorDetailView(authorId);
  switchView("view-author-detail");
}

function renderAuthorDetailView(authorId) {
  const author = state.authors.find((a) => a.id === authorId);
  if (!author) return;

  const aBooks = state.books.filter((b) => b.authorId === authorId);
  const aPayouts = state.payouts.filter((p) => p.authorId === authorId);

  let totalCopies = 0;
  let totalEarned = 0;
  aBooks.forEach((b) => {
    const sold = Number(b.copiesSold || 0);
    const rev = sold * Number(b.price || 0);
    totalCopies += sold;
    totalEarned += rev * (Number(b.royaltyRate || 0) / 100);
  });

  const totalPaid = aPayouts.reduce((s, p) => s + Number(p.amount || 0), 0);
  const remainingBalance = Math.max(0, totalEarned - totalPaid);

  const avatarHtml = author.avatarUrl
    ? `<img src="${author.avatarUrl}" class="author-avatar-lg" />`
    : `<div class="author-avatar-lg">${(author.name || "ك")[0]}</div>`;

  document.getElementById("author-detail-header").innerHTML = `
    <div style="display: flex; align-items: center; gap: 16px;">
      ${avatarHtml}
      <div>
        <h3 style="font-size: 20px; font-weight: 800;">أ. ${author.name}</h3>
        <p style="font-size: 13px; color: var(--text-secondary);">
          <span dir="ltr"><i class="ri-mail-line"></i> ${author.email}</span>
          ${author.phone ? ` • <span dir="ltr"><i class="ri-phone-line"></i> ${author.phone}</span>` : ""}
        </p>
        ${author.bio ? `<p style="font-size: 12.5px; color: var(--text-muted); margin-top: 4px;">${author.bio}</p>` : ""}
      </div>
    </div>
    <div>
      <span class="badge green">بوابة المؤلف مفعلة</span>
    </div>
  `;

  document.getElementById("detail-author-earned").textContent = formatEGP(totalEarned);
  document.getElementById("detail-author-copies").textContent = `من إجمالي ${totalCopies} نسخة مباعة`;
  document.getElementById("detail-author-paid").textContent = formatEGP(totalPaid);
  document.getElementById("detail-author-balance").textContent = formatEGP(remainingBalance);

  // عرض عقود الكتب الخاصة بهذا المؤلف
  const booksGrid = document.getElementById("detail-author-books-grid");
  if (aBooks.length === 0) {
    booksGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 30px; background: #fff; border-radius: 12px; color: var(--text-muted);">لم يتم إضافة أي عقد كتاب لهذا المؤلف بعد. اضغط على "إضافة عقد كتاب لهذا المؤلف" بالأعلى.</div>`;
  } else {
    booksGrid.innerHTML = aBooks.map(buildBookSquareCardHTML).join("");
  }

  // عرض سجل الحوالات والإيصالات
  const payoutsList = document.getElementById("detail-author-payouts-list");
  if (aPayouts.length === 0) {
    payoutsList.innerHTML = `<div style="text-align: center; padding: 24px; background: #fff; border-radius: 12px; color: var(--text-muted);">لم يتم تسجيل أي دفعات مسددة لهذا الكاتب حتى الآن.</div>`;
  } else {
    payoutsList.innerHTML = aPayouts
      .map(
        (p) => `
      <div class="h-row-card">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div class="tile-icon green" style="width: 42px; height: 42px; font-size: 20px;">
            <i class="ri-check-double-line"></i>
          </div>
          <div>
            <h4 style="font-size: 15px; font-weight: 800;">دفعة مسددة: ${formatEGP(p.amount)}</h4>
            <p style="font-size: 12.5px; color: var(--text-secondary);">
              طريقة التحويل: <strong>${p.method}</strong> • التاريخ: ${p.dateString || "-"}
              ${p.notes ? ` • ${p.notes}` : ""}
            </p>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          ${
            p.receiptUrl
              ? `<a href="${p.receiptUrl}" target="_blank" class="btn btn-outline" style="padding: 6px 12px; font-size: 12px; text-decoration: none;">
                   <i class="ri-image-line" style="color: var(--primary);"></i>
                   <span>عرض صورة الإيصال</span>
                 </a>`
              : `<span class="badge amber">بدون صورة إيصال</span>`
          }
          <button class="icon-btn danger" title="حذف الدفعة" data-action="delete-payout" data-id="${p.id}">
            <i class="ri-delete-bin-line"></i>
          </button>
        </div>
      </div>
    `
      )
      .join("");
  }
}

document.getElementById("btn-back-to-authors").addEventListener("click", () => {
  state.selectedAuthorDetailId = null;
  switchView("view-authors");
});

// أزرار الإجراءات السريعة داخل صفحة الكاتب المستقلة
document.getElementById("btn-author-add-contract").addEventListener("click", () => {
  openNewContractModal(state.selectedAuthorDetailId);
});

document.getElementById("btn-author-add-payout").addEventListener("click", () => {
  if (!state.selectedAuthorDetailId) return;
  document.getElementById("form-payout").reset();
  document.getElementById("payout-author-id").value = state.selectedAuthorDetailId;
  openModal("modal-payout");
});

document.getElementById("btn-author-send-report").addEventListener("click", () => {
  if (!state.selectedAuthorDetailId) return;
  openReportModal(state.selectedAuthorDetailId, "full_sales");
});

document.getElementById("btn-author-copy-portal").addEventListener("click", () => {
  const author = state.authors.find((a) => a.id === state.selectedAuthorDetailId);
  if (!author) return;
  const url = getCurrentSiteBaseUrl();
  navigator.clipboard.writeText(url);
  showToast(`تم نسخ رابط النظام (${url})! أرسله للكاتب ليسجل دخوله ببريده (${author.email}).`);
});

// ==========================================================================
// 9. العمليات التفاعلية الموحدة (بيع بنافذة تأكيد، مفضلة، عارض PDF، حذف)
// ==========================================================================
document.addEventListener("click", async (e) => {
  const closeBtn = e.target.closest("[data-close]");
  if (closeBtn) {
    closeModal(closeBtn.getAttribute("data-close"));
    return;
  }

  const actionEl = e.target.closest("[data-action]");
  if (!actionEl) return;

  const action = actionEl.getAttribute("data-action");
  const id = actionEl.getAttribute("data-id");

  if (action === "open-sell-modal") {
    openSellConfirmationModal(id);
  } else if (action === "toggle-fav") {
    await toggleBookFavorite(id);
  } else if (action === "view-pdf") {
    openEmbeddedPdfViewer(id);
  } else if (action === "edit-book") {
    openEditBookModal(id);
  } else if (action === "delete-book") {
    handleDeleteBook(id);
  } else if (action === "open-author-detail") {
    openAuthorDetailPage(id);
  } else if (action === "edit-author") {
    openEditAuthorModal(id);
  } else if (action === "delete-author") {
    handleDeleteAuthor(id);
  } else if (action === "delete-payout") {
    handleDeletePayout(id);
  } else if (action === "delete-sale") {
    const bookId = actionEl.getAttribute("data-book-id");
    const qty = Number(actionEl.getAttribute("data-qty") || 1);
    handleDeleteSale(id, bookId, qty);
  } else if (action === "delete-expense") {
    handleDeleteExpense(id);
  } else if (action === "edit-staff") {
    openEditStaffModal(id);
  } else if (action === "inspect-staff-logs") {
    const email = actionEl.getAttribute("data-email");
    const name = actionEl.getAttribute("data-name");
    inspectEmployeeActivity(email, name);
  } else if (action === "delete-staff") {
    handleDeleteStaff(id);
  }
});

// --- أ) نافذة تأكيد بيع نسخة (تمنع البيع بالخطأ وتدعم الكميات وقناة البيع) ---
function openSellConfirmationModal(bookId) {
  const book = state.books.find((b) => b.id === bookId);
  if (!book) return;

  document.getElementById("sell-modal-book-id").value = book.id;
  document.getElementById("sell-modal-book-title").textContent = `كتاب: ${book.title} (${formatEGP(book.price)})`;
  const qtyInput = document.getElementById("sell-modal-qty");
  qtyInput.value = 1;
  document.getElementById("sell-modal-total-price").textContent = formatEGP(book.price);

  qtyInput.oninput = () => {
    const q = Math.max(1, Number(qtyInput.value || 1));
    document.getElementById("sell-modal-total-price").textContent = formatEGP(q * Number(book.price || 0));
  };

  openModal("modal-confirm-sell");
}

document.getElementById("form-confirm-sell").addEventListener("submit", async (e) => {
  e.preventDefault();
  const bookId = document.getElementById("sell-modal-book-id").value;
  const qty = Math.max(1, Number(document.getElementById("sell-modal-qty").value || 1));
  const channel = document.getElementById("sell-modal-channel").value;

  const book = state.books.find((b) => b.id === bookId);
  if (!book) return;

  const unitPrice = Number(book.price || 0);
  const totalAmount = unitPrice * qty;
  const rate = Number(book.royaltyRate || 0);
  const authorCut = Number((totalAmount * (rate / 100)).toFixed(2));
  const houseCut = Number((totalAmount - authorCut).toFixed(2));

  closeModal("modal-confirm-sell");

  try {
    const updatePayload = { copiesSold: increment(qty) };
    if (book.stock !== undefined && book.stock !== null && book.stock !== "") {
      updatePayload.stock = Math.max(0, Number(book.stock) - qty);
    }

    await updateDoc(doc(db, "books", bookId), updatePayload);

    await addDoc(collection(db, "sales"), {
      bookId: book.id,
      bookTitle: book.title,
      authorId: book.authorId,
      authorName: book.authorName,
      qty,
      unitPrice,
      totalAmount,
      channel,
      authorCut,
      houseCut,
      soldBy: state.userEmail,
      soldByName: state.userProfile.displayName,
      dateString: getTodayDate(),
      createdAt: serverTimestamp()
    });

    await logUserActivity(
      "توثيق عملية بيع",
      `تم بيع (${qty}) نسخة من كتاب "${book.title}" عبر (${channel}) بقيمة ${formatEGP(totalAmount)}`
    );

    showToast(`تم توثيق بيع (${qty}) نسخة من "${book.title}" بنجاح!`);
  } catch (err) {
    console.error("Sale Error:", err);
    showToast("حدث خطأ أثناء تسجيل البيع", "ri-error-warning-fill");
  }
});

// --- ب) تبديل نجمة المفضلة للكتاب ⭐️ ---
async function toggleBookFavorite(bookId) {
  const book = state.books.find((b) => b.id === bookId);
  if (!book) return;
  try {
    await updateDoc(doc(db, "books", bookId), {
      isFavorite: !book.isFavorite
    });
    showToast(!book.isFavorite ? "تمت إضافة الكتاب للمفضلة ⭐️" : "تمت إزالة الكتاب من المفضلة");
  } catch (err) {
    console.error(err);
  }
}

// --- ج) فتح عارض عقود الـ PDF المدمج من Google Drive ---
function openEmbeddedPdfViewer(bookId) {
  const book = state.books.find((b) => b.id === bookId);
  if (!book || !book.drivePdfUrl) return;

  const parsed = parseGoogleDriveUrl(book.drivePdfUrl);
  document.getElementById("pdf-viewer-title").innerHTML = `<i class="ri-file-pdf-2-fill" style="color: var(--danger);"></i> عقد كتاب: ${book.title}`;
  document.getElementById("pdf-viewer-iframe").src = parsed.previewUrl;
  document.getElementById("btn-direct-download-pdf").href = parsed.downloadUrl;
  openModal("modal-pdf-viewer");
}

// ==========================================================================
// 10. النماذج: إنشاء الكاتب، إضافة عقد كتاب، الدفعات، والمصاريف (Forms)
// ==========================================================================

// --- 1. إنشاء/تعديل ملف الكاتب ---
document.getElementById("btn-open-new-author").addEventListener("click", () => {
  document.getElementById("form-author").reset();
  document.getElementById("author-id-input").value = "";
  document.getElementById("modal-author-title").textContent = "إنشاء ملف شخصي لكاتب جديد";
  document.getElementById("welcome-email-check-wrap").style.display = "block";
  openModal("modal-author");
});

function openEditAuthorModal(authorId) {
  const a = state.authors.find((x) => x.id === authorId);
  if (!a) return;
  document.getElementById("form-author").reset();
  document.getElementById("author-id-input").value = a.id;
  document.getElementById("author-name-input").value = a.name || "";
  document.getElementById("author-email-input").value = a.email || "";
  document.getElementById("author-phone-input").value = a.phone || "";
  document.getElementById("author-bio-input").value = a.bio || "";
  document.getElementById("welcome-email-check-wrap").style.display = "none";
  document.getElementById("modal-author-title").textContent = `تعديل ملف الكاتب: ${a.name}`;
  openModal("modal-author");
}

document.getElementById("form-author").addEventListener("submit", async (e) => {
  e.preventDefault();
  const saveBtn = document.getElementById("btn-save-author");
  saveBtn.disabled = true;
  saveBtn.textContent = "جاري الحفظ...";

  const id = document.getElementById("author-id-input").value;
  const fileInput = document.getElementById("author-image-file");
  const sendWelcome = document.getElementById("author-send-welcome-check").checked;

  const payload = {
    name: document.getElementById("author-name-input").value.trim(),
    email: document.getElementById("author-email-input").value.trim().toLowerCase(),
    phone: document.getElementById("author-phone-input").value.trim(),
    bio: document.getElementById("author-bio-input").value.trim()
  };

  try {
    if (fileInput.files && fileInput.files[0]) {
      showToast("جاري ضغط ورفع صورة الكاتب...", "ri-upload-cloud-2-line");
      payload.avatarUrl = await compressAndUploadImage(fileInput.files[0]);
    }

    if (id) {
      await updateDoc(doc(db, "authors", id), payload);
      await logUserActivity("تعديل ملف كاتب", `تم تحديث بيانات الكاتب: ${payload.name}`);
      showToast("تم تحديث ملف الكاتب بنجاح.");
      closeModal("modal-author");
    } else {
      payload.createdAt = serverTimestamp();
      const docRef = await addDoc(collection(db, "authors"), payload);
      await logUserActivity("إضافة كاتب جديد", `تم إنشاء ملف الكاتب: ${payload.name} (${payload.email})`);
      showToast("تم إنشاء ملف الكاتب بنجاح!");
      closeModal("modal-author");

      if (sendWelcome) {
        setTimeout(() => openReportModal(docRef.id, "welcome"), 350);
      }
    }
  } catch (err) {
    console.error(err);
    showToast("حدث خطأ أثناء حفظ ملف الكاتب", "ri-error-warning-fill");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "حفظ ملف الكاتب";
  }
});

function handleDeleteAuthor(authorId) {
  const a = state.authors.find((x) => x.id === authorId);
  if (!a) return;
  askCustomConfirmation(
    "تأكيد حذف ملف الكاتب",
    `هل أنت متأكد من حذف ملف الكاتب "${a.name}"؟ لا يمكن التراجع عن هذا الإجراء.`,
    async () => {
      await deleteDoc(doc(db, "authors", authorId));
      await logUserActivity("حذف كاتب", `تم حذف ملف الكاتب: ${a.name}`);
      showToast("تم حذف ملف الكاتب.");
    }
  );
}

// --- 2. إضافة/تعديل عقد كتاب شامل ---
function populateAuthorSelect(filterText = "") {
  const select = document.getElementById("book-author-select");
  if (!select) return;
  const currentVal = select.value;
  const q = filterText.trim().toLowerCase();

  const list = state.authors.filter(
    (a) => (a.name || "").toLowerCase().includes(q) || (a.email || "").toLowerCase().includes(q)
  );

  select.innerHTML =
    `<option value="">-- اختر المؤلف صاحب العقد --</option>` +
    list.map((a) => `<option value="${a.id}">${a.name} (${a.email})</option>`).join("");

  if (currentVal && list.some((a) => a.id === currentVal)) {
    select.value = currentVal;
  }
}

document.getElementById("book-author-filter").addEventListener("input", (e) => {
  populateAuthorSelect(e.target.value);
});

document.getElementById("btn-open-new-contract").addEventListener("click", () => {
  openNewContractModal(null);
});

function openNewContractModal(preselectedAuthorId = null) {
  if (state.authors.length === 0) {
    showToast("يرجى إنشاء ملف كاتب واحد على الأقل قبل إضافة عقد كتاب!", "ri-error-warning-fill");
    return;
  }
  document.getElementById("form-book").reset();
  document.getElementById("book-id-input").value = "";
  document.getElementById("book-contract-date").value = getTodayDate();
  populateAuthorSelect("");
  if (preselectedAuthorId) {
    document.getElementById("book-author-select").value = preselectedAuthorId;
  }
  document.getElementById("modal-book-title").textContent = "توثيق عقد كتاب جديد";
  openModal("modal-book");
}

function openEditBookModal(bookId) {
  const b = state.books.find((x) => x.id === bookId);
  if (!b) return;
  document.getElementById("form-book").reset();
  populateAuthorSelect("");

  document.getElementById("book-id-input").value = b.id;
  document.getElementById("book-title-input").value = b.title || "";
  document.getElementById("book-author-select").value = b.authorId || "";
  document.getElementById("book-price-input").value = b.price || "";
  document.getElementById("book-royalty-input").value = b.royaltyRate ?? 20;
  document.getElementById("book-contract-months").value = b.contractMonths || 24;
  document.getElementById("book-contract-date").value = b.contractDate || getTodayDate();
  document.getElementById("book-favorite-check").checked = !!b.isFavorite;
  document.getElementById("book-drive-pdf-input").value = b.drivePdfUrl || "";
  document.getElementById("book-isbn-input").value = b.isbn || "";
  document.getElementById("book-category-input").value = b.category || "";
  document.getElementById("book-edition-input").value = b.edition || "";
  document.getElementById("book-pages-input").value = b.pages || "";
  document.getElementById("book-stock-input").value = b.stock ?? "";
  document.getElementById("book-notes-input").value = b.notes || "";

  document.getElementById("modal-book-title").textContent = `تعديل عقد وبيانات كتاب: ${b.title}`;
  openModal("modal-book");
}

document.getElementById("form-book").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("btn-save-book");
  btn.disabled = true;
  btn.textContent = "جاري الحفظ...";

  const id = document.getElementById("book-id-input").value;
  const authorId = document.getElementById("book-author-select").value;
  const authorObj = state.authors.find((a) => a.id === authorId);
  const coverFileInput = document.getElementById("book-cover-file");
  const stockRaw = document.getElementById("book-stock-input").value;

  const payload = {
    title: document.getElementById("book-title-input").value.trim(),
    authorId,
    authorName: authorObj ? authorObj.name : "غير محدد",
    price: Number(document.getElementById("book-price-input").value),
    royaltyRate: Number(document.getElementById("book-royalty-input").value),
    contractMonths: Number(document.getElementById("book-contract-months").value),
    contractDate: document.getElementById("book-contract-date").value,
    isFavorite: document.getElementById("book-favorite-check").checked,
    drivePdfUrl: document.getElementById("book-drive-pdf-input").value.trim(),
    isbn: document.getElementById("book-isbn-input").value.trim(),
    category: document.getElementById("book-category-input").value.trim(),
    edition: document.getElementById("book-edition-input").value.trim(),
    pages: document.getElementById("book-pages-input").value.trim(),
    stock: stockRaw !== "" ? Number(stockRaw) : "",
    notes: document.getElementById("book-notes-input").value.trim()
  };

  try {
    if (coverFileInput.files && coverFileInput.files[0]) {
      showToast("جاري ضغط ورفع غلاف الكتاب...", "ri-upload-cloud-2-line");
      payload.coverUrl = await compressAndUploadImage(coverFileInput.files[0]);
    }

    if (id) {
      await updateDoc(doc(db, "books", id), payload);
      await logUserActivity("تعديل عقد كتاب", `تم تعديل بيانات وعقد كتاب: ${payload.title}`);
      showToast("تم تحديث بيانات الكتاب والعقد بنجاح.");
    } else {
      payload.copiesSold = 0;
      payload.createdAt = serverTimestamp();
      await addDoc(collection(db, "books"), payload);
      await logUserActivity("إضافة عقد كتاب جديد", `تم توثيق عقد كتاب "${payload.title}" للمؤلف ${payload.authorName}`);
      showToast("تم توثيق عقد الكتاب وإضافته بنجاح!");
    }
    closeModal("modal-book");
  } catch (err) {
    console.error(err);
    showToast("حدث خطأ أثناء حفظ الكتاب", "ri-error-warning-fill");
  } finally {
    btn.disabled = false;
    btn.textContent = "حفظ العقد والكتاب";
  }
});

function handleDeleteBook(bookId) {
  const b = state.books.find((x) => x.id === bookId);
  if (!b) return;
  askCustomConfirmation(
    "تأكيد حذف الكتاب والعقد",
    `هل أنت متأكد من حذف عقد وبيانات كتاب "${b.title}" نهائياً؟`,
    async () => {
      await deleteDoc(doc(db, "books", bookId));
      await logUserActivity("حذف كتاب", `تم حذف كتاب: ${b.title}`);
      showToast("تم حذف الكتاب والعقد.");
    }
  );
}

// --- 3. تسجيل دفعة مسددة للكاتب + رفع صورة الإيصال ---
document.getElementById("form-payout").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("btn-save-payout");
  btn.disabled = true;
  btn.textContent = "جاري التوثيق...";

  const authorId = document.getElementById("payout-author-id").value;
  const author = state.authors.find((a) => a.id === authorId);
  const amount = Number(document.getElementById("payout-amount-input").value);
  const method = document.getElementById("payout-method-input").value;
  const notes = document.getElementById("payout-notes-input").value.trim();
  const receiptInput = document.getElementById("payout-receipt-file");

  try {
    let receiptUrl = "";
    if (receiptInput.files && receiptInput.files[0]) {
      showToast("جاري ضغط ورفع صورة الإيصال...", "ri-upload-cloud-2-line");
      receiptUrl = await compressAndUploadImage(receiptInput.files[0], 1000, 0.8);
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

    await logUserActivity(
      "تسديد دفعة لمؤلف",
      `تم تحويل ${formatEGP(amount)} للمؤلف (${author ? author.name : ""}) عبر ${method}`
    );

    showToast("تم توثيق الدفعة المالية والإيصال بنجاح!");
    closeModal("modal-payout");
  } catch (err) {
    console.error(err);
    showToast("تعذر حفظ الدفعة المالية", "ri-error-warning-fill");
  } finally {
    btn.disabled = false;
    btn.textContent = "توثيق الدفعة والإيصال";
  }
});

function handleDeletePayout(payoutId) {
  askCustomConfirmation("حذف دفعة مسددة", "هل تريد حذف سجل هذه الدفعة المالية؟", async () => {
    await deleteDoc(doc(db, "payouts", payoutId));
    await logUserActivity("حذف دفعة مالية", `تم حذف دفعة مسددة من السجل`);
    showToast("تم حذف الدفعة.");
  });
}

// --- 4. السجل المالي والمصاريف ---
document.getElementById("btn-open-expense-modal").addEventListener("click", () => {
  document.getElementById("form-expense").reset();
  openModal("modal-expense");
});

document.getElementById("form-expense").addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = document.getElementById("expense-title-input").value.trim();
  const amount = Number(document.getElementById("expense-amount-input").value);
  const category = document.getElementById("expense-category-input").value;

  try {
    await addDoc(collection(db, "expenses"), {
      title,
      amount,
      category,
      addedBy: state.userProfile.displayName || state.userEmail,
      dateString: getTodayDate(),
      createdAt: serverTimestamp()
    });

    await logUserActivity("تسجيل مصروف تشغيلي", `مصروف (${title}) بقيمة ${formatEGP(amount)}`);
    showToast("تم توثيق المصروف وخصمه من صافي الأرباح.");
    closeModal("modal-expense");
  } catch (err) {
    console.error(err);
  }
});

function renderFinanceTimeline() {
  const container = document.getElementById("finance-log-list");
  if (!container) return;

  const combined = sortByTimestampDesc([
    ...state.sales.map((s) => ({ ...s, itemType: "sale" })),
    ...state.expenses.map((e) => ({ ...e, itemType: "expense" })),
    ...state.payouts.map((p) => ({ ...p, itemType: "payout" }))
  ]);

  if (combined.length === 0) {
    container.innerHTML = `<div style="text-align: center; padding: 36px; background: #fff; border-radius: 12px; color: var(--text-muted);">لا توجد حركات مالية موثقة حتى الآن.</div>`;
    return;
  }

  container.innerHTML = combined
    .slice(0, 80)
    .map((item) => {
      if (item.itemType === "sale") {
        const qty = Number(item.qty || 1);
        const total = Number(item.totalAmount || item.price || 0);
        return `
          <div class="h-row-card">
            <div style="display: flex; align-items: center; gap: 14px;">
              <div class="tile-icon green" style="width: 44px; height: 44px; font-size: 20px;"><i class="ri-shopping-bag-3-line"></i></div>
              <div>
                <h4 style="font-size: 15px; font-weight: 800;">
                  بيع (${qty} نسخة): ${item.bookTitle}
                  <span class="badge green">+${formatEGP(total)}</span>
                </h4>
                <p style="font-size: 12.5px; color: var(--text-secondary);">
                  المؤلف: ${item.authorName} • القناة: <strong>${item.channel || "مباشر"}</strong> • نصيب المؤلف: ${formatEGP(item.authorCut)} • بواسطة: ${item.soldByName || item.soldBy} • ${item.dateString}
                </p>
              </div>
            </div>
            ${
              state.userRole === "super_admin" || state.permissions.finance
                ? `<button class="icon-btn danger" title="إلغاء عملية البيع" data-action="delete-sale" data-id="${item.id}" data-book-id="${item.bookId}" data-qty="${qty}">
                     <i class="ri-delete-bin-line"></i>
                   </button>`
                : ""
            }
          </div>
        `;
      } else if (item.itemType === "payout") {
        return `
          <div class="h-row-card">
            <div style="display: flex; align-items: center; gap: 14px;">
              <div class="tile-icon purple" style="width: 44px; height: 44px; font-size: 20px;"><i class="ri-hand-coin-line"></i></div>
              <div>
                <h4 style="font-size: 15px; font-weight: 800;">
                  حوالة مسددة للمؤلف: ${item.authorName}
                  <span class="badge purple">-${formatEGP(item.amount)}</span>
                </h4>
                <p style="font-size: 12.5px; color: var(--text-secondary);">
                  الطريقة: ${item.method} • التاريخ: ${item.dateString}
                  ${item.receiptUrl ? ` • <a href="${item.receiptUrl}" target="_blank" style="color: var(--primary); font-weight: 700;">عرض الإيصال</a>` : ""}
                </p>
              </div>
            </div>
          </div>
        `;
      } else {
        return `
          <div class="h-row-card">
            <div style="display: flex; align-items: center; gap: 14px;">
              <div class="tile-icon amber" style="width: 44px; height: 44px; font-size: 20px;"><i class="ri-receipt-line"></i></div>
              <div>
                <h4 style="font-size: 15px; font-weight: 800;">
                  مصروف تشغيلي: ${item.title}
                  <span class="badge red">-${formatEGP(item.amount)}</span>
                </h4>
                <p style="font-size: 12.5px; color: var(--text-secondary);">
                  التصنيف: ${item.category} • بواسطة: ${item.addedBy} • التاريخ: ${item.dateString}
                </p>
              </div>
            </div>
            <button class="icon-btn danger" title="حذف المصروف" data-action="delete-expense" data-id="${item.id}">
              <i class="ri-delete-bin-line"></i>
            </button>
          </div>
        `;
      }
    })
    .join("");
}

function handleDeleteSale(saleId, bookId, qty) {
  askCustomConfirmation(
    "إلغاء وحذف عملية بيع",
    `هل أنت متأكد من إلغاء عملية البيع هذه؟ سيتم إنقاص (${qty}) نسخة من مبيعات الكتاب وإرجاعها للمخزون.`,
    async () => {
      await deleteDoc(doc(db, "sales", saleId));
      if (bookId) {
        await updateDoc(doc(db, "books", bookId), { copiesSold: increment(-qty) });
      }
      await logUserActivity("إلغاء عملية بيع", `تم إلغاء عملية بيع (${qty} نسخة)`);
      showToast("تم إلغاء البيعة وتحديث الحسابات.");
    }
  );
}

function handleDeleteExpense(expenseId) {
  askCustomConfirmation("حذف مصروف", "هل أنت متأكد من حذف هذا المصروف التشغيلي؟", async () => {
    await deleteDoc(doc(db, "expenses", expenseId));
    showToast("تم حذف المصروف.");
  });
}

// ==========================================================================
// 11. إدارة الموظفين والصلاحيات المجزأة (بدون إظهار الإيميلات الثلاثة الخفية)
// ==========================================================================
document.getElementById("staff-perm-mode").addEventListener("change", (e) => {
  document.getElementById("custom-perms-box").style.display = e.target.value === "custom" ? "block" : "none";
});

document.getElementById("btn-open-staff-modal").addEventListener("click", () => {
  document.getElementById("form-staff").reset();
  document.getElementById("staff-id-input").value = "";
  document.getElementById("custom-perms-box").style.display = "none";
  document.getElementById("modal-staff-title").textContent = "إضافة موظف وتخصيص صلاحياته";
  openModal("modal-staff");
});

function openEditStaffModal(staffId) {
  const st = state.staff.find((s) => s.id === staffId);
  if (!st) return;
  document.getElementById("staff-id-input").value = st.id;
  document.getElementById("staff-name-input").value = st.name || "";
  document.getElementById("staff-email-input").value = st.email || "";
  document.getElementById("staff-perm-mode").value = st.permMode || "full";
  document.getElementById("custom-perms-box").style.display = st.permMode === "custom" ? "block" : "none";

  const perms = st.permissions || { sell: true, books: true, authors: true, finance: true };
  document.getElementById("perm-sell").checked = !!perms.sell;
  document.getElementById("perm-books").checked = !!perms.books;
  document.getElementById("perm-authors").checked = !!perms.authors;
  document.getElementById("perm-finance").checked = !!perms.finance;
  document.getElementById("staff-restricted-check").checked = !!st.restricted;

  document.getElementById("modal-staff-title").textContent = `تعديل صلاحيات الموظف: ${st.name}`;
  openModal("modal-staff");
}

document.getElementById("form-staff").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("staff-id-input").value;
  const email = document.getElementById("staff-email-input").value.trim().toLowerCase();
  const permMode = document.getElementById("staff-perm-mode").value;

  if (isSuperAdminEmail(email)) {
    showToast("هذا البريد يتمتع بصلاحية عليا تلقائياً ولا يضاف لقائمة الموظفين.", "ri-shield-star-line");
    return;
  }

  const payload = {
    name: document.getElementById("staff-name-input").value.trim(),
    email,
    permMode,
    permissions:
      permMode === "full"
        ? { sell: true, books: true, authors: true, finance: true }
        : {
            sell: document.getElementById("perm-sell").checked,
            books: document.getElementById("perm-books").checked,
            authors: document.getElementById("perm-authors").checked,
            finance: document.getElementById("perm-finance").checked
          },
    restricted: document.getElementById("staff-restricted-check").checked
  };

  try {
    if (id) {
      await updateDoc(doc(db, "staff", id), payload);
      showToast("تم تحديث صلاحيات الموظف بنجاح.");
    } else {
      payload.createdAt = serverTimestamp();
      await addDoc(collection(db, "staff"), payload);
      showToast("تم اعتماد الموظف في النظام.");
    }
    closeModal("modal-staff");
  } catch (err) {
    console.error(err);
  }
});

function renderStaffManagementGrid() {
  const container = document.getElementById("staff-grid-container");
  if (!container) return;

  // ملاحظة هامة: الإيميلات الثلاثة الأساسية مخفية تماماً هنا كما طلبت!
  const visibleStaff = state.staff.filter((s) => !isSuperAdminEmail(s.email));

  if (visibleStaff.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 38px; background: #fff; border-radius: 12px; color: var(--text-muted);">لا يوجد موظفون مضافون حالياً. اضغط على "إضافة موظف وتحديد صلاحياته".</div>`;
    return;
  }

  container.innerHTML = visibleStaff
    .map((st) => {
      const empLogsCount = state.activityLogs.filter((l) => l.actorEmail === st.email).length;
      const statusBadge = st.restricted
        ? `<span class="badge red"><i class="ri-lock-line"></i> الحساب مقيّد (مجمد)</span>`
        : `<span class="badge green"><i class="ri-check-line"></i> نشط</span>`;

      const permText =
        st.permMode === "custom" ? "صلاحيات مجزأة ومحددة" : "صلاحيات موظف كاملة";

      return `
        <div class="sq-card">
          <div>
            <div class="sq-card-top">
              <div class="author-avatar-lg" style="background: var(--primary-light); color: var(--primary);">
                <i class="ri-user-settings-line"></i>
              </div>
              <div>
                ${statusBadge}
                <h4 style="font-size: 16px; font-weight: 800; margin-top: 4px;">${st.name}</h4>
                <p style="font-size: 12px; color: var(--text-secondary);" dir="ltr">${st.email}</p>
              </div>
            </div>

            <div class="sq-metrics-box">
              <div class="sq-metric">
                <span>نوع الصلاحية</span>
                <strong>${permText}</strong>
              </div>
              <div class="sq-metric">
                <span>العمليات الموثقة</span>
                <strong style="color: var(--primary);">${empLogsCount} عملية</strong>
              </div>
            </div>
          </div>

          <div class="sq-card-footer">
            <button class="btn btn-outline" style="flex: 1;" data-action="inspect-staff-logs" data-email="${st.email}" data-name="${st.name}">
              <i class="ri-eye-line"></i>
              <span>مراقبة نشاطه</span>
            </button>
            <button class="icon-btn" title="تعديل الصلاحيات أو تقييد الحساب" data-action="edit-staff" data-id="${st.id}">
              <i class="ri-settings-4-line"></i>
            </button>
            <button class="icon-btn danger" title="حذف الموظف" data-action="delete-staff" data-id="${st.id}">
              <i class="ri-delete-bin-line"></i>
            </button>
          </div>
        </div>
      `;
    })
    .join("");
}

function inspectEmployeeActivity(email, name) {
  state.inspectingStaffEmail = email;
  document.getElementById("activity-log-title").textContent = `سجل الرقابة ونشاط الموظف: ${name} (${email})`;
  renderUserActivityLogs();
  switchView("view-profile");
}

function handleDeleteStaff(staffId) {
  askCustomConfirmation("حذف موظف", "هل أنت متأكد من سحب الصلاحية وحذف هذا الموظف نهائياً؟", async () => {
    await deleteDoc(doc(db, "staff", staffId));
    showToast("تم حذف الموظف.");
  });
}

// ==========================================================================
// 12. نظام التنبيهات الإدارية والملف الشخصي وسجل النشاط
// ==========================================================================
function populateNotificationTargets() {
  const select = document.getElementById("notif-target-select");
  if (!select) return;
  select.innerHTML =
    `<option value="all">جميع الموظفين وفريق العمل</option>` +
    state.staff
      .filter((s) => !isSuperAdminEmail(s.email))
      .map((s) => `<option value="${s.email}">${s.name} (${s.email})</option>`)
      .join("");
}

document.getElementById("btn-open-send-notif").addEventListener("click", () => {
  document.getElementById("form-send-notification").reset();
  openModal("modal-send-notification");
});

document.getElementById("btn-send-notif-from-page").addEventListener("click", () => {
  document.getElementById("form-send-notification").reset();
  openModal("modal-send-notification");
});

document.getElementById("form-send-notification").addEventListener("submit", async (e) => {
  e.preventDefault();
  const target = document.getElementById("notif-target-select").value;
  const priority = document.getElementById("notif-priority-select").value;
  const title = document.getElementById("notif-title-input").value.trim();
  const body = document.getElementById("notif-body-input").value.trim();

  try {
    await addDoc(collection(db, "notifications"), {
      target,
      priority,
      title,
      body,
      senderName: state.userProfile.displayName || "الإدارة",
      dateString: getTodayDate(),
      createdAt: serverTimestamp()
    });
    showToast("تم إرسال التنبيه الإداري بنجاح!");
    closeModal("modal-send-notification");
  } catch (err) {
    console.error(err);
  }
});

function renderNotificationsList() {
  const container = document.getElementById("notifications-list-container");
  if (!container) return;

  const myNotifs = state.notifications.filter(
    (n) => state.userRole === "super_admin" || n.target === "all" || n.target === state.userEmail
  );

  const badge = document.getElementById("sidebar-notif-badge");
  const dot = document.getElementById("header-notif-dot");
  if (myNotifs.length > 0) {
    badge.textContent = myNotifs.length;
    badge.style.display = "inline-block";
    dot.style.display = "block";
  } else {
    badge.style.display = "none";
    dot.style.display = "none";
  }

  if (myNotifs.length === 0) {
    container.innerHTML = `<div style="text-align: center; padding: 36px; background: #fff; border-radius: 12px; color: var(--text-muted);">لا توجد تنبيهات أو توجيهات إدارية حالياً.</div>`;
    return;
  }

  container.innerHTML = myNotifs
    .map(
      (n) => `
      <div class="h-row-card" style="border-right: 4px solid ${n.priority === "urgent" ? "var(--danger)" : "var(--primary)"};">
        <div>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <span class="badge ${n.priority === "urgent" ? "red" : "blue"}">
              ${n.priority === "urgent" ? "تنبيه عاجل وهام" : "توجيه إداري"}
            </span>
            <span style="font-size: 12px; color: var(--text-muted);">التاريخ: ${n.dateString} • المرسل إليه: ${n.target === "all" ? "الجميع" : n.target}</span>
          </div>
          <h4 style="font-size: 15.5px; font-weight: 800; margin-bottom: 4px;">${n.title}</h4>
          <p style="font-size: 13.5px; color: var(--text-secondary);">${n.body}</p>
        </div>
      </div>
    `
    )
    .join("");
}

// تحديث الملف الشخصي (الاسم والصورة)
document.getElementById("form-update-profile").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("btn-save-profile");
  btn.disabled = true;
  btn.textContent = "جاري الحفظ...";

  const newName = document.getElementById("profile-input-name").value.trim();
  const fileInput = document.getElementById("profile-input-file");

  try {
    let avatarUrl = state.userProfile.avatarUrl;
    if (fileInput.files && fileInput.files[0]) {
      showToast("جاري ضغط ورفع صورتك الشخصية...", "ri-upload-cloud-2-line");
      avatarUrl = await compressAndUploadImage(fileInput.files[0], 500, 0.8);
    }

    await setDoc(
      doc(db, "user_profiles", state.userEmail),
      {
        displayName: newName,
        avatarUrl,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    state.userProfile.displayName = newName;
    state.userProfile.avatarUrl = avatarUrl;
    updateHeaderAndProfileDisplay();
    updateEgyptianGreeting();
    showToast("تم تحديث ملفك الشخصي بنجاح!");
  } catch (err) {
    console.error(err);
  } finally {
    btn.disabled = false;
    btn.textContent = "حفظ التعديلات";
  }
});

function renderUserActivityLogs() {
  const container = document.getElementById("user-activity-log-list");
  if (!container) return;

  const targetEmail = state.inspectingStaffEmail || state.userEmail;
  const logs = state.activityLogs.filter((l) => l.actorEmail === targetEmail);

  if (logs.length === 0) {
    container.innerHTML = `<div style="text-align: center; padding: 30px; background: #fff; border-radius: 12px; color: var(--text-muted);">لا توجد عمليات مسجلة لهذا الحساب حتى الآن.</div>`;
    return;
  }

  container.innerHTML = logs
    .slice(0, 60)
    .map(
      (l) => `
      <div class="h-row-card">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div class="tile-icon blue" style="width: 40px; height: 40px; font-size: 18px;"><i class="ri-Check-double-line"></i></div>
          <div>
            <h4 style="font-size: 14.5px; font-weight: 800;">${l.actionTitle}</h4>
            <p style="font-size: 13px; color: var(--text-secondary);">${l.detailsText}</p>
          </div>
        </div>
        <span class="badge blue">${l.dateString || "اليوم"}</span>
      </div>
    `
    )
    .join("");
}

// ==========================================================================
// 13. بوابة الكاتب الخاصة + تغيير صورته الشخصية فقط (Author Personal Portal)
// ==========================================================================
function renderAuthorPortalView() {
  const profile = state.currentAuthorProfile;
  if (!profile) return;

  document.getElementById("portal-author-name").textContent = `أهلاً بك، أ. ${profile.name}`;
  if (profile.avatarUrl) {
    document.getElementById("portal-author-avatar").src = profile.avatarUrl;
  }

  let totalCopies = 0;
  let totalEarned = 0;
  state.books.forEach((b) => {
    const sold = Number(b.copiesSold || 0);
    const rev = sold * Number(b.price || 0);
    totalCopies += sold;
    totalEarned += rev * (Number(b.royaltyRate || 0) / 100);
  });

  const totalPaid = state.payouts.reduce((s, p) => s + Number(p.amount || 0), 0);
  const balance = Math.max(0, totalEarned - totalPaid);

  document.getElementById("portal-stat-copies").textContent = `${totalCopies} نسخة`;
  document.getElementById("portal-stat-earned").textContent = formatEGP(totalEarned);
  document.getElementById("portal-stat-paid").textContent = `تم تحويل: ${formatEGP(totalPaid)}`;
  document.getElementById("portal-stat-balance").textContent = formatEGP(balance);

  // كتب وعقود المؤلف
  const booksGrid = document.getElementById("portal-books-grid");
  if (state.books.length === 0) {
    booksGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 30px; background: #fff; border-radius: 12px;">لا توجد عقود كتب مسجلة حالياً.</div>`;
  } else {
    booksGrid.innerHTML = state.books
      .map((b) => {
        const sold = Number(b.copiesSold || 0);
        const price = Number(b.price || 0);
        const rate = Number(b.royaltyRate || 0);
        const authorEarned = sold * price * (rate / 100);
        const contract = calculateContractStatus(b.contractDate, b.contractMonths);

        return `
          <div class="sq-card">
            <div>
              <div class="sq-card-top">
                ${
                  b.coverUrl
                    ? `<img src="${b.coverUrl}" class="book-cover-thumb" />`
                    : `<div class="book-cover-thumb"><i class="ri-book-read-line"></i></div>`
                }
                <div>
                  <span class="badge ${contract.badgeClass}">${contract.label}</span>
                  <h4 style="font-size: 16px; font-weight: 800; margin-top: 4px;">${b.title}</h4>
                  <p style="font-size: 12px; color: var(--text-secondary);">بداية العقد: ${b.contractDate} (${b.contractMonths} شهر)</p>
                </div>
              </div>
              <div class="sq-metrics-box">
                <div class="sq-metric"><span>سعر الكتاب</span><strong>${formatEGP(price)}</strong></div>
                <div class="sq-metric"><span>نسبتك بالعقد</span><strong>${rate}%</strong></div>
                <div class="sq-metric"><span>النسخ المباعة</span><strong style="color: var(--primary);">${sold} نسخة</strong></div>
                <div class="sq-metric"><span>إجمالي أرباحك</span><strong style="color: var(--success);">${formatEGP(authorEarned)}</strong></div>
              </div>
            </div>
            ${
              b.drivePdfUrl
                ? `<div class="sq-card-footer">
                     <button class="btn btn-outline" style="width: 100%;" data-action="view-pdf" data-id="${b.id}">
                       <i class="ri-file-pdf-2-line" style="color: var(--danger);"></i>
                       <span>استعراض وتحميل نسخة العقد (PDF)</span>
                     </button>
                   </div>`
                : ""
            }
          </div>
        `;
      })
      .join("");
  }

  // إيصالات الكاتب
  const payoutsEl = document.getElementById("portal-payouts-list");
  if (state.payouts.length === 0) {
    payoutsEl.innerHTML = `<div style="text-align: center; padding: 24px; background: #fff; border-radius: 12px; color: var(--text-muted);">لا توجد دفعات محولة مسجلة حتى الآن.</div>`;
  } else {
    payoutsEl.innerHTML = state.payouts
      .map(
        (p) => `
        <div class="h-row-card">
          <div>
            <h4 style="font-size: 15px; font-weight: 800; color: var(--success);">دفعة محولة لك: ${formatEGP(p.amount)}</h4>
            <p style="font-size: 12.5px; color: var(--text-secondary);">طريقة التحويل: ${p.method} • التاريخ: ${p.dateString}</p>
          </div>
          ${
            p.receiptUrl
              ? `<a href="${p.receiptUrl}" target="_blank" class="btn btn-outline" style="text-decoration: none;">
                   <i class="ri-image-line"></i><span>استعراض الإيصال</span>
                 </a>`
              : ""
          }
        </div>
      `
      )
      .join("");
  }
}

// تغيير الكاتب لصورته الشخصية فقط
document.getElementById("portal-author-avatar-input").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file || !state.currentAuthorProfile) return;
  try {
    showToast("جاري ضغط وتحديث صورتك الشخصية...", "ri-upload-cloud-2-line");
    const newUrl = await compressAndUploadImage(file, 500, 0.8);
    await updateDoc(doc(db, "authors", state.currentAuthorProfile.id), { avatarUrl: newUrl });
    document.getElementById("portal-author-avatar").src = newUrl;
    document.getElementById("header-user-avatar").src = newUrl;
    showToast("تم تحديث صورتك الشخصية بنجاح!");
  } catch (err) {
    console.error(err);
  }
});

// ==========================================================================
// 14. التقارير ورسالة الترحيب التلقائية بالرابط الحالي + لوحة التعليمات الذكية
// ==========================================================================
function openReportModal(authorId, defaultType = "full_sales") {
  document.getElementById("report-author-id").value = authorId;
  document.getElementById("report-type-select").value = defaultType;
  generateReportMessageText();
  openModal("modal-report");
}

document.getElementById("report-type-select").addEventListener("change", generateReportMessageText);

function generateReportMessageText() {
  const authorId = document.getElementById("report-author-id").value;
  const type = document.getElementById("report-type-select").value;
  const author = state.authors.find((a) => a.id === authorId);
  if (!author) return;

  const siteUrl = getCurrentSiteBaseUrl();
  const aBooks = state.books.filter((b) => b.authorId === authorId);
  const aPayouts = state.payouts.filter((p) => p.authorId === authorId);

  let totalCopies = 0;
  let totalEarned = 0;
  const bookLines = aBooks
    .map((b) => {
      const sold = Number(b.copiesSold || 0);
      const rev = sold * Number(b.price || 0);
      const roy = rev * (Number(b.royaltyRate || 0) / 100);
      totalCopies += sold;
      totalEarned += roy;
      const c = calculateContractStatus(b.contractDate, b.contractMonths);
      return `• كتاب (${b.title}): المباع ${sold} نسخة | أرباحك (${b.royaltyRate}%): ${formatEGP(roy)} | العقد: ${c.label}`;
    })
    .join("\n");

  const totalPaid = aPayouts.reduce((s, p) => s + Number(p.amount || 0), 0);
  const balance = Math.max(0, totalEarned - totalPaid);

  let text = "";
  if (type === "welcome") {
    text = `أهلاً ومرحباً بك أ. ${author.name} في عائلة دار صفقات كتابية! 🌟\n\nيسعدنا إبلاغكم بأنه تم إنشاء وتفعيل حسابكم الرسمي في "نظام صفقات" لمتابعة عقود مؤلفاتكم، المبيعات اللحظية، والأرباح والإيصالات المالية بكل شفافية.\n\n🔹 خطوات الدخول السريع وتثبيت التطبيق:\n1. اضغط على الرابط الرسمي للنظام:\n${siteUrl}\n2. اضغط على "تسجيل الدخول عبر حساب Google" باستخدام بريدكم المعتمد (${author.email}).\n3. من داخل النظام، اضغط على زر "تثبيت التطبيق" ليصبح النظام على شاشة هاتفك مباشرة.\n\nخالص تمنياتنا لكم بدوام النجاح والتألق،\nإدارة دار صفقات كتابية`;
  } else if (type === "full_sales") {
    text = `تحية طيبة أ. ${author.name}،\nإليكم التقرير المالي المحدث لمبيعات مؤلفاتكم لدى دار صفقات كتابية حتى تاريخ (${getTodayDate()}):\n\n${bookLines || "• لا توجد كتب مسجلة بعد."}\n\n📊 الملخص المالي:\n- إجمالي النسخ المباعة: ${totalCopies} نسخة\n- إجمالي الأرباح المحققة: ${formatEGP(totalEarned)}\n- إجمالي الدفعات المحولة لكم: ${formatEGP(totalPaid)}\n- صافي الرصيد المتبقي المستحق لكم: ${formatEGP(balance)}\n\nلمتابعة التفاصيل واستعراض العقود والإيصالات مباشرة عبر بوابتكم:\n${siteUrl}\n\nمع خالص التحية،\nإدارة دار صفقات كتابية`;
  } else {
    text = `إشعار عقود النشر | أ. ${author.name} المحترم،\nنود تزويدكم ببيان حالة عقود نشر مؤلفاتكم المسجلة في دار صفقات كتابية:\n\n${bookLines || "-"}\n\nيمكنكم استعراض وتحميل نسخ العقود (PDF) عبر بوابتكم الخاصة:\n${siteUrl}\n\nإدارة دار صفقات كتابية`;
  }

  document.getElementById("report-preview-text").value = text;
}

document.getElementById("btn-copy-report").addEventListener("click", () => {
  navigator.clipboard.writeText(document.getElementById("report-preview-text").value);
  showToast("تم نسخ نص الرسالة بنجاح!");
});

document.getElementById("btn-send-email-report").addEventListener("click", () => {
  const authorId = document.getElementById("report-author-id").value;
  const author = state.authors.find((a) => a.id === authorId);
  if (!author) return;
  const subject = `دار صفقات كتابية | إشعار رسمي - أ. ${author.name}`;
  const body = document.getElementById("report-preview-text").value;
  window.location.href = `mailto:${encodeURIComponent(author.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  closeModal("modal-report");
});

// لوحة التعليمات المفصلة حسب صلاحية المستخدم بالملي
function renderSmartGuide() {
  const container = document.getElementById("smart-guide-container");
  if (!container) return;

  if (state.userRole === "super_admin") {
    container.innerHTML = `
      <div class="guide-card">
        <h4 style="font-size: 16px; font-weight: 800; color: var(--primary); margin-bottom: 6px;"><i class="ri-shield-star-line"></i> صلاحيتك: الإدارة العليا الشاملة</h4>
        <p style="font-size: 13.5px;">أنت تمتلك الصلاحية المطلقة للتحكم في كافة مفاصل النظام، وحسابك مخفي ومحصن بالكامل ولا يظهر في قوائم الموظفين.</p>
      </div>
      <div class="guide-card" style="border-right-color: var(--success);">
        <h4 style="font-size: 15px; font-weight: 800; margin-bottom: 6px;">1. كيف تضيف كاتباً وتوثق عقود كتبه؟</h4>
        <p style="font-size: 13.5px;">ادخل قسم <strong>(ملفات الكُتّاب)</strong> وأنشئ ملفاً شخصياً للكاتب ببريده الإلكتروني. بعدها اضغط على بطاقة الكاتب لفتح صفحته المستقلة، ومن هناك اضغط <strong>(إضافة عقد كتاب لهذا المؤلف)</strong> لتحديد اسم الكتاب، السعر بالجنيه المصري، نسبة المؤلف، وإرفاق رابط عقد الـ PDF من جوجل درايف.</p>
      </div>
      <div class="guide-card" style="border-right-color: var(--purple);">
        <h4 style="font-size: 15px; font-weight: 800; margin-bottom: 6px;">2. كيف تدير الموظفين وتراقب نشاطهم؟</h4>
        <p style="font-size: 13.5px;">من قسم <strong>(الموظفون والصلاحيات)</strong> يمكنك إضافة بريد أي موظف ومنحه إما صلاحية كاملة أو صلاحيات مجزأة (مثلاً: البيع فقط)، كما يمكنك الضغط على <strong>(مراقبة نشاطه)</strong> لرؤية كافة العمليات التي قام بها بالتاريخ والوقت، أو إرسال تنبيه عاجل له.</p>
      </div>
    `;
  } else if (state.userRole === "employee") {
    const p = state.permissions;
    container.innerHTML = `
      <div class="guide-card">
        <h4 style="font-size: 16px; font-weight: 800; color: var(--primary); margin-bottom: 8px;"><i class="ri-user-Check-line"></i> دليل صلاحياتك ومهامك المعتمدة في النظام:</h4>
        <ul style="padding-right: 20px; font-size: 13.5px; line-height: 1.9;">
          <li><strong>تسجيل المبيعات:</strong> ${p.sell ? "✅ متاح لك (اضغط زر بيع نسخة، حدد الكمية وقناة البيع ثم أكد العملية)." : "❌ غير مفعل لحسابك."}</li>
          <li><strong>إضافة وتعديل الكتب والعقود:</strong> ${p.books ? "✅ متاح لك (تأكد من فتح صلاحية رابط جوجل درايف عند إرفاق عقد PDF)." : "❌ غير مفعل لحسابك."}</li>
          <li><strong>إدارة ملفات الكُتّاب والدفعات:</strong> ${p.authors ? "✅ متاح لك (يمكنك إضافة كُتّاب وتوثيق إيصالات التحويل)." : "❌ غير مفعل لحسابك."}</li>
          <li><strong>الاطلاع على السجل المالي والمصاريف:</strong> ${p.finance ? "✅ متاح لك." : "❌ غير مفعل لحسابك."}</li>
        </ul>
      </div>
      <div class="guide-card" style="border-right-color: var(--warning);">
        <h4 style="font-size: 15px; font-weight: 800; margin-bottom: 6px;"><i class="ri-star-smile-line"></i> نصيحة لتسريع عملك اليومي:</h4>
        <p style="font-size: 13.5px;">اضغط على علامة النجمة ⭐️ أعلى أي كتاب يطلب بكثرة ليظهر لك فوراً في الصفحة الرئيسية وفي أعلى القائمة، ولا تنسَ مراجعة قسم <strong>(التنبيهات الإدارية)</strong> يومياً.</p>
      </div>
    `;
  }
}

// ==========================================================================
// 15. تثبيت النظام كتطبيق (PWA Install Handler)
// ==========================================================================
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  state.deferredPwaPrompt = e;
});

async function triggerPwaInstall() {
  if (state.deferredPwaPrompt) {
    state.deferredPwaPrompt.prompt();
    await state.deferredPwaPrompt.userChoice;
    state.deferredPwaPrompt = null;
  } else {
    openModal("modal-pwa-guide");
  }
}

document.getElementById("btn-sidebar-pwa").addEventListener("click", triggerPwaInstall);
document.getElementById("btn-header-pwa").addEventListener("click", triggerPwaInstall);
