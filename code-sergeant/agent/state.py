from langgraph.graph.message import add_messages 
from typing import TypedDict, Annotated

from langchain_chroma import Chroma
import operator
from langchain_core.messages import AnyMessage


class MessagesState(TypedDict):
    messages: Annotated[list[AnyMessage], operator.add]
    llm_calls: int

class ExtendedState(MessagesState):
    bugs_found: list
    challenge: dict
    user_solution: str
    grade: str
