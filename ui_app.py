from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from datetime import datetime
import os
import io
from io import BytesIO
import json
import tempfile
import logging
import re
import time
from pathlib import Path
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
import pdfplumber
from PyPDF2 import PdfReader
import chromadb
from chromadb.utils import embedding_functions

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Chemins des répertoires
BASE_DIR = Path().absolute()
STORAGE_DIR = BASE_DIR / "storage"
UPLOAD_DIR = STORAGE_DIR / "uploads"
DOCS_INFO_FILE = STORAGE_DIR / "documents.json"
CHROMA_DIR = STORAGE_DIR / "chroma_db"

# Création des répertoires nécessaires
STORAGE_DIR.mkdir(exist_ok=True)
UPLOAD_DIR.mkdir(exist_ok=True)
CHROMA_DIR.mkdir(exist_ok=True)

# Initialisation de ChromaDB
chroma_client = chromadb.PersistentClient(path=str(CHROMA_DIR))

# Fonction d'embedding par défaut
default_ef = embedding_functions.DefaultEmbeddingFunction()

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

# Servir les fichiers statiques
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "frontend" / "static")), name="static")

def extract_text_from_pdf(pdf_bytes):
    """
    Extraire le texte d'un fichier PDF en utilisant PDFPlumber comme extracteur principal
    """
    text = ""
    try:
        # Utiliser PDFPlumber comme extracteur principal
        with pdfplumber.open(BytesIO(pdf_bytes)) as pdf:
            total_pages = len(pdf.pages)
            logger.info(f"Nombre total de pages: {total_pages}")
            
            for i, page in enumerate(pdf.pages):
                try:
                    page_text = page.extract_text() or ""
                    text += page_text + "\n\n"  # Ajouter des sauts de ligne entre les pages
                    logger.info(f"PDFPlumber: Extrait {len(page_text)} caractères de la page {i+1}/{total_pages}")
                except Exception as page_error:
                    logger.warning(f"Erreur lors de l'extraction de la page {i+1}: {str(page_error)}")
                    continue
                
        # Vérifier si du texte a été extrait
        if not text.strip():
            logger.warning("Aucun texte n'a pu être extrait avec PDFPlumber, essai avec PyPDF2")
            # Fallback sur PyPDF2 si PDFPlumber n'a pas réussi à extraire du texte
            reader = PdfReader(BytesIO(pdf_bytes))
            total_pages = len(reader.pages)
            
            for i, page in enumerate(reader.pages):
                try:
                    page_text = page.extract_text() or ""
                    text += page_text + "\n\n"
                    logger.info(f"PyPDF2: Extrait {len(page_text)} caractères de la page {i+1}/{total_pages}")
                except Exception as page_error:
                    logger.warning(f"Erreur lors de l'extraction de la page {i+1} avec PyPDF2: {str(page_error)}")
                    continue
        
        # Vérifier si du texte a été extrait après les deux tentatives
        if not text.strip():
            logger.warning("Aucun texte n'a pu être extrait du PDF avec les deux méthodes")
            return "Aucun texte n'a pu être extrait de ce document. Il s'agit peut-être d'un PDF scanné ou contenant uniquement des images."
        
        logger.info(f"Extraction terminée: {len(text)} caractères au total")
        return text
    except Exception as e:
        logger.error(f"Erreur lors de l'extraction du PDF : {str(e)}")
        raise Exception(f"Impossible d'extraire le texte du PDF: {str(e)}")

