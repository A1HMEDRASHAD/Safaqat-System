// ==========================================================================
// Safaqat System - Core Application Engine (app.js)
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
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  increment,
  serverTimestamp,
  SUPER_ADMINS,
  isSuperAdminEmail
} from "./firebase-config.js";

// ==========================================================================
// 1. حالة النظام العامة (Application State)
// ==========================================================================
const state = {
  currentUser: null,
  userRole: null, // 'super_admin' | 'employee' | 'author'
  currentAuthorProfile: null,
  authors: [],
  books: [],
  sales: [],
  expenses: [],
  staff: [],
  unsubscribers: [],
  deferredPwaPrompt: null
};

// ==========================================================================
// 2. عناصر واجهة المستخدم (DOM Elements)
// ==========================================================================
const authScreen = document.getElementById("auth-screen");
const appScreen = document.getElementById("app-screen");
const authErrorBox = document.getElementById("auth-error-box");
const authErrorText = document.getElementById("auth-error-text");

const currentUserEmailEl = document.getElementById("current-user-email");
const currentUserRoleEl = document.getElementById("current-user-role");
const btnInstallPwa = document.getElementById("btn-install-pwa");

const adminDashboardView = document.getElementById("admin-dashboard-view");
const authorPortalView = document.getElementById("author-portal-view");
const btnBackToAdmin = document.getElementById("btn-back-to-admin");
const tabBtnStaff = document.getElementById("tab-btn-staff");

// ==========================================================================
// 3. دوال مساعدة (Formatting & Contract Calculations)
// ==========================================================================
function formatCurrency(num) {
  const val = Number(num || 0);
  return val.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + " ر.س";
}

function getTodayDateString() {
  return new Date().toISOString().split("T")[0];
}

function calculateContractStatus(startDateStr, durationMonths) {
  if (!startDateStr || !durationMonths) {
    return { endDateStr: "غير محدد", daysLeft: 0, label: "غير محدد", badgeClass: "" };
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
    return { endDateStr, daysLeft, label: `ساري (متبقي ${daysLeft} يوم)`, badgeClass: "green" };
  }
}

