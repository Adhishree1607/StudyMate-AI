
import asyncio
import logging
from typing import Optional

import fitz
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from langchain_ollama import ChatOllama

# --------------------------------------------------
# Configuration
# --------------------------------------------------

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("studymate")

MODEL_NAME = "qwen2.5:3b"
MAX_PDF_SIZE = 15 * 1024 * 1024
MAX_CONTEXT_CHARS = 12000

app = FastAPI(title="StudyMate AI Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Give Ollama more time to respond.
# num_predict limits generated tokens to avoid unnecessarily long answers.
llm = ChatOllama(
    model=MODEL_NAME,
    temperature=0.2,
    num_predict=512,
    client_kwargs={"timeout": 300},
)


# --------------------------------------------------
# Request models
# --------------------------------------------------

class AskRequest(BaseModel):
    question: str = Field(default="", max_length=10000)
    text: str = Field(default="", max_length=40000)
    context: str = Field(default="", max_length=40000)


class GenerateRequest(BaseModel):
    mode: str = "ask"
    question: str = ""
    prompt: str = ""
    text: str = ""
    content: str = ""
    topic: str = ""
    subject: str = ""
    count: Optional[int] = 5


class PDFChatRequest(BaseModel):
    question: str = Field(default="", max_length=10000)
    text: str = Field(default="", max_length=40000)
    content: str = Field(default="", max_length=40000)
    document_text: str = Field(default="", max_length=40000)


# --------------------------------------------------
# AI helper
# --------------------------------------------------

async def generate_answer(prompt: str) -> str:
    """Run Ollama without blocking FastAPI's event loop."""
    try:
        result = await asyncio.wait_for(
            asyncio.to_thread(llm.invoke, prompt),
            timeout=300,
        )
        answer = str(result.content).strip()

        if not answer:
            raise HTTPException(
                status_code=502,
                detail="The AI model returned an empty answer. Please try again.",
            )

        return answer

    except asyncio.TimeoutError:
        logger.exception("AI generation timed out")
        raise HTTPException(
            status_code=504,
            detail=(
                "AI generation took longer than five minutes. "
                "Try a shorter prompt or a smaller amount of PDF text."
            ),
        )

    except HTTPException:
        raise

    except Exception as exc:
        logger.exception("Ollama generation failed")
        raise HTTPException(
            status_code=502,
            detail=(
                "Could not generate an AI response. "
                "Check that Ollama is running and qwen2.5:3b is installed. "
                f"Details: {str(exc)[:300]}"
            ),
        )


def get_source_text(*values: str) -> str:
    """Return the first non-empty text supplied by the frontend."""
    for value in values:
        if value and value.strip():
            return value.strip()
    return ""


# --------------------------------------------------
# Health checks
# --------------------------------------------------

@app.get("/")
async def root():
    return {
        "status": "ok",
        "service": "StudyMate AI",
        "model": MODEL_NAME,
    }


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "model": MODEL_NAME,
    }


@app.get("/api/docs-info")
async def docs_info():
    return {
        "service": "StudyMate AI",
        "model": MODEL_NAME,
        "pdf_upload_limit_mb": 15,
        "max_context_characters": 40000,
    }


# --------------------------------------------------
# Ask AI
# --------------------------------------------------

@app.post("/api/ask")
async def ask_ai(request: AskRequest):
    question = request.question.strip()

    if not question:
        raise HTTPException(status_code=400, detail="Please enter a question.")

    context = get_source_text(request.context, request.text)

    prompt = f"""
You are StudyMate AI, a friendly and accurate study assistant.

Answer the student's question clearly and accurately.
Use simple language, headings, and examples when helpful.
Do not invent facts. If you are uncertain, say so.

{"Relevant study context:" + chr(10) + context[:MAX_CONTEXT_CHARS] if context else ""}

Student's question:
{question}

Give a useful answer suitable for a student.
"""

    answer = await generate_answer(prompt)

    return {
        "answer": answer,
        "response": answer,
        "text": answer,
    }


# --------------------------------------------------
# Generate summaries, notes, MCQs, two-mark answers,
# and flashcards
# --------------------------------------------------

