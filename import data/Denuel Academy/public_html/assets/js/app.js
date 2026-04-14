// Net Income Report (standalone page)
async function loadNetIncomeReport() {
  try {
    const from = document.getElementById('netIncomeFrom').value;
    const to = document.getElementById('netIncomeTo').value;
    if (!from || !to) return;
    const query = new URLSearchParams({ from, to });
    const data = await apiCall(`reports/profit_by_category.php?${query.toString()}`);
    const summary = document.getElementById('netIncomeSummary');
    if (!summary) return;
    summary.innerHTML = `
      <div style="font-size:18px;margin-bottom:10px"><strong>Net Income:</strong> ${fmtCurrencyWithCode(data.net_income, 'USD')}</div>
      <div><span style=\"color:#16a34a\">Total Income: ${fmtCurrencyWithCode(data.total_income, 'USD')}</span> &nbsp; 
      <span style=\"color:#dc2626\">Total Expenses: ${fmtCurrencyWithCode(data.total_expense, 'USD')}</span></div>
    `;
  } catch (err) {
    showMsg('msg', err.message, false);
  }
}
// Profit by Categories (Net Income) report
async function loadProfitByCategory() {
  try {
    const from = document.getElementById('profitCatFrom').value;
    const to = document.getElementById('profitCatTo').value;
    if (!from || !to) return;
    const query = new URLSearchParams({ from, to });
    const data = await apiCall(`reports/profit_by_category.php?${query.toString()}`);
    const table = document.getElementById('profitCatTable');
    const summary = document.getElementById('profitCatSummary');
    if (!table || !summary) return;
    const rows = Array.isArray(data.by_category) ? data.by_category : [];
    table.innerHTML = rows.length ? rows.map(row => `
      <tr>
        <td>${escHtml(row.category)}</td>
        <td>${fmtCurrencyWithCode(row.income, 'USD')}</td>
        <td>${fmtCurrencyWithCode(row.expense, 'USD')}</td>
        <td style="font-weight:600; color:${row.profit >= 0 ? '#16a34a' : '#dc2626'}">${fmtCurrencyWithCode(row.profit, 'USD')}</td>
      </tr>
    `).join('') : '<tr><td colspan="4" style="text-align:center">No data</td></tr>';
    summary.innerHTML = `
      <strong>Net Income:</strong> ${fmtCurrencyWithCode(data.net_income, 'USD')}<br>
      <span style="color:#16a34a">Total Income: ${fmtCurrencyWithCode(data.total_income, 'USD')}</span> &nbsp; 
      <span style="color:#dc2626">Total Expenses: ${fmtCurrencyWithCode(data.total_expense, 'USD')}</span>
    `;
  } catch (err) {
    showMsg('msg', err.message, false);
  }
}
const API = "api";
let editingPlanId = null;
let editingClassId = null;
let editingScheduleId = null;
let allSchedules = [];
let allRenewals = [];
let renewalFilterStatus = "pending";
let renewalSearchQuery = "";
let renewalAutoFilter = "all";
let renewalLifetimeFilter = "lifetime";
let renewalCustomDate = "";
let allStudentsRows = [];
let studentSearchQuery = "";
let allExpenseCategories = [];
let expenseSearchTimer = null;
let revenueReportState = { series: [], report_currency: "USD" };
let attCurrentDate = "";
let attCurrentClassId = 0;
let attCurrentClassName = "";
let studentProfileState = {
  studentId: 0,
  activeTab: "overview",
  student: null,
  payments: [],
  invoices: [],
  subscriptions: [],
  attendance: { summary: {}, rows: [] },
  planGroupOpen: { current: true, past: true, coming: true },
};
const LIST_PAGE_SIZE = 25;
const listPaginationState = {};
const listPaginationRenderers = {};

function setListRenderer(key, renderer) {
  listPaginationRenderers[key] = renderer;
}

function resetListPage(key) {
  if (!listPaginationState[key]) listPaginationState[key] = { page: 1 };
  listPaginationState[key].page = 1;
}

function getPagedRows(key, rows) {
  const allRows = Array.isArray(rows) ? rows : [];
  if (!listPaginationState[key]) listPaginationState[key] = { page: 1 };
  const state = listPaginationState[key];
  const totalPages = Math.max(1, Math.ceil(allRows.length / LIST_PAGE_SIZE));
  if (state.page > totalPages) state.page = totalPages;
  if (state.page < 1) state.page = 1;
  const start = (state.page - 1) * LIST_PAGE_SIZE;
  return allRows.slice(start, start + LIST_PAGE_SIZE);
}

function changeListPage(key, delta) {
  if (!listPaginationState[key]) listPaginationState[key] = { page: 1 };
  listPaginationState[key].page = Math.max(1, listPaginationState[key].page + delta);
  const renderer = listPaginationRenderers[key];
  if (typeof renderer === "function") renderer();
}

function setListPage(key, page) {
  if (!listPaginationState[key]) listPaginationState[key] = { page: 1 };
  listPaginationState[key].page = Math.max(1, parseInt(page, 10) || 1);
  const renderer = listPaginationRenderers[key];
  if (typeof renderer === "function") renderer();
}

function renderListPagination(key, tbodyEl, totalRows) {
  if (!tbodyEl) return;
  const table = tbodyEl.closest("table");
  if (!table || !table.parentElement) return;

  let pager = table.parentElement.querySelector(`.list-pagination[data-key="${key}"]`);
  if (!pager) {
    pager = document.createElement("div");
    pager.className = "list-pagination";
    pager.dataset.key = key;
    table.insertAdjacentElement("afterend", pager);
  }

  const total = Number(totalRows || 0);
  const totalPages = Math.max(1, Math.ceil(total / LIST_PAGE_SIZE));
  if (!listPaginationState[key]) listPaginationState[key] = { page: 1 };
  const state = listPaginationState[key];
  if (state.page > totalPages) state.page = totalPages;
  if (state.page < 1) state.page = 1;

  if (total <= LIST_PAGE_SIZE) {
    pager.classList.add("hidden");
    pager.innerHTML = "";
    return;
  }

  pager.classList.remove("hidden");
  const from = (state.page - 1) * LIST_PAGE_SIZE + 1;
  const to = Math.min(state.page * LIST_PAGE_SIZE, total);

  pager.innerHTML = `
    <span class="list-page-info">${from} - ${to} of ${total}</span>
    <div class="list-page-actions">
      <button type="button" class="list-page-btn list-page-icon-btn" onclick="setListPage('${key}', 1)" ${state.page <= 1 ? "disabled" : ""} aria-label="First page" title="First page">
        <span aria-hidden="true">&#124;&lsaquo;</span>
      </button>
      <button type="button" class="list-page-btn list-page-icon-btn" onclick="changeListPage('${key}', -1)" ${state.page <= 1 ? "disabled" : ""} aria-label="Previous page" title="Previous page">
        <span aria-hidden="true">&lsaquo;</span>
      </button>
      <button type="button" class="list-page-btn list-page-icon-btn" onclick="changeListPage('${key}', 1)" ${state.page >= totalPages ? "disabled" : ""} aria-label="Next page" title="Next page">
        <span aria-hidden="true">&rsaquo;</span>
      </button>
      <button type="button" class="list-page-btn list-page-icon-btn" onclick="setListPage('${key}', ${totalPages})" ${state.page >= totalPages ? "disabled" : ""} aria-label="Last page" title="Last page">
        <span aria-hidden="true">&rsaquo;&#124;</span>
      </button>
    </div>
  `;
}

function showMsg(id, text, ok) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = ok ? "msg ok" : "msg err";
  el.textContent = text;
}

