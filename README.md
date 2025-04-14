# MarkitDown RAG

Un système RAG (Retrieval-Augmented Generation) 100% local pour les fichiers Markdown.

## Composants

- **Embeddings** : Sentence-Transformers (all-MiniLM-L6-v2)
- **LLM** : Mistral 7B (quantifié)
- **Vector Store** : ChromaDB
- **API** : FastAPI

## Installation

1. Créez un environnement virtuel et activez-le :
```bash
python -m venv venv
source venv/bin/activate  # Pour Linux/Mac
# ou
.\venv\Scripts\activate  # Pour Windows
```

2. Installez les dépendances :
```bash
pip install -r requirements.txt
```

3. Téléchargez le modèle Llama 2 :
```bash
python download_model.py
```

## Utilisation

1. Démarrez le serveur :
```bash
python app.py
```

2. L'API sera disponible sur `http://localhost:8000`

3. Endpoints disponibles :
   - POST `/upload/` : Pour télécharger et indexer un fichier Markdown
   - POST `/query/` : Pour interroger la base de connaissances

4. Vous pouvez accéder à la documentation interactive de l'API sur `http://localhost:8000/docs`

## Notes

- Le modèle Mistral 7B utilisé est une version quantifiée (Q4_K_M) qui offre un excellent compromis entre performance et utilisation mémoire
- Les embeddings sont générés avec le modèle all-MiniLM-L6-v2, qui offre un excellent rapport qualité/performance
- Toutes les opérations sont effectuées localement, aucune donnée n'est envoyée à des services externes
- Le modèle peut utiliser le GPU si disponible en modifiant le paramètre `n_gpu_layers` dans `app.py`
