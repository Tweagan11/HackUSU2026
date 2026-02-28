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
            query: string to query with 
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