async function apiCall(path, method = "GET", body = null) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}/${path}`, opts);
  const raw = await res.text();
  const text = raw.replace(/^\uFEFF/, "").trim();
  let data = {};

  if (text !== "") {
    try {
      data = JSON.parse(text);
    } catch (err) {
      const snippet = text.slice(0, 200);
      throw new Error(`Invalid server response: ${snippet}`);
    }
  }

  if (!res.ok) throw new Error(data.message || text || "Request failed");
  return data;
}

async function login() {
  try {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    await apiCall("auth/login.php", "POST", { email, password });
    window.location.href = "dashboard.html";
  } catch (err) {
    showMsg("msg", err.message, false);
  }
}

async function logout() {
  await apiCall("auth/logout.php", "POST", {});
  window.location.href = "index.html";
}

async function checkAuth() {
  const page = document.body.dataset.page;
  if (!page || page === "") return;
  const auth = await apiCall("auth/check_auth.php");
  if (!auth.authenticated) {
    window.location.href = "index.html";
  }
}

function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDate(str) {
  if (!str) return '';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtCurrency(amount) {
  return '$ ' + parseFloat(amount || 0).toFixed(2);
}

function planCurrencySymbol(code) {
  const c = String(code || 'CDF').toUpperCase();
  if (c === 'USD') return '$';
  if (c === 'CDF') return 'CDF ';
  return c + ' ';
}

function fmtCurrencyWithCode(amount, currencyCode) {
  const sym = planCurrencySymbol(currencyCode);
  return sym + parseFloat(amount || 0).toFixed(2);
}

async function loadStudentsIntoSelect(selectId) {
  const students = await apiCall("students/read.php");
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.innerHTML = "<option value=''>Select student</option>";
  students.forEach(s => {
    sel.innerHTML += `<option value="${s.id}">${s.name}</option>`;
  });
}

async function loadClassPlansIntoSelect() {
  const sel = document.getElementById("classPlan");
  if (!sel) return;

  const result = await apiCall("plans/read.php?type=subscription");
  const plans = (result && result.plans) || [];

  sel.innerHTML = "<option value=''>Select Plan</option>";
  plans.forEach(plan => {
    sel.innerHTML += `<option value="${plan.id}">${plan.title}</option>`;
  });
}

async function loadClassesIntoScheduleSelect(selectedId = "") {
  const sel = document.getElementById("scheduleClassId");
  if (!sel) return;

  const rows = await apiCall("classes/read.php");
  sel._classData = {};
  sel.innerHTML = "<option value=''>Select class</option>";
  rows.forEach(r => {
    sel._classData[r.id] = r;
    sel.innerHTML += `<option value="${r.id}">${r.title}</option>`;
  });

  if (selectedId) sel.value = selectedId;

  // wire center auto-fill
  sel.onchange = function () {
    const cls = sel._classData[sel.value];
    const centerEl = document.getElementById("scheduleCenterDisplay");
    if (centerEl) centerEl.value = cls ? (cls.center || "") : "";
  };
}

function renderStudents(rows) {
  const tb = document.getElementById("studentsTable");
  if (!tb) return;
  setListRenderer("students", () => renderStudents(rows));

  const countEl = document.getElementById("studentCount");
  if (countEl) {
    if (studentSearchQuery) {
      countEl.textContent = `${rows.length} of ${allStudentsRows.length} students`;
    } else {
      countEl.textContent = `${rows.length} student${rows.length !== 1 ? 's' : ''}`;
    }
  }

  tb.innerHTML = "";
  if (!rows.length) {
    const emptyText = studentSearchQuery
      ? 'No students match your search.'
      : 'No students yet. Click "Add Student" to register one.';
    tb.innerHTML = `<tr><td colspan="9" class="no-data">${emptyText}</td></tr>`;
    renderListPagination("students", tb, 0);
    return;
  }

  const pagedRows = getPagedRows("students", rows);

  pagedRows.forEach(s => {
    const initial = (s.name || '?').charAt(0).toUpperCase();
    const oneTimeCount = Number(s.one_time_plan_count || (Array.isArray(s.one_time_plan_ids) ? s.one_time_plan_ids.length : 0) || 0);
    const planLabel = s.plan_title ? `${s.plan_title}${oneTimeCount > 0 ? ` +${oneTimeCount}` : ""}` : "";
    const subLine = s.sub_start
      ? `${fmtDate(s.sub_start)} &ndash; ${fmtDate(s.sub_end)}`
      : '&ndash;';
    const daysElapsed = s.days_elapsed != null && s.sub_start ? Math.max(0, parseInt(s.days_elapsed)) : null;
    const receivable = parseFloat(s.receivable || 0);
    tb.innerHTML += `
      <tr>
        <td><input type="checkbox"></td>
        <td>
          <button type="button" class="student-link-btn" onclick="openStudentProfile(${parseInt(s.id, 10) || 0})">
          <span class="plan-title-wrap">
            <span class="plan-avatar">${initial}</span>
            <span>
              <span class="plan-title-text">${escHtml(s.name)}</span>
              ${s.gender ? `<br><span class="plan-cycle">${escHtml(s.gender)}</span>` : ''}
            </span>
          </span>
          </button>
        </td>
        <td>
          ${planLabel ? `<span class="plan-title-text">${escHtml(planLabel)}</span><br>` : ''}
          <span class="plan-cycle">${subLine}</span>
        </td>
        <td>${escHtml(s.class_title || '&ndash;')}</td>
        <td>0 | 0</td>
        <td>
          ${s.class_level ? `<span class="plan-title-text">${escHtml(s.class_level)}</span>` : '&ndash;'}
          ${daysElapsed !== null ? `<br><span class="plan-cycle">${daysElapsed} days</span>` : ''}
        </td>
        <td class="${receivable > 0 ? 'receivable-due' : ''}">${receivable > 0 ? fmtCurrencyWithCode(receivable, s.plan_currency) : '&ndash;'}</td>
        <td class="plan-actions">
          <button class="plan-action-btn" onclick='openStudentForm(${JSON.stringify(s).replace(/'/g, "&#39;")})'>Edit</button>
          <button class="plan-action-btn danger" onclick="deleteStudentById(${s.id})">Delete</button>
        </td>
      </tr>`;
  });
  renderListPagination("students", tb, rows.length);
}

function openStudentProfile(studentId) {
  const id = parseInt(studentId, 10) || 0;
  if (!id) return;
  window.location.href = `student-profile.html?id=${encodeURIComponent(id)}`;
}

function studentProfilePanel(tab) {
  return document.querySelector(`.student-panel[data-panel="${tab}"]`);
}

function studentProfileAvatarMarkup(student, className = "student-profile-avatar") {
  const name = String(student?.name || "Student");
  const initial = escHtml(name.trim().charAt(0).toUpperCase() || "S");
  const photo = String(student?.photo || "").trim();
  if (photo) {
    return `<span class="${className}"><img src="${photo}" alt="${escHtml(name)}"></span>`;
  }
  return `<span class="${className}">${initial}</span>`;
}

function studentProfileBadge(text, tone = "neutral") {
  return `<span class="student-profile-badge ${tone}">${escHtml(text || "-")}</span>`;
}

function studentProfileMetric(label, value, caption = "") {
  return `
    <article class="student-metric-card">
      <span class="student-metric-label">${escHtml(label)}</span>
      <strong class="student-metric-value">${value}</strong>
      ${caption ? `<span class="student-metric-caption">${escHtml(caption)}</span>` : ""}
    </article>
  `;
}

function studentProfileField(label, value) {
  return `
    <div class="student-field-item">
      <span class="student-field-label">${escHtml(label)}</span>
      <strong class="student-field-value">${value || "&ndash;"}</strong>
    </div>
  `;
}

function sumPaymentsByCurrency(payments) {
  const totals = {};
  (Array.isArray(payments) ? payments : []).forEach(row => {
    const currency = String(row?.currency || row?.plan_currency || "USD").toUpperCase();
    const amount = parseFloat(row?.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) return;
    totals[currency] = (totals[currency] || 0) + amount;
  });
  const parts = Object.entries(totals).map(([currency, amount]) => fmtCurrencyWithCode(amount, currency));
  return parts.length ? parts.join(" + ") : "&ndash;";
}

function studentProfileLatestAttendance(attendanceRows) {
  const row = Array.isArray(attendanceRows) && attendanceRows.length ? attendanceRows[0] : null;
  if (!row) return "No attendance yet";
  const pieces = [fmtDate(row.date), row.class_title || "Class", row.status || "-"];
  return escHtml(pieces.filter(Boolean).join(" • "));
}

function renderStudentOverviewPanel() {
  const panel = studentProfilePanel("overview");
  if (!panel) return;

  const student = studentProfileState.student;
  const payments = studentProfileState.payments;
  const attendanceSummary = studentProfileState.attendance?.summary || {};
  const attendanceRows = studentProfileState.attendance?.rows || [];
  const receivable = parseFloat(student?.receivable || 0);
  const oneTimeCount = Number(student?.one_time_plan_count || (Array.isArray(student?.one_time_plan_ids) ? student.one_time_plan_ids.length : 0) || 0);
  const oneTimeTotal = parseFloat(student?.one_time_plan_total || 0);
  const basePlanAmount = parseFloat(student?.plan_amount || 0);
  const combinedPlanAmount = basePlanAmount + oneTimeTotal;
  const planLabel = student?.plan_title
    ? `${student.plan_title}${oneTimeCount > 0 ? ` +${oneTimeCount}` : ""}`
    : "No abonnement";
  const paymentCount = payments.length;
  const latestPayment = payments[0] || null;
  const level = student?.class_level || student?.level || "Level not set";
  const phone = [student?.phone_code, student?.phone].filter(Boolean).join(" ").trim();
  const invoiceLabel = student?.invoice_prefix && student?.invoice_no
    ? `${student.invoice_prefix}${student.invoice_no}`
    : "&ndash;";
  const discountLabel = student?.discount_type && student.discount_type !== "none"
    ? `${student.discount_type} ${student.discount_value || 0}`
    : "None";
  const statusBadges = [
    studentProfileBadge(student?.plan_type === "one_time" ? "One-Time" : "Subscription", "info"),
    studentProfileBadge(student?.autorenew ? "Auto Renew" : "Manual Renew", student?.autorenew ? "success" : "neutral"),
    studentProfileBadge(student?.class_title || "No Class", "neutral")
  ].join("");

  panel.innerHTML = `
    <section class="student-hero-card">
      <div class="student-hero-main">
        ${studentProfileAvatarMarkup(student, "student-profile-avatar large")}
        <div class="student-hero-copy">
          <h2>${escHtml(student?.name || "Student")}</h2>
          <p>${escHtml(level)}</p>
          <div class="student-badge-row">${statusBadges}</div>
        </div>
      </div>
      <div class="student-hero-side">
        <a class="student-hero-link" href="students.html">Back to Students</a>
      </div>
    </section>

    <section class="student-metrics-grid">
      ${studentProfileMetric("Current Abonnement", escHtml(planLabel), student?.sub_start ? `${fmtDate(student.sub_start)} - ${fmtDate(student.sub_end)}` : "No active dates")}
      ${studentProfileMetric("Receivable", receivable > 0 ? fmtCurrencyWithCode(receivable, student?.plan_currency || "USD") : "Paid", student?.due_date ? `Due ${fmtDate(student.due_date)}` : "No due date")}
      ${studentProfileMetric("Payments", String(paymentCount), latestPayment ? `Last on ${fmtDate(latestPayment.payment_date)}` : "No payment history")}
      ${studentProfileMetric("Attendance Rate", `${Number(attendanceSummary.attendance_rate || 0).toFixed(0)}%`, `${attendanceSummary.present_count || 0} present of ${attendanceSummary.total_sessions || 0}`)}
    </section>

    <section class="student-content-grid two-up">
      <article class="student-card">
        <div class="student-card-head">
          <h3>Subscription Snapshot</h3>
        </div>
        <div class="student-fields-grid compact">
          ${studentProfileField("Class", escHtml(student?.class_title || "&ndash;"))}
          ${studentProfileField("Level", escHtml(level))}
          ${studentProfileField("Main Plan", escHtml(student?.plan_title ? planLabel : "&ndash;"))}
          ${studentProfileField("Plan Value", student?.plan_title ? fmtCurrencyWithCode(combinedPlanAmount, student?.plan_currency || "USD") : "&ndash;")}
          ${studentProfileField("Subscription", student?.sub_start ? escHtml(`${fmtDate(student.sub_start)} - ${fmtDate(student.sub_end)}`) : "&ndash;")}
          ${studentProfileField("One-Time Items", escHtml(student?.one_time_plan_titles || "None"))}
        </div>
      </article>

      <article class="student-card">
        <div class="student-card-head">
          <h3>Recent Activity</h3>
        </div>
        <div class="student-fields-grid compact">
          ${studentProfileField("Latest Payment", latestPayment ? escHtml(`${fmtDate(latestPayment.payment_date)} • ${fmtCurrencyWithCode(latestPayment.amount || 0, latestPayment.currency || latestPayment.plan_currency || "USD")}`) : "&ndash;")}
          ${studentProfileField("Paid Total", sumPaymentsByCurrency(payments))}
          ${studentProfileField("Attendance", studentProfileLatestAttendance(attendanceRows))}
          ${studentProfileField("Client Notes", escHtml(student?.client_notes || "No notes"))}
        </div>
      </article>
    </section>

    <section class="student-card">
      <div class="student-card-head"><h3>Student Information</h3></div>
      <div class="student-fields-grid">
        ${studentProfileField("Full Name", escHtml(student?.name || "&ndash;"))}
        ${studentProfileField("Gender", escHtml(student?.gender || "&ndash;"))}
        ${studentProfileField("Email", escHtml(student?.email || "&ndash;"))}
        ${studentProfileField("Phone", escHtml(phone || "&ndash;"))}
        ${studentProfileField("Class", escHtml(student?.class_title || "&ndash;"))}
        ${studentProfileField("Level", escHtml(level))}
        ${studentProfileField("Invoice", escHtml(invoiceLabel))}
        ${studentProfileField("Invoice Date", student?.invoice_date ? escHtml(fmtDate(student.invoice_date)) : "&ndash;")}
        ${studentProfileField("Payment Type", escHtml(student?.payment_type || "&ndash;"))}
        ${studentProfileField("Discount", escHtml(discountLabel))}
        ${studentProfileField("Due Date", student?.due_date ? escHtml(fmtDate(student.due_date)) : "&ndash;")}
        ${studentProfileField("Auto Renew", escHtml(student?.autorenew ? "Enabled" : "Disabled"))}
      </div>
      <div class="student-notes-block">
        <span class="student-field-label">Notes</span>
        <p>${escHtml(student?.client_notes || "No notes for this student yet.")}</p>
      </div>
    </section>
  `;
}

function renderStudentInfoPanel() {
  const panel = studentProfilePanel("info");
  if (!panel) return;

  const student = studentProfileState.student;
  const phone = [student?.phone_code, student?.phone].filter(Boolean).join(" ").trim();
  const invoiceLabel = student?.invoice_prefix && student?.invoice_no
    ? `${student.invoice_prefix}${student.invoice_no}`
    : "&ndash;";
  const discountLabel = student?.discount_type && student.discount_type !== "none"
    ? `${student.discount_type} ${student.discount_value || 0}`
    : "None";

  panel.innerHTML = `
    <section class="student-card">
      <div class="student-card-head"><h3>Student Information</h3></div>
      <div class="student-fields-grid">
        ${studentProfileField("Full Name", escHtml(student?.name || "&ndash;"))}
        ${studentProfileField("Gender", escHtml(student?.gender || "&ndash;"))}
        ${studentProfileField("Date of Birth", student?.date_of_birth ? escHtml(fmtDate(student.date_of_birth)) : "&ndash;")}
        ${studentProfileField("Email", escHtml(student?.email || "&ndash;"))}
        ${studentProfileField("Phone", escHtml(phone || "&ndash;"))}
        ${studentProfileField("Class", escHtml(student?.class_title || "&ndash;"))}
        ${studentProfileField("Level", escHtml(student?.class_level || student?.level || "&ndash;"))}
        ${studentProfileField("Invoice", escHtml(invoiceLabel))}
        ${studentProfileField("Invoice Date", student?.invoice_date ? escHtml(fmtDate(student.invoice_date)) : "&ndash;")}
        ${studentProfileField("Payment Type", escHtml(student?.payment_type || "&ndash;"))}
        ${studentProfileField("Discount", escHtml(discountLabel))}
        ${studentProfileField("Due Date", student?.due_date ? escHtml(fmtDate(student.due_date)) : "&ndash;")}
        ${studentProfileField("Auto Renew", escHtml(student?.autorenew ? "Enabled" : "Disabled"))}
      </div>
      <div class="student-notes-block">
        <span class="student-field-label">Notes</span>
        <p>${escHtml(student?.client_notes || "No notes for this student yet.")}</p>
      </div>
    </section>
  `;
}

function renderStudentItemPanel() {
  const panel = studentProfilePanel("item");
  if (!panel) return;

  const student = studentProfileState.student;
  const items = String(student?.one_time_plan_titles || "")
    .split(",")
    .map(v => v.trim())
    .filter(Boolean);

  panel.innerHTML = `
    <section class="student-card">
      <div class="student-card-head"><h3>Items</h3></div>
      ${items.length ? `
        <div class="student-chip-grid">
          ${items.map(item => `<span class="student-chip">${escHtml(item)}</span>`).join("")}
        </div>
      ` : `<div class="student-empty-state">No one-time items attached to this student.</div>`}
    </section>
  `;
}

function renderStudentPlanPanel() {
  const panel = studentProfilePanel("plan");
  if (!panel) return;

  const student = studentProfileState.student;
  const payments = Array.isArray(studentProfileState.payments) ? studentProfileState.payments : [];
  const subscriptions = Array.isArray(studentProfileState.subscriptions) ? studentProfileState.subscriptions : [];
  const attendanceRows = Array.isArray(studentProfileState.attendance?.rows) ? studentProfileState.attendance.rows : [];
  const receivable = parseFloat(student?.receivable || 0);
  const createdAt = student?.created_at ? new Date(String(student.created_at).replace(" ", "T")) : null;
  const now = new Date();
  const years = createdAt && !Number.isNaN(createdAt.getTime())
    ? Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / (365.25 * 24 * 60 * 60 * 1000)))
    : 0;
  const clientSince = createdAt && !Number.isNaN(createdAt.getTime())
    ? fmtDate(createdAt.toISOString().slice(0, 10))
    : "-";
  const totalPaid = sumPaymentsByCurrency(payments);

  const parseDate = value => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return null;
    const d = new Date(`${value}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const classifyRange = (start, end) => {
    const startDate = parseDate(start);
    const endDate = parseDate(end);
    if (startDate && startDate > today) return "coming";
    if (endDate && endDate < today) return "past";
    return "current";
  };

  const attendanceCountInRange = (start, end) => {
    const startDate = parseDate(start);
    const endDate = parseDate(end);
    if (!startDate || !endDate) return { present: 0, absent: 0 };

    let present = 0;
    let absent = 0;
    attendanceRows.forEach(row => {
      const ad = parseDate(row?.date || "");
      if (!ad) return;
      if (ad < startDate || ad > endDate) return;
      const st = String(row?.status || "present").toLowerCase();
      if (st === "absent") absent += 1;
      else present += 1;
    });
    return { present, absent };
  };

  const sumPaidInRange = (start, end) => {
    const startDate = parseDate(start);
    const endDate = parseDate(end);
    if (!startDate || !endDate) return 0;

    return payments.reduce((sum, row) => {
      const payDate = String(row?.payment_date || "").slice(0, 10);
      const pd = parseDate(payDate);
      if (!pd) return sum;
      if (pd < startDate || pd > endDate) return sum;
      return sum + Number(row?.amount || 0);
    }, 0);
  };

  const invoiceNo = student?.invoice_prefix && student?.invoice_no
    ? `${student.invoice_prefix}${student.invoice_no}`
    : "-";
  const oneTimeCount = Number(student?.one_time_plan_count || (Array.isArray(student?.one_time_plan_ids) ? student.one_time_plan_ids.length : 0) || 0);
  const oneTimeTotal = parseFloat(student?.one_time_plan_total || 0);
  const basePlanAmount = parseFloat(student?.plan_amount || 0);
  const combinedPlanAmount = basePlanAmount + oneTimeTotal;
  const currencySymbol = planCurrencySymbol(student?.plan_currency || "USD").trim();
  const planTitleWithAddon = `${student?.plan_title || "Plan"}${oneTimeCount > 0 ? ` +${oneTimeCount}` : ""}`;

  // One-time plans are charged only on the first (earliest) subscription.
  const allPlanStarts = [];
  if (student?.sub_start) allPlanStarts.push(String(student.sub_start).slice(0, 10));
  subscriptions.forEach(p => { if (p?.sub_start) allPlanStarts.push(String(p.sub_start).slice(0, 10)); });
  const firstPlanSubStart = allPlanStarts.filter(Boolean).sort()[0] || "";

  const planPeriodAmount = subStart =>
    oneTimeTotal > 0 && subStart && String(subStart).slice(0, 10) === firstPlanSubStart
      ? combinedPlanAmount
      : basePlanAmount;

  const planPeriodTitle = subStart =>
    oneTimeTotal > 0 && subStart && String(subStart).slice(0, 10) === firstPlanSubStart
      ? planTitleWithAddon
      : (student?.plan_title || "Plan");

  const entries = [];
  const seenPeriodKeys = new Set();

  if (student?.sub_start && student?.sub_end) {
    const group = classifyRange(student.sub_start, student.sub_end);
    const attendance = attendanceCountInRange(student.sub_start, student.sub_end);
    const currentStart = String(student.sub_start).slice(0, 10);
    const currentEnd = String(student.sub_end).slice(0, 10);
    const currentTotal = planPeriodAmount(currentStart);
    const currentPaid = sumPaidInRange(currentStart, currentEnd);
    const isCurrentPaid = currentTotal <= 0 || currentPaid + 0.0001 >= currentTotal;
    const baseStatus = group === "coming"
      ? "Upcoming"
      : (isCurrentPaid ? "Paid" : "Unpaid");
    const feeText = fmtCurrencyWithCode(currentTotal, student?.plan_currency || "USD");

    entries.push({
      key: `student-${student.id || 0}`,
      rawStart: student.sub_start,
      rawEnd: student.sub_end,
      group,
      title: planPeriodTitle(student.sub_start),
      range: `${fmtDate(student.sub_start)} - ${fmtDate(student.sub_end)}`,
      classTitle: student.class_title || "-",
      invoiceMain: invoiceNo,
      invoiceSub: student.invoice_date ? fmtDate(student.invoice_date) : "-",
      dueDate: fmtDate(student.sub_end),
      attendance,
      fees: feeText,
      feeTone: baseStatus === "Unpaid" ? "due" : (baseStatus === "Paid" ? "paid" : "ok"),
      status: baseStatus,
      statusTone: baseStatus.toLowerCase(),
    });

    seenPeriodKeys.add(`${student.sub_start}|${student.sub_end}`);
  }

  const paymentByPeriodKey = new Map();
  payments.forEach((row, idx) => {
    const start = row?.payment_date || "";
    const end = row?.expiry_date || row?.payment_date || "";
    if (!start || !end) return;
    paymentByPeriodKey.set(`${start}|${end}`, row);
    if (row?.id) {
      paymentByPeriodKey.set(`id:${row.id}`, row);
    }
  });

  subscriptions.forEach((period, idx) => {
    const start = String(period?.sub_start || "").slice(0, 10);
    const end = String(period?.sub_end || "").slice(0, 10);
    if (!start || !end) return;

    const key = `${start}|${end}`;
    if (seenPeriodKeys.has(key)) return;

    const group = classifyRange(start, end);
    if (group !== "past") {
      seenPeriodKeys.add(key);
      return;
    }

    const attendance = attendanceCountInRange(start, end);
    const paymentRow = paymentByPeriodKey.get(key) || null;
    const periodTotal = planPeriodAmount(start);
    const periodPaid = sumPaidInRange(start, end);
    const isPeriodPaid = periodTotal <= 0 || periodPaid + 0.0001 >= periodTotal;
    const periodInvoiceMain = period?.invoice_no
      ? `${student?.invoice_prefix || "INV-"}${period.invoice_no}`
      : "-";
    const periodInvoiceSub = period?.invoice_date
      ? fmtDate(period.invoice_date)
      : "-";

    entries.push({
      key: `hist-${idx}`,
      historyId: parseInt(period?.id || 0, 10) || 0,
      canManage: true,
      rawStart: start,
      rawEnd: end,
      group,
      title: planPeriodTitle(start),
      range: `${fmtDate(start)} - ${fmtDate(end)}`,
      classTitle: student?.class_title || "-",
      invoiceMain: periodInvoiceMain !== "-" ? periodInvoiceMain : (paymentRow?.id ? String(paymentRow.id) : "-"),
      invoiceSub: periodInvoiceSub !== "-" ? periodInvoiceSub : (paymentRow?.payment_date ? fmtDate(paymentRow.payment_date) : "-"),
      dueDate: isPeriodPaid ? "-" : fmtDate(end),
      attendance,
      fees: fmtCurrencyWithCode(periodTotal, student?.plan_currency || "USD"),
      feeTone: isPeriodPaid ? "paid" : "due",
      status: isPeriodPaid ? "Paid" : "Unpaid",
      statusTone: isPeriodPaid ? "paid" : "unpaid",
    });

    seenPeriodKeys.add(key);
  });

  payments.forEach((row, idx) => {
    const start = row?.payment_date || "";
    const end = row?.expiry_date || row?.payment_date || "";
    if (!start || !end) return;
    const key = `${start}|${end}`;
    if (seenPeriodKeys.has(key)) return;
    const group = classifyRange(start, end);
    if (group !== "past") return;

    const attendance = attendanceCountInRange(start, end);
    entries.push({
      key: `pay-${row?.id || idx}`,
      historyId: 0,
      canManage: false,
      rawStart: start,
      rawEnd: end,
      group,
      title: row?.plan_title || student?.plan_title || "Plan",
      range: `${fmtDate(start)} - ${fmtDate(end)}`,
      classTitle: student?.class_title || "-",
      invoiceMain: row?.id ? String(row.id) : "-",
      invoiceSub: row?.payment_date ? fmtDate(row.payment_date) : "-",
      dueDate: "-",
      attendance,
      fees: fmtCurrencyWithCode(row?.amount || 0, row?.currency || row?.plan_currency || student?.plan_currency || "USD"),
      feeTone: "paid",
      status: "Paid",
      statusTone: "paid",
    });

    seenPeriodKeys.add(key);
  });

  const renderGroup = (groupKey, title) => {
    const rows = entries.filter(e => e.group === groupKey);
    const isOpen = studentProfileState.planGroupOpen?.[groupKey] !== false;

    return `
      <div class="student-plan-group">
        <button type="button" class="student-plan-group-toggle" onclick="toggleStudentPlanGroup('${groupKey}')" aria-expanded="${isOpen ? "true" : "false"}">
          <span class="student-plan-group-caret ${isOpen ? "open" : ""}">▾</span>
          <span class="student-plan-group-title">${title} (${rows.length})</span>
        </button>
        <div class="student-plan-group-rows ${isOpen ? "" : "hidden"}">
          ${rows.length ? rows.map(e => {
            const initial = escHtml((e.title || "P").charAt(0).toUpperCase());
            return `
              <div class="student-plan-row">
                <div class="student-plan-cell plan-main">
                  <span class="student-plan-avatar">${initial}</span>
                  <span class="student-plan-main-copy">
                    <strong>${escHtml(e.title)}</strong>
                    <small>${escHtml(e.range)}</small>
                  </span>
                </div>
                <div class="student-plan-cell">${escHtml(e.classTitle || "-")}</div>
                <div class="student-plan-cell">
                  <strong>${escHtml(e.invoiceMain || "-")}</strong>
                  <small>${escHtml(e.invoiceSub || "-")}</small>
                </div>
                <div class="student-plan-cell">${escHtml(e.dueDate || "-")}</div>
                <div class="student-plan-cell">
                  <span class="student-plan-att present">${e.attendance.present}</span>
                  <span class="student-plan-att-sep">|</span>
                  <span class="student-plan-att absent">${e.attendance.absent}</span>
                </div>
                <div class="student-plan-cell student-plan-fee ${e.feeTone}">${escHtml(e.fees || "-")}</div>
                <div class="student-plan-cell student-plan-status ${escHtml(e.statusTone || "")}">${escHtml(e.status || "-")}</div>
                <div class="student-plan-cell student-plan-actions-cell">
                  ${groupKey === "current"
                    ? `<button type="button" class="student-plan-action-btn renew" onclick="renewStudentFromProfile()">Renew</button>`
                    : groupKey === "past" && e.canManage && e.historyId
                    ? `<button type="button" class="student-plan-action-btn" onclick='editStudentPastSubscription(${e.historyId}, ${JSON.stringify(e.rawStart || "")}, ${JSON.stringify(e.rawEnd || "")})'>Edit</button>
                       <button type="button" class="student-plan-action-btn danger" onclick="deleteStudentPastSubscription(${e.historyId})">Delete</button>`
                    : "-"}
                </div>
              </div>
            `;
          }).join("") : `<div class="student-plan-empty">No ${title.toLowerCase()} plans</div>`}
        </div>
      </div>
    `;
  };

  panel.innerHTML = `
    <section class="student-card student-plan-shell">
      <div class="student-plan-meta-row">
        <div class="student-plan-client-since">Client since ${escHtml(clientSince)} (${years} Yr)</div>
        <div class="student-plan-meta-actions">
          <div class="student-plan-cltv">CLTV ${totalPaid}</div>
        </div>
      </div>
      ${entries.length ? `
        <div class="student-plan-board">
          <div class="student-plan-head">
            <span>Abonnement</span>
            <span>Class</span>
            <span>Invoice no.</span>
            <span>Due Date</span>
            <span>Attendance</span>
            <span>Fees</span>
            <span>Status</span>
            <span>Action</span>
          </div>
          ${entries.some(e => e.group === "current") ? renderGroup("current", "Current") : ""}
          ${entries.some(e => e.group === "past") ? renderGroup("past", "Past") : ""}
          ${entries.some(e => e.group === "coming") ? renderGroup("coming", "Coming") : ""}
        </div>
      ` : `<div class="student-empty-state">No abonnement periods found for this student.</div>`}
    </section>
  `;
}

function toggleStudentPlanGroup(groupKey) {
  const current = studentProfileState.planGroupOpen?.[groupKey] !== false;
  studentProfileState.planGroupOpen = {
    current: studentProfileState.planGroupOpen?.current !== false,
    past: studentProfileState.planGroupOpen?.past !== false,
    coming: studentProfileState.planGroupOpen?.coming !== false,
    [groupKey]: !current,
  };
  renderStudentPlanPanel();
}

async function editStudentPastSubscription(historyId, startText, endText) {
  try {
    const sid = parseInt(studentProfileState.studentId || studentProfileState.student?.id || 0, 10);
    if (!sid || !historyId) throw new Error("Past subscription not found");

    const currentStart = String(startText || "").trim();
    const currentEnd = String(endText || "").trim();

    const newStart = window.prompt("Edit period start (YYYY-MM-DD)", currentStart);
    if (newStart === null) return;
    const newEnd = window.prompt("Edit period end (YYYY-MM-DD)", currentEnd);
    if (newEnd === null) return;

    await apiCall("students/subscription_period_update.php", "POST", {
      id: historyId,
      student_id: sid,
      sub_start: String(newStart).trim(),
      sub_end: String(newEnd).trim(),
    });

    showMsg("msg", "Past subscription updated", true);
    await loadStudentProfile();
  } catch (err) {
    showMsg("msg", err.message, false);
  }
}

async function deleteStudentPastSubscription(historyId) {
  try {
    const sid = parseInt(studentProfileState.studentId || studentProfileState.student?.id || 0, 10);
    if (!sid || !historyId) throw new Error("Past subscription not found");
    if (!confirm("Delete this past subscription period?")) return;

    await apiCall("students/subscription_period_delete.php", "POST", {
      id: historyId,
      student_id: sid,
    });

    showMsg("msg", "Past subscription deleted", true);
    await loadStudentProfile();
  } catch (err) {
    showMsg("msg", err.message, false);
  }
}

function renderStudentPendingPanel() {
  const panel = studentProfilePanel("pending");
  if (!panel) return;

  const student = studentProfileState.student;
  const invoiceRows = Array.isArray(studentProfileState.invoices) ? studentProfileState.invoices : [];

  const createdAt = student?.created_at ? new Date(String(student.created_at).replace(" ", "T")) : null;
  const now = new Date();
  const years = createdAt && !Number.isNaN(createdAt.getTime())
    ? Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / (365.25 * 24 * 60 * 60 * 1000)))
    : 0;
  const clientSince = createdAt && !Number.isNaN(createdAt.getTime())
    ? fmtDate(createdAt.toISOString().slice(0, 10))
    : "-";

  const oneTimeCount = Number(student?.one_time_plan_count || (Array.isArray(student?.one_time_plan_ids) ? student.one_time_plan_ids.length : 0) || 0);
  const oneTimeTotal = parseFloat(student?.one_time_plan_total || 0);
  const pendingSubscriptions = Array.isArray(studentProfileState.subscriptions) ? studentProfileState.subscriptions : [];
  const allPendingPlanStarts = [];
  if (student?.sub_start) allPendingPlanStarts.push(String(student.sub_start).slice(0, 10));
  pendingSubscriptions.forEach(p => { if (p?.sub_start) allPendingPlanStarts.push(String(p.sub_start).slice(0, 10)); });
  invoiceRows.forEach(r => { if (r?.sub_start) allPendingPlanStarts.push(String(r.sub_start).slice(0, 10)); });
  const firstPendingSubStart = allPendingPlanStarts.filter(Boolean).sort()[0] || "";
  const pendingPeriodTitle = subStart =>
    oneTimeCount > 0 && subStart && String(subStart).slice(0, 10) === firstPendingSubStart
      ? `${student?.plan_title || "Plan"} +${oneTimeCount}`
      : (student?.plan_title || "Plan");

  const pendingItems = invoiceRows
    .filter(row => Number(row?.receivable || 0) > 0)
    .map(row => {
      const start = String(row?.sub_start || "").slice(0, 10);
      const end = String(row?.sub_end || row?.due_date || "").slice(0, 10);
      const isFirstPeriod = oneTimeCount > 0 && oneTimeTotal > 0 && start === firstPendingSubStart;
      const amountValue = Number(row?.receivable || 0) + (isFirstPeriod ? oneTimeTotal : 0);
      const paidValue = Number(row?.paid_amount || 0);
      return {
        title: pendingPeriodTitle(start),
        range: start && end ? `${fmtDate(start)} - ${fmtDate(end)}` : "",
        dueDate: row?.due_date ? fmtDate(row.due_date) : (end ? fmtDate(end) : "-"),
        amount: fmtCurrencyWithCode(amountValue, row?.plan_currency || student?.plan_currency || "USD"),
        paid: paidValue > 0 ? fmtCurrencyWithCode(paidValue, row?.plan_currency || student?.plan_currency || "USD") : "",
        rawAmount: amountValue,
        rawStart: start,
        rawDue: end,
        invoiceLabel: row?.invoice_no ? `${row?.invoice_prefix || "INV-"}${row.invoice_no}` : "",
        invoiceDate: row?.invoice_date ? fmtDate(row.invoice_date) : "",
      };
    });

  pendingItems.sort((a, b) => String(b.rawDue || "").localeCompare(String(a.rawDue || "")));

  const hasPending = pendingItems.length > 0;
  const totalPendingAmount = pendingItems.reduce((sum, item) => sum + Number(item?.rawAmount || 0), 0);

  panel.innerHTML = `
    <section class="student-card student-pending-shell">
      <div class="student-pending-client-since">Client since ${escHtml(clientSince)} (${years} Yr)</div>

      <div class="student-pending-alert ${hasPending ? "due" : "clear"}">
        <span class="student-pending-alert-icon">!</span>
        <span class="student-pending-alert-copy">Total pending: <strong>${fmtCurrencyWithCode(totalPendingAmount, student?.plan_currency || "USD")}</strong></span>
        <span class="student-pending-alert-tools" aria-hidden="true">
          <span class="student-pending-alert-action">&#128065;</span>
          <span class="student-pending-alert-action">&#9200;</span>
        </span>
      </div>

      <div class="student-pending-board">
        <div class="student-pending-head">
          <span>Item</span>
          <span>Due date</span>
          <span>Amount</span>
        </div>

        ${pendingItems.length ? pendingItems.map(item => {
          const initial = escHtml((item.title || "P").charAt(0).toUpperCase());
          return `
            <div class="student-pending-row">
              <div class="student-pending-item">
                <span class="student-pending-avatar">${initial}</span>
                <span class="student-pending-item-copy">
                  <strong>${escHtml(item.title)}</strong>
                  ${item.range ? `<small>${escHtml(item.range)}</small>` : ""}
                  ${item.invoiceLabel ? `<small class="student-pending-invoice">${escHtml(item.invoiceLabel)}${item.invoiceDate ? ` &middot; ${escHtml(item.invoiceDate)}` : ""}</small>` : ""}
                </span>
              </div>
              <div>${escHtml(item.dueDate)}</div>
              <div class="student-pending-amount-text">
                <div class="student-pending-amount-row">
                  <strong>${escHtml(item.amount)}</strong>
                  <button type="button" class="student-pending-pay-btn" onclick='openStudentProfilePendingPaymentModal(${Number(item.rawAmount || 0)}, ${JSON.stringify(item.title || "pending item")}, ${JSON.stringify(String(item.rawStart || ""))}, ${JSON.stringify(String(item.rawDue || ""))})'>Make Payment</button>
                </div>
                ${item.paid ? `<small>Paid: ${escHtml(item.paid)}</small>` : ""}
              </div>
            </div>
          `;
        }).join("") : `<div class="student-pending-empty">No pending amount for this student.</div>`}
      </div>
    </section>
  `;
}