@app.post("/api/generate")
async def generate_content(request: GenerateRequest):
    mode = request.mode.strip().lower().replace("-", "_").replace(" ", "_")

    source = get_source_text(
        request.text,
        request.content,
        request.prompt,
    )

    topic = request.topic.strip() or request.subject.strip()

    if not source and not topic and not request.question.strip():
        raise HTTPException(
            status_code=400,
            detail="Please provide text, a topic, or a question.",
        )

    source = source[:MAX_CONTEXT_CHARS]
    count = max(1, min(request.count or 5, 20))

    if mode in {"summary", "summarize"}:
        instruction = """
Create a clear, well-organized study summary of the supplied material.
Include the main concepts, important definitions, key facts, and conclusions.
Use headings and bullet points. Preserve the source's meaning.
Do not introduce unsupported facts.
"""

    elif mode in {"notes", "note", "study_notes"}:
        instruction = """
Convert the supplied material into structured study notes.
Use headings, subheadings, concise bullet points, definitions, and examples
when supported by the source. Highlight important exam points.
Do not invent details that are absent from the material.
"""

    elif mode in {"mcq", "mcqs", "quiz", "multiple_choice"}:
        instruction = f"""
Create {count} multiple-choice questions using the supplied material.
For every question, provide four options labelled A, B, C, and D.
Clearly indicate the correct answer and give a brief explanation.
Use this format:

Q1. Question
A. Option
B. Option
C. Option
D. Option
Answer: B
Explanation: Brief explanation

Use only facts supported by the supplied material.
"""

    elif mode in {
        "two_mark",
        "two_marks",
        "2_mark",
        "2_marks",
        "short_answers",
    }:
        instruction = f"""
Create {count} exam-style two-mark questions and concise answers.
Number every question. Keep each answer brief, clear, and suitable for
writing in an examination. Base questions and answers on the supplied
material. Do not add unsupported facts.
"""

    elif mode in {"flashcards", "flashcard", "cards"}:
        instruction = f"""
Create {count} useful study flashcards based on the supplied material.
Use this exact format for each card:

Q: A clear question
A: A concise answer

Repeat for every card. Put each Q: and A: on separate lines.
Keep answers short enough for revision. Use only supported information.
"""

    elif mode in {"ask", "question", "explain"}:
        question = request.question.strip() or topic
        instruction = f"""
Answer the student's question clearly and accurately.
Use simple language and an example when helpful.
Student's question: {question}
"""

    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported generation mode: {mode}",
        )

    prompt = f"""
You are StudyMate AI, an educational assistant.

{instruction}

Topic: {topic or "Use the supplied material"}

Supplied material:
{source or "No source text supplied. Answer only from the topic or question."}
"""

    answer = await generate_answer(prompt)

    return {
        "answer": answer,
        "response": answer,
        "text": answer,
        "content": answer,
        "summary": answer if mode in {"summary", "summarize"} else None,
        "mode": mode,
    }


# --------------------------------------------------
# PDF upload and text extraction
# --------------------------------------------------

@app.post("/api/pdf/extract")
async def extract_pdf(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Please upload a PDF file.",
        )

    try:
        pdf_bytes = await file.read()

        if not pdf_bytes:
            raise HTTPException(status_code=400, detail="The PDF is empty.")

        if len(pdf_bytes) > MAX_PDF_SIZE:
            raise HTTPException(
                status_code=413,
                detail="The PDF exceeds the 15 MB upload limit.",
            )

        def read_pdf():
            with fitz.open(stream=pdf_bytes, filetype="pdf") as document:
                page_count = len(document)
                extracted = "\n\n".join(
                    page.get_text("text") for page in document
                )
                return page_count, extracted

        page_count, extracted_text = await asyncio.to_thread(read_pdf)

        if not extracted_text.strip():
            raise HTTPException(
                status_code=422,
                detail=(
                    "No selectable text was found. "
                    "This may be a scanned PDF; OCR is not enabled."
                ),
            )

        extracted_text = extracted_text[:40000]

        return {
            "text": extracted_text,
            "content": extracted_text,
            "document_text": extracted_text,
            "pages": page_count,
            "page_count": page_count,
            "characters": len(extracted_text),
            "filename": file.filename,
            "message": "PDF text extracted successfully.",
        }

    except HTTPException:
        raise

    except Exception as exc:
        logger.exception("PDF extraction failed")
        raise HTTPException(
            status_code=422,
            detail=f"Could not read this PDF: {str(exc)[:300]}",
        )

    finally:
        await file.close()


# --------------------------------------------------
# Chat with an extracted PDF
# --------------------------------------------------

@app.post("/api/pdf/chat")
async def chat_with_pdf(request: PDFChatRequest):
    question = request.question.strip()

    document_text = get_source_text(
        request.text,
        request.document_text,
        request.content,
    )

    if not document_text:
        raise HTTPException(
            status_code=400,
            detail="Upload a PDF and extract its text first.",
        )

    if not question:
        raise HTTPException(
            status_code=400,
            detail="Please enter a question about the PDF.",
        )

    prompt = f"""
You are StudyMate AI. Answer the student's question using the PDF text below.

Instructions:
- Prioritize the supplied PDF as the source of truth.
- Explain concepts in clear, student-friendly language.
- If the answer is not present in the PDF, say that the PDF does not
  provide enough information.
- Do not pretend to have read content that was not supplied.

PDF text:
{document_text[:MAX_CONTEXT_CHARS]}

Student's question:
{question}

Answer:
"""

    answer = await generate_answer(prompt)

    return {
        "answer": answer,
        "response": answer,
        "text": answer,
    }
