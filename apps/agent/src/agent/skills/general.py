from ...config import settings
from ..state import AgentState
from langchain_google_genai import ChatGoogleGenerativeAI


def general_node(state: AgentState) -> dict:
    messages = state.get("messages", [])
    if not messages:
        return {"messages": [{"role": "assistant", "content": "Halo! Ada yang bisa saya bantu?"}], "current_skill": "general"}
    
    if not settings.GEMINI_API_KEY:
        return {"messages": messages + [{"role": "assistant", "content": "Maaf, kunci API belum dikonfigurasi."}], "current_skill": "general"}
    
    try:
        from ..utils import build_prompt
        llm = ChatGoogleGenerativeAI(model=settings.GEMINI_MODEL, api_key=settings.GEMINI_API_KEY)
        system_prompt = "Anda adalah asisten AI yang ramah dan membantu (BroAgent). Karakter response: natural, membantu, tidak terlalu formal, jelas, tidak terlalu panjang, gunakan bahasa yang mengikuti bahasa user, jangan selalu memakai format bullet jika tidak diperlukan."
        prompt = build_prompt(messages, system_prompt, state.get('memories', []))
        response = llm.invoke(prompt)
        return {"messages": messages + [{"role": "assistant", "content": response.content}], "current_skill": "general"}
    except Exception as e:
        print(f"Error in general_node: {e}")
        return {"messages": messages + [{"role": "assistant", "content": "Maaf, layanan sedang mengalami gangguan."}], "current_skill": "general"}
