// Build API base so deployment works in /public_html and subfolders.
const basePath = window.location.pathname.includes("/Frontend/")
  ? window.location.pathname.split("/Frontend/")[0]
  : "";
const API = `${window.location.origin}${basePath}/Backend-PHP/api`;

function endpoint(file) {
  return `${API}/${file}`;
}

function login() {
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  if (!emailInput || !passwordInput) return;

  fetch(endpoint("login.php"), {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      email: emailInput.value,
      password: passwordInput.value
    })
  })
  .then(async res => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || "Login failed");
    }
    return data;
  })
  .then(data => {
    localStorage.setItem("user", JSON.stringify(data));
    window.location = "dashboard.html";
  })
  .catch(err => {
    alert(err.message || "Unable to reach server");
  });
}

// SWITCH SECTIONS
function showSection(section) {
  const dashboardSection = document.getElementById("dashboardSection");
  const studentsSection = document.getElementById("studentsSection");
  const financeSection = document.getElementById("financeSection");
  const attendanceSection = document.getElementById("attendanceSection");

  if (dashboardSection) dashboardSection.style.display = "none";
  if (studentsSection) studentsSection.style.display = "none";
  if (financeSection) financeSection.style.display = "none";
  if (attendanceSection) attendanceSection.style.display = "none";

  const target = document.getElementById(section + "Section");
  if (target) target.style.display = "block";
}


// LOAD STUDENTS
function loadStudents() {
  fetch(endpoint("students.php"))
    .then(res => res.json())
    .then(data => {
      const studentTable = document.getElementById("studentTable");
      const totalStudents = document.getElementById("totalStudents");
      if (!studentTable || !totalStudents) return;

      let html = "";
      data.forEach(s => {
        html += `<tr>
          <td>${s.name}</td>
          <td>${s.status}</td>
        </tr>`;
      });
      studentTable.innerHTML = html;
      totalStudents.innerText = data.length;
    });
}


// ADD STUDENT
function addStudent() {
  const studentName = document.getElementById("studentName");
  if (!studentName) return;

  fetch(endpoint("students.php"), {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      name: studentName.value
    })
  }).then(() => loadStudents());
}


// FINANCE
function addIncome() {
  const incomeAmount = document.getElementById("incomeAmount");
  if (!incomeAmount) return;

  fetch(endpoint("income.php"), {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ amount: incomeAmount.value })
  }).then(loadSummary);
}

function addExpense() {
  const expenseAmount = document.getElementById("expenseAmount");
  if (!expenseAmount) return;

  fetch(endpoint("expense.php"), {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ amount: expenseAmount.value })
  }).then(loadSummary);
}

function loadSummary() {
  fetch(endpoint("summary.php"))
    .then(res => res.json())
    .then(data => {
      const totalIncome = document.getElementById("totalIncome");
      const balance = document.getElementById("balance");
      if (!totalIncome || !balance) return;

      totalIncome.innerText = data.income || 0;
      balance.innerText = data.balance || 0;
    });
}


function loadAttendanceStudents() {
  fetch(endpoint("students.php"))
    .then(res => res.json())
    .then(data => {
      const attendanceStudents = document.getElementById("attendanceStudents");
      if (!attendanceStudents) return;

      let html = "";
      data.forEach(s => {
        html += `
          <tr>
            <td>${s.name}</td>
            <td>
              <button onclick="markAttendance(${s.id}, 'present')">Present</button>
              <button onclick="markAttendance(${s.id}, 'absent')">Absent</button>
            </td>
          </tr>
        `;
      });
      attendanceStudents.innerHTML = html;
    });
}

function markAttendance(student_id, status) {
  fetch(endpoint("attendance.php"), {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ student_id, status })
  }).then(() => loadAttendance());
}

function loadAttendance() {
  fetch(endpoint("attendance.php"))
    .then(res => res.json())
    .then(data => {
      const attendanceTable = document.getElementById("attendanceTable");
      if (!attendanceTable) return;

      let html = "";
      data.forEach(a => {
        html += `
          <tr>
            <td>${a.name}</td>
            <td>${a.date}</td>
            <td>${a.status}</td>
          </tr>
        `;
      });
      attendanceTable.innerHTML = html;
    });
}

// INITIAL LOAD (dashboard page only)
if (document.getElementById("dashboardSection")) {
  loadStudents();
  loadSummary();
  loadAttendanceStudents();
  loadAttendance();
}