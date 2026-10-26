
"use strict";

/* =========================================================
   POCKETWISE — STUDENT EXPENSE TRACKER
   HTML: index.html | CSS: style.css | JS: script.js
   ========================================================= */

const STORAGE_KEY = "pocketwise_student_tracker_v1";

const CATEGORIES = {
  expense: [
    { name: "Food & drinks", emoji: "🍔", color: "#ff8b9c" },
    { name: "Transport", emoji: "🚌", color: "#72c8ff" },
    { name: "College & books", emoji: "📚", color: "#b7a0ff" },
    { name: "Shopping", emoji: "🛍️", color: "#ffbd70" },
    { name: "Entertainment", emoji: "🎮", color: "#e5a2ff" },
    { name: "Subscriptions", emoji: "📱", color: "#73e2ca" },
    { name: "Health", emoji: "💊", color: "#ff9e78" },
    { name: "Personal care", emoji: "🧴", color: "#ff9ed2" },
    { name: "Hostel & rent", emoji: "🏠", color: "#8eafff" },
    { name: "Utilities", emoji: "💡", color: "#e9db79" },
    { name: "Gifts & donations", emoji: "🎁", color: "#91e6a0" },
    { name: "Other", emoji: "📦", color: "#a6b5c9" }
  ],
  income: [
    { name: "Pocket money", emoji: "💰", color: "#62e6a6" },
    { name: "Family allowance", emoji: "👨‍👩‍👧", color: "#72c8ff" },
    { name: "Part-time job", emoji: "💼", color: "#b7a0ff" },
    { name: "Scholarship", emoji: "🎓", color: "#ffd36e" },
    { name: "Gift", emoji: "🎁", color: "#ff9ed2" },
    { name: "Refund", emoji: "↩️", color: "#73e2ca" },
    { name: "Other income", emoji: "✨", color: "#a6b5c9" }
  ]
};

const PAYMENT_METHODS = [
  "UPI", "Cash", "Card", "Bank transfer", "Other"
];

const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) =>
  [...parent.querySelectorAll(selector)];

let selectedMonth = currentMonth();
let charts = {};
let confirmCallback = null;
let noticeTimer = null;
let lastFocusedElement = null;

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function localDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function makeId() {
  if (globalThis.crypto && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "pw-" + Date.now().toString(36) +
    "-" + Math.random().toString(36).slice(2, 10);
}

function blankState() {
  return {
    version: 1,
    profile: {
      name: "College Student",
      currency: "INR",
      defaultPocketMoney: 0,
      savingsTarget: 0
    },
    transactions: [],
    budgets: [],
    goals: []
  };
}

function normaliseState(raw) {
  const fresh = blankState();

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return fresh;
  }

  const allowedCurrencies = ["INR", "USD", "GBP", "EUR", "NPR"];

  if (raw.profile && typeof raw.profile === "object") {
    fresh.profile.name =
      typeof raw.profile.name === "string"
        ? raw.profile.name.slice(0, 50)
        : fresh.profile.name;

    fresh.profile.currency =
      allowedCurrencies.includes(raw.profile.currency)
        ? raw.profile.currency
        : "INR";

    fresh.profile.defaultPocketMoney = safeNumber(
      raw.profile.defaultPocketMoney
    );

    fresh.profile.savingsTarget = safeNumber(
      raw.profile.savingsTarget
    );
  }

  if (Array.isArray(raw.transactions)) {
    fresh.transactions = raw.transactions
      .filter(t => t && typeof t === "object")
      .filter(t => ["income", "expense"].includes(t.type))
      .filter(t => typeof t.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t.date))
      .filter(t => typeof t.name === "string")
      .filter(t => typeof t.id === "string" && t.id.length <= 100)
      .filter(t => Number.isFinite(Number(t.amount)) && Number(t.amount) > 0 && Number(t.amount) <= 100000000)
      .slice(0, 50000)
      .map(t => ({
        id: t.id,
        name: t.name.slice(0, 100),
        amount: Number(t.amount),
        date: t.date,
        type: t.type,
        category: typeof t.category === "string"
          ? t.category.slice(0, 60)
          : "Other",
        payment: PAYMENT_METHODS.includes(t.payment) ? t.payment : "Other",
        notes: typeof t.notes === "string" ? t.notes.slice(0, 500) : "",
        createdAt: typeof t.createdAt === "string"
          ? t.createdAt
          : new Date().toISOString()
      }));
  }

  if (Array.isArray(raw.budgets)) {
    fresh.budgets = raw.budgets
      .filter(b => b && typeof b === "object")
      .filter(b => typeof b.month === "string" && /^\d{4}-\d{2}$/.test(b.month))
      .filter(b => typeof b.category === "string")
      .filter(b => Number.isFinite(Number(b.limit)) && Number(b.limit) > 0 && Number(b.limit) <= 100000000)
      .slice(0, 2000)
      .map(b => ({
        id: typeof b.id === "string" ? b.id : makeId(),
        month: b.month,
        category: b.category.slice(0, 60),
        limit: Number(b.limit)
      }));
  }

  if (Array.isArray(raw.goals)) {
    fresh.goals = raw.goals
      .filter(g => g && typeof g === "object")
      .filter(g => typeof g.name === "string")
      .filter(g => typeof g.id === "string" && g.id.length <= 100)
      .filter(g => Number.isFinite(Number(g.target)) && Number(g.target) > 0 && Number(g.target) <= 100000000)
      .slice(0, 2000)
      .map(g => ({
        id: g.id,
        name: g.name.slice(0, 80),
        target: Number(g.target),
        saved: Math.min(
          safeNumber(g.saved),
          Number(g.target)
        ),
        date: typeof g.date === "string" ? g.date : "",
        emoji: typeof g.emoji === "string" ? g.emoji.slice(0, 12) : "🎯"
      }));
  }

  // Keep the most recent duplicate budget record for each month/category.
  const budgetMap = new Map();
  fresh.budgets.forEach(b => budgetMap.set(`${b.month}|${b.category}`, b));
  fresh.budgets = [...budgetMap.values()];

  return fresh;
}

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 100000000) : 0;
}

