# DEVBOOK - MarkitDown RAG

## 🎯 Objectif du Projet
Créer un système RAG (Retrieval-Augmented Generation) 100% local pour les fichiers Markdown, utilisant Mistral comme LLM.

## 📚 Stack Technique
- **LLM**: Mistral 7B (version quantifiée Q4_K_M)
- **Embeddings**: Sentence-Transformers (all-MiniLM-L6-v2)
- **Vector Store**: ChromaDB
- **API**: FastAPI
- **Langage**: Python 3.9+

## 🛠 Guide d'Installation et de Déploiement

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
└── models/            # Dossier contenant les modèles
    └── mistral-7b-v0.1.Q4_K_M.gguf
```

### Points Techniques Importants

#### Configuration du LLM (app.py)
```python
llm = LlamaCpp(
    model_path="models/mistral-7b-v0.1.Q4_K_M.gguf",
    temperature=0.7,
    max_tokens=2000,
    top_p=0.95,
    n_ctx=4096,
    n_gpu_layers=0  # -1 pour utiliser le GPU
)
```

#### Paramètres d'Embeddings
- Modèle: all-MiniLM-L6-v2
- Dimension: 384
- Performance: Excellent rapport qualité/vitesse

#### API Endpoints
1. `/upload/` (POST)
   - Upload de fichiers Markdown
   - Chunking et indexation automatique
2. `/query/` (POST)
   - Recherche sémantique
   - Génération de réponses contextuelles

## 🔍 Tests et Validation

### Test de l'API
1. Accéder à Swagger UI : http://localhost:8000/docs
2. Tester l'upload de fichiers
3. Tester les requêtes

### Performances
- Taille des chunks : 1000 tokens
- Chevauchement : 200 tokens
- Top-k pour la recherche : 3 documents

## 📝 Notes de Développement

### Optimisations Possibles
1. Ajout de caching pour les embeddings
2. Parallélisation du traitement des documents
3. Compression des index vectoriels

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
