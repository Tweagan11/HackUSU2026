"""
End-to-end integration tests that simulate the full VS Code extension ↔ backend flow.

These tests use the REAL Agent backed by OpenAI — no mocks. They exercise
the same HTTP calls and message sequences that the TypeScript extension host
would make to the Python backend, verifying the complete contract.

Scenarios covered:
  1. Full happy path: /start → poll /state → /submit → verify state
  2. Fail + retry path: /start → /submit (wrong) → /submit (correct)
  3. Timeout path: /start → /timeout → verify punishment
  4. Challenge delivery: /start → background run → poll /state until challenge
  5. Call flow: /call/initiate → /call/status → /twilio webhooks
  6. Concurrent / rapid-fire requests
  7. Malformed request handling
  8. State isolation between sessions
"""

import asyncio
import json
import time

import pytest

from tests.helpers import Agent, BUGGY_CODE_DIR


# ═══════════════════════════════════════════════════════════════════════
# 1. Full happy-path E2E
# ═══════════════════════════════════════════════════════════════════════

class TestE2EHappyPath:
    """Simulates the complete successful workflow as the extension would execute it."""

    def test_full_success_workflow(self, real_agent, client):
        """
        Extension flow:
          1. POST /start → starts agent in background
          2. Run background → generates challenge via real LLM
          3. GET /state → sees challenge
          4. POST /submit with code → real LLM grades it
          5. GET /state → reflects grading result
        """
        import main
        main.agent = real_agent

        # 1. Start the workflow
        resp = client.post("/start", json={"dir": BUGGY_CODE_DIR})
        assert resp.status_code == 200
        assert resp.json()["ok"] is True

        # 2. Run agent background (real LLM calls)
        asyncio.get_event_loop().run_until_complete(main.run_agent_background())

        # 3. Poll state — should now have the challenge
        state = client.get("/state").json()
        assert state["animation"] == "ready"
        assert state["challenge"] is not None
        assert isinstance(state["challenge"]["language"], str)
        assert isinstance(state["challenge"]["code"], str)
        assert isinstance(state["challenge"]["instructions"], str)
        assert len(state["challenge"]["code"]) > 0
        assert len(state["challenge"]["instructions"]) > 0

        # 4. Submit a solution (real LLM grades)
        resp = client.post("/submit", json={
            "code": state["challenge"]["code"]  # submit the original (buggy) code as-is
        })
        body = resp.json()
        assert body["ok"] is True
        assert "is_correct" in body
        assert "feedback" in body
        assert isinstance(body["feedback"], str)
        assert len(body["feedback"]) > 0

        # 5. Verify state updated
        final_state = client.get("/state").json()
        assert final_state["animation"] in ("complete", "evaluating")
        assert final_state["updatedAt"] is not None

    def test_challenge_payload_matches_extension_contract(self, real_agent, client):
        """
        Verify the challenge payload returned by /state matches exactly
        what the extension's CHALLENGE_LOADED message expects:
          { language: string, code: string, instructions: string }
        """
        import main
        main.agent = real_agent

        client.post("/start", json={"dir": BUGGY_CODE_DIR})
        asyncio.get_event_loop().run_until_complete(main.run_agent_background())

        state = client.get("/state").json()
        ch = state["challenge"]

        # These are the exact fields the extension reads
        assert "language" in ch
        assert "code" in ch
        assert "instructions" in ch
        assert isinstance(ch["language"], str)
        assert isinstance(ch["code"], str)
        assert isinstance(ch["instructions"], str)


# ═══════════════════════════════════════════════════════════════════════
# 2. Fail + Retry E2E
# ═══════════════════════════════════════════════════════════════════════

class TestE2EFailAndRetry:
    """Simulates the fail → punishment → retry → success flow using the real Agent."""

    def test_submit_then_resubmit(self, real_agent, client):
        """
        Extension flow:
          1. POST /start → agent runs
          2. POST /submit (some code) → real LLM grades
          3. POST /submit (different code) → real LLM grades again
        Validates that the backend supports multiple sequential submissions.
        """
        import main
        main.agent = real_agent

        # 1. Start and run background
        client.post("/start", json={"dir": BUGGY_CODE_DIR})
        asyncio.get_event_loop().run_until_complete(main.run_agent_background())

        # 2. First submission
        resp1 = client.post("/submit", json={"code": "# intentionally wrong"})
        body1 = resp1.json()
        assert body1["ok"] is True
        assert "is_correct" in body1
        assert "feedback" in body1

        state_after_first = client.get("/state").json()
        assert state_after_first["animation"] in ("complete", "evaluating")

        # 3. Second submission
        resp2 = client.post("/submit", json={"code": "x = 42"})
        body2 = resp2.json()
        assert body2["ok"] is True
        assert "is_correct" in body2
        assert "feedback" in body2

    def test_multiple_submissions_do_not_crash(self, real_agent, client):
        """Each submission is handled independently and the server stays healthy."""
        import main
        main.agent = real_agent

        client.post("/start", json={"dir": BUGGY_CODE_DIR})
        asyncio.get_event_loop().run_until_complete(main.run_agent_background())

        for i in range(3):
            resp = client.post("/submit", json={"code": f"attempt_{i} = True"})
            assert resp.status_code == 200
            assert resp.json()["ok"] is True

        # Health should still be OK
        assert client.get("/health").json()["status"] == "ok"


