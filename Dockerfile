FROM ubuntu:22.04

WORKDIR /app

# Installer Python et les outils de build nécessaires
RUN apt-get update && apt-get install -y \
    python3.9 \
    python3.9-dev \
    python3-pip \
    build-essential \
    cmake \
    git \
    libomp-dev \
    && rm -rf /var/lib/apt/lists/*

# Configurer pip
RUN ln -s /usr/bin/python3.9 /usr/bin/python
RUN python -m pip install --upgrade pip

# Copier les fichiers nécessaires
COPY requirements.txt .

# Installer les dépendances
ENV CMAKE_ARGS="-DLLAMA_BLAS=ON -DLLAMA_BLAS_VENDOR=OpenBLAS -DLLAMA_BUILD_TESTS=OFF"
RUN pip install --no-cache-dir -r requirements.txt

# Copier le reste des fichiers
COPY app.py .
COPY models/ ./models/

# Créer les répertoires nécessaires
RUN mkdir -p storage/index storage/embeddings

# Exposer le port
EXPOSE 8000

# Commande de démarrage
CMD ["python", "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
