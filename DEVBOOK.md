# DEVBOOK - MarkitDown RAG

## 🎯 Objectif du Projet
Créer un système RAG (Retrieval-Augmented Generation) 100% local pour les fichiers Markdown, utilisant Mistral comme LLM.

## 📚 Stack Technique
- **Framework**: LlamaIndex (anciennement GPTIndex)
- **LLM**: Mistral 7B (version quantifiée Q4_K_M)
- **Embeddings**: Sentence-Transformers (all-MiniLM-L6-v2)
- **Vector Store**: Simple Vector Store (intégré à LlamaIndex)
- **API**: FastAPI
- **Langage**: Python 3.9+
- **Parseurs de Documents**:
  - Markdown (natif)
  - PDF (via PyPDF2)

## 💡 Pourquoi LlamaIndex ?
- Architecture plus simple et plus intuitive que LangChain
- Meilleure intégration avec les LLMs locaux
- Gestion optimisée des documents structurés
- Support natif des documents Markdown

## 🛠 Guide d'Installation et de Déploiement

### Installation Locale
1. Cloner le dépôt
2. Créer un environnement virtuel : `python -m venv venv`
3. Activer l'environnement virtuel : `source venv/bin/activate` (Linux/Mac) ou `venv\Scripts\activate` (Windows)
4. Installer les dépendances : `pip install -r requirements.txt`
5. Lancer l'application : `uvicorn app:app --reload`

### Déploiement avec Docker
1. Construire l'image :
   ```bash
   docker build -t markitdown-rag .
   ```

2. Lancer le conteneur :
   ```bash
   docker run -d -p 8000:8000 -v $(pwd)/storage:/app/storage markitdown-rag
   ```

   Note : Sur Windows PowerShell, remplacer `$(pwd)` par `${PWD}` ou le chemin absolu.

3. L'API sera disponible sur `http://localhost:8000`

### 1. Préparation de l'Environnement
```bash
# Créer un environnement virtuel
python -m venv venv

# Activer l'environnement
# Sur Windows :
.\venv\Scripts\activate
# Sur Linux/Mac :
source venv/bin/activate

# Installer les dépendances
pip install -r requirements.txt
```

### 2. Configuration du Modèle
```bash
# Télécharger le modèle Mistral
python download_model.py
```

### 3. Démarrage de l'Application
```bash
# Lancer le serveur FastAPI
python app.py
```

## 🔄 Workflow de Développement

### Structure du Projet
```
markitdown-rag/
├── app.py              # Application FastAPI principale
├── download_model.py   # Script de téléchargement du modèle
├── requirements.txt    # Dépendances Python
├── README.md          # Documentation utilisateur
├── DEVBOOK.md         # Documentation développeur
├── models/            # Dossier contenant les modèles
│   └── mistral-7b-v0.1.Q4_K_M.gguf
└── storage/           # Stockage des index et embeddings
    ├── embeddings/
    └── index/
```

### Points Techniques Importants

#### Configuration du LLM et Index (app.py)
```python
from llama_index.llms import LlamaCPP
from llama_index.embeddings import HuggingFaceEmbedding

# Configuration du LLM
llm = LlamaCPP(
    model_path="models/mistral-7b-v0.1.Q4_K_M.gguf",
    temperature=0.7,
    max_tokens=2000,
    context_window=4096,
    model_kwargs={"n_gpu_layers": 0}  # -1 pour GPU
)

# Configuration des embeddings
embedding_model = HuggingFaceEmbedding(model_name="all-MiniLM-L6-v2")

# Configuration de l'index
service_context = ServiceContext.from_defaults(
    llm=llm,
    embed_model=embedding_model,
    chunk_size=1000,
    chunk_overlap=200
)
```

#### Paramètres d'Index
- **Chunking**:
  - Taille: 1000 caractères
  - Chevauchement: 200 caractères
  - Mode de découpage: Markdown-aware

- **Embeddings**:
  - Modèle: all-MiniLM-L6-v2
  - Dimension: 384
  - Cache: Activé

#### API Endpoints
1. `/upload/` (POST)
   - Upload de fichiers Markdown
   - Création d'index automatique
   - Stockage persistant

2. `/query/` (POST)
   - Recherche sémantique via LlamaIndex
   - Réponses générées avec contexte
   - Support du streaming

## 🔍 Tests et Validation

### Test de l'API
1. Accéder à Swagger UI : http://localhost:8000/docs
2. Tester l'upload de fichiers
3. Tester les requêtes

### Performances
- **Indexation** :
  - Utilisation du cache d'embeddings
  - Indexation incrémentielle
  - Persistance automatique

- **Recherche** :
  - Top-k dynamique
  - Reranking des résultats
  - Filtrage par pertinence

## 📝 Notes de Développement

### Optimisations Possibles
1. Activation du mode GPU pour Mistral
2. Mise en place d'un système de cache distribué
3. Implémentation du streaming des réponses
4. Ajout de métadonnées aux documents
5. Configuration d'un pipeline de pré-traitement personnalisé

### Considérations de Sécurité
- Validation des fichiers uploadés
- Limitation de la taille des fichiers
- Sanitization des entrées utilisateur

## 🔄 Workflow Git
```bash
# Initialisation
git init
git add .
git commit -m "Initial commit: RAG system with Mistral"

# Push vers GitHub
git remote add origin <URL_DU_REPO>
git push -u origin main
```