function nowDateTimeLocal() {
  const d = new Date();
  d.setSeconds(0, 0);
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
}

function openStudentProfilePendingPaymentModal(suggestedAmount, itemTitle, periodStart, periodEnd) {
  const modal = document.getElementById("studentPendingPaymentModal");
  const studentIdField = document.getElementById("studentPendingPaymentStudentId");
  const studentNameField = document.getElementById("studentPendingPaymentStudentName");
  const itemField = document.getElementById("studentPendingPaymentItem");
  const periodStartField = document.getElementById("studentPendingPaymentPeriodStart");
  const periodEndField = document.getElementById("studentPendingPaymentPeriodEnd");
  const amountField = document.getElementById("studentPendingPaymentAmount");
  const modeField = document.getElementById("studentPendingPaymentMode");
  const dateField = document.getElementById("studentPendingPaymentDate");
  const noteField = document.getElementById("studentPendingPaymentNote");

  if (!modal || !studentIdField || !studentNameField || !amountField || !modeField || !dateField || !noteField || !itemField || !periodStartField || !periodEndField) {
    showMsg("msg", "Payment form is not available", false);
    return;
  }

  const sid = parseInt(studentProfileState.studentId || studentProfileState.student?.id || 0, 10);
  if (!sid) {
    showMsg("msg", "Student not found", false);
    return;
  }

  const studentName = studentProfileState.student?.name || "";
  const amount = Number(suggestedAmount || 0);
  studentIdField.value = String(sid);
  studentNameField.value = studentName;
  itemField.value = itemTitle || "pending item";
  periodStartField.value = String(periodStart || "");
  periodEndField.value = String(periodEnd || "");
  amountField.value = Number.isFinite(amount) && amount > 0 ? amount.toFixed(2) : "";
  modeField.value = "cash";
  dateField.value = nowDateTimeLocal();
  noteField.value = "";

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  window.setTimeout(() => amountField.focus(), 0);
}

function closeStudentProfilePendingPaymentModal() {
  const modal = document.getElementById("studentPendingPaymentModal");
  const ids = [
    "studentPendingPaymentStudentId",
    "studentPendingPaymentStudentName",
    "studentPendingPaymentItem",
    "studentPendingPaymentPeriodStart",
    "studentPendingPaymentPeriodEnd",
    "studentPendingPaymentAmount",
    "studentPendingPaymentMode",
    "studentPendingPaymentDate",
    "studentPendingPaymentNote",
  ];

  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === "studentPendingPaymentMode") {
      el.value = "cash";
    } else {
      el.value = "";
    }
  });

  if (!modal) return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
}

function dismissStudentProfilePendingPaymentModal(event) {
  if (event && event.target === event.currentTarget) {
    closeStudentProfilePendingPaymentModal();
  }
}

async function submitStudentProfilePendingPaymentModal() {
  try {
    const sid = parseInt(document.getElementById("studentPendingPaymentStudentId")?.value || 0, 10);
    const itemTitle = document.getElementById("studentPendingPaymentItem")?.value || "pending item";
    const periodStart = String(document.getElementById("studentPendingPaymentPeriodStart")?.value || "").trim();
    const periodEnd = String(document.getElementById("studentPendingPaymentPeriodEnd")?.value || "").trim();
    const amount = parseFloat(String(document.getElementById("studentPendingPaymentAmount")?.value || "").trim());
    const paymentMode = String(document.getElementById("studentPendingPaymentMode")?.value || "cash").trim();
    const paidAt = String(document.getElementById("studentPendingPaymentDate")?.value || "").trim();
    const note = String(document.getElementById("studentPendingPaymentNote")?.value || "").trim();

    if (!sid) throw new Error("Student not found");
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be greater than 0");
    if (!paidAt) throw new Error("Payment date is required");

    await apiCall("payments/create.php", "POST", {
      student_id: sid,
      amount,
      payment_mode: paymentMode,
      paid_at: paidAt,
      note,
      period_start: periodStart,
      period_end: periodEnd,
    });
    closeStudentProfilePendingPaymentModal();
    showMsg("msg", `Payment recorded for ${itemTitle || "pending item"}`, true);
    await loadStudentProfile();
  } catch (err) {
    showMsg("msg", err.message, false);
  }
}

function renderStudentPaidPanel() {
  const panel = studentProfilePanel("paid");
  if (!panel) return;

  const student = studentProfileState.student;
  const payments = studentProfileState.payments;
  const createdAt = student?.created_at ? new Date(String(student.created_at).replace(" ", "T")) : null;
  const now = new Date();
  const years = createdAt && !Number.isNaN(createdAt.getTime())
    ? Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / (365.25 * 24 * 60 * 60 * 1000)))
    : 0;
  const clientSince = createdAt && !Number.isNaN(createdAt.getTime())
    ? fmtDate(createdAt.toISOString().slice(0, 10))
    : "-";
  const totalPaid = sumPaymentsByCurrency(payments);

  if (!payments.length) {
    panel.innerHTML = `
      <section class="student-card student-paid-shell">
        <div class="student-paid-meta-row">
          <div class="student-paid-client-since">Client since ${escHtml(clientSince)} (${years} Yr)</div>
          <div class="student-paid-total">${totalPaid}</div>
        </div>
        <div class="student-empty-state">No payments have been recorded for this student yet.</div>
      </section>
    `;
    return;
  }

  panel.innerHTML = `
    <section class="student-card student-paid-shell">
      <div class="student-paid-meta-row">
        <div class="student-paid-client-since">Client since ${escHtml(clientSince)} (${years} Yr)</div>
        <div class="student-paid-total">${totalPaid}</div>
      </div>
      <div class="student-paid-board">
        <div class="student-paid-head">
          <span>Item</span>
          <span>Paid on</span>
          <span>Amount</span>
        </div>
        ${payments.map(row => {
          const initial = escHtml((row.plan_title || "P").charAt(0).toUpperCase());
          const range = row.sub_start && row.sub_end ? `${fmtDate(row.sub_start)} - ${fmtDate(row.sub_end)}` : (row.expiry_date ? `Until ${fmtDate(row.expiry_date)}` : "");
          const paidDate = row.payment_date ? fmtDate(row.payment_date) : "-";
          const paidAmount = fmtCurrencyWithCode(row.amount || 0, row.currency || row.plan_currency || "USD");
          const txnCode = row.id ? `TID : ${row.id}` : "";

          return `
            <div class="student-paid-row">
              <div class="student-paid-item">
                <span class="student-paid-avatar">${initial}</span>
                <span class="student-paid-item-copy">
                  <strong>${escHtml(row.plan_title || "Plan")}</strong>
                  ${range ? `<small>${escHtml(range)}</small>` : ""}
                </span>
              </div>
              <div class="student-paid-date-cell">
                <strong>${escHtml(paidDate)}</strong>
                ${txnCode ? `<small>${escHtml(txnCode)}</small>` : ""}
              </div>
              <div class="student-paid-amount-cell">
                <strong>${escHtml(paidAmount)}</strong>
                <small>Payment recorded</small>
                <small>${escHtml(paidDate)}</small>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderStudentAttendancePanel() {
  const panel = studentProfilePanel("attendance");
  if (!panel) return;

  const summary = studentProfileState.attendance?.summary || {};
  const rows = studentProfileState.attendance?.rows || [];

  panel.innerHTML = `
    <section class="student-metrics-grid compact">
      ${studentProfileMetric("Sessions", String(summary.total_sessions || 0))}
      ${studentProfileMetric("Present", String(summary.present_count || 0))}
      ${studentProfileMetric("Absent", String(summary.absent_count || 0))}
      ${studentProfileMetric("Late", String(summary.late_count || 0))}
    </section>
    <section class="student-card">
      <div class="student-card-head">
        <h3>Attendance History</h3>
        <span class="student-card-meta">Rate ${Number(summary.attendance_rate || 0).toFixed(0)}%</span>
      </div>
      ${rows.length ? `
        <div class="student-table-wrap">
          <table class="plans-table student-profile-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Class</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(row => `
                <tr>
                  <td>${fmtDate(row.date)}</td>
                  <td>${escHtml(row.class_title || row.class_level || "-")}</td>
                  <td><span class="student-status-pill ${escHtml((row.status || "present").toLowerCase())}">${escHtml(row.status || "present")}</span></td>
                  <td>${escHtml(row.notes || "-")}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      ` : `<div class="student-empty-state">No attendance has been recorded for this student yet.</div>`}
    </section>
  `;
}

function renderStudentPerformancePanel() {
  const panel = studentProfilePanel("performance");
  if (!panel) return;

  const payments = studentProfileState.payments;
  const attendance = studentProfileState.attendance?.summary || {};
  const latestPayment = payments[0] || null;
  const paymentCount = payments.length;
  const rate = Number(attendance.attendance_rate || 0);
  const punctuality = attendance.total_sessions
    ? (Number(attendance.late_count || 0) / Number(attendance.total_sessions || 1)) * 100
    : 0;

  panel.innerHTML = `
    <section class="student-metrics-grid">
      ${studentProfileMetric("Attendance Rate", `${rate.toFixed(0)}%`, `${attendance.present_count || 0} present`) }
      ${studentProfileMetric("Total Sessions", String(attendance.total_sessions || 0), `${attendance.absent_count || 0} absent`) }
      ${studentProfileMetric("Payments Logged", String(paymentCount), latestPayment ? `Last ${fmtDate(latestPayment.payment_date)}` : "No payments") }
      ${studentProfileMetric("Collected", sumPaymentsByCurrency(payments), "Across recorded payments") }
    </section>
    <section class="student-card">
      <div class="student-card-head"><h3>Performance Notes</h3></div>
      <div class="student-performance-stack">
        <div class="student-progress-row">
          <span>Attendance</span>
          <div class="student-progress-track"><span style="width:${Math.max(0, Math.min(100, rate))}%"></span></div>
          <strong>${rate.toFixed(0)}%</strong>
        </div>
        <div class="student-progress-row">
          <span>Punctuality</span>
          <div class="student-progress-track"><span style="width:${Math.max(0, Math.min(100, punctuality))}%"></span></div>
          <strong>${attendance.late_count || 0} late</strong>
        </div>
      </div>
    </section>
  `;
}

function renderStudentProfilePanels() {
  renderStudentOverviewPanel();
  renderStudentItemPanel();
  renderStudentPlanPanel();
  renderStudentPendingPanel();
  renderStudentPaidPanel();
  renderStudentAttendancePanel();
  renderStudentPerformancePanel();
}

