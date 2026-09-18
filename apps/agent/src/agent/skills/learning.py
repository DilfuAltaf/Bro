from ...config import settings
from ..state import AgentState
from langchain_google_genai import ChatGoogleGenerativeAI

def learning_node(state: AgentState) -> dict:
    messages = state.get("messages", [])
    if not messages:
        return {"messages": [{"role": "assistant", "content": "Halo! Topik apa yang ingin Anda pelajari hari ini?"}], "current_skill": "learning"}
    
    if not settings.GEMINI_API_KEY:
        return {"messages": messages + [{"role": "assistant", "content": "Maaf, kunci API belum dikonfigurasi. Fitur pembelajaran belum tersedia."}], "current_skill": "learning"}
    
    last_message = messages[-1].get("content", "")
    try:
        from ..utils import build_prompt
        llm = ChatGoogleGenerativeAI(model=settings.GEMINI_MODEL, api_key=settings.GEMINI_API_KEY)
        system_prompt = "Anda adalah asisten AI (BroAgent). Karakter response: natural, membantu, tidak terlalu formal, jelas, tidak terlalu panjang, gunakan bahasa yang mengikuti bahasa user, jangan selalu memakai format bullet jika tidak diperlukan.\n\nUntuk learning: Jelaskan secara bertahap. Jika konsep sulit, gunakan contoh sederhana."
        prompt = build_prompt(messages, system_prompt)
        response = llm.invoke(prompt)
        return {"messages": messages + [{"role": "assistant", "content": response.content}], "current_skill": "learning"}
    except Exception as e:
        print(f"Error in learning_node: {e}")
        return {"messages": messages + [{"role": "assistant", "content": "Maaf, layanan tutor pembelajaran sedang mengalami gangguan."}], "current_skill": "learning"}
