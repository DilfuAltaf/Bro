from ...config import settings
from ..state import AgentState
from langchain_google_genai import ChatGoogleGenerativeAI

def assignment_node(state: AgentState) -> dict:
    messages = state.get("messages", [])
    if not messages:
        return {"messages": [{"role": "assistant", "content": "Halo! Tugas apa yang perlu kita selesaikan hari ini?"}], "current_skill": "assignment"}
    
    if not settings.GEMINI_API_KEY:
        return {"messages": messages + [{"role": "assistant", "content": "Maaf, kunci API belum dikonfigurasi. Fitur penyelesaian tugas belum tersedia."}], "current_skill": "assignment"}
    
    last_message = messages[-1].get("content", "")
    try:
        from ..utils import build_prompt
        llm = ChatGoogleGenerativeAI(model=settings.GEMINI_MODEL, api_key=settings.GEMINI_API_KEY)
        system_prompt = "Anda adalah asisten AI (BroAgent). Karakter response: natural, membantu, tidak terlalu formal, jelas, tidak terlalu panjang, gunakan bahasa yang mengikuti bahasa user, jangan selalu memakai format bullet jika tidak diperlukan.\n\nUntuk assignment: Jangan langsung mengerjakan seluruh tugas user.\nBantu user:\n- memahami soal\n- menemukan struktur jawaban\n- menjelaskan konsep\n- memberikan contoh\n- membantu menyusun langkah\nTujuannya agar user tetap memahami dan mengerjakan tugasnya."
        prompt = build_prompt(messages, system_prompt)
        response = llm.invoke(prompt)
        return {"messages": messages + [{"role": "assistant", "content": response.content}], "current_skill": "assignment"}
    except Exception as e:
        print(f"Error in assignment_node: {e}")
        return {"messages": messages + [{"role": "assistant", "content": "Maaf, layanan pengerjaan tugas sedang mengalami gangguan."}], "current_skill": "assignment"}
