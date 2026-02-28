# Load OPENAI API KEYS
import os
os.environ["LANGCHAIN_TRACING_V2"] = "false"
os.environ["LANGCHAIN_ENDPOINT"] = ""
os.environ["LANGCHAIN_API_KEY"] = ""
os.environ["LANGCHAIN_PROJECT"] = ""
os.environ["LANGCHAIN_TELEMETRY"] = "false"
from langchain.chat_models import init_chat_model
from langchain_core.messages import HumanMessage
from langgraph.graph import StateGraph, START, END
from typing import Literal
from dotenv import load_dotenv
from tools import get_rag_tool
from utils import build_vector_store
from tools import *
from state import ExtendedState
from langgraph.checkpoint.memory import MemorySaver
from nodes import make_llm_call, make_tool_node, make_extract_bugs, make_generate_challenge, wait_for_user, make_grade_solution
# try:
#     from IPython.display import Image, display
#     _HAS_IPYTHON = True
# except ImportError:
#     _HAS_IPYTHON = False


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

    async def run(self, prompt: str = "Use a tool to look through the files and find the bug."):
        import json
        from langchain_core.messages import HumanMessage

        print("Running agent graph...", flush=True)

        # Run until the interrupt in wait_for_user (async)
        result = await self.agent.ainvoke(
            {"messages": [HumanMessage(content=prompt)]},
            config=self.config
        )

        # ainvoke() may not include all state fields when interrupted.
        # Use get_state() to get the full checkpoint which includes
        # all values written by completed nodes (including generate_challenge).
        snapshot = self.agent.get_state(self.config)
        full_state = snapshot.values if snapshot else {}

        print(f"[agent.run] invoke result keys: {list(result.keys())}", flush=True)
        print(f"[agent.run] snapshot keys: {list(full_state.keys())}", flush=True)

        challenge = full_state.get("challenge") or result.get("challenge")
        if challenge:
            print("\n=== Coding Challenge ===", flush=True)
            if hasattr(challenge, 'model_dump'):
                print(json.dumps(challenge.model_dump(), indent=2), flush=True)
            else:
                print(json.dumps(challenge, indent=2), flush=True)

        # Return the full state (merged) so the server gets the challenge
        merged = {**result, **full_state}
        return merged

    # Callable method designed for FastAPI server to resume flow at 
    async def resume(self, user_solution: str):
        from langgraph.types import Command

        result = await self.agent.ainvoke(
            Command(resume=user_solution),
            config=self.config
        )

        print("\n=== Grade ===")
        print(result.get("grade", "No grade returned."))

        return result

    

if __name__ == "__main__":
    import asyncio

    async def main():
        agent = Agent("../../buggy_code")
        await agent.run()
        user_solution = input("\nYour solution:\n")
        await agent.resume(user_solution)

    asyncio.run(main())
 22