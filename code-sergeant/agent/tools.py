from langchain.tools import tool
from langchain.chat_models import init_chat_model
from utils import *

#Define tools
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