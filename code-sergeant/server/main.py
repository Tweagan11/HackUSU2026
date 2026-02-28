import asyncio
import random
from datetime import datetime
import os
import uuid
from fastapi import FastAPI, WebSocket, Request
from fastapi.websockets import WebSocketDisconnect

from twilio.rest import Client as TwilioClient
from twilio.twiml.voice_response import VoiceResponse, Gather
from elevenlabs.client import ElevenLabs

# ── API Keys & Config ──────────────────────────────────────────────
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "")

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER", "")  # Your Twilio number (E.164)

# Public URL where Twilio can reach this server for webhooks (e.g. ngrok)
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "")

# ── Sergeant persona (used for TTS messages) ───────────────────────
SERGEANT_SYSTEM_PROMPT = """You are Sergeant Debugger, a comedic drill sergeant who evaluates buggy code over the phone.

Your personality rules:
- Speak in short, barking military commands (1-3 sentences max)
- Reference coding bugs as "threats", "hostiles", and "live grenades"
- Be simultaneously intimidating and encouraging
- Use military metaphors for programming concepts
- Never break character — you ARE the sergeant

Context about the recruit's current mission:
Bug type: {bug_type}
Fail count: {fail_count}
Last error: {last_error}

Your job: Drill them on their mistake, give them a hint disguised as a military order, and motivate them to fix it. Keep it SHORT — you're on a phone call, not writing documentation."""

SERGEANT_FIRST_MESSAGE = (
    "LISTEN UP RECRUIT! This is Sergeant Debugger reporting for duty. "
    "I see you've been having trouble with that {bug_type}. "
    "You better have a GOOD explanation, soldier!"
)

call_sessions: dict[str, dict] = {}

app = FastAPI()
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
    global workspace_files
    workspace_files = data["files"]
    drill_state["animation"] = "ready"
    drill_state["successCriteria"] = 0
    drill_state["isComplete"] = False
    drill_state["message"] = "New drill initialized"
    drill_state["updatedAt"] = datetime.utcnow().isoformat()
    return {"ok":True, "state": drill_state}


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


# ═══════════════════════════════════════════════════════════════════
# TWILIO + ELEVENLABS PHONE CALL SYSTEM
# ═══════════════════════════════════════════════════════════════════
#
# Flow:
#   1. Front-end sends CALL_SERGEANT → extension → POST /call/initiate
#   2. Backend uses Twilio REST API to initiate an outbound call
#   3. Twilio fetches TwiML from our /twilio/voice/<call_id> webhook
#   4. The TwiML plays ElevenLabs-generated audio (the sergeant's greeting)
#      and uses <Gather> to capture the user's speech
#   5. User speech is sent to /twilio/gather/<call_id> as SpeechResult
#   6. We could feed that into an LLM for a response (future enhancement)
#   7. Twilio status callbacks hit /twilio/status/<call_id>
#   8. GET /call/status/<id> lets the extension poll the call state
#
# ═══════════════════════════════════════════════════════════════════

# Lazy-init Twilio client
_twilio_client: TwilioClient | None = None


