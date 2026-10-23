
import hashlib
import json
from datetime import date, datetime
from pathlib import Path

import streamlit as st

from main import run_agent
from tools import (
    extract_text_from_pdf,
    split_text_into_chunks,
    find_relevant_chunks,
)

# ==================================================
# CONFIGURATION
# ==================================================
st.set_page_config(
    page_title="StudyMate AI | Your AI Study Space",
    page_icon="📚",
    layout="wide",
    initial_sidebar_state="expanded",
)

DATA_FILE = Path(__file__).resolve().parent / "studymate_data.json"

TOOLS = [
    "Dashboard",
    "Ask AI",
    "PDF Chat",
    "Summarize & Notes",
    "Generate MCQs",
    "Two-Mark Questions",
    "Flashcards",
]

QUICK_ACTIONS = [
    ("💬", "Ask AI", "Understand concepts with AI."),
    ("📄", "PDF Chat", "Chat with your study PDFs."),
    ("📝", "Summarize & Notes", "Create organized notes."),
    ("🎯", "Generate MCQs", "Practise exam questions."),
    ("⚡", "Two-Mark Questions", "Revise short answers."),
    ("🗂️", "Flashcards", "Practise active recall."),
]


# ==================================================
# DATA STORAGE
# ==================================================
def load_data():
    """Load locally saved StudyMate data."""
    defaults = {
        "tasks": [],
        "exams": [],
        "activity": [],
        "motivations": [],
        "vocabulary": [],
    }

    if not DATA_FILE.exists():
        return defaults

    try:
        with DATA_FILE.open("r", encoding="utf-8") as file:
            saved = json.load(file)

        if not isinstance(saved, dict):
            return defaults

        for key, default_value in defaults.items():
            if not isinstance(saved.get(key), list):
                saved[key] = default_value

        return saved

    except (OSError, json.JSONDecodeError):
        return defaults


def save_data():
    """Save all dashboard data to a local JSON file."""
    temporary_file = DATA_FILE.with_suffix(".tmp")

    try:
        with temporary_file.open("w", encoding="utf-8") as file:
            json.dump(
                st.session_state.study_data,
                file,
                indent=2,
                ensure_ascii=False,
            )

        temporary_file.replace(DATA_FILE)

    except OSError as error:
        st.error(f"Could not save your data: {error}")


def make_id(value):
    """Create a unique-enough ID for a saved entry."""
    return hashlib.sha256(
        f"{value}|{datetime.now().isoformat()}".encode("utf-8")
    ).hexdigest()[:16]


def record_activity(tool, description):
    """Record an actual tool action."""
    data = st.session_state.study_data

    data["activity"].append({
        "id": make_id(description),
        "tool": tool,
        "description": description,
        "timestamp": datetime.now().isoformat(timespec="seconds"),
    })

    data["activity"] = data["activity"][-100:]
    save_data()


if "study_data" not in st.session_state:
    st.session_state.study_data = load_data()

if "selected_tool" not in st.session_state:
    st.session_state.selected_tool = "Dashboard"

if "pdf_messages" not in st.session_state:
    st.session_state.pdf_messages = []


