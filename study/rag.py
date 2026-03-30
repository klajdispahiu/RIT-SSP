"""
study/rag.py

RAG (Retrieval-Augmented Generation) engine.
Handles chunking, embedding, storing, and retrieving textbook content.
"""

import os
import re
from typing import List, Dict


def get_chroma_client():
    import chromadb
    persist_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'chromadb_store')
    os.makedirs(persist_dir, exist_ok=True)
    return chromadb.PersistentClient(path=persist_dir)


def get_collection(doc_id: int):
    client = get_chroma_client()
    collection_name = f"doc_{doc_id}"
    return client.get_or_create_collection(
        name=collection_name,
        metadata={"hnsw:space": "cosine"}
    )


def get_embedding_model():
    from sentence_transformers import SentenceTransformer
    return SentenceTransformer('all-MiniLM-L6-v2')


def chunk_text(text: str, chunk_size: int = 400, overlap: int = 80) -> List[str]:
    """Split text into overlapping chunks."""
    sentences = re.split(r'(?<=[.!?])\s+', text)
    chunks = []
    current = []
    current_len = 0

    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
        words = sentence.split()
        if current_len + len(words) > chunk_size and current:
            chunk_text = ' '.join(current)
            if len(chunk_text.strip()) > 50:
                chunks.append(chunk_text)
            overlap_words = current[-overlap:] if len(current) > overlap else current
            current = overlap_words + words
            current_len = len(current)
        else:
            current.extend(words)
            current_len += len(words)

    if current:
        chunk_text_final = ' '.join(current)
        if len(chunk_text_final.strip()) > 50:
            chunks.append(chunk_text_final)

    return chunks


def embed_document(doc_id: int, pages_content: List[Dict]) -> int:
    """
    Embed all pages of a document and store in ChromaDB.
    pages_content: list of {'page_number': int, 'content': str}
    Returns number of chunks stored.
    """
    model = get_embedding_model()
    collection = get_collection(doc_id)

    existing = collection.count()
    if existing > 0:
        return existing

    all_chunks = []
    all_ids = []
    all_metadatas = []

    for page in pages_content:
        page_num = page['page_number']
        text = page['content']
        if not text.strip():
            continue
        chunks = chunk_text(text)
        for i, chunk in enumerate(chunks):
            chunk_id = f"doc{doc_id}_p{page_num}_c{i}"
            all_chunks.append(chunk)
            all_ids.append(chunk_id)
            all_metadatas.append({
                'page_number': page_num,
                'doc_id': doc_id,
                'chunk_index': i,
            })

    if not all_chunks:
        return 0

    batch_size = 100
    for i in range(0, len(all_chunks), batch_size):
        batch_chunks = all_chunks[i:i + batch_size]
        batch_ids = all_ids[i:i + batch_size]
        batch_meta = all_metadatas[i:i + batch_size]
        embeddings = model.encode(batch_chunks).tolist()
        collection.add(
            documents=batch_chunks,
            embeddings=embeddings,
            ids=batch_ids,
            metadatas=batch_meta,
        )

    return len(all_chunks)


def retrieve_relevant_chunks(doc_id: int, query: str, n_results: int = 8) -> List[Dict]:
    """
    Retrieve the most relevant chunks for a given query.
    Returns list of {'text': str, 'page_number': int}
    """
    model = get_embedding_model()
    collection = get_collection(doc_id)

    if collection.count() == 0:
        return []

    query_embedding = model.encode([query]).tolist()

    results = collection.query(
        query_embeddings=query_embedding,
        n_results=min(n_results, collection.count()),
    )

    chunks = []
    if results and results['documents']:
        for doc, meta in zip(results['documents'][0], results['metadatas'][0]):
            chunks.append({
                'text': doc,
                'page_number': meta.get('page_number', 0),
            })

    return chunks


def delete_document_embeddings(doc_id: int):
    """Remove all embeddings for a document."""
    try:
        client = get_chroma_client()
        client.delete_collection(f"doc_{doc_id}")
    except Exception:
        pass