function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? normaliseState(JSON.parse(stored)) : blankState();
  } catch (error) {
    console.error("Could not load PocketWise data:", error);
    return blankState();
  }
}

let state = loadState();

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    console.error("Could not save PocketWise data:", error);
    toast(
      "Unable to save data. Check browser storage or export a backup.",
      "error"
    );
    return false;
  }
}

function money(amount) {
  const value = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  const currency = state.profile.currency || "INR";

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
      minimumFractionDigits: 0
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function numberText(amount) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2
  }).format(amount);
}

function monthName(month, short = false) {
  if (!/^\d{4}-\d{2}$/.test(month)) return month;

  const [year, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", {
    month: short ? "short" : "long",
    year: "numeric"
  }).format(new Date(year, m - 1, 1));
}

function dateText(date) {
  if (!date) return "—";
  const parts = date.split("-").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return date;

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(parts[0], parts[1] - 1, parts[2]));
}

function monthTransactions(month = selectedMonth) {
  return state.transactions.filter(t => t.date.startsWith(month));
}

function expensesFor(month = selectedMonth) {
  return monthTransactions(month).filter(t => t.type === "expense");
}

function incomeFor(month = selectedMonth) {
  return monthTransactions(month).filter(t => t.type === "income");
}

function total(items) {
  return items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

function categoryInfo(category, type = "expense") {
  return CATEGORIES[type].find(c => c.name === category) ||
    CATEGORIES.expense.find(c => c.name === category) ||
    { name: category || "Other", emoji: "📦", color: "#a6b5c9" };
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function toast(message, type = "success") {
  const container = $("#toastContainer");
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);

  setTimeout(() => el.remove(), 3600);
}

function setNotice(message) {
  const notice = $("#notice");
  notice.textContent = message;
  notice.hidden = false;

  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    notice.hidden = true;
  }, 5000);
}

function askConfirm(message, callback, title = "Are you sure?") {
  confirmCallback = callback;
  $("#confirmTitle").textContent = title;
  $("#confirmMessage").textContent = message;
  openModal("confirmModal");
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;

  lastFocusedElement = document.activeElement;
  modal.hidden = false;
  document.body.style.overflow = "hidden";

  const focusTarget = $("input:not([type=hidden]), select, textarea, button", modal);
  if (focusTarget) setTimeout(() => focusTarget.focus(), 30);
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;

  modal.hidden = true;

  if ($$(".modal-overlay").every(m => m.hidden)) {
    document.body.style.overflow = "";
  }

  if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
    lastFocusedElement.focus();
  }
}

function populateCategorySelect(select, type) {
  select.innerHTML = CATEGORIES[type]
    .map(c => `<option value="${escapeHTML(c.name)}">${c.emoji} ${escapeHTML(c.name)}</option>`)
    .join("");
}

function updateTransactionCategory() {
  const type = $('input[name="transactionType"]:checked').value;
  const select = $("#transactionCategory");
  const oldValue = select.value;

  populateCategorySelect(select, type);

  if ([...select.options].some(o => o.value === oldValue)) {
    select.value = oldValue;
  }
}

