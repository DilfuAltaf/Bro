from ..agent.state import AgentState

def check_safety(state: AgentState) -> dict:
    messages = state.get("messages", [])
    if not messages:
        return {"safety_flag": False}
    
    last_message = messages[-1].get("content", "").lower()
    
    # Simple crisis detection
    crisis_keywords = [
        "bunuh diri", "mengakhiri hidup", "depresi berat", 
        "menyakiti diri", "tidak ingin hidup", "mati saja"
    ]
    
    for word in crisis_keywords:
        if word in last_message:
            return {
                "safety_flag": True,
                "messages": messages + [{
                    "role": "assistant", 
                    "content": "Saya melihat Anda sedang mengalami masa yang sangat sulit. Keselamatan Anda sangat berharga. Jika Anda sedang mengalami krisis, mohon segera cari bantuan profesional atau hubungi layanan darurat (seperti 119 di Indonesia) atau orang terdekat yang Anda percayai."
                }]
            }
            
    return {"safety_flag": False}