function setStudentProfileTab(tab) {
  const requestedTab = String(tab || "overview");
  const activeTab = requestedTab === "info" ? "overview" : requestedTab;
  studentProfileState.activeTab = activeTab;

  document.querySelectorAll(".student-tab").forEach(button => {
    const isActive = button.dataset.tab === activeTab;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  document.querySelectorAll(".student-panel").forEach(panel => {
    panel.classList.toggle("hidden", panel.dataset.panel !== activeTab);
  });
}

async function loadStudentProfile() {
  try {
    const studentId = parseInt(new URLSearchParams(window.location.search).get("id") || 0, 10);
    if (!studentId) {
      throw new Error("Student id is missing");
    }

    const [students, payments, attendance, subscriptions, invoices] = await Promise.all([
      apiCall("students/read.php"),
      apiCall(`payments/read.php?student_id=${studentId}`),
      apiCall(`attendance/student_history.php?student_id=${studentId}`),
      apiCall(`students/subscriptions_history.php?student_id=${studentId}`),
      apiCall("invoices/read.php"),
    ]);

    const student = (Array.isArray(students) ? students : []).find(row => parseInt(row.id, 10) === studentId);
    if (!student) {
      throw new Error("Student not found");
    }

    studentProfileState = {
      studentId,
      activeTab: studentProfileState.activeTab || "overview",
      student,
      payments: Array.isArray(payments) ? payments : [],
      invoices: (Array.isArray(invoices) ? invoices : []).filter(row => parseInt(row?.id || 0, 10) === studentId),
      subscriptions: Array.isArray(subscriptions) ? subscriptions : [],
      attendance: attendance && typeof attendance === "object"
        ? { summary: attendance.summary || {}, rows: Array.isArray(attendance.rows) ? attendance.rows : [] }
        : { summary: {}, rows: [] },
      planGroupOpen: studentProfileState.planGroupOpen || { current: true, past: true, coming: true },
    };

    const titleEl = document.getElementById("studentProfileTitle");
    const subtitleEl = document.getElementById("studentProfileSubtitle");
    if (titleEl) titleEl.textContent = student.name || "Student Profile";
    if (subtitleEl) {
      const subtitleParts = [student.plan_title || "No plan", student.class_title || "No class"];
      subtitleEl.textContent = subtitleParts.join(" • ");
    }
    document.title = `${student.name || "Student"} - Student Profile`;

    renderStudentProfilePanels();
    setStudentProfileTab(studentProfileState.activeTab);
  } catch (err) {
    showMsg("msg", err.message, false);
    const overview = studentProfilePanel("overview");
    if (overview) {
      overview.innerHTML = `<div class="student-empty-state">${escHtml(err.message || "Unable to load student profile")}</div>`;
    }
  }
}

function applyStudentSearch() {
  const input = document.getElementById("studentSearchInput");
  studentSearchQuery = (input ? input.value : "").trim().toLowerCase();
  resetListPage("students");

  if (!studentSearchQuery) {
    renderStudents(allStudentsRows);
    return;
  }

  const filtered = allStudentsRows.filter(s => {
    const haystack = [
      s.name,
      s.class_title,
      s.class_level,
      s.level,
      s.phone,
      s.email,
      s.plan_title,
    ]
      .map(v => String(v || "").toLowerCase())
      .join(" ");
    return haystack.includes(studentSearchQuery);
  });

  renderStudents(filtered);
}

async function loadStudents() {
  allStudentsRows = await apiCall("students/read.php");
  resetListPage("students");
  applyStudentSearch();
}

async function openStudentForm(student) {
  try {
    student = student || null;
    const isEdit = student && student.id;
    document.getElementById("studentFormTitle").textContent = isEdit ? "Edit Student" : "Add Student";
    document.getElementById("studentSubmitBtn").textContent = isEdit ? "Update Student" : "Save Student";
    document.getElementById("studentId").value         = isEdit ? (student.id            || "") : "";
    document.getElementById("studentName").value        = isEdit ? (student.name          || "") : "";
    document.getElementById("studentGender").value      = isEdit ? (student.gender        || "") : "";
    document.getElementById("studentDob").value         = isEdit ? (student.date_of_birth || "") : "";
    document.getElementById("studentEmail").value       = isEdit ? (student.email         || "") : "";
    document.getElementById("studentPhone").value       = isEdit ? (student.phone         || "") : "";
    document.getElementById("studentPhoneCode").value   = isEdit ? (student.phone_code    || "+355") : "+355";
    document.getElementById("studentLevel").value       = isEdit ? (student.level         || "") : "";
    document.getElementById("studentSubStart").value    = isEdit ? (student.sub_start     || "") : "";
    document.getElementById("studentSubEnd").value      = isEdit ? (student.sub_end       || "") : "";
    document.getElementById("studentAutorenew").checked = isEdit ? (!!parseInt(student.autorenew)) : false;
    document.getElementById("studentInvoiceDate").value   = isEdit ? (student.invoice_date   || "") : new Date().toISOString().slice(0,10);
    document.getElementById("studentInvoicePrefix").value = isEdit ? (student.invoice_prefix || "") : "";
    document.getElementById("studentInvoiceNo").value     = isEdit ? (student.invoice_no     || "") : "";

    // radio: plan type
    const planType = isEdit ? (student.plan_type || "subscription") : "subscription";
    document.querySelectorAll('input[name="studentPlanType"]').forEach(r => { r.checked = r.value === planType; });

    // photo
    const preview = document.getElementById("studentPhotoPreview");
    const icon    = document.getElementById("studentPhotoIcon");
    const photoVal = isEdit ? (student.photo || "") : "";
    document.getElementById("studentPhoto").value = photoVal;
    if (photoVal) { preview.src = photoVal; preview.style.display = ""; icon.style.display = "none"; }
    else          { preview.src = ""; preview.style.display = "none"; icon.style.display = ""; }

    const selectedOneTimePlanIds = isEdit
      ? (Array.isArray(student.one_time_plan_ids) && student.one_time_plan_ids.length
          ? student.one_time_plan_ids
          : (student.one_time_plan_id ? [student.one_time_plan_id] : []))
      : [];

    await Promise.all([
      loadClassesIntoStudentSelect(isEdit ? (student.class_id || "") : ""),
      loadPlansIntoStudentSelect(planType, isEdit ? (student.plan_id || "") : ""),
      loadOneTimePlansIntoSelect(selectedOneTimePlanIds),
    ]);
    updateStudentAmountDisplay();

    const modal = document.getElementById("studentFormModal");
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    modal.scrollTop = 0;
  } catch (err) {
    showMsg("msg", "Error opening student form: " + err.message, false);
  }
}

function closeStudentForm() {
  const modal = document.getElementById("studentFormModal");
  if (!modal) return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
}

async function loadClassesIntoStudentSelect(selectedId) {
  try {
    selectedId = selectedId || "";
    const sel = document.getElementById("studentClassId");
    if (!sel) return;
    const rows = await apiCall("classes/read.php");
    sel._classData = {};
    sel.innerHTML = "<option value=''>Select class</option>";
    rows.forEach(r => {
      sel._classData[String(r.id)] = r;
      sel.innerHTML += `<option value="${r.id}" ${String(r.id) === String(selectedId) ? 'selected' : ''}>${escHtml(r.title)}</option>`;
    });
  } catch (err) {
    console.error("Error loading classes:", err);
    throw err;
  }
}

async function loadPlansIntoStudentSelect(planType, selectedId) {
  try {
    planType   = planType   || "subscription";
    selectedId = selectedId || "";
    const sel = document.getElementById("studentPlanId");
    if (!sel) return;
    const result = await apiCall("plans/read.php?type=" + encodeURIComponent(planType));
    const plans = (result && result.plans) || [];
    sel._planData = {};
    sel.innerHTML = "<option value=''>Select plan</option>";
    plans.forEach(p => {
      sel._planData[String(p.id)] = p;
      const currencySymbol = planCurrencySymbol(p.currency);
      const label = `${escHtml(p.title)} &ndash; ${currencySymbol}${parseFloat(p.amount).toFixed(2)}`;
      sel.innerHTML += `<option value="${p.id}" ${String(p.id) === String(selectedId) ? 'selected' : ''}>${label}</option>`;
    });
    updateStudentAmountDisplay();
  } catch (err) {
    console.error("Error loading plans:", err);
    throw err;
  }
}

async function loadOneTimePlansIntoSelect(selectedIds) {
  try {
    selectedIds = Array.isArray(selectedIds)
      ? selectedIds.map(v => String(v))
      : (selectedIds ? [String(selectedIds)] : []);
    const sel = document.getElementById("studentOneTimePlan");
    if (!sel) return;
    const result = await apiCall("plans/read.php?type=one-time");
    const plans = (result && result.plans) || [];
    sel.innerHTML = "";
    plans.forEach(p => {
      const idStr = String(p.id);
      const currencySymbol = planCurrencySymbol(p.currency);
      sel.innerHTML += `<option value="${p.id}" ${selectedIds.includes(idStr) ? 'selected' : ''}>${escHtml(p.title)} &ndash; ${currencySymbol}${parseFloat(p.amount).toFixed(2)}</option>`;
    });
  } catch (err) {
    console.error("Error loading one-time plans:", err);
    throw err;
  }
}

function updateStudentAmountDisplay() {
  const planSel  = document.getElementById("studentPlanId");
  const amountEl = document.getElementById("studentAmountText");
  if (!planSel || !amountEl) return;
  const plan = planSel._planData && planSel._planData[String(planSel.value)];
  if (!plan) {
    amountEl.textContent = "CDF 0.00";
    return;
  }
  amountEl.textContent = `${planCurrencySymbol(plan.currency)}${parseFloat(plan.amount || 0).toFixed(2)}`;
}

function onStudentPlanTypeChange() {
  const planType = (document.querySelector('input[name="studentPlanType"]:checked') || {}).value || "subscription";
  const curSel   = document.getElementById("studentPlanId");
  const curId    = curSel ? curSel.value : "";
  loadPlansIntoStudentSelect(planType, curId);
}

function onStudentPhotoChange(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const preview = document.getElementById("studentPhotoPreview");
    const icon    = document.getElementById("studentPhotoIcon");
    document.getElementById("studentPhoto").value = e.target.result;
    preview.src = e.target.result;
    preview.style.display = "";
    icon.style.display = "none";
  };
  reader.readAsDataURL(file);
}

function onStudentClassChange() {
  const sel = document.getElementById("studentClassId");
  const planSel = document.getElementById("studentPlanId");
  if (!sel || !planSel) return;
  const cls = sel._classData && sel._classData[String(sel.value)];
  if (cls && cls.plan_id) {
    planSel.value = String(cls.plan_id);
    onStudentSubStartChange();
  }
  updateStudentAmountDisplay();
}

function onStudentPlanChange() {
  updateStudentAmountDisplay();
  onStudentSubStartChange();
}

function onStudentSubStartChange() {
  const subStartEl = document.getElementById("studentSubStart");
  const subEndEl   = document.getElementById("studentSubEnd");
  const planSel    = document.getElementById("studentPlanId");
  if (!subStartEl || !subStartEl.value) return;
  const plan = planSel && planSel._planData && planSel._planData[String(planSel.value)];
  if (!plan) return;
  const cycle = plan.billing_cycle || '1 Month';
  const parts  = cycle.trim().split(' ');
  const num    = parseInt(parts[0]) || 1;
  const unit   = (parts[1] || 'Month').toLowerCase();
  const start  = new Date(subStartEl.value + 'T00:00:00');
  const end    = new Date(start);

  if (unit.startsWith('month')) {
    // Calendar-month rule: end on the last day of the covered month range.
    // Set day=1 before shifting month to avoid overflow for 29/30/31 starts.
    end.setDate(1);
    end.setMonth(start.getMonth() + num);
    end.setDate(0);
  } else if (unit.startsWith('week')) {
    end.setDate(end.getDate() + num * 7 - 1);
  } else {
    end.setDate(end.getDate() + num - 1);
  }
  const y = end.getFullYear();
  const m = String(end.getMonth() + 1).padStart(2, '0');
  const d = String(end.getDate()).padStart(2, '0');
  subEndEl.value = `${y}-${m}-${d}`;
}

async function submitStudentForm() {
  try {
    const id               = parseInt(document.getElementById("studentId").value, 10) || 0;
    const name             = document.getElementById("studentName").value.trim();
    const gender           = document.getElementById("studentGender").value.trim();
    const date_of_birth    = document.getElementById("studentDob").value.trim();
    const email            = document.getElementById("studentEmail").value.trim();
    const phone_code       = document.getElementById("studentPhoneCode").value.trim();
    const phone            = document.getElementById("studentPhone").value.trim();
    const level            = document.getElementById("studentLevel").value.trim();
    const class_id         = parseInt(document.getElementById("studentClassId").value, 10) || 0;
    const plan_id          = parseInt(document.getElementById("studentPlanId").value, 10)  || 0;
    const oneTimeSel        = document.getElementById("studentOneTimePlan");
    const one_time_plan_ids = oneTimeSel
      ? Array.from(oneTimeSel.selectedOptions)
          .map(o => parseInt(o.value, 10))
          .filter(v => Number.isInteger(v) && v > 0)
      : [];
    const one_time_plan_id  = one_time_plan_ids.length ? one_time_plan_ids[0] : 0;
    const plan_type        = (document.querySelector('input[name="studentPlanType"]:checked') || {}).value || "subscription";
    const autorenew        = document.getElementById("studentAutorenew").checked ? 1 : 0;
    const sub_start        = document.getElementById("studentSubStart").value;
    const sub_end          = document.getElementById("studentSubEnd").value;
    const invoice_date     = document.getElementById("studentInvoiceDate").value;
    const invoice_prefix   = document.getElementById("studentInvoicePrefix").value.trim();
    const invoice_no       = document.getElementById("studentInvoiceNo").value;
    const photo            = document.getElementById("studentPhoto").value;

    if (!name) throw new Error("Name is required");
    if (!invoice_date) {
      document.getElementById("studentInvoiceDateErr").style.display = "";
      throw new Error("Invoice Date is required");
    }
    document.getElementById("studentInvoiceDateErr").style.display = "none";

    const payload = {
      name, gender, date_of_birth, email, phone_code, phone, level,
      class_id, plan_id, one_time_plan_id, one_time_plan_ids, plan_type, autorenew,
      sub_start, sub_end,
      invoice_date, invoice_prefix, invoice_no,
      photo
    };
    
    if (id) {
      await apiCall("students/update.php", "POST", { id, ...payload });
      showMsg("msg", "Student updated", true);
    } else {
      await apiCall("students/create.php", "POST", payload);
      showMsg("msg", "Student added", true);
    }
    closeStudentForm();
    await loadStudents();
  } catch (err) {
    showMsg("msg", err.message, false);
  }
}

async function deleteStudentById(id) {
  try {
    if (!confirm("Delete this student?")) return;
    await apiCall("students/delete.php", "POST", { id });
    showMsg("msg", "Student deleted", true);
    await loadStudents();
  } catch (err) {
    showMsg("msg", err.message, false);
  }
}

function getPaymentsTab() {
  return new URLSearchParams(window.location.search).get("tab") || "invoices";
}

function dueDateFilterMatch(row, mode) {
  if (mode === "all") return true;
  const dueRaw = row.due_date || row.sub_end || "";
  if (!dueRaw) return false;

  const due = new Date(`${dueRaw}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (mode === "overdue") return due < today;
  if (mode === "today") return due.getTime() === today.getTime();
  if (mode === "this_week") {
    const end = new Date(today);
    end.setDate(today.getDate() + 6);
    return due >= today && due <= end;
  }

  return true;
}

function configurePaymentsView(tab) {
  const title = document.getElementById("paymentsListTitle");
  const recordSection = document.getElementById("paymentRecordSection");
  const historyFilters = document.getElementById("paymentHistoryFilters");
  const studentFilterWrap = document.getElementById("paymentStudentFilterWrap");
  const filterBtnWrap = document.getElementById("paymentFilterBtnWrap");
  const searchWrap = document.getElementById("paymentSearchWrap");
  const searchBtnWrap = document.getElementById("paymentSearchBtnWrap");
  const pendingToolbar = document.getElementById("pendingToolbar");
  const headRow = document.getElementById("paymentsHeadRow");
  if (!headRow) return;

  if (tab === "pending") {
    if (title) title.textContent = "Pending Payment";
    if (recordSection) recordSection.classList.add("hidden");
    if (historyFilters) historyFilters.classList.add("hidden");
    if (studentFilterWrap) studentFilterWrap.classList.remove("hidden");
    if (filterBtnWrap) filterBtnWrap.classList.remove("hidden");
    if (searchWrap) searchWrap.classList.add("hidden");
    if (searchBtnWrap) searchBtnWrap.classList.add("hidden");
    if (pendingToolbar) pendingToolbar.classList.remove("hidden");
    headRow.innerHTML = "<th><input type='checkbox' aria-label='Select all pending invoices'></th><th>Name</th><th>Plan</th><th>Due date</th><th>Amount</th><th>Action</th>";
    return;
  }

  if (tab === "received") {
    if (title) title.textContent = "Received Payment";
    if (recordSection) recordSection.classList.remove("hidden");
    if (historyFilters) historyFilters.classList.remove("hidden");
    if (studentFilterWrap) studentFilterWrap.classList.add("hidden");
    if (filterBtnWrap) filterBtnWrap.classList.add("hidden");
    if (searchWrap) searchWrap.classList.remove("hidden");
    if (searchBtnWrap) searchBtnWrap.classList.remove("hidden");
    const searchInput = document.getElementById("paymentSearchInput");
    if (searchInput) {
      searchInput.placeholder = "Search received payments by student, plan, invoice...";
    }
    if (pendingToolbar) pendingToolbar.classList.add("hidden");
    headRow.innerHTML = "<th><input type='checkbox' aria-label='Select all received payments'></th><th>Name</th><th>Plan</th><th>Date</th><th>Amount</th>";
    return;
  }

  if (title) title.textContent = "Invoices";
  if (recordSection) recordSection.classList.remove("hidden");
  if (historyFilters) historyFilters.classList.remove("hidden");
  if (studentFilterWrap) studentFilterWrap.classList.add("hidden");
  if (filterBtnWrap) filterBtnWrap.classList.add("hidden");
  if (searchWrap) searchWrap.classList.remove("hidden");
  if (searchBtnWrap) searchBtnWrap.classList.remove("hidden");
  const searchInput = document.getElementById("paymentSearchInput");
  if (searchInput) {
    searchInput.placeholder = "Search invoices by student, plan, invoice...";
  }
  if (pendingToolbar) pendingToolbar.classList.add("hidden");
  headRow.innerHTML = "<th><input type='checkbox' aria-label='Select all invoices'></th><th>Name</th><th>Invoice date</th><th>Invoice no</th><th>Description</th><th>Due Date</th><th>Amount</th><th>Balance Due</th>";
}

async function loadPayments(studentId = 0) {
  const tab = getPaymentsTab();
  setListRenderer("payments", () => loadPayments(studentId));
  configurePaymentsView(tab);
  const tb = document.getElementById("paymentsTable");
  if (!tb) return;
  tb.innerHTML = "";

  if (tab === "received") {
    const searchQuery = String(document.getElementById("paymentSearchInput")?.value || "").trim().toLowerCase();
    const rows = await apiCall("invoices/read.php");
    const filteredRows = (studentId > 0
      ? rows.filter(r => parseInt(r.id, 10) === parseInt(studentId, 10))
      : rows)
      .filter(r => parseFloat(r.paid_amount || 0) > 0)
      .filter(r => {
        if (!searchQuery) return true;
        const invoiceNo = `${r.invoice_prefix || "INV-"}${r.invoice_no ? String(r.invoice_no) : ""}`;
        const haystack = [r.name, r.plan_title, r.class_title, invoiceNo, r.sub_start, r.sub_end, r.last_payment_date]
          .map(v => String(v || "").toLowerCase())
          .join(" ");
        return haystack.includes(searchQuery);
      });
    if (filteredRows.length === 0) {
      tb.innerHTML = "<tr><td colspan='5' style='text-align:center'>No received payments found</td></tr>";
      renderListPagination("payments", tb, 0);
      return;
    }

    const pagedRows = getPagedRows("payments", filteredRows);
    pagedRows.forEach(r => {
      const first = (r.name || "?").trim().charAt(0).toUpperCase() || "?";
      const planName = r.plan_title || "-";
      const planRange = (r.sub_start && r.sub_end) ? `${fmtDate(r.sub_start)} - ${fmtDate(r.sub_end)}` : "";
      const paymentDate = r.last_payment_date ? fmtDate(r.last_payment_date) : "-";
      const amount = fmtCurrencyWithCode(r.paid_amount || 0, r.plan_currency || "USD");
      const tid = `${r.invoice_prefix || "INV-"}${r.invoice_no ? String(r.invoice_no) : ""}`;

      tb.innerHTML += `<tr>
        <td><input type="checkbox" aria-label="Select payment ${escHtml(r.name || "")}"></td>
        <td>
          <div class="received-name-cell">
            <span class="received-avatar">${escHtml(first)}</span>
            <div class="received-name-info">
              <div class="received-name-text"><button type="button" class="name-profile-link" onclick="openStudentProfile(${parseInt(r.id,10)||0})">${escHtml(r.name || "-")}</button></div>
              <div class="received-name-tid">${escHtml(tid)}</div>
            </div>
          </div>
        </td>
        <td>
          <div class="received-plan-main">${escHtml(planName)}</div>
          <div class="received-plan-dates">${escHtml(planRange)}</div>
        </td>
        <td>${paymentDate}</td>
        <td class="received-amount">
          <div class="received-amount-value">${amount}</div>
          <div class="received-amount-method">Cash</div>
        </td>
      </tr>`;
    });
    renderListPagination("payments", tb, filteredRows.length);
    return;
  }

  const rows = await apiCall("invoices/read.php");
  let filteredRows = studentId > 0
    ? rows.filter(r => parseInt(r.id, 10) === parseInt(studentId, 10))
    : rows;

  if (tab === "pending") {
    const mode = (document.getElementById("pendingStatusFilter")?.value || "all").toLowerCase();
    const searchQuery = String(document.getElementById("pendingSearchInput")?.value || "").trim().toLowerCase();
    filteredRows = filteredRows
      .filter(r => parseFloat(r.receivable || 0) > 0)
      .map(r => ({ ...r, pending_due_amount: parseFloat(r.receivable || 0), pending_source: "invoice" }))
      .filter(r => dueDateFilterMatch(r, mode))
      .filter(r => {
        if (!searchQuery) return true;
        const invoiceNo = `${r.invoice_prefix || "INV-"}${r.invoice_no ? String(r.invoice_no) : ""}`;
        const haystack = [
          r.name,
          r.plan_title,
          r.class_title,
          invoiceNo,
          r.sub_start,
          r.sub_end,
          r.due_date,
        ]
          .map(v => String(v || "").toLowerCase())
          .join(" ");
        return haystack.includes(searchQuery);
      });
  } else {
    const searchQuery = String(document.getElementById("paymentSearchInput")?.value || "").trim().toLowerCase();
    filteredRows = filteredRows.filter(r => {
      if (!searchQuery) return true;
      const invoiceNo = `${r.invoice_prefix || "INV-"}${r.invoice_no ? String(r.invoice_no) : ""}`;
      const haystack = [
        r.name,
        r.plan_title,
        r.class_title,
        invoiceNo,
        r.sub_start,
        r.sub_end,
        r.invoice_date,
      ]
        .map(v => String(v || "").toLowerCase())
        .join(" ");
      return haystack.includes(searchQuery);
    });
  }

  if (filteredRows.length === 0) {
    tb.innerHTML = tab === "pending"
      ? "<tr><td colspan='5' style='text-align:center'>No pending payments found</td></tr>"
      : "<tr><td colspan='8' style='text-align:center'>No invoices found</td></tr>";

    const summary = document.getElementById("pendingSummary");
    if (summary && tab === "pending") {
      const currencyCode = rows && rows.length > 0 ? (rows[0].plan_currency || 'CDF') : 'CDF';
      summary.textContent = `Total: ${fmtCurrencyWithCode(0, currencyCode)} | 0 Pending`;
    }
    renderListPagination("payments", tb, 0);
    return;
  }

  const pagedRows = getPagedRows("payments", filteredRows);

  if (tab === "pending") {
    let pendingTotal = 0;

    filteredRows.forEach(r => {
      pendingTotal += parseFloat((r.pending_due_amount ?? r.receivable) || 0);
    });

    pagedRows.forEach(r => {
      const dueDate = r.due_date ? fmtDate(r.due_date) : (r.sub_end ? fmtDate(r.sub_end) : "-");
      const amountValue = parseFloat((r.pending_due_amount ?? r.receivable) || 0);
      const amount = fmtCurrencyWithCode(amountValue, r.plan_currency);
      const planName = r.plan_title || r.class_title || "-";
      const planRange = (r.sub_start && r.sub_end) ? `${fmtDate(r.sub_start)} - ${fmtDate(r.sub_end)}` : "";
      const first = (r.name || "?").trim().charAt(0).toUpperCase() || "?";

      tb.innerHTML += `<tr>
        <td><input type="checkbox" aria-label="Select pending payment ${escHtml(r.name || "")}"></td>
        <td>
          <div class="pending-name-cell">
            <span class="pending-avatar">${escHtml(first)}</span>
            <span class="pending-name-text"><button type="button" class="name-profile-link" onclick="openStudentProfile(${parseInt(r.id,10)||0})">${escHtml(r.name || "-")}</button></span>
          </div>
        </td>
        <td>
          <div class="pending-plan-main">${escHtml(planName)}</div>
          <div class="pending-plan-dates">${escHtml(planRange)}</div>
          ${r.pending_source === "invoice" ? `<div class="pending-plan-dates">Invoice</div>` : ""}
        </td>
        <td>${dueDate}</td>
        <td class="pending-amount">${amount}</td>
        <td>
          <button
            type="button"
            class="pending-pay-btn"
            onclick='quickRecordPendingPayment(${Number(r.id) || 0}, ${Number.isFinite(amountValue) ? amountValue : 0}, ${JSON.stringify(r.name || "")}, ${JSON.stringify(String(r.sub_start || ""))}, ${JSON.stringify(String(r.sub_end || ""))})'
          >
            <span class="pending-pay-btn-icon" aria-hidden="true">&#128181;</span>
            <span>Make Payment</span>
          </button>
        </td>
      </tr>`;
    });

    const summary = document.getElementById("pendingSummary");
    if (summary) {
      const currencyCode = filteredRows.length > 0 ? filteredRows[0].plan_currency : 'CDF';
      summary.textContent = `Total: ${fmtCurrencyWithCode(pendingTotal, currencyCode)} | ${filteredRows.length} Pending`;
    }
    renderListPagination("payments", tb, filteredRows.length);
    return;
  }

  pagedRows.forEach(r => {
    const invoiceDate = r.invoice_date ? fmtDate(r.invoice_date) : "-";
    const invoiceNo = `${r.invoice_prefix || ""}${r.invoice_no ? String(r.invoice_no) : ""}` || "-";
    const description = r.plan_title || r.class_title || "-";
    const dueDate = r.due_date ? fmtDate(r.due_date) : (r.sub_end ? fmtDate(r.sub_end) : "-");
    const amount = fmtCurrencyWithCode(r.plan_amount || 0, r.plan_currency);
    const balanceDue = fmtCurrencyWithCode(r.receivable || 0, r.plan_currency);

    tb.innerHTML += `<tr>
      <td><input type="checkbox" aria-label="Select invoice ${escHtml(r.name || "")}"></td>
      <td><button type="button" class="name-profile-link" onclick="openStudentProfile(${parseInt(r.id,10)||0})">${escHtml(r.name || "-")}</button></td>
      <td>${invoiceDate}</td>
      <td>${escHtml(invoiceNo)}</td>
      <td>${escHtml(description)}</td>
      <td>${dueDate}</td>
      <td>${amount}</td>
      <td>${balanceDue}</td>
    </tr>`;
  });
  renderListPagination("payments", tb, filteredRows.length);
}

async function filterPayments() {
  const studentId = parseInt(document.getElementById("filterStudent")?.value || 0, 10);
  resetListPage("payments");
  await loadPayments(studentId);
}

async function filterPaymentsBySearch() {
  resetListPage("payments");
  await loadPayments(0);
}

async function resetPaymentsFilters() {
  const studentSel = document.getElementById("filterStudent");
  const searchInput = document.getElementById("paymentSearchInput");
  if (studentSel) studentSel.value = "";
  if (searchInput) searchInput.value = "";
  resetListPage("payments");
  await loadPayments(0);
}

async function filterPendingPayments() {
  const studentId = parseInt(document.getElementById("filterStudent")?.value || 0, 10);
  resetListPage("payments");
  await loadPayments(studentId);
}

async function createPayment() {
  try {
    const student_id = parseInt(document.getElementById("paymentStudent")?.value || 0, 10);
    const amount = parseFloat(document.getElementById("paymentAmount")?.value || 0);
    if (!student_id) throw new Error("Select a student");
    if (amount <= 0) throw new Error("Amount must be greater than 0");
    await apiCall("payments/create.php", "POST", { student_id, amount });
    const paymentAmount = document.getElementById("paymentAmount");
    if (paymentAmount) paymentAmount.value = "";
    showMsg("msg", "Payment recorded", true);
    await loadPayments();
  } catch (err) {
    showMsg("msg", err.message, false);
  }
}

async function quickRecordPendingPayment(studentId, suggestedAmount, studentName, periodStart, periodEnd) {
  const modal = document.getElementById("pendingPaymentModal");
  const studentIdField = document.getElementById("pendingPaymentStudentId");
  const periodStartField = document.getElementById("pendingPaymentPeriodStart");
  const periodEndField = document.getElementById("pendingPaymentPeriodEnd");
  const studentNameField = document.getElementById("pendingPaymentStudentName");
  const amountField = document.getElementById("pendingPaymentAmount");
  const modeField = document.getElementById("pendingPaymentMode");
  const dateField = document.getElementById("pendingPaymentDate");
  const noteField = document.getElementById("pendingPaymentNote");

  if (!modal || !studentIdField || !periodStartField || !periodEndField || !studentNameField || !amountField || !modeField || !dateField || !noteField) {
    showMsg("msg", "Payment modal is not available", false);
    return;
  }

  studentIdField.value = String(parseInt(studentId || 0, 10));
  periodStartField.value = String(periodStart || "");
  periodEndField.value = String(periodEnd || "");
  studentNameField.value = studentName || "";
  amountField.value = Number.isFinite(Number(suggestedAmount)) && Number(suggestedAmount) > 0
    ? String(Number(suggestedAmount))
    : "";
  modeField.value = "cash";
  dateField.value = nowDateTimeLocal();
  noteField.value = "";

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  window.setTimeout(() => amountField.focus(), 0);
}

function closePendingPaymentModal() {
  const modal = document.getElementById("pendingPaymentModal");
  const studentIdField = document.getElementById("pendingPaymentStudentId");
  const periodStartField = document.getElementById("pendingPaymentPeriodStart");
  const periodEndField = document.getElementById("pendingPaymentPeriodEnd");
  const studentNameField = document.getElementById("pendingPaymentStudentName");
  const amountField = document.getElementById("pendingPaymentAmount");
  const modeField = document.getElementById("pendingPaymentMode");
  const dateField = document.getElementById("pendingPaymentDate");
  const noteField = document.getElementById("pendingPaymentNote");

  if (studentIdField) studentIdField.value = "";
  if (periodStartField) periodStartField.value = "";
  if (periodEndField) periodEndField.value = "";
  if (studentNameField) studentNameField.value = "";
  if (amountField) amountField.value = "";
  if (modeField) modeField.value = "cash";
  if (dateField) dateField.value = "";
  if (noteField) noteField.value = "";
  if (!modal) return;

  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
}

function dismissPendingPaymentModal(event) {
  if (event && event.target === event.currentTarget) {
    closePendingPaymentModal();
  }
}

async function submitPendingPaymentModal() {
  try {
    const sid = parseInt(document.getElementById("pendingPaymentStudentId")?.value || 0, 10);
    const periodStart = String(document.getElementById("pendingPaymentPeriodStart")?.value || "").trim();
    const periodEnd = String(document.getElementById("pendingPaymentPeriodEnd")?.value || "").trim();
    const studentName = document.getElementById("pendingPaymentStudentName")?.value || "student";
    const amount = parseFloat(document.getElementById("pendingPaymentAmount")?.value || 0);
    const paymentMode = String(document.getElementById("pendingPaymentMode")?.value || "cash").trim();
    const paidAt = String(document.getElementById("pendingPaymentDate")?.value || "").trim();
    const note = String(document.getElementById("pendingPaymentNote")?.value || "").trim();

    if (!sid) throw new Error("Invalid student selected");
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be greater than 0");
    if (!paidAt) throw new Error("Payment date is required");

    await apiCall("payments/create.php", "POST", {
      student_id: sid,
      amount,
      payment_mode: paymentMode,
      paid_at: paidAt,
      note,
      period_start: periodStart,
      period_end: periodEnd,
    });
    closePendingPaymentModal();
    showMsg("msg", `Payment recorded for ${studentName || "student"}`, true);

    const currentStudentId = parseInt(document.getElementById("filterStudent")?.value || 0, 10);
    await loadPayments(currentStudentId);
  } catch (err) {
    showMsg("msg", err.message, false);
  }
}

function todayIso() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function expenseMethodLabel(method) {
  if (method === "mobile_money") return "Mobile Money";
  if (method === "bank") return "Bank";
  return "Cash";
}

function populateExpenseCategorySelects(categories) {
  allExpenseCategories = Array.isArray(categories) ? categories : [];
  const createSel = document.getElementById("expenseCategory");
  const filterSel = document.getElementById("expenseFilterCategory");
  const topSel = document.getElementById("expenseTopCategoryFilter");
  const editSel = document.getElementById("editExpenseCategory");

  if (createSel) {
    createSel.innerHTML = "<option value=''>Select category</option>";
    allExpenseCategories.forEach(c => {
      createSel.innerHTML += `<option value="${c.id}">${escHtml(c.name)}</option>`;
    });
  }

  if (filterSel) {
    filterSel.innerHTML = "<option value=''>All categories</option>";
    allExpenseCategories.forEach(c => {
      filterSel.innerHTML += `<option value="${c.id}">${escHtml(c.name)}</option>`;
    });
  }

  if (topSel) {
    topSel.innerHTML = "<option value=''>All categories</option>";
    allExpenseCategories.forEach(c => {
      topSel.innerHTML += `<option value="${c.id}">${escHtml(c.name)}</option>`;
    });
  }

  if (editSel) {
    editSel.innerHTML = "<option value=''>Select category</option>";
    allExpenseCategories.forEach(c => {
      editSel.innerHTML += `<option value="${c.id}">${escHtml(c.name)}</option>`;
    });
  }

  if (filterSel && topSel) {
    topSel.value = filterSel.value || "";
  }
}

function syncExpenseCategoryFilters(source) {
  const filterSel = document.getElementById("expenseFilterCategory");
  const topSel = document.getElementById("expenseTopCategoryFilter");
  if (!filterSel && !topSel) return;

  let selectedValue = "";
  if (source === "top") selectedValue = topSel?.value || "";
  else selectedValue = filterSel?.value || "";

  if (filterSel) filterSel.value = selectedValue;
  if (topSel) topSel.value = selectedValue;

  const labelEl = document.getElementById("expTopCategory");
  const selectedCategory = allExpenseCategories.find(c => String(c.id) === String(selectedValue));
  if (labelEl) labelEl.textContent = selectedCategory ? selectedCategory.name : "All Categories";

  resetListPage("expenses");
  loadExpenses();
}

async function loadExpenseCategories() {
  const rows = await apiCall("expenses/categories_read.php");
  populateExpenseCategorySelects(rows);
}

async function addExpenseCategory() {
  try {
    const input = document.getElementById("expenseNewCategory");
    const name = (input && input.value ? input.value : "").trim();
    if (!name) throw new Error("Category name is required");
    await apiCall("expenses/categories_create.php", "POST", { name });
    if (input) input.value = "";
    await loadExpenseCategories();
    showMsg("msg", "Category saved", true);
  } catch (err) {
    showMsg("msg", err.message, false);
  }
}

async function loadExpenseSummary() {
  const monthInput = document.getElementById("expenseSummaryMonth");
  const currencyInput = document.getElementById("expenseSummaryCurrency");
  const selectedMonth = (monthInput?.value || "").trim();
  const selectedCurrency = (currencyInput?.value || "").trim().toUpperCase();
  const query = new URLSearchParams();
  if (/^\d{4}-\d{2}$/.test(selectedMonth)) {
    query.set("month", selectedMonth);
  }
  if (selectedCurrency === "USD" || selectedCurrency === "CDF") {
    query.set("currency", selectedCurrency);
  }
  const summary = await apiCall(`expenses/summary.php${query.toString() ? "?" + query.toString() : ""}`);
  const monthEl = document.getElementById("expTotalMonth");
  const todayEl = document.getElementById("expTotalToday");
  const topCatEl = document.getElementById("expTopCategory");
  const topCatTotalEl = document.getElementById("expTopCategoryTotal");
  const topFilterSel = document.getElementById("expenseTopCategoryFilter");
  const reportCurrency = summary.report_currency || "USD";

  if (monthEl) monthEl.textContent = fmtCurrencyWithCode(summary.total_month || 0, reportCurrency);
  if (todayEl) {
    if (selectedCurrency === "USD" || selectedCurrency === "CDF") {
      todayEl.textContent = fmtCurrencyWithCode(summary.total_today || 0, reportCurrency);
    } else {
      todayEl.textContent = "All Currencies";
    }
  }
  if (topCatEl) {
    if (topFilterSel) {
      const selectedValue = topFilterSel.value || "";
      const selectedCategory = allExpenseCategories.find(c => String(c.id) === String(selectedValue));
      topCatEl.textContent = selectedCategory ? selectedCategory.name : "All Categories";
    } else {
      topCatEl.textContent = summary.top_category || "-";
    }
  }
  if (topCatTotalEl) {
    if (topFilterSel) {
      topCatTotalEl.textContent = "Showing selected category expenses";
    } else {
      topCatTotalEl.textContent = fmtCurrencyWithCode(summary.top_category_total || 0, reportCurrency);
    }
  }
}

function getSelectedExpenseCurrency() {
  const currencyInput = document.getElementById("expenseSummaryCurrency");
  const currency = (currencyInput?.value || "").trim().toUpperCase();
  return currency === "USD" || currency === "CDF" ? currency : "";
}

function monthRangeFromInput(monthValue) {
  if (!/^\d{4}-\d{2}$/.test(String(monthValue || ""))) {
    return { from: "", to: "" };
  }
  const [yearText, monthText] = String(monthValue).split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return { from: "", to: "" };
  }

  const first = new Date(year, monthIndex, 1);
  const last = new Date(year, monthIndex + 1, 0);
  const from = `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, "0")}-${String(first.getDate()).padStart(2, "0")}`;
  const to = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
  return { from, to };
}

function applySelectedExpenseMonthToFilters() {
  const monthInput = document.getElementById("expenseSummaryMonth");
  const fromEl = document.getElementById("expenseFilterFrom");
  const toEl = document.getElementById("expenseFilterTo");
  if (!monthInput || !fromEl || !toEl) return;

  const { from, to } = monthRangeFromInput(monthInput.value || "");
  if (!from || !to) return;

  fromEl.value = from;
  toEl.value = to;
}

async function onExpenseSummaryMonthChange() {
  applySelectedExpenseMonthToFilters();
  resetListPage("expenses");
  await loadExpenseOverviewSummary();
  const activeTab = document.querySelector('.exp-tab.active')?.dataset.tab || 'overview';
  if (activeTab === 'all') await loadExpenses();
  else if (activeTab === 'expenses') await loadRecentExpenses();
}

async function onExpenseSummaryCurrencyChange() {
  resetListPage("expenses");
  await Promise.all([loadExpenseSummary(), loadRecentExpenses(), loadExpenses()]);
}

async function loadRecentExpenses() {
  const q = new URLSearchParams();
  q.set("limit", "10");
  const selectedCurrency = getSelectedExpenseCurrency();
  if (selectedCurrency) q.set("currency", selectedCurrency);
  const rows = await apiCall(`expenses/read.php?${q.toString()}`);
  const tb = document.getElementById("expensesRecentTable");
  if (!tb) return;

  if (!rows.length) {
    tb.innerHTML = "<tr><td colspan='4' style='text-align:center'>No expenses yet</td></tr>";
    return;
  }

  tb.innerHTML = rows.map(r => `
    <tr>
      <td>${fmtDate(r.expense_date)}</td>
      <td>${escHtml(r.title || "-")}</td>
      <td>${escHtml(r.category_name || "-")}</td>
      <td>${fmtCurrencyWithCode(r.amount || 0, r.currency || "USD")}</td>
    </tr>
  `).join("");
}

function getExpenseFiltersQuery() {
  const q = new URLSearchParams();
  const search = (document.getElementById("expenseSearch")?.value || "").trim();
  const categoryId = document.getElementById("expenseFilterCategory")?.value || "";
  const currency = getSelectedExpenseCurrency();
  const from = document.getElementById("expenseFilterFrom")?.value || "";
  const to = document.getElementById("expenseFilterTo")?.value || "";

  if (search) q.set("search", search);
  if (categoryId) q.set("category_id", categoryId);
  if (currency) q.set("currency", currency);
  if (from) q.set("from", from);
  if (to) q.set("to", to);
  return q.toString();
}

async function loadExpenses() {
  try {
    const tb = document.getElementById("expensesTable");
    if (!tb) return;
    setListRenderer("expenses", () => loadExpenses());

    const query = getExpenseFiltersQuery();
    const rows = await apiCall(`expenses/read.php${query ? "?" + query : ""}`);

    if (!rows.length) {
      tb.innerHTML = "<tr><td colspan='6' style='text-align:center'>No expenses found</td></tr>";
      renderListPagination("expenses", tb, 0);
      return;
    }

    const pagedRows = getPagedRows("expenses", rows);
    tb.innerHTML = pagedRows.map(r => {
      const payload = JSON.stringify(r).replace(/'/g, "&#39;");
      return `
        <tr>
          <td>${fmtDate(r.expense_date)}</td>
          <td>${escHtml(r.title || "-")}</td>
          <td>${escHtml(r.category_name || "-")}</td>
          <td>${fmtCurrencyWithCode(r.amount || 0, r.currency || "USD")}</td>
          <td>${escHtml(expenseMethodLabel(r.payment_method))}</td>
          <td>
            <div class="plan-actions">
              <button class="plan-action-btn" type="button" onclick='openExpenseEditModal(${payload})'>Edit</button>
              <button class="plan-action-btn danger" type="button" onclick="deleteExpense(${r.id})">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
    renderListPagination("expenses", tb, rows.length);
  } catch (err) {
    showMsg("msg", err.message, false);
  }
}