function initialiseSelects() {
  populateCategorySelect($("#transactionCategory"), "expense");
  populateCategorySelect($("#budgetCategory"), "expense");
  refreshCategoryFilter();
}

function refreshCategoryFilter() {
  const select = $("#filterCategory");
  const oldValue = select.value;

  const categories = [...new Set([
    ...CATEGORIES.expense.map(c => c.name),
    ...CATEGORIES.income.map(c => c.name),
    ...state.transactions.map(t => t.category)
  ])].sort();

  select.innerHTML =
    '<option value="all">All categories</option>' +
    categories.map(c =>
      `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`
    ).join("");

  if (categories.includes(oldValue)) select.value = oldValue;
}

/* ====================== NAVIGATION ====================== */

const PAGE_TITLES = {
  dashboard: "Your dashboard",
  transactions: "Transactions",
  budgets: "Monthly budgets",
  savings: "Savings goals",
  reports: "Reports & insights",
  settings: "Settings & data"
};

function showPage(page) {
  if (!PAGE_TITLES[page]) return;

  $$(".page-section").forEach(section => {
    section.classList.toggle("active", section.id === `page-${page}`);
  });

  $$(".nav-item").forEach(button => {
    button.classList.toggle("active", button.dataset.page === page);
  });

  $("#pageHeading").textContent = PAGE_TITLES[page];
  $("#sidebar").classList.remove("open");

  if (page === "reports") renderReports();
  if (page === "transactions") renderTransactions();
  if (page === "budgets") renderBudgets();
  if (page === "savings") renderGoals();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ====================== TRANSACTIONS ====================== */

function openNewTransaction(type = "expense") {
  $("#transactionForm").reset();
  $("#transactionId").value = "";
  $("#transactionDate").value = localDate();
  $("#transactionModalTitle");
  $("#expenseModalTitle").textContent = "Add transaction";
  $("#saveTransactionButton").textContent = "Save transaction";

  $(`input[name="transactionType"][value="${type}"]`).checked = true;
  updateTransactionCategory();

  $("#transactionPayment").value = "UPI";
  $("#transactionNotes").value = "";

  openModal("expenseModal");
}

function openEditTransaction(id) {
  const t = state.transactions.find(item => item.id === id);
  if (!t) return toast("Transaction not found.", "error");

  $("#transactionId").value = t.id;
  $("#transactionName").value = t.name;
  $("#transactionAmount").value = t.amount;
  $("#transactionDate").value = t.date;
  $("#transactionNotes").value = t.notes || "";
  $("#transactionPayment").value = t.payment || "Other";

  $(`input[name="transactionType"][value="${t.type}"]`).checked = true;
  updateTransactionCategory();

  const categorySelect = $("#transactionCategory");
  if (![...categorySelect.options].some(o => o.value === t.category)) {
    categorySelect.add(new Option(t.category, t.category));
  }
  categorySelect.value = t.category;

  $("#expenseModalTitle").textContent = "Edit transaction";
  $("#saveTransactionButton").textContent = "Save changes";

  openModal("expenseModal");
}

function saveTransaction(event) {
  event.preventDefault();

  const id = $("#transactionId").value;
  const type = $('input[name="transactionType"]:checked').value;
  const name = $("#transactionName").value.trim();
  const amount = Number($("#transactionAmount").value);
  const date = $("#transactionDate").value;
  const category = $("#transactionCategory").value;

  if (!name || name.length > 100) {
    return toast("Enter a valid transaction name.", "error");
  }

  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) {
    return toast("Enter a valid positive amount.", "error");
  }

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return toast("Choose a valid date.", "error");
  }

  const oldTransaction = id
    ? state.transactions.find(t => t.id === id)
    : null;

  const transaction = {
    id: id || makeId(),
    type,
    name,
    amount,
    date,
    category,
    payment: $("#transactionPayment").value,
    notes: $("#transactionNotes").value.trim().slice(0, 500),
    createdAt: oldTransaction?.createdAt || new Date().toISOString()
  };

  if (oldTransaction) {
    state.transactions = state.transactions.map(t =>
      t.id === id ? transaction : t
    );
  } else {
    state.transactions.push(transaction);
  }

  if (!saveState()) return;

  closeModal("expenseModal");
  refreshAll();

  toast(oldTransaction ? "Transaction updated." : "Transaction saved.");
}

/* ====================== DASHBOARD ====================== */

function monthDayCount(month) {
  const [year, m] = month.split("-").map(Number);
  return new Date(year, m, 0).getDate();
}

