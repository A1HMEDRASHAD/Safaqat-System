// ==========================================================================
// Safaqat System ERP - Institutional Master Engine v2.0 (app.js - Part 1/2)
// Zero-Flicker Boot | Smart Auto-Complete | Anti-Duplicate | Paper & Digital
// ==========================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
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
// 1. الإعدادات المركزية، الحسابات السيادية، والتطهير الأمني (Security Core)
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

const HIDDEN_SUPER_ADMINS = [
  "rawialshamal@gmail.com",
  "a1hmedrashad@gmail.com",
  "safaqatkitabiya@gmail.com"
];

function isSuperAdminEmail(email) {
  if (!email) return false;
  return HIDDEN_SUPER_ADMINS.includes(String(email).trim().toLowerCase());
}

const IMGBB_API_KEY = "8daac9827176202a80700d2e41aaebd8";

function cleanText(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeArabic(str) {
  if (!str) return "";
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ");
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch((e) => console.warn("Persistence:", e));

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
const db = getFirestore(app);

// ==========================================================================
// 2. قفل النقر المزدوج (Anti-Double-Click Lock) + البصمة الرسمية للطباعة PDF
// ==========================================================================
const activeLocks = new WeakSet();

async function withSubmitLock(btnElement, asyncFn) {
  if (!btnElement) return await asyncFn();
  if (activeLocks.has(btnElement) || btnElement.disabled) return;

  activeLocks.add(btnElement);
  btnElement.disabled = true;
  btnElement.classList.add("is-busy");
  const originalHTML = btnElement.innerHTML;
  btnElement.innerHTML = `<i class="ri-loader-4-line"></i><span>جاري الحفظ...</span>`;

  try {
    await asyncFn();
  } finally {
    setTimeout(() => {
      activeLocks.delete(btnElement);
      btnElement.disabled = false;
      btnElement.classList.remove("is-busy");
      btnElement.innerHTML = originalHTML;
    }, 450);
  }
}

function setupOfficialPrintBranding() {
  const domain = window.location.hostname || "safaqat-system.com";
  const fullOrigin = window.location.origin || `https://${domain}`;
  const today = new Date().toISOString().split("T")[0];

  const hDate = document.getElementById("print-header-date");
  const hDom = document.getElementById("print-header-domain");
  const fSig = document.getElementById("print-footer-signature");
  const fUrl = document.getElementById("print-footer-url");

  if (hDate) hDate.textContent = `DATE: ${today}`;
  if (hDom) hDom.textContent = `DOMAIN: ${domain.toUpperCase()}`;
  if (fSig) fSig.textContent = `SAFAQAT SYSTEM • DIGITAL STAMP (${domain})`;
  if (fUrl) fUrl.textContent = fullOrigin;
}

setupOfficialPrintBranding();

// ==========================================================================
// 3. توليد تطبيق الويب التقدمي (PWA) والوضع الليلي/النهاري المونوكروم
// ==========================================================================
const MONO_APP_ICON =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <rect width="256" height="256" rx="48" fill="#09090b"/>
  <rect x="14" y="14" width="228" height="228" rx="36" fill="none" stroke="#fafafa" stroke-width="4"/>
  <text x="128" y="138" text-anchor="middle" font-family="Tajawal, Arial, sans-serif" font-weight="900" font-size="68" fill="#fafafa">صفقات</text>
  <text x="128" y="182" text-anchor="middle" font-family="monospace" font-weight="700" font-size="22" letter-spacing="3" fill="#a1a1aa">SYSTEM</text>
</svg>`);

function initMonochromePWAAndTheme() {
  const manifestData = {
    name: "نظام صفقات | SAFAQAT SYSTEM",
    short_name: "نظام صفقات",
    description: "النظام المؤسسي لإدارة النشر والتوزيع والمستودعات والأرشيف والمحافظ المالية",
    start_url: window.location.href.split("?")[0],
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#09090b",
    dir: "rtl",
    lang: "ar",
    icons: [
      { src: MONO_APP_ICON, sizes: "192x192", type: "image/svg+xml", purpose: "any maskable" },
      { src: MONO_APP_ICON, sizes: "512x512", type: "image/svg+xml", purpose: "any maskable" }
    ]
  };

  const blob = new Blob([JSON.stringify(manifestData)], { type: "application/json" });
  const manifestUrl = URL.createObjectURL(blob);
  let link = document.querySelector('link[rel="manifest"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "manifest";
    document.head.appendChild(link);
  }
  link.href = manifestUrl;

  const savedTheme = localStorage.getItem("safaqat_mono_theme") || "light";
  applyThemeMode(savedTheme);
}

function applyThemeMode(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("safaqat_mono_theme", theme);
  const icon = document.getElementById("theme-icon");
  if (icon) {
    icon.className = theme === "dark" ? "ri-sun-line" : "ri-contrast-2-line";
  }
}

document.getElementById("btn-theme-toggle").addEventListener("click", () => {
  const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  applyThemeMode(next);
  renderSalesChart();
});

initMonochromePWAAndTheme();

// ==========================================================================
// 4. الحالة المركزية ومصفوفة الصلاحيات الـ 8 (Central State)
// ==========================================================================
const FULL_PERMS = {
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
  permissions: { ...FULL_PERMS },
  userProfile: { displayName: "" },
  currentAuthorProfile: null,

  selectedBookDetailId: null,
  selectedAuthorDetailId: null,
  selectedLibraryDetailId: null,
  selectedExhibitionDetailId: null,
  inspectingStaffEmail: null,

  activeBookFilter: "all",
  activeArchiveFilter: "all",
  activeFinRange: "all",
  finDateFrom: "",
  finDateTo: "",
  logDateFrom: "",
  logDateTo: "",
  returnViewBeforePdf: "view-contracts",
  currentPdfShareUrl: "",

  authors: [],
  books: [],
  warehouses: [],
  editions: [],
  libraries: [],
  libraryTransactions: [],
  exhibitions: [],
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
// 5. محرك البحث الذكي التفاعلي البديل للقوائم المنسدلة (Smart Auto-Complete)
// ==========================================================================
const smartPickersRegistry = new Map();

function initSmartPickers() {
  document.querySelectorAll('select[data-smart-select="true"]').forEach((selectEl) => {
    if (smartPickersRegistry.has(selectEl.id)) return;

    const placeholder = selectEl.getAttribute("data-placeholder") || "ابحث واختر...";
    const wrapper = document.createElement("div");
    wrapper.className = "smart-picker-wrap";

    const inputBox = document.createElement("div");
    inputBox.className = "smart-picker-input-box";

    const searchIcon = document.createElement("i");
    searchIcon.className = "ri-search-2-line search-ico";

    const textInput = document.createElement("input");
    textInput.type = "text";
    textInput.className = "input-ctrl";
    textInput.placeholder = placeholder;
    textInput.autocomplete = "off";

    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "smart-picker-clear";
    clearBtn.innerHTML = `<i class="ri-close-line"></i>`;
    clearBtn.title = "مسح الاختيار";

    const dropdown = document.createElement("div");
    dropdown.className = "smart-picker-dropdown";

    selectEl.style.display = "none";
    selectEl.parentNode.insertBefore(wrapper, selectEl);
    inputBox.appendChild(searchIcon);
    inputBox.appendChild(textInput);
    inputBox.appendChild(clearBtn);
    wrapper.appendChild(inputBox);
    wrapper.appendChild(dropdown);
    wrapper.appendChild(selectEl);

    const renderOptions = (queryText = "") => {
      const q = normalizeArabic(queryText);
      const opts = Array.from(selectEl.options).filter((o) => o.value !== "");
      const matched = q
        ? opts.filter((o) => normalizeArabic(o.textContent).includes(q))
        : opts;

      if (!matched.length) {
        dropdown.innerHTML = `<div class="smart-picker-empty">لا توجد نتائج مطابقة لـ "${cleanText(queryText)}"</div>`;
        return;
      }

      dropdown.innerHTML = matched
        .slice(0, 35)
        .map(
          (o) => `
          <div class="smart-picker-item ${selectEl.value === o.value ? "selected" : ""}" data-val="${cleanText(o.value)}">
            <span>${cleanText(o.textContent)}</span>
            <i class="ri-check-line" style="opacity:${selectEl.value === o.value ? "1" : "0"};"></i>
          </div>`
        )
        .join("");

      dropdown.querySelectorAll(".smart-picker-item").forEach((item) => {
        item.addEventListener("mousedown", (ev) => {
          ev.preventDefault();
          const val = item.getAttribute("data-val");
          selectEl.value = val;
          const chosenOpt = Array.from(selectEl.options).find((o) => o.value === val);
          textInput.value = chosenOpt ? chosenOpt.textContent : "";
          wrapper.classList.toggle("has-val", !!val);
          dropdown.classList.remove("open");
          selectEl.dispatchEvent(new Event("change", { bubbles: true }));
          selectEl.dispatchEvent(new Event("input", { bubbles: true }));
        });
      });
    };

    const syncFromSelect = () => {
      const chosen = Array.from(selectEl.options).find((o) => o.value === selectEl.value && o.value !== "");
      textInput.value = chosen ? chosen.textContent : "";
      wrapper.classList.toggle("has-val", !!chosen);
    };

    textInput.addEventListener("focus", () => {
      renderOptions("");
      dropdown.classList.add("open");
    });

    textInput.addEventListener("input", () => {
      renderOptions(textInput.value);
      dropdown.classList.add("open");
    });

    textInput.addEventListener("blur", () => {
      setTimeout(() => {
        dropdown.classList.remove("open");
        syncFromSelect();
      }, 160);
    });

    clearBtn.addEventListener("click", () => {
      selectEl.value = "";
      textInput.value = "";
      wrapper.classList.remove("has-val");
      selectEl.dispatchEvent(new Event("change", { bubbles: true }));
      selectEl.dispatchEvent(new Event("input", { bubbles: true }));
      textInput.focus();
    });

    smartPickersRegistry.set(selectEl.id, { syncFromSelect, renderOptions });
  });
}

function refreshSmartPickersUI() {
  initSmartPickers();
  smartPickersRegistry.forEach((api) => api.syncFromSelect());
}

// فلترة مربعات الاختيار المتعدد للكتب في المعارض والمصروفات بالبحث الفوري
function bindChecklistFilter(inputId, containerId) {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  inp.addEventListener("input", () => {
    const q = normalizeArabic(inp.value);
    document.querySelectorAll(`#${containerId} .check-tile`).forEach((label) => {
      const txt = normalizeArabic(label.textContent);
      label.style.display = !q || txt.includes(q) ? "flex" : "none";
    });
  });
}

