"""
Integration tests for the Twilio + ElevenLabs phone-call routes:
  /call/initiate, /call/status/{call_id}
  /twilio/voice/{call_id}, /twilio/gather/{call_id}, /twilio/status/{call_id}
  /audio/{audio_id}
  /tts/test, /tts/voices

These tests mock Twilio and ElevenLabs so no real calls or API requests are made.
"""

import os
import uuid
from unittest.mock import patch, MagicMock

import pytest


# ═══════════════════════════════════════════════════════════════════════
# /call/initiate
# ═══════════════════════════════════════════════════════════════════════

class TestCallInitiate:
    """POST /call/initiate — starts a Twilio phone call to the user."""

    def test_initiate_missing_phone_number(self, client):
        """Should fail with error when phone_number is empty."""
        resp = client.post("/call/initiate", json={
            "phone_number": "",
            "context": {"bug_type": "null pointer"}
        })
        assert resp.status_code == 200
        body = resp.json()
        assert body["ok"] is False
        assert "phone_number" in body["error"]

    def test_initiate_missing_phone_number_field(self, client):
        """Should fail when phone_number field is omitted entirely."""
        resp = client.post("/call/initiate", json={"context": {}})
        assert resp.status_code == 200
        body = resp.json()
        assert body["ok"] is False

    @patch.dict(os.environ, {"TWILIO_ACCOUNT_SID": "", "TWILIO_AUTH_TOKEN": ""})
    def test_initiate_missing_twilio_creds(self, client):
        """Should fail gracefully when Twilio credentials are not configured."""
        # Reset the cached client
        import call_router
        call_router._twilio_client = None
        call_router.TWILIO_ACCOUNT_SID = ""
        call_router.TWILIO_AUTH_TOKEN = ""

        resp = client.post("/call/initiate", json={
            "phone_number": "+11234567890",
            "context": {}
        })
        body = resp.json()
        assert body["ok"] is False
        assert "Twilio" in body["error"]

        # Restore
        call_router.TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
        call_router.TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")

    @patch.dict(os.environ, {
        "TWILIO_ACCOUNT_SID": "ACtest123",
        "TWILIO_AUTH_TOKEN": "test_token",
        "TWILIO_PHONE_NUMBER": "+10000000000",
        "PUBLIC_BASE_URL": "https://example.com",
    })
    @patch("call_router.get_twilio_client")
    def test_initiate_success(self, mock_get_client, client):
        """Happy path: Twilio call is created and call_id is returned."""
        import call_router
        call_router.TWILIO_ACCOUNT_SID = "ACtest123"
        call_router.TWILIO_AUTH_TOKEN = "test_token"
        call_router.TWILIO_PHONE_NUMBER = "+10000000000"
        call_router.PUBLIC_BASE_URL = "https://example.com"

        mock_twilio = MagicMock()
        mock_twilio.calls.create.return_value = MagicMock(sid="CAtestSID123")
        mock_get_client.return_value = mock_twilio

        resp = client.post("/call/initiate", json={
            "phone_number": "+11234567890",
            "context": {
                "bug_type": "null pointer",
                "fail_count": 3,
                "last_error": "TypeError: cannot read null"
            }
        })
        body = resp.json()
        assert body["ok"] is True
        assert "call_id" in body
        assert body["status"] == "initiated"

        # Verify Twilio was called with correct args
        mock_twilio.calls.create.assert_called_once()
        call_args = mock_twilio.calls.create.call_args
        assert call_args.kwargs["to"] == "+11234567890"
        assert call_args.kwargs["from_"] == "+10000000000"

    @patch.dict(os.environ, {
        "TWILIO_ACCOUNT_SID": "ACtest123",
        "TWILIO_AUTH_TOKEN": "test_token",
        "TWILIO_PHONE_NUMBER": "+10000000000",
        "PUBLIC_BASE_URL": "https://example.com",
    })
    @patch("call_router.get_twilio_client")
    def test_initiate_twilio_exception(self, mock_get_client, client):
        """When Twilio raises an exception, return error gracefully."""
        import call_router
        call_router.TWILIO_ACCOUNT_SID = "ACtest123"
        call_router.TWILIO_AUTH_TOKEN = "test_token"
        call_router.TWILIO_PHONE_NUMBER = "+10000000000"
        call_router.PUBLIC_BASE_URL = "https://example.com"

        mock_twilio = MagicMock()
        mock_twilio.calls.create.side_effect = Exception("Twilio API error")
        mock_get_client.return_value = mock_twilio

        resp = client.post("/call/initiate", json={
            "phone_number": "+11234567890",
            "context": {}
        })
        body = resp.json()
        assert body["ok"] is False
        assert "Twilio" in body["error"]

    def test_initiate_missing_public_base_url(self, client):
        """When PUBLIC_BASE_URL is not set, should return an error."""
        import call_router
        original = call_router.PUBLIC_BASE_URL
        call_router.PUBLIC_BASE_URL = ""
        call_router.TWILIO_ACCOUNT_SID = "ACtest123"
        call_router.TWILIO_AUTH_TOKEN = "test_token"
        call_router.TWILIO_PHONE_NUMBER = "+10000000000"

        resp = client.post("/call/initiate", json={
            "phone_number": "+11234567890",
            "context": {}
        })
        body = resp.json()
        assert body["ok"] is False
        assert "PUBLIC_BASE_URL" in body["error"]

        # Restore
        call_router.PUBLIC_BASE_URL = original