def get_twilio_client() -> TwilioClient:
    global _twilio_client
    if _twilio_client is None:
        _twilio_client = TwilioClient(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    return _twilio_client


@app.post("/call/initiate")
def initiate_call(data: dict):
    """
    Initiate a phone call from Sergeant Debugger to the user via Twilio.

    Expected payload:
      {
        "phone_number": "+11234567890",
        "context": {
          "bug_type": "null pointer",
          "fail_count": 3,
          "last_error": "TypeError: Cannot read property 'name' of null"
        }
      }
    """
    phone_number = data.get("phone_number", "").strip()
    if not phone_number:
        return {"ok": False, "error": "phone_number is required"}

    if not TWILIO_ACCOUNT_SID or not TWILIO_AUTH_TOKEN:
        return {"ok": False, "error": "Twilio credentials not configured on server"}

    if not TWILIO_PHONE_NUMBER:
        return {"ok": False, "error": "TWILIO_PHONE_NUMBER not configured on server"}

    if not PUBLIC_BASE_URL:
        return {"ok": False, "error": "PUBLIC_BASE_URL not configured (needed for Twilio webhooks)"}

    context = data.get("context", {})
    bug_type = context.get("bug_type", "unknown bug")
    fail_count = context.get("fail_count", 0)
    last_error = context.get("last_error", "N/A")

    # Generate a local call ID so we can track state before Twilio assigns one
    call_id = str(uuid.uuid4())

    call_sessions[call_id] = {
        "status": "initiated",
        "phone_number": phone_number,
        "bug_type": bug_type,
        "fail_count": fail_count,
        "last_error": last_error,
        "created_at": datetime.utcnow().isoformat(),
        "twilio_sid": None,
        "transcripts": [],
    }

    try:
        client = get_twilio_client()
        twilio_call = client.calls.create(
            to=phone_number,
            from_=TWILIO_PHONE_NUMBER,
            url=f"{PUBLIC_BASE_URL}/twilio/voice/{call_id}",
            status_callback=f"{PUBLIC_BASE_URL}/twilio/status/{call_id}",
            status_callback_event=["initiated", "ringing", "answered", "completed"],
            status_callback_method="POST",
        )
        call_sessions[call_id]["twilio_sid"] = twilio_call.sid
        print(f"[call/initiate] Call {call_id} (SID={twilio_call.sid}) initiated to {phone_number}", flush=True)
        return {"ok": True, "call_id": call_id, "status": "initiated"}

    except Exception as e:
        print(f"[call/initiate] Twilio error: {e}", flush=True)
        call_sessions[call_id]["status"] = "error"
        return {"ok": False, "error": f"Twilio error: {str(e)}"}


@app.get("/call/status/{call_id}")
def call_status(call_id: str):
    """Poll the status of an active call."""
    session = call_sessions.get(call_id)
    if not session:
        return {"ok": False, "error": "Call not found"}
    return {"ok": True, "call_id": call_id, **session}


# ── Twilio Webhooks ────────────────────────────────────────────────


@app.post("/twilio/voice/{call_id}")
@app.get("/twilio/voice/{call_id}")
async def twilio_voice(call_id: str):
    """
    Twilio fetches this URL when the call connects.
    Returns TwiML that plays the sergeant's greeting (via ElevenLabs TTS)
    and gathers the user's speech response.
    """
    session = call_sessions.get(call_id, {})
    bug_type = session.get("bug_type", "unknown bug")

    greeting = SERGEANT_FIRST_MESSAGE.format(bug_type=bug_type)

    response = VoiceResponse()

    # Try to generate ElevenLabs audio for higher quality voice
    audio_url = _generate_tts_url(greeting, call_id)
    if audio_url:
        gather = Gather(
            input="speech",
            action=f"{PUBLIC_BASE_URL}/twilio/gather/{call_id}",
            method="POST",
            timeout=10,
            speech_timeout="auto",
        )
        gather.play(audio_url)
        response.append(gather)
    else:
        # Fallback to Twilio's built-in TTS
        gather = Gather(
            input="speech",
            action=f"{PUBLIC_BASE_URL}/twilio/gather/{call_id}",
            method="POST",
            timeout=10,
            speech_timeout="auto",
        )
        gather.say(greeting, voice="Polly.Matthew", language="en-US")
        response.append(gather)

    # If no speech gathered, say goodbye
    response.say(
        "No response detected. Sergeant Debugger OUT. Get back to your code, recruit!",
        voice="Polly.Matthew",
    )

    if call_id in call_sessions:
        call_sessions[call_id]["status"] = "in-progress"

    return _twiml_response(str(response))


@app.post("/twilio/gather/{call_id}")
async def twilio_gather(call_id: str, req: Request):
    """
    Receives the user's speech transcription from Twilio's <Gather>.
    Stores it and responds with a follow-up sergeant message.
    """
    form = await req.form()
    speech_result = form.get("SpeechResult", "")

    print(f"[twilio/gather] call={call_id} speech={speech_result}", flush=True)

    if call_id in call_sessions:
        call_sessions[call_id].setdefault("transcripts", []).append(
            {"role": "user", "text": str(speech_result)}
        )

    # Generate a drill-sergeant follow-up
    session = call_sessions.get(call_id, {})
    follow_up = _generate_sergeant_followup(str(speech_result), session)

    response = VoiceResponse()

    audio_url = _generate_tts_url(follow_up, f"{call_id}-reply")
    if audio_url:
        response.play(audio_url)
    else:
        response.say(follow_up, voice="Polly.Matthew", language="en-US")

    response.say(
        "Sergeant Debugger OUT. Now get back to your code, recruit!",
        voice="Polly.Matthew",
    )

    if call_id in call_sessions:
        call_sessions[call_id].setdefault("transcripts", []).append(
            {"role": "sergeant", "text": follow_up}
        )

    return _twiml_response(str(response))


@app.post("/twilio/status/{call_id}")
async def twilio_status(call_id: str, req: Request):
    """
    Twilio sends call status updates here.
    Maps Twilio statuses to our internal call states.
    """
    form = await req.form()
    call_status_value = form.get("CallStatus", "")

    print(f"[twilio/status] call={call_id} status={call_status_value}", flush=True)

    if call_id in call_sessions:
        if call_status_value in ("completed", "busy", "no-answer", "canceled", "failed"):
            call_sessions[call_id]["status"] = "ended"
            call_sessions[call_id]["ended_at"] = datetime.utcnow().isoformat()
            call_sessions[call_id]["twilio_status"] = str(call_status_value)
        elif call_status_value in ("in-progress", "ringing"):
            call_sessions[call_id]["status"] = "in-progress"
        elif call_status_value == "initiated":
            call_sessions[call_id]["status"] = "initiated"

    return {"ok": True}


# ── TTS & response helpers ─────────────────────────────────────────

# In-memory cache for generated audio URLs (call_id → URL)
_tts_audio_cache: dict[str, str] = {}


def _generate_tts_url(text: str, cache_key: str) -> str | None:
    """
    Generate speech via ElevenLabs and return a publicly-accessible URL.
    For production you'd upload to S3/GCS; here we serve it from memory
    via a local endpoint.
    """
    if cache_key in _tts_audio_cache:
        return _tts_audio_cache[cache_key]

    if not ELEVENLABS_API_KEY or not VOICE_ID:
        return None

    try:
        audio_bytes = text_to_speech(text)
        # Store audio in memory and serve via our own endpoint
        _tts_audio_store[cache_key] = audio_bytes
        url = f"{PUBLIC_BASE_URL}/audio/{cache_key}"
        _tts_audio_cache[cache_key] = url
        return url
    except Exception as e:
        print(f"[tts] ElevenLabs error: {e}", flush=True)
        return None


# In-memory audio store
_tts_audio_store: dict[str, bytes] = {}


@app.get("/audio/{audio_id}")
async def serve_audio(audio_id: str):
    """Serve generated TTS audio to Twilio."""
    from starlette.responses import Response

    audio = _tts_audio_store.get(audio_id)
    if not audio:
        return Response(status_code=404, content="Not found")
    return Response(content=audio, media_type="audio/mpeg")


def _generate_sergeant_followup(user_speech: str, session: dict) -> str:
    """
    Generate a sergeant-style follow-up based on the user's speech.
    Currently uses templated responses. Could be replaced with an LLM call.
    """
    if not user_speech.strip():
        return "SILENCE?! That's not an answer, recruit! Drop and give me 20!"

    followups = [
        f"You said '{user_speech}'?! That's the best excuse you've got, recruit?!",
        f"'{user_speech}'... I've heard better explanations from a rubber duck!",
        f"Is that code-speak for 'I have no idea', recruit?! '{user_speech}' means NOTHING to me!",
        f"'{user_speech}'?! In MY army, we FIX bugs, we don't TALK to them!",
        f"Roger that, recruit. '{user_speech}'. Now translate that into WORKING CODE!",
    ]
    return random.choice(followups)


def _twiml_response(twiml: str):
    """Return a TwiML XML response with the correct content type."""
    from starlette.responses import Response

    return Response(content=twiml, media_type="application/xml")


def text_to_speech(text: str) -> bytes:
    """Generate speech audio via ElevenLabs REST API. Returns MP3 bytes."""
    import requests as http_requests

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"
    headers = {
        "xi-api-key": ELEVENLABS_API_KEY or "",
        "Content-Type": "application/json",
    }
    body = {
        "text": text,
        "voice_settings": {
            "stability": 0.4,
            "similarity_boost": 0.8,
            "style": 0.7,
            "use_speaker_boost": True,
        },
    }
    response = http_requests.post(url, headers=headers, json=body)
    response.raise_for_status()
    return response.content  # MP3 bytes


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("CODE_SERGEANT_PORT", "8000"))
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
