from fastapi import FastAPI
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

class MemoryItem(BaseModel):
    id: str
    content: str
    type: str

class ChatRequest(BaseModel):
    message: str
    conversationId: str
    history: Optional[list[ChatMessage]] = []
    memories: Optional[list[MemoryItem]] = []

class ChatResponse(BaseModel):
    response: str
    intent: str
    sources: Optional[list[dict]] = None

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

        # Convert memories
        memories = [{"id": m.id, "content": m.content, "type": m.type} for m in request.memories] if request.memories else []

        result = await agent_graph.ainvoke({
            "messages": messages,
            "current_skill": "general",
            "safety_flag": False,
            "memories": memories,
        })

        # Extract final message — handle both dict and LangChain message objects
        final_message = ""
        if result.get("messages"):
            last_msg = result["messages"][-1]
            if isinstance(last_msg, dict):
                final_message = last_msg.get("content", "")
            elif hasattr(last_msg, "content"):
                # LangChain BaseMessage object
                final_message = last_msg.content
        
        if not final_message:
            final_message = "Maaf, saya tidak dapat merespons saat ini."

        return ChatResponse(
            response=final_message,
            intent=result.get("current_skill", "general"),
            sources=result.get("sources", None)
        )
    except Exception as e:
        # Log error but don't expose internals to client
        print(f"Agent error: {e}")
        return ChatResponse(
            response="Maaf, aku sedang mengalami masalah. Coba lagi beberapa saat.",
            intent="general",
        )

class SearchRequest(BaseModel):
    query: str

@app.post("/agent/search")
def search(request: SearchRequest):
    try:
        from .agent.tools.search import ResearchTool
        tool = ResearchTool()
        results = tool.search(request.query)
        return {"results": results}
    except Exception as e:
        print(f"Search adapter error: {e}")
        return {"results": []}

@app.get("/health")
def health():
    return {"status": "ok"}