function daysRemainingInMonth(month) {
  if (month < currentMonth()) return 0;
  if (month > currentMonth()) return monthDayCount(month);

  return monthDayCount(month) - new Date().getDate() + 1;
}

function monthlyIncomeAmount(month) {
  const recorded = total(incomeFor(month));

  // Use default pocket money only when no income is recorded
  // for this month, preventing the same allowance being counted twice.
  if (recorded > 0) return recorded;

  if (month === currentMonth()) {
    return state.profile.defaultPocketMoney;
  }

  return 0;
}

function renderDashboard() {
  const expenses = expensesFor();
  const income = incomeFor();
  const spent = total(expenses);
  const received = monthlyIncomeAmount(selectedMonth);
  const remaining = received - spent;
  const savingsRate = received > 0
    ? (remaining / received) * 100
    : 0;

  $("#statIncome").textContent = money(received);
  $("#statExpenses").textContent = money(spent);
  $("#statRemaining").textContent = money(remaining);
  $("#statRemaining").style.color = remaining < 0 ? "var(--red)" : "";
  $("#statSavingsRate").textContent = `${Math.round(savingsRate)}%`;
  $("#statSavingsRate").style.color = savingsRate < 0 ? "var(--red)" : "";

  $("#expenseFoot").textContent = `${expenses.length} expense${expenses.length === 1 ? "" : "s"} recorded`;
  $("#selectedMonthLabel").textContent = monthName(selectedMonth);
  $("#currentDate").textContent = new Intl.DateTimeFormat("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  }).format(new Date()).toUpperCase();

  $("#welcomeTitle").textContent = `Hey ${state.profile.name || "there"}, let's manage your money.`;

  renderRecentTransactions();
  renderInsights();
  renderAllowance(received, spent);
  renderDashboardGoals();
  renderCharts();
}

function renderRecentTransactions() {
  const items = monthTransactions()
    .sort((a, b) => b.date.localeCompare(a.date) ||
      b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  $("#recentTransactions").innerHTML = items.map(t => {
    const info = categoryInfo(t.category, t.type);

    return `
      <tr>
        <td><div class="transaction-cell">
          <span class="transaction-icon">${info.emoji}</span>
          <span><strong class="transaction-title">${escapeHTML(t.name)}</strong>
          <small class="transaction-subtitle">${escapeHTML(t.payment || "Other")}</small></span>
        </div></td>
        <td>${dateText(t.date)}</td>
        <td><span class="category-badge">${escapeHTML(t.category)}</span></td>
        <td class="${t.type === "income" ? "amount-income" : "amount-expense"}">
          ${t.type === "income" ? "+" : "−"}${money(t.amount)}
        </td>
        <td><button class="row-action" data-edit-transaction="${escapeHTML(t.id)}">Edit</button></td>
      </tr>`;
  }).join("");

  $("#recentEmpty").hidden = items.length > 0;
}

function renderAllowance(income, spent) {
  const remaining = Math.max(0, income - spent);
  const days = daysRemainingInMonth(selectedMonth);
  const daily = days > 0 ? remaining / days : 0;

  $("#dailyAllowance").textContent = money(daily);

  const percent = income > 0 ? Math.max(0, Math.min(100, spent / income * 100)) : 0;
  const progress = $("#allowanceProgress");
  progress.style.width = `${percent}%`;
  progress.className = "progress-fill" +
    (percent >= 100 ? " danger" : percent >= 80 ? " warning" : "");

  if (income <= 0) {
    $("#allowanceDescription").textContent =
      "Record your pocket money to calculate your daily guide.";
    $("#allowanceFoot").textContent = "No income recorded for this month.";
  } else if (days === 0) {
    $("#allowanceDescription").textContent =
      "This month has ended. Review your spending and plan for the next month.";
    $("#allowanceFoot").textContent = `${Math.round(percent)}% of recorded income spent.`;
  } else {
    $("#allowanceDescription").textContent =
      `${days} day${days === 1 ? "" : "s"} remaining, including today.`;
    $("#allowanceFoot").textContent =
      `${money(remaining)} remains after recorded expenses. ${Math.round(percent)}% of income spent.`;
  }
}

function renderInsights() {
  const expenses = expensesFor();
  const spent = total(expenses);
  const income = monthlyIncomeAmount(selectedMonth);
  const days = Math.max(1, new Date().getDate());
  const avgDaily = selectedMonth === currentMonth() ? spent / days : spent / monthDayCount(selectedMonth);

  const categoryTotals = {};
  expenses.forEach(t => {
    categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
  });

  const ranked = Object.entries