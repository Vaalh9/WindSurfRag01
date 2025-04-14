import os
import requests
from pathlib import Path

def download_file(url: str, dest_path: Path, chunk_size: int = 8192):
    response = requests.get(url, stream=True)
    total_size = int(response.headers.get('content-length', 0))
    
    with open(dest_path, 'wb') as f:
        for chunk in response.iter_content(chunk_size=chunk_size):
            if chunk:
                f.write(chunk)
                f.flush()

def main():
    # Créer le dossier models s'il n'existe pas
    models_dir = Path("models")
    models_dir.mkdir(exist_ok=True)
    
    # URL du modèle Mistral 7B quantifié
    model_url = "https://huggingface.co/TheBloke/Mistral-7B-v0.1-GGUF/resolve/main/mistral-7b-v0.1.Q4_K_M.gguf"
    model_path = models_dir / "mistral-7b-v0.1.Q4_K_M.gguf"
    
    if not model_path.exists():
        print(f"Téléchargement du modèle vers {model_path}...")
        download_file(model_url, model_path)
        print("Téléchargement terminé!")
    else:
        print("Le modèle existe déjà.")

if __name__ == "__main__":
    main()
