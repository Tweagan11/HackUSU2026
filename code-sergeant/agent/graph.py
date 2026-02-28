# Load OPENAI API KEYS
from langchain.chat_models import init_chat_model
from langgraph.graph import StateGraph, START, END
from typing import Literal
from dotenv import load_dotenv
from tools import get_rag_tool
from utils import build_vector_store
from state import MessagesState
from nodes import make_llm_call, make_tool_node
from IPython.display import Image, display


def should_continue(state: MessagesState) -> Literal["tool_node", END]:
    """Decide if we should continue the loop or stop based upon whether the LLM made a tool call"""

    messages = state["messages"]
    last_message = messages[-1]

    # If the LLM makes a tool call, then perform an action
    if last_message.tool_calls:
        return "tool_node"

    # Otherwise, we stop (reply to the user)
    return END


print("Build vector store")
# For testing
build_vector_store("../../buggy_code")

load_dotenv()
tool = get_rag_tool()

model = init_chat_model(
    "openai:o4-mini",
)
model_with_tools = model.bind_tools([tool])

llm_call = make_llm_call(model_with_tools)
tool_node = make_tool_node([tool])

print("Initialize agent")
agent_builder = StateGraph(MessagesState)

agent_builder.add_node("llm_call", llm_call)
agent_builder.add_node("tool_node", tool_node)

agent_builder.add_edge(START, "llm_call")
agent_builder.add_conditional_edges(
    "llm_call",
    should_continue,
    ["tool_node", END]
)
agent_builder.add_edge("tool_node", "llm_call")

print("Compiling agent")
agent = agent_builder.compile()

print("Display the agent flow")
# Show the agent
display(Image(agent.get_graph(xray=True).draw_mermaid_png()))
print(agent.get_graph().draw_ascii())

from langchain.messages import HumanMessage
messages = [HumanMessage(content="Use a tool to look through the files and find the bug.")]
messages = agent.invoke({"messages": messages})
for m in messages["messages"]:
    m.pretty_print()
print("Call model")### TEST MODEL CALL AND RESPONSE ###
