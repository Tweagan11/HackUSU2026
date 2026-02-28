"""
Twilio + ElevenLabs phone-call routes for Sergeant Debugger.

All call-related endpoints live here and are mounted as an APIRouter
on the main FastAPI app.
"""

import os
import random
import uuid
from datetime import datetime, UTC

from fastapi import APIRouter, Request
from starlette.responses import Response

from twilio.rest import Client as TwilioClient
from twilio.twiml.voice_response import VoiceResponse, Gather

from langchain.chat_models import init_chat_model
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

# ── Config (loaded from environment) ───────────────────────────────
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "")

# Maximum number of sergeant responses *after* the greeting before hanging up
MAX_CONVERSATION_TURNS = 2

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER", "")

PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "")

# ── Sergeant persona ───────────────────────────────────────────────
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

# ── In-memory state ────────────────────────────────────────────────
call_sessions: dict[str, dict] = {}

_tts_audio_cache: dict[str, str] = {}
_tts_audio_store: dict[str, bytes] = {}

# Lazy Twilio client
_twilio_client: TwilioClient | None = None

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════

def get_twilio_client() -> TwilioClient:
    global _twilio_client
    if _twilio_client is None:
        _twilio_client = TwilioClient(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    return _twilio_client


def _twiml_response(twiml: str) -> Response:
    """Return a TwiML XML response with the correct content type."""
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
        "model_id": "eleven_turbo_v2",
        "voice_settings": {
            "stability": 0.4,
            "similarity_boost": 0.8,
            "style": 0.7,
            "use_speaker_boost": True,
        },
    }
    resp = http_requests.post(url, headers=headers, json=body)
    resp.raise_for_status()
    return resp.content  # MP3 bytes


def _generate_tts_url(text: str, cache_key: str) -> str | None:
    """
    Generate speech via ElevenLabs and return a publicly-accessible URL.
    Audio is stored in memory and served from /audio/<id>.
    """
    if cache_key in _tts_audio_cache:
        return _tts_audio_cache[cache_key]

    if not ELEVENLABS_API_KEY or not VOICE_ID:
        return None

    try:
        audio_bytes = text_to_speech(text)
        _tts_audio_store[cache_key] = audio_bytes
        url = f"{PUBLIC_BASE_URL}/audio/{cache_key}"
        _tts_audio_cache[cache_key] = url
        return url
    except Exception as e:
        print(f"[tts] ElevenLabs error: {e}", flush=True)
        return None


# Lazy LLM for conversational calls
_call_llm = None

def _get_call_llm():
    """Lazy-init a lightweight model used only for phone-call dialogue."""
    global _call_llm
    if _call_llm is None:
        _call_llm = init_chat_model("openai:gpt-4.1-mini")
    return _call_llm


def _generate_sergeant_followup(user_speech: str, session: dict) -> str:
    """
    Generate a sergeant-style follow-up by feeding the full conversation
    history into the LLM so the call feels like a real back-and-forth.
    """
    if not user_speech.strip():
        return "SILENCE?! That's not an answer, recruit! Drop and give me 20!"

    bug_type = session.get("bug_type", "unknown bug")
    fail_count = session.get("fail_count", 0)
    last_error = session.get("last_error", "N/A")
    turn = session.get("turn", 1)
    is_final = turn >= MAX_CONVERSATION_TURNS

    # Build message history from stored transcripts
    messages: list = [
        SystemMessage(content=SERGEANT_SYSTEM_PROMPT.format(
            bug_type=bug_type,
            fail_count=fail_count,
            last_error=last_error,
        ) + (
            "\n\nThis is your FINAL response on the call. Wrap it up with a commanding "
            "sign-off and order the recruit back to their code."
            if is_final else
            "\n\nKeep the conversation going — challenge the recruit's answer, "
            "ask a pointed follow-up question, or demand they explain their reasoning. "
            "Stay in character. Keep it to 1-3 sentences."
        )),
    ]

    for entry in session.get("transcripts", []):
        if entry["role"] == "user":
            messages.append(HumanMessage(content=entry["text"]))
        else:
            messages.append(AIMessage(content=entry["text"]))

    # Append the latest user utterance
    messages.append(HumanMessage(content=user_speech))

    try:
        llm = _get_call_llm()
        response = llm.invoke(messages)
        return response.content
    except Exception as e:
        print(f"[followup-llm] Error: {e}", flush=True)
        # Graceful fallback
        return f"{user_speech}?! That's the best you've got, recruit?! Get back to your code!"


