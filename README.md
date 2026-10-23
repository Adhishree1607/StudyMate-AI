# 📚 StudyMate AI

StudyMate AI is an AI-powered student productivity and exam preparation platform that combines study management tools with a locally running AI model.

## ✨ Features

- AI-powered academic question answering
- Study notes and summary generation
- Multiple-choice question (MCQ) generation
- Two-mark questions and answers
- Interactive study flashcards
- PDF upload and document chat
- Daily, weekly, and monthly task tracking
- Timetable management
- Exam reminders and countdowns
- Motivational quotes and vocabulary learning
- Local AI inference using Ollama

## 🛠️ Tech Stack

- **Frontend:** React.js, Vite
- **Backend:** Node.js, Express
- **AI Service:** Python, FastAPI
- **AI Model:** Ollama, Qwen 2.5 3B
- **AI Libraries:** LangChain, where used
- **PDF Processing:** PyMuPDF
- **Storage:** Existing local JSON-based storage, as configured

## 📋 Prerequisites

- Python installed
- Node.js and npm installed
- Ollama installed
- `qwen2.5:3b` model downloaded

## 🚀 Installation and Setup

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/StudyMate-AI.git
cd StudyMate-AI
```

Replace `YOUR_USERNAME` with your GitHub username.

### 2. Set up Python

From the project root:

```bash
python -m venv .venv
```

Activate the virtual environment in Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

Install the dependencies listed in `requirements.txt`:

```bash
pip install -r requirements.txt
```

### 3. Download the AI model

```bash
ollama pull qwen2.5:3b
```

Ensure Ollama is running before using AI features.

### 4. Start the Python AI service

From the project root:

```bash
python -m uvicorn python_service.main:app --reload --port 8000
```

### 5. Start the Node.js backend

Open a separate terminal:

```bash
cd backend
npm install
node server.js
```

### 6. Start the React frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

### 7. Open the application

Visit the local URL displayed by Vite, usually:

http://localhost:5173

Keep the required services running while using the application.

## 📁 Project Structure

```text
StudyMate-AI/
├── frontend/          # React + Vite application
├── backend/           # Node.js + Express API
├── python_service/    # FastAPI AI service
├── app.py             # Original Streamlit application
├── main.py            # Existing Python module
├── tools.py           # Existing Python tools
├── requirements.txt   # Python dependencies
├── .gitignore
└── README.md
```

The exact structure may vary depending on the existing project files.

## 🔒 Security and Privacy

- Never commit passwords, API keys, or private credentials.
- Keep virtual environments and dependency folders out of Git.
- Do not commit private student data or local application data.
- Review uploaded documents and configuration files before sharing the repository.

## 🐳 Docker

Docker support can be added to simplify local setup and service management. The application can currently be run using the installation steps above.

## 📌 Project Status

StudyMate AI is an ongoing development project. Features and setup instructions may evolve as development continues.

## 📄 License

No license has been selected yet. Choose an appropriate license before distributing the project as open source.