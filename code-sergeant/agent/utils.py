import os
from langchain_community.document_loaders.generic import GenericLoader
from langchain_community.document_loaders.parsers import LanguageParser
from langchain_text_splitters import RecursiveCharacterTextSplitter, Language
from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings
from dotenv import load_dotenv

LANGUAGE_MAP = {
    ".py":   ("python",     Language.PYTHON),
    ".js":   ("js",         Language.JS),
    ".ts":   ("ts",         Language.TS),
    ".java": ("java",       Language.JAVA),
    ".cpp":  ("cpp",        Language.CPP),
    ".c":    ("c",          Language.C),
    ".go":   ("go",         Language.GO),
    ".rb":   ("ruby",       Language.RUBY),
    ".rs":   ("rust",       Language.RUST),
}

load_dotenv()

def load_documents_for_extension(codebase_path: str, extension: str, parser_lang: str):
    loader = GenericLoader.from_filesystem(
        codebase_path,
        glob=f"**/*{extension}",
        suffixes=[extension],
        parser=LanguageParser(language=parser_lang, parser_threshold=500)
    )
    return loader.load()


def build_vector_store(codebase_path: str, persist_directory: str = "./chroma_db"):
    all_chunks = []

    for extension, (parser_lang, splitter_lang) in LANGUAGE_MAP.items():
        documents = load_documents_for_extension(codebase_path, extension, parser_lang)

        if not documents:
            continue

        print(f"Loaded {len(documents)} {extension} files")

        splitter = RecursiveCharacterTextSplitter.from_language(
            language=splitter_lang,
            chunk_size=1000,
            chunk_overlap=200
        )
        chunks = splitter.split_documents(documents)

        # Tag each chunk with its language for filtering later
        for chunk in chunks:
            chunk.metadata["language"] = parser_lang

        all_chunks.extend(chunks)
        print(f"  → {len(chunks)} chunks")

    print(f"\nTotal chunks: {len(all_chunks)}")
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    vector_store = Chroma.from_documents(
        documents=all_chunks,
        embedding=embeddings,
        persist_directory=persist_directory,
        collection_name="codebase"
    )
    print(f"Vector store built and persisted to {persist_directory}")
    return vector_store


def load_vector_store(persist_directory: str = "./chroma_db"):
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    return Chroma(
        persist_directory=persist_directory,
        embedding_function=embeddings,
        collection_name="codebase"
    )
