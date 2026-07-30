import os
# pyrefly: ignore [missing-import]
import httpx
import logging

logger = logging.getLogger("skilleraa.emergentintegrations")

class UserMessage:
    def __init__(self, text: str):
        self.text = text

class LlmChat:
    def __init__(self, api_key: str, session_id: str, system_message: str):
        self.api_key = api_key
        self.session_id = session_id
        self.system_message = system_message
        self.provider = "anthropic"
        self.model = "claude-sonnet-4-6"

    def with_model(self, provider: str, name: str):
        self.provider = provider
        self.model = name
        return self

    async def send_message(self, message: UserMessage) -> str:
        # If the key is an Anthropic key, call Anthropic API directly
        if self.api_key.startswith("sk-ant-"):
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": self.api_key,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json"
                    },
                    json={
                        "model": "claude-3-5-sonnet-20241022",
                        "max_tokens": 4096,
                        "system": self.system_message,
                        "messages": [
                            {"role": "user", "content": message.text}
                        ]
                    },
                    timeout=60.0
                )
                resp.raise_for_status()
                data = resp.json()
                return data["content"][0]["text"]
        else:
            # Fallback/default: call the Emergent Integrations LLM endpoint if it follows standard schemas
            async with httpx.AsyncClient() as client:
                try:
                    resp = await client.post(
                        "https://integrations.emergentagent.com/llm/api/v1/chat",
                        headers={
                            "Authorization": f"Bearer {self.api_key}",
                            "Content-Type": "application/json"
                        },
                        json={
                            "session_id": self.session_id,
                            "system_message": self.system_message,
                            "provider": self.provider,
                            "model": self.model,
                            "message": message.text
                        },
                        timeout=60.0
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        if isinstance(data, dict):
                            if "response" in data:
                                return data["response"]
                            elif "text" in data:
                                return data["text"]
                            elif "choices" in data:
                                return data["choices"][0]["message"]["content"]
                        return str(data)
                    else:
                        resp.raise_for_status()
                except Exception as e:
                    logger.error(f"Mock LLM chat failed: {e}")
                    raise
