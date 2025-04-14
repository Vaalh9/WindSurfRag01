@echo off
echo Activation de l'environnement virtuel...
call venv\Scripts\activate.bat

echo Démarrage du serveur...
python -m uvicorn app:app --reload --host 0.0.0.0

pause
