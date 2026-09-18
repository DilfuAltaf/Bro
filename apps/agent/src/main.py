from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from .agent.graph import agent_graph

app = FastAPI(title="BroAgent AI Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:4000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    conversationId: str
    history: Optional[list[ChatMessage]] = []

class ChatResponse(BaseModel):
    response: str
    intent: str

@app.post("/agent/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        # Build messages list from history
        messages = []
        if request.history:
            for msg in request.history:
                messages.append({"role": msg.role, "content": msg.content})
        
        # Append current message
        messages.append({"role": "user", "content": request.message})

        result = await agent_graph.ainvoke({
            "messages": messages,
            "current_skill": "general",
            "safety_flag": False,
        })

        final_message = ""
        if result.get("messages"):
            final_message = result["messages"][-1].get("content", "")
        
        if not final_message:
            final_message = "Maaf, saya tidak dapat merespons saat ini."

        return ChatResponse(
            response=final_message,
            intent=result.get("current_skill", "general"),
        )
    except Exception as e:
        print(f"Agent error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health():
    return {"status": "ok"}
