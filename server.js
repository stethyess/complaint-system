const express = require("express");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const initSqlJs = require("sql.js");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret-in-production";
const DB_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DB_DIR, "app.sqlite");
const UPLOAD_DIR = path.join(__dirname, "uploads");

fs.mkdirSync(DB_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

let db;

function saveDatabase() {
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

function run(sql, params = []) {
  const statement = db.prepare(sql);
  statement.run(params);
  statement.free();
  saveDatabase();
}

function queryAll(sql, params = []) {
  const statement = db.prepare(sql);
  statement.bind(params);
  const rows = [];

  while (statement.step()) {
    rows.push(statement.getAsObject());
  }

  statement.free();
  return rows;
}

function queryOne(sql, params = []) {
  return queryAll(sql, params)[0] || null;
}

function seedDatabase() {
  const userCount = Number(queryOne("SELECT COUNT(*) AS count FROM users").count);
  if (userCount > 0) return;

  const now = new Date().toISOString();
  const adminPassword = bcrypt.hashSync("Admin@123", 10);
  const studentPassword = bcrypt.hashSync("Student@123", 10);

  run(
    "INSERT INTO users (name, email, password, role, created_at) VALUES (?, ?, ?, ?, ?)",
    ["UoEm Admin", "admin@uoem.ac.ke", adminPassword, "admin", now]
  );
  run(
    "INSERT INTO users (name, email, password, role, created_at) VALUES (?, ?, ?, ?, ?)",
    ["Amina Otieno", "student@uoem.ac.ke", studentPassword, "student", now]
  );

  const student = queryOne("SELECT id FROM users WHERE email = ?", ["student@uoem.ac.ke"]);
  [
    [
      student.id,
      "Delay in exam timetable release",
      "Academics",
      "The semester exam timetable has not been posted and students are unsure how to plan revision.",
      "In Progress",
      "The academic office is finalizing the timetable and will publish it by Friday.",
      "",
      now,
      now
    ],
    [
      student.id,
      "Water shortage in hostel block B",
      "Hostel",
      "Hostel Block B has had low water pressure for three days.",
      "Resolved",
      "Maintenance repaired the faulty pump and water service is back.",
      "",
      now,
      now
    ],
    [
      student.id,
      "Fee statement mismatch",
      "Finance",
      "The portal still shows a balance after payment was made last week.",
      "Pending",
      "",
      "",
      now,
      now
    ]
  ].forEach((entry) => {
    run(
      `INSERT INTO complaints
      (user_id, title, category, description, status, response, file_name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      entry
    );
  });
}

function createToken(user) {
  return jwt.sign({ id: Number(user.id), name: user.name, email: user.email, role: user.role }, JWT_SECRET, {
    expiresIn: "7d"
  });
}

function migrateBrandingData() {
  run("UPDATE users SET email = ? WHERE email = ?", ["admin@uoem.ac.ke", "admin@greenfield.edu"]);
  run("UPDATE users SET email = ? WHERE email = ?", ["student@uoem.ac.ke", "student@greenfield.edu"]);
  run("UPDATE users SET name = ? WHERE email = ?", ["UoEm Admin", "admin@uoem.ac.ke"]);
}

function sanitizeUser(user) {
  return {
    id: Number(user.id),
    name: user.name,
    email: user.email,
    role: user.role
  };
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Authentication token missing." });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (_error) {
    return res.status(403).json({ message: "Invalid or expired token." });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required." });
  }
  return next();
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_")}`)
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(UPLOAD_DIR));
app.use(express.static(path.join(__dirname, "public")));

app.post("/register", async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Name, email, and password are required." });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedRole = role === "admin" ? "admin" : "student";
  const existingUser = queryOne("SELECT id FROM users WHERE email = ?", [normalizedEmail]);

  if (existingUser) {
    return res.status(409).json({ message: "An account with this email already exists." });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const createdAt = new Date().toISOString();
  run(
    "INSERT INTO users (name, email, password, role, created_at) VALUES (?, ?, ?, ?, ?)",
    [name.trim(), normalizedEmail, hashedPassword, normalizedRole, createdAt]
  );

  const user = queryOne("SELECT id, name, email, role FROM users WHERE email = ?", [normalizedEmail]);
  return res.status(201).json({
    message: "Registration successful.",
    token: createToken(user),
    user: sanitizeUser(user)
  });
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." });
  }

  const user = queryOne("SELECT * FROM users WHERE email = ?", [email.trim().toLowerCase()]);
  if (!user) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

  return res.json({
    message: "Login successful.",
    token: createToken(user),
    user: sanitizeUser(user)
  });
});

app.get("/me", authenticateToken, (req, res) => {
  return res.json({ user: sanitizeUser(req.user) });
});

app.post("/submit-complaint", authenticateToken, upload.single("attachment"), (req, res) => {
  const { title, category, description } = req.body;

  if (!title || !category || !description) {
    return res.status(400).json({ message: "Title, category, and description are required." });
  }

  const now = new Date().toISOString();
  const fileName = req.file ? req.file.filename : "";
  run(
    `INSERT INTO complaints
    (user_id, title, category, description, status, response, file_name, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'Pending', '', ?, ?, ?)`,
    [req.user.id, title.trim(), category.trim(), description.trim(), fileName, now, now]
  );

  const complaint = queryOne(
    `SELECT c.*, u.name AS student_name, u.email AS student_email
     FROM complaints c JOIN users u ON u.id = c.user_id
     ORDER BY c.id DESC LIMIT 1`
  );

  return res.status(201).json({ message: "Complaint submitted successfully.", complaint });
});

app.get("/get-complaints", authenticateToken, (req, res) => {
  const { status = "", category = "", search = "" } = req.query;
  const conditions = [];
  const params = [];

  if (req.user.role !== "admin") {
    conditions.push("c.user_id = ?");
    params.push(req.user.id);
  }
  if (status) {
    conditions.push("c.status = ?");
    params.push(status);
  }
  if (category) {
    conditions.push("c.category = ?");
    params.push(category);
  }
  if (search) {
    conditions.push("(c.title LIKE ? OR c.description LIKE ? OR u.name LIKE ?)");
    const likeQuery = `%${search}%`;
    params.push(likeQuery, likeQuery, likeQuery);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const complaints = queryAll(
    `SELECT c.*, u.name AS student_name, u.email AS student_email
     FROM complaints c JOIN users u ON u.id = c.user_id
     ${whereClause}
     ORDER BY c.updated_at DESC`,
    params
  ).map((item) => ({ ...item, id: Number(item.id), user_id: Number(item.user_id) }));

  return res.json({ complaints });
});

app.patch("/update-status/:id", authenticateToken, requireAdmin, (req, res) => {
  const { status } = req.body;
  const complaint = queryOne("SELECT id FROM complaints WHERE id = ?", [req.params.id]);
  const allowedStatuses = ["Pending", "In Progress", "Resolved"];

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ message: "Invalid status value." });
  }
  if (!complaint) {
    return res.status(404).json({ message: "Complaint not found." });
  }

  run("UPDATE complaints SET status = ?, updated_at = ? WHERE id = ?", [status, new Date().toISOString(), req.params.id]);
  return res.json({ message: "Complaint status updated successfully." });
});

app.patch("/respond/:id", authenticateToken, requireAdmin, (req, res) => {
  const { response } = req.body;
  const complaint = queryOne("SELECT id FROM complaints WHERE id = ?", [req.params.id]);

  if (!response || !response.trim()) {
    return res.status(400).json({ message: "Response message is required." });
  }
  if (!complaint) {
    return res.status(404).json({ message: "Complaint not found." });
  }

  run("UPDATE complaints SET response = ?, updated_at = ? WHERE id = ?", [response.trim(), new Date().toISOString(), req.params.id]);
  return res.json({ message: "Response sent successfully." });
});

app.get("/stats", authenticateToken, requireAdmin, (_req, res) => {
  const total = Number(queryOne("SELECT COUNT(*) AS count FROM complaints").count);
  const pending = Number(queryOne("SELECT COUNT(*) AS count FROM complaints WHERE status = 'Pending'").count);
  const inProgress = Number(queryOne("SELECT COUNT(*) AS count FROM complaints WHERE status = 'In Progress'").count);
  const resolved = Number(queryOne("SELECT COUNT(*) AS count FROM complaints WHERE status = 'Resolved'").count);
  const categories = queryAll("SELECT category, COUNT(*) AS count FROM complaints GROUP BY category ORDER BY count DESC").map((item) => ({
    category: item.category,
    count: Number(item.count)
  }));

  return res.json({ total, pending, inProgress, resolved, categories });
});

app.use((err, _req, res, _next) => {
  console.error(err);

  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: "File upload failed. Ensure the file is under 5MB." });
  }

  return res.status(500).json({ message: "Something went wrong. Please try again." });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

async function startServer() {
  const SQL = await initSqlJs();
  db = fs.existsSync(DB_PATH) ? new SQL.Database(fs.readFileSync(DB_PATH)) : new SQL.Database();

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('student', 'admin')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS complaints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pending',
      response TEXT DEFAULT '',
      file_name TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  saveDatabase();
  seedDatabase();
  migrateBrandingData();

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