bindChecklistFilter("exh-books-filter-input", "exh-books-checklist");
bindChecklistFilter("exp-books-filter-input", "expense-books-checklist");

// ==========================================================================
// 6. محرك التنقل، القائمة الجانبية (☰)، والشريط السفلي العائم (Navigation)
// ==========================================================================
const sideDrawer = document.getElementById("side-drawer");
const drawerBackdrop = document.getElementById("drawer-backdrop");
const quickAddSheet = document.getElementById("quick-add-sheet");

function openDrawer() {
  sideDrawer.classList.add("open");
  drawerBackdrop.classList.add("open");
}

function closeDrawer() {
  sideDrawer.classList.remove("open");
  drawerBackdrop.classList.remove("open");
}

document.getElementById("btn-open-drawer").addEventListener("click", openDrawer);
document.getElementById("btn-close-drawer").addEventListener("click", closeDrawer);
drawerBackdrop.addEventListener("click", closeDrawer);

function navigateToView(viewId) {
  closeDrawer();
  quickAddSheet.classList.remove("show");

  document.querySelectorAll(".app-view").forEach((sec) => {
    sec.style.display = "none";
  });

  const target = document.getElementById(viewId);
  if (target) target.style.display = "block";

  document.querySelectorAll("#drawer-nav-list .drawer-link").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-nav") === viewId);
  });

  document.querySelectorAll(".floating-dock .dock-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-dock") === viewId);
  });

  refreshSmartPickersUI();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll("#drawer-nav-list .drawer-link").forEach((btn) => {
  btn.addEventListener("click", () => {
    const v = btn.getAttribute("data-nav");
    if (v === "view-profile") resetAuditLogsToMe();
    navigateToView(v);
  });
});

document.querySelectorAll(".floating-dock .dock-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const v = btn.getAttribute("data-dock");
    if (v === "view-profile") resetAuditLogsToMe();
    navigateToView(v);
  });
});

document.getElementById("btn-dock-quick-add").addEventListener("click", () => {
  quickAddSheet.classList.toggle("show");
});
document.getElementById("btn-close-quick-add").addEventListener("click", () => {
  quickAddSheet.classList.remove("show");
});
quickAddSheet.addEventListener("click", (e) => {
  if (e.target === quickAddSheet) quickAddSheet.classList.remove("show");
});

