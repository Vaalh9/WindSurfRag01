from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from datetime import datetime
import os
import io
import json
import tempfile
import logging
from pathlib import Path
from typing import List, Optional
from pydantic import BaseModel
import pdfplumber
from PyPDF2 import PdfReader
from llama_index.core import SimpleDirectoryReader, VectorStoreIndex, StorageContext, load_index_from_storage, Document
from llama_index.core.node_parser import SentenceSplitter
from llama_index.llms.llama_cpp import LlamaCPP
from llama_index.embeddings.huggingface import HuggingFaceEmbedding

# Configuration du logging
logging.basicConfig(level=logging.INFO)

# Supprimer les warnings de pdfminer
logging.getLogger('pdfminer').setLevel(logging.ERROR)

logger = logging.getLogger(__name__)

# Chemins des répertoires
BASE_DIR = Path().absolute()
MODELS_DIR = BASE_DIR / "models"
STORAGE_DIR = BASE_DIR / "storage"
UPLOAD_DIR = STORAGE_DIR / "uploads"
INDEX_DIR = STORAGE_DIR / "index"
EMBEDDINGS_DIR = STORAGE_DIR / "embeddings"
DOCS_INFO_FILE = STORAGE_DIR / "documents.json"

# Création des répertoires nécessaires
STORAGE_DIR.mkdir(exist_ok=True)
UPLOAD_DIR.mkdir(exist_ok=True)
INDEX_DIR.mkdir(exist_ok=True)
EMBEDDINGS_DIR.mkdir(exist_ok=True)

# Création de l'application FastAPI
app = FastAPI()

# Configuration CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger.info("Initialisation de l'application...")

def extract_text_from_pdf(pdf_bytes):
    """
    Extraire le texte complet d'un fichier PDF en utilisant pdfplumber comme méthode principale
    et PyPDF2 comme méthode de secours si pdfplumber échoue
    """
    
    logger.info("[DIAGNOSTIC] Début de l'extraction du texte PDF")
    
    try:
        # Utiliser pdfplumber pour extraire le texte
        logger.info("[DIAGNOSTIC] Tentative d'extraction avec pdfplumber")
        with pdfplumber.open(io.BytesIO(pdf_bytes), laparams={"all_texts": True}) as pdf:
            text = ""
            page_count = len(pdf.pages)
            logger.info(f"[DIAGNOSTIC] PDF contient {page_count} pages")
            
            for i, page in enumerate(pdf.pages):
                try:
                    logger.info(f"[DIAGNOSTIC] Extraction de la page {i+1}/{page_count}")
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n\n"
                        logger.info(f"[DIAGNOSTIC] Page {i+1}: {len(page_text)} caractères extraits")
                    else:
                        logger.warning(f"[DIAGNOSTIC] Page {i+1}: Aucun texte extrait")
                except Exception as e:
                    logger.warning(f"[DIAGNOSTIC] Erreur lors de l'extraction de la page {i+1}: {str(e)}")
                    continue
            
            if text.strip():
                logger.info(f"[DIAGNOSTIC] Extraction réussie avec pdfplumber: {len(text)} caractères")
                return text
            else:
                logger.warning("[DIAGNOSTIC] pdfplumber n'a pas réussi à extraire de texte, utilisation de PyPDF2 comme fallback")
                
        # Si pdfplumber n'a pas réussi, utiliser PyPDF2 comme fallback
        logger.info("[DIAGNOSTIC] Tentative d'extraction avec PyPDF2")
        reader = PdfReader(io.BytesIO(pdf_bytes))
        text = ""
        page_count = len(reader.pages)
        logger.info(f"[DIAGNOSTIC] PyPDF2 détecte {page_count} pages")
        
        for i, page in enumerate(reader.pages):
            page_text = page.extract_text()
            text += page_text + "\n\n"
            logger.info(f"[DIAGNOSTIC] PyPDF2 Page {i+1}: {len(page_text)} caractères extraits")
            
        logger.info(f"[DIAGNOSTIC] Extraction réussie avec PyPDF2: {len(text)} caractères")
        return text
        try:
            with pdfplumber.open(BytesIO(pdf_bytes)) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text() or ""
                    text += page_text
                    logger.info(f"Extrait {len(page_text)} caractères de la page avec pdfplumber")
        except Exception as plumber_error:
            logger.warning(f"Erreur avec pdfplumber: {str(plumber_error)}. Essai avec PyPDF2...")
                
        # Si aucun texte n'a été extrait, essayer avec PyPDF2
        if not text.strip():
            logger.info("Aucun texte extrait avec pdfplumber, utilisation de PyPDF2")
            reader = PdfReader(BytesIO(pdf_bytes))
            for i, page in enumerate(reader.pages):
                page_text = page.extract_text() or ""
                text += page_text
                logger.info(f"Extrait {len(page_text)} caractères de la page {i+1} avec PyPDF2")
                
        # Vérifier si du texte a été extrait
        if not text.strip():
            logger.warning("Aucun texte n'a pu être extrait du PDF")
            return "Aucun texte n'a pu être extrait de ce document. Il s'agit peut-être d'un PDF scanné ou contenant uniquement des images."
                
        return text
    except Exception as e:
        logger.error(f"Erreur lors de l'extraction du PDF : {str(e)}")
        raise Exception(f"Impossible d'extraire le texte du PDF: {str(e)}")

