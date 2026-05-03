"""Claude Sonnet 4.5 wrapper using Emergent Universal Key."""
import os
import json
import re
from typing import AsyncGenerator, Optional
from emergentintegrations.llm.chat import LlmChat, UserMessage

EMERGENT_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
MODEL = "claude-sonnet-4-5-20250929"


async def chat_complete(
    user_prompt: str,
    system_prompt: str = "You are a senior IT auditor.",
    session_id: str = "audit-session",
    temperature: float = 0.2,
) -> str:
    """Single-turn completion using Claude Sonnet 4.5."""
    chat = LlmChat(
        api_key=EMERGENT_KEY,
        session_id=session_id,
        system_message=system_prompt,
    ).with_model("anthropic", MODEL)
    msg = UserMessage(text=user_prompt)
    return await chat.send_message(msg)


def extract_json(text: str) -> dict | list:
    """Extract first JSON object/array from LLM text robustly."""
    if not text:
        return {}
    text = text.strip()
    # Try direct parse
    try:
        return json.loads(text)
    except Exception:
        pass
    # Strip ```json fences
    m = re.search(r"```(?:json)?\s*(.+?)\s*```", text, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            pass
    # Find first { or [
    for opener, closer in [('{', '}'), ('[', ']')]:
        i = text.find(opener)
        if i >= 0:
            depth = 0
            for j in range(i, len(text)):
                if text[j] == opener:
                    depth += 1
                elif text[j] == closer:
                    depth -= 1
                    if depth == 0:
                        try:
                            return json.loads(text[i:j+1])
                        except Exception:
                            break
    return {}


async def chat_complete_json(user_prompt: str, system_prompt: str = "", session_id: str = "json-session") -> dict | list:
    """Force JSON output."""
    sys = (system_prompt or "You are a senior IT auditor.") + "\n\nReturn ONLY valid JSON. No preamble. No markdown fences."
    raw = await chat_complete(user_prompt, sys, session_id)
    return extract_json(raw)


async def chat_stream_simulated(user_prompt: str, system_prompt: str, session_id: str) -> AsyncGenerator[str, None]:
    """Pseudo-stream: chunk full response into words for SSE delivery."""
    full = await chat_complete(user_prompt, system_prompt, session_id, temperature=0.3)
    # Yield in word chunks for streaming feel
    tokens = re.findall(r"\S+\s*", full)
    for t in tokens:
        yield t