function showToast(message, icon = "ri-checkbox-circle-line") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `<i class="${icon}" style="font-size: 18px; color: #38bdf8;"></i><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

function openModal(modalId) {
  const m = document.getElementById(modalId);
  if (m) m.classList.add("show");
}

function closeModal(modalId) {
  const m = document.getElementById(modalId);
  if (m) m.classList.remove("show");
}

function clearSubscriptions() {
  state.unsubscribers.forEach((unsub) => {
    if (typeof unsub === "function") unsub();
  });
  state.unsubscribers = [];
}

// ==========================================================================
// 4. نظام المصادقة والتحقق من القائمة البيضاء (Auth & Whitelist)
// ==========================================================================
document.getElementById("btn-google-login").addEventListener("click", async () => {
  authErrorBox.style.display = "none";
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    console.error("Login Error:", error);
    authErrorText.textContent = "تعذر تسجيل الدخول، تأكد من تفعيل نافذة جوجل.";
    authErrorBox.style.display = "block";
  }
});

document.getElementById("btn-logout").addEventListener("click", async () => {
  clearSubscriptions();
  await signOut(auth);
});

onAuthStateChanged(auth, async (user) => {
  clearSubscriptions();

  if (!user || !user.email) {
    state.currentUser = null;
    state.userRole = null;
    authScreen.style.display = "flex";
    appScreen.style.display = "none";
    return;
  }

  const email = user.email.trim().toLowerCase();
  state.currentUser = user;

  try {
    // 1. فحص هل المستخدم من الإدارة العليا المطلقة (Super Admins)
    if (isSuperAdminEmail(email)) {
      state.userRole = "super_admin";
      launchApplication();
      return;
    }

    // 2. فحص هل المستخدم موظف مضاف في القائمة البيضاء (staff)
    const staffQuery = query(collection(db, "staff"), where("email", "==", email));
    const staffSnap = await getDocs(staffQuery);
    if (!staffSnap.empty) {
      state.userRole = "employee";
      launchApplication();
      return;
    }

    // 3. فحص هل المستخدم كاتب مسجل في قاعدة البيانات (authors)
    const authorQuery = query(collection(db, "authors"), where("email", "==", email));
    const authorSnap = await getDocs(authorQuery);
    if (!authorSnap.empty) {
      state.userRole = "author";
      const docSnap = authorSnap.docs[0];
      state.currentAuthorProfile = { id: docSnap.id, ...docSnap.data() };
      launchApplication();
      return;
    }

    // 4. إذا لم يكن في أي قائمة -> طرد فوري ومنع الدخول
    await signOut(auth);
    authErrorText.textContent = `البريد (${email}) غير مسجل في النظام. يجب اعتمادك من قِبل الإدارة أولاً.`;
    authErrorBox.style.display = "block";
    authScreen.style.display = "flex";
    appScreen.style.display = "none";

  } catch (err) {
    console.error("Verification Error:", err);
    authErrorText.textContent = "حدث خطأ أثناء التحقق من الصلاحيات. تأكد من إعدادات قاعدة البيانات.";
    authErrorBox.style.display = "block";
  }
});

// ==========================================================================
// 5. تشغيل النظام وتوجيه الصلاحيات (Launch & Role Routing)
// ==========================================================================
function launchApplication() {
  authScreen.style.display = "none";
  appScreen.style.display = "block";
  currentUserEmailEl.textContent = state.currentUser.email;

  if (state.userRole === "super_admin") {
    currentUserRoleEl.textContent = "إدارة عليا مطلقة";
    currentUserRoleEl.className = "role-badge super";
    tabBtnStaff.style.display = "inline-flex";
    adminDashboardView.style.display = "block";
    authorPortalView.style.display = "none";
    startAdminListeners();
  } else if (state.userRole === "employee") {
    currentUserRoleEl.textContent = "موظف إدارة";
    currentUserRoleEl.className = "role-badge";
    tabBtnStaff.style.display = "none";
    adminDashboardView.style.display = "block";
    authorPortalView.style.display = "none";
    startAdminListeners();
  } else if (state.userRole === "author") {
    currentUserRoleEl.textContent = "بوابة المؤلف";
    currentUserRoleEl.className = "role-badge author";
    adminDashboardView.style.display = "none";
    authorPortalView.style.display = "block";
    btnBackToAdmin.style.display = "none";
    startAuthorPortalListeners(state.currentAuthorProfile.id);
  }
}

// ==========================================================================
// 6. الاستماع الفوري للبيانات (Real-time Firestore Listeners)
// ==========================================================================
function startAdminListeners() {
  // استماع الكُتّاب
  const unsubAuthors = onSnapshot(query(collection(db, "authors"), orderBy("createdAt", "desc")), (snap) => {
    state.authors = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    populateAuthorSelectDropdown();
    renderAuthorsList();
    renderBooksList();
    updateAdminMetrics();

    // في حال كان الأدمن دخل عبر رابط معاينة كاتب معين (?author=ID)
    const urlParams = new URLSearchParams(window.location.search);
    const previewAuthorId = urlParams.get("author");
    if (previewAuthorId && !state.previewInitialized) {
      state.previewInitialized = true;
      openAuthorPortalPreview(previewAuthorId);
    }
  });

  // استماع الكتب
  const unsubBooks = onSnapshot(query(collection(db, "books"), orderBy("createdAt", "desc")), (snap) => {
    state.books = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderBooksList();
    renderAuthorsList();
    updateAdminMetrics();
  });

  // استماع المبيعات
  const unsubSales = onSnapshot(query(collection(db, "sales"), orderBy("createdAt", "desc")), (snap) => {
    state.sales = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderFinanceLog();
    updateAdminMetrics();
  });

  // استماع المصاريف
  const unsubExpenses = onSnapshot(query(collection(db, "expenses"), orderBy("createdAt", "desc")), (snap) => {
    state.expenses = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderFinanceLog();
    updateAdminMetrics();
  });

  // استماع الموظفين (للإدارة العليا)
  if (state.userRole === "super_admin") {
    const unsubStaff = onSnapshot(collection(db, "staff"), (snap) => {
      state.staff = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderStaffList();
    });
    state.unsubscribers.push(unsubStaff);
  }

  state.unsubscribers.push(unsubAuthors, unsubBooks, unsubSales, unsubExpenses);
}

// استماع خاص ببوابة الكاتب فقط
function startAuthorPortalListeners(authorId) {
  const unsubAuthorDoc = onSnapshot(doc(db, "authors", authorId), (docSnap) => {
    if (docSnap.exists()) {
      state.currentAuthorProfile = { id: docSnap.id, ...docSnap.data() };
      renderAuthorPortalUI();
    }
  });

  const qBooks = query(collection(db, "books"), where("authorId", "==", authorId));
  const unsubAuthorBooks = onSnapshot(qBooks, (snap) => {
    state.books = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderAuthorPortalUI();
  });

  state.unsubscribers.push(unsubAuthorDoc, unsubAuthorBooks);
}

// ==========================================================================
// 7. الحسابات المالية ولوحة الإحصائيات (Financial Calculations)
// ==========================================================================
function updateAdminMetrics() {
  let totalRevenue = 0;
  let totalCopies = 0;
  let totalRoyalties = 0;

  state.books.forEach((b) => {
    const sold = Number(b.copiesSold || 0);
    const price = Number(b.price || 0);
    const royaltyRate = Number(b.royaltyRate || 0);
    const rev = sold * price;
    const roy = rev * (royaltyRate / 100);

    totalCopies += sold;
    totalRevenue += rev;
    totalRoyalties += roy;
  });

  const totalExpenses = state.expenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
  const netProfit = totalRevenue - totalRoyalties - totalExpenses;

  document.getElementById("stat-total-revenue").textContent = formatCurrency(totalRevenue);
  document.getElementById("stat-total-copies").textContent = `${totalCopies} نسخة مباعة`;
  document.getElementById("stat-authors-royalties").textContent = formatCurrency(totalRoyalties);
  document.getElementById("stat-total-expenses").textContent = formatCurrency(totalExpenses);
  document.getElementById("stat-net-profit").textContent = formatCurrency(netProfit);
}

// ==========================================================================
// 8. عرض وبناء البطاقات الأفقية للكتب والمبيعات السريعة (Books UI)
// ==========================================================================
function renderBooksList() {
  const container = document.getElementById("books-list-container");
  const searchVal = (document.getElementById("search-books-input").value || "").trim().toLowerCase();

  const filtered = state.books.filter((b) => {
    const titleMatch = (b.title || "").toLowerCase().includes(searchVal);
    const authorMatch = (b.authorName || "").toLowerCase().includes(searchVal);
    return titleMatch || authorMatch;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="ri-book-2-line"></i>
        <p>لا توجد كتب مطابقة للبحث أو لم يتم إضافة كتب بعد.</p>
      </div>`;
    return;
  }

  container.innerHTML = filtered.map((b) => {
    const sold = Number(b.copiesSold || 0);
    const price = Number(b.price || 0);
    const rate = Number(b.royaltyRate || 0);
    const totalRev = sold * price;
    const authorShare = totalRev * (rate / 100);
    const houseShare = totalRev - authorShare;
    const contract = calculateContractStatus(b.contractDate, b.contractMonths);

    return `
      <div class="h-card" id="book-card-${b.id}">
        <div class="h-card-main" data-toggle-card="book-card-${b.id}">
          <div class="h-card-right">
            <div class="h-card-icon"><i class="ri-book-read-line"></i></div>
            <div>
              <div class="h-card-title">
                <span>${b.title}</span>
                <span class="meta-pill ${contract.badgeClass}">${contract.label}</span>
              </div>
              <div class="h-card-meta">
                <span><i class="ri-user-3-line"></i> المؤلف: <strong>${b.authorName || "غير محدد"}</strong></span>
                <span class="meta-pill blue">السعر: ${formatCurrency(price)}</span>
                <span class="meta-pill">نسبة الكاتب: ${rate}%</span>
              </div>
            </div>
          </div>

          <div class="h-card-stats">
            <div class="mini-stat">
              <span class="mini-stat-label">النسخ المباعة</span>
              <span class="mini-stat-val primary">${sold} نسخة</span>
            </div>
            <div class="mini-stat">
              <span class="mini-stat-label">ربح الكاتب</span>
              <span class="mini-stat-val">${formatCurrency(authorShare)}</span>
            </div>
            <div class="mini-stat">
              <span class="mini-stat-label">صافي الدار</span>
              <span class="mini-stat-val success">${formatCurrency(houseShare)}</span>
            </div>
          </div>

          <div class="h-card-actions" data-stop-prop="true">
            <button class="btn-sell-quick" data-action="sell-book" data-id="${b.id}">
              <i class="ri-add-circle-line" style="font-size: 17px;"></i>
              <span>تم بيع نسخة</span>
            </button>
            <button class="icon-btn primary" title="تعديل الكتاب والعقد" data-action="edit-book" data-id="${b.id}">
              <i class="ri-edit-box-line"></i>
            </button>
            <button class="icon-btn danger" title="حذف الكتاب" data-action="delete-book" data-id="${b.id}">
              <i class="ri-delete-bin-6-line"></i>
            </button>
          </div>
        </div>

        <div class="h-card-expand">
          <div class="expand-grid">
            <div class="expand-item">
              <span>إجمالي مبيعات الكتاب</span>
              <strong>${formatCurrency(totalRev)}</strong>
            </div>
            <div class="expand-item">
              <span>ربح النسخة الواحدة للكاتب</span>
              <strong>${formatCurrency(price * (rate / 100))}</strong>
            </div>
            <div class="expand-item">
              <span>ربح النسخة الواحدة للدار</span>
              <strong>${formatCurrency(price - (price * (rate / 100)))}</strong>
            </div>
            <div class="expand-item">
              <span>تاريخ بداية عقد الكتاب</span>
              <strong>${b.contractDate || "-"}</strong>
            </div>
            <div class="expand-item">
              <span>تاريخ انتهاء عقد الكتاب</span>
              <strong>${contract.endDateStr} (${b.contractMonths || 0} شهر)</strong>
            </div>
            <div class="expand-item">
              <span>شروط وملاحظات العقد</span>
              <strong>${b.notes || "لا توجد ملاحظات"}</strong>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

// ==========================================================================
// 9. عرض وبناء بطاقات الكُتّاب والتعاقدات (Authors UI)
// ==========================================================================
function renderAuthorsList() {
  const container = document.getElementById("authors-list-container");
  const searchVal = (document.getElementById("search-authors-input").value || "").trim().toLowerCase();

  const filtered = state.authors.filter((a) => {
    return (a.name || "").toLowerCase().includes(searchVal) ||
           (a.email || "").toLowerCase().includes(searchVal);
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="ri-user-star-line"></i>
        <p>لا يوجد مؤلفون مسجلون حالياً. اضغط على "إضافة كاتب جديد" للبدء.</p>
      </div>`;
    return;
  }

  container.innerHTML = filtered.map((a) => {
    const authorBooks = state.books.filter((b) => b.authorId === a.id);
    const totalCopies = authorBooks.reduce((s, b) => s + Number(b.copiesSold || 0), 0);
    const totalRoyalties = authorBooks.reduce((s, b) => {
      const rev = Number(b.copiesSold || 0) * Number(b.price || 0);
      return s + (rev * (Number(b.royaltyRate || 0) / 100));
    }, 0);

    const contract = calculateContractStatus(a.startDate, a.durationMonths);

    return `
      <div class="h-card" id="author-card-${a.id}">
        <div class="h-card-main" data-toggle-card="author-card-${a.id}">
          <div class="h-card-right">
            <div class="h-card-icon"><i class="ri-quill-pen-line"></i></div>
            <div>
              <div class="h-card-title">
                <span>${a.name}</span>
                <span class="meta-pill ${contract.badgeClass}">${contract.label}</span>
              </div>
              <div class="h-card-meta">
                <span dir="ltr"><i class="ri-mail-line"></i> ${a.email}</span>
                <span class="meta-pill blue">${authorBooks.length} مؤلفات</span>
                <span class="meta-pill">النسبة الافتراضية: ${a.defaultRoyalty || 0}%</span>
              </div>
            </div>
          </div>

          <div class="h-card-stats">
            <div class="mini-stat">
              <span class="mini-stat-label">إجمالي مبيعاته</span>
              <span class="mini-stat-val primary">${totalCopies} نسخة</span>
            </div>
            <div class="mini-stat">
              <span class="mini-stat-label">مستحقات الكاتب</span>
              <span class="mini-stat-val success">${formatCurrency(totalRoyalties)}</span>
            </div>
          </div>

          <div class="h-card-actions" data-stop-prop="true">
            <button class="btn btn-outline" style="padding: 7px 12px; font-size: 12.5px;" data-action="open-report" data-id="${a.id}" title="إرسال تقرير للكاتب">
              <i class="ri-mail-send-line" style="color: var(--brand-primary);"></i>
              <span>إرسال تقرير</span>
            </button>
            <button class="icon-btn primary" title="نسخ رابط صفحة الكاتب الخاصة" data-action="copy-author-link" data-id="${a.id}">
              <i class="ri-links-line"></i>
            </button>
            <button class="icon-btn" title="معاينة صفحة الكاتب" data-action="preview-author" data-id="${a.id}">
              <i class="ri-eye-line"></i>
            </button>
            <button class="icon-btn primary" title="تعديل بيانات وعقد الكاتب" data-action="edit-author" data-id="${a.id}">
              <i class="ri-edit-box-line"></i>
            </button>
            <button class="icon-btn danger" title="حذف الكاتب" data-action="delete-author" data-id="${a.id}">
              <i class="ri-delete-bin-6-line"></i>
            </button>
          </div>
        </div>

        <div class="h-card-expand">
          <div class="expand-grid">
            <div class="expand-item">
              <span>تاريخ بداية التعاقد</span>
              <strong>${a.startDate || "-"}</strong>
            </div>
            <div class="expand-item">
              <span>تاريخ انتهاء التعاقد</span>
              <strong>${contract.endDateStr} (${a.durationMonths || 0} شهر)</strong>
            </div>
            <div class="expand-item">
              <span>رقم التواصل</span>
              <strong dir="ltr">${a.phone || "غير مسجل"}</strong>
            </div>
            <div class="expand-item">
              <span>مؤلفات الكاتب المسجلة</span>
              <strong>${authorBooks.map((b) => b.title).join(" ، ") || "لا توجد كتب مضافة"}</strong>
            </div>
            <div class="expand-item">
              <span>بنود وملاحظات التعاقد</span>
              <strong>${a.notes || "لا توجد ملاحظات"}</strong>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

// ==========================================================================
// 10. عرض السجل المالي (المبيعات والمصاريف) (Finance Log UI)
// ==========================================================================
function renderFinanceLog() {
  const container = document.getElementById("finance-log-container");

  const combined = [
    ...state.sales.map((s) => ({ ...s, logType: "sale" })),
    ...state.expenses.map((e) => ({ ...e, logType: "expense" }))
  ].sort((a, b) => {
    const tA = a.createdAt?.seconds || 0;
    const tB = b.createdAt?.seconds || 0;
    return tB - tA;
  });

  if (combined.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="ri-exchange-dollar-line"></i>
        <p>لا توجد حركات مالية مسجلة حتى الآن.</p>
      </div>`;
    return;
  }

  container.innerHTML = combined.slice(0, 60).map((item) => {
    const dateStr = item.dateString || "اليوم";
    if (item.logType === "sale") {
      return `
        <div class="h-card">
          <div class="h-card-main" style="cursor: default;">
            <div class="h-card-right">
              <div class="h-card-icon" style="background: var(--success-bg); color: var(--success);">
                <i class="ri-arrow-left-down-line"></i>
              </div>
              <div>
                <div class="h-card-title">
                  <span>بيع نسخة: ${item.bookTitle}</span>
                  <span class="meta-pill green">+${formatCurrency(item.price)}</span>
                </div>
                <div class="h-card-meta">
                  <span>المؤلف: ${item.authorName}</span>
                  <span>• نصيب الكاتب: ${formatCurrency(item.authorCut)}</span>
                  <span>• صافي الدار: ${formatCurrency(item.houseCut)}</span>
                  <span>• التاريخ: ${dateStr}</span>
                </div>
              </div>
            </div>
            <div class="h-card-actions">
              <button class="icon-btn danger" title="إلغاء وحذف عملية البيع هذه" data-action="delete-sale" data-id="${item.id}" data-book-id="${item.bookId}">
                <i class="ri-delete-bin-line"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    } else {
      return `
        <div class="h-card">
          <div class="h-card-main" style="cursor: default;">
            <div class="h-card-right">
              <div class="h-card-icon" style="background: var(--danger-bg); color: var(--danger);">
                <i class="ri-arrow-right-up-line"></i>
              </div>
              <div>
                <div class="h-card-title">
                  <span>مصروف: ${item.title}</span>
                  <span class="meta-pill red">-${formatCurrency(item.amount)}</span>
                </div>
                <div class="h-card-meta">
                  <span class="meta-pill amber">${item.category || "عام"}</span>
                  <span>• التاريخ: ${dateStr}</span>
                  <span>• بواسطة: ${item.addedBy || "الإدارة"}</span>
                </div>
              </div>
            </div>
            <div class="h-card-actions">
              <button class="icon-btn danger" title="حذف المصروف" data-action="delete-expense" data-id="${item.id}">
                <i class="ri-delete-bin-line"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }
  }).join("");
}

// ==========================================================================
// 11. عرض قائمة الصلاحيات والإدارة العليا (Staff & Super Admins UI)
// ==========================================================================
function renderStaffList() {
  const container = document.getElementById("staff-list-container");

  // 1. بطاقات الإدارة العليا الثلاثة (مقفلة وغير قابلة للحذف أبداً)
  const superAdminsHtml = SUPER_ADMINS.map((email) => `
    <div class="h-card" style="border-right: 4px solid var(--purple);">
      <div class="h-card-main" style="cursor: default;">
        <div class="h-card-right">
          <div class="h-card-icon" style="background: var(--purple-bg); color: var(--purple);">
            <i class="ri-shield-star-line"></i>
          </div>
          <div>
            <div class="h-card-title">
              <span dir="ltr">${email}</span>
              <span class="meta-pill" style="background: var(--purple-bg); color: var(--purple);">إدارة عليا مطلقة (محمي)</span>
            </div>
            <div class="h-card-meta">
              <span>صلاحية كاملة غير قابلة للنزع أو التعديل من أي طرف.</span>
            </div>
          </div>
        </div>
        <div class="h-card-actions">
          <span class="meta-pill green"><i class="ri-lock-fill"></i> محمي برمجياً</span>
        </div>
      </div>
    </div>
  `).join("");

  // 2. بطاقات الموظفين المضافين
  const staffHtml = state.staff.map((st) => `
    <div class="h-card">
      <div class="h-card-main" style="cursor: default;">
        <div class="h-card-right">
          <div class="h-card-icon">
            <i class="ri-user-settings-line"></i>
          </div>
          <div>
            <div class="h-card-title">
              <span>${st.name}</span>
              <span class="meta-pill blue">موظف إدارة</span>
            </div>
            <div class="h-card-meta">
              <span dir="ltr">${st.email}</span>
              <span>• صلاحية إدخال المبيعات والكتب والتقارير</span>
            </div>
          </div>
        </div>
        <div class="h-card-actions">
          <button class="icon-btn danger" title="سحب الصلاحية وحذف الموظف" data-action="delete-staff" data-id="${st.id}">
            <i class="ri-delete-bin-line"></i>
          </button>
        </div>
      </div>
    </div>
  `).join("");

  container.innerHTML = superAdminsHtml + staffHtml;
}

// ==========================================================================
// 12. بوابة الكاتب الخاصة (Author Personal Portal UI)
// ==========================================================================
function renderAuthorPortalUI() {
  const profile = state.currentAuthorProfile;
  if (!profile) return;

  const contract = calculateContractStatus(profile.startDate, profile.durationMonths);
  document.getElementById("portal-author-name").textContent = `أهلاً بك، أ. ${profile.name}`;
  document.getElementById("portal-author-contract-info").textContent =
    `تاريخ التعاقد: ${profile.startDate || "-"} | مدة العقد: ${profile.durationMonths || 0} شهر | تاريخ الانتهاء: ${contract.endDateStr}`;

  const badge = document.getElementById("portal-contract-badge");
  badge.textContent = contract.label;
  badge.className = `meta-pill ${contract.badgeClass}`;

  let totalCopies = 0;
  let totalRoyalties = 0;

  state.books.forEach((b) => {
    const sold = Number(b.copiesSold || 0);
    const rev = sold * Number(b.price || 0);
    const roy = rev * (Number(b.royaltyRate || 0) / 100);
    totalCopies += sold;
    totalRoyalties += roy;
  });

  document.getElementById("portal-total-copies").textContent = `${totalCopies} نسخة`;
  document.getElementById("portal-total-royalties").textContent = formatCurrency(totalRoyalties);
  document.getElementById("portal-total-books").textContent = `${state.books.length} مؤلفات`;

  const listEl = document.getElementById("portal-books-list");
  if (state.books.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <i class="ri-book-open-line"></i>
        <p>لا توجد مؤلفات مربوطة بحسابك حالياً.</p>
      </div>`;
    return;
  }

  listEl.innerHTML = state.books.map((b) => {
    const sold = Number(b.copiesSold || 0);
    const price = Number(b.price || 0);
    const rate = Number(b.royaltyRate || 0);
    const totalRev = sold * price;
    const authorShare = totalRev * (rate / 100);
    const bContract = calculateContractStatus(b.contractDate, b.contractMonths);

    return `
      <div class="h-card" id="portal-book-${b.id}">
        <div class="h-card-main" data-toggle-card="portal-book-${b.id}">
          <div class="h-card-right">
            <div class="h-card-icon"><i class="ri-book-2-line"></i></div>
            <div>
              <div class="h-card-title">
                <span>${b.title}</span>
                <span class="meta-pill ${bContract.badgeClass}">${bContract.label}</span>
              </div>
              <div class="h-card-meta">
                <span class="meta-pill blue">سعر النسخة: ${formatCurrency(price)}</span>
                <span class="meta-pill">نسبتك في العقد: ${rate}%</span>
                <span>• ربحك من كل نسخة: <strong>${formatCurrency(price * (rate / 100))}</strong></span>
              </div>
            </div>
          </div>

          <div class="h-card-stats">
            <div class="mini-stat">
              <span class="mini-stat-label">النسخ المباعة</span>
              <span class="mini-stat-val primary">${sold} نسخة</span>
            </div>
            <div class="mini-stat">
              <span class="mini-stat-label">صافي أرباحك من الكتاب</span>
              <span class="mini-stat-val success">${formatCurrency(authorShare)}</span>
            </div>
          </div>
        </div>

        <div class="h-card-expand">
          <div class="expand-grid">
            <div class="expand-item">
              <span>تاريخ عقد الكتاب</span>
              <strong>${b.contractDate || "-"}</strong>
            </div>
            <div class="expand-item">
              <span>تاريخ انتهاء العقد</span>
              <strong>${bContract.endDateStr} (${b.contractMonths || 0} شهر)</strong>
            </div>
            <div class="expand-item">
              <span>تفاصيل وشروط عقد الكتاب</span>
              <strong>${b.notes || "عقد نشر قياسي"}</strong>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

// معاينة صفحة الكاتب من داخل حساب الأدمن
function openAuthorPortalPreview(authorId) {
  const author = state.authors.find((a) => a.id === authorId);
  if (!author) return;
  state.currentAuthorProfile = author;
  const allBooksBackup = [...state.books];
  state.books = state.books.filter((b) => b.authorId === authorId);

  adminDashboardView.style.display = "none";
  authorPortalView.style.display = "block";
  btnBackToAdmin.style.display = "inline-flex";
  renderAuthorPortalUI();

  btnBackToAdmin.onclick = () => {
    state.books = allBooksBackup;
    authorPortalView.style.display = "none";
    adminDashboardView.style.display = "block";
    window.history.replaceState({}, document.title, window.location.pathname);
  };
}

// ==========================================================================
// 13. العمليات التفاعلية (بيع سريع، تعديل، حذف، نسخ رابط، تقارير)
// ==========================================================================
document.addEventListener("click", async (e) => {
  // أ) إغلاق النوافذ المنبثقة
  const closeBtn = e.target.closest("[data-close]");
  if (closeBtn) {
    closeModal(closeBtn.getAttribute("data-close"));
    return;
  }

  // ب) التعامل مع أزرار الإجراءات السريعة
  const actionBtn = e.target.closest("[data-action]");
  if (actionBtn) {
    e.stopPropagation();
    const action = actionBtn.getAttribute("data-action");
    const id = actionBtn.getAttribute("data-id");

    if (action === "sell-book") {
      await handleQuickSellBook(id);
    } else if (action === "edit-book") {
      openEditBookModal(id);
    } else if (action === "delete-book") {
      await handleDeleteBook(id);
    } else if (action === "edit-author") {
      openEditAuthorModal(id);
    } else if (action === "delete-author") {
      await handleDeleteAuthor(id);
    } else if (action === "copy-author-link") {
      copyAuthorShareLink(id);
    } else if (action === "preview-author") {
      openAuthorPortalPreview(id);
    } else if (action === "open-report") {
      openReportGeneratorModal(id);
    } else if (action === "delete-sale") {
      const bookId = actionBtn.getAttribute("data-book-id");
      await handleDeleteSale(id, bookId);
    } else if (action === "delete-expense") {
      await handleDeleteExpense(id);
    } else if (action === "delete-staff") {
      await handleDeleteStaff(id);
    }
    return;
  }

  // ج) فتح وإغلاق تفاصيل البطاقة الأفقية عند الضغط عليها
  const cardMain = e.target.closest("[data-toggle-card]");
  if (cardMain && !e.target.closest("[data-stop-prop]")) {
    const cardId = cardMain.getAttribute("data-toggle-card");
    const cardEl = document.getElementById(cardId);
    if (cardEl) cardEl.classList.toggle("open");
  }
});

// دالة البيع الفوري بضغطة زر واحدة
async function handleQuickSellBook(bookId) {
  const book = state.books.find((b) => b.id === bookId);
  if (!book) return;

  const price = Number(book.price || 0);
  const rate = Number(book.royaltyRate || 0);
  const authorCut = Number((price * (rate / 100)).toFixed(2));
  const houseCut = Number((price - authorCut).toFixed(2));

  try {
    // 1. تحديث عداد مبيعات الكتاب
    await updateDoc(doc(db, "books", bookId), {
      copiesSold: increment(1)
    });

    // 2. توثيق عملية البيع في السجل المالي بالتاريخ والوقت
    await addDoc(collection(db, "sales"), {
      bookId: book.id,
      bookTitle: book.title,
      authorId: book.authorId,
      authorName: book.authorName,
      price,
      royaltyRate: rate,
      authorCut,
      houseCut,
      dateString: getTodayDateString(),
      soldBy: state.currentUser.email,
      createdAt: serverTimestamp()
    });

    showToast(`تم توثيق بيع نسخة من "${book.title}" بنجاح!`);
  } catch (err) {
    console.error("Sell Error:", err);
    showToast("حدث خطأ أثناء تسجيل البيع", "ri-error-warning-line");
  }
}

// إلغاء عملية بيع من السجل (ينقص العداد تلقائياً)
async function handleDeleteSale(saleId, bookId) {
  if (!confirm("هل أنت متأكد من إلغاء وحذف عملية البيع هذه؟ سيتم إنقاص نسخة من مبيعات الكتاب.")) return;
  try {
    await deleteDoc(doc(db, "sales", saleId));
    if (bookId) {
      await updateDoc(doc(db, "books", bookId), {
        copiesSold: increment(-1)
      });
    }
    showToast("تم إلغاء عملية البيع وتحديث الإحصائيات.");
  } catch (err) {
    console.error(err);
  }
}

// ==========================================================================
// 14. إدارة النماذج: الكُتّاب، الكتب، المصاريف، والموظفين (CRUD Forms)
// ==========================================================================

// --- أ) نموذج الكاتب ---
document.getElementById("btn-open-author-modal").addEventListener("click", () => {
  document.getElementById("form-author").reset();
  document.getElementById("author-id-input").value = "";
  document.getElementById("author-start-date").value = getTodayDateString();
  document.getElementById("modal-author-title").textContent = "إضافة كاتب وتوثيق تعاقد جديد";
  openModal("modal-author");
});

function openEditAuthorModal(authorId) {
  const a = state.authors.find((x) => x.id === authorId);
  if (!a) return;
  document.getElementById("author-id-input").value = a.id;
  document.getElementById("author-name-input").value = a.name || "";
  document.getElementById("author-email-input").value = a.email || "";
  document.getElementById("author-start-date").value = a.startDate || getTodayDateString();
  document.getElementById("author-duration-months").value = a.durationMonths || 12;
  document.getElementById("author-royalty-input").value = a.defaultRoyalty ?? 20;
  document.getElementById("author-phone-input").value = a.phone || "";
  document.getElementById("author-notes-input").value = a.notes || "";
  document.getElementById("modal-author-title").textContent = `تعديل بيانات وعقد: ${a.name}`;
  openModal("modal-author");
}

document.getElementById("form-author").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("author-id-input").value;
  const payload = {
    name: document.getElementById("author-name-input").value.trim(),
    email: document.getElementById("author-email-input").value.trim().toLowerCase(),
    startDate: document.getElementById("author-start-date").value,
    durationMonths: Number(document.getElementById("author-duration-months").value),
    defaultRoyalty: Number(document.getElementById("author-royalty-input").value),
    phone: document.getElementById("author-phone-input").value.trim(),
    notes: document.getElementById("author-notes-input").value.trim()
  };

  try {
    if (id) {
      await updateDoc(doc(db, "authors", id), payload);
      showToast("تم تحديث بيانات الكاتب والعقد بنجاح.");
    } else {
      payload.createdAt = serverTimestamp();
      await addDoc(collection(db, "authors"), payload);
      showToast("تم إنشاء حساب الكاتب وتوثيق عقده بنجاح.");
    }
    closeModal("modal-author");
  } catch (err) {
    console.error(err);
    showToast("تعذر حفظ بيانات الكاتب", "ri-error-warning-line");
  }
});

async function handleDeleteAuthor(authorId) {
  if (!confirm("هل أنت متأكد من حذف صفحة هذا الكاتب؟")) return;
  try {
    await deleteDoc(doc(db, "authors", authorId));
    showToast("تم حذف الكاتب من النظام.");
  } catch (err) {
    console.error(err);
  }
}

function copyAuthorShareLink(authorId) {
  const a = state.authors.find((x) => x.id === authorId);
  if (!a) return;
  const shareUrl = `${window.location.origin}${window.location.pathname}?author=${authorId}`;
  navigator.clipboard.writeText(shareUrl);
  showToast(`تم نسخ رابط بوابة الكاتب (${a.name})! أرسله له ليسجل دخوله ببريده.`);
}

// --- ب) نموذج الكتاب ---
function populateAuthorSelectDropdown() {
  const select = document.getElementById("book-author-select");
  const currentVal = select.value;
  select.innerHTML = `<option value="">-- اختر الكاتب --</option>` +
    state.authors.map((a) => `<option value="${a.id}" data-royalty="${a.defaultRoyalty || 20}">${a.name} (${a.email})</option>`).join("");
  if (currentVal) select.value = currentVal;
}

document.getElementById("book-author-select").addEventListener("change", (e) => {
  const selectedOpt = e.target.selectedOptions[0];
  if (selectedOpt && selectedOpt.dataset.royalty) {
    document.getElementById("book-royalty-input").value = selectedOpt.dataset.royalty;
  }
});

document.getElementById("btn-open-book-modal").addEventListener("click", () => {
  if (state.authors.length === 0) {
    showToast("يرجى إضافة كاتب واحد على الأقل قبل إضافة كتاب!", "ri-error-warning-line");
    return;
  }
  document.getElementById("form-book").reset();
  document.getElementById("book-id-input").value = "";
  document.getElementById("book-contract-date").value = getTodayDateString();
  document.getElementById("modal-book-title").textContent = "إضافة كتاب جديد وربط تعاقده";
  openModal("modal-book");
});

function openEditBookModal(bookId) {
  const b = state.books.find((x) => x.id === bookId);
  if (!b) return;
  populateAuthorSelectDropdown();
  document.getElementById("book-id-input").value = b.id;
  document.getElementById("book-title-input").value = b.title || "";
  document.getElementById("book-author-select").value = b.authorId || "";
  document.getElementById("book-price-input").value = b.price || "";
  document.getElementById("book-royalty-input").value = b.royaltyRate ?? 20;
  document.getElementById("book-contract-date").value = b.contractDate || getTodayDateString();
  document.getElementById("book-contract-months").value = b.contractMonths || 24;
  document.getElementById("book-notes-input").value = b.notes || "";
  document.getElementById("modal-book-title").textContent = `تعديل الكتاب: ${b.title}`;
  openModal("modal-book");
}

document.getElementById("form-book").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("book-id-input").value;
  const authorId = document.getElementById("book-author-select").value;
  const authorObj = state.authors.find((a) => a.id === authorId);

  const payload = {
    title: document.getElementById("book-title-input").value.trim(),
    authorId,
    authorName: authorObj ? authorObj.name : "غير محدد",
    price: Number(document.getElementById("book-price-input").value),
    royaltyRate: Number(document.getElementById("book-royalty-input").value),
    contractDate: document.getElementById("book-contract-date").value,
    contractMonths: Number(document.getElementById("book-contract-months").value),
    notes: document.getElementById("book-notes-input").value.trim()
  };

  try {
    if (id) {
      await updateDoc(doc(db, "books", id), payload);
      showToast("تم تحديث بيانات الكتاب والتعاقد.");
    } else {
      payload.copiesSold = 0;
      payload.createdAt = serverTimestamp();
      await addDoc(collection(db, "books"), payload);
      showToast("تمت إضافة الكتاب وربط عقده بالمؤلف بنجاح.");
    }
    closeModal("modal-book");
  } catch (err) {
    console.error(err);
    showToast("حدث خطأ أثناء حفظ الكتاب", "ri-error-warning-line");
  }
});

