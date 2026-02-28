"""
Shared test helpers for the Code Sergeant integration test suite.

This module provides the REAL Agent from the agent package.
No mocks — tests exercise the full backend including LLM calls.
"""

import os
import sys

# Ensure agent package is importable
_agent_dir = os.path.join(os.path.dirname(__file__), "..", "..", "agent")
if _agent_dir not in sys.path:
    sys.path.insert(0, _agent_dir)

from agent import Agent  # noqa: E402

# Path to the buggy_code directory used as the workspace for Agent
BUGGY_CODE_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "buggy_code")
)
