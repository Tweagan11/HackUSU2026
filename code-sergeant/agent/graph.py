# Load OPENAI API KEYS
from langchain.chat_models import init_chat_model
from langgraph.graph import StateGraph, START, END
from typing import Literal
from dotenv import load_dotenv
from tools import get_rag_tool
from utils import build_vector_store
from state import ExtendedState
from nodes import make_llm_call, make_tool_node, make_extract_bugs, make_generate_challenge
from IPython.display import Image, display


def should_continue(state: ExtendedState) -> Literal["tool_node", "extract_bugs"]:
    """Decide if we should continue the loop or stop based upon whether the LLM made a tool call"""

    messages = state["messages"]
    last_message = messages[-1]

    # If the LLM makes a tool call, then perform an action
    if last_message.tool_calls:
        return "tool_node"

    # Otherwise, extract structured bugs
    return "extract_bugs"


load_dotenv("../../")

print("Build vector store")
# For testing
build_vector_store("../../buggy_code")
tool = get_rag_tool()

model = init_chat_model(
    "openai:o4-mini",
)
model_with_tools = model.bind_tools([tool])

llm_call = make_llm_call(model_with_tools)
tool_node = make_tool_node([tool])
extract_bugs = make_extract_bugs(model)
generate_challenge = make_generate_challenge(model)

print("Initialize agent")
agent_builder = StateGraph(ExtendedState)

agent_builder.add_node("llm_call", llm_call)
agent_builder.add_node("tool_node", tool_node)
agent_builder.add_node("extract_bugs", extract_bugs)
agent_builder.add_node("generate_challenge", generate_challenge)

agent_builder.add_edge(START, "llm_call")
agent_builder.add_conditional_edges(
    "llm_call",
    should_continue,
    ["tool_node", "extract_bugs"]
)
agent_builder.add_edge("tool_node", "llm_call")
agent_builder.add_edge("extract_bugs", "generate_challenge")
agent_builder.add_edge("generate_challenge", END)

print("Compiling agent")
agent = agent_builder.compile()

print("Display the agent flow")
# Show the agent
display(Image(agent.get_graph(xray=True).draw_mermaid_png()))
print(agent.get_graph().draw_ascii())

import json
from langchain.messages import HumanMessage
result = agent.invoke({"messages": [HumanMessage(content="Use a tool to look through the files and find the bug.")]})

for m in result["messages"]:
    m.pretty_print()

challenge = result.get("challenge")
if challenge:
    print("\n=== Coding Challenge ===")
    print(json.dumps(challenge.model_dump(), indent=2))
else:
    print("No challenge generated.")
