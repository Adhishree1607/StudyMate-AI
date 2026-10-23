
import fitz
import re


def extract_text_from_pdf(pdf_file) -> str:
    """Extract readable text from an uploaded PDF file."""
    try:
        pdf_bytes = pdf_file.getvalue()

        with fitz.open(stream=pdf_bytes, filetype="pdf") as document:
            pages = []

            for page_number, page in enumerate(document, start=1):
                text = page.get_text("text")

                if text.strip():
                    pages.append(f"Page {page_number}:\n{text}")

            if not pages:
                return (
                    "No readable text was found in this PDF. "
                    "It may contain scanned images."
                )

            return "\n\n".join(pages)

    except Exception as error:
        return f"Could not read the PDF: {error}"


def split_text_into_chunks(
    text: str,
    chunk_size: int = 2500,
    overlap: int = 300,
) -> list[str]:
    """Split text into overlapping chunks for document retrieval."""
    if not text or not text.strip():
        return []

    if chunk_size <= 0 or overlap < 0 or overlap >= chunk_size:
        raise ValueError(
            "chunk_size must be positive and overlap must be "
            "between zero and chunk_size."
        )

    chunks = []
    start = 0

    while start < len(text):
        end = min(start + chunk_size, len(text))

        # Prefer ending at a word boundary when possible.
        if end < len(text):
            boundary = text.rfind(" ", start, end)
            if boundary > start:
                end = boundary

        chunk = text[start:end].strip()

        if chunk:
            chunks.append(chunk)

        if end >= len(text):
            break

        start = max(end - overlap, start + 1)

    return chunks




def find_relevant_chunks(
    question: str,
    chunks: list[str],
    max_chunks: int = 4,
) -> list[str]:
    """Find PDF chunks that share the most meaningful words with a question."""
    stop_words = {
        "the", "is", "are", "was", "were", "a", "an", "and",
        "or", "of", "to", "in", "on", "for", "with", "by",
        "what", "why", "how", "when", "where", "who", "which",
        "explain", "tell", "me", "about", "this", "that", "it",
        "from", "does", "do", "can", "could", "please", "give",
    }

    def words(text: str) -> set[str]:
        return {
            word
            for word in re.findall(r"\b[a-zA-Z0-9]+\b", text.lower())
            if word not in stop_words and len(word) > 1
        }

    question_words = words(question)

    if not question_words:
        return chunks[:max_chunks]

    scored_chunks = []

    for index, chunk in enumerate(chunks):
        chunk_words = words(chunk)
        score = len(question_words & chunk_words)

        if score > 0:
            scored_chunks.append((score, index, chunk))

    scored_chunks.sort(key=lambda item: (-item[0], item[1]))

    return [
        chunk
        for _, _, chunk in scored_chunks[:max_chunks]
    ]

