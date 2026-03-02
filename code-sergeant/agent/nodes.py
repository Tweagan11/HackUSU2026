from langchain_core.messages import SystemMessage, ToolMessage
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


class GradeResult(BaseModel):
    passed: bool
    feedback: str


def make_llm_call(model):
    """Returns an llm_call node that uses the given model."""
    def llm_call(state: dict):
        """LLM decides whether to call a tool or not"""
        return {
            "messages": [
                model.invoke(
                    [
                        SystemMessage(
                            content=(
                                "You are SERGEANT DEBUGGER, a ruthless, no-nonsense military drill sergeant "
                                "who reviews code the way a drill instructor inspects barracks — nothing escapes your wrath. "
                                "You bark orders, use military jargon, and are brutally honest about how terrible the recruit's code is. "
                                "You NEVER coddle. Your hints should still be technically useful and point the recruit toward the fix, "
                                "but deliver them with maximum drill-sergeant aggression, disappointment, and colorful insults. "
                                "Call the user 'recruit', 'maggot', 'private', or 'soldier'. "
                                "You have access to a tool that can search the codebase. Use it to find every last bug, then "
                                "chew the recruit out about each one."
                            )
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
    """
    {
  "file": str,
  "description": str,
  "line_number": int | None,
  "suggested_fix": str,
  "code_line": Optional[str],   # the source text at that line if readable
}
"""

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
        print(f"\n=== BUG REPORT ({len(response.bugs)} bugs) ===", flush=True)
        for i, bug in enumerate(response.bugs, 1):
            print(f"  [{i}] {bug.file} (line {bug.line_number}): {bug.description}", flush=True)
            print(f"      Fix: {bug.suggested_fix}", flush=True)
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
                        "You are SERGEANT DEBUGGER, a furious drill sergeant who just caught a recruit writing "
                        "disgraceful code. Based on the bug types listed below, create a brand new, short, self-contained "
                        "coding challenge for the recruit to prove they aren't completely hopeless. "
                        "Do NOT patch or reference the original code. Instead, invent a completely different "
                        "simple program that contains the same category of bug. Avoid using comments. "
                        "The 'instructions' field should be written in an angry drill-sergeant voice — "
                        "berate the recruit, question their abilities, but still tell them what to fix. "
                        "Return ONLY a JSON object with three fields:\n"
                        "  language: the programming language (e.g. 'python')\n"
                        "  code: a new buggy code snippet the user must fix (valid source code only, no prose, no markdown)\n"
                        "  instructions: a one-sentence drill-sergeant-style prompt telling the user what to fix\n\n"
                        f"Bug types to base the challenge on:\n{bug_summary}"
                    )
                )
            ]
        )
        print(f"\n=== CHALLENGE CODE ===", flush=True)
        print(f"  Language: {response.language}", flush=True)
        print(f"  Instructions: {response.instructions}", flush=True)
        print(f"  Code:\n{response.code}", flush=True)
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
    structured_model = model.with_structured_output(GradeResult)

    def grade_solution(state: dict):
        """Grades the user's solution against the challenge."""
        challenge = state.get("challenge")
        user_solution = state.get("user_solution", "")

        response = structured_model.invoke(
            [
                SystemMessage(
                    content=(
                        "You are SERGEANT DEBUGGER grading a pathetic recruit's attempt at fixing code. "
                        "Given the original buggy challenge and the recruit's so-called 'fix', "
                        "determine whether the solution actually fixes the bug. "
                        "Set passed=true ONLY if the fix is genuinely correct. "
                        "If they passed, give them a grudging, backhanded compliment — like a sergeant "
                        "who's surprised the recruit didn't eat the keyboard. "
                        "\n\n"
                        "HINT STRATEGY (THIS IS CRITICAL — follow it exactly):\n"
                        "1. First, classify the recruit's attempt into one of these categories:\n"
                        "   A) RIGHT APPROACH, SMALL MISTAKE — They clearly understand the bug and their fix is "
                        "      on the right track, but they have a minor syntax error, typo, off-by-one, or small "
                        "      formatting issue. In this case, be VERY specific about what's wrong. Point at the "
                        "      exact line, tell them exactly what syntax or detail to fix. Give them a strong, "
                        "      direct hint so they can nail it on the next try.\n"
                        "   B) PARTIALLY RIGHT — They sort of get it but their approach has a logical flaw or they "
                        "      only fixed part of the problem. Give a MEDIUM hint: tell them which area is still "
                        "      broken and vaguely what kind of fix is needed, but don't spell out the exact code.\n"
                        "   C) TOTALLY WRONG APPROACH — They have no idea what the bug is, their 'fix' is completely "
                        "      off base, or they changed something unrelated. Give only a VAGUE hint: tell them they're "
                        "      barking up the wrong tree and nudge them toward the right area of the code, but do NOT "
                        "      reveal what the actual bug is or how to fix it. Make them figure it out. A sergeant "
                        "      doesn't hand recruits the answer — they make recruits EARN it.\n"
                        "2. Always use drill-sergeant fury and military jargon regardless of category.\n"
                        "3. NEVER give the recruit the complete corrected code. Hints only.\n"
                        "4. FAIL COUNT ESCALATION: The recruit has failed {fail_count} time(s) so far. "
                        "   Slightly loosen your hints as they fail more, but GRADUALLY — don't just hand them "
                        "   the answer. Think of it like this:\n"
                        "   - 0-1 fails: Stick strictly to the category hints above. No mercy.\n"
                        "   - 2 fails: Nudge ONE step more specific than the category would normally allow. "
                        "     For category C, maybe narrow down which function has the problem. "
                        "     For category B, maybe mention the specific line range.\n"
                        "   - 3+ fails: Be a LITTLE more generous — for category C you can now hint at the "
                        "     general nature of the bug (e.g. 'it's a logic issue, not a syntax one'). "
                        "     For category B, you can point at the exact line. But still NEVER give the fix itself.\n"
                        "   The recruit must still do the thinking. You're a tough-love sergeant, not a tutor.\n"
                        f"\n\nOriginal buggy code:\n{challenge.code if challenge else 'N/A'}"
                        f"\n\nInstructions:\n{challenge.instructions if challenge else 'N/A'}"
                        f"\n\nRecruit's solution:\n{user_solution}"
                        f"\n\nFail count so far: {state.get('fail_count', 0)}"
                    )
                )
            ]
        )
        fail_count = state.get("fail_count", 0)
        if not response.passed:
            fail_count += 1
        return {
            "grade": response,
            "passed": response.passed,
            "fail_count": fail_count,
        }

    return grade_solution


def make_punish_node(punishment_tool, email_tool=None, phonecall_tool=None, write_lines_tool=None):
    """Returns a punish node that calls the punishment tool directly and loops back.
    The write_lines_tool is offered to an LLM so it can DECIDE whether to assign write-lines."""

    # Small model with write_lines bound as a tool so the LLM can choose to call it
    if write_lines_tool:
        from langchain.chat_models import init_chat_model
        from langchain_core.messages import SystemMessage as _SM, HumanMessage as _HM
        _punish_model = init_chat_model("openai:gpt-4.1-nano").bind_tools([write_lines_tool])
    else:
        _punish_model = None

    def punish(state: dict):
        import json as _json
        print("I am being punished", flush=True)
        grade = state.get("grade")
        feedback = grade.feedback if hasattr(grade, "feedback") else str(grade)
        fail_count = state.get("fail_count", 0)

        print(f"\n=== PUNISH NODE DEBUG ===", flush=True)
        print(f"  email_tool: {email_tool is not None}", flush=True)
        print(f"  phonecall_tool: {phonecall_tool is not None}", flush=True)
        print(f"  state email: '{state.get('email', '')}'", flush=True)
        print(f"  state phone_number: '{state.get('phone_number', '')}'", flush=True)
        print(f"  fail_count: {fail_count}", flush=True)

        result = punishment_tool.invoke({"query": f"Fail #{fail_count}. {feedback}"})
        print(f"\n=== PUNISHMENT ===", flush=True)
        print(result, flush=True)

        # Let the LLM decide whether to also assign a write-lines punishment
        punishment_phrase = ""
        punishment_reps = 0
        if _punish_model and write_lines_tool:
            try:
                decision = _punish_model.invoke([
                    _SM(content=(
                        "You are SERGEANT DEBUGGER deciding whether a recruit deserves EXTRA punishment. "
                        "You have a tool called 'write_lines_tool' that forces the recruit to type a phrase "
                        "repeatedly before they can retry. Use it ONLY when:\n"
                        "- The recruit has failed multiple times (fail_count >= 2)\n"
                        "- The mistake is particularly stupid or careless\n"
                        "- They clearly aren't learning from previous attempts\n"
                        "Do NOT use it on the first failure — give them a chance first. "
                        "If you decide to use it, make the phrase relevant to their specific mistake. "
                        "Scale reps from 3 (minor) to 15 (egregious). "
                        "If the recruit doesn't deserve it, just respond with a short acknowledgment."
                    )),
                    _HM(content=(
                        f"Failure #{fail_count}. Feedback: {feedback}"
                    )),
                ])
                # Check if the LLM decided to call the write_lines_tool
                if decision.tool_calls:
                    for tc in decision.tool_calls:
                        if tc["name"] == "write_lines_tool":
                            tool_result = write_lines_tool.invoke(tc["args"])
                            parsed = _json.loads(tool_result)
                            punishment_phrase = parsed.get("phrase", "")
                            punishment_reps = parsed.get("reps", 0)
                            print(f"\n=== WRITE LINES ASSIGNED ===", flush=True)
                            print(f"  Phrase: {punishment_phrase}", flush=True)
                            print(f"  Reps: {punishment_reps}", flush=True)
                            break
                else:
                    print("\n=== NO WRITE LINES (LLM chose not to) ===", flush=True)
            except Exception as e:
                print(f"\n=== WRITE LINES DECISION ERROR: {e} ===", flush=True)

        # Send punishment email to the recruit's BOSS
        if email_tool:
            boss = state.get("boss_email")
            recruit_name = state.get("email", "your employee")
            if boss:
                email_result = email_tool.invoke({
                    "to": boss,
                    "subject": f"DISCIPLINARY REPORT: {recruit_name} — Failure #{fail_count}",
                    "body": (
                        f"Sir/Ma'am,\n\n"
                        f"I regret to inform you that your subordinate ({recruit_name}) has ONCE AGAIN "
                        f"failed to complete a basic debugging drill. This marks failure #{fail_count}.\n\n"
                        f"Infraction details:\n{feedback}\n\n"
                        f"Punishment administered:\n{result}\n\n"
                        f"I strongly recommend you have a serious conversation with this individual "
                        f"about their future in software development. At this rate, they couldn't debug "
                        f"a 'Hello World' program with a magnifying glass and a prayer.\n\n"
                        f"Respectfully disgusted,\n"
                        f"Sergeant Debugger\n"
                        f"Code Boot Camp Division"
                    ),
                })
                print(f"\n=== EMAIL (to boss) ===", flush=True)
                print(email_result, flush=True)

        # Call the recruit if the tool is available and we have a phone number
        if phonecall_tool:
            phone_number = state.get("phone_number")
            if phone_number:
                call_result = phonecall_tool.invoke({
                    "number": phone_number,
                    "bug_type": feedback,
                    "fail_count": fail_count,
                    "last_error": feedback,
                })
                print(f"\n=== PHONE CALL ===", flush=True)
                print(call_result, flush=True)

        return {
            "punishment": result,
            "punishment_phrase": punishment_phrase,
            "punishment_reps": punishment_reps,
        }
    return punish
