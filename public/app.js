const app = document.getElementById("app");
const toastStack = document.getElementById("toastStack");
const loadingOverlay = document.getElementById("loadingOverlay");
const logoutButton = document.getElementById("logoutButton");
const authNavButton = document.getElementById("authNavButton");
const topnav = document.getElementById("topnav");
const mobileMenuButton = document.getElementById("mobileMenuButton");

const state = {
  route: "landing",
  authMode: "login",
  user: null,
  token: localStorage.getItem("scfs_token") || "",
  complaints: [],
  stats: null,
  filters: {
    status: "",
    category: "",
    search: ""
  }
};

const categories = ["Academics", "Hostel", "Finance", "Discipline", "Others"];
const statuses = ["Pending", "In Progress", "Resolved"];

mobileMenuButton.addEventListener("click", () => {
  topnav.classList.toggle("open");
});

document.querySelectorAll("[data-route]").forEach((button) => {
  button.addEventListener("click", () => {
    navigate(button.dataset.route);
    topnav.classList.remove("open");
  });
});

logoutButton.addEventListener("click", () => {
  localStorage.removeItem("scfs_token");
  state.token = "";
  state.user = null;
  state.complaints = [];
  state.stats = null;
  syncNav();
  showToast("You have been logged out.", "info");
  navigate("landing");
});

function showLoading(isLoading) {
  loadingOverlay.classList.toggle("hidden", !isLoading);
}

function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastStack.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

function syncNav() {
  const isAuthed = Boolean(state.user);
  logoutButton.classList.toggle("hidden", !isAuthed);
  authNavButton.textContent = isAuthed ? state.user.name.split(" ")[0] : "Login";
}

function navigate(route) {
  state.route = route;
  render();
}

function formatDate(value) {
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function statusClass(status) {
  if (status === "Resolved") return "resolved";
  if (status === "In Progress") return "in-progress";
  return "pending";
}

async function apiFetch(url, options = {}) {
  const headers = options.body instanceof FormData ? {} : { "Content-Type": "application/json" };

  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Request failed.");
  }

  return data;
}

async function hydrateSession() {
  if (!state.token) {
    render();
    return;
  }

  try {
    showLoading(true);
    const data = await apiFetch("/me");
    state.user = data.user;
    syncNav();
  } catch (_error) {
    localStorage.removeItem("scfs_token");
    state.token = "";
    state.user = null;
  } finally {
    showLoading(false);
    render();
  }
}

async function loadComplaints() {
  const params = new URLSearchParams();
  if (state.filters.status) params.set("status", state.filters.status);
  if (state.filters.category) params.set("category", state.filters.category);
  if (state.filters.search) params.set("search", state.filters.search);
  const data = await apiFetch(`/get-complaints?${params.toString()}`);
  state.complaints = data.complaints;
}

async function loadStats() {
  if (state.user?.role !== "admin") return;
  state.stats = await apiFetch("/stats");
}

function adminControls(complaint) {
  return `
    <form class="inline-actions admin-response-form" data-id="${complaint.id}">
      <select name="status">
        ${statuses.map((status) => `<option value="${status}" ${status === complaint.status ? "selected" : ""}>${status}</option>`).join("")}
      </select>
      <input type="text" name="response" placeholder="Send a response" value="${complaint.response || ""}" />
      <button class="btn secondary" type="submit">Update</button>
    </form>
  `;
}

function complaintCard(complaint, isAdmin = false) {
  const attachment = complaint.file_name
    ? `<a class="pill" href="/uploads/${complaint.file_name}" target="_blank" rel="noreferrer"><i class="fa-solid fa-paperclip"></i> Attachment</a>`
    : "";
  const response = complaint.response
    ? `<div class="support-note"><strong>Admin Response</strong><p>${complaint.response}</p></div>`
    : `<div class="support-note"><strong>Admin Response</strong><p class="muted">No response yet. The administration will update you here.</p></div>`;

  return `
    <article class="complaint-card">
      <div class="topline">
        <div>
          <h3>${complaint.title}</h3>
          <p class="muted">${isAdmin ? `${complaint.student_name} | ${complaint.student_email}` : "Submitted complaint"}</p>
        </div>
        <div class="badge-row">
          <span class="badge category">${complaint.category}</span>
          <span class="badge ${statusClass(complaint.status)}">${complaint.status}</span>
        </div>
      </div>
      <p>${complaint.description}</p>
      <div class="complaint-meta">
        <span class="pill"><i class="fa-regular fa-clock"></i> ${formatDate(complaint.created_at)}</span>
        ${attachment}
      </div>
      ${response}
      ${isAdmin ? adminControls(complaint) : ""}
    </article>
  `;
}