# ═══════════════════════════════════════════════════════════════════════
# /call/status/{call_id}
# ═══════════════════════════════════════════════════════════════════════

class TestCallStatus:
    """GET /call/status/{call_id} — poll call status."""

    def test_status_unknown_call_id(self, client):
        resp = client.get(f"/call/status/{uuid.uuid4()}")
        body = resp.json()
        assert body["ok"] is False
        assert "not found" in body["error"].lower()

    def test_status_known_call(self, client):
        """Should return full session data for a known call."""
        import call_router
        call_id = str(uuid.uuid4())
        call_router.call_sessions[call_id] = {
            "status": "in-progress",
            "phone_number": "+11234567890",
            "bug_type": "null pointer",
            "fail_count": 2,
            "last_error": "TypeError",
            "created_at": "2026-02-28T00:00:00Z",
            "twilio_sid": "CAtestSID",
            "transcripts": [],
        }

        resp = client.get(f"/call/status/{call_id}")
        body = resp.json()
        assert body["ok"] is True
        assert body["status"] == "in-progress"
        assert body["phone_number"] == "+11234567890"
        assert body["call_id"] == call_id

        # Cleanup
        del call_router.call_sessions[call_id]

    def test_status_ended_call(self, client):
        """Status endpoint should reflect ended calls."""
        import call_router
        call_id = str(uuid.uuid4())
        call_router.call_sessions[call_id] = {
            "status": "ended",
            "phone_number": "+10000000000",
            "bug_type": "off-by-one",
            "fail_count": 1,
            "last_error": "IndexError",
            "created_at": "2026-02-28T00:00:00Z",
            "twilio_sid": "CAtestSID2",
            "transcripts": [
                {"role": "user", "text": "I think the loop is wrong"},
                {"role": "sergeant", "text": "You bet it is!"}
            ],
        }

        resp = client.get(f"/call/status/{call_id}")
        body = resp.json()
        assert body["ok"] is True
        assert body["status"] == "ended"
        assert len(body["transcripts"]) == 2

        del call_router.call_sessions[call_id]


# ═══════════════════════════════════════════════════════════════════════
# /twilio/voice/{call_id}
# ═══════════════════════════════════════════════════════════════════════

class TestTwilioVoice:
    """POST /twilio/voice/{call_id} — Twilio webhook for call connection."""

    def test_voice_returns_twiml(self, client):
        """Should return valid TwiML XML with application/xml content type."""
        import call_router
        call_id = str(uuid.uuid4())
        call_router.call_sessions[call_id] = {
            "status": "initiated",
            "bug_type": "null pointer",
            "phone_number": "+11234567890",
        }

        resp = client.post(f"/twilio/voice/{call_id}")
        assert resp.status_code == 200
        assert "xml" in resp.headers.get("content-type", "")
        content = resp.text
        assert "<Response>" in content
        assert "Gather" in content or "Say" in content

        del call_router.call_sessions[call_id]

    def test_voice_updates_status_to_in_progress(self, client):
        """After Twilio fetches voice, session status should be 'in-progress'."""
        import call_router
        call_id = str(uuid.uuid4())
        call_router.call_sessions[call_id] = {
            "status": "initiated",
            "bug_type": "race condition",
            "phone_number": "+11234567890",
        }

        client.post(f"/twilio/voice/{call_id}")
        assert call_router.call_sessions[call_id]["status"] == "in-progress"

        del call_router.call_sessions[call_id]

    def test_voice_without_session(self, client):
        """Should still return valid TwiML even for unknown call_id (graceful degradation)."""
        resp = client.post(f"/twilio/voice/{uuid.uuid4()}")
        assert resp.status_code == 200
        assert "xml" in resp.headers.get("content-type", "")

    def test_voice_get_method(self, client):
        """Twilio sometimes uses GET for webhook callbacks."""
        import call_router
        call_id = str(uuid.uuid4())
        call_router.call_sessions[call_id] = {
            "status": "initiated",
            "bug_type": "segfault",
            "phone_number": "+11234567890",
        }

        resp = client.get(f"/twilio/voice/{call_id}")
        assert resp.status_code == 200

        del call_router.call_sessions[call_id]

    @patch("call_router._generate_tts_url", return_value="https://example.com/audio/test.mp3")
    def test_voice_with_tts(self, mock_tts, client):
        """When TTS is available, the TwiML should include a <Play> tag."""
        import call_router
        call_id = str(uuid.uuid4())
        call_router.call_sessions[call_id] = {
            "status": "initiated",
            "bug_type": "memory leak",
            "phone_number": "+11234567890",
        }

        resp = client.post(f"/twilio/voice/{call_id}")
        content = resp.text
        assert "Play" in content

        del call_router.call_sessions[call_id]


