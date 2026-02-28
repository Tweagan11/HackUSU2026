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

# Load .env from the repo root (one level above code-sergeant/server/)
_env_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env')
load_dotenv(_env_path)

from call_router import router as call_router
from agent import Agent

app = FastAPI()
app.include_router(call_router)

agent = None
agent_run_params = {}

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


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/start")
async def start(data: dict, background_tasks: BackgroundTasks):
    global agent, agent_run_params

    # The extension sends { dir: "..." } with the workspace path.
    workspace_dir = data.get("dir") or data.get("workspace_dir") or "."
    print(f"[start] workspace_dir={workspace_dir}", flush=True)

    # Optional contact fields — can come from the request body or fall back to env vars
    agent_run_params = {
        "email": data.get("email") or os.getenv("RECRUIT_EMAIL", ""),
        "boss_email": data.get("boss_email") or os.getenv("BOSS_EMAIL", ""),
        "phone_number": data.get("phone_number") or os.getenv("RECRUIT_PHONE", ""),
    }
    print(f"[start] agent_run_params={agent_run_params}", flush=True)

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
        response = await agent.run(**agent_run_params)
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
    except Exception as e:
        print(f"[background] Agent error: {e}", flush=True)
        import traceback; traceback.print_exc()
        drill_state["animation"] = "error"
        drill_state["isComplete"] = False
        drill_state["message"] = f"Agent failed: {e}"
        drill_state["challenge"] = None
        drill_state["updatedAt"] = datetime.now(timezone.utc).isoformat()


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
    return {"ok": True, "is_correct": is_correct, "feedback": feedback, "state": drill_state}
  
@app.post("/timeout")
def timeout():
    punishment = random.choice(punishments)
    drill_state["animation"] = "timeout"
    drill_state["isComplete"] = False
    drill_state["message"] = "Time expired. Sergeant triggered punishment."
    drill_state["updatedAt"] = datetime.now(timezone.utc).isoformat()
    return {
        "ok": True,
        "message": "Time expired. Sergeant triggered punishment.",
        "punishment": punishment,
        "state": drill_state,
    }


@app.websocket("/ws")
async def ws_updates(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            await websocket.send_json(drill_state)
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        return


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

        print(f"[ngrok] Public URL: {public_url}", flush=True)
    except Exception as exc:
        print(f"[ngrok] Could not start tunnel: {exc}", flush=True)
        print("[ngrok] Falling back to PUBLIC_BASE_URL from .env (if set).", flush=True)

    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
    