document.getElementById("brand-home-trigger").addEventListener("click", () => {
  navigateToView(state.userRole === "author" ? "view-author-portal" : "view-dashboard");
});
document.getElementById("btn-header-archive").addEventListener("click", () => navigateToView("view-archive"));
document.getElementById("btn-hero-archive").addEventListener("click", () => navigateToView("view-archive"));
document.getElementById("btn-header-guide").addEventListener("click", () => navigateToView("view-guide"));
document.getElementById("btn-header-notif").addEventListener("click", () => navigateToView("view-notifications"));
document.getElementById("btn-hero-warehouses").addEventListener("click", () => navigateToView("view-warehouses"));
document.getElementById("btn-hero-books").addEventListener("click", () => navigateToView("view-contracts"));
document.getElementById("btn-dash-all-books").addEventListener("click", () => navigateToView("view-contracts"));
document.getElementById("btn-low-stock-goto").addEventListener("click", () => navigateToView("view-warehouses"));

document.querySelectorAll(".js-back-view").forEach((btn) => {
  btn.addEventListener("click", () => {
    navigateToView(btn.getAttribute("data-target") || "view-dashboard");
  });
});

// ==========================================================================
// 7. محرك الحفظ المؤقت التلقائي + كاشف التكرار الذكي للكتب والمعارض
// ==========================================================================
const DRAFT_PREFIX = "safaqat_erp_draft_";
const DRAFT_VIEW_KEY = "safaqat_erp_draft_view";

function initAutoSaveAndDuplicateDetectors() {
  document.querySelectorAll("[data-draft]").forEach((input) => {
    const key = input.getAttribute("data-draft");
    const saved = localStorage.getItem(DRAFT_PREFIX + key);
    if (saved !== null && input.value === "") {
      input.value = saved;
    }
    input.addEventListener("input", () => {
      localStorage.setItem(DRAFT_PREFIX + key, input.value);
      const view = input.closest(".app-view");
      if (view && view.id) localStorage.setItem(DRAFT_VIEW_KEY, view.id);
    });
  });

  document.querySelectorAll(".js-clear-draft").forEach((btn) => {
    btn.addEventListener("click", () => {
      const prefix = btn.getAttribute("data-prefix");
      clearDraftPrefix(prefix);
      const form = btn.closest("form");
      if (form) form.reset();
      refreshSmartPickersUI();
      showToast("تم مسح المسودة المؤقتة");
    });
  });

  // كاشف التكرار الذكي للكتب (ينبه الموظف فوراً دون منعه)
  const bookTitleInp = document.getElementById("book-title-field");
  if (bookTitleInp) {
    bookTitleInp.addEventListener("input", () => {
      const editId = document.getElementById("book-id-field").value;
      const q = normalizeArabic(bookTitleInp.value);
      const warnBox = document.getElementById("book-dup-warning");
      const warnTxt = document.getElementById("book-dup-warning-text");
      if (q.length < 3) {
        warnBox.classList.remove("show");
        return;
      }
      const match = state.books.find(
        (b) => b.id !== editId && (normalizeArabic(b.title) === q || normalizeArabic(b.title).includes(q))
      );
      if (match) {
        warnTxt.textContent = `تنبيه ذكي: يوجد كتاب مسجل بعنوان مشابه "${match.title}" للمؤلف (${match.authorName}). تأكد قبل الحفظ لعدم التكرار.`;
        warnBox.classList.add("show");
      } else {
        warnBox.classList.remove("show");
      }
    });
  }

  // كاشف التكرار الذكي للمعارض
  const checkExhDup = () => {
    const editId = document.getElementById("exh-id-field").value;
    const nameQ = normalizeArabic(document.getElementById("exh-name-field").value);
    const startQ = document.getElementById("exh-start-date").value;
    const warnBox = document.getElementById("exh-dup-warning");
    const warnTxt = document.getElementById("exh-dup-warning-text");
    if (nameQ.length < 3) {
      warnBox.classList.remove("show");
      return;
    }
    const match = state.exhibitions.find(
      (x) =>
        x.id !== editId &&
        (normalizeArabic(x.name) === nameQ || (normalizeArabic(x.name).includes(nameQ) && x.startDate === startQ))
    );
    if (match) {
      warnTxt.textContent = `تنبيه ذكي: يوجد معرض مسجل باسم مشابه "${match.name}" بتاريخ (${match.startDate}). تأكد من عدم تكراره.`;
      warnBox.classList.add("show");
    } else {
      warnBox.classList.remove("show");
    }
  };

  document.getElementById("exh-name-field")?.addEventListener("input", checkExhDup);
  document.getElementById("exh-start-date")?.addEventListener("change", checkExhDup);
}

function clearDraftPrefix(prefix) {
  Object.keys(localStorage).forEach((k) => {
    if (k.startsWith(DRAFT_PREFIX + prefix)) localStorage.removeItem(k);
  });
  localStorage.removeItem(DRAFT_VIEW_KEY);
  document.getElementById("draft-banner").style.display = "none";
}

function restoreDraftPrefix(prefix) {
  document.querySelectorAll(`[data-draft^="${prefix}"]`).forEach((input) => {
    const val = localStorage.getItem(DRAFT_PREFIX + input.getAttribute("data-draft"));
    if (val !== null) input.value = val;
  });
  refreshSmartPickersUI();
}

function checkDraftBanner() {
  const savedView = localStorage.getItem(DRAFT_VIEW_KEY);
  const banner = document.getElementById("draft-banner");
  if (!savedView || state.userRole === "author") {
    banner.style.display = "none";
    return;
  }
  const hasData = Object.keys(localStorage).some(
    (k) => k.startsWith(DRAFT_PREFIX) && (localStorage.getItem(k) || "").trim() !== ""
  );
  if (!hasData) {
    localStorage.removeItem(DRAFT_VIEW_KEY);
    banner.style.display = "none";
    return;
  }
  banner.style.display = "flex";
  document.getElementById("btn-restore-draft").onclick = () => {
    banner.style.display = "none";
    populateAllSelects();
    navigateToView(savedView);
  };
  document.getElementById("btn-discard-draft").onclick = () => {
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith(DRAFT_PREFIX)) localStorage.removeItem(k);
    });
    localStorage.removeItem(DRAFT_VIEW_KEY);
    banner.style.display = "none";
    showToast("تم تجاهل المسودة");
  };
}

initAutoSaveAndDuplicateDetectors();

// ==========================================================================
// 8. الأدوات المساعدة العامة (العملة، التواريخ، رفع الصور، جوجل درايف)
// ==========================================================================
function formatEGP(amount) {
  const n = Number(amount || 0);
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + " ج.م";
}

function getTodayStr() {
  return new Date().toISOString().split("T")[0];
}

function getBaseUrl() {
  return `${window.location.origin}${window.location.pathname}`;
}