function debouncedLoadExpenses() {
  clearTimeout(expenseSearchTimer);
  expenseSearchTimer = setTimeout(() => {
    loadExpenses();
  }, 280);
}

function resetExpenseFilters() {
  const search = document.getElementById("expenseSearch");
  const category = document.getElementById("expenseFilterCategory");
  const topCategory = document.getElementById("expenseTopCategoryFilter");
  const currency = document.getElementById("expenseSummaryCurrency");
  const from = document.getElementById("expenseFilterFrom");
  const to = document.getElementById("expenseFilterTo");
  const monthInput = document.getElementById("expenseSummaryMonth");
  if (search) search.value = "";
  if (category) category.value = "";
  if (topCategory) topCategory.value = "";
  if (currency) currency.value = "";
  if (monthInput) monthInput.value = todayIso().slice(0, 7);
  if (from) from.value = "";
  if (to) to.value = "";
  applySelectedExpenseMonthToFilters();
  resetListPage("expenses");
  loadExpenseOverviewSummary();
  const _activeTab = document.querySelector('.exp-tab.active')?.dataset.tab || 'overview';
  if (_activeTab === 'all') loadExpenses();
  else if (_activeTab === 'expenses') Promise.all([loadRecentExpenses(), loadExpenses()]);
}

async function createExpense() {
  try {
    const payload = {
      title: (document.getElementById("expenseTitle")?.value || "").trim(),
      amount: parseFloat(document.getElementById("expenseAmount")?.value || 0),
      currency: document.getElementById("expenseCurrency")?.value || "USD",
      category_id: parseInt(document.getElementById("expenseCategory")?.value || 0, 10),
      expense_date: document.getElementById("expenseDate")?.value || "",
      payment_method: document.getElementById("expensePaymentMethod")?.value || "cash",
      notes: (document.getElementById("expenseNotes")?.value || "").trim()
    };

    await apiCall("expenses/create.php", "POST", payload);
    const expenseTitle = document.getElementById("expenseTitle");
    const expenseAmount = document.getElementById("expenseAmount");
    const expenseCurrency = document.getElementById("expenseCurrency");
    const expenseCategory = document.getElementById("expenseCategory");
    const expenseDate = document.getElementById("expenseDate");
    const expensePaymentMethod = document.getElementById("expensePaymentMethod");
    const expenseNotes = document.getElementById("expenseNotes");

    if (expenseTitle) expenseTitle.value = "";
    if (expenseAmount) expenseAmount.value = "";
    if (expenseCurrency) expenseCurrency.value = "USD";
    if (expenseCategory) expenseCategory.value = "";
    if (expenseDate) expenseDate.value = todayIso();
    if (expensePaymentMethod) expensePaymentMethod.value = "cash";
    if (expenseNotes) expenseNotes.value = "";

    showMsg("msg", "Expense saved", true);
    await Promise.all([loadExpenseOverviewSummary(), loadRecentExpenses(), loadExpenses()]);
  } catch (err) {
    showMsg("msg", err.message, false);
  }
}

function openExpenseEditModal(expense) {
  document.getElementById("editExpenseId").value = expense.id || "";
  document.getElementById("editExpenseTitle").value = expense.title || "";
  document.getElementById("editExpenseAmount").value = expense.amount || "";
  document.getElementById("editExpenseCurrency").value = expense.currency || "USD";
  document.getElementById("editExpenseCategory").value = expense.category_id || "";
  document.getElementById("editExpenseDate").value = expense.expense_date || "";
  document.getElementById("editExpensePaymentMethod").value = expense.payment_method || "cash";
  document.getElementById("editExpenseNotes").value = expense.notes || "";

  const modal = document.getElementById("expenseEditModal");
  if (modal) {
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
  }
}

function closeExpenseEditModal() {
  const modal = document.getElementById("expenseEditModal");
  if (!modal) return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
}

async function updateExpense() {
  try {
    const payload = {
      id: parseInt(document.getElementById("editExpenseId")?.value || 0, 10),
      title: (document.getElementById("editExpenseTitle")?.value || "").trim(),
      amount: parseFloat(document.getElementById("editExpenseAmount")?.value || 0),
      currency: document.getElementById("editExpenseCurrency")?.value || "USD",
      category_id: parseInt(document.getElementById("editExpenseCategory")?.value || 0, 10),
      expense_date: document.getElementById("editExpenseDate")?.value || "",
      payment_method: document.getElementById("editExpensePaymentMethod")?.value || "cash",
      notes: (document.getElementById("editExpenseNotes")?.value || "").trim()
    };

    await apiCall("expenses/update.php", "POST", payload);
    closeExpenseEditModal();
    showMsg("msg", "Expense updated", true);
    await Promise.all([loadExpenseOverviewSummary(), loadRecentExpenses(), loadExpenses()]);
  } catch (err) {
    showMsg("msg", err.message, false);
  }
}

async function deleteExpense(id) {
  try {
    if (!confirm("Delete this expense?")) return;
    await apiCall("expenses/delete.php", "POST", { id });
    showMsg("msg", "Expense deleted", true);
    await Promise.all([loadExpenseOverviewSummary(), loadRecentExpenses(), loadExpenses()]);
  } catch (err) {
    showMsg("msg", err.message, false);
  }
}

function switchExpenseTab(tab) {
  document.querySelectorAll('.exp-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.exp-tab-panel').forEach(panel => {
    panel.classList.toggle('hidden', panel.dataset.panel !== tab);
  });
  if (tab === 'overview') loadExpenseOverviewSummary();
  else if (tab === 'all') loadExpenses();
  else if (tab === 'expenses') loadRecentExpenses();
}

async function loadExpenseOverviewSummary() {
  try {
    const monthVal = (document.getElementById('expenseSummaryMonth')?.value || '').trim();
    const q = new URLSearchParams();
    if (/^\d{4}-\d{2}$/.test(monthVal)) q.set('month', monthVal);
    const data = await apiCall(`expenses/monthly_summary.php${q.toString() ? '?' + q.toString() : ''}`);
    const rc = data.report_currency || 'USD';
    const income  = data.income || 0;
    const expense = data.expense || 0;
    const closing = data.closing_balance ?? (income - expense);
    const cash    = data.cash_in_hand ?? Math.max(0, closing);
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('expSummaryIncome',     fmtCurrencyWithCode(income,   rc));
    set('expTotalMonth',        fmtCurrencyWithCode(expense,  rc));
    set('expSummaryClosing',    fmtCurrencyWithCode(closing,  rc));
    set('expSummaryCashInHand', fmtCurrencyWithCode(cash,     rc));
    set('expNetBalance', 'Net bal. ' + fmtCurrencyWithCode(closing, rc));
  } catch (_) {
    // non-critical, leave defaults in place
  }
}

async function initExpensesPage() {
  const dateEl = document.getElementById("expenseDate");
  if (dateEl && !dateEl.value) dateEl.value = todayIso();

  const monthInput = document.getElementById("expenseSummaryMonth");
  const currencyInput = document.getElementById("expenseSummaryCurrency");
  if (monthInput && !monthInput.value) monthInput.value = todayIso().slice(0, 7);
  if (currencyInput && !currencyInput.value) currencyInput.value = "";
  applySelectedExpenseMonthToFilters();

  await loadExpenseCategories();
  await loadExpenseOverviewSummary();
}

async function loadExpenseReportPreview() {
  try {
    const from = document.getElementById("reportExpenseFrom")?.value || "";
    const to = document.getElementById("reportExpenseTo")?.value || "";
    const query = new URLSearchParams();
    if (from) query.set("from", from);
    if (to) query.set("to", to);

    const data = await apiCall(`expenses/report.php${query.toString() ? "?" + query.toString() : ""}`);
    const byMonth = Array.isArray(data.by_month) ? data.by_month : [];
    const byCategory = Array.isArray(data.by_category) ? data.by_category : [];

    const monthTb = document.getElementById("expenseReportByMonth");
    const catTb = document.getElementById("expenseReportByCategory");

    if (monthTb) {
      monthTb.innerHTML = byMonth.length
        ? byMonth.map(r => `<tr><td>${escHtml(r.period || "-")}</td><td>${fmtCurrencyWithCode(r.total || 0, data.report_currency || "USD")}</td></tr>`).join("")
        : "<tr><td colspan='2' style='text-align:center'>No data</td></tr>";
    }

    if (catTb) {
      catTb.innerHTML = byCategory.length
        ? byCategory.map(r => `<tr><td>${escHtml(r.category || "-")}</td><td>${fmtCurrencyWithCode(r.total || 0, data.report_currency || "USD")}</td></tr>`).join("")
        : "<tr><td colspan='2' style='text-align:center'>No data</td></tr>";
    }
  } catch (err) {
    showMsg("msg", err.message, false);
  }
}