async function handleDeleteBook(bookId) {
  if (!confirm("هل أنت متأكد من حذف هذا الكتاب نهائياً؟")) return;
  try {
    await deleteDoc(doc(db, "books", bookId));
    showToast("تم حذف الكتاب.");
  } catch (err) {
    console.error(err);
  }
}

// --- ج) نموذج المصاريف ---
document.getElementById("btn-open-expense-modal").addEventListener("click", () => {
  document.getElementById("form-expense").reset();
  openModal("modal-expense");
});

document.getElementById("form-expense").addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    title: document.getElementById("expense-title-input").value.trim(),
    amount: Number(document.getElementById("expense-amount-input").value),
    category: document.getElementById("expense-category-input").value,
    dateString: getTodayDateString(),
    addedBy: state.currentUser.email,
    createdAt: serverTimestamp()
  };

  try {
    await addDoc(collection(db, "expenses"), payload);
    showToast("تم توثيق المصروف وخصمه من صافي الأرباح.");
    closeModal("modal-expense");
  } catch (err) {
    console.error(err);
  }
});

async function handleDeleteExpense(expenseId) {
  if (!confirm("حذف هذا المصروف؟")) return;
  try {
    await deleteDoc(doc(db, "expenses", expenseId));
    showToast("تم حذف المصروف.");
  } catch (err) {
    console.error(err);
  }
}

