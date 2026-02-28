from langgraph.graph.message import add_messages
from typing import TypeDict, Annotated

class AgentState(TypeDict):
    messages: Annotated[list, add_messages]