def parse_text(text):
    """
    Analyser et nettoyer le texte extrait du PDF
    """
    try:
        logger.info("Début du parsing du texte...")
        start_time = time.time()
        
        # Supprimer les espaces multiples
        cleaned_text = re.sub(r'\s+', ' ', text)
        
        # Supprimer les sauts de page et les marques de pagination
        cleaned_text = re.sub(r'\f', ' ', cleaned_text)
        cleaned_text = re.sub(r'\d+\s*\|\s*Page', '', cleaned_text)
        
        # Supprimer les en-têtes et pieds de page répétitifs (si identifiables)
        # Ceci est une simplification, vous devrez adapter selon vos documents
        cleaned_text = re.sub(r'(?i)(confidential|draft|internal use only)\s*', '', cleaned_text)
        
        # Normaliser les sauts de ligne
        cleaned_text = re.sub(r'\n{3,}', '\n\n', cleaned_text)
        
        # Supprimer les caractères non imprimables
        cleaned_text = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]', '', cleaned_text)
        
        # Normaliser les tirets et autres signes de ponctuation
        cleaned_text = cleaned_text.replace('--', '—').replace('...', '…')
        
        # Identifier et marquer les sections (titres, sous-titres)
        # Ceci est une simplification, vous devrez adapter selon vos documents
        cleaned_text = re.sub(r'(?m)^([A-Z][A-Z\s]+:)', r'\n\n\1', cleaned_text)
        
        # Supprimer les références numériques inutiles
        cleaned_text = re.sub(r'\[\d+\]', '', cleaned_text)
        
        elapsed_time = time.time() - start_time
        logger.info(f"Parsing terminé: {len(cleaned_text)} caractères, durée: {elapsed_time:.2f} secondes")
        
        return cleaned_text
    except Exception as e:
        logger.error(f"Erreur lors du parsing du texte: {str(e)}")
        # En cas d'erreur, retourner le texte original
        return text

def save_document_info(filename: str, text_content: str):
    """
    Sauvegarder les informations du document et indexer son contenu dans ChromaDB
    """
    # Sauvegarder les informations du document
    documents = []
    if DOCS_INFO_FILE.exists():
        with open(DOCS_INFO_FILE, "r", encoding="utf-8") as f:
            documents = json.load(f)
    
    document_info = {
        "filename": filename,
        "created_at": datetime.now().isoformat(),
        "text_length": len(text_content)
    }
    
    documents.append(document_info)
    
    with open(DOCS_INFO_FILE, "w", encoding="utf-8") as f:
        json.dump(documents, f, ensure_ascii=False, indent=2)
    
    # Indexer le contenu dans ChromaDB
    try:
        # Créer ou récupérer la collection
        collection_name = "documents"
        try:
            collection = chroma_client.get_collection(name=collection_name, embedding_function=default_ef)
            logger.info(f"Collection ChromaDB '{collection_name}' récupérée")
        except:
            collection = chroma_client.create_collection(name=collection_name, embedding_function=default_ef)
            logger.info(f"Collection ChromaDB '{collection_name}' créée")
        
        # Découper le texte en chunks pour l'indexation
        chunk_size = 1000
        chunks = [text_content[i:i+chunk_size] for i in range(0, len(text_content), chunk_size)]
        
        # Préparer les IDs et les métadonnées
        doc_id_base = filename.replace(".", "_")
        ids = [f"{doc_id_base}_chunk_{i}" for i in range(len(chunks))]
        metadatas = [{"filename": filename, "chunk": i, "total_chunks": len(chunks)} for i in range(len(chunks))]
        
        # Ajouter les chunks à la collection
        collection.add(
            documents=chunks,
            ids=ids,
            metadatas=metadatas
        )
        
        logger.info(f"Document '{filename}' indexé dans ChromaDB avec {len(chunks)} chunks")
    except Exception as e:
        logger.error(f"Erreur lors de l'indexation dans ChromaDB: {str(e)}")
        # Ne pas faire échouer le traitement si l'indexation échoue

