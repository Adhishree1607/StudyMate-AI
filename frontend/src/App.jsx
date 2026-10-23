import { useEffect, useState } from "react";
import "./App.css";

const API = "http://localhost:5000";

async function apiRequest(endpoint, options = {}) {
  let response;
  try {
    response = await fetch(`${API}${endpoint}`, {
      ...options,
      signal: AbortSignal.timeout(310000),
    });
  } catch (error) {
    if (error.name === "AbortError" || error.name === "TimeoutError") {
      throw new Error("The request took too long. Try again with a shorter question or PDF.");
    }
    throw new Error("Cannot connect to StudyMate backend. Check that Node.js is running.");
  }

  const raw = await response.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error("The server returned an invalid response.");
  }

  if (!response.ok) {
    throw new Error(data.detail || data.error || `Request failed (${response.status}).`);
  }

  return data;
}

function getAnswer(data) {
  if (typeof data === "string") return data;
  const answer =
    data?.answer ??
    data?.response ??
    data?.text ??
    data?.content ??
    data?.summary;

  if (typeof answer === "string" && answer.trim()) {
    return answer.trim();
  }
  if (answer && typeof answer === "object") {
    return JSON.stringify(answer, null, 2);
  }
  throw new Error("The AI returned no answer. Check the Python terminal for an Ollama error.");
}

function Button({ children, onClick, disabled, secondary = false, type = "button" }) {
  return (
    <button
      type={type}
      className={secondary ? "sm-secondary" : "sm-button"}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function Loading({ text = "Working with your AI assistant..." }) {
  return <div className="sm-loading">⏳ {text}</div>;
}

function ErrorMessage({ children }) {
  if (!children) return null;
  return <div className="sm-error">{children}</div>;
}

function Result({ title, content }) {
  if (!content) return null;
  return (
    <section className="sm-result">
      <h3>{title}</h3>
      <pre className="sm-answer">{content}</pre>
      <Button secondary onClick={() => navigator.clipboard.writeText(content)}>
        📋 Copy result
      </Button>
    </section>
  );
}

const DEFAULT_QUOTES = [
  { quote: "Success is the sum of small efforts repeated day in and day out.", author: "Robert Collier" },
  { quote: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { quote: "It always seems impossible until it is done.", author: "Nelson Mandela" },
  { quote: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { quote: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
  { quote: "Focus is a superpower. Deep work leads to extraordinary outcomes.", author: "Cal Newport" },
];

const DEFAULT_VOCAB = [
  { word: "Perseverance", pos: "noun", meaning: "Persistence in doing something despite difficulty or delay in achieving success.", example: "Her perseverance through complex algorithms earned her top scores." },
  { word: "Ephemeral", pos: "adjective", meaning: "Lasting for a very short time; transitory.", example: "Exam anxiety is ephemeral, but the knowledge you build stays forever." },
  { word: "Cogent", pos: "adjective", meaning: "Clear, logical, and convincing in argument or thought.", example: "He presented a cogent explanation of the recursive algorithm." },
  { word: "Mnemonic", pos: "noun", meaning: "A device such as a pattern of letters or ideas that assists in remembering something.", example: "Flashcards and mnemonics help recall complex biology terms." },
  { word: "Diligence", pos: "noun", meaning: "Careful and persistent work or effort.", example: "With daily diligence, solving two-mark questions became second nature." },
];

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function App() {
  const [page, setPage] = useState("Dashboard");
  const [health, setHealth] = useState("Checking services...");
  const [globalError, setGlobalError] = useState("");

  // Data Store
  const [tasks, setTasks] = useState([]);
  const [exams, setExams] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [vocabulary, setVocabulary] = useState([]);

  // Quotes & Vocab Widget State
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [vocabIndex, setVocabIndex] = useState(0);

  // Ask AI State
  const [question, setQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // PDF Chat State
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfText, setPdfText] = useState("");
  const [pdfName, setPdfName] = useState("");
  const [pdfPages, setPdfPages] = useState(0);
  const [pdfQuestion, setPdfQuestion] = useState("");
  const [pdfMessages, setPdfMessages] = useState([]);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [summary, setSummary] = useState("");

  // Study Content Generator State (MCQ, 2-mark, Notes)
  const [topic, setTopic] = useState("");
  const [studyText, setStudyText] = useState("");
  const [studyResult, setStudyResult] = useState("");
  const [studyLoading, setStudyLoading] = useState(false);
  const [studyError, setStudyError] = useState("");
  const [questionCount, setQuestionCount] = useState(5);

  // Flashcards State
  const [cards, setCards] = useState([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);

  // Forms State
  const [taskForm, setTaskForm] = useState({ title: "", subject: "", dueDate: "", priority: "Medium", type: "daily" });
  const [examForm, setExamForm] = useState({ title: "", subject: "", date: "" });
  const [timetableForm, setTimetableForm] = useState({ day: "Monday", subject: "", startTime: "09:00", endTime: "10:00", room: "" });
  const [vocabForm, setVocabForm] = useState({ word: "", meaning: "", example: "", partOfSpeech: "" });

  useEffect(() => {
    checkHealth();
    loadAllData();
  }, []);

  async function checkHealth() {
    try {
      const data = await apiRequest("/api/health");
      setHealth(data.status === "ok" ? "Connected" : "Check services");
    } catch {
      setHealth("Backend unavailable");
    }
  }

  async function loadAllData() {
    try {
      const planner = await apiRequest("/api/planner");
      setTasks(Array.isArray(planner.tasks) ? planner.tasks : []);
      setExams(Array.isArray(planner.exams) ? planner.exams : []);
    } catch (e) {
      console.warn("Could not load planner data:", e.message);
    }

    try {
      const tt = await apiRequest("/api/timetable");
      setTimetable(Array.isArray(tt.timetable) ? tt.timetable : []);
    } catch (e) {
      console.warn("Could not load timetable:", e.message);
    }

    try {
      const voc = await apiRequest("/api/vocabulary");
      setVocabulary(Array.isArray(voc.vocabulary) ? voc.vocabulary : []);
    } catch (e) {
      console.warn("Could not load vocabulary:", e.message);
    }
  }

  function navigate(name) {
    setPage(name);
    setGlobalError("");
  }

  // --- Task Handlers ---
  async function handleAddTask(typeOverride) {
    if (!taskForm.title.trim()) return;
    try {
      await apiRequest("/api/planner/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...taskForm,
          type: typeOverride || taskForm.type,
        }),
      });
      setTaskForm({ title: "", subject: "", dueDate: "", priority: "Medium", type: typeOverride || "daily" });
      const p = await apiRequest("/api/planner");
      setTasks(p.tasks || []);
    } catch (err) {
      setGlobalError(err.message);
    }
  }

  async function toggleTask(task) {
    try {
      await apiRequest(`/api/planner/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !task.completed }),
      });
      const p = await apiRequest("/api/planner");
      setTasks(p.tasks || []);
    } catch (err) {
      setGlobalError(err.message);
    }
  }

  async function deleteTask(id) {
    try {
      await apiRequest(`/api/planner/tasks/${id}`, { method: "DELETE" });
      const p = await apiRequest("/api/planner");
      setTasks(p.tasks || []);
    } catch (err) {
      setGlobalError(err.message);
    }
  }

  // --- Exam Handlers ---
  async function handleAddExam(e) {
    e?.preventDefault();
    if (!examForm.title.trim()) return;
    try {
      await apiRequest("/api/planner/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(examForm),
      });
      setExamForm({ title: "", subject: "", date: "" });
      const p = await apiRequest("/api/planner");
      setExams(p.exams || []);
    } catch (err) {
      setGlobalError(err.message);
    }
  }

  async function deleteExam(id) {
    try {
      await apiRequest(`/api/planner/exams/${id}`, { method: "DELETE" });
      const p = await apiRequest("/api/planner");
      setExams(p.exams || []);
    } catch (err) {
      setGlobalError(err.message);
    }
  }

  // --- Timetable Handlers ---
  async function handleAddTimetable(e) {
    e?.preventDefault();
    if (!timetableForm.subject.trim()) return;
    try {
      await apiRequest("/api/timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(timetableForm),
      });
      setTimetableForm({ day: timetableForm.day, subject: "", startTime: "09:00", endTime: "10:00", room: "" });
      const tt = await apiRequest("/api/timetable");
      setTimetable(tt.timetable || []);
    } catch (err) {
      setGlobalError(err.message);
    }
  }

  async function deleteTimetable(id) {
    try {
      await apiRequest(`/api/timetable/${id}`, { method: "DELETE" });
      const tt = await apiRequest("/api/timetable");
      setTimetable(tt.timetable || []);
    } catch (err) {
      setGlobalError(err.message);
    }
  }

  // --- Vocabulary Handlers ---
  async function handleAddVocab(e) {
    e?.preventDefault();
    if (!vocabForm.word.trim() || !vocabForm.meaning.trim()) return;
    try {
      await apiRequest("/api/vocabulary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vocabForm),
      });
      setVocabForm({ word: "", meaning: "", example: "", partOfSpeech: "" });
      const voc = await apiRequest("/api/vocabulary");
      setVocabulary(voc.vocabulary || []);
    } catch (err) {
      setGlobalError(err.message);
    }
  }

  async function deleteVocab(id) {
    try {
      await apiRequest(`/api/vocabulary/${id}`, { method: "DELETE" });
      const voc = await apiRequest("/api/vocabulary");
      setVocabulary(voc.vocabulary || []);
    } catch (err) {
      setGlobalError(err.message);
    }
  }

  // --- AI Handlers ---
  async function askAI(event) {
    event?.preventDefault();
    if (!question.trim()) return;
    setAiLoading(true);
    setAiAnswer("");
    setGlobalError("");
    try {
      const data = await apiRequest("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim() }),
      });
      setAiAnswer(getAnswer(data));
    } catch (error) {
      setGlobalError(error.message);
    } finally {
      setAiLoading(false);
    }
  }

  async function uploadPDF() {
    if (!pdfFile) {
      setPdfError("Please choose a PDF file first.");
      return;
    }
    setPdfLoading(true);
    setPdfError("");
    setPdfText("");
    setSummary("");
    setPdfMessages([]);
    try {
      const formData = new FormData();
      formData.append("file", pdfFile);
      const data = await apiRequest("/api/pdf/upload", {
        method: "POST",
        body: formData,
      });
      const extracted = data.text || data.content || data.document_text || "";
      if (typeof extracted !== "string" || !extracted.trim()) {
        throw new Error(data.message || "The server extracted no text from this PDF.");
      }
      setPdfText(extracted);
      setPdfName(data.filename || pdfFile.name);
      setPdfPages(data.pages || data.page_count || 0);
    } catch (error) {
      setPdfError(error.message);
    } finally {
      setPdfLoading(false);
    }
  }

  async function askPDF(event) {
    event?.preventDefault();
    if (!pdfText.trim()) {
      setPdfError("Upload and extract a PDF before asking questions.");
      return;
    }
    if (!pdfQuestion.trim()) return;
    const currentQuestion = pdfQuestion.trim();
    setPdfMessages((prev) => [...prev, { role: "user", text: currentQuestion }]);
    setPdfQuestion("");
    setPdfLoading(true);
    setPdfError("");
    try {
      const data = await apiRequest("/api/pdf/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: currentQuestion,
          text: pdfText,
          content: pdfText,
          document_text: pdfText,
        }),
      });
      setPdfMessages((prev) => [...prev, { role: "assistant", text: getAnswer(data) }]);
    } catch (error) {
      setPdfError(error.message);
    } finally {
      setPdfLoading(false);
    }
  }

  async function summarizePDF() {
    if (!pdfText.trim()) {
      setPdfError("Upload and extract a PDF before generating a summary.");
      return;
    }
    setPdfLoading(true);
    setPdfError("");
    setSummary("");
    try {
      const data = await apiRequest("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "summary",
          text: pdfText.slice(0, 12000),
          content: pdfText.slice(0, 12000),
          topic: pdfName || "Uploaded PDF",
        }),
      });
      setSummary(getAnswer(data));
    } catch (error) {
      setPdfError(error.message);
    } finally {
      setPdfLoading(false);
    }
  }

  async function generateStudy(mode) {
    if (!studyText.trim() && !topic.trim()) {
      setStudyError("Enter a topic or paste some study material first.");
      return;
    }
    setStudyLoading(true);
    setStudyError("");
    setStudyResult("");
    try {
      const data = await apiRequest("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          topic,
          subject: topic,
          text: studyText,
          content: studyText,
          count: Number(questionCount),
        }),
      });
      const answer = getAnswer(data);
      setStudyResult(answer);
      if (mode === "flashcards") {
        const parsed = parseFlashcards(answer);
        setCards(parsed);
        setCardIndex(0);
        setShowBack(false);
      }
    } catch (error) {
      setStudyError(error.message);
    } finally {
      setStudyLoading(false);
    }
  }

  function parseFlashcards(text) {
    const lines = text.split("\n");
    const result = [];
    let currentQuestion = "";
    let currentAnswer = "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (/^Q\s*:/i.test(trimmed)) {
        if (currentQuestion && currentAnswer) {
          result.push({ question: currentQuestion, answer: currentAnswer });
        }
        currentQuestion = trimmed.replace(/^Q\s*:/i, "").trim();
        currentAnswer = "";
      } else if (/^A\s*:/i.test(trimmed)) {
        currentAnswer = trimmed.replace(/^A\s*:/i, "").trim();
      } else if (currentQuestion && currentAnswer && trimmed) {
        currentAnswer += ` ${trimmed}`;
      }
    }
    if (currentQuestion && currentAnswer) {
      result.push({ question: currentQuestion, answer: currentAnswer });
    }
    return result;
  }

  // --- Date / Time Helpers ---
  function daysUntil(dateStr) {
    if (!dateStr) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const target = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(target.getTime())) return null;
    return Math.ceil((target.getTime() - now.getTime()) / 86400000);
  }

  // Calculate dynamic task metrics from actual saved data
  const dailyTasks = tasks.filter((t) => t.type === "daily" || !t.type);
  const weeklyTasks = tasks.filter((t) => t.type === "weekly");
  const monthlyTasks = tasks.filter((t) => t.type === "monthly");

  const dailyDone = dailyTasks.filter((t) => t.completed).length;
  const weeklyDone = weeklyTasks.filter((t) => t.completed).length;
  const monthlyDone = monthlyTasks.filter((t) => t.completed).length;

  const dailyPercent = dailyTasks.length ? Math.round((dailyDone / dailyTasks.length) * 100) : 0;
  const weeklyPercent = weeklyTasks.length ? Math.round((weeklyDone / weeklyTasks.length) * 100) : 0;
  const monthlyPercent = monthlyTasks.length ? Math.round((monthlyDone / monthlyTasks.length) * 100) : 0;

  // Upcoming exam alert check (e.g. tomorrow or within 3 days)
  const sortedExams = [...exams].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const imminentExams = sortedExams.filter((exam) => {
    const d = daysUntil(exam.date);
    return d !== null && d >= 0 && d <= 3;
  });

  // Current day name for timetable preview
  const currentDayName = DAYS_OF_WEEK[(new Date().getDay() + 6) % 7]; // Mon = 0
  const todayClasses = timetable.filter((c) => c.day.toLowerCase() === currentDayName.toLowerCase());

  // Active vocabulary card item (saved list or defaults)
  const displayVocabList = vocabulary.length > 0 ? vocabulary : DEFAULT_VOCAB;
  const activeVocab = displayVocabList[vocabIndex % displayVocabList.length];
  const activeQuote = DEFAULT_QUOTES[quoteIndex % DEFAULT_QUOTES.length];

  // Navigation Items (Exact requirements)
  const navItems = [
    { name: "Dashboard", icon: "⌂" },
    { name: "Timetable", icon: "▦" },
    { name: "Daily Tasks", icon: "✓" },
    { name: "Weekly Tasks", icon: "◫" },
    { name: "Monthly Tasks", icon: "📅" },
    { name: "Exam Reminders", icon: "⏰" },
    { name: "Vocabulary", icon: "📖" },
    { name: "AI Study Assistant", icon: "✦" },
    { name: "PDF Chat", icon: "📄" },
    { name: "Summaries & Notes", icon: "📝" },
    { name: "MCQ Generator", icon: "☑" },
    { name: "Two-Mark Questions", icon: "✍" },
    { name: "Flashcards", icon: "🗂" },
  ];

  // -------------------------------------------------------------
  // Render: Dashboard
  // -------------------------------------------------------------
  function renderDashboard() {
    return (
      <>
        {/* Imminent Exam Alert Banner */}
        {imminentExams.length > 0 && (
          <div className="sm-exam-alert-card">
            <div className="sm-exam-alert-content">
              <span className="sm-exam-alert-icon">⚠️</span>
              <div>
                <div className="sm-exam-alert-title">
                  {imminentExams[0].title} {imminentExams[0].subject ? `(${imminentExams[0].subject})` : ""}{" "}
                  {daysUntil(imminentExams[0].date) === 0
                    ? "is TODAY!"
                    : daysUntil(imminentExams[0].date) === 1
                    ? "is tomorrow!"
                    : `is in ${daysUntil(imminentExams[0].date)} days!`}
                </div>
                <div className="sm-exam-alert-desc">
                  Scheduled for {imminentExams[0].date}. Start revising your high-priority notes and flashcards!
                </div>
              </div>
            </div>
            <Button secondary onClick={() => navigate("Exam Reminders")}>
              View Countdown →
            </Button>
          </div>
        )}

        {/* Welcome Banner */}
        <div className="sm-welcome">
          <p className="sm-eyebrow">STUDYMATE AI DASHBOARD</p>
          <h1>Study smarter, not harder. ✨</h1>
          <p>Your personalized study space. Track your dynamic progress, timetable, and upcoming exams.</p>
        </div>

        {/* Dynamic 3-Level Task Progress & Exam Count */}
        <div className="sm-stats">
          <div className="sm-stat-card">
            <div className="sm-stat-header">
              <span>Daily Tasks</span>
              <div className="sm-stat-icon purple">✓</div>
            </div>
            <div className="sm-stat-value">{dailyDone} / {dailyTasks.length}</div>
            <div className="sm-stat-sub">{dailyPercent}% completed today</div>
            <div className="sm-progress-track">
              <div className="sm-progress-bar purple" style={{ width: `${dailyPercent}%` }} />
            </div>
          </div>

          <div className="sm-stat-card">
            <div className="sm-stat-header">
              <span>Weekly Goals</span>
              <div className="sm-stat-icon cyan">◫</div>
            </div>
            <div className="sm-stat-value">{weeklyDone} / {weeklyTasks.length}</div>
            <div className="sm-stat-sub">{weeklyPercent}% completed this week</div>
            <div className="sm-progress-track">
              <div className="sm-progress-bar cyan" style={{ width: `${weeklyPercent}%` }} />
            </div>
          </div>

          <div className="sm-stat-card">
            <div className="sm-stat-header">
              <span>Monthly Target</span>
              <div className="sm-stat-icon emerald">📅</div>
            </div>
            <div className="sm-stat-value">{monthlyDone} / {monthlyTasks.length}</div>
            <div className="sm-stat-sub">{monthlyPercent}% completed this month</div>
            <div className="sm-progress-track">
              <div className="sm-progress-bar emerald" style={{ width: `${monthlyPercent}%` }} />
            </div>
          </div>

          <div className="sm-stat-card">
            <div className="sm-stat-header">
              <span>Exams Scheduled</span>
              <div className="sm-stat-icon amber">⏰</div>
            </div>
            <div className="sm-stat-value">{exams.length}</div>
            <div className="sm-stat-sub">
              {imminentExams.length > 0 ? `${imminentExams.length} coming up soon` : "All on track"}
            </div>
            <div className="sm-progress-track">
              <div
                className="sm-progress-bar amber"
                style={{ width: `${exams.length > 0 ? Math.min(100, exams.length * 20) : 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* 2-Column Dashboard Layout: Today's Timetable + Motivation & Vocab */}
        <div className="sm-dashboard-grid">
          {/* Today's Timetable Preview */}
          <div className="sm-panel">
            <div className="sm-panel-header">
              <h2>Today's Timetable ({currentDayName})</h2>
              <Button secondary onClick={() => navigate("Timetable")}>
                Full Schedule →
              </Button>
            </div>
            {todayClasses.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                No classes scheduled for today. Have a productive self-study day!
              </p>
            ) : (
              <div className="sm-today-classes">
                {todayClasses.map((item) => (
                  <div className="sm-class-pill" key={item.id}>
                    <div className="sm-class-info">
                      <strong>{item.subject}</strong>
                      <span>{item.room ? `Room: ${item.room}` : "Classroom"}</span>
                    </div>
                    <div className="sm-class-time">
                      {item.startTime} – {item.endTime}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Motivational Quote & Vocabulary Card */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Motivational Quote with Refresh Option */}
            <div className="sm-quote-card">
              <div className="sm-quote-header">
                <span>Daily Motivation</span>
                <button
                  type="button"
                  style={{ background: "transparent", border: "none", color: "var(--accent-purple)", cursor: "pointer", fontSize: "12px", fontWeight: 600 }}
                  onClick={() => setQuoteIndex((prev) => prev + 1)}
                  title="Get another quote"
                >
                  🔄 Refresh quote
                </button>
              </div>
              <div className="sm-quote-body">
                "{activeQuote.quote}"
              </div>
              <div className="sm-quote-author">
                — {activeQuote.author}
              </div>
            </div>

            {/* Vocabulary Card */}
            <div className="sm-vocab-card">
              <div className="sm-vocab-header">
                <span>Word of the Day</span>
                <button
                  type="button"
                  style={{ background: "transparent", border: "none", color: "var(--accent-cyan)", cursor: "pointer", fontSize: "12px", fontWeight: 600 }}
                  onClick={() => setVocabIndex((prev) => prev + 1)}
                  title="Next word"
                >
                  Next word →
                </button>
              </div>
              <div>
                <div className="sm-vocab-word">
                  {activeVocab.word}
                  {(activeVocab.pos || activeVocab.partOfSpeech) && (
                    <span className="sm-vocab-pos">{activeVocab.pos || activeVocab.partOfSpeech}</span>
                  )}
                </div>
                <div className="sm-vocab-meaning">{activeVocab.meaning}</div>
                {activeVocab.example && (
                  <div className="sm-vocab-example">"{activeVocab.example}"</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // -------------------------------------------------------------
  // Render: Timetable Page
  // -------------------------------------------------------------
  function renderTimetable() {
    return (
      <>
        <h1>Weekly Timetable ▦</h1>
        <p className="sm-page-desc">Plan your weekly schedule. Add, view, and manage class times and rooms.</p>

        {/* Add Class Form */}
        <div className="sm-panel">
          <h2>Add Class or Study Block</h2>
          <form onSubmit={handleAddTimetable}>
            <div className="sm-form-grid">
              <div>
                <label>Day of the week</label>
                <select
                  value={timetableForm.day}
                  onChange={(e) => setTimetableForm({ ...timetableForm, day: e.target.value })}
                >
                  {DAYS_OF_WEEK.map((day) => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Subject / Class Name</label>
                <input
                  type="text"
                  placeholder="e.g. Operating Systems"
                  value={timetableForm.subject}
                  onChange={(e) => setTimetableForm({ ...timetableForm, subject: e.target.value })}
                  required
                />
              </div>
              <div>
                <label>Start Time</label>
                <input
                  type="time"
                  value={timetableForm.startTime}
                  onChange={(e) => setTimetableForm({ ...timetableForm, startTime: e.target.value })}
                />
              </div>
              <div>
                <label>End Time</label>
                <input
                  type="time"
                  value={timetableForm.endTime}
                  onChange={(e) => setTimetableForm({ ...timetableForm, endTime: e.target.value })}
                />
              </div>
              <div>
                <label>Room / Location (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Hall 4B or Zoom"
                  value={timetableForm.room}
                  onChange={(e) => setTimetableForm({ ...timetableForm, room: e.target.value })}
                />
              </div>
            </div>
            <div style={{ marginTop: "12px" }}>
              <Button type="submit">➕ Add to Schedule</Button>
            </div>
          </form>
        </div>

        {/* 7-Day Timetable Grid */}
        <div className="sm-timetable-grid">
          {DAYS_OF_WEEK.map((day) => {
            const dayClasses = timetable.filter((c) => c.day.toLowerCase() === day.toLowerCase());
            const isToday = currentDayName.toLowerCase() === day.toLowerCase();

            return (
              <div className={`sm-day-card ${isToday ? "today" : ""}`} key={day}>
                <div className="sm-day-header">
                  <span className="sm-day-name">{day}</span>
                  {isToday && <span className="sm-today-tag">TODAY</span>}
                </div>
                <div className="sm-day-classes">
                  {dayClasses.length === 0 ? (
                    <p style={{ color: "var(--text-dim)", fontSize: "11px", fontStyle: "italic", marginTop: "10px" }}>
                      No classes scheduled
                    </p>
                  ) : (
                    dayClasses.map((item) => (
                      <div className="sm-schedule-item" key={item.id}>
                        <div className="sm-schedule-info">
                          <strong>{item.subject}</strong>
                          <span>
                            {item.startTime} – {item.endTime}
                            {item.room ? ` · ${item.room}` : ""}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="sm-danger-btn"
                          onClick={() => deleteTimetable(item.id)}
                          title="Delete class"
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  }

  // -------------------------------------------------------------
  // Render: Tasks Page Generator (Daily / Weekly / Monthly)
  // -------------------------------------------------------------
  function renderTaskPage(filterType, title, description) {
    const list = tasks.filter((t) => (t.type || "daily") === filterType);
    const doneCount = list.filter((t) => t.completed).length;
    const progressPercent = list.length ? Math.round((doneCount / list.length) * 100) : 0;

    return (
      <>
        <h1>{title}</h1>
        <p className="sm-page-desc">{description}</p>

        {/* Progress Overview Card */}
        <div className="sm-panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <h3 style={{ marginBottom: "2px" }}>Completion Rate</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "12px" }}>
              {doneCount} of {list.length} tasks completed ({progressPercent}%)
            </p>
          </div>
          <div style={{ width: "240px" }}>
            <div className="sm-progress-track" style={{ height: "10px", margin: 0 }}>
              <div
                className={`sm-progress-bar ${filterType === "daily" ? "purple" : filterType === "weekly" ? "cyan" : "emerald"}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Add Task Form */}
        <div className="sm-panel">
          <h2>Add New {title.replace("Tasks", "Task")}</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAddTask(filterType);
            }}
          >
            <div className="sm-form-grid">
              <div style={{ gridColumn: "span 2" }}>
                <label>Task Title</label>
                <input
                  type="text"
                  placeholder="e.g. Read Chapter 4 and complete exercises"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  required
                />
              </div>
              <div>
                <label>Subject</label>
                <input
                  type="text"
                  placeholder="e.g. Computer Networks"
                  value={taskForm.subject}
                  onChange={(e) => setTaskForm({ ...taskForm, subject: e.target.value })}
                />
              </div>
              <div>
                <label>Due Date</label>
                <input
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                />
              </div>
              <div>
                <label>Priority</label>
                <select
                  value={taskForm.priority}
                  onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>
            <div style={{ marginTop: "10px" }}>
              <Button type="submit">➕ Add Task</Button>
            </div>
          </form>
        </div>

        {/* Tasks List */}
        <div className="sm-panel">
          <h2>Your Tasks ({list.length})</h2>
          {list.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>No tasks added in this view yet.</p>
          ) : (
            list.map((task) => (
              <div className="sm-list-row" key={task.id}>
                <label className="sm-task-label">
                  <input
                    type="checkbox"
                    checked={Boolean(task.completed)}
                    onChange={() => toggleTask(task)}
                  />
                  <div className="sm-task-text">
                    <div className={`sm-task-title ${task.completed ? "sm-completed" : ""}`}>
                      {task.title}
                    </div>
                    <div className="sm-task-sub">
                      {task.subject ? `${task.subject} · ` : ""}
                      {task.dueDate ? `Due: ${task.dueDate}` : "No due date"}
                    </div>
                  </div>
                </label>
                <span className={`sm-badge ${task.priority.toLowerCase()}`}>
                  {task.priority}
                </span>
                <button
                  type="button"
                  className="sm-danger-btn"
                  onClick={() => deleteTask(task.id)}
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      </>
    );
  }

  // -------------------------------------------------------------
  // Render: Exam Reminders Page
  // -------------------------------------------------------------
  function renderExamReminders() {
    return (
      <>
        <h1>Exam Reminders ⏰</h1>
        <p className="sm-page-desc">Track all your semester and competitive exams with automatic live countdowns.</p>

        {/* Add Exam Form */}
        <div className="sm-panel">
          <h2>Add an Upcoming Exam</h2>
          <form onSubmit={handleAddExam}>
            <div className="sm-form-grid">
              <div>
                <label>Exam Title</label>
                <input
                  type="text"
                  placeholder="e.g. Midterm Examination"
                  value={examForm.title}
                  onChange={(e) => setExamForm({ ...examForm, title: e.target.value })}
                  required
                />
              </div>
              <div>
                <label>Subject</label>
                <input
                  type="text"
                  placeholder="e.g. Database Management Systems"
                  value={examForm.subject}
                  onChange={(e) => setExamForm({ ...examForm, subject: e.target.value })}
                  required
                />
              </div>
              <div>
                <label>Exam Date</label>
                <input
                  type="date"
                  value={examForm.date}
                  onChange={(e) => setExamForm({ ...examForm, date: e.target.value })}
                  required
                />
              </div>
            </div>
            <div style={{ marginTop: "12px" }}>
              <Button type="submit">➕ Schedule Exam</Button>
            </div>
          </form>
        </div>

        {/* Exams Grid */}
        <div className="sm-exam-grid">
          {sortedExams.map((exam) => {
            const days = daysUntil(exam.date);
            const isImminent = days !== null && days >= 0 && days <= 2;

            return (
              <div className={`sm-exam-card ${isImminent ? "imminent" : ""}`} key={exam.id}>
                <div>
                  <h3>{exam.title}</h3>
                  <div className="sm-exam-subject">{exam.subject}</div>
                </div>
                <div>
                  <div className={`sm-exam-countdown ${isImminent ? "alert" : ""}`}>
                    {days === null
                      ? "Date not set"
                      : days < 0
                      ? `${Math.abs(days)} days ago`
                      : days === 0
                      ? "TODAY!"
                      : days === 1
                      ? "Tomorrow!"
                      : `${days} days left`}
                  </div>
                  <div className="sm-exam-date">Scheduled for {exam.date}</div>
                </div>
                <div>
                  <button
                    type="button"
                    className="sm-danger-btn"
                    onClick={() => deleteExam(exam.id)}
                  >
                    Delete Exam
                  </button>
                </div>
              </div>
            );
          })}
          {exams.length === 0 && (
            <div className="sm-panel" style={{ gridColumn: "1 / -1" }}>
              No exams scheduled. Add your first exam above!
            </div>
          )}
        </div>
      </>
    );
  }

  // -------------------------------------------------------------
  // Render: Vocabulary Page
  // -------------------------------------------------------------
  function renderVocabulary() {
    return (
      <>
        <h1>Vocabulary Bank 📖</h1>
        <p className="sm-page-desc">
          Build your academic and language vocabulary. Save words, definitions, and example sentences.
        </p>

        {/* Add Word Form */}
        <div className="sm-panel">
          <h2>Add New Word</h2>
          <form onSubmit={handleAddVocab}>
            <div className="sm-form-grid">
              <div>
                <label>Word</label>
                <input
                  type="text"
                  placeholder="e.g. Ubiquitous"
                  value={vocabForm.word}
                  onChange={(e) => setVocabForm({ ...vocabForm, word: e.target.value })}
                  required
                />
              </div>
              <div>
                <label>Part of Speech (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. adjective / noun"
                  value={vocabForm.partOfSpeech}
                  onChange={(e) => setVocabForm({ ...vocabForm, partOfSpeech: e.target.value })}
                />
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label>Meaning / Definition</label>
                <input
                  type="text"
                  placeholder="e.g. Present, appearing, or found everywhere."
                  value={vocabForm.meaning}
                  onChange={(e) => setVocabForm({ ...vocabForm, meaning: e.target.value })}
                  required
                />
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label>Example Sentence (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Cloud computing has become ubiquitous in modern technology."
                  value={vocabForm.example}
                  onChange={(e) => setVocabForm({ ...vocabForm, example: e.target.value })}
                />
              </div>
            </div>
            <div style={{ marginTop: "12px" }}>
              <Button type="submit">➕ Save Word</Button>
            </div>
          </form>
        </div>

        {/* Vocabulary Cards List */}
        <div className="sm-panel">
          <h2>Saved Words ({vocabulary.length})</h2>
          {vocabulary.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
              No custom words saved yet. Add your first word above or check the default deck on the dashboard!
            </p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px", marginTop: "12px" }}>
              {vocabulary.map((item) => (
                <div
                  key={item.id}
                  style={{
                    background: "var(--bg-input)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "10px",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <strong style={{ fontSize: "16px", color: "#fff" }}>{item.word}</strong>
                      {item.partOfSpeech && (
                        <span className="sm-badge" style={{ background: "rgba(167, 139, 250, 0.15)", color: "#c4b5fd" }}>
                          {item.partOfSpeech}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: "13px", color: "#d1d4e4", margin: "8px 0" }}>{item.meaning}</p>
                    {item.example && (
                      <div style={{ fontSize: "12px", fontStyle: "italic", color: "var(--text-muted)", borderLeft: "2px solid var(--accent-purple)", paddingLeft: "8px" }}>
                        "{item.example}"
                      </div>
                    )}
                  </div>
                  <div style={{ alignSelf: "flex-end" }}>
                    <button
                      type="button"
                      className="sm-danger-btn"
                      onClick={() => deleteVocab(item.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </>
    );
  }

  // -------------------------------------------------------------
  // Render: Ask AI (AI Study Assistant)
  // -------------------------------------------------------------
  function renderAskAI() {
    return (
      <>
        <h1>AI Study Assistant ✦</h1>
        <p className="sm-page-desc">Ask any academic question and get a student-friendly explanation powered by local AI.</p>

        <form className="sm-panel" onSubmit={askAI}>
          <label htmlFor="ai-question">Your Question</label>
          <textarea
            id="ai-question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. Explain Dijkstra's shortest path algorithm with a small step-by-step example..."
            rows={5}
          />
          <div style={{ marginTop: "8px" }}>
            <Button type="submit" disabled={aiLoading || !question.trim()}>
              {aiLoading ? "Thinking..." : "Ask Assistant"}
            </Button>
          </div>
        </form>

        {aiLoading && <Loading text="Consulting Ollama (qwen2.5:3b)..." />}
        <ErrorMessage>{globalError}</ErrorMessage>
        <Result title="StudyMate AI Explanation" content={aiAnswer} />
      </>
    );
  }

  // -------------------------------------------------------------
  // Render: PDF Chat
  // -------------------------------------------------------------
  function renderPDFChat() {
    return (
      <>
        <h1>PDF Chat 📄</h1>
        <p className="sm-page-desc">Upload textbook chapters or lecture slides, chat directly with the document, and generate instant summaries.</p>

        <div className="sm-panel">
          <label htmlFor="pdf-file">Choose a PDF Document</label>
          <input
            id="pdf-file"
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => {
              setPdfFile(e.target.files?.[0] || null);
              setPdfError("");
            }}
          />

          <div className="sm-button-row">
            <Button onClick={uploadPDF} disabled={pdfLoading || !pdfFile}>
              📤 Upload & Extract Text
            </Button>
            <Button secondary onClick={summarizePDF} disabled={pdfLoading || !pdfText}>
              📝 Summarize Document
            </Button>
          </div>

          {pdfLoading && <Loading text="Processing PDF with PyMuPDF and Ollama..." />}
          <ErrorMessage>{pdfError}</ErrorMessage>

          {pdfText && (
            <div className="sm-success">
              <strong>✓ Document Extracted Successfully</strong>
              <div>{pdfName}</div>
              <div style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "2px" }}>
                {pdfText.length.toLocaleString()} characters extracted {pdfPages ? `· ${pdfPages} pages` : ""}
              </div>
            </div>
          )}
        </div>

        <Result title="Document Summary" content={summary} />

        <div className="sm-panel">
          <h2>Chat with this PDF</h2>
          {!pdfText && (
            <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
              Upload and extract a PDF file above to begin asking questions.
            </p>
          )}

          <div className="sm-chat">
            {pdfMessages.map((msg, index) => (
              <div
                className={`sm-message ${msg.role === "user" ? "sm-user" : "sm-assistant"}`}
                key={`${index}-${msg.role}`}
              >
                <strong>{msg.role === "user" ? "You" : "StudyMate AI"}</strong>
                <pre className="sm-answer">{msg.text}</pre>
              </div>
            ))}
          </div>

          <form onSubmit={askPDF}>
            <label htmlFor="pdf-question">Ask a question about the document</label>
            <textarea
              id="pdf-question"
              value={pdfQuestion}
              onChange={(e) => setPdfQuestion(e.target.value)}
              placeholder="e.g. What are the key definitions and formulas mentioned in section 2?"
              rows={3}
              disabled={!pdfText || pdfLoading}
            />
            <Button type="submit" disabled={!pdfText || pdfLoading || !pdfQuestion.trim()}>
              Send Question
            </Button>
          </form>
        </div>
      </>
    );
  }

  // -------------------------------------------------------------
  // Render: Study Content Generator (Notes, MCQs, Two-Marks)
  // -------------------------------------------------------------
  function renderGenerator(mode, heading, description) {
    return (
      <>
        <h1>{heading}</h1>
        <p className="sm-page-desc">{description}</p>

        <div className="sm-panel">
          <label htmlFor="study-topic">Topic or Subject</label>
          <input
            id="study-topic"
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Memory Hierarchy and Cache Memory"
          />

          <label htmlFor="study-text">Paste Notes / Textbook Content (Optional)</label>
          <textarea
            id="study-text"
            value={studyText}
            onChange={(e) => setStudyText(e.target.value)}
            placeholder="Paste raw textbook text or class notes here..."
            rows={7}
          />

          <label htmlFor="question-count">Number of Items</label>
          <select
            id="question-count"
            value={questionCount}
            onChange={(e) => setQuestionCount(e.target.value)}
          >
            {[5, 10, 15, 20].map((num) => (
              <option key={num} value={num}>{num} questions</option>
            ))}
          </select>

          <div style={{ marginTop: "14px" }}>
            <Button
              onClick={() => generateStudy(mode)}
              disabled={studyLoading || (!topic.trim() && !studyText.trim())}
            >
              {studyLoading ? "Generating with AI..." : `⚡ Generate ${heading}`}
            </Button>
          </div>
        </div>

        {studyLoading && <Loading text="Generating study material using local AI..." />}
        <ErrorMessage>{studyError}</ErrorMessage>
        <Result title={`Generated ${heading}`} content={studyResult} />
      </>
    );
  }

  // -------------------------------------------------------------
  // Render: Flashcards Page
  // -------------------------------------------------------------
  function renderFlashcards() {
    return (
      <>
        {renderGenerator(
          "flashcards",
          "Flashcards",
          "Generate question-and-answer revision flashcards with your local AI model."
        )}

        {cards.length > 0 && (
          <div className="sm-panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <h2>Revision Deck</h2>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Card {cardIndex + 1} of {cards.length}
              </span>
            </div>

            <button
              type="button"
              className="sm-flashcard"
              onClick={() => setShowBack((prev) => !prev)}
            >
              <span className="sm-flashcard-tag">
                {showBack ? "ANSWER (CLICK TO FLIP)" : "QUESTION (CLICK TO FLIP)"}
              </span>
              <strong>{showBack ? cards[cardIndex].answer : cards[cardIndex].question}</strong>
              <small>Click anywhere to flip</small>
            </button>

            <div className="sm-button-row" style={{ justifyContent: "center" }}>
              <Button
                secondary
                disabled={cardIndex === 0}
                onClick={() => {
                  setCardIndex((v) => v - 1);
                  setShowBack(false);
                }}
              >
                ← Previous
              </Button>
              <Button
                disabled={cardIndex >= cards.length - 1}
                onClick={() => {
                  setCardIndex((v) => v + 1);
                  setShowBack(false);
                }}
              >
                Next →
              </Button>
            </div>
          </div>
        )}
      </>
    );
  }

  // -------------------------------------------------------------
  // Main Router
  // -------------------------------------------------------------
  function renderPage() {
    switch (page) {
      case "Dashboard":
        return renderDashboard();
      case "Timetable":
        return renderTimetable();
      case "Daily Tasks":
        return renderTaskPage("daily", "Daily Tasks", "Manage your daily study priorities and track today's completion rate.");
      case "Weekly Tasks":
        return renderTaskPage("weekly", "Weekly Tasks", "Organize larger assignments and goals for the current academic week.");
      case "Monthly Tasks":
        return renderTaskPage("monthly", "Monthly Tasks", "Plan long-term syllabus targets, project milestones, and monthly reviews.");
      case "Exam Reminders":
        return renderExamReminders();
      case "Vocabulary":
        return renderVocabulary();
      case "AI Study Assistant":
        return renderAskAI();
      case "PDF Chat":
        return renderPDFChat();
      case "Summaries & Notes":
        return renderGenerator("notes", "Summaries & Notes", "Turn dense lecture material into structured, readable revision notes.");
      case "MCQ Generator":
        return renderGenerator("mcq", "MCQ Generator", "Test your knowledge with AI-generated multiple-choice questions.");
      case "Two-Mark Questions":
        return renderGenerator("two_mark", "Two-Mark Questions", "Practice concise 2-mark definitions and exam-style short answers.");
      case "Flashcards":
        return renderFlashcards();
      default:
        return renderDashboard();
    }
  }

  return (
    <div className="sm-app">
      {/* Sidebar Navigation */}
      <aside className="sm-sidebar">
        <div className="sm-brand">
          <div className="sm-brand-icon">✦</div>
          <div>
            <strong>StudyMate AI</strong>
            <span>Your Study Companion</span>
          </div>
        </div>

        <p className="sm-nav-label">PLANNING & SCHEDULE</p>
        <nav className="sm-nav">
          {navItems.slice(0, 7).map((item) => (
            <button
              key={item.name}
              type="button"
              className={`sm-nav-item ${page === item.name ? "active" : ""}`}
              onClick={() => navigate(item.name)}
            >
              <span>{item.icon}</span>
              {item.name}
            </button>
          ))}
        </nav>

        <p className="sm-nav-label">AI STUDY TOOLS</p>
        <nav className="sm-nav">
          {navItems.slice(7).map((item) => (
            <button
              key={item.name}
              type="button"
              className={`sm-nav-item ${page === item.name ? "active" : ""}`}
              onClick={() => navigate(item.name)}
            >
              <span>{item.icon}</span>
              {item.name}
            </button>
          ))}
        </nav>

        <div className="sm-sidebar-bottom">
          <span className={`sm-dot ${health === "Connected" ? "online" : ""}`} />
          <span>{health}</span>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="sm-main">
        <header className="sm-topbar">
          <div className="sm-topbar-breadcrumb">
            Workspace / <strong>{page}</strong>
          </div>
          <span className="sm-topbar-status">✦ Powered by Ollama (qwen2.5:3b)</span>
        </header>

        <div className="sm-content">
          <ErrorMessage>{globalError}</ErrorMessage>
          {renderPage()}
        </div>

        <footer className="sm-footer">
          StudyMate AI · Master your studies with local AI intelligence ✨
        </footer>
      </main>
    </div>
  );
}

export default App;