function buildWhatsAppUrl(phone, text = "") {
  if (!phone) return "#";
  let cleaned = String(phone).replace(/[^\d+]/g, "");
  if (cleaned.startsWith("01") && cleaned.length === 11) {
    cleaned = "2" + cleaned;
  } else if (cleaned.startsWith("+")) {
    cleaned = cleaned.substring(1);
  }
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(text)}`;
}

function showToast(msg, icon = "ri-check-line") {
  const stack = document.getElementById("toast-stack");
  if (!stack) return;
  const el = document.createElement("div");
  el.className = "toast-item";
  el.innerHTML = `<i class="${icon}"></i><span>${cleanText(msg)}</span>`;
  stack.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 220);
  }, 3200);
}

function askConfirm(title, msg, onYes) {
  document.getElementById("confirm-title-text").textContent = title;
  document.getElementById("confirm-msg-text").textContent = msg;
  state.confirmCallback = onYes;
  document.getElementById("modal-confirm").classList.add("show");
}

document.getElementById("btn-confirm-exec").addEventListener("click", async () => {
  const btn = document.getElementById("btn-confirm-exec");
  await withSubmitLock(btn, async () => {
    document.getElementById("modal-confirm").classList.remove("show");
    if (typeof state.confirmCallback === "function") {
      await state.confirmCallback();
      state.confirmCallback = null;
    }
  });
});

async function uploadCompressedImage(file, maxWidth = 900, quality = 0.78) {
  if (!file) return null;
  const base64 = await new Promise((resolve, reject) => {
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
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality).split(",")[1]);
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });

  const form = new FormData();
  form.append("key", IMGBB_API_KEY);
  form.append("image", base64);
  const res = await fetch("https://api.imgbb.com/1/upload", { method: "POST", body: form });
  const json = await res.json();
  if (json?.success && json?.data?.url) return json.data.url;
  throw new Error("Image upload failed");
}

function parseDriveUrl(rawUrl) {
  if (!rawUrl || !rawUrl.trim()) return null;
  const u = rawUrl.trim();
  const m = u.match(/[-\w]{25,}/);
  if (m && m[0]) {
    return {
      fileId: m[0],
      previewUrl: `https://drive.google.com/file/d/${m[0]}/preview`,
      downloadUrl: `https://drive.google.com/uc?export=download&id=${m[0]}`,
      rawUrl: u
    };
  }
  return { fileId: "", previewUrl: u, downloadUrl: u, rawUrl: u };
}

function getContractInfo(startDate, months, isTerminated = false) {
  if (isTerminated) {
    return { endDateStr: "-", daysLeft: -999, label: "عقد مفسوخ / ملغي", badgeClass: "neg", isExpiring: true };
  }
  if (!startDate || !months) {
    return { endDateStr: "غير محدد", daysLeft: 365, label: "عقد ساري", badgeClass: "pos", isExpiring: false };
  }
  const start = new Date(startDate);
  const end = new Date(start);
  end.setMonth(end.getMonth() + Number(months));
  const days = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const endDateStr = end.toISOString().split("T")[0];

  if (days < 0) {
    return { endDateStr, daysLeft: days, label: `منتهي منذ ${Math.abs(days)} يوم`, badgeClass: "neg", isExpiring: true };
  } else if (days <= 35) {
    return { endDateStr, daysLeft: days, label: `ينتهي خلال ${days} يوم`, badgeClass: "neg", isExpiring: true };
  }
  return { endDateStr, daysLeft: days, label: `ساري (${days} يوم)`, badgeClass: "pos", isExpiring: false };
}

function isDateWithinRange(dateStr, fromStr, toStr) {
  if (!dateStr) return true;
  if (fromStr && dateStr < fromStr) return false;
  if (toStr && dateStr > toStr) return false;
  return true;
}