def save_document_info(filename: str):
    """
    Sauvegarder les informations du document
    """
    documents = []
    if DOCS_INFO_FILE.exists():
        with open(DOCS_INFO_FILE, "r", encoding="utf-8") as f:
            documents = json.load(f)
    
    documents.append({
        "filename": filename,
        "created_at": datetime.now().isoformat()
    })
    
    with open(DOCS_INFO_FILE, "w", encoding="utf-8") as f:
        json.dump(documents, f, ensure_ascii=False, indent=2)

# Définition du modèle de requête
class Query(BaseModel):
    question: str

class ChatRequest(BaseModel):
    message: str
    document_id: str

# Les routes API doivent être définies AVANT le montage des fichiers statiques
@app.get("/api/documents")
async def list_documents():
    """
    Lister tous les documents indexés
    """
    if not DOCS_INFO_FILE.exists():
        return []
    
    with open(DOCS_INFO_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

@app.delete("/api/documents/{filename}")
def delete_document(filename: str):
    """
    Supprimer un document et ses fichiers associés
    """
    try:
        logger.info(f"Suppression du document : {filename}")
        
        if not os.path.exists(DOCS_INFO_FILE):
            raise HTTPException(status_code=404, detail="Document non trouvé")

        # Charger les informations des documents
        with open(DOCS_INFO_FILE, "r", encoding="utf-8") as f:
            documents = json.load(f)

        # Trouver et supprimer le document
        documents = [doc for doc in documents if doc["filename"] != filename]

        # Sauvegarder les informations mises à jour
        with open(DOCS_INFO_FILE, "w", encoding="utf-8") as f:
            json.dump(documents, f, ensure_ascii=False, indent=2)

        # Supprimer les fichiers associés
        file_path = UPLOAD_DIR / filename
        if os.path.exists(file_path):
            os.remove(file_path)

        # Supprimer l'index si nécessaire
        index_path = INDEX_DIR / (filename.replace(".", "_") + ".json")
        if os.path.exists(index_path):
            os.remove(index_path)

        return {"status": "success", "message": "Document supprimé avec succès"}

    except Exception as e:
        logger.error(f"Erreur lors de la suppression du document : {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/documents")
def delete_all_documents():
    """
    Supprimer tous les documents et leurs fichiers associés
    """
    try:
        logger.info("Suppression de tous les documents")
        
        if not os.path.exists(DOCS_INFO_FILE):
            return {"status": "success", "message": "Aucun document à supprimer"}

        # Charger les informations des documents
        with open(DOCS_INFO_FILE, "r", encoding="utf-8") as f:
            documents = json.load(f)

        # Supprimer tous les fichiers associés
        for doc in documents:
            filename = doc["filename"]
            # Supprimer le fichier
            file_path = UPLOAD_DIR / filename
            if os.path.exists(file_path):
                os.remove(file_path)

            # Supprimer l'index
            index_path = INDEX_DIR / (filename.replace(".", "_") + ".json")
            if os.path.exists(index_path):
                os.remove(index_path)

        # Vider la liste des documents
        with open(DOCS_INFO_FILE, "w", encoding="utf-8") as f:
            json.dump([], f, ensure_ascii=False, indent=2)

        return {"status": "success", "message": f"{len(documents)} documents supprimés avec succès"}

    except Exception as e:
        logger.error(f"Erreur lors de la suppression de tous les documents : {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/upload")
async def upload_document(file: UploadFile = File(...)):
    """
    Upload et indexer un fichier (Markdown ou PDF)
    """
    if not (file.filename.endswith(".md") or file.filename.endswith(".pdf")):
        raise HTTPException(
            status_code=400, 
            detail="Le fichier doit être au format Markdown (.md) ou PDF (.pdf)"
        )
    
    try:
        content = await file.read()
        temp_path = None
        
        # Extraire le texte selon le type de fichier
        logger.info(f"Début du traitement de {file.filename}")
        logger.info("[Étape 1/4] Extraction du texte...")
        
        if file.filename.endswith(".pdf"):
            try:
                # Extraction du texte PDF
                text_content = extract_text_from_pdf(content)
                logger.info(f"[DIAGNOSTIC] Texte extrait du PDF: {len(text_content)} caractères")
                logger.info(f"[DIAGNOSTIC] Début du texte: {text_content[:200]}...")
                
                # Créer un fichier Markdown temporaire
                with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.md', encoding='utf-8') as temp_md:
                    temp_md.write(text_content)
                    temp_path = temp_md.name
            except Exception as e:
                logger.error(f"[DIAGNOSTIC] Erreur lors de l'extraction du PDF: {str(e)}")
                raise HTTPException(status_code=400, detail=f"Erreur lors de l'extraction du PDF : {str(e)}")
        else:
            # Pour les fichiers Markdown, lire directement le contenu
            try:
                text_content = content.decode('utf-8')
                logger.info(f"[DIAGNOSTIC] Texte extrait du Markdown: {len(text_content)} caractères")
                logger.info(f"[DIAGNOSTIC] Début du texte: {text_content[:200]}...")
                
                # Écrire le contenu dans un fichier temporaire
                with tempfile.NamedTemporaryFile(mode='wb', delete=False, suffix='.md') as temp_md:
                    temp_md.write(content)
                    temp_path = temp_md.name
            except Exception as e:
                logger.error(f"[DIAGNOSTIC] Erreur lors de la lecture du Markdown: {str(e)}")
                raise HTTPException(status_code=400, detail=f"Erreur lors de la lecture du Markdown : {str(e)}")
        
        try:
            
            if not text_content or len(text_content.strip()) == 0:
                raise Exception("Aucun texte n'a pu être extrait du document")
                
            # Étape 2 : Découpage en chunks
            logger.info("[Étape 2/4] Découpage en chunks...")
            text_splitter = SentenceSplitter(
                chunk_size=1024,
                chunk_overlap=100
            )
            chunks = text_splitter.split_text(text_content)
            logger.info(f"[DIAGNOSTIC] Nombre de chunks créés: {len(chunks)}")
            if chunks and len(chunks) > 0:
                logger.info(f"[DIAGNOSTIC] Exemple de chunk: {chunks[0][:100]}...")
            
            # Créer les documents
            documents = [Document(text=chunk) for chunk in chunks]
            logger.info(f"[DIAGNOSTIC] Nombre de documents créés: {len(documents)}")
            
            # Étape 3 : Création des embeddings et indexation
            logger.info("[Étape 3/4] Création des embeddings et indexation...")
            
            # Utiliser SentenceTransformers pour les embeddings
            logger.info("[DIAGNOSTIC] Initialisation du modèle d'embedding SentenceTransformers...")
            embed_model = HuggingFaceEmbedding(model_name="all-MiniLM-L6-v2")
            logger.info("[DIAGNOSTIC] Modèle d'embedding initialisé avec succès")
            
            # Configurer le LLM (Mistral)
            logger.info("[DIAGNOSTIC] Initialisation du modèle LLM Mistral...")
            llm = LlamaCPP(
                model_url="https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF/resolve/main/mistral-7b-instruct-v0.2.Q4_K_M.gguf",
                model_path=str(MODELS_DIR / "mistral-7b-instruct-v0.2.Q4_K_M.gguf"),
                temperature=0.1,
                max_new_tokens=512,
                context_window=3900,
                generate_kwargs={},
                model_kwargs={
                    "n_gpu_layers": 43,  # Utiliser le GPU (43 couches)
                    "use_mlock": False,
                    "offload_kqv": True,
                    "f16_kv": True,
                    "verbose": False
                },
                # Note: tokenizer_kwargs n'est pas supporté dans cette version
                messages_to_prompt=lambda messages: messages[0].content,
                completion_to_prompt=lambda completion: completion,
                verbose=True
            )
            logger.info("[DIAGNOSTIC] Modèle LLM initialisé avec succès")
            
            logger.info("[DIAGNOSTIC] Création de l'index vectoriel...")
            index = VectorStoreIndex.from_documents(
                documents,
                embed_model=embed_model,
                llm=llm
            )
            logger.info("[DIAGNOSTIC] Index vectoriel créé avec succès")
            
            # Étape 4 : Sauvegarde
            logger.info("[Étape 4/4] Sauvegarde de l'index...")
            index.storage_context.persist(persist_dir=str(INDEX_DIR))
            
            # Sauvegarder les informations du document
            save_document_info(file.filename)
            
            # Préparer les données à renvoyer
            document_text = documents[0].text
            logger.info(f"[DIAGNOSTIC] Taille du texte extrait pour la prévisualisation: {len(document_text)} caractères")
            logger.info(f"[DIAGNOSTIC] Début du texte pour la prévisualisation: {document_text[:200]}...")
            
            # Créer la réponse avec les données complètes
            # S'assurer que le texte extrait est bien une chaîne de caractères
            if document_text is None:
                document_text = ""
            elif not isinstance(document_text, str):
                document_text = str(document_text)
                
            logger.info(f"[DIAGNOSTIC] Type du texte extrait: {type(document_text).__name__}")
            logger.info(f"[DIAGNOSTIC] Longueur du texte extrait: {len(document_text)}")
            
            # S'assurer que le texte extrait est bien une chaîne de caractères et non vide
            # Utiliser directement le texte brut extrait du document
            preview_text = text_content
            
            # Vérifier si le texte est disponible
            if not preview_text or not isinstance(preview_text, str) or not preview_text.strip():
                # Utiliser le texte des documents comme fallback
                preview_text = document_text if isinstance(document_text, str) and document_text.strip() else ""
                logger.info(f"[DIAGNOSTIC] Utilisation du texte des documents comme fallback: {len(preview_text)} caractères")
            
            # Vérifier que le texte n'est pas vide après les tentatives de fallback
            if not preview_text.strip():
                logger.warning("[DIAGNOSTIC] Aucun texte extrait disponible pour la prévisualisation")
                preview_text = "Aucun texte n'a pu être extrait de ce document."
            
            logger.info(f"[DIAGNOSTIC] Texte final pour la prévisualisation: {len(preview_text)} caractères")
            logger.info(f"[DIAGNOSTIC] Début du texte final: {preview_text[:200]}...")
            
            # Utiliser le texte complet extrait pour la prévisualisation
            response_data = {
                "status": "success",
                "message": "Document traité avec succès",
                "document": {
                    "filename": file.filename,
                    "type": "pdf" if file.filename.endswith(".pdf") else "markdown",
                    "size": len(content),
                    "text_length": len(preview_text),
                    "created_at": datetime.now().isoformat(),
                    "preview": preview_text  # Utiliser le texte final pour la prévisualisation
                }
            }
            
            # Vérifier que la réponse contient bien le texte extrait
            if not response_data["document"]["preview"] or len(response_data["document"]["preview"]) == 0:
                logger.error("[DIAGNOSTIC] La réponse ne contient pas de texte extrait!")
                response_data["document"]["preview"] = "Erreur: Le texte extrait est vide. Vérifiez les logs du serveur."
            
            logger.info(f"[DIAGNOSTIC] Réponse préparée et prête à être envoyée: {len(response_data['document']['preview'])} caractères de prévisualisation")
            return response_data
            
        except Exception as e:
            logger.error(f"Erreur lors du traitement : {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))
        finally:
            # Nettoyage du fichier temporaire
            if temp_path and os.path.exists(temp_path):
                os.unlink(temp_path)
                
    except Exception as e:
        logger.error(f"Erreur lors de l'upload : {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/query")
async def query(query: Query):
    """
    Interroger l'index avec une question
    """
    try:
        # Vérifier si des documents ont été indexés
        if not os.path.exists(INDEX_DIR) or not os.listdir(INDEX_DIR):
            raise HTTPException(
                status_code=400,
                detail="Aucun document n'a été indexé. Veuillez d'abord uploader des documents."
            )
            
        # Charger l'index et configurer le LLM
        llm = LlamaCPP(
            model_url="https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF/resolve/main/mistral-7b-instruct-v0.2.Q4_K_M.gguf",
            model_path=str(MODELS_DIR / "mistral-7b-instruct-v0.2.Q4_K_M.gguf"),
            temperature=0.1,
            max_new_tokens=512,
            context_window=3900,
            generate_kwargs={},
            model_kwargs={"n_gpu_layers": 0},
            messages_to_prompt=lambda messages: messages[0].content,
            completion_to_prompt=lambda completion: completion,
            verbose=True
        )
        
        # Utiliser la méthode correcte pour charger l'index
        from llama_index.core import StorageContext, load_index_from_storage
        
        try:
            storage_context = StorageContext.from_defaults(persist_dir=str(INDEX_DIR))
            index = load_index_from_storage(storage_context)
        except Exception as e:
            logger.error(f"Erreur lors du chargement de l'index : {str(e)}")
            # Créer un index vide si le chargement échoue
            index = VectorStoreIndex.from_documents([])
            
        query_engine = index.as_query_engine(llm=llm)
        
        # Exécuter la requête
        response = query_engine.query(query.question)
        
        return {"response": str(response)}
    except Exception as e:
        logger.error(f"Erreur lors de la requête : {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat")
async def chat(request: ChatRequest):
    """
    Interroger un document spécifique avec une question
    """
    try:
        # Vérifier si le document existe
        if not os.path.exists(DOCS_INFO_FILE):
            raise HTTPException(status_code=404, detail="Aucun document trouvé")
            
        with open(DOCS_INFO_FILE, "r", encoding="utf-8") as f:
            documents = json.load(f)
            
        # Vérifier si le document demandé existe
        doc_exists = any(doc["filename"] == request.document_id for doc in documents)
        if not doc_exists:
            raise HTTPException(status_code=404, detail=f"Document {request.document_id} non trouvé")
        
        # Configurer le LLM avec GPU
        llm = LlamaCPP(
            model_url="https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF/resolve/main/mistral-7b-instruct-v0.2.Q4_K_M.gguf",
            model_path=str(MODELS_DIR / "mistral-7b-instruct-v0.2.Q4_K_M.gguf"),
            temperature=0.1,
            max_new_tokens=512,
            context_window=3900,
            generate_kwargs={},
            model_kwargs={"n_gpu_layers": 43},  # Utiliser le GPU (43 couches)
            messages_to_prompt=lambda messages: messages[0].content,
            completion_to_prompt=lambda completion: completion,
            verbose=True
        )
        
        # Charger l'index du document spécifique
        index_file = request.document_id.replace(".", "_") + ".json"
        index_path = INDEX_DIR / index_file
        
        # Utiliser la méthode correcte pour charger l'index
        from llama_index.core import StorageContext, load_index_from_storage
        
        try:
            if os.path.exists(index_path):
                # Charger l'index spécifique au document
                storage_context = StorageContext.from_defaults(persist_dir=str(index_path))
                index = load_index_from_storage(storage_context)
            else:
                # Sinon, essayer de charger l'index global
                storage_context = StorageContext.from_defaults(persist_dir=str(INDEX_DIR))
                index = load_index_from_storage(storage_context)
        except Exception as e:
            logger.error(f"Erreur lors du chargement de l'index : {str(e)}")
            # Créer un index vide si le chargement échoue
            index = VectorStoreIndex.from_documents([])
        
        query_engine = index.as_query_engine(llm=llm)
        
        # Exécuter la requête
        response = query_engine.query(request.message)
        
        return {"response": str(response)}
    except Exception as e:
        logger.error(f"Erreur lors du chat : {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Montage des fichiers statiques
app.mount("/static", StaticFiles(directory="frontend/static"), name="static")
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
