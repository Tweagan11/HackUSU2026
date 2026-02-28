import asyncio
import random
from datetime import datetime
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../agent'))
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, Body
from fastapi.websockets import WebSocketDisconnect
import uvicorn
import json

load_dotenv()

from call_router import router as call_router
from agent import Agent

app = FastAPI()
app.include_router(call_router)

agent = None

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
def start(data: dict):

    path = data["workspace_dir"]
    print(path)

    agent = Agent(path)

    response = agent.run()

    code_challenge = response.get("challenge")
    print(code_challenge)
    
    return {"ok":True, "state": code_challenge}


@app.post("/submit")
def submit(data: dict):
    text = str(data.get("response") or data.get("code") or "")
    print(f"[submit] {text}", flush=True)
    is_correct = False #TODO: Change later to check if it is correct with the agent
    drill_state["successCriteria"] = 100 if is_correct else 0
    drill_state["isComplete"] = bool(is_correct)
    drill_state["animation"] = "complete" if drill_state["isComplete"] else "evaluating"
    drill_state["message"] = "Mission complete" if drill_state["isComplete"] else "Keep iterating"
    drill_state["updatedAt"] = datetime.utcnow().isoformat()
    return {"ok": True, "state": drill_state}
  
@app.post("/timeout")
def timeout():
    punishment = random.choice(punishments)
    drill_state["animation"] = "timeout"
    drill_state["isComplete"] = False
    drill_state["message"] = "Time expired. Sergeant triggered punishment."
    drill_state["updatedAt"] = datetime.utcnow().isoformat()
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
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