# ═══════════════════════════════════════════════════════════════════
# Call initiation & status
# ═══════════════════════════════════════════════════════════════════

@router.post("/call/initiate")
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

    call_id = str(uuid.uuid4())

    call_sessions[call_id] = {
        "status": "initiated",
        "phone_number": phone_number,
        "bug_type": bug_type,
        "fail_count": fail_count,
        "last_error": last_error,
        "created_at": datetime.now(UTC).isoformat(),
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


@router.get("/call/status/{call_id}")
def get_call_status(call_id: str):
    """Poll the status of an active call."""
    session = call_sessions.get(call_id)
    if not session:
        return {"ok": False, "error": "Call not found"}
    return {"ok": True, "call_id": call_id, **session}


# ═══════════════════════════════════════════════════════════════════
# Twilio Webhooks
# ═══════════════════════════════════════════════════════════════════

@router.post("/twilio/voice/{call_id}")
@router.get("/twilio/voice/{call_id}")
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
        gather = Gather(
            input="speech",
            action=f"{PUBLIC_BASE_URL}/twilio/gather/{call_id}",
            method="POST",
            timeout=10,
            speech_timeout="auto",
        )
        gather.say(greeting, voice="Polly.Matthew", language="en-US")
        response.append(gather)

    response.say(
        "No response detected. Sergeant Debugger OUT. Get back to your code, recruit!",
        voice="Polly.Matthew",
    )

    if call_id in call_sessions:
        call_sessions[call_id]["status"] = "in-progress"

    return _twiml_response(str(response))


@router.post("/twilio/gather/{call_id}")
async def twilio_gather(call_id: str, req: Request):
    """
    Receives the user's speech transcription from Twilio's <Gather>.
    Feeds it through the LLM and either continues the conversation
    (another Gather) or ends the call once MAX_CONVERSATION_TURNS is reached.
    """
    form = await req.form()
    speech_result = form.get("SpeechResult", "")

    print(f"[twilio/gather] call={call_id} speech={speech_result}", flush=True)

    session = call_sessions.get(call_id, {})

    # Track which conversation turn we're on (1-indexed, after the greeting)
    turn = session.get("turn", 0) + 1
    if call_id in call_sessions:
        call_sessions[call_id]["turn"] = turn
        call_sessions[call_id].setdefault("transcripts", []).append(
            {"role": "user", "text": str(speech_result)}
        )

    # Generate an LLM-powered sergeant response
    follow_up = _generate_sergeant_followup(str(speech_result), call_sessions.get(call_id, session))

    # Store sergeant reply in transcript
    if call_id in call_sessions:
        call_sessions[call_id].setdefault("transcripts", []).append(
            {"role": "sergeant", "text": follow_up}
        )

    # Unique TTS cache key per turn so audio files don't collide
    tts_key = f"{call_id}-reply-{turn}"
    audio_url = _generate_tts_url(follow_up, tts_key)

    response = VoiceResponse()

    if turn < MAX_CONVERSATION_TURNS:
        # Continue the conversation: play the response inside another <Gather>
        gather = Gather(
            input="speech",
            action=f"{PUBLIC_BASE_URL}/twilio/gather/{call_id}",
            method="POST",
            timeout=10,
            speech_timeout="auto",
        )
        if audio_url:
            gather.play(audio_url)
        else:
            gather.say(follow_up, voice="Polly.Matthew", language="en-US")
        response.append(gather)

        # Fallback if user stays silent after this turn
        response.say(
            "No response detected. Speak up or I'm hanging up, recruit!",
            voice="Polly.Matthew",
        )
    else:
        # Final turn — play the response and sign off
        if audio_url:
            response.play(audio_url)
        else:
            response.say(follow_up, voice="Polly.Matthew", language="en-US")

        response.say(
            "Sergeant Debugger OUT. Now get back to your code, recruit!",
            voice="Polly.Matthew",
        )

    print(f"[twilio/gather] call={call_id} turn={turn}/{MAX_CONVERSATION_TURNS}", flush=True)
    return _twiml_response(str(response))


@router.post("/twilio/status/{call_id}")
async def twilio_status(call_id: str, req: Request):
    """
    Twilio sends call status updates here.
    """
    form = await req.form()
    call_status_value = form.get("CallStatus", "")

    print(f"[twilio/status] call={call_id} status={call_status_value}", flush=True)

    if call_id in call_sessions:
        if call_status_value in ("completed", "busy", "no-answer", "canceled", "failed"):
            call_sessions[call_id]["status"] = "ended"
            call_sessions[call_id]["ended_at"] = datetime.now(UTC).isoformat()
            call_sessions[call_id]["twilio_status"] = str(call_status_value)
        elif call_status_value in ("in-progress", "ringing"):
            call_sessions[call_id]["status"] = "in-progress"
        elif call_status_value == "initiated":
            call_sessions[call_id]["status"] = "initiated"

    return {"ok": True}


# ═══════════════════════════════════════════════════════════════════
# Audio serving (TTS audio served to Twilio)
# ═══════════════════════════════════════════════════════════════════

@router.get("/audio/{audio_id}")
async def serve_audio(audio_id: str):
    """Serve generated TTS audio to Twilio."""
    audio = _tts_audio_store.get(audio_id)
    if not audio:
        return Response(status_code=404, content="Not found")
    return Response(content=audio, media_type="audio/mpeg")


# ═══════════════════════════════════════════════════════════════════
# Standalone ElevenLabs TTS test endpoint
# ═══════════════════════════════════════════════════════════════════

@router.post("/tts/test")
def tts_test(data: dict):
    """
    Test ElevenLabs TTS directly.

    POST /tts/test
    {
      "text": "LISTEN UP RECRUIT!"
    }

    Returns the generated MP3 audio bytes.
    """
    text = data.get("text", "LISTEN UP RECRUIT! This is a test of the Sergeant Debugger voice system!")

    if not ELEVENLABS_API_KEY:
        return {"ok": False, "error": "ELEVENLABS_API_KEY not configured"}
    if not VOICE_ID:
        return {"ok": False, "error": "ELEVENLABS_VOICE_ID not configured"}

    try:
        audio_bytes = text_to_speech(text)
        return Response(content=audio_bytes, media_type="audio/mpeg")
    except Exception as e:
        print(f"[tts/test] ElevenLabs error: {e}", flush=True)
        return {"ok": False, "error": str(e)}


@router.get("/tts/voices")
def tts_list_voices():
    """
    List available ElevenLabs voices — useful for picking a VOICE_ID.

    GET /tts/voices
    """
    if not ELEVENLABS_API_KEY:
        return {"ok": False, "error": "ELEVENLABS_API_KEY not configured"}

    import requests as http_requests

    resp = http_requests.get(
        "https://api.elevenlabs.io/v1/voices",
        headers={"xi-api-key": ELEVENLABS_API_KEY},
    )
    resp.raise_for_status()
    voices = resp.json().get("voices", [])
    return {
        "ok": True,
        "voices": [
            {"voice_id": v["voice_id"], "name": v["name"], "category": v.get("category", "")}
            for v in voices
        ],
    }