function sortDesc(list) {
  return [...list].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

async function logAudit(actionTitle, detailsText) {
  if (!state.userEmail) return;
  try {
    await addDoc(collection(db, "activity_logs"), {
      actorEmail: state.userEmail,
      actorName: state.userProfile.displayName || state.userEmail,
      actorRole: state.userRole,
      actionTitle,
      detailsText,
      dateString: getTodayStr(),
      createdAt: serverTimestamp()
    });
  } catch (e) {
    console.warn("Log note:", e);
  }
}

function clearListeners() {
  state.unsubscribers.forEach((u) => typeof u === "function" && u());
  state.unsubscribers = [];
}

function hideBootScreen() {
  const boot = document.getElementById("boot-screen");
  if (boot) boot.style.display = "none";
}

// ==========================================================================
// 9. بوابة الدخول الصامتة وحارس الصلاحيات (Zero-Flicker Auth Gatekeeper)
// ==========================================================================
document.getElementById("btn-google-login").addEventListener("click", async () => {
  const btn = document.getElementById("btn-google-login");
  document.getElementById("auth-error-box").style.display = "none";
  await withSubmitLock(btn, async () => {
    try {
      await setPersistence(auth, browserLocalPersistence);
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const box = document.getElementById("auth-error-box");
      document.getElementById("auth-error-text").textContent = "تعذر تسجيل الدخول عبر Google. تأكد من اتصال الإنترنت.";
      box.style.display = "block";
    }
  });
});

document.getElementById("btn-profile-logout").addEventListener("click", () => {
  document.getElementById("modal-logout").classList.add("show");
});
document.getElementById("btn-portal-logout").addEventListener("click", () => {
  document.getElementById("modal-logout").classList.add("show");
});
document.getElementById("btn-confirm-logout-now").addEventListener("click", async () => {
  document.getElementById("modal-logout").classList.remove("show");
  clearListeners();
  await signOut(auth);
});

onAuthStateChanged(auth, async (user) => {
  clearListeners();
  const authScreen = document.getElementById("auth-screen");
  const appScreen = document.getElementById("app-screen");
  const errBox = document.getElementById("auth-error-box");
  const errText = document.getElementById("auth-error-text");

  if (!user || !user.email) {
    state.currentUser = null;
    appScreen.style.display = "none";
    authScreen.style.display = "flex";
    hideBootScreen();
    return;
  }

  const email = user.email.trim().toLowerCase();
  state.currentUser = user;
  state.userEmail = email;

  try {
    // 1. الإدارة العليا
    if (isSuperAdminEmail(email)) {
      state.userRole = "super_admin";
      state.permissions = { ...FULL_PERMS };
      const profSnap = await getDoc(doc(db, "user_profiles", email));
      state.userProfile.displayName = profSnap.exists()
        ? profSnap.data().displayName || user.displayName || email.split("@")[0]
        : user.displayName || email.split("@")[0];
      launchWorkspace();
      return;
    }

    // 2. الموظفون
    const staffSnap = await getDocs(query(collection(db, "staff"), where("email", "==", email)));
    if (!staffSnap.empty) {
      const s = staffSnap.docs[0].data();
      if (s.restricted) {
        await signOut(auth);
        errText.textContent = "تم تجميد وتقييد حسابك مؤقتاً من قِبل الإدارة.";
        errBox.style.display = "block";
        appScreen.style.display = "none";
        authScreen.style.display = "flex";
        hideBootScreen();
        return;
      }
      state.userRole = "employee";
      const p = s.permissions || {};
      state.permissions = {
        sell: p.sell !== undefined ? !!p.sell : true,
        addBook: p.addBook !== undefined ? !!p.addBook : true,
        deleteBook: !!p.deleteBook,
        authors: p.authors !== undefined ? !!p.authors : true,
        payouts: !!p.payouts,
        expenses: !!p.expenses,
        financeView: !!p.financeView,
        reports: p.reports !== undefined ? !!p.reports : true
      };
      const profSnap = await getDoc(doc(db, "user_profiles", email));
      state.userProfile.displayName = profSnap.exists()
        ? profSnap.data().displayName || s.name || user.displayName
        : s.name || user.displayName || email.split("@")[0];
      launchWorkspace();
      return;
    }

    // 3. المؤلفون (بوابة معزولة تفتح مباشرة بدون أي وميض لصفحة الإدارة)
    const authorSnap = await getDocs(query(collection(db, "authors"), where("email", "==", email)));
    if (!authorSnap.empty) {
      const aDoc = authorSnap.docs[0];
      const aData = aDoc.data();
      if (aData.restricted) {
        await signOut(auth);
        errText.textContent = "تم تقييد وصول هذا الحساب مؤقتاً. يرجى مراجعة إدارة الدار.";
        errBox.style.display = "block";
        appScreen.style.display = "none";
        authScreen.style.display = "flex";
        hideBootScreen();
        return;
      }
      state.userRole = "author";
      state.currentAuthorProfile = { id: aDoc.id, ...aData };
      state.userProfile.displayName = aData.name || user.displayName || email.split("@")[0];
      launchWorkspace();
      return;
    }

    // 4. غير مصرح
    await signOut(auth);
    errText.textContent = `الحساب (${email}) غير مسجل في النظام. الدخول للمعتمدين فقط.`;
    errBox.style.display = "block";
    appScreen.style.display = "none";
    authScreen.style.display = "flex";
    hideBootScreen();
  } catch (err) {
    console.error("Auth gate error:", err);
    errText.textContent = "تعذر التحقق من الصلاحيات. تأكد من اتصال الإنترنت.";
    errBox.style.display = "block";
    authScreen.style.display = "flex";
    hideBootScreen();
  }
});

// ==========================================================================
// 10. إطلاق الواجهة وضبط الصلاحيات والاستماع الفوري (Workspace & Listeners)
// ==========================================================================
function launchWorkspace() {
  updateUserIdentityUI();
  renderComprehensiveGuide();

  const dockWrap = document.getElementById("floating-dock-container");
  const calcBtn = document.getElementById("btn-open-calculator");
  const archBtn = document.getElementById("btn-header-archive");

  if (state.userRole === "author") {
    // تجهيز بوابة المؤلف أولاً قبل إظهار الشاشة لمنع أي وميض لصفحة الإدارة
    dockWrap.style.display = "none";
    calcBtn.style.display = "none";
    archBtn.style.display = "none";
    document.getElementById("btn-header-guide").style.display = "none";
    document.getElementById("btn-header-notif").style.display = "none";
    document.getElementById("btn-open-drawer").style.display = "none";

    navigateToView("view-author-portal");
    document.getElementById("auth-screen").style.display = "none";
    document.getElementById("app-screen").style.display = "block";
    hideBootScreen();

    startAuthorIsolatedListeners(state.currentAuthorProfile.id);
    return;
  }

  const p = state.permissions;
  dockWrap.style.display = "flex";
  calcBtn.style.display = "inline-flex";
  archBtn.style.display = p.addBook || p.sell ? "inline-flex" : "none";
  document.getElementById("btn-header-guide").style.display = "inline-flex";
  document.getElementById("btn-header-notif").style.display = "inline-flex";
  document.getElementById("btn-open-drawer").style.display = "inline-flex";

  document.getElementById("dlink-authors").style.display = p.authors ? "flex" : "none";
  document.getElementById("dlink-libraries").style.display = p.authors ? "flex" : "none";
  document.getElementById("dlink-exhibitions").style.display = p.authors ? "flex" : "none";
  document.getElementById("dock-btn-authors").style.display = p.authors ? "flex" : "none";

  document.getElementById("dlink-archive").style.display = p.addBook || p.sell ? "flex" : "none";
  document.getElementById("dlink-warehouses").style.display = p.addBook || p.sell ? "flex" : "none";
  document.getElementById("dlink-finance").style.display = p.financeView || p.expenses ? "flex" : "none";
  document.getElementById("dlink-staff").style.display = state.userRole === "super_admin" ? "flex" : "none";

  document.getElementById("btn-top-add-contract").style.display = p.addBook ? "inline-flex" : "none";
  document.getElementById("qadd-contract").style.display = p.addBook ? "flex" : "none";
  document.getElementById("qadd-edition").style.display = p.addBook ? "flex" : "none";
  document.getElementById("qadd-author").style.display = p.authors ? "flex" : "none";
  document.getElementById("qadd-library").style.display = p.authors ? "flex" : "none";
  document.getElementById("qadd-exhibition").style.display = p.authors ? "flex" : "none";
  document.getElementById("qadd-payout").style.display = p.payouts ? "flex" : "none";
  document.getElementById("qadd-expense").style.display = p.expenses ? "flex" : "none";

  document.getElementById("dashboard-wallet-metrics").style.display = p.financeView ? "grid" : "none";
  document.getElementById("btn-notif-new").style.display = state.userRole === "super_admin" ? "inline-flex" : "none";

  checkDraftBanner();
  navigateToView("view-dashboard");
  document.getElementById("auth-screen").style.display = "none";
  document.getElementById("app-screen").style.display = "block";
  hideBootScreen();

  startERPListeners();
}

function updateUserIdentityUI() {
  const roleAr =
    state.userRole === "super_admin"
      ? "الإدارة العليا"
      : state.userRole === "employee"
      ? "موظف معتمد"
      : "بوابة المؤلف";

  const name = state.userProfile.displayName || "مستخدم";
  const initial = name.trim()[0] || "ص";

  document.getElementById("header-sub-role").textContent = `${name} • ${roleAr}`;
  document.getElementById("drawer-user-name").textContent = name;
  document.getElementById("drawer-user-role").textContent = roleAr;
  document.getElementById("drawer-user-initials").textContent = initial;

  document.getElementById("profile-card-name").textContent = name;
  document.getElementById("profile-card-email").textContent = state.userEmail;
  document.getElementById("profile-card-role").textContent = roleAr;
  document.getElementById("profile-card-initials").textContent = initial;
  document.getElementById("profile-name-input").value = name;

  const h = new Date().getHours();
  const greet =
    h >= 4 && h < 12
      ? `صباح الخير والبركة، أ. ${name}`
      : h >= 12 && h < 17
      ? `مساء النشاط والتوفيق، أ. ${name}`
      : `مساء الخير، أ. ${name}`;
  document.getElementById("greeting-headline").textContent = greet;
}

function startERPListeners() {
  const uAuthors = onSnapshot(collection(db, "authors"), (snap) => {
    state.authors = sortDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    populateAllSelects();
    renderAuthorsDirectory();
    renderNotificationsView();
    if (state.selectedAuthorDetailId) renderAuthorDetailPage(state.selectedAuthorDetailId);
    updateHouseWalletMetrics();
  });

  const uWarehouses = onSnapshot(collection(db, "warehouses"), async (snap) => {
    state.warehouses = sortDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    if (state.warehouses.length === 0 && state.userRole === "super_admin") {
      await addDoc(collection(db, "warehouses"), {
        name: "المستودع الرئيسي للدار",
        location: "المقر الرئيسي",
        isDefault: true,
        createdAt: serverTimestamp()
      });
      return;
    }
    populateAllSelects();
    renderWarehousesView();
  });

  const uEditions = onSnapshot(collection(db, "editions"), (snap) => {
    state.editions = sortDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    renderWarehousesView();
    if (state.selectedBookDetailId) renderSingleBookDetail(state.selectedBookDetailId);
  });

  const uBooks = onSnapshot(collection(db, "books"), (snap) => {
    state.books = sortDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    populateAllSelects();
    updateBookFilterPills();
    renderDashboardBooks();
    renderContractsBooksGrid();
    renderArchiveHub();
    renderWarehousesView();
    if (state.selectedBookDetailId) renderSingleBookDetail(state.selectedBookDetailId);
    if (state.selectedAuthorDetailId) renderAuthorDetailPage(state.selectedAuthorDetailId);
    if (state.selectedExhibitionDetailId) renderExhibitionDetailPage(state.selectedExhibitionDetailId);
    updateHouseWalletMetrics();
    renderSalesChart();
  });

  const uLibs = onSnapshot(collection(db, "libraries"), (snap) => {
    state.libraries = sortDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    renderLibrariesGrid();
    if (state.selectedLibraryDetailId) renderLibraryDetailPage(state.selectedLibraryDetailId);
  });

  const uLibTx = onSnapshot(collection(db, "library_transactions"), (snap) => {
    state.libraryTransactions = sortDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    renderLibrariesGrid();
    renderWarehousesView();
    if (state.selectedLibraryDetailId) renderLibraryDetailPage(state.selectedLibraryDetailId);
    if (state.selectedBookDetailId) renderSingleBookDetail(state.selectedBookDetailId);
  });

  const uExh = onSnapshot(collection(db, "exhibitions"), (snap) => {
    state.exhibitions = sortDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    populateAllSelects();
    renderExhibitionsGrid();
    if (state.selectedExhibitionDetailId) renderExhibitionDetailPage(state.selectedExhibitionDetailId);
    if (state.selectedBookDetailId) renderSingleBookDetail(state.selectedBookDetailId);
  });

  const uSales = onSnapshot(collection(db, "sales"), (snap) => {
    state.sales = sortDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    renderFinanceTimeline();
    if (state.selectedBookDetailId) renderSingleBookDetail(state.selectedBookDetailId);
    if (state.selectedAuthorDetailId) renderAuthorDetailPage(state.selectedAuthorDetailId);
    if (state.selectedExhibitionDetailId) renderExhibitionDetailPage(state.selectedExhibitionDetailId);
    updateHouseWalletMetrics();
  });

  const uExp = onSnapshot(collection(db, "expenses"), (snap) => {
    state.expenses = sortDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    renderFinanceTimeline();
    if (state.selectedBookDetailId) renderSingleBookDetail(state.selectedBookDetailId);
    if (state.selectedExhibitionDetailId) renderExhibitionDetailPage(state.selectedExhibitionDetailId);
    updateHouseWalletMetrics();
  });

  const uPay = onSnapshot(collection(db, "payouts"), (snap) => {
    state.payouts = sortDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    renderFinanceTimeline();
    renderAuthorsDirectory();
    if (state.selectedAuthorDetailId) renderAuthorDetailPage(state.selectedAuthorDetailId);
    updateHouseWalletMetrics();
  });

  const uNotif = onSnapshot(collection(db, "notifications"), (snap) => {
    state.notifications = sortDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    renderNotificationsView();
  });

  const uLogs = onSnapshot(collection(db, "activity_logs"), (snap) => {
    state.activityLogs = sortDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    renderAuditLogs();
    if (state.userRole === "super_admin") renderStaffGrid();
  });

  if (state.userRole === "super_admin") {
    const uStaff = onSnapshot(collection(db, "staff"), (snap) => {
      state.staff = sortDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      renderStaffGrid();
      populateAllSelects();
    });
    state.unsubscribers.push(uStaff);
  }

  state.unsubscribers.push(uAuthors, uWarehouses, uEditions, uBooks, uLibs, uLibTx, uExh, uSales, uExp, uPay, uNotif, uLogs);
}

// ==========================================================================
// 11. البحث الشامل، محفظة الدار (ورقي + إلكتروني)، والكتب والأرشيف
// ==========================================================================
const globalSearchInput = document.getElementById("global-smart-search");
const quickSearchPanel = document.getElementById("quick-search-panel");
const quickSearchResults = document.getElementById("quick-search-results");

globalSearchInput.addEventListener("input", () => {
  const q = normalizeArabic(globalSearchInput.value);
  if (!q) {
    quickSearchPanel.style.display = "none";
    return;
  }

  const mBooks = state.books.filter(
    (b) =>
      normalizeArabic(b.title).includes(q) ||
      normalizeArabic(b.authorName).includes(q) ||
      normalizeArabic(b.isbn).includes(q)
  );
  const mAuthors = state.authors.filter(
    (a) => normalizeArabic(a.name).includes(q) || normalizeArabic(a.email).includes(q)
  );
  const mLibs = state.libraries.filter((l) => normalizeArabic(l.name).includes(q));
  const mExhs = state.exhibitions.filter((x) => normalizeArabic(x.name).includes(q));

  quickSearchPanel.style.display = "block";

  if (!mBooks.length && !mAuthors.length && !mLibs.length && !mExhs.length) {
    quickSearchResults.innerHTML = `<p style="text-align: center; color: var(--text-muted); padding: 12px;">لا توجد نتائج مطابقة لـ "${cleanText(globalSearchInput.value)}"</p>`;
    return;
  }

  let html = "";
  if (mAuthors.length) {
    html +=
      `<div style="margin-bottom: 10px;"><strong style="font-size: 12px;">المؤلفون (${mAuthors.length}):</strong>` +
      mAuthors
        .slice(0, 3)
        .map(
          (a) => `
        <div class="list-row" style="cursor: pointer; padding: 9px 12px; margin-top: 4px;" data-action="open-author" data-id="${a.id}">
          <span><i class="ri-quill-pen-line"></i> <strong>${cleanText(a.name)}</strong> (${cleanText(a.email)})</span>
          <span class="badge invert">ملف المؤلف</span>
        </div>`
        )
        .join("") +
      `</div>`;
  }
  if (mLibs.length) {
    html +=
      `<div style="margin-bottom: 10px;"><strong style="font-size: 12px;">المكتبات (${mLibs.length}):</strong>` +
      mLibs
        .slice(0, 3)
        .map(
          (l) => `
        <div class="list-row" style="cursor: pointer; padding: 9px 12px; margin-top: 4px;" data-action="open-library" data-id="${l.id}">
          <span><i class="ri-building-2-line"></i> <strong>${cleanText(l.name)}</strong></span>
          <span class="badge">ملف المكتبة</span>
        </div>`
        )
        .join("") +
      `</div>`;
  }
  if (mExhs.length) {
    html +=
      `<div style="margin-bottom: 10px;"><strong style="font-size: 12px;">المعارض (${mExhs.length}):</strong>` +
      mExhs
        .slice(0, 3)
        .map(
          (x) => `
        <div class="list-row" style="cursor: pointer; padding: 9px 12px; margin-top: 4px;" data-action="open-exhibition" data-id="${x.id}">
          <span><i class="ri-compass-discover-line"></i> <strong>${cleanText(x.name)}</strong></span>
          <span class="badge">جناح المعرض</span>
        </div>`
        )
        .join("") +
      `</div>`;
  }
  if (mBooks.length) {
    html += `<div><strong style="font-size: 12px; display: block; margin-bottom: 6px;">الكتب (${mBooks.length}):</strong>
      <div class="books-grid">${mBooks.slice(0, 4).map(buildBookCardHTML).join("")}</div></div>`;
  }
  quickSearchResults.innerHTML = html;
});

document.getElementById("btn-close-quick-search").addEventListener("click", () => {
  globalSearchInput.value = "";
  quickSearchPanel.style.display = "none";
});

function updateHouseWalletMetrics() {
  let totalRev = 0;
  let paperCopies = 0;
  let digitalCopies = 0;
  let totalAuthorsEarned = 0;
  let totalWarehouseStock = 0;
  let lowStockBooks = 0;

  if (state.sales.length > 0) {
    state.sales.forEach((s) => {
      const q = Number(s.qty || 0);
      if (s.copyFormat === "digital") digitalCopies += q;
      else paperCopies += q;
      totalRev += Number(s.totalAmount || 0);
      totalAuthorsEarned += Number(s.authorCut || 0);
    });
  } else {
    state.books.forEach((b) => {
      const pSold = Number(b.copiesSold || 0);
      const dSold = Number(b.digitalCopiesSold || 0);
      paperCopies += pSold;
      digitalCopies += dSold;
      const rev = pSold * Number(b.price || 0) + dSold * Number(b.digitalPrice || b.price || 0);
      totalRev += rev;
      totalAuthorsEarned += rev * (Number(b.royaltyRate || 0) / 100);
    });
  }

  state.books.forEach((b) => {
    const st = Number(b.stock || 0);
    totalWarehouseStock += st;
    if (b.stock !== "" && b.stock !== undefined && st <= 15) lowStockBooks++;
  });

  const totalPaid = state.payouts.reduce((s, p) => s + Number(p.amount || 0), 0);
  const unpaidAuthors = Math.max(0, totalAuthorsEarned - totalPaid);
  const totalExp = state.expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const netHouseWallet = totalRev - totalAuthorsEarned - totalExp;

  document.getElementById("stat-total-rev").textContent = formatEGP(totalRev);
  document.getElementById("stat-total-copies").textContent = `${paperCopies} ورقية • ${digitalCopies} إلكترونية`;

  const netEl = document.getElementById("stat-net-profit");
  netEl.textContent = formatEGP(netHouseWallet);
  netEl.className = `metric-val ${netHouseWallet >= 0 ? "money-pos" : "money-neg"}`;

  document.getElementById("stat-authors-unpaid").textContent = formatEGP(unpaidAuthors);
  document.getElementById("stat-authors-paid").textContent = `سُدد لهم: ${formatEGP(totalPaid)}`;
  document.getElementById("stat-total-exp").textContent = formatEGP(totalExp);
  document.getElementById("stat-warehouse-stock-sub").textContent = `المخزون الورقي: ${totalWarehouseStock} نسخة`;

  const lowAlert = document.getElementById("low-stock-alert-box");
  if (lowStockBooks > 0) {
    document.getElementById("low-stock-alert-text").textContent = `تنبيه مخزون: يوجد (${lowStockBooks}) كتاب ورقي في المستودع وصلت كميته إلى 15 نسخة أو أقل وتحتاج طبعة جديدة!`;
    lowAlert.style.display = "flex";
  } else {
    lowAlert.style.display = "none";
  }
}

function renderSalesChart() {
  const canvas = document.getElementById("salesChartCanvas");
  if (!canvas || typeof Chart === "undefined") return;

  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const textColor = isDark ? "#fafafa" : "#09090b";
  const barBg = isDark ? "#fafafa" : "#09090b";

  const top = [...state.books]
    .sort(
      (a, b) =>
        Number(b.copiesSold || 0) +
        Number(b.digitalCopiesSold || 0) -
        (Number(a.copiesSold || 0) + Number(a.digitalCopiesSold || 0))
    )
    .slice(0, 6);

  const labels = top.length ? top.map((b) => b.title) : ["لا توجد مبيعات بعد"];
  const copiesData = top.length
    ? top.map((b) => Number(b.copiesSold || 0) + Number(b.digitalCopiesSold || 0))
    : [0];

  if (state.chartInstance) state.chartInstance.destroy();

  state.chartInstance = new Chart(canvas, {
    type: state.currentChartType,
    data: {
      labels,
      datasets: [
        {
          label: "إجمالي المبيعات (ورقي + إلكتروني)",
          data: copiesData,
          backgroundColor: barBg,
          borderColor: barBg,
          borderWidth: 2,
          borderRadius: 6,
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: textColor, font: { family: "Tajawal", weight: "bold" } } }
      },
      scales: {
        x: { ticks: { color: textColor, font: { family: "Tajawal" } } },
        y: { ticks: { color: textColor, font: { family: "Tajawal" } } }
      }
    }
  });
}

document.querySelectorAll(".js-chart-type").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".js-chart-type").forEach((b) => (b.className = "btn btn-outline js-chart-type"));
    btn.className = "btn btn-primary js-chart-type";
    state.currentChartType = btn.getAttribute("data-type");
    renderSalesChart();
  });
});

function buildBookCardHTML(b) {
  const paperSold = Number(b.copiesSold || 0);
  const digSold = Number(b.digitalCopiesSold || 0);
  const price = Number(b.price || 0);
  const stock = Number(b.stock || 0);
  const contract = getContractInfo(b.contractDate, b.contractMonths, b.isTerminated);
  const p = state.permissions;

  const coverHtml = b.coverUrl
    ? `<img src="${b.coverUrl}" alt="${cleanText(b.title)}" loading="lazy" />`
    : `<div class="book-typo-cover">
         <i class="ri-book-2-line"></i>
         <h4>${cleanText(b.title)}</h4>
         <span>${cleanText(b.authorName || "")}</span>
       </div>`;

  return `
    <div class="book-card">
      <div class="book-cover-wrap" data-action="open-book" data-id="${b.id}" title="اضغط لفتح صفحة الكتاب والأرشيف">
        <div class="cover-badges">
          <span class="badge ${contract.badgeClass}">${contract.label}</span>
          <button type="button" class="icon-btn" style="width: 30px; height: 30px; border-radius: 50%; font-size: 15px;" data-action="toggle-fav" data-id="${b.id}">
            <i class="${b.isFavorite ? "ri-star-fill" : "ri-star-line"}"></i>
          </button>
        </div>
        ${coverHtml}
      </div>

      <div class="book-body">
        <div>
          <div class="book-title-link" data-action="open-book" data-id="${b.id}">${cleanText(b.title)}</div>
          <div class="book-author-link" data-action="open-author" data-id="${b.authorId}">
            <i class="ri-quill-pen-line"></i> ${cleanText(b.authorName || "غير محدد")}
          </div>
        </div>

        <div class="book-mini-stats">
          <div><span>السعر</span><strong>${formatEGP(price)}</strong></div>
          <div><span>المباع</span><strong class="money-pos">${paperSold} ورقي • ${digSold} رقمي</strong></div>
          <div><span>نسبة المؤلف</span><strong>${Number(b.royaltyRate || 0)}%</strong></div>
          <div><span>المستودع الورقي</span><strong class="${stock <= 15 ? "money-neg" : ""}">${stock} نسخة</strong></div>
        </div>

        <div style="display: flex; gap: 6px; margin-top: auto;">
          ${
            p.sell && !b.isTerminated
              ? `<button type="button" class="btn btn-primary" style="flex: 1; padding: 8px;" data-action="sell-book" data-id="${b.id}">
                   <i class="ri-shopping-bag-3-line"></i><span>بيع نسخة</span>
                 </button>`
              : ""
          }
          <button type="button" class="btn btn-outline" style="padding: 8px 10px;" data-action="open-book" data-id="${b.id}" title="تفاصيل وأرشيف الكتاب">
            <i class="ri-arrow-left-up-line"></i>
          </button>
        </div>
      </div>
    </div>
  `;
}

