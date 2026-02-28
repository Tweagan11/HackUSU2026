"""
Shared pytest fixtures for the Code Sergeant integration test suite.

Provides:
  - A FastAPI TestClient for synchronous endpoint tests
  - An httpx AsyncClient for async endpoint tests
  - A real Agent instance backed by the buggy_code/ workspace
  - Utilities for resetting global server state between tests

No mocks — every test exercises the real Agent, real LLM calls, and
real vector-store operations against OpenAI + ChromaDB.
"""

import sys
import os
import asyncio

import pytest

# ---------------------------------------------------------------------------
# Ensure the server directory and agent directory are on sys.path
# ---------------------------------------------------------------------------
_server_dir = os.path.join(os.path.dirname(__file__), "..")
_agent_dir = os.path.join(os.path.dirname(__file__), "..", "..", "agent")
sys.path.insert(0, _server_dir)
sys.path.insert(0, _agent_dir)

# Import the real Agent (will pull in langchain, chromadb, openai, etc.)
from tests.helpers import Agent, BUGGY_CODE_DIR  # noqa: E402

# Now import main (which does `from agent import Agent` internally)
import main  # noqa: E402


# ---------------------------------------------------------------------------
# Session-scoped real Agent — built once, reused across every test
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def real_agent():
    """
    Create a single real Agent that points at buggy_code/.
    This calls build_vector_store() and initialises the LangGraph once,
    so we don't pay the setup cost per test.
    """
    return Agent(BUGGY_CODE_DIR)


@pytest.fixture(autouse=True)
def _reset_server_state():
    """Reset the global drill_state and agent before each test."""
    main.drill_state.clear()
    main.drill_state.update({
        "animation": "idle",
        "successCriteria": 0,
        "isComplete": False,
        "message": "Awaiting submission",
        "updatedAt": None,
    })
    main.agent = None
    # Also reset call_router sessions
    from call_router import call_sessions
    call_sessions.clear()
    yield


@pytest.fixture()
def client():
    """Synchronous TestClient for the FastAPI app."""
    from fastapi.testclient import TestClient
    return TestClient(main.app)


@pytest.fixture()
async def async_client():
    """Async httpx client for the FastAPI app."""
    from httpx import AsyncClient, ASGITransport
    transport = ASGITransport(app=main.app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac

