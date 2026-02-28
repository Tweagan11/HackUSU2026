from langchain.messages import SystemMessage, ToolMessage
from langchain_core.messages import SystemMessage
from pydantic import BaseModel
from langgraph.types import interrupt


class Bug(BaseModel):
    file: str
    description: str
    line_number: int | None = None
    suggested_fix: str
class BugReport(BaseModel):
    bugs: list[Bug]


class ChallengeCode(BaseModel):
    language: str
    code: str
    instructions: str


def make_llm_call(model):
    """Returns an llm_call node that uses the given model."""
    def llm_call(state: dict):
        """LLM decides whether to call a tool or not"""
        return {
            "messages": [
                model.invoke(
                    [
                        SystemMessage(
                            content="You are a helpful assistant who is tasked with looking at a codebase and discovering bugs and offering solutions." \
                            "You have access to a tool that can search this codebase. Use this tool to search the codebase for the error and then provide the solution."
                        )
                    ]
                    + state["messages"]
                )
            ],
            "llm_calls": state.get('llm_calls', 0) + 1
        }
    return llm_call


def make_tool_node(tools):
    """Returns a tool_node that uses the given list of tools."""
    tools_by_name = {t.name: t for t in tools}

    def tool_node(state: dict):
        """Performs the tool call"""
        result = []
        for tool_call in state["messages"][-1].tool_calls:
            tool = tools_by_name[tool_call["name"]]
            observation = tool.invoke(tool_call["args"])
            result.append(ToolMessage(content=observation, tool_call_id=tool_call["id"]))
        return {"messages": result}
    return tool_node


def make_extract_bugs(model):
    """Returns an extract_bugs node that produces a structured BugReport."""
    structured_model = model.with_structured_output(BugReport)

    def extract_bugs(state: dict):
        """Extracts structured bug report from the conversation history."""
        response = structured_model.invoke(
            [
                SystemMessage(
                    content=(
                        "Based on the conversation so far, extract all bugs found in the codebase. "
                        "For each bug, provide the file name, a description, the line number if known, "
                        "and a suggested fix."
                    )
                )
            ]
            + state["messages"]
        )
        return {"bugs_found": response.bugs}

    return extract_bugs


def make_generate_challenge(model):
    """Returns a generate_challenge node that produces a buggy coding challenge based on extracted bugs."""
    structured_model = model.with_structured_output(ChallengeCode)

    def generate_challenge(state: dict):
        """Generates a toy programming challenge inspired by the bugs found in the codebase."""
        bugs = state.get("bugs_found", [])
        bug_summary = "\n".join(
            f"- {b.description} (fix: {b.suggested_fix})" for b in bugs
        ) or "general bugs"

        response = structured_model.invoke(
            [
                SystemMessage(
                    content=(
                        "You are a programming tutor. Based on the bug types listed below, create a brand new, "
                        "short, self-contained coding challenge for the user to practice fixing similar issues. "
                        "Do NOT patch or reference the original code. Instead, invent a completely different "
                        "simple program that contains the same category of bug. "
                        "Return ONLY a JSON object with three fields:\n"
                        "  language: the programming language (e.g. 'python')\n"
                        "  code: a new buggy code snippet the user must fix (valid source code only, no prose, no markdown)\n"
                        "  instructions: a one-sentence prompt telling the user what to fix\n\n"
                        f"Bug types to base the challenge on:\n{bug_summary}"
                    )
                )
            ]
        )
        return {"challenge": response}

    return generate_challenge


def wait_for_user(state: dict):
    """Pauses the graph and waits for the user to submit their solution."""
    challenge = state.get("challenge")
    instructions = challenge.instructions if challenge else "Fix the bug in the code."
    user_solution = interrupt(instructions)
    return {"user_solution": user_solution}


def make_grade_solution(model):
    """Returns a grade_solution node that evaluates the user's submitted solution."""

    def grade_solution(state: dict):
        """Grades the user's solution against the challenge."""
        challenge = state.get("challenge")
        user_solution = state.get("user_solution", "")

        response = model.invoke(
            [
                SystemMessage(
                    content=(
                        "You are a programming tutor grading a student's solution. "
                        "Given the original buggy challenge and the student's fix, "
                        "explain whether the solution is correct and why. Be concise and encouraging."
                        f"\n\nOriginal buggy code:\n{challenge.code if challenge else 'N/A'}"
                        f"\n\nStudent's solution:\n{user_solution}"
                    )
                )
            ]
        )
        return {"grade": response.content}

    return grade_solution
