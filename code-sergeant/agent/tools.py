import os

from langchain_core.tools import tool
from langchain.chat_models import init_chat_model
from langchain.messages import SystemMessage
from utils import *

#Define tools
# RAG tool, generates vector store
def get_rag_tool():
    chroma_db = load_vector_store()
    @tool
    def search_codebase(query: str):
        """Find code segments from the codebase
        
        Args:
            query: string to query with
        """

        results = chroma_db.similarity_search(query, k=5)
        return "\n\n---\n\n".join([doc.page_content for doc in results])
    return search_codebase

# Initializing mini model for specific tool
tool_model = init_chat_model("openai:o4-mini")

def create_punishment_tool():
    @tool
    def punishment_tool(query: str) -> str:
        """Generate a creative punishment applicable to user's errors
        
        Args:
            
        """
        # Create a small sub-prompt
        prompt = [
            SystemMessage(content="You are a creative assistant tasked with generating humorous punishments for coding errors."),
            # user query goes as user content
            SystemMessage(content=f"Context: {query}")
        ]
        response = tool_model.invoke(prompt)

        return getattr(response, "content", response)
    return punishment_tool

def create_phonecall_tool():
    @tool
    def phonecall_tool(number: str, bug_type: str = "unknown bug", fail_count: int = 0, last_error: str = "N/A") -> str:
        """Make a phone call to the user from Sergeant Debugger via Twilio.

        Args:
            number: phone number to call (E.164 format, e.g. +11234567890).
            bug_type: short description of the bug type (e.g. "null pointer").
            fail_count: how many times the recruit has failed so far.
            last_error: the last error message the recruit encountered.
        """
        import requests as http_requests

        server_url = os.getenv("SERVER_URL", "http://localhost:8000")
        payload = {
            "phone_number": number,
            "context": {
                "bug_type": bug_type,
                "fail_count": fail_count,
                "last_error": last_error,
            },
        }
        try:
            resp = http_requests.post(f"{server_url}/call/initiate", json=payload, timeout=15)
            resp.raise_for_status()
            data = resp.json()
            if data.get("ok"):
                return f"Call initiated successfully (call_id={data['call_id']}). The sergeant is dialing {number}!"
            else:
                return f"Call failed: {data.get('error', 'unknown error')}"
        except Exception as e:
            return f"Error initiating call: {e}"
    return phonecall_tool