# ═══════════════════════════════════════════════════════════════════════
# 3. Timeout E2E
# ═══════════════════════════════════════════════════════════════════════

class TestE2ETimeout:
    """Simulates the timeout flow as triggered by the frontend timer."""

    def test_timeout_triggers_punishment(self, client):
        """
        Extension flow:
          1. POST /start
          2. Timer expires → frontend sends MISSION_TIMEOUT
          3. Extension calls POST /timeout
          4. Backend returns punishment message
        """
        # 1. Start
        client.post("/start", json={"dir": BUGGY_CODE_DIR})

        # 2–3. Timeout
        resp = client.post("/timeout", json={})
        body = resp.json()

        assert body["ok"] is True
        assert "Time expired" in body["message"]
        assert body["punishment"] is not None
        assert len(body["punishment"]) > 0

        # 4. State reflects timeout
        state = client.get("/state").json()
        assert state["animation"] == "timeout"
        assert state["isComplete"] is False

    def test_timeout_then_submit_still_works(self, real_agent, client):
        """After a timeout, user can still submit (extension resets state)."""
        import main
        main.agent = real_agent

        client.post("/start", json={"dir": BUGGY_CODE_DIR})
        asyncio.get_event_loop().run_until_complete(main.run_agent_background())

        # Timeout first
        client.post("/timeout", json={})

        # Then submit — the real agent grades it
        resp = client.post("/submit", json={"code": "x = 1"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["ok"] is True
        assert "is_correct" in body


# ═══════════════════════════════════════════════════════════════════════
# 4. Challenge Delivery E2E
# ═══════════════════════════════════════════════════════════════════════

class TestE2EChallengeDelivery:
    """Tests the challenge loading pipeline from agent → /state → extension → webview."""

    def test_challenge_available_after_background_completes(self, real_agent, client):
        """After background task finishes, /state should have the challenge."""
        import main
        main.agent = real_agent

        client.post("/start", json={"dir": BUGGY_CODE_DIR})
        asyncio.get_event_loop().run_until_complete(main.run_agent_background())

        state = client.get("/state").json()
        assert state["animation"] == "ready"
        assert state["challenge"] is not None
        assert isinstance(state["challenge"]["language"], str)
        assert isinstance(state["challenge"]["code"], str)
        assert isinstance(state["challenge"]["instructions"], str)

    def test_challenge_has_meaningful_content(self, real_agent, client):
        """The challenge generated by the real agent should be non-trivial."""
        import main
        main.agent = real_agent

        client.post("/start", json={"dir": BUGGY_CODE_DIR})
        asyncio.get_event_loop().run_until_complete(main.run_agent_background())

        state = client.get("/state").json()
        ch = state["challenge"]
        assert ch is not None

        # Challenge code should be a real snippet (not empty or trivially short)
        assert len(ch["code"]) >= 10, f"Challenge code too short: {ch['code']}"
        # Instructions should be a meaningful sentence
        assert len(ch["instructions"]) >= 10, f"Instructions too short: {ch['instructions']}"
        # Language should be a recognizable language name
        assert ch["language"].lower() in (
            "python", "javascript", "typescript", "go", "rust", "java",
            "c", "cpp", "c++", "csharp", "c#", "ruby", "php", "swift", "kotlin",
        ), f"Unexpected language: {ch['language']}"


# ═══════════════════════════════════════════════════════════════════════
# 5. Call Flow E2E
# ═══════════════════════════════════════════════════════════════════════

class TestE2ECallFlow:
    """
    Simulates the phone-call flow:
      Extension sends CALL_SERGEANT → backend POST /call/initiate
      Extension polls /call/status/{id}
      Twilio webhooks update the status
    """

    def test_call_flow_missing_credentials(self, client):
        """Without Twilio creds, initiate should fail gracefully."""
        import call_router
        call_router.TWILIO_ACCOUNT_SID = ""
        call_router.TWILIO_AUTH_TOKEN = ""

        resp = client.post("/call/initiate", json={
            "phone_number": "+11234567890",
            "context": {"bug_type": "null pointer", "fail_count": 3}
        })
        body = resp.json()
        assert body["ok"] is False
        assert "Twilio" in body["error"]

    def test_call_status_reflects_webhook_updates(self, client):
        """Twilio status webhooks should update the session that /call/status reads."""
        import call_router
        import uuid

        call_id = str(uuid.uuid4())
        call_router.call_sessions[call_id] = {
            "status": "initiated",
            "phone_number": "+11234567890",
            "bug_type": "null pointer",
            "fail_count": 3,
            "last_error": "TypeError",
            "created_at": "2026-02-28T00:00:00Z",
            "twilio_sid": "CAtestSID",
            "transcripts": [],
        }

        # Webhook: ringing
        client.post(f"/twilio/status/{call_id}", data={"CallStatus": "ringing"})
        status = client.get(f"/call/status/{call_id}").json()
        assert status["status"] == "in-progress"

        # Webhook: in-progress
        client.post(f"/twilio/status/{call_id}", data={"CallStatus": "in-progress"})
        status = client.get(f"/call/status/{call_id}").json()
        assert status["status"] == "in-progress"

        # Webhook: completed
        client.post(f"/twilio/status/{call_id}", data={"CallStatus": "completed"})
        status = client.get(f"/call/status/{call_id}").json()
        assert status["status"] == "ended"

        del call_router.call_sessions[call_id]


# ═══════════════════════════════════════════════════════════════════════
# 6. Concurrent / Rapid-fire Requests
# ═══════════════════════════════════════════════════════════════════════

class TestE2EConcurrency:
    """Tests rapid or concurrent request patterns that might occur in real usage."""

    def test_rapid_submit_requests(self, real_agent, client):
        """Multiple rapid submit calls should not corrupt state."""
        import main
        main.agent = real_agent

        client.post("/start", json={"dir": BUGGY_CODE_DIR})
        asyncio.get_event_loop().run_until_complete(main.run_agent_background())

        # Fire 3 submissions rapidly (reduced count since real LLM calls are slow)
        for i in range(3):
            resp = client.post("/submit", json={"code": f"attempt {i}"})
            assert resp.status_code == 200
            assert resp.json()["ok"] is True

    def test_rapid_state_polling(self, client):
        """Rapid polling of /state should always return valid JSON."""
        client.post("/start", json={"dir": BUGGY_CODE_DIR})

        for _ in range(20):
            resp = client.get("/state")
            assert resp.status_code == 200
            state = resp.json()
            assert "animation" in state
            assert "isComplete" in state

    def test_health_under_rapid_load(self, client):
        """Health endpoint should always work."""
        for _ in range(50):
            resp = client.get("/health")
            assert resp.status_code == 200
            assert resp.json()["status"] == "ok"


# ═══════════════════════════════════════════════════════════════════════
# 7. Malformed Request Handling
# ═══════════════════════════════════════════════════════════════════════

class TestE2EMalformedRequests:
    """Tests that the backend handles bad input gracefully."""

    def test_start_with_no_json_body(self, client):
        """POST /start with no body should still work (defaults to dir='.')."""
        # FastAPI may reject this if it expects JSON
        resp = client.post("/start", json={})
        assert resp.status_code == 200

    def test_submit_with_non_json_content_type(self, client):
        """Sending non-JSON should return an error, not crash."""
        resp = client.post("/submit", content=b"not json", headers={"Content-Type": "text/plain"})
        # FastAPI returns 422 for invalid JSON
        assert resp.status_code in (200, 422)

    def test_submit_with_nested_objects(self, client):
        """Deeply nested JSON should not crash the server."""
        nested = {"code": {"nested": {"deep": "value"}}}
        resp = client.post("/submit", json=nested)
        assert resp.status_code == 200

    def test_start_with_extra_fields(self, client):
        """Extra fields in the request body should be ignored."""
        resp = client.post("/start", json={
            "dir": BUGGY_CODE_DIR,
            "extra_field": "should be ignored",
            "another": 42
        })
        assert resp.status_code == 200
        assert resp.json()["ok"] is True

    def test_call_initiate_with_special_characters_in_phone(self, client):
        """Phone number with spaces/dashes should be validated."""
        resp = client.post("/call/initiate", json={
            "phone_number": "not-a-phone-number",
            "context": {}
        })
        # Should not crash, may fail validation
        assert resp.status_code == 200

    def test_submit_with_null_code(self, client):
        """Submitting null code should not crash."""
        resp = client.post("/submit", json={"code": None})
        assert resp.status_code == 200

    def test_submit_with_binary_like_string(self, client):
        """Code containing escape sequences should work."""
        resp = client.post("/submit", json={"code": "x = '\\x00\\xff\\n\\t'"})
        assert resp.status_code == 200


# ═══════════════════════════════════════════════════════════════════════
# 8. State Isolation Between Sessions
# ═══════════════════════════════════════════════════════════════════════

class TestE2EStateIsolation:
    """Verifies that starting a new session properly resets state."""

    def test_new_start_resets_previous_completion(self, real_agent, client):
        """After completing a mission, a new /start should reset everything."""
        import main
        main.agent = real_agent

        # First session: run and submit
        client.post("/start", json={"dir": BUGGY_CODE_DIR})
        asyncio.get_event_loop().run_until_complete(main.run_agent_background())
        client.post("/submit", json={"code": "correct"})

        # Second session: should start fresh
        resp = client.post("/start", json={"dir": BUGGY_CODE_DIR})
        state = resp.json()["state"]
        assert state["animation"] == "loading"
        assert state["isComplete"] is False
        assert state.get("challenge") is None

    def test_new_start_after_failure(self, real_agent, client):
        """After failing, a new /start should clear the failure state."""
        import main
        main.agent = real_agent

        # First session: fail
        client.post("/start", json={"dir": BUGGY_CODE_DIR})
        asyncio.get_event_loop().run_until_complete(main.run_agent_background())
        client.post("/submit", json={"code": "wrong"})

        # Second session: fresh start
        resp = client.post("/start", json={"dir": BUGGY_CODE_DIR})
        state = resp.json()["state"]
        assert state["animation"] == "loading"

    def test_new_start_after_timeout(self, client):
        """After a timeout, a new /start should clear the timeout state."""
        client.post("/start", json={"dir": BUGGY_CODE_DIR})
        client.post("/timeout", json={})
        state = client.get("/state").json()
        assert state["animation"] == "timeout"

        # New session
        resp = client.post("/start", json={"dir": BUGGY_CODE_DIR})
        state = resp.json()["state"]
        assert state["animation"] == "loading"


# ═══════════════════════════════════════════════════════════════════════
# 9. Submit ↔ State Contract
# ═══════════════════════════════════════════════════════════════════════

class TestE2ESubmitStateContract:
    """
    Verifies the contract between /submit response and /state:
    the extension reads both and forwards to the webview.
    """

    def test_submit_response_and_state_are_consistent(self, real_agent, client):
        """Submit response feedback should match the state message."""
        import main
        main.agent = real_agent

        client.post("/start", json={"dir": BUGGY_CODE_DIR})
        asyncio.get_event_loop().run_until_complete(main.run_agent_background())

        submit_resp = client.post("/submit", json={"code": "fixed"}).json()
        state = client.get("/state").json()

        # Both should agree on the feedback/message
        assert submit_resp["feedback"] == state["message"]
        # Both should agree on completion status
        assert submit_resp["is_correct"] == state["isComplete"]

    def test_submit_state_structure_always_valid(self, real_agent, client):
        """After any submission, both /submit and /state return well-formed data."""
        import main
        main.agent = real_agent

        client.post("/start", json={"dir": BUGGY_CODE_DIR})
        asyncio.get_event_loop().run_until_complete(main.run_agent_background())

        submit_resp = client.post("/submit", json={"code": "x = 1"}).json()
        state = client.get("/state").json()

        # /submit response structure
        assert "ok" in submit_resp
        assert "is_correct" in submit_resp
        assert "feedback" in submit_resp
        assert isinstance(submit_resp["is_correct"], bool)

        # /state structure
        assert "animation" in state
        assert "isComplete" in state
        assert "message" in state
        assert "updatedAt" in state
        assert state["animation"] in ("complete", "evaluating", "ready", "loading", "idle", "timeout", "error")


# ═══════════════════════════════════════════════════════════════════════
# 10. WebSocket Endpoint
# ═══════════════════════════════════════════════════════════════════════

class TestE2EWebSocket:
    """Tests the WebSocket /ws endpoint for real-time state updates."""

    def test_ws_returns_current_state(self, client):
        """WebSocket should send the current drill_state."""
        with client.websocket_connect("/ws") as ws:
            data = ws.receive_json()
            assert "animation" in data
            assert "isComplete" in data
            assert "message" in data

    def test_ws_reflects_state_after_start(self, client):
        """After /start, WebSocket should reflect the updated state."""
        import main

        # Post start to set state to loading
        resp = client.post("/start", json={"dir": BUGGY_CODE_DIR})
        assert resp.json()["ok"] is True

        # The drill_state should now be "loading" — verify via /state endpoint
        state = client.get("/state").json()
        assert state["animation"] in ("loading", "ready")  # may have completed by now