// --- د) نموذج إضافة موظف (خاص بالإدارة العليا) ---
document.getElementById("btn-open-staff-modal").addEventListener("click", () => {
  document.getElementById("form-staff").reset();
  openModal("modal-staff");
});

document.getElementById("form-staff").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("staff-email-input").value.trim().toLowerCase();
  if (isSuperAdminEmail(email)) {
    showToast("هذا البريد مسجل مسبقاً كإدارة عليا مطلقة!", "ri-shield-star-line");
    return;
  }

  try {
    await addDoc(collection(db, "staff"), {
      name: document.getElementById("staff-name-input").value.trim(),
      email,
      role: "employee",
      createdAt: serverTimestamp()
    });
    showToast(`تم اعتماد الموظف (${email}) في القائمة البيضاء.`);
    closeModal("modal-staff");
  } catch (err) {
    console.error(err);
  }
});

async function handleDeleteStaff(staffId) {
  if (!confirm("هل تريد سحب الصلاحية وحذف هذا الموظف من النظام؟")) return;
  try {
    await deleteDoc(doc(db, "staff", staffId));
    showToast("تم سحب صلاحية الموظف.");
  } catch (err) {
    console.error(err);
  }
}

// ==========================================================================
// 15. مولد التقارير الرسمية وإرسال البريد للكاتب (Reports Engine)
// ==========================================================================
function openReportGeneratorModal(authorId) {
  document.getElementById("report-author-id").value = authorId;
  document.getElementById("report-type-select").value = "full_sales";
  generateReportText();
  openModal("modal-report");
}

