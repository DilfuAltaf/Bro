from typing import TypedDict, List, Dict, Any

class AgentState(TypedDict):
    messages: List[Dict[str, Any]]
    current_skill: str
    safety_flag: bool