function emptyState(title, body) {
  return `
    <div class="empty-state">
      <i class="fa-regular fa-folder-open"></i>
      <h3>${title}</h3>
      <p>${body}</p>
    </div>
  `;
}

function landingView() {
  return `
    <section class="screen">
      <div class="hero">
        <div class="hero-card">
          <div class="hero-copy">
            <p class="eyebrow">Student Voice. Trusted Follow-Up.</p>
            <h2>Raise concerns, share feedback, and follow every case with confidence at UoEm.</h2>
            <p>UoEm Student's Voice helps students report issues, reach the right office faster, and stay updated from submission through response and resolution.</p>
            <div class="hero-actions">
              <button class="btn primary" onclick="navigate('auth')">Get Started</button>
              <button class="btn secondary" onclick="navigate('submit')">Submit a Complaint</button>
            </div>
            <div class="hero-stats">
              <div class="stat-chip"><strong>24/7</strong><span>Access from any device</span></div>
              <div class="stat-chip"><strong>5</strong><span>Complaint categories supported</span></div>
              <div class="stat-chip"><strong>Real-time</strong><span>Status tracking and responses</span></div>
            </div>
          </div>
        </div>
        <aside class="glass-card hero-showcase">
          <img src="/assets/uoem-logo.jpg" alt="University of Embu logo" />
          <span class="pill"><i class="fa-solid fa-graduation-cap"></i> University of Embu</span>
          <h3>Knowledge Transforms</h3>
          <p class="muted">A focused digital space for complaints, follow-up, and student feedback at UoEm.</p>
        </aside>
      </div>
      <section class="page-shell-inner">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Platform Highlights</p>
            <h2>Everything needed for a realistic UoEm complaint workflow</h2>
          </div>
        </div>
        <div class="feature-grid">
          <div class="feature-card">
            <i class="fa-solid fa-file-circle-plus"></i>
            <h3>Submit with details</h3>
            <p class="muted">Students can add a title, category, description, and optional attachment in one guided form.</p>
          </div>
          <div class="feature-card">
            <i class="fa-solid fa-chart-column"></i>
            <h3>Track every case</h3>
            <p class="muted">See pending, in-progress, and resolved cases with timestamps and administrative responses.</p>
          </div>
          <div class="feature-card">
            <i class="fa-solid fa-user-gear"></i>
            <h3>Admin resolution tools</h3>
            <p class="muted">Filter, search, respond, and update complaint status from one dashboard.</p>
          </div>
        </div>
      </section>
    </section>
  `;
}

function authView() {
  return `
    <section class="screen">
      <div class="auth-grid">
        <div class="info-card">
          <span class="pill"><i class="fa-solid fa-building-columns"></i> School Portal</span>
          <h2>Welcome to the UoEm student support portal.</h2>
          <p class="muted">Use the demo accounts or create a new student profile. Admin access lets staff review and resolve complaints.</p>
          <div class="cards-grid">
            <div class="support-note"><strong>Admin Demo</strong><p>Email: admin@uoem.ac.ke</p><p>Password: Admin@123</p></div>
            <div class="support-note"><strong>Student Demo</strong><p>Email: student@uoem.ac.ke</p><p>Password: Student@123</p></div>
          </div>
        </div>
        <div class="auth-card">
          <div class="segment-control">
            <button class="${state.authMode === "login" ? "active" : ""}" onclick="switchAuthMode('login')">Login</button>
            <button class="${state.authMode === "register" ? "active" : ""}" onclick="switchAuthMode('register')">Register</button>
          </div>
          <h2>${state.authMode === "login" ? "Sign in to your account" : "Create a new account"}</h2>
          <form id="authForm" class="form-grid">
            ${state.authMode === "register" ? `<div class="field full"><label for="name">Full Name</label><input id="name" name="name" placeholder="Amina Otieno" required /></div>` : ""}
            <div class="field full"><label for="email">Email Address</label><input id="email" type="email" name="email" placeholder="student@uoem.ac.ke" required /></div>
            <div class="field full"><label for="password">Password</label><input id="password" type="password" name="password" placeholder="Enter password" required /></div>
            ${state.authMode === "register" ? `<div class="field full"><label for="role">Account Role</label><select id="role" name="role"><option value="student">Student</option><option value="admin">Admin</option></select><p class="field-hint">For classroom demos you can register both roles. In a real deployment, admin creation should be restricted.</p></div>` : ""}
            <div class="field full"><button class="btn primary" type="submit">${state.authMode === "login" ? "Login" : "Create Account"}</button></div>
          </form>
        </div>
      </div>
    </section>
  `;
}