document.getElementById("report-type-select").addEventListener("change", generateReportText);

function generateReportText() {
  const authorId = document.getElementById("report-author-id").value;
  const reportType = document.getElementById("report-type-select").value;
  const author = state.authors.find((a) => a.id === authorId);
  if (!author) return;

  const authorBooks = state.books.filter((b) => b.authorId === authorId);
  const contract = calculateContractStatus(author.startDate, author.durationMonths);
  const portalUrl = `${window.location.origin}${window.location.pathname}?author=${author.id}`;

  let totalCopies = 0;
  let totalRoyalties = 0;
  const booksLines = authorBooks.map((b) => {
    const sold = Number(b.copiesSold || 0);
    const rev = sold * Number(b.price || 0);
    const roy = rev * (Number(b.royaltyRate || 0) / 100);
    totalCopies += sold;
    totalRoyalties += roy;
    const bContract = calculateContractStatus(b.contractDate, b.contractMonths);
    return `- كتاب (${b.title}): تم بيع ${sold} نسخة | نسبتك (${b.royaltyRate}%) | مستحقاتك: ${formatCurrency(roy)} | حالة عقد الكتاب: ${bContract.label}`;
  }).join("\n");

  let text = "";
  if (reportType === "full_sales") {
    text = `تحية طيبة أ. ${author.name}،\nيسعدنا في دار صفقات كتابية تزويدكم بالتقرير المالي الإجمالي لمبيعات مؤلفاتكم حتى تاريخ (${getTodayDateString()}):\n\n• إجمالي النسخ المباعة: ${totalCopies} نسخة\n• إجمالي المستحقات المالية (الأرباح): ${formatCurrency(totalRoyalties)}\n• عدد المؤلفات المنشورة: ${authorBooks.length}\n\nللاطلاع الحي والمستمر على تفاصيل مبيعاتكم أولاً بأول، يمكنكم الدخول لبوابتكم الخاصة عبر بريدكم المعتمد:\n${portalUrl}\n\nمع خالص التحية والتقدير،\nإدارة نظام صفقات كتابية`;
  } else if (reportType === "book_sales") {
    text = `تحية طيبة أ. ${author.name}،\nفيما يلي التقرير التفصيلي لمبيعات وعقود مؤلفاتكم المسجلة في دار صفقات كتابية:\n\n${booksLines || "لا توجد مؤلفات مسجلة حالياً."}\n\n• إجمالي الأرباح المستحقة لكم: ${formatCurrency(totalRoyalties)}\n\nبوابتكم الخاصة للمتابعة المباشرة:\n${portalUrl}\n\nإدارة نظام صفقات كتابية`;
  } else if (reportType === "contract_alert") {
    text = `إشعار رسمي | أ. ${author.name} المحترم،\nنود إشعاركم ببيانات وحالة التعاقد الخاص بكم لدى دار صفقات كتابية:\n\n• تاريخ بداية التعاقد: ${author.startDate}\n• مدة التعاقد: ${author.durationMonths} شهر\n• تاريخ انتهاء التعاقد: ${contract.endDateStr}\n• الحالة الحالية: ${contract.label}\n\nحالة عقود الكتب التابعة لكم:\n${booksLines || "-"}\n\nنسعد بتواصلكم لتجديد التعاقد أو الاستفسار.\nإدارة دار صفقات كتابية`;
  }

  document.getElementById("report-preview-text").value = text;
}