# ==================================================
# STYLING
# ==================================================
st.markdown(
    """
    <style>
    @import url(
      'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap'
    );

    :root {
        --primary: #7667F5;
        --primary-light: #A59BFF;
        --background: #0B1020;
        --surface: #131B2E;
        --border: #293651;
        --text: #F3F5FF;
        --muted: #9EABC4;
    }

    .stApp {
        background:
            radial-gradient(
                ellipse at 85% 0%,
                rgba(118, 103, 245, 0.12),
                transparent 36%
            ),
            #0B1020;
        color: var(--text);
        font-family: 'DM Sans', sans-serif;
    }

    [data-testid="stHeader"] {
        background: rgba(11, 16, 32, 0.88);
    }

    [data-testid="stSidebar"] {
        background: #0E1526;
        border-right: 1px solid #26324A;
    }

    [data-testid="stSidebar"] > div:first-child {
        padding-top: 1.2rem;
    }

    h1, h2, h3 {
        font-family: 'Space Grotesk', sans-serif !important;
        color: #F3F5FF !important;
        letter-spacing: -0.4px;
    }

    p, label, li {
        color: #D0D7E8;
    }

    .brand {
        font-family: 'Space Grotesk', sans-serif;
        font-size: 1.55rem;
        font-weight: 700;
        letter-spacing: -0.8px;
        color: #FFFFFF;
    }

    .brand span {
        color: #A59BFF;
    }

    .brand-subtitle {
        color: #8996B0;
        font-size: 0.78rem;
        margin-top: 4px;
        margin-bottom: 24px;
    }

    .section-label {
        color: #A59BFF;
        text-transform: uppercase;
        letter-spacing: 1.6px;
        font-size: 0.72rem;
        font-weight: 700;
        margin: 18px 0 10px 0;
    }

    .hero {
        padding: 29px 31px;
        border: 1px solid #344064;
        border-radius: 22px;
        background:
            radial-gradient(
                circle at 90% 10%,
                rgba(165, 155, 255, 0.22),
                transparent 35%
            ),
            linear-gradient(
                125deg,
                #192440,
                #151B32 70%,
                #201C42
            );
        margin-bottom: 24px;
    }

    .hero-kicker {
        color: #B8B0FF;
        text-transform: uppercase;
        letter-spacing: 2px;
        font-size: 0.72rem;
        font-weight: 700;
        margin-bottom: 10px;
    }

    .hero h1 {
        font-size: clamp(1.8rem, 4vw, 2.5rem);
        line-height: 1.2;
        margin: 0 0 12px 0;
    }

    .hero p {
        color: #B8C3D9;
        font-size: 0.98rem;
        line-height: 1.7;
        max-width: 700px;
        margin-bottom: 0;
    }

    .metric-card {
        background: linear-gradient(145deg, #172139, #121A2C);
        border: 1px solid #293651;
        border-radius: 15px;
        padding: 17px;
        min-height: 112px;
    }

    .metric-label {
        color: #9EABC4;
        font-size: 0.78rem;
        margin-bottom: 9px;
    }

    .metric-value {
        color: #F3F5FF;
        font-family: 'Space Grotesk', sans-serif;
        font-weight: 700;
        font-size: 1.8rem;
        line-height: 1.2;
    }

    .metric-caption {
        color: #8996B0;
        font-size: 0.75rem;
        margin-top: 7px;
    }

    .panel {
        background: #121A2C;
        border: 1px solid #293651;
        border-radius: 16px;
        padding: 18px;
        margin-bottom: 10px;
    }

    .panel-title {
        color: #F3F5FF;
        font-size: 1.02rem;
        font-weight: 700;
        margin-bottom: 5px;
    }

    .panel-subtitle {
        color: #9EABC4;
        font-size: 0.83rem;
        line-height: 1.5;
    }

    .quick-card {
        background: linear-gradient(145deg, #172139, #121A2C);
        border: 1px solid #293651;
        border-radius: 14px;
        padding: 15px;
        min-height: 110px;
        margin-bottom: 8px;
    }

    .quick-icon {
        font-size: 1.35rem;
        margin-bottom: 8px;
    }

    .quick-title {
        color: #F3F5FF;
        font-weight: 700;
        font-size: 0.94rem;
        margin-bottom: 5px;
    }

    .quick-description {
        color: #9EABC4;
        font-size: 0.78rem;
        line-height: 1.45;
    }

    .motivation-card {
        background:
            radial-gradient(
                circle at 95% 5%,
                rgba(165, 155, 255, 0.17),
                transparent 40%
            ),
            linear-gradient(130deg, #1A2340, #17162F);
        border: 1px solid #51478B;
        border-radius: 17px;
        padding: 22px;
        margin-bottom: 12px;
    }

    .motivation-heading {
        color: #C3BAFF;
        font-size: 0.76rem;
        font-weight: 700;
        letter-spacing: 1.5px;
        text-transform: uppercase;
        margin-bottom: 13px;
    }

    .motivation-quote {
        color: #F5F3FF;
        font-family: 'Space Grotesk', sans-serif;
        font-size: 1.18rem;
        font-weight: 600;
        line-height: 1.65;
    }

    .vocabulary-card {
        background: linear-gradient(145deg, #172139, #121A2C);
        border: 1px solid #3A4770;
        border-radius: 17px;
        padding: 21px;
        margin-bottom: 12px;
    }

    .vocabulary-word {
        color: #C3BAFF;
        font-family: 'Space Grotesk', sans-serif;
        font-size: 1.6rem;
        font-weight: 700;
        margin-bottom: 8px;
    }

    .vocabulary-meaning {
        color: #F3F5FF;
        font-size: 0.95rem;
        line-height: 1.65;
    }

    .vocabulary-example {
        color: #AEBBD4;
        font-size: 0.87rem;
        font-style: italic;
        line-height: 1.6;
        margin-top: 10px;
    }

    .empty-state {
        background: #111A2D;
        border: 1px dashed #344064;
        border-radius: 13px;
        padding: 17px;
        color: #9EABC4;
        font-size: 0.85rem;
        line-height: 1.6;
    }

    .status-card {
        border: 1px solid #293651;
        background: #131B2E;
        border-radius: 13px;
        padding: 15px 17px;
        margin: 14px 0;
    }

    .status-label {
        color: #9EABC4;
        font-size: 0.77rem;
        margin-bottom: 6px;
    }

    .status-value {
        color: #F3F5FF;
        font-weight: 700;
        font-size: 1rem;
    }

    [data-testid="stSidebar"] .stButton > button {
        background: transparent;
        color: #C8D2E8;
        border: 1px solid transparent;
        border-radius: 10px;
        min-height: 41px;
        text-align: left;
        justify-content: flex-start;
        padding: 8px 12px;
        box-shadow: none;
    }

    [data-testid="stSidebar"] .stButton > button:hover {
        background: #192440;
        color: #FFFFFF;
        border-color: #344064;
    }

    [data-testid="stSidebar"] .stButton > button[kind="primary"] {
        background: linear-gradient(110deg, #7667F5, #6554D9);
        color: #FFFFFF;
        border-color: #8C80FF;
    }

    [data-testid="stMain"] .stButton > button {
        border-radius: 10px;
        border: 1px solid #4F46A5;
        background: linear-gradient(110deg, #7667F5, #6554D9);
        color: white;
        font-weight: 600;
        min-height: 39px;
        transition: all 0.2s ease;
    }

    [data-testid="stMain"] .stButton > button:hover {
        border-color: #A59BFF;
        background: linear-gradient(110deg, #887BFF, #7667F5);
        color: white;
        box-shadow: 0 5px 20px rgba(118, 103, 245, 0.2);
    }

    .stTextInput input,
    .stTextArea textarea {
        background: #111A2D;
        border: 1px solid #33415D;
        border-radius: 10px;
        color: #F3F5FF;
    }

    [data-testid="stDateInput"] input,
    [data-testid="stNumberInput"] input {
        background: #111A2D;
        color: #F3F5FF;
    }

    [data-testid="stFileUploader"] {
        background: #111A2D;
        border: 1px dashed #655BC0;
        border-radius: 15px;
        padding: 12px;
    }

    [data-testid="stChatMessage"] {
        background: #131B2E;
        border: 1px solid #293651;
        border-radius: 15px;
        padding: 15px;
        margin-bottom: 10px;
    }

    [data-testid="stExpander"] {
        background: #111A2D;
        border: 1px solid #293651;
        border-radius: 12px;
    }

    hr {
        border-color: #293651;
    }

    .footer {
        color: #71809B;
        text-align: center;
        font-size: 0.78rem;
        padding: 22px 0 8px 0;
    }

    #MainMenu, footer {
        visibility: hidden;
    }

    @media (max-width: 700px) {
        .hero {
            padding: 22px 19px;
        }

        .metric-card {
            margin-bottom: 8px;
        }
    }
    </style>
    """,
    unsafe_allow_html=True,
)


