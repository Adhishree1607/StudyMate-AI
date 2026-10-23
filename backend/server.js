
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 5000;
const PYTHON_API = "http://127.0.0.1:8000";

app.use(cors());
app.use(express.json({ limit: "2mb" }));

// ------------------------------------
// Persistent data storage
// ------------------------------------
const DATA_FILE = path.join(__dirname, "studymate-data.json");

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
      return {
        tasks: Array.isArray(data.tasks) ? data.tasks : [],
        exams: Array.isArray(data.exams) ? data.exams : [],
        timetable: Array.isArray(data.timetable) ? data.timetable : [],
        vocabulary: Array.isArray(data.vocabulary) ? data.vocabulary : [],
      };
    }
  } catch (error) {
    console.error("Data read error:", error.message);
  }
  return { tasks: [], exams: [], timetable: [], vocabulary: [] };
}

let store = loadData();

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
}

function id() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ------------------------------------
// Python AI proxy helper
// ------------------------------------
async function callPython(endpoint, options = {}) {
  const response = await fetch(`${PYTHON_API}${endpoint}`, {
    ...options,
    signal: AbortSignal.timeout(300000),
  });

  const raw = await response.text();
  let data;

  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { detail: raw };
  }

  if (!response.ok) {
    const error = new Error(
      data.detail || data.error || `Python service error: ${response.status}`
    );
    error.status = response.status;
    throw error;
  }

  return data;
}

function sendError(res, error) {
  console.error("API error:", error);
  res.status(error.status || 500).json({
    error: error.message || "Request failed",
    detail: error.message || "Request failed",
  });
}

// ------------------------------------
// Health
// ------------------------------------
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "StudyMate backend is running" });
});

app.get("/api/health", async (req, res) => {
  try {
    const ai = await callPython("/api/health");
    res.json({ status: "ok", message: "Node and Python connected", ai });
  } catch (error) {
    sendError(res, error);
  }
});

// ------------------------------------
// AI – Ask
// ------------------------------------
app.post("/api/ask", async (req, res) => {
  try {
    res.json(await callPython("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    }));
  } catch (error) {
    sendError(res, error);
  }
});

// ------------------------------------
// AI – Generate (summaries, MCQs, etc.)
// ------------------------------------
app.post("/api/generate", async (req, res) => {
  try {
    res.json(await callPython("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    }));
  } catch (error) {
    sendError(res, error);
  }
});

// ------------------------------------
// PDF upload and chat
// ------------------------------------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

app.post("/api/pdf/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Please select a PDF file." });
    }

    const form = new FormData();
    form.append(
      "file",
      new Blob([req.file.buffer], { type: "application/pdf" }),
      req.file.originalname
    );

    res.json(await callPython("/api/pdf/extract", {
      method: "POST",
      body: form,
    }));
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/api/pdf/chat", async (req, res) => {
  try {
    res.json(await callPython("/api/pdf/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    }));
  } catch (error) {
    sendError(res, error);
  }
});

// ------------------------------------
// Planner – tasks
// ------------------------------------
app.get("/api/planner", (req, res) => {
  res.json({ tasks: store.tasks, exams: store.exams });
});

app.post("/api/planner/tasks", (req, res) => {
  const { title, subject, dueDate, priority, type } = req.body;

  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: "Task title is required." });
  }

  const task = {
    id: id(),
    title: String(title).trim(),
    subject: subject || "",
    dueDate: dueDate || "",
    priority: priority || "Medium",
    type: type || "daily",   // "daily" | "weekly" | "monthly"
    completed: false,
    createdAt: new Date().toISOString(),
  };

  store.tasks.push(task);

  try {
    saveData();
    res.status(201).json({ task, tasks: store.tasks });
  } catch (error) {
    sendError(res, error);
  }
});

app.patch("/api/planner/tasks/:id", (req, res) => {
  const task = store.tasks.find((item) => item.id === req.params.id);

  if (!task) {
    return res.status(404).json({ error: "Task not found." });
  }

  for (const field of ["title", "subject", "dueDate", "priority", "completed", "type"]) {
    if (Object.hasOwn(req.body, field)) task[field] = req.body[field];
  }

  try {
    saveData();
    res.json({ task, tasks: store.tasks });
  } catch (error) {
    sendError(res, error);
  }
});

app.delete("/api/planner/tasks/:id", (req, res) => {
  const before = store.tasks.length;
  store.tasks = store.tasks.filter((item) => item.id !== req.params.id);

  if (before === store.tasks.length) {
    return res.status(404).json({ error: "Task not found." });
  }

  try {
    saveData();
    res.json({ tasks: store.tasks });
  } catch (error) {
    sendError(res, error);
  }
});