document.getElementById("btn-copy-report").addEventListener("click", () => {
  const txt = document.getElementById("report-preview-text").value;
  navigator.clipboard.writeText(txt);
  showToast("تم نسخ نص التقرير للحافظة بنجاح!");
});

document.getElementById("btn-send-email-report").addEventListener("click", async () => {
  const authorId = document.getElementById("report-author-id").value;
  const author = state.authors.find((a) => a.id === authorId);
  if (!author) return;

  const bodyText = document.getElementById("report-preview-text").value;
  const subject = `تقرير رسمي - دار صفقات كتابية | أ. ${author.name}`;

  try {
    // توثيق التقرير في قاعدة البيانات (يدعم أيضاً إضافة Trigger Email في فايربيس تلقائياً)
    await addDoc(collection(db, "mail_reports"), {
      to: author.email,
      authorId: author.id,
      authorName: author.name,
      message: {
        subject,
        text: bodyText
      },
      sentBy: state.currentUser.email,
      createdAt: serverTimestamp()
    });
  } catch (e) {
    console.warn("Mail log note:", e);
  }

  // فتح تطبيق البريد الرسمي مع تعبئة الإيميل والعنوان والتقرير فوراً
  const mailtoLink = `mailto:${encodeURIComponent(author.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
  window.location.href = mailtoLink;
  showToast(`تم تجهيز الإرسال لبريد الكاتب: ${author.email}`);
  closeModal("modal-report");
});

// ==========================================================================
// 16. التنقل بين التبويبات والبحث الفوري ودعم تطبيق الويب (Tabs, Search & PWA)
// ==========================================================================
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((c) => (c.style.display = "none"));

    btn.classList.add("active");
    const targetId = btn.getAttribute("data-tab");
    const targetSection = document.getElementById(targetId);
    if (targetSection) targetSection.style.display = "block";
  });
});

document.getElementById("search-books-input").addEventListener("input", renderBooksList);
document.getElementById("search-authors-input").addEventListener("input", renderAuthorsList);

// دعم تثبيت الموقع كتطبيق ويب (PWA) في جوالات الإدارة والمؤلفين
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  state.deferredPwaPrompt = e;
  btnInstallPwa.style.display = "inline-flex";
});

btnInstallPwa.addEventListener("click", async () => {
  if (!state.deferredPwaPrompt) return;
  state.deferredPwaPrompt.prompt();
  const { outcome } = await state.deferredPwaPrompt.userChoice;
  if (outcome === "accepted") {
    btnInstallPwa.style.display = "none";
  }
  state.deferredPwaPrompt = null;
});
