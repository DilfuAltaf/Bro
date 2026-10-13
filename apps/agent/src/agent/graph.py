from langgraph.graph import StateGraph, START, END
from langchain_google_genai import ChatGoogleGenerativeAI

from .state import AgentState
from .router import classify_intent
from .skills.general import general_node
from .skills.support import support_node
from .skills.research import research_node
from .skills.brainstorm import brainstorm_node
from .skills.learning import learning_node
from .skills.assignment import assignment_node
from ..safety.crisis_detector import check_safety
from ..config import settings

def route_skill(state: AgentState) -> str:
    skill = state.get("current_skill", "general")
    valid_nodes = ["general", "support", "research", "brainstorm", "learning", "assignment"]
    return skill if skill in valid_nodes else "general"

def route_safety(state: AgentState) -> str:
    if state.get("safety_flag", False):
        return END
    return "classify_intent"

workflow = StateGraph(AgentState)

workflow.add_node("classify_intent", classify_intent)
workflow.add_node("general", general_node)
workflow.add_node("support", support_node)
workflow.add_node("research", research_node)
workflow.add_node("brainstorm", brainstorm_node)
workflow.add_node("learning", learning_node)
workflow.add_node("assignment", assignment_node)
workflow.add_node("check_safety", check_safety)

workflow.add_edge(START, "check_safety")
workflow.add_conditional_edges("check_safety", route_safety)
workflow.add_conditional_edges("classify_intent", route_skill)

for node in ["general", "support", "research", "brainstorm", "learning", "assignment"]:
    workflow.add_edge(node, END)

agent_graph = workflow.compile()