@app.get("/")
async def read_root():
    """
    Route racine qui renvoie la page d'accueil
    """
    return FileResponse(str(BASE_DIR / "frontend" / "index.html"))

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    Endpoint pour télécharger un fichier
    """
    logger.info(f"Réception du fichier: {file.filename}")
    
    # Vérifier si le fichier est un PDF
    if not file.filename.lower().endswith('.pdf'):
        logger.warning(f"Type de fichier non supporté: {file.filename}")
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": "Seuls les fichiers PDF sont acceptés"}
        )
    
    try:
        # Lire le contenu du fichier
        content = await file.read()
        logger.info(f"Taille du fichier: {len(content)} octets")
        
        try:
            # Étape 1 : Extraction du texte
            logger.info("[Étape 1/5] Extraction du texte...")
            text_content = extract_text_from_pdf(content)
            logger.info(f"Texte extrait: {len(text_content)} caractères")
            
            # Vérification de l'intégrité du texte extrait
            if not text_content or len(text_content) < 10:
                raise Exception("Le texte extrait est trop court ou vide")
            
            # Étape 2 : Parsing et nettoyage du texte
            logger.info("[Étape 2/5] Parsing et nettoyage du texte...")
            parsed_text = parse_text(text_content)
            logger.info(f"Texte parsé: {len(parsed_text)} caractères")
            
            # Étape 3 : Découpage en chunks
            logger.info("[Étape 3/5] Découpage en chunks...")
            chunk_size = 1000
            chunks = [parsed_text[i:i+chunk_size] for i in range(0, len(parsed_text), chunk_size)]
            logger.info(f"Nombre de chunks créés: {len(chunks)}")
            
            # Vérification de l'intégrité des chunks
            if not chunks or len(chunks) == 0:
                raise Exception("Aucun chunk n'a été créé")
            
            # Étape 4 : Création des embeddings et indexation
            logger.info("[Étape 4/5] Création des embeddings et indexation...")
            # Simuler un délai pour l'interface utilisateur
            time.sleep(1)
            
            # Étape 5 : Sauvegarde
            logger.info("[Étape 5/5] Sauvegarde et indexation...")
            save_document_info(file.filename, parsed_text)
            logger.info("Traitement terminé avec succès")
        except Exception as pipeline_error:
            logger.error(f"Erreur dans le pipeline de traitement: {str(pipeline_error)}")
            return JSONResponse(
                status_code=500,
                content={"status": "error", "message": f"Erreur lors du traitement: {str(pipeline_error)}"}
            )
        
        # Préparer la réponse
        response_data = {
            "status": "success",
            "message": "Document traité avec succès",
            "document": {
                "filename": file.filename,
                "type": "pdf",
                "size": len(content),
                "text_length": len(text_content),
                "created_at": datetime.now().isoformat(),
                "preview": text_content[:5000]  # Limiter la prévisualisation
            }
        }
        
        return JSONResponse(content=response_data)
    
    except Exception as e:
        logger.error(f"Erreur lors du traitement du fichier: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": f"Erreur lors du traitement du fichier: {str(e)}"}
        )

@app.get("/api/download/{filename}")
async def download_document(filename: str):
    """
    Endpoint pour télécharger le résultat du traitement d'un document
    """
    logger.info(f"Demande de téléchargement pour le fichier: {filename}")
    
    try:
        # Rechercher le document dans la liste
        documents = []
        if DOCS_INFO_FILE.exists():
            with open(DOCS_INFO_FILE, "r", encoding="utf-8") as f:
                documents = json.load(f)
        
        # Vérifier si le document existe
        document_info = None
        for doc in documents:
            if doc["filename"] == filename:
                document_info = doc
                break
        
        if not document_info:
            logger.warning(f"Document non trouvé: {filename}")
            return JSONResponse(
                status_code=404,
                content={"status": "error", "message": "Document non trouvé"}
            )
        
        # Récupérer le texte extrait du document s'il existe
        extracted_text = ""
        try:
            # Vérifier si le fichier PDF existe dans le répertoire d'upload
            pdf_path = UPLOAD_DIR / filename
            if pdf_path.exists():
                # Extraire le texte du PDF
                with open(pdf_path, "rb") as pdf_file:
                    pdf_content = pdf_file.read()
                    extracted_text = extract_text_from_pdf(pdf_content)
            else:
                logger.warning(f"Fichier PDF non trouvé: {filename}")
        except Exception as extract_error:
            logger.error(f"Erreur lors de l'extraction du texte: {str(extract_error)}")
            extracted_text = "Erreur lors de l'extraction du texte du document"
        
        # Créer un fichier temporaire pour le JSON
        with tempfile.NamedTemporaryFile(delete=False, suffix=".json") as temp_file:
            temp_path = temp_file.name
            
            # Écrire les données JSON
            json_data = {
                "filename": filename,
                "type": "pdf",
                "created_at": document_info["created_at"],
                "extracted_text": extracted_text
            }
            
            json.dump(json_data, temp_file, ensure_ascii=False, indent=2)
        
        # Renvoyer le fichier JSON
        return FileResponse(
            path=temp_path,
            filename=f"{os.path.splitext(filename)[0]}.json",
            media_type="application/json"
        )
    
    except Exception as e:
        logger.error(f"Erreur lors du téléchargement du document: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": f"Erreur lors du téléchargement du document: {str(e)}"}
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
