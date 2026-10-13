from ...config import settings
from ..state import AgentState
from langchain_google_genai import ChatGoogleGenerativeAI

def support_node(state: AgentState) -> dict:
    messages = state.get("messages", [])
    if not messages:
        return {"messages": [{"role": "assistant", "content": "Halo! Ada yang bisa saya bantu hari ini?"}], "current_skill": "support"}
    
    if not settings.GEMINI_API_KEY:
        return {"messages": messages + [{"role": "assistant", "content": "Maaf, kunci API belum dikonfigurasi. Dukungan belum tersedia."}], "current_skill": "support"}
    
    last_message = messages[-1].get("content", "")
    try:
        from ..utils import build_prompt
        llm = ChatGoogleGenerativeAI(model=settings.GEMINI_MODEL, api_key=settings.GEMINI_API_KEY)
        system_prompt = "Anda adalah asisten AI (BroAgent). Karakter response: natural, membantu, tidak terlalu formal, jelas, tidak terlalu panjang, gunakan bahasa yang mengikuti bahasa user, jangan selalu memakai format bullet jika tidak diperlukan.\n\nUntuk support: Berikan respons yang empatik dan tidak menghakimi. Jika situasinya serius, arahkan user untuk mencari bantuan dari orang dewasa tepercaya atau dukungan profesional."
        prompt = build_prompt(messages, system_prompt, state.get('memories', []))
        response = llm.invoke(prompt)
        return {"messages": messages + [{"role": "assistant", "content": response.content}], "current_skill": "support"}
    except Exception as e:
        print(f"Error in support_node: {e}")
        return {"messages": messages + [{"role": "assistant", "content": "Maaf, layanan dukungan sedang mengalami gangguan."}], "current_skill": "support"}
