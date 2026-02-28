# Load OPENAI API KEYS
import os
from langchain.chat_models import init_chat_model
from langgraph.graph import StateGraph, START, END
from typing import Literal
from dotenv import load_dotenv
from tools import get_rag_tool
from utils import build_vector_store
from tools import *
from state import ExtendedState
from langgraph.checkpoint.memory import MemorySaver
from nodes import make_llm_call, make_tool_node, make_extract_bugs, make_generate_challenge, wait_for_user, make_grade_solution
try:
    from IPython.display import Image, display
    _HAS_IPYTHON = True
except ImportError:
    _HAS_IPYTHON = False


class Agent:
    def __init__(self, path):
        # Loading API keys — find .env relative to this file's directory
        env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '.env')
        load_dotenv(env_path)

        print("Build vector store")
        build_vector_store(path)
        tool = get_rag_tool()

        tools = [get_rag_tool(), create_punishment_tool()]

        model = init_chat_model(
            "openai:o4-mini",
        )
        model_with_tools = model.bind_tools(tools)

        llm_call = make_llm_call(model_with_tools)
        tool_node = make_tool_node(tools)
        extract_bugs = make_extract_bugs(model)
        generate_challenge = make_generate_challenge(model)
        grade_solution = make_grade_solution(model)

        print("Initialize agent")
        agent_builder = StateGraph(ExtendedState)

        agent_builder.add_node("llm_call", llm_call)
        agent_builder.add_node("tool_node", tool_node)
        agent_builder.add_node("extract_bugs", extract_bugs)
        agent_builder.add_node("generate_challenge", generate_challenge)
        agent_builder.add_node("wait_for_user", wait_for_user)
        agent_builder.add_node("grade_solution", grade_solution)

        agent_builder.add_edge(START, "llm_call")
        agent_builder.add_conditional_edges(
            "llm_call",
            self.should_continue,
            ["tool_node", "extract_bugs"]
        )
        agent_builder.add_edge("tool_node", "llm_call")
        agent_builder.add_edge("extract_bugs", "generate_challenge")
        agent_builder.add_edge("generate_challenge", "wait_for_user")
        agent_builder.add_edge("wait_for_user", "grade_solution")
        agent_builder.add_edge("grade_solution", END)

        print("Compiling agent")
        self.agent = agent_builder.compile(checkpointer=MemorySaver())
        self.config = {"configurable": {"thread_id": "1"}}

    @staticmethod
    def should_continue(state: ExtendedState) -> Literal["tool_node", "extract_bugs"]:
        """Decide if we should continue the loop or stop based upon whether the LLM made a tool call"""
        messages = state["messages"]
        last_message = messages[-1]
        if last_message.tool_calls:
            return "tool_node"
        return "extract_bugs"

    def run(self, prompt: str = "Use a tool to look through the files and find the bug."):
        import json
        from langchain.messages import HumanMessage

        print("Display the agent flow")
        if _HAS_IPYTHON:
            try:
                display(Image(self.agent.get_graph(xray=True).draw_mermaid_png()))
            except Exception:
                pass  # skip graph display when not in a notebook
        print(self.agent.get_graph().draw_ascii())

        # Run until the interrupt in wait_for_user
        result = self.agent.invoke(
            {"messages": [HumanMessage(content=prompt)]},
            config=self.config
        )

        for m in result["messages"]:
            m.pretty_print()

        challenge = result.get("challenge")
        if challenge:
            print("\n=== Coding Challenge ===")
            print(json.dumps(challenge.model_dump(), indent=2))

        return result

    # Callable method designed for FastAPI server to resume flow at 
    def resume(self, user_solution: str):
        from langgraph.types import Command

        result = self.agent.invoke(
            Command(resume=user_solution),
            config=self.config
        )

        print("\n=== Grade ===")
        print(result.get("grade", "No grade returned."))

        return result

    

if __name__ == "__main__":
    agent = Agent("../../buggy_code")
    agent.run()
    user_solution = input("\nYour solution:\n")
    agent.resume(user_solution)
