import asyncio
import random
from datetime import datetime, timezone
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../agent'))
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, Body, BackgroundTasks
from fastapi.websockets import WebSocketDisconnect
import uvicorn
import json
from typing import Set

# Load .env from the repo root (one level above code-sergeant/server/)
_env_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env')
load_dotenv(_env_path)

from call_router import router as call_router
from agent import Agent

app = FastAPI()
app.include_router(call_router)

agent = None

# Ngrok tunnel state — populated at startup when running via __main__
ngrok_state: dict = {
    "running": False,
    "public_url": None,
    "port": None,
    "error": None,
}

workspace_files = {}
punishments = [
    "DROP AND GIVE ME 20 SEMICOLONS!",
    "YOU CALL THAT A LOOP, RECRUIT?",
    "THIS CODE WOULDN'T PASS BASIC TRAINING!",
    "YOUR NULL CHECK IS MISSING, SOLDIER!",
    "I'VE SEEN BETTER CODE FROM A CALCULATOR!",
    "DID YOUR CAT WRITE THIS?!",
    "THIS FUNCTION IS AWOL, RECRUIT!",
    "YOUR VARIABLE NAMES ARE A WAR CRIME!",
]
drill_state = {
    "animation": "idle",
    "successCriteria": 0,
    "isComplete": False,
    "message": "Awaiting submission",
    "updatedAt": None,
}

# Event-driven WebSocket push: notify clients instantly when state changes
state_changed: asyncio.Event = asyncio.Event()
connected_websockets: Set[WebSocket] = set()


async def broadcast_state():
    """Push current drill_state to all connected WebSocket clients immediately."""
    dead: list[WebSocket] = []
    for ws in connected_websockets:
        try:
            await ws.send_json(drill_state)
        except Exception:
            dead.append(ws)
    for ws in dead:
        connected_websockets.discard(ws)


def mark_state_changed():
    """Call after every drill_state mutation to wake WebSocket listeners."""
    state_changed.set()


@app.get("/health")
def health():
    return {
        "status": "ok",
        "port": ngrok_state["port"],
        "ngrok": {
            "running": ngrok_state["running"],
            "public_url": ngrok_state["public_url"],
            "error": ngrok_state["error"],
        },
    }


@app.get("/ngrok-status")
def ngrok_status():
    """Quick check on ngrok tunnel health."""
    return ngrok_state


@app.post("/start")
async def start(data: dict, background_tasks: BackgroundTasks):
    global agent

    # The extension sends { dir: "..." } with the workspace path.
    workspace_dir = data.get("dir") or data.get("workspace_dir") or "."
    print(f"[start] workspace_dir={workspace_dir}", flush=True)

    try:
        agent = Agent(workspace_dir)
    except Exception as e:
        print(f"[start] Agent init error: {e}", flush=True)
        import traceback; traceback.print_exc()
        return {"ok": False, "error": str(e), "state": drill_state}

    # Mark loading state and return immediately
    drill_state["animation"] = "loading"
    drill_state["isComplete"] = False
    drill_state["message"] = "Sergeant is analyzing your code..."
    drill_state["challenge"] = None
    drill_state["updatedAt"] = datetime.now(timezone.utc).isoformat()
    mark_state_changed()

    # Run the agent in the background — challenge will appear in drill_state
    background_tasks.add_task(run_agent_background)

    return {
        "ok": True,
        "state": drill_state,
    }


async def run_agent_background():
    """Runs agent.run() in the background and updates drill_state when done."""
    global agent
    try:
        response = await agent.run()
        code_challenge = response.get("challenge")
        print(f"[background] challenge={code_challenge}", flush=True)

        challenge_data = None
        if code_challenge:
            challenge_data = code_challenge.model_dump() if hasattr(code_challenge, 'model_dump') else code_challenge

        drill_state["animation"] = "ready"
        drill_state["isComplete"] = False
        drill_state["message"] = "New drill initialized"
        drill_state["challenge"] = challenge_data
        drill_state["updatedAt"] = datetime.now(timezone.utc).isoformat()
        mark_state_changed()
        await broadcast_state()  # Push challenge to clients immediately
    except Exception as e:
        print(f"[background] Agent error: {e}", flush=True)
        import traceback; traceback.print_exc()
        drill_state["animation"] = "error"
        drill_state["isComplete"] = False
        drill_state["message"] = f"Agent failed: {e}"
        drill_state["challenge"] = None
        drill_state["updatedAt"] = datetime.now(timezone.utc).isoformat()
        mark_state_changed()
        await broadcast_state()  # Push error to clients immediately