# ==================================================
# SHARED HELPERS
# ==================================================
def delete_entry(collection_name, entry_id):
    """Delete a saved entry by its ID."""
    data = st.session_state.study_data
    data[collection_name] = [
        item
        for item in data[collection_name]
        if item.get("id") != entry_id
    ]
    save_data()


def get_upcoming_exams():
    """Return valid exams happening today or in the future."""
    today = date.today()
    result = []

    for exam in st.session_state.study_data["exams"]:
        try:
            exam_date = date.fromisoformat(exam["date"])
            if exam_date >= today:
                result.append((exam, exam_date))
        except (ValueError, KeyError, TypeError):
            continue

    return sorted(result, key=lambda item: item[1])


def get_today_vocabulary():
    """Return vocabulary entries saved on today's date."""
    today = date.today().isoformat()

    return [
        item
        for item in st.session_state.study_data["vocabulary"]
        if item.get("created_at", "").startswith(today)
    ]


# ==================================================
# SIDEBAR NAVIGATION
# ==================================================
with st.sidebar:
    st.markdown(
        """
        <div class="brand">StudyMate<span> AI.</span></div>
        <div class="brand-subtitle">YOUR PERSONAL STUDY SPACE</div>
        <div class="section-label">WORKSPACE</div>
        """,
        unsafe_allow_html=True,
    )

    icons = {
        "Dashboard": "⌂",
        "Ask AI": "✦",
        "PDF Chat": "▤",
        "Summarize & Notes": "✎",
        "Generate MCQs": "◎",
        "Two-Mark Questions": "⚡",
        "Flashcards": "▧",
    }

    for item in TOOLS:
        selected = st.session_state.selected_tool == item

        if st.button(
            f"{icons[item]}   {item}",
            key=f"nav_{item}",
            use_container_width=True,
            type="primary" if selected else "secondary",
        ):
            st.session_state.selected_tool = item
            st.rerun()

    st.divider()

    st.markdown(
        """
        <div class="status-card">
            <div class="status-label">AI ENGINE</div>
            <div class="status-value">✦ Qwen 2.5 · 3B</div>
            <div class="status-label" style="margin-top:8px">
                Powered by local Ollama
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    st.caption("Study smarter. Learn better.")

selected_tool = st.session_state.selected_tool


# ==================================================
# HERO
# ==================================================
hero_content = {
    "Dashboard": (
        "YOUR LEARNING JOURNEY",
        "Welcome to your study space.",
        "Plan your learning, prepare for exams, and make time "
        "for a little motivation and vocabulary every day.",
    ),
    "Ask AI": (
        "AI STUDY ASSISTANT",
        "Curiosity starts here.",
        "Ask academic questions and get explanations in "
        "student-friendly language.",
    ),
    "PDF Chat": (
        "DOCUMENT INTELLIGENCE",
        "Your PDFs. Your questions.",
        "Explore study materials and ask questions about "
        "your uploaded documents.",
    ),
    "Summarize & Notes": (
        "SMART NOTE-MAKING",
        "Turn information into clarity.",
        "Transform study material into structured notes "
        "that are easier to review.",
    ),
    "Generate MCQs": (
        "EXAM PRACTICE",
        "Practice with purpose.",
        "Generate multiple-choice questions to revise important topics.",
    ),
    "Two-Mark Questions": (
        "QUICK REVISION",
        "Prepare for the small questions.",
        "Generate concise, exam-oriented questions and answers.",
    ),
    "Flashcards": (
        "ACTIVE RECALL",
        "Make every revision count.",
        "Create question-and-answer flashcards for faster revision.",
    ),
}

kicker, headline, description = hero_content[selected_tool]

st.markdown(
    f"""
    <div class="hero">
        <div class="hero-kicker">{kicker}</div>
        <h1>{headline}</h1>
        <p>{description}</p>
    </div>
    """,
    unsafe_allow_html=True,
)


# ==================================================
# DASHBOARD
# ==================================================
if selected_tool == "Dashboard":
    data = st.session_state.study_data
    tasks = data["tasks"]
    completed_tasks = sum(
        bool(task.get("completed", False)) for task in tasks
    )
    total_tasks = len(tasks)
    upcoming_exams = get_upcoming_exams()
    today = date.today()

    # --------------------------------------------------
    # OVERVIEW METRICS
    # --------------------------------------------------
    st.markdown(
        '<div class="section-label">YOUR OVERVIEW</div>',
        unsafe_allow_html=True,
    )

    metrics = [
        (
            "Tasks completed",
            str(completed_tasks),
            f"Out of {total_tasks} planned tasks",
        ),
        (
            "Tasks remaining",
            str(total_tasks - completed_tasks),
            "Tasks not yet completed",
        ),
        (
            "Upcoming exams",
            str(len(upcoming_exams)),
            "Future exams on your list",
        ),
        (
            "Vocabulary learned",
            str(len(data["vocabulary"])),
            "Words you have saved",
        ),
    ]

    metric_columns = st.columns(4)

    for column, (label, value, caption) in zip(metric_columns, metrics):
        with column:
            st.markdown(
                f"""
                <div class="metric-card">
                    <div class="metric-label">{label}</div>
                    <div class="metric-value">{value}</div>
                    <div class="metric-caption">{caption}</div>
                </div>
                """,
                unsafe_allow_html=True,
            )

    # --------------------------------------------------
    # STUDY PROGRESS
    # --------------------------------------------------
    st.markdown(
        '<div class="section-label">STUDY PROGRESS</div>',
        unsafe_allow_html=True,
    )

    if total_tasks:
        progress = completed_tasks / total_tasks
        st.progress(progress)
        st.write(
            f"**{completed_tasks} of {total_tasks} tasks completed** "
            f"({round(progress * 100)}%)."
        )
    else:
        st.markdown(
            """
            <div class="empty-state">
                Your progress will appear here after you add study tasks.
                No study progress has been assumed.
            </div>
            """,
            unsafe_allow_html=True,
        )

    # --------------------------------------------------
    # MOTIVATION CORNER
    # --------------------------------------------------
    st.markdown(
        '<div class="section-label">A LITTLE MOTIVATION</div>',
        unsafe_allow_html=True,
    )

    motivations = data["motivations"]

    if motivations:
        # Show the most recently saved motivation.
        current_motivation = motivations[-1]

        st.markdown(
            f"""
            <div class="motivation-card">
                <div class="motivation-heading">
                    ✨ MY MOTIVATION CORNER
                </div>
                <div class="motivation-quote">
                    “{current_motivation["text"]}”
                </div>
            </div>
            """,
            unsafe_allow_html=True,
        )
    else:
        st.markdown(
            """
            <div class="motivation-card">
                <div class="motivation-heading">
                    ✨ MY MOTIVATION CORNER
                </div>
                <div class="motivation-quote">
                    Your next favourite motivational line belongs here.
                </div>
                <div class="panel-subtitle" style="margin-top:10px">
                    Add your own words below to make this space yours.
                </div>
            </div>
            """,
            unsafe_allow_html=True,
        )

    with st.form("add_motivation_form", clear_on_submit=True):
        motivation_text = st.text_area(
            "Add your motivation line",
            placeholder=(
                "Write something that inspires you to keep going..."
            ),
            max_chars=500,
        )

        save_motivation = st.form_submit_button(
            "♡ Save motivation",
            use_container_width=True,
        )

    if save_motivation:
        if motivation_text.strip():
            data["motivations"].append({
                "id": make_id(motivation_text),
                "text": motivation_text.strip(),
                "created_at": datetime.now().isoformat(
                    timespec="seconds"
                ),
            })

            save_data()
            st.success("Your motivation line has been saved.")
            st.rerun()
        else:
            st.warning("Please enter a motivation line.")

    if motivations:
        with st.expander("Manage saved motivation lines"):
            for item in reversed(motivations):
                line_col, delete_col = st.columns(
                    [6, 1],
                    vertical_alignment="center",
                )

                with line_col:
                    st.write(f"“{item['text']}”")

                with delete_col:
                    if st.button(
                        "🗑️",
                        key=f"delete_motivation_{item['id']}",
                        help="Delete this motivation line",
                    ):
                        delete_entry("motivations", item["id"])
                        st.rerun()

    # --------------------------------------------------
    # DAILY VOCABULARY
    # --------------------------------------------------
    st.markdown(
        '<div class="section-label">DAILY VOCABULARY</div>',
        unsafe_allow_html=True,
    )

    vocabulary = data["vocabulary"]
    today_words = get_today_vocabulary()

    if today_words:
        word_of_day = today_words[-1]

        st.markdown(
            f"""
            <div class="vocabulary-card">
                <div class="panel-subtitle">
                    ✦ WORD YOU SAVED TODAY
                </div>
                <div class="vocabulary-word">
                    {word_of_day["word"]}
                </div>
                <div class="vocabulary-meaning">
                    {word_of_day["meaning"]}
                </div>
                <div class="vocabulary-example">
                    Example: {word_of_day.get("example") or "No example added."}
                </div>
            </div>
            """,
            unsafe_allow_html=True,
        )
    else:
        st.markdown(
            """
            <div class="vocabulary-card">
                <div class="panel-subtitle">
                    ✦ WORD OF THE DAY
                </div>
                <div class="vocabulary-word">
                    Your next new word
                </div>
                <div class="vocabulary-meaning">
                    Add a word you learned today to build your vocabulary.
                </div>
            </div>
            """,
            unsafe_allow_html=True,
        )

    with st.form("add_vocabulary_form", clear_on_submit=True):
        vocabulary_word = st.text_input(
            "New English word",
            placeholder="e.g. Resilience",
            max_chars=100,
        )

        vocabulary_meaning = st.text_area(
            "Meaning",
            placeholder="Explain the word in your own words...",
            max_chars=1000,
        )

        vocabulary_example = st.text_input(
            "Example sentence (optional)",
            placeholder="Use the word in a sentence...",
            max_chars=500,
        )

        vocabulary_synonym = st.text_input(
            "Synonym (optional)",
            placeholder="A word with a similar meaning...",
            max_chars=200,
        )

        save_word = st.form_submit_button(
            "＋ Save vocabulary word",
            use_container_width=True,
        )

    if save_word:
        if not vocabulary_word.strip() or not vocabulary_meaning.strip():
            st.warning("Please enter both the word and its meaning.")
        else:
            normalized_word = vocabulary_word.strip().casefold()

            already_saved = any(
                item.get("word", "").casefold() == normalized_word
                for item in data["vocabulary"]
            )

            if already_saved:
                st.warning(
                    "That word is already in your vocabulary collection."
                )
            else:
                data["vocabulary"].append({
                    "id": make_id(vocabulary_word),
                    "word": vocabulary_word.strip(),
                    "meaning": vocabulary_meaning.strip(),
                    "example": vocabulary_example.strip(),
                    "synonym": vocabulary_synonym.strip(),
                    "created_at": datetime.now().isoformat(
                        timespec="seconds"
                    ),
                })

                save_data()
                st.success("Your new word has been saved.")
                st.rerun()

    if vocabulary:
        with st.expander(
            f"Explore your vocabulary ({len(vocabulary)} words)"
        ):
            search_word = st.text_input(
                "Search saved words",
                placeholder="Search word or meaning...",
                key="vocabulary_search",
            )

            filtered_words = [
                item
                for item in reversed(vocabulary)
                if (
                    search_word.strip().casefold() in item["word"].casefold()
                    or search_word.strip().casefold()
                    in item["meaning"].casefold()
                )
            ]

            if filtered_words:
                for item in filtered_words:
                    st.markdown(f"### {item['word']}")
                    st.write(f"**Meaning:** {item['meaning']}")

                    if item.get("synonym"):
                        st.write(f"**Synonym:** {item['synonym']}")

                    if item.get("example"):
                        st.write(f"**Example:** {item['example']}")

                    st.caption(
                        f"Saved on {item.get('created_at', '')[:10]}"
                    )

                    if st.button(
                        "Delete word",
                        key=f"delete_word_{item['id']}",
                    ):
                        delete_entry("vocabulary", item["id"])
                        st.rerun()

                    st.divider()
            else:
                st.info("No matching vocabulary words found.")

    # --------------------------------------------------
    # STUDY PLANNER AND EXAMS
    # --------------------------------------------------
    st.markdown(
        '<div class="section-label">PLAN YOUR LEARNING</div>',
        unsafe_allow_html=True,
    )

    planner_column, exam_column = st.columns(2, gap="large")

    # ---------------- STUDY PLANNER ----------------
    with planner_column:
        st.markdown(
            """
            <div class="panel">
                <div class="panel-title">📅 Study Planner</div>
                <div class="panel-subtitle">
                    Add tasks and track your revision.
                </div>
            </div>
            """,
            unsafe_allow_html=True,
        )

        with st.form("add_study_task", clear_on_submit=True):
            task_title = st.text_input(
                "Task name",
                placeholder="e.g. Revise database normalization",
            )

            task_due = st.date_input(
                "Due date",
                value=today,
                key="new_task_due",
            )

            task_priority = st.selectbox(
                "Priority",
                ["Normal", "High", "Low"],
            )

            add_task = st.form_submit_button(
                "＋ Add study task",
                use_container_width=True,
            )

        if add_task:
            if task_title.strip():
                data["tasks"].append({
                    "id": make_id(task_title),
                    "title": task_title.strip(),
                    "due": task_due.isoformat(),
                    "priority": task_priority,
                    "completed": False,
                })

                save_data()
                st.success("Study task added.")
                st.rerun()
            else:
                st.warning("Please enter a task name.")

        tasks = st.session_state.study_data["tasks"]

        if tasks:
            sorted_tasks = sorted(
                tasks,
                key=lambda task: (
                    task.get("completed", False),
                    task.get("due", "9999-12-31"),
                ),
            )

            for task in sorted_tasks[:8]:
                task_col, action_col = st.columns(
                    [5, 1],
                    vertical_alignment="center",
                )

                with task_col:
                    status = (
                        "✅"
                        if task.get("completed", False)
                        else "⬜"
                    )

                    st.markdown(f"{status} **{task['title']}**")
                    st.caption(
                        f"Due: {task.get('due', 'Not set')} · "
                        f"Priority: {task.get('priority', 'Normal')}"
                    )

                with action_col:
                    if not task.get("completed", False):
                        if st.button(
                            "✓",
                            key=f"complete_{task['id']}",
                            help="Mark task complete",
                        ):
                            for saved_task in data["tasks"]:
                                if saved_task["id"] == task["id"]:
                                    saved_task["completed"] = True
                                    break

                            save_data()
                            st.rerun()
                    else:
                        if st.button(
                            "↩",
                            key=f"reopen_{task['id']}",
                            help="Reopen task",
                        ):
                            for saved_task in data["tasks"]:
                                if saved_task["id"] == task["id"]:
                                    saved_task["completed"] = False
                                    break

                            save_data()
                            st.rerun()

            if len(tasks) > 8:
                st.caption(f"Showing 8 of {len(tasks)} tasks.")

            with st.expander("Manage study tasks"):
                for task in tasks:
                    if st.button(
                        f"Delete: {task['title']}",
                        key=f"delete_task_{task['id']}",
                    ):
                        delete_entry("tasks", task["id"])
                        st.rerun()
        else:
            st.markdown(
                """
                <div class="empty-state">
                    No study tasks yet. Add your first task above.
                </div>
                """,
                unsafe_allow_html=True,
            )

    # ---------------- EXAM COUNTDOWN ----------------
    with exam_column:
        st.markdown(
            """
            <div class="panel">
                <div class="panel-title">🎓 Exam Countdown</div>
                <div class="panel-subtitle">
                    Save exam dates and see how many days remain.
                </div>
            </div>
            """,
            unsafe_allow_html=True,
        )

        with st.form("add_exam", clear_on_submit=True):
            exam_name = st.text_input(
                "Exam or subject",
                placeholder="e.g. Compiler Design",
            )

            exam_date = st.date_input(
                "Exam date",
                value=today,
                key="new_exam_date",
            )

            add_exam = st.form_submit_button(
                "＋ Add exam",
                use_container_width=True,
            )

        if add_exam:
            if exam_name.strip():
                data["exams"].append({
                    "id": make_id(exam_name),
                    "name": exam_name.strip(),
                    "date": exam_date.isoformat(),
                })

                save_data()
                st.success("Exam added.")
                st.rerun()
            else:
                st.warning("Please enter an exam name.")

        upcoming_exams = get_upcoming_exams()

        if upcoming_exams:
            for exam, exam_date_value in upcoming_exams[:6]:
                days_left = (exam_date_value - today).days

                if days_left == 0:
                    countdown = "Today"
                elif days_left == 1:
                    countdown = "1 day left"
                else:
                    countdown = f"{days_left} days left"

                st.markdown(
                    f"""
                    <div class="panel">
                        <div class="panel-title">
                            {exam["name"]}
                        </div>
                        <div class="panel-subtitle">
                            {exam_date_value.strftime("%d %b %Y")}
                        </div>
                        <div style="
                            color:#B8B0FF;
                            font-size:1.05rem;
                            font-weight:700;
                            margin-top:8px;
                        ">
                            {countdown}
                        </div>
                    </div>
                    """,
                    unsafe_allow_html=True,
                )
        else:
            st.markdown(
                """
                <div class="empty-state">
                    No upcoming exams added. Add an exam date above
                    to see your countdown here.
                </div>
                """,
                unsafe_allow_html=True,
            )

        with st.expander("Manage saved exams"):
            if data["exams"]:
                for exam in data["exams"]:
                    if st.button(
                        f"Delete: {exam['name']} ({exam['date']})",
                        key=f"delete_exam_{exam['id']}",
                    ):
                        delete_entry("exams", exam["id"])
                        st.rerun()
            else:
                st.caption("No saved exams to manage.")

    # --------------------------------------------------
    # QUICK ACTIONS
    # --------------------------------------------------
    st.markdown(
        '<div class="section-label">QUICK ACTIONS</div>',
        unsafe_allow_html=True,
    )

    st.caption(
        "Open your study tools here or use the sidebar navigation."
    )

    for row_start in range(0, len(QUICK_ACTIONS), 3):
        columns = st.columns(3)

        for column, action in zip(
            columns,
            QUICK_ACTIONS[row_start:row_start + 3],
        ):
            icon, title, action_description = action

            with column:
                st.markdown(
                    f"""
                    <div class="quick-card">
                        <div class="quick-icon">{icon}</div>
                        <div class="quick-title">{title}</div>
                        <div class="quick-description">
                            {action_description}
                        </div>
                    </div>
                    """,
                    unsafe_allow_html=True,
                )

                if st.button(
                    f"Open {title} →",
                    key=f"quick_{title}",
                    use_container_width=True,
                ):
                    st.session_state.selected_tool = title
                    st.rerun()

    # --------------------------------------------------
    # RECENT ACTIVITY
    # --------------------------------------------------
    st.markdown(
        '<div class="section-label">RECENT ACTIVITY</div>',
        unsafe_allow_html=True,
    )

    recent_activity = list(
        reversed(data["activity"][-5:])
    )

    if recent_activity:
        for item in recent_activity:
            try:
                timestamp = datetime.fromisoformat(
                    item["timestamp"]
                ).strftime("%d %b, %I:%M %p")
            except (ValueError, KeyError, TypeError):
                timestamp = "Time unavailable"

            st.markdown(
                f"**{item.get('tool', 'Study activity')}** — "
                f"{item.get('description', '')}"
            )
            st.caption(timestamp)
    else:
        st.markdown(
            """
            <div class="empty-state">
                Your AI study activity will appear here after you
                generate notes, create quizzes, or use your study tools.
            </div>
            """,
            unsafe_allow_html=True,
        )


# ==================================================
# ASK AI
# ==================================================
elif selected_tool == "Ask AI":
    st.subheader("Ask your question")

    question = st.text_area(
        "What would you like to learn?",
        placeholder="For example: Explain operating systems in simple words...",
        height=120,
        key="ask_question",
    )

    if st.button("✦ Ask StudyMate AI", key="ask_ai"):
        if question.strip():
            with st.spinner("Thinking through your question..."):
                answer = run_agent(question)

            st.markdown("### Answer")
            st.markdown(answer)

            record_activity(
                "Ask AI",
                f"Asked: {question.strip()[:100]}",
            )
        else:
            st.warning("Please enter a question.")


# ==================================================
# PDF CHAT
# ==================================================
elif selected_tool == "PDF Chat":
    st.subheader("Chat with your study material")

    st.write(
        "Upload a text-based PDF, then ask questions about its content."
    )

    uploaded_pdf = st.file_uploader(
        "Upload your PDF",
        type=["pdf"],
        key="study_pdf",
    )

    if uploaded_pdf is not None:
        pdf_bytes = uploaded_pdf.getvalue()

        pdf_id = hashlib.sha256(
            uploaded_pdf.name.encode("utf-8") + pdf_bytes
        ).hexdigest()

        if st.session_state.get("pdf_id") != pdf_id:
            st.session_state["pdf_id"] = pdf_id
            st.session_state.pop("pdf_text", None)
            st.session_state.pop("pdf_chunks", None)
            st.session_state["pdf_messages"] = []

        if "pdf_text" not in st.session_state:
            with st.spinner("Reading your PDF..."):
                extracted_text = extract_text_from_pdf(uploaded_pdf)

            if extracted_text.startswith("Could not read the PDF:"):
                st.error(extracted_text)

            elif extracted_text.startswith(
                "No readable text was found"
            ):
                st.warning(extracted_text)
                st.info(
                    "Scanned PDFs need OCR to extract their text."
                )

            else:
                st.session_state["pdf_text"] = extracted_text
                st.session_state["pdf_chunks"] = split_text_into_chunks(
                    extracted_text,
                    chunk_size=2500,
                    overlap=300,
                )
                st.session_state["pdf_messages"] = []

                record_activity(
                    "PDF Chat",
                    f"Uploaded {uploaded_pdf.name}",
                )

        if (
            "pdf_text" in st.session_state
            and "pdf_chunks" in st.session_state
        ):
            chunks = st.session_state["pdf_chunks"]

            st.success(
                f"Document ready · {len(chunks)} text sections"
            )

            with st.expander("Preview extracted text"):
                st.text(st.session_state["pdf_text"][:5000])

            if st.button(
                "Clear conversation",
                key="clear_pdf_chat",
            ):
                st.session_state["pdf_messages"] = []
                st.rerun()

            for message in st.session_state["pdf_messages"]:
                with st.chat_message(message["role"]):
                    st.markdown(message["content"])

            question = st.chat_input(
                "Ask something about your PDF..."
            )

            if question and question.strip():
                previous_messages = st.session_state[
                    "pdf_messages"
                ][-6:]

                st.session_state["pdf_messages"].append({
                    "role": "user",
                    "content": question,
                })

                with st.chat_message("user"):
                    st.markdown(question)

                relevant_chunks = find_relevant_chunks(
                    question,
                    chunks,
                    max_chunks=2,
                )

                if not relevant_chunks:
                    answer = (
                        "I couldn't find a clearly relevant section "
                        "in the extracted PDF text. Try using keywords "
                        "from your document."
                    )

                    with st.chat_message("assistant"):
                        st.markdown(answer)

                else:
                    pdf_context = "\n\n---\n\n".join(
                        relevant_chunks
                    )

                    conversation_context = "\n".join(
                        f"{message['role'].upper()}: "
                        f"{message['content']}"
                        for message in previous_messages
                    )

                    prompt = f"""
You are StudyMate AI, a helpful study assistant.

Answer using the relevant PDF excerpts. Use recent conversation
history to understand follow-up questions.

Rules:
- Prioritize information supported by the PDF excerpts.
- Do not invent facts or claim to have read text not supplied.
- If the excerpts do not answer the question, say so clearly.
- Use conversation history to understand references.
- Explain concepts in clear, student-friendly language.
- Mention page numbers when available in the excerpts.

Recent conversation:
{conversation_context if conversation_context else "No previous messages."}

Relevant PDF excerpts:
---
{pdf_context}
---

Current question:
{question}

Give a helpful, direct answer.
"""

                    with st.chat_message("assistant"):
                        with st.spinner("Finding an answer..."):
                            answer = run_agent(prompt)

                        st.markdown(answer)

                st.session_state["pdf_messages"].append({
                    "role": "assistant",
                    "content": answer,
                })

                record_activity(
                    "PDF Chat",
                    f"Asked about {uploaded_pdf.name}: {question[:80]}",
                )


# ==================================================
# SUMMARIZE & NOTES
# ==================================================
elif selected_tool == "Summarize & Notes":
    st.subheader("Create your study notes")

    topic = st.text_area(
        "Paste your study material",
        placeholder="Paste a topic, textbook extract, or class notes...",
        height=180,
        key="notes_material",
    )

    if st.button("✦ Generate Notes", key="notes"):
        if topic.strip():
            prompt = (
                "Create clear, well-organized study notes from "
                "the following material. Use headings, bullet points, "
                "definitions, and important facts where appropriate:\n\n"
                + topic
            )

            with st.spinner("Organizing your notes..."):
                answer = run_agent(prompt)

            st.markdown(answer)

            record_activity(
                "Summarize & Notes",
                f"Created notes from: {topic.strip()[:100]}",
            )
        else:
            st.warning("Please enter some study material.")


# ==================================================
# GENERATE MCQS
# ==================================================
elif selected_tool == "Generate MCQs":
    st.subheader("Build a practice quiz")

    topic = st.text_area(
        "Enter your subject or topic",
        placeholder="For example: Database normalization...",
        key="mcq_topic",
    )

    number = st.number_input(
        "Number of questions",
        min_value=1,
        max_value=20,
        value=5,
        key="mcq_count",
    )

    if st.button("✦ Generate Quiz", key="quiz"):
        if topic.strip():
            prompt = (
                f"Create exactly {number} multiple-choice questions "
                f"about this topic: {topic}.\n\n"
                "Follow this format for every question:\n\n"
                "Question 1: [Question]\n\n"
                "A) [Option A]\n\n"
                "B) [Option B]\n\n"
                "C) [Option C]\n\n"
                "D) [Option D]\n\n"
                "Correct Answer: [Letter and full answer]\n\n"
                "Explanation: [Brief explanation]\n\n"
                "Formatting rules:\n"
                "- Put every option on its own separate line.\n"
                "- Leave a blank line between options.\n"
                "- Never place multiple options on one line.\n"
                "- Include exactly four options per question.\n"
                "- Clearly separate every question.\n"
                "- Mark the correct answer and explain why it is correct."
            )

            with st.spinner("Preparing your quiz..."):
                answer = run_agent(prompt)

            st.markdown(answer)

            record_activity(
                "Generate MCQs",
                f"Generated a quiz about: {topic.strip()[:100]}",
            )
        else:
            st.warning("Please enter a topic.")


# ==================================================
# TWO-MARK QUESTIONS
# ==================================================
elif selected_tool == "Two-Mark Questions":
    st.subheader("Prepare for quick revision")

    topic = st.text_area(
        "Enter your subject or topic",
        placeholder="For example: Compiler design — code optimization...",
        key="two_mark_topic",
    )

    if st.button("✦ Generate Questions", key="two_marks"):
        if topic.strip():
            prompt = (
                "Generate exam-oriented two-mark questions with "
                "concise, accurate answers about:\n" + topic
            )

            with st.spinner("Preparing revision questions..."):
                answer = run_agent(prompt)

            st.markdown(answer)

            record_activity(
                "Two-Mark Questions",
                f"Generated questions about: {topic.strip()[:100]}",
            )
        else:
            st.warning("Please enter a topic.")


# ==================================================
# FLASHCARDS
# ==================================================
elif selected_tool == "Flashcards":
    st.subheader("Create revision flashcards")

    topic = st.text_area(
        "Enter your topic",
        placeholder="For example: Computer network protocols...",
        key="flashcard_topic",
    )

    number = st.number_input(
        "Number of flashcards",
        min_value=1,
        max_value=20,
        value=5,
        key="flashcard_count",
    )

    if st.button("✦ Create Flashcards", key="flashcards"):
        if topic.strip():
            prompt = (
                f"Create {number} study flashcards about {topic}. "
                "Number each card and format it clearly as:\n"
                "Question: ...\nAnswer: ...\n"
                "Keep the answers concise and useful for revision."
            )

            with st.spinner("Creating your flashcards..."):
                answer = run_agent(prompt)

            st.markdown(answer)

            record_activity(
                "Flashcards",
                f"Created flashcards about: {topic.strip()[:100]}",
            )
        else:
            st.warning("Please enter a topic.")


# ==================================================
# FOOTER
# ==================================================
st.markdown(
    """
    <div class="footer">
        StudyMate AI · Your personal AI-powered study space
        <br>
        Built with Python, Streamlit and Ollama
    </div>
    """,
    unsafe_allow_html=True,
)
