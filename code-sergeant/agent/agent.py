# Load OPENAI API KEYS
import os
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
from nodes import make_llm_call, make_tool_node, make_extract_bugs, make_generate_challenge, wait_for_user, make_grade_solution, make_punish_node
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

        # Only RAG tool for Phase 1 bug discovery
        rag_tool = get_rag_tool()
        discovery_tools = [rag_tool]

        model = init_chat_model(
            "openai:gpt-4.1-mini",
        )
        model_with_tools = model.bind_tools(discovery_tools)

        llm_call = make_llm_call(model_with_tools)
        tool_node = make_tool_node(discovery_tools)
        extract_bugs = make_extract_bugs(model)
        generate_challenge = make_generate_challenge(model)
        grade_solution = make_grade_solution(model)
        punish = make_punish_node(
            punishment_tool=create_punishment_tool(),
            email_tool=create_email_tool(),
            phonecall_tool=create_phonecall_tool(),
        )

        print("Initialize agent")
        agent_builder = StateGraph(ExtendedState)

        agent_builder.add_node("llm_call", llm_call)
        agent_builder.add_node("tool_node", tool_node)
        agent_builder.add_node("extract_bugs", extract_bugs)
        agent_builder.add_node("generate_challenge", generate_challenge)
        agent_builder.add_node("wait_for_user", wait_for_user)
        agent_builder.add_node("grade_solution", grade_solution)
        agent_builder.add_node("punish", punish)

        # Phase 1: analyse codebase (llm <-> tools loop)
        agent_builder.add_edge(START, "llm_call")
        agent_builder.add_conditional_edges(
            "llm_call",
            self.should_continue,
            ["tool_node", "extract_bugs"]
        )
        agent_builder.add_edge("tool_node", "llm_call")

        # Phase 2: challenge the user
        agent_builder.add_edge("extract_bugs", "generate_challenge")
        agent_builder.add_edge("generate_challenge", "wait_for_user")
        agent_builder.add_edge("wait_for_user", "grade_solution")

        # Phase 3: grade → END or punish → wait_for_user (retry loop)
        agent_builder.add_conditional_edges(
            "grade_solution",
            self.user_should_retry,
            ["punish", END]
        )
        agent_builder.add_edge("punish", "wait_for_user")

        print("Compiling agent")
        self.agent = agent_builder.compile(checkpointer=MemorySaver())
        self.config = {"configurable": {"thread_id": "1"}}

        print(self.agent.get_graph().draw_ascii())


    @staticmethod
    def should_continue(state: ExtendedState) -> Literal["tool_node", "extract_bugs"]:
        """Decide if we should continue the loop or stop based upon whether the LLM made a tool call"""
        messages = state["messages"]
        last_message = messages[-1]
        if last_message.tool_calls:
            return "tool_node"
        return "extract_bugs"

    @staticmethod
    def user_should_retry(state: ExtendedState) -> Literal["punish", str]:
        """Decide routing from grade_solution: success (END) or punishment + retry (punish)"""
        passed = state.get("passed", False)

        if passed:
            return END

        # Every wrong answer goes through punishment, then back to wait_for_user
        return "punish"

    
    async def run(self, prompt: str = "Use a tool to look through the files and find the bug.", email: str = "", phone_number: str = "+18013694523"):
        import json
        from langchain_core.messages import HumanMessage

        print("Running agent graph...", flush=True)

        # Run until the interrupt in wait_for_user (async)
        result = await self.agent.ainvoke(
            {
                "messages": [HumanMessage(content=prompt)],
                "email": email,
                "phone_number": phone_number,
            },
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

        # Get full snapshot (like run()) so we see grade + punishment
        snapshot = self.agent.get_state(self.config)
        full_state = snapshot.values if snapshot else {}

        grade = full_state.get("grade") or result.get("grade")
        punishment = full_state.get("punishment") or result.get("punishment")
        passed = full_state.get("passed", False)

        print("\n=== Grade ===", flush=True)
        if hasattr(grade, "feedback"):
            print(f"  Passed: {grade.passed}", flush=True)
            print(f"  Feedback: {grade.feedback}", flush=True)
        else:
            print(grade, flush=True)

        if punishment and not passed:
            print(f"\n=== Punishment ===", flush=True)
            print(f"  {punishment}", flush=True)

        merged = {**result, **full_state}
        return merged

    

if __name__ == "__main__":
    import asyncio

    async def main():
        agent = Agent("../../buggy_code")
        await agent.run()

        # Retry loop: keep prompting until the user passes
        while True:
            user_solution = input("\nYour solution:\n")
            result = await agent.resume(user_solution)
            if result.get("passed", False):
                print("\n*** PASSED! You're dismissed, recruit. ***")
                break
            print("\n(Try again, recruit!)")

    asyncio.run(main())
