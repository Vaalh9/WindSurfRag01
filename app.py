from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from llama_index import (
    VectorStoreIndex,
    SimpleDirectoryReader,
    ServiceContext,
    StorageContext,
    load_index_from_storage,
)
from llama_index.llms import LlamaCPP
from llama_index.embeddings import HuggingFaceEmbedding
from llama_index.core import Settings
from pathlib import Path
import tempfile
import os
import json

app = FastAPI(title="MarkitDown RAG")

# Configuration des chemins
STORAGE_DIR = Path("storage")
INDEX_DIR = STORAGE_DIR / "index"
EMBEDDINGS_DIR = STORAGE_DIR / "embeddings"

# Créer les dossiers nécessaires
STORAGE_DIR.mkdir(exist_ok=True)
INDEX_DIR.mkdir(exist_ok=True)
EMBEDDINGS_DIR.mkdir(exist_ok=True)

# Configuration du LLM et des embeddings
llm = LlamaCPP(
    model_path="models/mistral-7b-v0.1.Q4_K_M.gguf",
    temperature=0.7,
    max_tokens=2000,
    context_window=4096,
    model_kwargs={"n_gpu_layers": 0}  # -1 pour GPU
)

embedding_model = HuggingFaceEmbedding(model_name="all-MiniLM-L6-v2")

# Configuration globale
Settings.embed_model = embedding_model
Settings.llm = llm

# Contexte de service pour l'indexation
service_context = ServiceContext.from_defaults(
    chunk_size=1000,
    chunk_overlap=200
)

# Charger l'index existant ou en créer un nouveau
def get_or_create_index():
    try:
        storage_context = StorageContext.from_defaults(persist_dir=str(INDEX_DIR))
        index = load_index_from_storage(storage_context)
    except:
        index = VectorStoreIndex([], service_context=service_context)
    return index

@app.post("/upload/")
async def upload_markdown(file: UploadFile = File(...)):
    """
    Upload et indexer un fichier Markdown
    """
    if not file.filename.endswith(".md"):
        raise HTTPException(status_code=400, detail="Le fichier doit être au format Markdown (.md)")
    
    # Sauvegarder temporairement le fichier
    with tempfile.NamedTemporaryFile(delete=False, suffix=".md") as temp_file:
        content = await file.read()
        temp_file.write(content)
        temp_path = temp_file.name
    
    try:
        # Charger le document
        documents = SimpleDirectoryReader(input_files=[temp_path]).load_data()
        
        # Charger ou créer l'index
        index = get_or_create_index()
        
        # Ajouter le document à l'index
        for doc in documents:
            index.insert(doc)
        
        # Sauvegarder l'index
        index.storage_context.persist(persist_dir=str(INDEX_DIR))
        
        return {"message": f"Fichier {file.filename} indexé avec succès"}
    
    finally:
        # Nettoyer le fichier temporaire
        os.unlink(temp_path)

@app.post("/query/")
async def query(question: str):
    """
    Interroger la base de connaissances
    """
    try:
        # Charger l'index
        index = get_or_create_index()
        
        # Créer un moteur de requête
        query_engine = index.as_query_engine(
            streaming=True,
            similarity_top_k=3
        )
        
        # Exécuter la requête
        response = query_engine.query(question)
        
        # Convertir la réponse en format JSON
        response_data = {
            "response": str(response),
            "sources": [{
                "text": str(source.text),
                "metadata": source.metadata
            } for source in response.source_nodes]
        }
        
        return response_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
