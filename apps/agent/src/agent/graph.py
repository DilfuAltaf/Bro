from langgraph.graph import StateGraph, START, END
from langchain_google_genai import ChatGoogleGenerativeAI

from .state import AgentState
from .router import classify_intent
from .skills.support import support_node
from .skills.research import research_node
from .skills.brainstorm import brainstorm_node
from .skills.learning import learning_node
from .skills.assignment import assignment_node
from ..safety.crisis_detector import check_safety
from ..config import settings

def general_node(state: AgentState) -> dict:
    messages = state.get("messages", [])
    if not messages:
        return {"messages": [{"role": "assistant", "content": "Halo! Ada yang bisa saya bantu?"}], "current_skill": "general"}
    
    last_message = messages[-1].get("content", "")
    if not settings.GEMINI_API_KEY:
        return {"messages": messages + [{"role": "assistant", "content": "Maaf, kunci API belum dikonfigurasi."}], "current_skill": "general"}
    
    try:
        from .utils import build_prompt
        llm = ChatGoogleGenerativeAI(model=settings.GEMINI_MODEL, api_key=settings.GEMINI_API_KEY)
        system_prompt = "Anda adalah asisten AI yang ramah dan membantu (BroAgent). Karakter response: natural, membantu, tidak terlalu formal, jelas, tidak terlalu panjang, gunakan bahasa yang mengikuti bahasa user, jangan selalu memakai format bullet jika tidak diperlukan."
        prompt = build_prompt(messages, system_prompt)
        response = llm.invoke(prompt)
        return {"messages": messages + [{"role": "assistant", "content": response.content}], "current_skill": "general"}
    except Exception as e:
        print(f"Error in general_node: {e}")
        return {"messages": messages + [{"role": "assistant", "content": "Maaf, layanan sedang mengalami gangguan."}], "current_skill": "general"}

def route_skill(state: AgentState) -> str:
    skill = state.get("current_skill", "general")
    valid_nodes = ["general", "support", "research", "brainstorm", "learning", "assignment"]
    return skill if skill in valid_nodes else "general"

def route_safety(state: AgentState) -> str:
    if state.get("safety_flag", False):
        return END
    return END

workflow = StateGraph(AgentState)

workflow.add_node("classify_intent", classify_intent)
workflow.add_node("general", general_node)
workflow.add_node("support", support_node)
workflow.add_node("research", research_node)
workflow.add_node("brainstorm", brainstorm_node)
workflow.add_node("learning", learning_node)
workflow.add_node("assignment", assignment_node)
workflow.add_node("check_safety", check_safety)

workflow.add_edge(START, "classify_intent")
workflow.add_conditional_edges("classify_intent", route_skill)

for node in ["general", "support", "research", "brainstorm", "learning", "assignment"]:
    workflow.add_edge(node, "check_safety")

workflow.add_conditional_edges("check_safety", route_safety)

agent_graph = workflow.compile()
