
from langchain_ollama import ChatOllama

MODEL_NAME = "qwen2.5:3b"


def get_llm(temperature: float = 0.2):
    """Create a connection to the local Ollama model."""
    return ChatOllama(
        model=MODEL_NAME,
        temperature=temperature,
    )


def run_agent(prompt: str, temperature: float = 0.2) -> str:
    """Send a prompt to the local AI model and return its response."""
    if not prompt or not prompt.strip():
        return "Please enter a question or study task."

    try:
        llm = get_llm(temperature)
        response = llm.invoke(prompt)
        return response.content

    except Exception as error:
        return (
            "Could not connect to the local AI model. "
            "Please check that Ollama is running and "
            f"the model '{MODEL_NAME}' is installed. "
            f"Details: {error}"
        )
