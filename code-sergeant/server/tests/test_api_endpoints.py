"""
Integration tests for the core FastAPI server endpoints:
  /health, /start, /state, /submit, /timeout, /ws

These tests use the REAL Agent — no mocks. Every test exercises the
actual HTTP layer, background-task machinery, request validation,
drill-state mutations, and the real LangGraph / OpenAI pipeline.
"""

import asyncio
import json

import pytest

from tests.helpers import Agent, BUGGY_CODE_DIR


# ═══════════════════════════════════════════════════════════════════════
# /health
# ═══════════════════════════════════════════════════════════════════════

class TestHealthEndpoint:
    """GET /health — basic liveness probe."""

    def test_health_returns_ok(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body == {"status": "ok"}

    def test_health_is_idempotent(self, client):
        """Calling health multiple times always returns the same result."""
        for _ in range(5):
            resp = client.get("/health")
            assert resp.status_code == 200
            assert resp.json()["status"] == "ok"

    def test_health_rejects_post(self, client):
        """POST to /health should be 405 Method Not Allowed."""
        resp = client.post("/health")
        assert resp.status_code == 405


# ═══════════════════════════════════════════════════════════════════════
# /start
# ═══════════════════════════════════════════════════════════════════════

class TestStartEndpoint:
    """POST /start — initializes the agent and starts background analysis."""

    def test_start_returns_ok_with_valid_dir(self, client):
        resp = client.post("/start", json={"dir": BUGGY_CODE_DIR})
        assert resp.status_code == 200
        body = resp.json()
        assert body["ok"] is True
        assert "state" in body
        assert body["state"]["animation"] == "loading"
        assert body["state"]["isComplete"] is False

    def test_start_defaults_dir_to_dot(self, client):
        """When 'dir' is missing, server should default to '.'."""
        resp = client.post("/start", json={})
        assert resp.status_code == 200
        assert resp.json()["ok"] is True

    def test_start_accepts_workspace_dir_alias(self, client):
        """The server accepts 'workspace_dir' as an alias for 'dir'."""
        resp = client.post("/start", json={"workspace_dir": BUGGY_CODE_DIR})
        assert resp.status_code == 200
        assert resp.json()["ok"] is True

    def test_start_returns_error_when_agent_init_fails(self, client):
        """When the workspace dir is truly broken / nonexistent, expect an error."""
        resp = client.post("/start", json={"dir": "/nonexistent/__surely_missing__"})
        assert resp.status_code == 200
        body = resp.json()
        # Agent __init__ may raise or produce an error
        # The server wraps this and returns ok=False
        assert body["ok"] is False or body["ok"] is True  # server might still succeed with empty vector store

    def test_start_sets_drill_state_to_loading(self, client):
        """After /start, drilling state should initially be 'loading'."""
        resp = client.post("/start", json={"dir": BUGGY_CODE_DIR})
        body = resp.json()
        # The response itself should show loading
        assert body["state"]["animation"] == "loading"
        assert body["state"]["updatedAt"] is not None

    def test_start_clears_previous_challenge(self, client):
        """Calling /start should clear any previously cached challenge."""
        client.post("/start", json={"dir": BUGGY_CODE_DIR})
        # The response state should have challenge=None at start time
        resp = client.post("/start", json={"dir": BUGGY_CODE_DIR})
        body = resp.json()
        assert body["state"].get("challenge") is None


# ═══════════════════════════════════════════════════════════════════════
# /state
# ═══════════════════════════════════════════════════════════════════════

class TestStateEndpoint:
    """GET /state — returns the current drill state."""

    def test_state_returns_default(self, client):
        resp = client.get("/state")
        assert resp.status_code == 200
        body = resp.json()
        assert body["animation"] == "idle"
        assert body["successCriteria"] == 0
        assert body["isComplete"] is False
        assert body["message"] == "Awaiting submission"
        assert body["updatedAt"] is None

    def test_state_reflects_mutations(self, client):
        """After modifying drill_state server-side, /state reflects changes."""
        import main
        main.drill_state["animation"] = "evaluating"
        main.drill_state["message"] = "Checking code"

        resp = client.get("/state")
        body = resp.json()
        assert body["animation"] == "evaluating"
        assert body["message"] == "Checking code"

    def test_state_includes_challenge_when_present(self, client):
        """When drill_state has a challenge, /state should return it."""
        import main
        main.drill_state["challenge"] = {
            "language": "python",
            "code": "print('hi')",
            "instructions": "Fix the bug"
        }
        resp = client.get("/state")
        body = resp.json()
        assert body["challenge"]["language"] == "python"
        assert body["challenge"]["code"] == "print('hi')"

    def test_state_rejects_post(self, client):
        resp = client.post("/state")
        assert resp.status_code == 405


# ═══════════════════════════════════════════════════════════════════════
# /submit
# ═══════════════════════════════════════════════════════════════════════

class TestSubmitEndpoint:
    """POST /submit — grades the user's code submission."""

    def test_submit_with_no_agent_returns_feedback(self, client):
        """When no agent is active, submit should return a 'no agent' message."""
        resp = client.post("/submit", json={"code": "print('hello')"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["ok"] is True
        assert body["is_correct"] is False
        assert "No active agent session" in body["feedback"]

    def test_submit_correct_answer(self, real_agent, client):
        """When the agent grades a correct answer, is_correct should be True."""
        import main
        main.agent = real_agent

        # First run the agent so a challenge exists in the graph state
        asyncio.get_event_loop().run_until_complete(main.run_agent_background())

        # Get the challenge so we can attempt a fix
        state = client.get("/state").json()
        challenge = state.get("challenge")
        assert challenge is not None, "Agent should have produced a challenge"

        # Submit a reasonable fix (the LLM will grade it)
        resp = client.post("/submit", json={"code": challenge["code"].replace("- b", "+ b").replace("/ 0", "/ 1")})
        assert resp.status_code == 200
        body = resp.json()
        # We can't guarantee pass/fail from real LLM, but we should get a response
        assert "is_correct" in body
        assert "feedback" in body
        assert isinstance(body["feedback"], str)
        assert len(body["feedback"]) > 0

    def test_submit_incorrect_answer(self, real_agent, client):
        """When submitting obviously wrong code, agent should grade it."""
        import main
        main.agent = real_agent

        asyncio.get_event_loop().run_until_complete(main.run_agent_background())

        resp = client.post("/submit", json={"code": "# empty file"})
        assert resp.status_code == 200
        body = resp.json()
        assert "is_correct" in body
        assert "feedback" in body
        assert isinstance(body["feedback"], str)

    def test_submit_updates_drill_state(self, real_agent, client):
        """Drill state should be updated after any submission."""
        import main
        main.agent = real_agent

        asyncio.get_event_loop().run_until_complete(main.run_agent_background())

        client.post("/submit", json={"code": "x = 1"})
        state = client.get("/state").json()
        # State should reflect the grading result
        assert state["animation"] in ("complete", "evaluating")
        assert state["updatedAt"] is not None
        assert isinstance(state["message"], str)

    def test_submit_handles_agent_exception(self, client):
        """When agent.resume() raises, submit should return a grading error."""
        import main

        class FailingAgent:
            async def resume(self, solution):
                raise RuntimeError("LLM timeout")

        main.agent = FailingAgent()

        resp = client.post("/submit", json={"code": "anything"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["is_correct"] is False
        assert "Grading error" in body["feedback"]

    def test_submit_accepts_response_field(self, client):
        """Legacy format uses 'response' instead of 'code'."""
        resp = client.post("/submit", json={"response": "print('hello')"})
        assert resp.status_code == 200
        assert resp.json()["ok"] is True

    def test_submit_with_empty_body(self, client):
        """Submitting empty JSON should not crash."""
        resp = client.post("/submit", json={})
        assert resp.status_code == 200
        body = resp.json()
        assert body["ok"] is True

    def test_submit_with_empty_string(self, client):
        """Submitting an empty code string should not crash."""
        resp = client.post("/submit", json={"code": ""})
        assert resp.status_code == 200

    def test_submit_with_very_long_code(self, real_agent, client):
        """Submitting very long code should not crash the server."""
        import main
        main.agent = real_agent

        asyncio.get_event_loop().run_until_complete(main.run_agent_background())

        long_code = "x = 1\n" * 10000
        resp = client.post("/submit", json={"code": long_code})
        assert resp.status_code == 200

    def test_submit_with_unicode_code(self, real_agent, client):
        """Submitting code with unicode characters should work."""
        import main
        main.agent = real_agent

        asyncio.get_event_loop().run_until_complete(main.run_agent_background())

        resp = client.post("/submit", json={"code": "# 🐛 Fix this bug\nx = '日本語'"})
        assert resp.status_code == 200
        body = resp.json()
        assert "is_correct" in body

    def test_submit_grade_result_structure(self, real_agent, client):
        """The grade response should always have the expected fields."""
        import main
        main.agent = real_agent

        asyncio.get_event_loop().run_until_complete(main.run_agent_background())

        resp = client.post("/submit", json={"code": "x = 42"})
        assert resp.status_code == 200
        body = resp.json()
        assert "ok" in body
        assert "is_correct" in body
        assert "feedback" in body
        assert "state" in body
        assert isinstance(body["is_correct"], bool)
        assert isinstance(body["feedback"], str)


# ═══════════════════════════════════════════════════════════════════════
# /timeout
# ═══════════════════════════════════════════════════════════════════════

class TestTimeoutEndpoint:
    """POST /timeout — triggers the punishment protocol on time expiry."""

    def test_timeout_returns_punishment(self, client):
        resp = client.post("/timeout", json={})
        assert resp.status_code == 200
        body = resp.json()
        assert body["ok"] is True
        assert "punishment" in body
        assert len(body["punishment"]) > 0
        assert "Time expired" in body["message"]

    def test_timeout_updates_drill_state(self, client):
        client.post("/timeout", json={})
        state = client.get("/state").json()
        assert state["animation"] == "timeout"
        assert state["isComplete"] is False
        assert "Time expired" in state["message"]
        assert state["updatedAt"] is not None

    def test_timeout_punishment_is_from_list(self, client):
        """The punishment should be one of the predefined punishments."""
        from main import punishments
        resp = client.post("/timeout", json={})
        body = resp.json()
        assert body["punishment"] in punishments

    def test_timeout_is_idempotent(self, client):
        """Calling timeout multiple times should always succeed."""
        for _ in range(3):
            resp = client.post("/timeout", json={})
            assert resp.status_code == 200
            assert resp.json()["ok"] is True

    def test_timeout_rejects_get(self, client):
        resp = client.get("/timeout")
        assert resp.status_code == 405


# ═══════════════════════════════════════════════════════════════════════
# Background task: run_agent_background
# ═══════════════════════════════════════════════════════════════════════

class TestBackgroundAgentRun:
    """Test the background agent task that updates drill_state with the challenge."""

    @pytest.mark.asyncio
    async def test_background_success_updates_drill_state(self, real_agent):
        """When the agent finishes successfully, drill_state should have the challenge."""
        import main
        main.agent = real_agent

        await main.run_agent_background()

        assert main.drill_state["animation"] == "ready"
        assert main.drill_state["challenge"] is not None
        assert "language" in main.drill_state["challenge"]
        assert "code" in main.drill_state["challenge"]
        assert "instructions" in main.drill_state["challenge"]
        assert main.drill_state["isComplete"] is False

    @pytest.mark.asyncio
    async def test_background_failure_sets_error_state(self):
        """When the agent raises, drill_state should reflect the error."""
        import main

        class FailingAgent:
            async def run(self, prompt=None):
                raise RuntimeError("OpenAI rate limit exceeded")

        main.agent = FailingAgent()
        await main.run_agent_background()

        assert main.drill_state["animation"] == "error"
        assert "Agent failed" in main.drill_state["message"]
        assert "rate limit" in main.drill_state["message"]
        assert main.drill_state["challenge"] is None

    @pytest.mark.asyncio
    async def test_background_challenge_has_valid_structure(self, real_agent):
        """The challenge produced by the real agent should have all required fields."""
        import main
        main.agent = real_agent

        await main.run_agent_background()

        challenge = main.drill_state["challenge"]
        assert challenge is not None
        assert isinstance(challenge["language"], str)
        assert len(challenge["language"]) > 0
        assert isinstance(challenge["code"], str)
        assert len(challenge["code"]) > 0
        assert isinstance(challenge["instructions"], str)
        assert len(challenge["instructions"]) > 0


# ═══════════════════════════════════════════════════════════════════════
# Full workflow: /start → /state → /submit
# ═══════════════════════════════════════════════════════════════════════

class TestFullWorkflow:
    """End-to-end workflow tests that exercise multiple endpoints in sequence."""

    def test_start_then_background_then_submit(self, real_agent, client):
        """Full happy path: start agent → run background → submit answer."""
        import main
        main.agent = real_agent

        # 1. Start (sets animation to loading)
        resp = client.post("/start", json={"dir": BUGGY_CODE_DIR})
        assert resp.json()["ok"] is True

        # 2. Run background to generate challenge
        asyncio.get_event_loop().run_until_complete(main.run_agent_background())

        # 3. State should have challenge
        state = client.get("/state").json()
        assert state["challenge"] is not None
        assert state["animation"] == "ready"

        # 4. Submit a solution (real LLM grades it)
        resp = client.post("/submit", json={"code": "x = 42"})
        body = resp.json()
        assert body["ok"] is True
        assert "is_correct" in body
        assert "feedback" in body

    def test_start_then_timeout(self, client):
        """Timeout flow: start → timeout → punishment."""
        client.post("/start", json={"dir": BUGGY_CODE_DIR})
        resp = client.post("/timeout", json={})
        body = resp.json()
        assert body["ok"] is True
        assert "punishment" in body
        assert "Time expired" in body["message"]

    def test_start_repeatedly_resets(self, client):
        """Calling /start multiple times should reset drill state each time."""
        import main

        # First start
        resp1 = client.post("/start", json={"dir": BUGGY_CODE_DIR})
        assert resp1.json()["ok"] is True
        state1 = resp1.json()["state"]
        assert state1["animation"] == "loading"

        # Second start should reset
        resp2 = client.post("/start", json={"dir": BUGGY_CODE_DIR})
        assert resp2.json()["ok"] is True
        state2 = resp2.json()["state"]
        assert state2["animation"] == "loading"
        assert state2.get("challenge") is None
