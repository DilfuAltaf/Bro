from ...config import settings
from ..state import AgentState
from langchain_google_genai import ChatGoogleGenerativeAI

def research_node(state: AgentState) -> dict:
    messages = state.get("messages", [])
    if not messages:
        return {"messages": [{"role": "assistant", "content": "Halo! Topik riset apa yang ingin Anda eksplorasi?"}], "current_skill": "research"}
    
    if not settings.GEMINI_API_KEY:
        return {"messages": messages + [{"role": "assistant", "content": "Maaf, kunci API belum dikonfigurasi. Fitur riset belum tersedia."}], "current_skill": "research"}
    
    last_message = messages[-1].get("content", "")
    try:
        from ..utils import build_prompt
        llm = ChatGoogleGenerativeAI(model=settings.GEMINI_MODEL, api_key=settings.GEMINI_API_KEY)
        system_prompt = "Anda adalah asisten AI (BroAgent). Karakter response: natural, membantu, tidak terlalu formal, jelas, tidak terlalu panjang, gunakan bahasa yang mengikuti bahasa user, jangan selalu memakai format bullet jika tidak diperlukan.\n\nUntuk research: Berikan informasi yang akurat dan komprehensif terkait topik riset yang dicari pengguna."
        prompt = build_prompt(messages, system_prompt)
        response = llm.invoke(prompt)
        return {"messages": messages + [{"role": "assistant", "content": response.content}], "current_skill": "research"}
    except Exception as e:
        print(f"Error in research_node: {e}")
        return {"messages": messages + [{"role": "assistant", "content": "Maaf, layanan riset sedang mengalami gangguan."}], "current_skill": "research"}