@app.get("/state")
def get_state():
    """Returns the current drill state, including challenge when ready."""
    return drill_state


@app.post("/submit")
async def submit(data: dict):
    global agent
    text = str(data.get("response") or data.get("code") or "")
    print(f"[submit] {text}", flush=True)

    is_correct = False
    feedback = "No active agent session."

    if agent:
        try:
            result = await agent.resume(text)
            grade = result.get("grade")
            print(f"[submit] grade={grade}", flush=True)
            # grade is a GradeResult pydantic model (passed: bool, feedback: str)
            if hasattr(grade, "passed"):
                is_correct = grade.passed
                feedback = grade.feedback
            elif isinstance(grade, dict):
                is_correct = grade.get("passed", False)
                feedback = grade.get("feedback", str(grade))
            else:
                feedback = str(grade) if grade else "Unable to grade submission."
        except Exception as e:
            print(f"[submit] Agent error: {e}", flush=True)
            import traceback; traceback.print_exc()
            feedback = f"Grading error: {e}"
    
    drill_state["successCriteria"] = 100 if is_correct else 0
    drill_state["isComplete"] = bool(is_correct)
    drill_state["animation"] = "complete" if is_correct else "evaluating"
    drill_state["message"] = feedback
    drill_state["updatedAt"] = datetime.now(timezone.utc).isoformat()
    mark_state_changed()
    await broadcast_state()
    return {"ok": True, "is_correct": is_correct, "feedback": feedback, "state": drill_state}
  
@app.post("/timeout")
async def timeout():
    punishment = random.choice(punishments)
    drill_state["animation"] = "timeout"
    drill_state["isComplete"] = False
    drill_state["message"] = "Time expired. Sergeant triggered punishment."
    drill_state["updatedAt"] = datetime.now(timezone.utc).isoformat()
    mark_state_changed()
    await broadcast_state()
    return {
        "ok": True,
        "message": "Time expired. Sergeant triggered punishment.",
        "punishment": punishment,
        "state": drill_state,
    }


@app.websocket("/ws")
async def ws_updates(websocket: WebSocket):
    await websocket.accept()
    connected_websockets.add(websocket)
    try:
        # Send current state immediately on connect
        await websocket.send_json(drill_state)
        while True:
            # Wait for state to change (event-driven, no polling)
            await state_changed.wait()
            state_changed.clear()
            await websocket.send_json(drill_state)
    except WebSocketDisconnect:
        pass
    finally:
        connected_websockets.discard(websocket)


if __name__ == "__main__":
    port = int(os.getenv("CODE_SERGEANT_PORT", "8000"))

    # Open an ngrok tunnel so Twilio webhooks can reach this local server
    try:
        from pyngrok import ngrok

        # If you have a reserved domain, pass it here; otherwise ngrok assigns one.
        ngrok_domain = os.getenv("NGROK_DOMAIN")  # e.g. "solange-unreminded-northward.ngrok-free.dev"
        options = {"bind_tls": True}
        if ngrok_domain:
            options["hostname"] = ngrok_domain

        tunnel = ngrok.connect(port, "http", **options)
        public_url = tunnel.public_url

        # Propagate the URL to call_router at runtime
        import call_router as _cr
        _cr.PUBLIC_BASE_URL = public_url
        os.environ["PUBLIC_BASE_URL"] = public_url

        # Update module-level ngrok state so /health and /ngrok-status can report it
        ngrok_state["running"] = True
        ngrok_state["public_url"] = public_url
        ngrok_state["port"] = port
        ngrok_state["error"] = None

        print(f"[ngrok] Public URL: {public_url}", flush=True)
        print(f"[ngrok] Forwarding to port: {port}", flush=True)
    except Exception as exc:
        ngrok_state["running"] = False
        ngrok_state["public_url"] = None
        ngrok_state["port"] = port
        ngrok_state["error"] = str(exc)

        print(f"[ngrok] Could not start tunnel: {exc}", flush=True)
        print("[ngrok] Falling back to PUBLIC_BASE_URL from .env (if set).", flush=True)

    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