function scrollToRevenueReport(e) {
  e.preventDefault();
  const el = document.getElementById("revenue-report");
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderRevenueChart(series) {
  const host = document.getElementById("revenueChart");
  if (!host) return;

  const rows = Array.isArray(series) ? series : [];
  if (!rows.length) {
    host.innerHTML = "<div class='rpt-revenue-empty'>No data</div>";
    return;
  }

  const width = 820;
  const height = 360;
  const padTop = 18;
  const padRight = 26;
  const padBottom = 42;
  const padLeft = 36;
  const innerWidth = width - padLeft - padRight;
  const innerHeight = height - padTop - padBottom;
  const maxValue = Math.max(...rows.map(r => Number(r.amount || 0)), 0);
  const topValue = maxValue > 0 ? Math.ceil(maxValue / 10) * 10 : 100;
  const stepX = rows.length > 1 ? innerWidth / (rows.length - 1) : innerWidth;
  const yFor = value => padTop + innerHeight - ((Number(value || 0) / topValue) * innerHeight);
  const xFor = index => padLeft + (stepX * index);

  const linePoints = rows.map((row, index) => `${xFor(index)},${yFor(row.amount)}`).join(" ");
  const areaPoints = [
    `${padLeft},${padTop + innerHeight}`,
    ...rows.map((row, index) => `${xFor(index)},${yFor(row.amount)}`),
    `${xFor(rows.length - 1)},${padTop + innerHeight}`
  ].join(" ");

  const yTicks = Array.from({ length: 6 }, (_, index) => {
    const value = (topValue / 5) * (5 - index);
    const y = yFor(value);
    return `
      <g>
        <line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" stroke="#eef2f7" stroke-width="1" />
        <text x="${padLeft - 8}" y="${y + 4}" text-anchor="end" fill="#6b7280" font-size="11">${Math.round(value)}</text>
      </g>`;
  }).join("");

  const xTicks = rows.map((row, index) => {
    const x = xFor(index);
    return `
      <g>
        <text x="${x}" y="${height - 12}" text-anchor="middle" fill="#6b7280" font-size="11">${escHtml(row.month_label.replace(" 20", " "))}</text>
      </g>`;
  }).join("");

  const dots = rows.map((row, index) => `
      <circle cx="${xFor(index)}" cy="${yFor(row.amount)}" r="3.5" fill="#34c26a" stroke="#34c26a"></circle>
    `).join("");

  host.innerHTML = `
    <svg class="rpt-revenue-chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Revenue chart">
      ${yTicks}
      <polygon points="${areaPoints}" fill="rgba(52, 194, 106, 0.26)"></polygon>
      <polyline points="${linePoints}" fill="none" stroke="#34c26a" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"></polyline>
      ${dots}
      ${xTicks}
    </svg>
  `;
}

function renderRevenueComparison(series, currencyCode) {
  const host = document.getElementById("revenueComparison");
  if (!host) return;

  const rows = Array.isArray(series) ? series : [];
  if (!rows.length) {
    host.innerHTML = "<div class='rpt-revenue-empty'>No data</div>";
    return;
  }

  host.innerHTML = rows.map((row, index) => {
    const amount = fmtCurrency(row.amount || 0);
    const change = row.change_pct;
    const changeHtml = index > 0 && change !== null
      ? `<div class="rpt-revenue-change ${change < 0 ? "down" : change > 0 ? "up" : "flat"}">${change > 0 ? "+" : ""}${change.toFixed(2)}%</div>`
      : "";
    return `
      <div class="rpt-revenue-compare-row">
        <div class="rpt-revenue-compare-copy">
          <div class="rpt-revenue-compare-month">${escHtml(row.month_label)}</div>
          ${changeHtml}
        </div>
        <div class="rpt-revenue-compare-amount">${amount}</div>
        <button type="button" class="rpt-revenue-download" onclick="downloadRevenueMonthCsv('${row.month_key}')" aria-label="Download ${escHtml(row.month_label)} revenue" title="Download ${escHtml(row.month_label)} revenue">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3v12"/>
            <path d="M7 10l5 5 5-5"/>
            <path d="M5 21h14"/>
          </svg>
        </button>
      </div>`;
  }).join("");
}

function downloadRevenueMonthCsv(monthKey) {
  const rows = Array.isArray(revenueReportState.series) ? revenueReportState.series : [];
  const row = rows.find(item => String(item.month_key) === String(monthKey));
  if (!row) return;

  const header = "month,amount,currency,change_pct\n";
  const body = [
    row.month_label,
    Number(row.amount || 0).toFixed(2),
    revenueReportState.report_currency || "USD",
    row.change_pct == null ? "" : Number(row.change_pct).toFixed(2)
  ].join(",") + "\n";

  const blob = new Blob([header + body], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `revenue-${monthKey}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function loadRevenueReport() {
  try {
    const months = document.getElementById("revenueMonths")?.value || "12";
    const query = new URLSearchParams();
    query.set("months", months);

    const data = await apiCall(`reports/revenue.php?${query.toString()}`);
    const series = Array.isArray(data.series) ? data.series : [];
    revenueReportState = {
      series,
      report_currency: data.report_currency || "USD"
    };

    renderRevenueChart(series);
    renderRevenueComparison(series, revenueReportState.report_currency);
  } catch (err) {
    showMsg("msg", err.message, false);
  }
}

function scrollToExpenseReport(e) {
  e.preventDefault();
  const el = document.getElementById("expense-report");
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function initReportsPage() {
  const monthsEl = document.getElementById("revenueMonths");
  if (monthsEl && !monthsEl.value) monthsEl.value = "12";

  const fromEl = document.getElementById("reportExpenseFrom");
  const toEl = document.getElementById("reportExpenseTo");
  const today = todayIso();
  if (toEl && !toEl.value) toEl.value = today;
  if (fromEl && !fromEl.value) {
    const d = new Date();
    d.setDate(1);
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    fromEl.value = `${d.getFullYear()}-${m}-${day}`;
  }

  // Profit by Categories default dates
  const profitFrom = document.getElementById('profitCatFrom');
  const profitTo = document.getElementById('profitCatTo');
  if (profitFrom && profitTo) {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    profitFrom.value = firstDay.toISOString().slice(0, 10);
    profitTo.value = now.toISOString().slice(0, 10);
    loadProfitByCategory();
  }

  const tasks = [];
  if (document.getElementById("revenueChart") || document.getElementById("revenueComparison")) {
    tasks.push(loadRevenueReport());
  }
  if (document.getElementById("expenseReportByMonth") || document.getElementById("expenseReportByCategory")) {
    tasks.push(loadExpenseReportPreview());
  }
  await Promise.all(tasks);
}

async function loadRenewals() {
  try {
    const res = await apiCall("renewals/auto_check.php");
    allRenewals = Array.isArray(res.rows) ? res.rows : (Array.isArray(res) ? res : []);
    // Sync active tab to current filter
    document.querySelectorAll(".renewal-tab").forEach(t => t.classList.remove("active"));
    const activeTab = document.getElementById(`renewal-tab-${renewalFilterStatus}`);
    if (activeTab) activeTab.classList.add("active");
    renderRenewals();
  } catch (err) {
    showMsg("msg", err.message, false);
  }
}

function filterRenewals(status) {
  if (status !== "pending" && status !== "renewed") {
    status = "pending";
  }
  renewalFilterStatus = status;
  resetListPage("renewals");
  document.querySelectorAll(".renewal-tab").forEach(t => t.classList.remove("active"));
  const active = document.getElementById(`renewal-tab-${status}`);
  if (active) active.classList.add("active");
  renderRenewals();
}

function renderRenewals() {
  const tb = document.getElementById("renewalsTable");
  if (!tb) return;
  setListRenderer("renewals", () => renderRenewals());

  let rows = allRenewals.filter(r => r.status === renewalFilterStatus);

  if (renewalFilterStatus === "pending") {
    rows = rows.filter(r => {
      if (renewalAutoFilter === "auto") return parseInt(r.autorenew || 0, 10) === 1;
      if (renewalAutoFilter === "manual") return parseInt(r.autorenew || 0, 10) !== 1;
      return true;
    });

    rows = rows.filter(r => renewalLifetimeMatch(r));
  }

  if (renewalSearchQuery) {
    const q = renewalSearchQuery.toLowerCase();
    rows = rows.filter(r => (r.name || "").toLowerCase().includes(q));
  }

  if (rows.length === 0) {
    tb.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:24px;color:#64748b">No students found</td></tr>`;
    renderListPagination("renewals", tb, 0);
    return;
  }

  const pagedRows = getPagedRows("renewals", rows);

  const AVATAR_COLORS = [
    {bg:"#bfdbfe",fg:"#1e3a8a"},{bg:"#bbf7d0",fg:"#14532d"},
    {bg:"#fde68a",fg:"#78350f"},{bg:"#fecaca",fg:"#7f1d1d"},
    {bg:"#e9d5ff",fg:"#4c1d95"},{bg:"#fed7aa",fg:"#7c2d12"},
  ];

  tb.innerHTML = pagedRows.map(r => {
    const col      = AVATAR_COLORS[r.id % AVATAR_COLORS.length];
    const initial  = (r.name || "?").charAt(0).toUpperCase();
    const subEnd   = r.sub_end      ? fmtDate(r.sub_end)      : "\u2014";
    const renFrom  = r.renewal_from ? fmtDate(r.renewal_from) : "\u2014";
    const planDates = (r.sub_start && r.sub_end)
      ? `${fmtDate(r.sub_start)} \u2013 ${fmtDate(r.sub_end)}` : "";
    const receivable = (r.plan_price !== null && r.plan_price !== undefined)
      ? fmtCurrencyWithCode(r.plan_price, r.plan_currency)
      : "\u2014";
    const classCount = r.class_count ?? 0;
    const actions = [];
    if (r.status === "pending") {
      actions.push(`<button class="plan-action-btn" type="button" onclick="renewStudent(${r.id})">Renew</button>`);
    }
    if (r.status === "renewed") {
      actions.push(`<button class="plan-action-btn" type="button" onclick="renewStudent(${r.id})">Renew</button>`);
    }
    return `<tr>
      <td><input type="checkbox" class="renewal-row-check" title="Select"></td>
      <td>
        <span class="plan-title-wrap">
          <span class="plan-avatar" style="background:${col.bg};color:${col.fg}">${initial}</span>
          <button type="button" class="name-profile-link" onclick="openStudentProfile(${parseInt(r.id,10)||0})">${escHtml(r.name || "\u2014")}</button>
        </span>
      </td>
      <td>
        <span class="renewal-plan-title">${escHtml(r.plan_title || "\u2014")}</span>
        ${planDates ? `<span class="renewal-plan-dates">${planDates}</span>` : ""}
      </td>
      <td>${classCount}</td>
      <td>${subEnd}</td>
      <td>${renFrom}</td>
      <td>${receivable}</td>
      <td><div class="plan-actions">${actions.length ? actions.join("") : "-"}</div></td>
    </tr>`;
  }).join("");
  renderListPagination("renewals", tb, rows.length);
}

function onRenewalAutoFilterChange() {
  const sel = document.getElementById("renewalAutoFilter");
  renewalAutoFilter = (sel ? sel.value : "all") || "all";
  resetListPage("renewals");
  renderRenewals();
}

function onRenewalLifetimeFilterChange() {
  const sel = document.getElementById("renewalLifetimeFilter");
  renewalLifetimeFilter = (sel ? sel.value : "lifetime") || "lifetime";
  const dateEl = document.getElementById("renewalFilterDate");
  if (dateEl) {
    dateEl.classList.toggle("hidden", renewalLifetimeFilter !== "select_date");
    if (renewalLifetimeFilter !== "select_date") {
      renewalCustomDate = "";
      dateEl.value = "";
    }
  }
  resetListPage("renewals");
  renderRenewals();
}

function onRenewalCustomDateChange() {
  const dateEl = document.getElementById("renewalFilterDate");
  renewalCustomDate = dateEl ? (dateEl.value || "") : "";
  resetListPage("renewals");
  renderRenewals();
}

function renewalLifetimeMatch(row) {
  const mode = renewalLifetimeFilter;
  if (mode === "lifetime") return true;

  const dateVal = (row.sub_end || "").substring(0, 10);
  if (!dateVal) return false;

  const due = new Date(dateVal + "T12:00:00");
  if (Number.isNaN(due.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(due);
  d.setHours(0, 0, 0, 0);

  if (mode === "today") return d.getTime() === today.getTime();
  if (mode === "tomorrow") {
    const t = new Date(today);
    t.setDate(t.getDate() + 1);
    return d.getTime() === t.getTime();
  }
  if (mode === "yesterday") {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    return d.getTime() === y.getTime();
  }
  if (mode === "this_month") {
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
  }
  if (mode === "next_month") {
    const nm = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    return d.getFullYear() === nm.getFullYear() && d.getMonth() === nm.getMonth();
  }
  if (mode === "select_date") {
    return !!renewalCustomDate && dateVal === renewalCustomDate;
  }

  return true;
}

function onRenewalSearch() {
  const input    = document.getElementById("renewalSearch");
  const clearBtn = document.getElementById("renewalSearchClear");
  renewalSearchQuery = input ? input.value.trim() : "";
  if (clearBtn) clearBtn.classList.toggle("hidden", !renewalSearchQuery);
  resetListPage("renewals");
  renderRenewals();
}

function clearRenewalSearch() {
  const input    = document.getElementById("renewalSearch");
  const clearBtn = document.getElementById("renewalSearchClear");
  if (input) input.value = "";
  renewalSearchQuery = "";
  if (clearBtn) clearBtn.classList.add("hidden");
  resetListPage("renewals");
  renderRenewals();
}

async function setRenewalStatus(studentId, status) {
  try {
    await apiCall("renewals/set_status.php", "POST", { student_id: studentId, status });
    showMsg("msg", "Status updated", true);
    await loadRenewals();
  } catch (err) {
    showMsg("msg", err.message, false);
  }
}

async function loadPlans(type = "subscription") {
  try {
    const allowed = ["subscription", "trial", "one-time"];
    const selectedType = allowed.includes(type) ? type : "subscription";
    window.currentPlanType = selectedType;
    const res = await apiCall(`plans/read.php?type=${encodeURIComponent(selectedType)}`);

    const tabIds = {
      "subscription": "tab-subscription",
      "trial": "tab-trial",
      "one-time": "tab-one-time"
    };

    Object.values(tabIds).forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.remove("active");
        el.setAttribute("aria-selected", "false");
      }
    });
    const activeTab = document.getElementById(tabIds[selectedType]);
    if (activeTab) {
      activeTab.classList.add("active");
      activeTab.setAttribute("aria-selected", "true");
    }

    const addBtn = document.getElementById("plansAddBtn");
    const typeNote = document.getElementById("plansTypeNote");
    const canAdd = selectedType === "subscription" || selectedType === "one-time";
    if (addBtn) {
      addBtn.style.display = canAdd ? "inline-flex" : "none";
      addBtn.textContent = selectedType === "one-time" ? "Add One-time Plan" : "Add Subscription Plan";
    }
    if (typeNote) {
      if (selectedType === "trial") {
        typeNote.textContent = "Add plan is not enabled for Trial yet.";
      } else {
        typeNote.textContent = "";
      }
    }
    if (!canAdd) {
      closePlanForm();
    }

    const countEl = document.getElementById("plansCount");
    if (countEl) {
      countEl.textContent = `${res.count} plans`;
    }

    const tb = document.getElementById("plansTable");
    if (!tb) return;
    setListRenderer("plans", () => loadPlans(window.currentPlanType || "subscription"));

    const isOneTime = selectedType === "one-time";
    const headClasses = document.getElementById("plansHeadClasses");
    const headClients = document.getElementById("plansHeadClients");
    const headMakeUp = document.getElementById("plansHeadMakeUp");
    if (headClasses) headClasses.style.display = isOneTime ? "none" : "";
    if (headClients) headClients.style.display = isOneTime ? "none" : "";
    if (headMakeUp) headMakeUp.style.display = isOneTime ? "none" : "";

    tb.innerHTML = "";
    if (!res.plans || res.plans.length === 0) {
      tb.innerHTML = `<tr><td colspan='${isOneTime ? 3 : 6}' style='text-align:center'>No plans found</td></tr>`;
      renderListPagination("plans", tb, 0);
      return;
    }

    const plansRows = getPagedRows("plans", res.plans);

    plansRows.forEach(plan => {
      const title = plan.title || "-";
      const initial = title.charAt(0).toUpperCase() || "P";
      const amount = Number(plan.amount || 0).toFixed(2);
      const currencySymbol = planCurrencySymbol(plan.currency);
      const cycle = plan.billing_cycle || "1 Month";
      const safePlan = JSON.stringify(plan).replace(/'/g, "&#39;");

      tb.innerHTML += `<tr>
        <td>
          <div class="plan-title-wrap">
            <span class="plan-avatar">${initial}</span>
            <div>
              <div class="plan-title-text">${title}</div>
            </div>
          </div>
        </td>
        ${isOneTime ? "" : `<td>${plan.classes_count || 0}</td>`}
        ${isOneTime ? "" : `<td>${plan.clients_count || 0}</td>`}
        ${isOneTime ? "" : `<td>${plan.make_up || "-"}</td>`}
        <td>
          <div class="plan-amount">${currencySymbol}${amount}</div>
          <div class="plan-cycle">${cycle}</div>
        </td>
        <td>
          <div class="plan-actions">
            <button class="plan-action-btn" onclick='editPlan(${safePlan})'>Edit</button>
            <button class="plan-action-btn danger" onclick="deletePlan(${plan.id})">Delete</button>
          </div>
        </td>
      </tr>`;
    });
    renderListPagination("plans", tb, res.plans.length);
  } catch (err) {
    showMsg("msg", err.message, false);
  }
}

function openPlanForm() {
  editingPlanId = null;
  const type = window.currentPlanType || "subscription";
  if (type === "trial") {
    showMsg("msg", "Add plan is not enabled for Trial yet", false);
    return;
  }

  const titleEl = document.getElementById("planFormTitle");
  const hintEl = document.getElementById("planFormHint");
  const durationWrap = document.getElementById("planDurationWrap");
  const preferencesBlock = document.getElementById("planPreferencesBlock");
  const submitBtn = document.getElementById("planSubmitBtn");

  if (type === "one-time") {
    if (titleEl) titleEl.textContent = "Add One-time Plan";
    if (hintEl) hintEl.textContent = "Create a one-time plan with plan title and fee.";
    if (durationWrap) durationWrap.hidden = true;
    if (preferencesBlock) preferencesBlock.hidden = true;
  } else {
    if (titleEl) titleEl.textContent = "Add Subscription Plan";
    if (hintEl) hintEl.textContent = "Create a subscription plan with pricing and preference settings.";
    if (durationWrap) durationWrap.hidden = false;
    if (preferencesBlock) preferencesBlock.hidden = false;
  }
  if (submitBtn) submitBtn.textContent = "Save Plan";

  const modal = document.getElementById("planFormModal");
  if (!modal) return;
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

function editPlan(plan) {
  if (!plan || !plan.id) return;
  editingPlanId = parseInt(plan.id, 10);
  window.currentPlanType = plan.plan_type || "subscription";

  const titleEl = document.getElementById("planFormTitle");
  const hintEl = document.getElementById("planFormHint");
  const durationWrap = document.getElementById("planDurationWrap");
  const preferencesBlock = document.getElementById("planPreferencesBlock");
  const submitBtn = document.getElementById("planSubmitBtn");
  const modal = document.getElementById("planFormModal");
  if (!modal) return;

  const isOneTime = (window.currentPlanType === "one-time");
  if (titleEl) titleEl.textContent = isOneTime ? "Edit One-time Plan" : "Edit Subscription Plan";
  if (hintEl) hintEl.textContent = "Modify plan details then save changes.";
  if (durationWrap) durationWrap.hidden = isOneTime;
  if (preferencesBlock) preferencesBlock.hidden = isOneTime;
  if (submitBtn) submitBtn.textContent = "Update Plan";

  const titleInput = document.getElementById("planTitle");
  const durationInput = document.getElementById("planDuration");
  const feeInput = document.getElementById("planFee");
  const currencyInput = document.getElementById("planCurrency");
  const autoRenewInput = document.getElementById("planAutoRenew");
  const controlStartInput = document.getElementById("planControlStartDates");

  if (titleInput) titleInput.value = plan.title || "";
  if (durationInput) durationInput.value = plan.duration_unit || "month";
  if (feeInput) feeInput.value = Number(plan.amount || 0);
  if (currencyInput) currencyInput.value = (plan.currency || "CDF").toUpperCase();
  if (autoRenewInput) autoRenewInput.value = plan.auto_renew_clients ? "1" : "0";
  if (controlStartInput) controlStartInput.value = plan.control_available_start_dates ? "1" : "0";

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

function closePlanForm() {
  editingPlanId = null;
  const modal = document.getElementById("planFormModal");
  if (!modal) return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");

  const ids = ["planTitle", "planDuration", "planFee", "planCurrency", "planAutoRenew", "planControlStartDates"];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === "planDuration") el.value = "month";
    else if (id === "planCurrency") el.value = "CDF";
    else if (id === "planAutoRenew" || id === "planControlStartDates") el.value = "0";
    else el.value = "";
  });

  const submitBtn = document.getElementById("planSubmitBtn");
  if (submitBtn) submitBtn.textContent = "Save Plan";
}