// ------------------------------------
// Planner – exams
// ------------------------------------
app.post("/api/planner/exams", (req, res) => {
  const { title, subject, date } = req.body;

  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: "Exam title is required." });
  }

  const exam = {
    id: id(),
    title: String(title).trim(),
    subject: subject || "",
    date: date || "",
    createdAt: new Date().toISOString(),
  };

  store.exams.push(exam);

  try {
    saveData();
    res.status(201).json({ exam, exams: store.exams });
  } catch (error) {
    sendError(res, error);
  }
});

app.patch("/api/planner/exams/:id", (req, res) => {
  const exam = store.exams.find((item) => item.id === req.params.id);

  if (!exam) {
    return res.status(404).json({ error: "Exam not found." });
  }

  for (const field of ["title", "subject", "date"]) {
    if (Object.hasOwn(req.body, field)) exam[field] = req.body[field];
  }

  try {
    saveData();
    res.json({ exam, exams: store.exams });
  } catch (error) {
    sendError(res, error);
  }
});

app.delete("/api/planner/exams/:id", (req, res) => {
  const before = store.exams.length;
  store.exams = store.exams.filter((item) => item.id !== req.params.id);

  if (before === store.exams.length) {
    return res.status(404).json({ error: "Exam not found." });
  }

  try {
    saveData();
    res.json({ exams: store.exams });
  } catch (error) {
    sendError(res, error);
  }
});

// ------------------------------------
// Timetable
// ------------------------------------
app.get("/api/timetable", (req, res) => {
  res.json({ timetable: store.timetable });
});

app.post("/api/timetable", (req, res) => {
  const { day, subject, startTime, endTime, room } = req.body;

  if (!day || !subject) {
    return res.status(400).json({ error: "Day and subject are required." });
  }

  const entry = {
    id: id(),
    day: String(day).trim(),
    subject: String(subject).trim(),
    startTime: startTime || "",
    endTime: endTime || "",
    room: room || "",
  };

  store.timetable.push(entry);

  try {
    saveData();
    res.status(201).json({ entry, timetable: store.timetable });
  } catch (error) {
    sendError(res, error);
  }
});

app.patch("/api/timetable/:id", (req, res) => {
  const entry = store.timetable.find((item) => item.id === req.params.id);

  if (!entry) {
    return res.status(404).json({ error: "Timetable entry not found." });
  }

  for (const field of ["day", "subject", "startTime", "endTime", "room"]) {
    if (Object.hasOwn(req.body, field)) entry[field] = req.body[field];
  }

  try {
    saveData();
    res.json({ entry, timetable: store.timetable });
  } catch (error) {
    sendError(res, error);
  }
});

app.delete("/api/timetable/:id", (req, res) => {
  const before = store.timetable.length;
  store.timetable = store.timetable.filter((item) => item.id !== req.params.id);

  if (before === store.timetable.length) {
    return res.status(404).json({ error: "Entry not found." });
  }

  try {
    saveData();
    res.json({ timetable: store.timetable });
  } catch (error) {
    sendError(res, error);
  }
});

// ------------------------------------
// Vocabulary
// ------------------------------------
app.get("/api/vocabulary", (req, res) => {
  res.json({ vocabulary: store.vocabulary });
});

app.post("/api/vocabulary", (req, res) => {
  const { word, meaning, example, partOfSpeech } = req.body;

  if (!word || !meaning) {
    return res.status(400).json({ error: "Word and meaning are required." });
  }

  const entry = {
    id: id(),
    word: String(word).trim(),
    meaning: String(meaning).trim(),
    example: example || "",
    partOfSpeech: partOfSpeech || "",
    createdAt: new Date().toISOString(),
  };

  store.vocabulary.push(entry);

  try {
    saveData();
    res.status(201).json({ entry, vocabulary: store.vocabulary });
  } catch (error) {
    sendError(res, error);
  }
});

app.delete("/api/vocabulary/:id", (req, res) => {
  const before = store.vocabulary.length;
  store.vocabulary = store.vocabulary.filter((item) => item.id !== req.params.id);

  if (before === store.vocabulary.length) {
    return res.status(404).json({ error: "Word not found." });
  }

  try {
    saveData();
    res.json({ vocabulary: store.vocabulary });
  } catch (error) {
    sendError(res, error);
  }
});

// ------------------------------------
// Start server
// ------------------------------------
app.listen(PORT, () => {
  console.log(`StudyMate backend running at http://localhost:${PORT}`);
  console.log(`Python AI service: ${PYTHON_API}`);
});