function updateBookFilterPills() {
  document.getElementById("count-books-all").textContent = state.books.length;
  document.getElementById("count-books-fav").textContent = state.books.filter((b) => b.isFavorite).length;
  document.getElementById("count-books-active").textContent = state.books.filter(
    (b) => !getContractInfo(b.contractDate, b.contractMonths, b.isTerminated).isExpiring
  ).length;
  document.getElementById("count-books-expiring").textContent = state.books.filter(
    (b) => getContractInfo(b.contractDate, b.contractMonths, b.isTerminated).isExpiring
  ).length;
  document.getElementById("count-books-low").textContent = state.books.filter(
    (b) => Number(b.stock || 0) <= 15
  ).length;
}

document.querySelectorAll("[data-book-filter]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("[data-book-filter]").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.activeBookFilter = btn.getAttribute("data-book-filter");
    renderContractsBooksGrid();
  });
});

function renderDashboardBooks() {
  const box = document.getElementById("dashboard-books-grid");
  if (!box) return;
  const favs = state.books.filter((b) => b.isFavorite);
  const list = favs.length ? favs.slice(0, 6) : state.books.slice(0, 6);
  box.innerHTML = list.length
    ? list.map(buildBookCardHTML).join("")
    : `<div class="surface-card" style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 26px;">لا توجد كتب مضافة بعد. اضغط زر (+) في الشريط السفلي لإضافة مؤلف وعقد كتاب.</div>`;
}