# ═══════════════════════════════════════════════════════════════════════
# /twilio/gather/{call_id}
# ═══════════════════════════════════════════════════════════════════════

class TestTwilioGather:
    """POST /twilio/gather/{call_id} — receives user's speech transcription."""

    def test_gather_stores_transcript(self, client):
        """User speech should be stored in the call session transcripts."""
        import call_router
        call_id = str(uuid.uuid4())
        call_router.call_sessions[call_id] = {
            "status": "in-progress",
            "bug_type": "null pointer",
            "phone_number": "+11234567890",
            "transcripts": [],
        }

        resp = client.post(
            f"/twilio/gather/{call_id}",
            data={"SpeechResult": "I think the variable is null"}
        )
        assert resp.status_code == 200
        assert "xml" in resp.headers.get("content-type", "")

        # Verify transcript was stored
        session = call_router.call_sessions[call_id]
        assert len(session["transcripts"]) == 2  # user + sergeant reply
        assert session["transcripts"][0]["role"] == "user"
        assert "null" in session["transcripts"][0]["text"]
        assert session["transcripts"][1]["role"] == "sergeant"

        del call_router.call_sessions[call_id]

    def test_gather_empty_speech(self, client):
        """Empty speech should produce a 'SILENCE' follow-up."""
        import call_router
        call_id = str(uuid.uuid4())
        call_router.call_sessions[call_id] = {
            "status": "in-progress",
            "bug_type": "bug",
            "phone_number": "+11234567890",
            "transcripts": [],
        }

        resp = client.post(
            f"/twilio/gather/{call_id}",
            data={"SpeechResult": ""}
        )
        assert resp.status_code == 200

        del call_router.call_sessions[call_id]

    def test_gather_unknown_call_id(self, client):
        """Gather should still return valid TwiML for unknown call IDs."""
        resp = client.post(
            f"/twilio/gather/{uuid.uuid4()}",
            data={"SpeechResult": "hello"}
        )
        assert resp.status_code == 200
        assert "xml" in resp.headers.get("content-type", "")


# ═══════════════════════════════════════════════════════════════════════
# /twilio/status/{call_id}
# ═══════════════════════════════════════════════════════════════════════

class TestTwilioStatus:
    """POST /twilio/status/{call_id} — Twilio call status webhook."""

    def _make_session(self, call_id):
        import call_router
        call_router.call_sessions[call_id] = {
            "status": "initiated",
            "phone_number": "+11234567890",
            "bug_type": "bug",
        }

    def test_status_completed(self, client):
        """Completed call should set session status to 'ended'."""
        import call_router
        call_id = str(uuid.uuid4())
        self._make_session(call_id)

        resp = client.post(
            f"/twilio/status/{call_id}",
            data={"CallStatus": "completed"}
        )
        assert resp.status_code == 200
        assert call_router.call_sessions[call_id]["status"] == "ended"

        del call_router.call_sessions[call_id]

    def test_status_busy(self, client):
        import call_router
        call_id = str(uuid.uuid4())
        self._make_session(call_id)

        client.post(f"/twilio/status/{call_id}", data={"CallStatus": "busy"})
        assert call_router.call_sessions[call_id]["status"] == "ended"

        del call_router.call_sessions[call_id]

    def test_status_no_answer(self, client):
        import call_router
        call_id = str(uuid.uuid4())
        self._make_session(call_id)

        client.post(f"/twilio/status/{call_id}", data={"CallStatus": "no-answer"})
        assert call_router.call_sessions[call_id]["status"] == "ended"

        del call_router.call_sessions[call_id]

    def test_status_failed(self, client):
        import call_router
        call_id = str(uuid.uuid4())
        self._make_session(call_id)

        client.post(f"/twilio/status/{call_id}", data={"CallStatus": "failed"})
        assert call_router.call_sessions[call_id]["status"] == "ended"

        del call_router.call_sessions[call_id]

    def test_status_ringing(self, client):
        import call_router
        call_id = str(uuid.uuid4())
        self._make_session(call_id)

        client.post(f"/twilio/status/{call_id}", data={"CallStatus": "ringing"})
        assert call_router.call_sessions[call_id]["status"] == "in-progress"

        del call_router.call_sessions[call_id]

    def test_status_in_progress(self, client):
        import call_router
        call_id = str(uuid.uuid4())
        self._make_session(call_id)

        client.post(f"/twilio/status/{call_id}", data={"CallStatus": "in-progress"})
        assert call_router.call_sessions[call_id]["status"] == "in-progress"

        del call_router.call_sessions[call_id]

    def test_status_initiated(self, client):
        import call_router
        call_id = str(uuid.uuid4())
        self._make_session(call_id)

        client.post(f"/twilio/status/{call_id}", data={"CallStatus": "initiated"})
        assert call_router.call_sessions[call_id]["status"] == "initiated"

        del call_router.call_sessions[call_id]

    def test_status_unknown_call_id(self, client):
        """Unknown call_id should not raise — just succeeds."""
        resp = client.post(
            f"/twilio/status/{uuid.uuid4()}",
            data={"CallStatus": "completed"}
        )
        assert resp.status_code == 200