function submitView() {
  const needsAuth = !state.user;
  return `
    <section class="screen page-shell-inner">
      <div class="page-header">
        <div class="page-title">
          <p class="eyebrow">Complaint Submission</p>
          <h2>Share what needs attention</h2>
        </div>
        <span class="pill"><i class="fa-solid fa-circle-info"></i> Attach files up to 5MB</span>
      </div>
      <div class="cards-grid">
        <form class="auth-card" id="complaintForm">
          <div class="form-grid">
            <div class="field full"><label for="title">Complaint Title</label><input id="title" name="title" placeholder="Briefly summarize the issue" ${needsAuth ? "disabled" : ""} required /></div>
            <div class="field"><label for="category">Category</label><select id="category" name="category" ${needsAuth ? "disabled" : ""}>${categories.map((category) => `<option value="${category}">${category}</option>`).join("")}</select></div>
            <div class="field"><label for="attachment">Optional File</label><input id="attachment" name="attachment" type="file" ${needsAuth ? "disabled" : ""} /></div>
            <div class="field full"><label for="description">Description</label><textarea id="description" name="description" placeholder="Explain the issue in detail..." ${needsAuth ? "disabled" : ""} required></textarea></div>
            <div class="field full"><button class="btn primary" type="submit" ${needsAuth ? "disabled" : ""}>Submit Complaint</button></div>
          </div>
        </form>
        <div class="info-card">
          <div class="card-icon"><i class="fa-solid fa-lightbulb"></i></div>
          <h3>Tips for better responses</h3>
          <p class="muted">Be specific, include dates or locations, and attach evidence if available. This helps the school act faster.</p>
          ${needsAuth
            ? `<div class="support-note"><strong>Login Required</strong><p>You need to sign in before submitting a complaint.</p><button class="btn secondary" onclick="navigate('auth')">Go to Login</button></div>`
            : `<div class="support-note"><strong>Signed in as</strong><p>${state.user.name} (${state.user.role})</p></div>`
          }
        </div>
      </div>
    </section>
  `;
}

function trackView() {
  const complaintsHtml = state.complaints.length
    ? state.complaints.map((complaint) => complaintCard(complaint)).join("")
    : emptyState("No complaints found", "Your submitted complaints will appear here with status updates and responses.");

  return `
    <section class="screen page-shell-inner">
      <div class="page-header">
        <div class="page-title">
          <p class="eyebrow">Complaint Tracking</p>
          <h2>Follow each issue from report to resolution</h2>
        </div>
        <button class="btn secondary" onclick="refreshTrackPage()">Refresh Status</button>
      </div>
      <div class="tracking-grid">
        <div class="table-card">
          <h3>Your complaints</h3>
          <p class="muted">Track progress, timestamps, and responses from administration.</p>
          <div class="complaint-list">${complaintsHtml}</div>
        </div>
        <div class="info-card">
          <h3>Status Journey</h3>
          <div class="timeline">
            <div class="timeline-item"><div class="timeline-dot"></div><div><strong>Pending</strong><p class="muted">Your complaint has been received and is waiting to be reviewed.</p></div></div>
            <div class="timeline-item"><div class="timeline-dot"></div><div><strong>In Progress</strong><p class="muted">The relevant office is investigating or handling the issue.</p></div></div>
            <div class="timeline-item"><div class="timeline-dot"></div><div><strong>Resolved</strong><p class="muted">The complaint has been addressed and a final response is available.</p></div></div>
          </div>
        </div>
      </div>
    </section>
  `;
}

