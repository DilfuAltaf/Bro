from langchain_google_genai import ChatGoogleGenerativeAI
from ..config import settings
from .state import AgentState

def classify_intent(state: AgentState) -> dict:
    messages = state.get("messages", [])
    if not messages:
        return {"current_skill": "general"}
    
    last_message = messages[-1].get("content", "")
    if not settings.GEMINI_API_KEY:
        return {"current_skill": "general"}
    
    try:
        from .utils import build_prompt
        llm = ChatGoogleGenerativeAI(model=settings.GEMINI_MODEL, api_key=settings.GEMINI_API_KEY)
        system_prompt = "Klasifikasikan niat pengguna ke dalam salah satu dari kategori berikut secara ketat: general, support, research, brainstorm, learning, assignment. Hanya jawab dengan SATU kata (nama kategori)."
        prompt = build_prompt(messages, system_prompt, state.get('memories', []))
        response = llm.invoke(prompt)
        intent = response.content.strip().lower()
        
        valid_intents = ["general", "support", "research", "brainstorm", "learning", "assignment"]
        if intent not in valid_intents:
            intent = "general"
            
        return {"current_skill": intent}
    except Exception as e:
        print(f"Error classifying intent: {e}")
        return {"current_skill": "general"}