async function submitPlanForm() {
  try {
    const type = window.currentPlanType || "subscription";
    if (type === "trial") {
      throw new Error("This Add Plan form is not available for Trial yet");
    }
    const title = document.getElementById("planTitle").value.trim();
    const duration_unit = type === "subscription"
      ? document.getElementById("planDuration").value
      : "month";
    const amount = parseFloat(document.getElementById("planFee").value || 0);
    const currency = (document.getElementById("planCurrency").value || "CDF").toUpperCase();
    const auto_renew_clients = type === "subscription"
      ? (parseInt(document.getElementById("planAutoRenew").value, 10) || 0)
      : 0;
    const control_available_start_dates = type === "subscription"
      ? (parseInt(document.getElementById("planControlStartDates").value, 10) || 0)
      : 0;

    if (!title) throw new Error("Plan title is required");
    if (!(amount > 0)) throw new Error("Amount must be greater than 0");
    if (!["USD", "CDF"].includes(currency)) throw new Error("Currency must be USD or CDF");

    const payload = {
      title,
      type,
      duration_unit,
      classes_count: 1,
      clients_count: 1,
      make_up: 0,
      amount,
      currency,
      auto_renew_clients,
      control_available_start_dates
    };

    if (editingPlanId) {
      payload.id = editingPlanId;
      await apiCall("plans/update.php", "POST", payload);
      showMsg("msg", "Plan updated", true);
    } else {
      await apiCall("plans/create.php", "POST", payload);
      showMsg("msg", "Plan added", true);
    }

    closePlanForm();
    await loadPlans(type);
  } catch (err) {
    showMsg("msg", err.message, false);
  }
}

async function deletePlan(id) {
  try {
    const planId = parseInt(id, 10);
    if (!planId) throw new Error("Invalid plan id");
    if (!confirm("Delete this plan?")) return;

    await apiCall("plans/delete.php", "POST", { id: planId });
    showMsg("msg", "Plan deleted", true);
    await loadPlans(window.currentPlanType || "subscription");
  } catch (err) {
    showMsg("msg", err.message, false);
  }
}

async function loadExchangeRateSettings() {
  const rateInput = document.getElementById("cdfToUsdRate");
  const inverseInput = document.getElementById("usdToCdfRate");
  const updatedEl = document.getElementById("rateUpdatedAt");
  if (!rateInput) return;

  const data = await apiCall("settings/read.php");
  const rate = parseFloat(data.cdf_to_usd_rate || 0);
  const inverseRate = parseFloat(data.usd_to_cdf_rate || 0);
  rateInput.value = rate > 0 ? rate.toFixed(8) : "";

  if (inverseInput) {
    inverseInput.value = inverseRate > 0 ? inverseRate.toFixed(8) : "";
  }

  if (updatedEl) {
    if (data.updated_at) {
      const dt = new Date(data.updated_at.replace(" ", "T"));
      updatedEl.value = isNaN(dt.getTime()) ? data.updated_at : dt.toLocaleString();
    } else {
      updatedEl.value = "Not set yet";
    }
  }
}

async function saveExchangeRateSettings() {
  try {
    const rateInput = document.getElementById("cdfToUsdRate");
    const inverseInput = document.getElementById("usdToCdfRate");
    if (!rateInput || !inverseInput) return;

    const rate = parseFloat(rateInput.value || 0);
    const inverseRate = parseFloat(inverseInput.value || 0);
    if (!(rate > 0)) {
      throw new Error("Please enter a valid CDF to USD rate greater than 0");
    }
    if (!(inverseRate > 0)) {
      throw new Error("Please enter a valid USD to CDF rate greater than 0");
    }

    await apiCall("settings/update.php", "POST", {
      cdf_to_usd_rate: rate,
      usd_to_cdf_rate: inverseRate
    });
    showMsg("msg", "Exchange rate updated", true);
    await loadExchangeRateSettings();
  } catch (err) {
    showMsg("msg", err.message, false);
  }
}

async function renewStudent(studentId) {
  try {
    await apiCall("renewals/renew.php", "POST", { student_id: studentId });
    showMsg("msg", "Student renewed", true);
    await loadRenewals();
  } catch (err) {
    showMsg("msg", err.message, false);
  }
}

async function renewStudentFromProfile() {
  try {
    const sid = parseInt(studentProfileState.studentId || studentProfileState.student?.id || 0, 10);
    if (!sid) throw new Error("Student not found");

    await apiCall("renewals/renew.php", "POST", { student_id: sid });
    showMsg("msg", "Student renewed", true);
    await loadStudentProfile();
  } catch (err) {
    showMsg("msg", err.message, false);
  }
}

async function loadDashboard() {
  try {
    const s = await apiCall("dashboard/stats.php");
    const totalStudents = Number(s.total_students || 0);
    const expiredStudents = Number(s.expired_students || 0);
    const activeStudents = Number(s.active_students || 0);
    const totalRevenue = Number(s.total_revenue || 0);
    const monthlyRevenue = Number(s.monthly_revenue || 0);
    const totalExpenses = Number(s.total_expenses || 0);
    const newStudentsMonth = Number(s.new_students_month || 0);
    const totalTransactions = Number(s.total_transactions || 0);
    const upcomingBirthdays = Array.isArray(s.upcoming_birthdays) ? s.upcoming_birthdays : [];

    const money = value => fmtCurrencyWithCode(value, s.report_currency || "USD");
    const churnRate = totalStudents > 0 ? ((expiredStudents / totalStudents) * 100).toFixed(2) : "0.00";
    const presentRate = totalStudents > 0 ? ((activeStudents / totalStudents) * 100).toFixed(0) : "0";

    const setText = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    setText("statStudents", totalStudents);
    setText("statActiveStudents", activeStudents);
    setText("statPaidRatio", `${activeStudents}/${totalStudents}`);
    setText("statNewStudents", newStudentsMonth);
    setText("statExpired", expiredStudents);
    setText("statChurn", `${churnRate}%`);

    setText("statActiveSubscriptions", activeStudents);
    setText("statActivePaidClients", `${activeStudents}/${totalStudents}`);
    setText("statNewlyJoined", newStudentsMonth);
    setText("statNewlyAdded", newStudentsMonth);
    setText("statRenewed", 0);
    setText("statNotRenewed", 0);
    setText("statStopped", 0);
    setText("statChurnRate", `${churnRate}%`);

    setText("statIncome", money(totalRevenue));
    setText("statExpense", money(totalExpenses));
    setText("statRevenue", money(totalRevenue));
    setText("statNetIncome", money(Number(s.net_income || 0)));
    setText("statMRR", money(monthlyRevenue));

    setText("statInvoiceAmount", money(totalRevenue));
    setText("statReceivedPayments", money(totalRevenue));
    setText("statCashReceived", money(totalRevenue));
    setText("statTransactions", totalTransactions);
    setText("statNewEnquiries", 0);
    setText("statConversionRate", "0.00%");
    setText("statTrials", "0/0");

    setText("statClientsPresent", `${presentRate}% (${activeStudents}/${totalStudents})`);
    setText("statCoachesPresent", "0/1");
    setText("statSessions", 0);

    setText("statActiveSubscriptions", activeStudents);
    setText("statActivePaidClients", `${activeStudents}/${totalStudents}`);
    setText("statNewlyJoined", newStudentsMonth);
    setText("statNewlyAdded", newStudentsMonth);
    setText("statRenewed", 0);
    setText("statNotRenewed", 0);
    setText("statStopped", 0);
    setText("statChurnRate", `${churnRate}%`);

    setText("statIncome", money(totalRevenue));
    setText("statExpense", money(totalExpenses));
    setText("statRevenue", money(totalRevenue));
    setText("statNetIncome", money(Number(s.net_income || 0)));
    setText("statMRR", money(monthlyRevenue));

    setText("statInvoiceAmount", money(totalRevenue));
    setText("statReceivedPayments", money(totalRevenue));
    setText("statCashReceived", money(totalRevenue));
    setText("statTransactions", totalTransactions);
    setText("statNewEnquiries", 0);
    setText("statConversionRate", "0.00%");
    setText("statTrials", "0/0");

    setText("statClientsPresent", `${presentRate}% (${activeStudents}/${totalStudents})`);
    setText("statCoachesPresent", "0/1");
    setText("statSessions", 0);

    const birthdayListEl = document.getElementById("birthdayList");

    if (birthdayListEl) {
      const birthdays = Array.isArray(s.upcoming_birthdays) ? s.upcoming_birthdays : [];
      if (birthdays.length === 0) {
        birthdayListEl.innerHTML = `<div class="metric-item"><span style="color:#888">No birthdays in the next 7 days</span></div>`;
      } else {
        birthdayListEl.innerHTML = birthdays.map(b => {
          const label = b.days_until === 0 ? "Today!" : b.days_until === 1 ? "Tomorrow" : `In ${b.days_until} days`;
          const dob = b.date_of_birth ? fmtDate(b.date_of_birth) : "";
          const tone = b.days_until === 0 ? "color:#e05a00;font-weight:700" : "";
          return `<div class="metric-item">
            <span style="${tone}">${escHtml(b.name)}${dob ? ` <small>(${dob})</small>` : ""}</span>
            <strong style="${tone}">${escHtml(label)}</strong>
          </div>`;
        }).join("");
      }
    }
  } catch (err) {
    showMsg("msg", err.message, false);
  }
}

async function loadClasses() {
  try {
    const rows = await apiCall("classes/read.php");
    const tb = document.getElementById("classTable");
    const countEl = document.getElementById("classCount");
    if (!tb) return;
    setListRenderer("classes", () => loadClasses());
    tb.innerHTML = "";
    if (countEl) {
      countEl.textContent = `${rows.length} classes`;
    }
    if (!rows || rows.length === 0) {
      tb.innerHTML = "<tr><td colspan='6' style='text-align:center'>No classes found</td></tr>";
      renderListPagination("classes", tb, 0);
      return;
    }

    const pagedRows = getPagedRows("classes", rows);

    pagedRows.forEach(r => {
      const safeClass = JSON.stringify(r).replace(/'/g, "&#39;");
      tb.innerHTML += `<tr>
        <td>${r.title || "-"}</td>
        <td>${r.skill || "-"}</td>
        <td>${r.center || "-"}</td>
        <td>${r.plan_title || "-"}</td>
        <td>${r.level || "-"}</td>
        <td>
          <div class="plan-actions">
            <button class="plan-action-btn" onclick='editClass(${safeClass})'>Edit</button>
            <button class="plan-action-btn danger" onclick="deleteClass(${r.id})">Delete</button>
          </div>
        </td>
      </tr>`;
    });
    renderListPagination("classes", tb, rows.length);
  } catch (err) {
    showMsg("msg", err.message, false);
  }
}

function openClassForm() {
  editingClassId = null;
  const modal = document.getElementById("classFormModal");
  const titleEl = document.getElementById("classFormTitle");
  const hintEl = document.getElementById("classFormHint");
  const submitBtn = document.getElementById("classSubmitBtn");

  if (titleEl) titleEl.textContent = "Add Class";
  if (hintEl) hintEl.textContent = "Create a new class with skill, center and level assignment.";
  if (submitBtn) submitBtn.textContent = "Save Class";

  if (!modal) return;
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

function editClass(row) {
  if (!row || !row.id) return;
  editingClassId = parseInt(row.id, 10);

  const titleEl = document.getElementById("classFormTitle");
  const hintEl = document.getElementById("classFormHint");
  const submitBtn = document.getElementById("classSubmitBtn");
  const modal = document.getElementById("classFormModal");

  if (titleEl) titleEl.textContent = "Edit Class";
  if (hintEl) hintEl.textContent = "Update class details and save changes.";
  if (submitBtn) submitBtn.textContent = "Update Class";

  const title = document.getElementById("classTitle");
  const skill = document.getElementById("classSkill");
  const center = document.getElementById("classCenter");
  const plan = document.getElementById("classPlan");
  const level = document.getElementById("classLevel");

  if (title) title.value = row.title || "";
  if (skill) skill.value = row.skill || "";
  if (center) center.value = row.center || "";
  if (plan) plan.value = row.plan_id || "";
  if (level) level.value = row.level || "";

  if (!modal) return;
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

function closeClassForm() {
  editingClassId = null;
  const modal = document.getElementById("classFormModal");
  if (!modal) return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
  
  const ids = ["classTitle", "classSkill", "classCenter", "classPlan", "classLevel"];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  const titleEl = document.getElementById("classFormTitle");
  const hintEl = document.getElementById("classFormHint");
  const submitBtn = document.getElementById("classSubmitBtn");
  if (titleEl) titleEl.textContent = "Add Class";
  if (hintEl) hintEl.textContent = "Create a new class with skill, center and level assignment.";
  if (submitBtn) submitBtn.textContent = "Save Class";
}

async function submitClassForm() {
  try {
    const title = document.getElementById("classTitle").value.trim();
    const skill = document.getElementById("classSkill").value.trim();
    const center = document.getElementById("classCenter").value.trim();
    const plan_id = parseInt(document.getElementById("classPlan").value || 0, 10);
    const level = document.getElementById("classLevel").value.trim();

    if (!title) throw new Error("Title is required");
    if (!skill) throw new Error("Skill is required");
    if (!center) throw new Error("Center is required");
    if (!plan_id) throw new Error("Plan is required");
    if (!level) throw new Error("Level is required");

    if (editingClassId) {
      await apiCall("classes/update.php", "POST", { id: editingClassId, title, skill, center, plan_id, level });
      showMsg("msg", "Class updated", true);
      closeClassForm();
      await loadClasses();
    } else {
      await apiCall("classes/create.php", "POST", { title, skill, center, plan_id, level });
      closeClassForm();
      window.location.href = `class-schedule.html?class=${encodeURIComponent(title)}&level=${encodeURIComponent(level)}`;
    }
  } catch (err) {
    showMsg("msg", err.message, false);
  }
}

async function deleteClass(id) {
  try {
    const classId = parseInt(id, 10);
    if (!classId) throw new Error("Invalid class id");
    if (!confirm("Delete this class?")) return;

    await apiCall("classes/delete.php", "POST", { id: classId });
    showMsg("msg", "Class deleted", true);
    await loadClasses();
  } catch (err) {
    showMsg("msg", err.message, false);
  }
}

async function openScheduleForm(prefill = {}) {
  const modal = document.getElementById("scheduleFormModal");
  if (!modal) return;

  const isEdit = prefill && prefill.id != null;
  editingScheduleId = isEdit ? (parseInt(prefill.id, 10) || null) : null;

  const idEl = document.getElementById("scheduleId");
  if (idEl) idEl.value = editingScheduleId || "";

  const titleEl = document.getElementById("scheduleFormTitle");
  if (titleEl) titleEl.textContent = isEdit ? "Edit Class Schedule" : "Add Class Schedule";

  const submitBtn = document.getElementById("scheduleSubmitBtn");
  if (submitBtn) submitBtn.textContent = isEdit ? "Update Schedule" : "Save Schedule";

  await loadClassesIntoScheduleSelect(prefill.classId || "");

  // if prefill provided a classId, trigger center fill
  const sel = document.getElementById("scheduleClassId");
  if (sel && sel.onchange) sel.onchange();

  const map = {
    scheduleClassId: prefill.classId || prefill.class_id || "",
    scheduleFromDate: prefill.from_date || "",
    scheduleUptoDate: prefill.upto_date || "",
    scheduleSunStart: prefill.sun_start || "",
    scheduleSunEnd: prefill.sun_end || "",
    scheduleMonStart: prefill.mon_start || "",
    scheduleMonEnd: prefill.mon_end || "",
    scheduleTueStart: prefill.tue_start || "",
    scheduleTueEnd: prefill.tue_end || "",
    scheduleWedStart: prefill.wed_start || "",
    scheduleWedEnd: prefill.wed_end || "",
    scheduleThuStart: prefill.thu_start || "",
    scheduleThuEnd: prefill.thu_end || "",
    scheduleFriStart: prefill.fri_start || "",
    scheduleFriEnd: prefill.fri_end || "",
    scheduleSatStart: prefill.sat_start || "",
    scheduleSatEnd: prefill.sat_end || ""
  };
  Object.keys(map).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = map[id];
  });

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

function closeScheduleForm() {
  const modal = document.getElementById("scheduleFormModal");
  if (!modal) return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");

  const ids = [
    "scheduleClassId", "scheduleFromDate", "scheduleUptoDate",
    "scheduleSunStart", "scheduleSunEnd",
    "scheduleMonStart", "scheduleMonEnd",
    "scheduleTueStart", "scheduleTueEnd",
    "scheduleWedStart", "scheduleWedEnd",
    "scheduleThuStart", "scheduleThuEnd",
    "scheduleFriStart", "scheduleFriEnd",
    "scheduleSatStart", "scheduleSatEnd"
  ];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = "";
  });

  const centerEl = document.getElementById("scheduleCenterDisplay");
  if (centerEl) centerEl.value = "";

  const idEl = document.getElementById("scheduleId");
  if (idEl) idEl.value = "";
  editingScheduleId = null;

  const titleEl = document.getElementById("scheduleFormTitle");
  if (titleEl) titleEl.textContent = "Add Class Schedule";

  const submitBtn = document.getElementById("scheduleSubmitBtn");
  if (submitBtn) submitBtn.textContent = "Save Schedule";

  const hintEl = document.getElementById("scheduleFormHint");
  if (hintEl) {
    hintEl.textContent = "Select a class to see its center. Choose a date range and set the weekly timings.";
  }
}

async function editSchedule(id) {
  try {
    const scheduleId = parseInt(id, 10) || 0;
    if (!scheduleId) throw new Error("Invalid schedule id");

    const raw = await apiCall("class-schedule/read.php");
    const rows = Array.isArray(raw)
      ? raw
      : Array.isArray(raw.rows)
        ? raw.rows
        : Array.isArray(raw.data)
          ? raw.data
          : [];
    const row = rows.find(r => parseInt(r.id, 10) === scheduleId);
    if (!row) throw new Error("Schedule not found");

    await openScheduleForm({
      id: row.id,
      classId: row.class_id,
      from_date: row.from_date,
      upto_date: row.upto_date,
      sun_start: row.sun_start,
      sun_end: row.sun_end,
      mon_start: row.mon_start,
      mon_end: row.mon_end,
      tue_start: row.tue_start,
      tue_end: row.tue_end,
      wed_start: row.wed_start,
      wed_end: row.wed_end,
      thu_start: row.thu_start,
      thu_end: row.thu_end,
      fri_start: row.fri_start,
      fri_end: row.fri_end,
      sat_start: row.sat_start,
      sat_end: row.sat_end
    });
  } catch (err) {
    showMsg("msg", err.message, false);
  }
}

async function deleteSchedule(id) {
  try {
    const scheduleId = parseInt(id, 10) || 0;
    if (!scheduleId) throw new Error("Invalid schedule id");
    if (!confirm("Delete this schedule?")) return;

    await apiCall("class-schedule/delete.php", "POST", { id: scheduleId });
    showMsg("msg", "Schedule deleted", true);
    await loadSchedules();
  } catch (err) {
    showMsg("msg", err.message, false);
  }
}

function buildWeeklyTimingText(row) {
  const map = [
    ["Sun", row.sun_start, row.sun_end],
    ["Mon", row.mon_start, row.mon_end],
    ["Tue", row.tue_start, row.tue_end],
    ["Wed", row.wed_start, row.wed_end],
    ["Thu", row.thu_start, row.thu_end],
    ["Fri", row.fri_start, row.fri_end],
    ["Sat", row.sat_start, row.sat_end]
  ];
  const active = map.filter(([, start, end]) => !!start && !!end);
  if (active.length === 0) return "-";
  return active.map(([day, start, end]) => `${day} ${start}-${end}`).join(" | ");
}

async function loadSchedules() {
  try {
    const raw = await apiCall("class-schedule/read.php");
    allSchedules = Array.isArray(raw)
      ? raw
      : Array.isArray(raw.rows)
        ? raw.rows
        : Array.isArray(raw.data)
          ? raw.data
          : [];
    populateCenterFilter(allSchedules);
    renderSchedules();
  } catch (err) {
    showMsg("msg", err.message, false);
  }
}

function populateCenterFilter(rows) {
  const sel = document.getElementById("scheduleCenterFilter");
  if (!sel) return;
  const current = sel.value;
  const centers = [...new Set(rows.map(r => r.center).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">All Centers</option>';
  centers.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    sel.appendChild(opt);
  });
  if (current) sel.value = current;
}

function getScheduleFilterDate() {
  const filter = document.getElementById("scheduleDateFilter")?.value || "all";
  if (filter === "all") return null;
  const now = new Date();
  const pad = n => String(n).padStart(2, "0");
  const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (filter === "today") return toISO(now);
  if (filter === "yesterday") { const d = new Date(now); d.setDate(d.getDate() - 1); return toISO(d); }
  if (filter === "tomorrow") { const d = new Date(now); d.setDate(d.getDate() + 1); return toISO(d); }
  if (filter === "custom") return document.getElementById("scheduleCustomDate")?.value || null;
  return null;
}

function onScheduleDateFilterChange() {
  const isCustom = document.getElementById("scheduleDateFilter")?.value === "custom";
  const customInput = document.getElementById("scheduleCustomDate");
  if (customInput) {
    customInput.classList.toggle("hidden", !isCustom);
    if (!isCustom) customInput.value = "";
  }
  resetListPage("schedules");
  applyScheduleFilters();
}

function applyScheduleFilters() {
  resetListPage("schedules");
  renderSchedules();
}

function renderSchedules() {
  const tb = document.getElementById("scheduleTable");
  const countEl = document.getElementById("scheduleCount");
  if (!tb) return;
  setListRenderer("schedules", () => renderSchedules());

  const filterDate = getScheduleFilterDate();
  const filterCenter = document.getElementById("scheduleCenterFilter")?.value || "";

  let rows = allSchedules;

  if (filterDate) {
    const dow = new Date(filterDate + "T12:00:00").getDay(); // 0=Sun..6=Sat
    const dayKey = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][dow];
    rows = rows.filter(row => {
      const from = (row.from_date || "").substring(0, 10);
      const upto = (row.upto_date && row.upto_date !== "0000-00-00")
        ? row.upto_date.substring(0, 10)
        : "";
      const activeOnDate = from <= filterDate && (!upto || upto >= filterDate);
      const hasTimingThisDay = !!(row[`${dayKey}_start`] && row[`${dayKey}_end`]);
      return activeOnDate && hasTimingThisDay;
    });
  }

  if (filterCenter) {
    rows = rows.filter(row => (row.center || "") === filterCenter);
  }

  tb.innerHTML = "";
  if (countEl) countEl.textContent = `${rows.length} schedule${rows.length !== 1 ? "s" : ""}`;

  if (rows.length === 0) {
    tb.innerHTML = "<tr><td colspan='5' style='text-align:center'>No schedules found</td></tr>";
    renderListPagination("schedules", tb, 0);
    return;
  }

  const pagedRows = getPagedRows("schedules", rows);

  pagedRows.forEach(row => {
    const dateRange = row.upto_date && row.upto_date !== "0000-00-00"
      ? `${row.from_date} → ${row.upto_date}`
      : row.from_date;
    const timings = buildWeeklyTimingText(row);
    const coachName = row.coach || "-";
    const studentCount = row.student_count || 0;
    tb.innerHTML += `<tr>
      <td>${row.class_title || row.class_name || "-"}</td>
      <td>${row.center || "-"}</td>
      <td>${coachName}</td>
      <td>${dateRange || "-"}</td>
      <td>${timings}</td>
      <td>${studentCount} student${studentCount !== 1 ? "s" : ""}</td>
      <td>
        <button class="plan-action-btn" type="button" onclick="editSchedule(${parseInt(row.id, 10) || 0})">Edit</button>
        <button class="plan-action-btn danger" type="button" onclick="deleteSchedule(${parseInt(row.id, 10) || 0})">Delete</button>
      </td>
    </tr>`;
  });
  renderListPagination("schedules", tb, rows.length);
}

async function submitScheduleForm() {
  try {
    const class_id = parseInt(document.getElementById("scheduleClassId").value, 10) || 0;
    const from_date = document.getElementById("scheduleFromDate").value;
    const upto_date = document.getElementById("scheduleUptoDate").value;
    const sun_start = document.getElementById("scheduleSunStart").value;
    const sun_end = document.getElementById("scheduleSunEnd").value;
    const mon_start = document.getElementById("scheduleMonStart").value;
    const mon_end = document.getElementById("scheduleMonEnd").value;
    const tue_start = document.getElementById("scheduleTueStart").value;
    const tue_end = document.getElementById("scheduleTueEnd").value;
    const wed_start = document.getElementById("scheduleWedStart").value;
    const wed_end = document.getElementById("scheduleWedEnd").value;
    const thu_start = document.getElementById("scheduleThuStart").value;
    const thu_end = document.getElementById("scheduleThuEnd").value;
    const fri_start = document.getElementById("scheduleFriStart").value;
    const fri_end = document.getElementById("scheduleFriEnd").value;
    const sat_start = document.getElementById("scheduleSatStart").value;
    const sat_end = document.getElementById("scheduleSatEnd").value;

    const dayPairs = [
      ["Sun", sun_start, sun_end],
      ["Mon", mon_start, mon_end],
      ["Tue", tue_start, tue_end],
      ["Wed", wed_start, wed_end],
      ["Thu", thu_start, thu_end],
      ["Fri", fri_start, fri_end],
      ["Sat", sat_start, sat_end]
    ];
    const hasAnyTiming = dayPairs.some(([, start, end]) => !!start && !!end);

    if (!class_id) throw new Error("Please select a class");
    if (!from_date) throw new Error("Date is required");
    if (upto_date && upto_date < from_date) throw new Error("Upto date cannot be before Date");
    dayPairs.forEach(([day, start, end]) => {
      if ((start && !end) || (!start && end)) {
        throw new Error(`${day}: set both start and end time`);
      }
      if (start && end && end <= start) {
        throw new Error(`${day}: end time must be after start time`);
      }
    });
    if (!hasAnyTiming) throw new Error("Set start and end timing for at least one day");

    const payload = {
      class_id,
      from_date,
      upto_date,
      sun_start, sun_end,
      mon_start, mon_end,
      tue_start, tue_end,
      wed_start, wed_end,
      thu_start, thu_end,
      fri_start, fri_end,
      sat_start, sat_end
    };

    const editingId = parseInt((document.getElementById("scheduleId") || {}).value || "", 10) || editingScheduleId || 0;
    const result = editingId
      ? await apiCall("class-schedule/update.php", "POST", { id: editingId, ...payload })
      : await apiCall("class-schedule/create.php", "POST", payload);

    const saveConfirmed = result && (
      result.id != null ||
      result.message === "Schedule saved" ||
      result.message === "Schedule updated"
    );
    if (!saveConfirmed) {
      throw new Error("Schedule save was not confirmed by server");
    }

    closeScheduleForm();
    showMsg("msg", editingId ? "Schedule updated" : "Schedule added", true);
    await loadSchedules();
    window.history.replaceState({}, "", "class-schedule.html");
  } catch (err) {
    showMsg("msg", err.message, false);
  }
}

function getSchedulePrefill() {
  const params = new URLSearchParams(window.location.search);
  const className = params.get("class") || "";
  if (!className) {
    return null;
  }

  return {
    className,
    level: params.get("level") || "",
    center: params.get("center") || ""
  };
}

// ── Attendance ────────────────────────────────────────────────────────────────

async function onAttendanceDateChange() {
  const dateEl = document.getElementById("attendanceDatePicker");
  const date = dateEl ? dateEl.value : "";
  attCurrentDate = date;
  const listEl = document.getElementById("attendanceClassList");
  if (!listEl) return;

  if (!date) {
    listEl.innerHTML = '<p class="att-hint">Select a date above to see classes scheduled for that day.</p>';
    return;
  }

  listEl.innerHTML = '<p class="att-hint">Loading…</p>';

  try {
    const raw = await apiCall("class-schedule/read.php");
    const allSched = Array.isArray(raw) ? raw : (Array.isArray(raw.rows) ? raw.rows : []);

    const dow = new Date(date + "T12:00:00").getDay();
    const dayKey = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][dow];

    const matched = allSched.filter(row => {
      const from = (row.from_date || "").substring(0, 10);
      const upto = (row.upto_date && row.upto_date !== "0000-00-00") ? row.upto_date.substring(0, 10) : "";
      const activeOnDate = from <= date && (!upto || upto >= date);
      const hasTimingThisDay = !!(row[`${dayKey}_start`] && row[`${dayKey}_end`]);
      return activeOnDate && hasTimingThisDay;
    });

    const dateObj = new Date(date + "T12:00:00");
    const dateLabel = dateObj.toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });

    if (matched.length === 0) {
      listEl.innerHTML = `
        <div class="att-overview-head">
          <div class="att-overview-date">${escHtml(dateLabel)}</div>
        </div>
        <div class="att-overview-cards">
          <div class="att-overview-card"><span>Scheduled classes</span><strong>0</strong></div>
          <div class="att-overview-card"><span>Present</span><strong>0</strong></div>
          <div class="att-overview-card"><span>Absent</span><strong>0</strong></div>
          <div class="att-overview-card"><span>Reservation</span><strong>0</strong></div>
        </div>
        <p class="att-hint">No classes scheduled for this date.</p>
      `;
      return;
    }

    const detailRows = await Promise.all(matched.map(async row => {
      const classId = parseInt(row.class_id, 10) || 0;
      const students = classId
        ? await apiCall(`attendance/read.php?class_id=${encodeURIComponent(classId)}&date=${encodeURIComponent(date)}`)
        : [];

      const enrolled = Array.isArray(students) ? students.length : 0;
      let present = 0;
      let absent = 0;
      let reservation = 0;
      if (Array.isArray(students)) {
        students.forEach(s => {
          const st = String(s.attendance_status || "").toLowerCase();
          if (st === "present") present += 1;
          else if (st === "absent") absent += 1;
          else if (st === "late" || st === "excused") reservation += 1;
        });
      }

      return {
        row,
        classId,
        className: row.class_title || row.class_name || "-",
        timing: `${row[`${dayKey}_start`]} - ${row[`${dayKey}_end`]}`,
        center: row.center || "-",
        enrolled,
        present,
        absent,
        reservation
      };
    }));

    const totals = detailRows.reduce((acc, r) => {
      acc.present += r.present;
      acc.absent += r.absent;
      acc.reservation += r.reservation;
      return acc;
    }, { present: 0, absent: 0, reservation: 0 });

    const rowsHtml = detailRows.map(d => {
      const attendanceText = `${d.present} P / ${d.absent} A`;
      const safeClassArg = JSON.stringify(d.className || "").replace(/"/g, "&quot;");
      return `<tr>
        <td>
          <span class="att-class-initial">${escHtml((d.className || "?").charAt(0).toUpperCase())}</span>
          <div class="att-class-col">
            <div class="att-class-title">${escHtml(d.className)}</div>
            <div class="att-class-sub">${escHtml(d.timing)}</div>
          </div>
        </td>
        <td>${escHtml(d.center)}</td>
        <td>-</td>
        <td>${d.enrolled}</td>
        <td>${attendanceText}</td>
        <td class="att-actions-col">
          <button class="att-icon-btn" type="button" title="Make attendance"
            onclick="openAttendancePage(${d.classId}, ${safeClassArg}, '${date}')">+</button>
        </td>
      </tr>`;
    }).join("");

    listEl.innerHTML = `
      <div class="att-overview-head">
        <div class="att-overview-date">${escHtml(dateLabel)}</div>
      </div>
      <div class="att-overview-cards">
        <div class="att-overview-card"><span>Scheduled classes</span><strong>${matched.length}</strong></div>
        <div class="att-overview-card"><span>Present</span><strong>${totals.present}</strong></div>
        <div class="att-overview-card"><span>Absent</span><strong>${totals.absent}</strong></div>
        <div class="att-overview-card"><span>Reservation</span><strong>${totals.reservation}</strong></div>
      </div>
      <div class="att-table-wrap">
        <table class="plans-table att-summary-table">
          <thead>
            <tr>
              <th>Class</th>
              <th>Center</th>
              <th>Capacity</th>
              <th>Enrolled</th>
              <th>Attendance</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;

  } catch (err) {
    listEl.innerHTML = `<p class="att-hint" style="color:#dc2626">${escHtml(err.message)}</p>`;
  }
}

function openAttendancePage(classId, className, date) {
  const qs = new URLSearchParams({
    class_id: String(classId || 0),
    class_name: className || "",
    date: date || ""
  });
  window.location.href = `attendance-mark.html?${qs.toString()}`;
}

async function loadAttendanceMarkPage() {
  const params = new URLSearchParams(window.location.search);
  const classId = parseInt(params.get("class_id") || "0", 10);
  const className = params.get("class_name") || "";
  const date = params.get("date") || "";

  if (!classId || !date) {
    showMsg("msg", "Missing class/date in URL", false);
    return;
  }

  attCurrentClassId = classId;
  attCurrentClassName = className || "Class";
  attCurrentDate = date;

  const titleEl = document.getElementById("attendancePageTitle");
  const hintEl = document.getElementById("attendancePageHint");
  const dateEl = document.getElementById("attendancePageDate");
  const backEl = document.getElementById("attendanceBackLink");
  const backBottomEl = document.getElementById("attendanceBackLinkBottom");
  const tbody = document.getElementById("attendanceStudentBody");
  if (!tbody) return;

  if (titleEl) titleEl.textContent = `Mark Attendance - ${attCurrentClassName}`;
  if (hintEl) hintEl.textContent = "Mark each student as Present, Absent, Late, or Excused.";
  if (dateEl) dateEl.textContent = date;
  if (backEl) backEl.href = `attendance.html?date=${encodeURIComponent(date)}`;
  if (backBottomEl) backBottomEl.href = `attendance.html?date=${encodeURIComponent(date)}`;

  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Loading students…</td></tr>';

  try {
    const data = await apiCall(`attendance/read.php?class_id=${encodeURIComponent(classId)}&date=${encodeURIComponent(date)}`);
    const students = Array.isArray(data) ? data : (Array.isArray(data.students) ? data.students : []);

    if (students.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">No students enrolled in this class.</td></tr>';
      return;
    }

    tbody.innerHTML = students.map(s => {
      const status = s.attendance_status || "present";
      const notes = s.attendance_notes || "";
      const sid = parseInt(s.id, 10);
      const mk = val => `<td><input type="radio" name="att_${sid}" value="${val}" title="${val}" ${status === val ? "checked" : ""}></td>`;
      return `<tr>
        <td><button type="button" class="name-profile-link" onclick="openStudentProfile(${sid})">${escHtml(s.name)}</button></td>
        ${mk("present")}
        ${mk("absent")}
        ${mk("late")}
        ${mk("excused")}
        <td><input type="text" class="att-notes-input" data-sid="${sid}" placeholder="Notes" value="${escHtml(notes)}"></td>
      </tr>`;
    }).join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#dc2626">${escHtml(err.message)}</td></tr>`;
  }
}

async function submitAttendanceFromPage() {
  try {
    const tbody = document.getElementById("attendanceStudentBody");
    if (!tbody) return;

    const records = [];
    tbody.querySelectorAll("tr").forEach(row => {
      const checked = row.querySelector('input[type="radio"]:checked');
      if (!checked) return;
      const sid = parseInt(checked.name.replace("att_", ""), 10);
      if (!sid) return;
      const notesEl = row.querySelector(".att-notes-input");
      records.push({ student_id: sid, status: checked.value, notes: notesEl ? notesEl.value.trim() : "" });
    });

    if (records.length === 0) throw new Error("No students to save");

    await apiCall("attendance/save.php", "POST", {
      class_id: attCurrentClassId,
      date: attCurrentDate,
      records
    });

    window.location.href = `attendance.html?date=${encodeURIComponent(attCurrentDate)}`;
  } catch (err) {
    showMsg("msg", err.message, false);
  }
}

function markAllAttendance(status) {
  const allowed = ["present", "absent", "late", "excused"];
  if (!allowed.includes(status)) return;
  const tbody = document.getElementById("attendanceStudentBody");
  if (!tbody) return;

  tbody.querySelectorAll("tr").forEach(row => {
    const radio = row.querySelector(`input[type="radio"][value="${status}"]`);
    if (radio) radio.checked = true;
  });
}

async function openAttendanceModal(classId, className, date) {
  attCurrentClassId = classId;
  attCurrentClassName = className;
  attCurrentDate = date;

  const modal = document.getElementById("attendanceModal");
  const titleEl = document.getElementById("attendanceModalTitle");
  const hintEl = document.getElementById("attendanceModalHint");
  const tbody = document.getElementById("attendanceStudentBody");
  if (!modal || !tbody) return;

  if (titleEl) titleEl.textContent = `Attendance — ${className}`;
  if (hintEl) hintEl.textContent = `${date} · Mark each student present, absent, late, or excused.`;

  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Loading students…</td></tr>';
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");

  try {
    const data = await apiCall(`attendance/read.php?class_id=${encodeURIComponent(classId)}&date=${encodeURIComponent(date)}`);
    const students = Array.isArray(data) ? data : (Array.isArray(data.students) ? data.students : []);

    if (students.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">No students enrolled in this class.</td></tr>';
      return;
    }

    tbody.innerHTML = students.map(s => {
      const status = s.attendance_status || "present";
      const notes = s.attendance_notes || "";
      const sid = parseInt(s.id, 10);
      const mk = val => `<td><input type="radio" name="att_${sid}" value="${val}" title="${val}" ${status === val ? "checked" : ""}></td>`;
      return `<tr>
        <td><button type="button" class="name-profile-link" onclick="openStudentProfile(${sid})">${escHtml(s.name)}</button></td>
        ${mk("present")}
        ${mk("absent")}
        ${mk("late")}
        ${mk("excused")}
        <td><input type="text" class="att-notes-input" data-sid="${sid}" placeholder="Notes" value="${escHtml(notes)}"></td>
      </tr>`;
    }).join("");

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#dc2626">${escHtml(err.message)}</td></tr>`;
  }
}

function closeAttendanceModal() {
  const modal = document.getElementById("attendanceModal");
  if (!modal) return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
  attCurrentClassId = 0;
}

async function submitAttendance() {
  try {
    const tbody = document.getElementById("attendanceStudentBody");
    if (!tbody) return;

    const records = [];
    tbody.querySelectorAll("tr").forEach(row => {
      const checked = row.querySelector('input[type="radio"]:checked');
      if (!checked) return;
      const sid = parseInt(checked.name.replace("att_", ""), 10);
      if (!sid) return;
      const notesEl = row.querySelector(".att-notes-input");
      records.push({ student_id: sid, status: checked.value, notes: notesEl ? notesEl.value.trim() : "" });
    });

    if (records.length === 0) throw new Error("No students to save");

    await apiCall("attendance/save.php", "POST", {
      class_id: attCurrentClassId,
      date: attCurrentDate,
      records
    });

    closeAttendanceModal();
    showMsg("msg", `Attendance saved for ${attCurrentClassName}`, true);
    await onAttendanceDateChange();
  } catch (err) {
    showMsg("msg", err.message, false);
  }
}

// ── End Attendance ────────────────────────────────────────────────────────────

function setSalesSubmenuActive(page) {
  const salesLinks = document.querySelectorAll('.sidebar-submenu a');
  if (!salesLinks.length) return;

  salesLinks.forEach(link => link.classList.remove('active'));
  if (page !== 'payments') return;

  const tab = new URLSearchParams(window.location.search).get('tab') || 'invoices';
  const target = document.querySelector(`.sidebar-submenu a[href="payments.html?tab=${tab}"]`)
    || document.querySelector('.sidebar-submenu a[href="payments.html?tab=invoices"]');
  if (target) target.classList.add('active');
}

function initSalesMenu(page) {
  const group = document.querySelector('.sidebar-group');
  const toggle = document.querySelector('.sidebar-group-title');
  const caret = document.querySelector('.sidebar-caret');
  if (!group || !toggle) return;

  const setOpen = isOpen => {
    group.classList.toggle('is-open', isOpen);
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    if (caret) caret.textContent = isOpen ? '-' : '+';
  };

  setOpen(page === 'payments');

  toggle.addEventListener('click', () => {
    setOpen(!group.classList.contains('is-open'));
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const page = document.body.dataset.page;
  if (!page) return;

  setSalesSubmenuActive(page);
  initSalesMenu(page);

  try {
    await checkAuth();

    if (page === "dashboard") {
      await loadDashboard();
    }
    if (page === "students") {
      await loadStudents();
    }
    if (page === "student-profile") {
      await loadStudentProfile();
    }
    if (page === "payments") {
      await loadStudentsIntoSelect("filterStudent");

      const filterStudent = document.getElementById("filterStudent");
      if (filterStudent && filterStudent.options.length > 0) {
        filterStudent.options[0].textContent = "All students";
      }

      const pendingFilter = document.getElementById("pendingStatusFilter");
      if (pendingFilter && !pendingFilter.dataset.bound) {
        pendingFilter.dataset.bound = "1";
        pendingFilter.addEventListener("change", () => {
          const sid = parseInt(document.getElementById("filterStudent")?.value || 0, 10);
          resetListPage("payments");
          loadPayments(sid);
        });
      }

      const pendingSearchInput = document.getElementById("pendingSearchInput");
      if (pendingSearchInput && !pendingSearchInput.dataset.bound) {
        pendingSearchInput.dataset.bound = "1";
        pendingSearchInput.addEventListener("input", () => {
          const sid = parseInt(document.getElementById("filterStudent")?.value || 0, 10);
          resetListPage("payments");
          loadPayments(sid);
        });
      }

      const paymentSearchInput = document.getElementById("paymentSearchInput");
      if (paymentSearchInput && !paymentSearchInput.dataset.bound) {
        paymentSearchInput.dataset.bound = "1";
        paymentSearchInput.addEventListener("input", () => {
          const tab = getPaymentsTab();
          if (tab !== "received" && tab !== "invoices") return;
          resetListPage("payments");
          loadPayments(0);
        });
      }

      await loadPayments();
    }
    if (page === "expenses") {
      await initExpensesPage();
    }
    if (page === "reports") {
      await initReportsPage();
    }
    if (page === "settings") {
      await loadExchangeRateSettings();
    }
    if (page === "plans") {
      await loadPlans("subscription");
    }
    if (page === "renewals") {
      await loadRenewals();
    }
    if (page === "attendance") {
      // default date picker to today, or use query date if provided
      const todayEl = document.getElementById("attendanceDatePicker");
      if (todayEl) {
        const params = new URLSearchParams(window.location.search);
        const urlDate = params.get("date") || "";
        const pad = n => String(n).padStart(2, "0");
        const now = new Date();
        todayEl.value = urlDate || `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        await onAttendanceDateChange();
      }
    }
    if (page === "attendance-mark") {
      await loadAttendanceMarkPage();
    }
    if (page === "classes") {
      await loadClassPlansIntoSelect();
      await loadClasses();
    }
    if (page === "class-schedule") {
      await loadSchedules();
      const prefill = getSchedulePrefill();
      if (prefill) {
        openScheduleForm(prefill);
      }
    }
  } catch (err) {
    showMsg("msg", err.message, false);
  }
});