function studentDashboardView() {
  const total = state.complaints.length;
  const resolved = state.complaints.filter((item) => item.status === "Resolved").length;
  const pending = state.complaints.filter((item) => item.status === "Pending").length;
  const inProgress = state.complaints.filter((item) => item.status === "In Progress").length;
  const recent = state.complaints.slice(0, 3);

  return `
    <section class="screen dashboard-shell">
      <div class="dashboard-header">
        <div>
          <p class="eyebrow">Student Dashboard</p>
          <h2>Welcome back, ${state.user?.name || "Student"}</h2>
          <p class="muted">Monitor your active concerns and submit new feedback at any time.</p>
        </div>
        <div class="stack-actions">
          <button class="btn primary" onclick="navigate('submit')">New Complaint</button>
          <button class="btn secondary" onclick="refreshStudentDashboard()">Refresh</button>
        </div>
      </div>
      <div class="stats-grid">
        <div class="stat-card"><strong>${total}</strong><p>Total complaints</p></div>
        <div class="stat-card"><strong>${pending}</strong><p>Pending review</p></div>
        <div class="stat-card"><strong>${inProgress}</strong><p>Currently in progress</p></div>
        <div class="stat-card"><strong>${resolved}</strong><p>Resolved cases</p></div>
      </div>
      <div class="dashboard-grid">
        <div class="table-card">
          <h3>Recent activity</h3>
          <div class="complaint-list">${recent.length ? recent.map((complaint) => complaintCard(complaint)).join("") : emptyState("No complaints yet", "Submit your first complaint to begin tracking updates.")}</div>
        </div>
        <div class="chart-card">
          <h3>Student overview</h3>
          <div class="chart-wrap">
            ${[
              { label: "Pending", value: pending, total: total || 1 },
              { label: "In Progress", value: inProgress, total: total || 1 },
              { label: "Resolved", value: resolved, total: total || 1 }
            ].map((item) => `<div class="bar-row"><span>${item.label}</span><div class="bar-track"><div class="bar-fill" style="width:${(item.value / item.total) * 100}%"></div></div><strong>${item.value}</strong></div>`).join("")}
          </div>
        </div>
      </div>
    </section>
  `;
}

function adminDashboardView() {
  const stats = state.stats || { total: 0, pending: 0, inProgress: 0, resolved: 0, categories: [] };
  const complaintsHtml = state.complaints.length
    ? state.complaints.map((complaint) => complaintCard(complaint, true)).join("")
    : emptyState("No complaints match these filters", "Try changing the category, status, or search value.");

  return `
    <section class="screen dashboard-shell">
      <div class="dashboard-header">
        <div>
          <p class="eyebrow">Admin Dashboard</p>
          <h2>Complaint management and analytics</h2>
          <p class="muted">Review student complaints, search records, update statuses, and send responses.</p>
        </div>
        <div class="stack-actions"><button class="btn secondary" onclick="refreshAdminDashboard()">Refresh Dashboard</button></div>
      </div>
      <div class="stats-grid">
        <div class="stat-card"><strong>${stats.total}</strong><p>Total complaints</p></div>
        <div class="stat-card"><strong>${stats.pending}</strong><p>Pending</p></div>
        <div class="stat-card"><strong>${stats.inProgress}</strong><p>In Progress</p></div>
        <div class="stat-card"><strong>${stats.resolved}</strong><p>Resolved</p></div>
      </div>
      <div class="dashboard-grid">
        <div class="table-card">
          <h3>Complaint directory</h3>
          <p class="muted">Filter by category or status, and search by student or complaint details.</p>
          <form id="filterForm" class="filter-row">
            <select name="status"><option value="">All statuses</option>${statuses.map((status) => `<option value="${status}" ${state.filters.status === status ? "selected" : ""}>${status}</option>`).join("")}</select>
            <select name="category"><option value="">All categories</option>${categories.map((category) => `<option value="${category}" ${state.filters.category === category ? "selected" : ""}>${category}</option>`).join("")}</select>
            <input type="text" name="search" placeholder="Search complaints" value="${state.filters.search}" />
            <button class="btn secondary" type="submit">Apply</button>
          </form>
          <div class="complaint-list">${complaintsHtml}</div>
        </div>
        <div class="chart-card">
          <h3>Complaint categories</h3>
          <div class="chart-wrap">
            ${(stats.categories || []).length
              ? stats.categories.map((item) => `<div class="bar-row"><span>${item.category}</span><div class="bar-track"><div class="bar-fill" style="width:${(item.count / Math.max(stats.total, 1)) * 100}%"></div></div><strong>${item.count}</strong></div>`).join("")
              : "<p class='muted'>No category data yet.</p>"
            }
          </div>
        </div>
      </div>
    </section>
  `;
}