function renderContractsBooksGrid() {
  const box = document.getElementById("contracts-books-grid");
  if (!box) return;
  const q = normalizeArabic(document.getElementById("books-search-input").value || "");
  let list = [...state.books].sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0));

  if (state.activeBookFilter === "fav") list = list.filter((b) => b.isFavorite);
  else if (state.activeBookFilter === "active")
    list = list.filter((b) => !getContractInfo(b.contractDate, b.contractMonths, b.isTerminated).isExpiring);
  else if (state.activeBookFilter === "expiring")
    list = list.filter((b) => getContractInfo(b.contractDate, b.contractMonths, b.isTerminated).isExpiring);
  else if (state.activeBookFilter === "lowstock")
    list = list.filter((b) => Number(b.stock || 0) <= 15);

  if (q) {
    list = list.filter(
      (b) =>
        normalizeArabic(b.title).includes(q) ||
        normalizeArabic(b.authorName).includes(q) ||
        normalizeArabic(b.category).includes(q) ||
        normalizeArabic(b.isbn).includes(q)
    );
  }

  box.innerHTML = list.length
    ? list.map(buildBookCardHTML).join("")
    : `<div class="surface-card" style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 30px;">لا توجد كتب مطابقة للبحث أو الفلتر المحدد.</div>`;
}

document.getElementById("books-search-input").addEventListener("input", renderContractsBooksGrid);
