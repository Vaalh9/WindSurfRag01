from fastapi import FastAPI, UploadFile, File
from langchain.text_splitter import MarkdownTextSplitter
from langchain.vectorstores import Chroma
from langchain.embeddings import HuggingFaceEmbeddings
from langchain.chains import RetrievalQA
from langchain.llms import LlamaCpp
import os

app = FastAPI(title="MarkitDown RAG")

# Initialiser les modèles
embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
llm = LlamaCpp(
    model_path="models/mistral-7b-v0.1.Q4_K_M.gguf",
    temperature=0.7,
    max_tokens=2000,
    top_p=0.95,
    n_ctx=4096,
    n_gpu_layers=0  # Mettre à -1 pour utiliser le GPU si disponible
)

# Initialiser le vectorstore
vectorstore = Chroma(
    embedding_function=embeddings,
    persist_directory="./chroma_db"
)

@app.post("/upload/")
async def upload_markdown(file: UploadFile = File(...)):
    """
    Upload et indexer un fichier Markdown
    """
    content = await file.read()
    text = content.decode("utf-8")
    
    # Découper le texte en chunks
    text_splitter = MarkdownTextSplitter(chunk_size=1000, chunk_overlap=200)
    chunks = text_splitter.split_text(text)
    
    # Ajouter les chunks au vectorstore
    vectorstore.add_texts(chunks)
    return {"message": f"Fichier {file.filename} indexé avec succès"}

@app.post("/query/")
async def query(question: str):
    """
    Interroger la base de connaissances
    """
    # Créer une chaîne de requête
    qa_chain = RetrievalQA.from_chain_type(
        llm=llm,
        chain_type="stuff",
        retriever=vectorstore.as_retriever(search_kwargs={"k": 3})
    )
    
    # Obtenir la réponse
    response = qa_chain.run(question)
    return {"response": response}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