function render() {
  syncNav();
  document.querySelectorAll(".nav-link[data-route]").forEach((link) => {
    link.classList.toggle("active", link.dataset.route === state.route);
  });

  if (state.route === "student-dashboard" && !state.user) {
    state.route = "auth";
  }

  if (state.route === "admin-dashboard" && state.user?.role !== "admin") {
    state.route = state.user ? "student-dashboard" : "auth";
  }

  let html = "";
  if (state.route === "landing") html = landingView();
  if (state.route === "auth") html = authView();
  if (state.route === "submit") html = submitView();
  if (state.route === "track") html = trackView();
  if (state.route === "student-dashboard") html = studentDashboardView();
  if (state.route === "admin-dashboard") html = adminDashboardView();

  app.innerHTML = html;
  bindForms();
}

function bindForms() {
  const authForm = document.getElementById("authForm");
  if (authForm) authForm.addEventListener("submit", handleAuthSubmit);

  const complaintForm = document.getElementById("complaintForm");
  if (complaintForm) complaintForm.addEventListener("submit", handleComplaintSubmit);

  const filterForm = document.getElementById("filterForm");
  if (filterForm) filterForm.addEventListener("submit", handleFilterSubmit);

  document.querySelectorAll(".admin-response-form").forEach((form) => {
    form.addEventListener("submit", handleAdminUpdate);
  });
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const payload = Object.fromEntries(formData.entries());
  const endpoint = state.authMode === "login" ? "/login" : "/register";

  try {
    showLoading(true);
    const data = await apiFetch(endpoint, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    state.token = data.token;
    state.user = data.user;
    localStorage.setItem("scfs_token", data.token);
    syncNav();
    showToast(data.message, "success");
    await loadComplaints();
    if (state.user.role === "admin") {
      await loadStats();
      navigate("admin-dashboard");
    } else {
      navigate("student-dashboard");
    }
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    showLoading(false);
  }
}

async function handleComplaintSubmit(event) {
  event.preventDefault();
  if (!state.user) {
    showToast("Please login before submitting a complaint.", "error");
    navigate("auth");
    return;
  }

  const formData = new FormData(event.currentTarget);

  try {
    showLoading(true);
    const data = await apiFetch("/submit-complaint", {
      method: "POST",
      body: formData
    });
    showToast(data.message, "success");
    event.currentTarget.reset();
    await loadComplaints();
    if (state.user.role === "admin") {
      await loadStats();
    }
    navigate("track");
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    showLoading(false);
  }
}

async function handleFilterSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  state.filters = {
    status: formData.get("status"),
    category: formData.get("category"),
    search: formData.get("search")
  };

  try {
    showLoading(true);
    await loadComplaints();
    render();
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    showLoading(false);
  }
}

async function handleAdminUpdate(event) {
  event.preventDefault();
  const complaintId = event.currentTarget.dataset.id;
  const formData = new FormData(event.currentTarget);

  try {
    showLoading(true);
    await apiFetch(`/update-status/${complaintId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: formData.get("status") })
    });
    await apiFetch(`/respond/${complaintId}`, {
      method: "PATCH",
      body: JSON.stringify({ response: formData.get("response") || "Status updated by administration." })
    });
    await Promise.all([loadComplaints(), loadStats()]);
    showToast("Complaint updated successfully.", "success");
    render();
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    showLoading(false);
  }
}

function switchAuthMode(mode) {
  state.authMode = mode;
  render();
}

async function refreshStudentDashboard() {
  try {
    showLoading(true);
    await loadComplaints();
    render();
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    showLoading(false);
  }
}

async function refreshTrackPage() {
  await refreshStudentDashboard();
}

async function refreshAdminDashboard() {
  try {
    showLoading(true);
    await Promise.all([loadComplaints(), loadStats()]);
    render();
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    showLoading(false);
  }
}

window.navigate = navigate;
window.switchAuthMode = switchAuthMode;
window.refreshStudentDashboard = refreshStudentDashboard;
window.refreshTrackPage = refreshTrackPage;
window.refreshAdminDashboard = refreshAdminDashboard;

hydrateSession().then(async () => {
  if (state.user) {
    try {
      showLoading(true);
      await loadComplaints();
      if (state.user.role === "admin") {
        await loadStats();
      }
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      showLoading(false);
      render();
    }
  } else {
    render();
  }
});