# ═══════════════════════════════════════════════════════════════════════
# /audio/{audio_id}
# ═══════════════════════════════════════════════════════════════════════

class TestAudioServing:
    """GET /audio/{audio_id} — serves TTS audio to Twilio."""

    def test_audio_not_found(self, client):
        resp = client.get("/audio/nonexistent-id")
        assert resp.status_code == 404

    def test_audio_found(self, client):
        """Should serve MP3 bytes when audio exists in store."""
        import call_router
        audio_id = "test-audio-123"
        call_router._tts_audio_store[audio_id] = b"\xff\xfb\x90\x00" * 100  # fake MP3 bytes

        resp = client.get(f"/audio/{audio_id}")
        assert resp.status_code == 200
        assert resp.headers.get("content-type") == "audio/mpeg"
        assert len(resp.content) > 0

        del call_router._tts_audio_store[audio_id]


# ═══════════════════════════════════════════════════════════════════════
# /tts/test
# ═══════════════════════════════════════════════════════════════════════

class TestTTSTest:
    """POST /tts/test — test ElevenLabs TTS directly."""

    def test_tts_test_no_api_key(self, client):
        """Should fail gracefully when API key is missing."""
        import call_router
        original = call_router.ELEVENLABS_API_KEY
        call_router.ELEVENLABS_API_KEY = ""

        resp = client.post("/tts/test", json={"text": "test"})
        body = resp.json()
        assert body["ok"] is False
        assert "ELEVENLABS_API_KEY" in body["error"]

        call_router.ELEVENLABS_API_KEY = original

    def test_tts_test_no_voice_id(self, client):
        """Should fail gracefully when voice ID is missing."""
        import call_router
        original_key = call_router.ELEVENLABS_API_KEY
        original_voice = call_router.VOICE_ID
        call_router.ELEVENLABS_API_KEY = "test-key"
        call_router.VOICE_ID = ""

        resp = client.post("/tts/test", json={"text": "test"})
        body = resp.json()
        assert body["ok"] is False
        assert "VOICE_ID" in body["error"]

        call_router.ELEVENLABS_API_KEY = original_key
        call_router.VOICE_ID = original_voice


# ═══════════════════════════════════════════════════════════════════════
# /tts/voices
# ═══════════════════════════════════════════════════════════════════════

class TestTTSVoices:
    """GET /tts/voices — list available ElevenLabs voices."""

    def test_voices_no_api_key(self, client):
        """Should fail gracefully when API key is missing."""
        import call_router
        original = call_router.ELEVENLABS_API_KEY
        call_router.ELEVENLABS_API_KEY = ""

        resp = client.get("/tts/voices")
        body = resp.json()
        assert body["ok"] is False


        call_router.ELEVENLABS_API_KEY = original


# ═══════════════════════════════════════════════════════════════════════
# Sergeant followup generation
# ═══════════════════════════════════════════════════════════════════════

class TestSergeantFollowup:
    """Test the _generate_sergeant_followup helper."""

    def test_empty_speech_returns_silence_response(self):
        from call_router import _generate_sergeant_followup
        result = _generate_sergeant_followup("", {})
        assert "SILENCE" in result

    def test_whitespace_speech_returns_silence_response(self):
        from call_router import _generate_sergeant_followup
        result = _generate_sergeant_followup("   ", {})
        assert "SILENCE" in result

    def test_nonempty_speech_includes_original(self):
        from call_router import _generate_sergeant_followup
        result = _generate_sergeant_followup("the loop is broken", {})
        assert "the loop is broken" in result

    def test_followup_is_randomized(self):
        """Multiple calls should sometimes produce different results."""
        from call_router import _generate_sergeant_followup
        results = set()
        for _ in range(50):
            results.add(_generate_sergeant_followup("I fixed the null check", {}))
        # Should have at least 2 different responses (5 options exist)
        assert len(results) >= 2
