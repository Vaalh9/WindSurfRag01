// Script JavaScript essentiel pour les fonctionnalités de base
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM chargé, initialisation de l\'application');
    
    // Variables globales
    let currentDocument = null;
    
    // Éléments du DOM
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const chatForm = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInput');
    const chatMessages = document.getElementById('chatMessages');
    
    // Gestion des onglets
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            // Retirer la classe active de tous les onglets
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            // Ajouter la classe active à l'onglet cliqué
            tab.classList.add('active');
            const tabContent = document.getElementById(tab.dataset.tab);
            if (tabContent) {
                tabContent.classList.add('active');
            }
        });
    });
    
    // Gestion du drag & drop
    if (dropzone) {
        dropzone.addEventListener('click', () => fileInput.click());
        
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });
        
        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('dragover');
        });
        
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            
            if (e.dataTransfer.files.length > 0) {
                handleFiles(e.dataTransfer.files);
            }
        });
    }
    
    // Gestion de l'input file
    if (fileInput) {
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                handleFiles(fileInput.files);
            }
        });
    }
    
    // Gestion du chat
    if (chatForm) {
        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const message = chatInput.value.trim();
            if (message) {
                sendMessage(message);
                chatInput.value = '';
            }
        });
    }
    
    // Fonctions utilitaires
    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
    
    // Fonction pour gérer l'upload de fichiers
    function handleFiles(files) {
        const processingSteps = document.getElementById('processingSteps');
        const previewSection = document.getElementById('previewSection');
        if (!processingSteps) return;
        
        // Afficher la section de traitement
        processingSteps.classList.remove('hidden');
        
        // Masquer la prévisualisation précédente
        if (previewSection) {
            previewSection.classList.add('hidden');
        }
        
        // Réinitialiser les étapes
        document.querySelectorAll('.step').forEach(step => {
            step.classList.remove('active', 'completed');
            const progressFill = step.querySelector('.progress-fill');
            if (progressFill) {
                progressFill.style.width = '0%';
            }
        });
        
        // Traiter chaque fichier
        Array.from(files).forEach(async (file) => {
            console.log('Traitement du fichier:', file.name, 'Type:', file.type, 'Taille:', file.size);
            
            // Vérifier le type de fichier
            if (!file.name.endsWith('.md') && !file.name.endsWith('.pdf')) {
                alert('Seuls les fichiers Markdown (.md) et PDF (.pdf) sont acceptés');
                return;
            }
            
            // Créer un FormData pour l'upload
            const formData = new FormData();
            formData.append('file', file);
            
            try {
                // Mettre à jour l'étape d'extraction
                updateProcessingStep('extract', 'active');
                console.log('Étape 1: Extraction du texte en cours...');
                
                // Envoyer le fichier au serveur
                const response = await fetch('http://localhost:8080/api/upload', {
                    method: 'POST',
                    body: formData
                });
                
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('Erreur du serveur:', errorText);
                    throw new Error(`Erreur lors de l'upload: ${response.status} - ${errorText}`);
                }
                
                const data = await response.json();
                console.log('Réponse du serveur:', data);
                
                // Stocker le document pour le téléchargement
                currentExtractedContent = {
                    filename: data.document.filename,
                    content: data.document.preview || '',
                    type: data.document.type
                };
                console.log('Contenu extrait mis à jour:', currentExtractedContent);
                
                // Mettre à jour les étapes de traitement
                updateProcessingStep('extract', 'completed');
                updateProcessingStep('chunk', 'active');
                console.log('Étape 2: Découpage en chunks en cours...');
                
                setTimeout(() => {
                    updateProcessingStep('chunk', 'completed');
                    updateProcessingStep('embed', 'active');
                    console.log('Étape 3: Génération des embeddings en cours...');
                    
                    setTimeout(() => {
                        updateProcessingStep('embed', 'completed');
                        updateProcessingStep('index', 'active');
                        console.log('Étape 4: Indexation vectorielle en cours...');
                        
                        setTimeout(() => {
                            updateProcessingStep('index', 'completed');
                            console.log('Traitement terminé avec succès!');
                            
                            // Afficher la prévisualisation
                            displayPreview(data.document);
                            
                            // Mettre à jour la liste des documents
                            updateDocumentsList();
                            
                            // Configurer le bouton de téléchargement
                            setupDownloadButton();
                        }, 1000);
                    }, 1000);
                }, 1000);
            } catch (error) {
                console.error('Erreur lors de l\'upload:', error);
                alert('Erreur lors de l\'upload: ' + error.message);
                
                // Réinitialiser les étapes
                document.querySelectorAll('.step').forEach(step => {
                    step.classList.remove('active', 'completed');
                    const progressFill = step.querySelector('.progress-fill');
                    if (progressFill) {
                        progressFill.style.width = '0%';
                    }
                });
            }
        });
    }
    
    // Variable globale pour stocker le contenu extrait actuel
    let currentExtractedContent = null;
    
    // Ajouter l'événement de téléchargement au chargement de la page
    document.addEventListener('DOMContentLoaded', function() {
        const downloadBtn = document.getElementById('downloadExtractBtn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', downloadExtractedContent);
            console.log('Gestionnaire d\'\u00e9vénement de téléchargement initialisé');
        }
        
        // Ajouter un gestionnaire global pour tous les boutons de téléchargement futurs
        document.body.addEventListener('click', function(e) {
            if (e.target && e.target.id === 'downloadExtractBtn' || 
                (e.target.parentElement && e.target.parentElement.id === 'downloadExtractBtn')) {
                e.preventDefault();
                e.stopPropagation();
                console.log('Clic détecté sur le bouton de téléchargement via délégation');
                downloadExtractedContent(e);
            }
        });
    });
    
    // Fonction pour afficher la prévisualisation du document
    function displayPreview(document) {
        if (!document) {
            console.error('Aucun document à afficher');
            return;
        }
        
        console.log('Affichage de la prévisualisation pour:', document.filename);
        console.log('Document complet:', document);
        console.log('Type de preview:', typeof document.preview);
        console.log('Longueur de preview:', document.preview ? document.preview.length : 0);
        
        // Rendre visible la prévisualisation
        const preview = document.getElementById('preview');
        if (preview) {
            preview.style.display = 'block';
            console.log('Section de prévisualisation rendue visible');
        } else {
            console.error('Section de prévisualisation non trouvée');
        }
        
        // Stocker le contenu extrait pour le téléchargement
        currentExtractedContent = {
            filename: document.filename,
            content: document.preview || '',
            type: document.type
        };
        
        // Afficher les métadonnées du document
        const documentName = document.getElementById('documentName');
        const documentType = document.getElementById('documentType');
        const documentSize = document.getElementById('documentSize');
        
        if (documentName) {
            documentName.textContent = document.filename || 'Document sans nom';
            console.log('Nom du document mis à jour:', document.filename);
        }
        
        if (documentType) {
            let typeLabel = '';
            if (document.type === 'markdown') {
                typeLabel = 'Markdown';
            } else if (document.type === 'pdf') {
                typeLabel = 'PDF';
            } else {
                typeLabel = document.type || 'Type inconnu';
            }
            documentType.textContent = typeLabel;
            console.log('Type du document mis à jour:', typeLabel);
        }
        
        if (documentSize) {
            const size = document.size || 0;
            let sizeText = '';
            if (size < 1024) {
                sizeText = `${size} octets`;
            } else if (size < 1024 * 1024) {
                sizeText = `${(size / 1024).toFixed(2)} Ko`;
            } else {
                sizeText = `${(size / (1024 * 1024)).toFixed(2)} Mo`;
            }
            documentSize.textContent = sizeText;
            console.log('Taille du document mise à jour:', sizeText);
        }
        
        // Afficher le contenu extrait directement dans le HTML
        const extractedContent = document.getElementById('extractedContent');
        if (extractedContent) {
            console.log('Element extractedContent trouvé');
            if (document.preview && document.preview.length > 0) {
                // Échapper les caractères HTML pour éviter les injections XSS
                const escapedContent = document.preview
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#039;');
                
                // Afficher le contenu avec une mise en forme préservée et une barre de défilement
                extractedContent.innerHTML = `<pre style="white-space: pre-wrap; word-break: break-word; max-height: 500px; overflow-y: auto; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">${escapedContent}</pre>`;
                console.log('Contenu extrait affiché, longueur:', document.preview.length);
                console.log('Début du contenu affiché:', document.preview.substring(0, 100));
                
                // Force le rafraîchissement de l'affichage
                setTimeout(() => {
                    extractedContent.style.display = 'none';
                    extractedContent.offsetHeight; // Force reflow
                    extractedContent.style.display = 'block';
                }, 50);
            } else {
                extractedContent.innerHTML = '<p>Aucun contenu extrait disponible</p>';
                console.error('Aucun contenu preview disponible dans le document');
            }
        } else {
            console.error('Element extractedContent non trouvé');
        }
        
        // Rendre visible la section de prévisualisation dans l'onglet
        const previewSection = document.getElementById('previewSection');
        if (previewSection) {
            previewSection.classList.remove('hidden');
        }
        
        // Rendre visible la prévisualisation elle-même
        const previewElement = document.getElementById('preview');
        if (previewElement) {
            previewElement.style.display = 'block';
        }
        
        // Stocker le contenu extrait pour le téléchargement
        currentExtractedContent = {
            filename: document.filename,
            content: document.preview || '',
            type: document.type
        };
        
        // Afficher les métadonnées du document
        const documentNameElement = document.getElementById('documentName');
        const documentTypeElement = document.getElementById('documentType');
        const documentSizeElement = document.getElementById('documentSize');
        
        if (documentNameElement) {
            documentNameElement.textContent = document.filename || 'Document sans nom';
        }
        
        if (documentTypeElement) {
            let typeLabel = '';
            if (document.type === 'markdown') {
                typeLabel = 'Markdown';
            } else if (document.type === 'pdf') {
                typeLabel = 'PDF';
            } else {
                typeLabel = document.type || 'Type inconnu';
            }
            documentType.textContent = typeLabel;
        }
        
        if (documentSize) {
            const size = document.size || 0;
            let sizeText = '';
            if (size < 1024) {
                sizeText = `${size} octets`;
            } else if (size < 1024 * 1024) {
                sizeText = `${(size / 1024).toFixed(2)} Ko`;
            } else {
                sizeText = `${(size / (1024 * 1024)).toFixed(2)} Mo`;
            }
            documentSize.textContent = sizeText;
        }
        
        // Basculer vers l'onglet de prévisualisation
        const previewTab = document.querySelector('.tab[data-tab="preview"]');
        if (previewTab) {
            previewTab.click();
        }
        
        // Configurer le bouton de téléchargement
        setupDownloadButton();
        
        // Définir un délai pour s'assurer que tout est bien chargé
        setTimeout(() => {
            // Afficher le contenu extrait dans la section de prévisualisation principale
            const extractedContent = document.getElementById('extractedContent');
            if (extractedContent) {
                // Afficher le contenu brut extrait
                if (document.preview) {
                    extractedContent.innerHTML = `<pre>${document.preview}</pre>`;
                    console.log('Contenu extrait affiché');
                } else {
                    extractedContent.innerHTML = '<p>Aucun contenu extrait disponible</p>';
                }
            }
        }, 500);
    }
    
    // Fonction pour télécharger le contenu extrait
    function downloadExtractedContent(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        console.log('Fonction de téléchargement appelée');
        console.log('Contenu extrait disponible:', currentExtractedContent);
        
        // Récupérer le contenu extrait directement depuis l'élément HTML si currentExtractedContent n'est pas disponible
        if (!currentExtractedContent || !currentExtractedContent.content) {
            const extractedContent = document.getElementById('extractedContent');
            if (extractedContent && extractedContent.textContent.trim().length > 0) {
                // Créer un objet currentExtractedContent à partir du contenu HTML
                currentExtractedContent = {
                    filename: 'document_extrait',
                    content: extractedContent.textContent,
                    type: 'text'
                };
                console.log('Contenu extrait récupéré depuis le DOM:', currentExtractedContent);
            } else {
                console.error('Aucun contenu disponible à télécharger');
                alert('Aucun contenu disponible à télécharger. Veuillez d\'abord uploader un document.');
                return;
            }
        }
        
        // Afficher un message de débogage
        console.log('Détails du contenu à télécharger:');
        console.log('- Nom du fichier:', currentExtractedContent.filename);
        console.log('- Type:', currentExtractedContent.type);
        console.log('- Taille du contenu:', currentExtractedContent.content.length, 'caractères');
        console.log('- Début du contenu:', currentExtractedContent.content.substring(0, 100));
        
        try {
            let fileContent = currentExtractedContent.content;
            let fileType = 'text/plain';
            let fileExtension = '.txt';
            
            // Si c'est un document Markdown, conserver l'extension .md
            if (currentExtractedContent.type === 'markdown') {
                fileExtension = '.md';
            } else {
                // Pour les PDF, formater le texte pour qu'il ressemble à du Markdown
                fileContent = fileContent
                    .split('\n\n')
                    .map(paragraph => paragraph.trim())
                    .filter(paragraph => paragraph.length > 0)
                    .map(paragraph => {
                        // Détecter les titres potentiels
                        if (paragraph.length < 80 && !paragraph.endsWith('.')) {
                            return `## ${paragraph}`;
                        }
                        return paragraph;
                    })
                    .join('\n\n');
                fileExtension = '.md';
            }
            
            // Créer un blob avec le contenu extrait
            const blob = new Blob([fileContent], { type: fileType });
            const url = URL.createObjectURL(blob);
            
            // Créer un lien de téléchargement et cliquer dessus
            const a = document.createElement('a');
            a.href = url;
            a.download = `extraction_${currentExtractedContent.filename.replace(/\.[^/.]+$/, '')}${fileExtension}`;
            document.body.appendChild(a);
            
            console.log('Téléchargement du fichier:', a.download);
            a.click();
            
            // Nettoyer
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                console.log('Nettoyage effectué');
            }, 100);
        } catch (error) {
            console.error('Erreur lors du téléchargement:', error);
            alert('Erreur lors du téléchargement: ' + error.message);
        }
    }
    
    // Fonction pour configurer le bouton de téléchargement
    function setupDownloadButton() {
        const downloadBtn = document.getElementById('downloadExtractBtn');
        if (!downloadBtn) {
            console.error('Bouton de téléchargement non trouvé');
            return;
        }
        
        // Supprimer tous les gestionnaires d'événements existants
        const newBtn = downloadBtn.cloneNode(true);
        downloadBtn.parentNode.replaceChild(newBtn, downloadBtn);
        
        // Ajouter le nouveau gestionnaire d'événement
        newBtn.addEventListener('click', downloadExtractedContent);
        
        // Ajouter un attribut de données pour indiquer que le bouton est prêt
        newBtn.dataset.ready = 'true';
        
        console.log('Bouton de téléchargement configuré');
    }
    
    // Fonction pour créer la section de prévisualisation si elle n'existe pas
    function createPreviewSection() {
        const uploadTab = document.getElementById('upload');
        if (!uploadTab) return null;
        
        const previewSection = document.createElement('div');
        previewSection.id = 'previewSection';
        previewSection.className = 'preview-section';
        previewSection.innerHTML = `
            <h3 class="preview-title">Prévisualisation</h3>
            <div class="preview-container">
                <div class="preview-info"></div>
                <div class="preview-content"></div>
            </div>
        `;
        
        uploadTab.appendChild(previewSection);
        return previewSection;
    }
    
    // Fonction pour mettre à jour une étape de traitement
    function updateProcessingStep(stepName, status) {
        const step = document.querySelector(`.step[data-step="${stepName}"]`);
        if (!step) return;
        
        console.log(`Mise à jour de l'étape ${stepName} avec le statut ${status}`);
        
        // Mettre à jour le statut
        step.classList.remove('active', 'completed');
        step.classList.add(status);
        
        // Mettre à jour la barre de progression
        const progressFill = step.querySelector('.progress-fill');
        if (progressFill) {
            if (status === 'active') {
                progressFill.style.width = '50%';
            } else if (status === 'completed') {
                progressFill.style.width = '100%';
            }
        }
    }
    
    // Fonction pour afficher la liste des documents
    async function updateDocumentsList() {
        const documentsList = document.getElementById('documentsList');
        if (!documentsList) return;
        
        try {
            const response = await fetch('http://localhost:8080/api/documents');
            if (!response.ok) {
                throw new Error(`Erreur lors de la récupération des documents: ${response.status}`);
            }
            
            const documents = await response.json();
            documentsList.innerHTML = '';
            
            if (documents.length === 0) {
                documentsList.innerHTML = `
                    <div class="document-item">
                        <p>Aucun document indexé</p>
                    </div>
                `;
                return;
            }
            
            documents.forEach(doc => {
                const docElement = document.createElement('div');
                docElement.className = 'document-item';
                
                // Déterminer le type de document
                let docType = 'Document';
                if (doc.filename.endsWith('.pdf')) {
                    docType = 'PDF';
                } else if (doc.filename.endsWith('.md')) {
                    docType = 'Markdown';
                }
                
                docElement.innerHTML = `
                    <span>${doc.filename}</span>
                    <span class="document-type">${docType}</span>
                    <div class="actions">
                        <button class="view-button" data-filename="${doc.filename}">
                            <span class="material-icons">visibility</span> Voir
                        </button>
                        <button class="delete-button" data-filename="${doc.filename}">
                            <span class="material-icons">delete</span> Supprimer
                        </button>
                    </div>
                `;
                documentsList.appendChild(docElement);
                
                // Ajouter les événements
                docElement.querySelector('.view-button').addEventListener('click', () => {
                    currentDocument = doc.filename;
                    // Changer d'onglet pour le chat
                    const chatTab = document.querySelector('.tab[data-tab="chat"]');
                    if (chatTab) {
                        chatTab.click();
                    }
                    alert(`Document sélectionné: ${doc.filename}. Vous pouvez maintenant discuter avec Mistral à propos de ce document.`);
                });
                
                docElement.querySelector('.delete-button').addEventListener('click', async () => {
                    if (confirm(`Voulez-vous vraiment supprimer le document "${doc.filename}" ?`)) {
                        try {
                            const response = await fetch(`http://localhost:8080/api/documents/${encodeURIComponent(doc.filename)}`, {
                                method: 'DELETE'
                            });
                            
                            if (!response.ok) {
                                throw new Error(`Erreur lors de la suppression: ${response.status}`);
                            }
                            
                            alert(`Le document "${doc.filename}" a été supprimé avec succès.`);
                            updateDocumentsList();
                        } catch (error) {
                            console.error('Erreur:', error);
                            alert('Une erreur est survenue lors de la suppression du document: ' + error.message);
                        }
                    }
                });
            });
        } catch (error) {
            console.error('Erreur:', error);
            documentsList.innerHTML = `
                <div class="document-item">
                    <p>Erreur lors de la récupération des documents: ${error.message}</p>
                </div>
            `;
        }
    }
    
    // Fonction pour envoyer un message au chatbot
    async function sendMessage(message) {
        if (!message.trim()) return;
        
        if (!chatMessages) return;
        
        // Vérifier si un document est sélectionné
        if (!currentDocument) {
            alert('Veuillez d\'abord sélectionner un document en cliquant sur "Voir" dans la liste des documents.');
            return;
        }
        
        // Ajouter le message de l'utilisateur
        const userMessageElement = document.createElement('div');
        userMessageElement.className = 'message user-message';
        userMessageElement.innerHTML = `<p>${message}</p>`;
        chatMessages.appendChild(userMessageElement);
        
        // Ajouter un message de chargement
        const loadingElement = document.createElement('div');
        loadingElement.className = 'message bot-message loading';
        loadingElement.innerHTML = `<p>Mistral réfléchit...</p>`;
        chatMessages.appendChild(loadingElement);
        
        // Faire défiler vers le bas
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        try {
            console.log('Envoi de la requête au chatbot avec document:', currentDocument);
            
            // Envoyer la requête au backend
            const response = await fetch('http://localhost:8080/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    message: message, 
                    document_id: currentDocument 
                })
            });
            
            console.log('Statut de la réponse:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Erreur du serveur:', errorText);
                throw new Error(`Erreur lors de la communication avec le chatbot: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Réponse reçue:', data);
            
            // Remplacer le message de chargement par la réponse
            if (data && data.response) {
                loadingElement.innerHTML = `<p>${data.response}</p>`;
                loadingElement.classList.remove('loading');
                
                // Ajouter un bouton pour ouvrir la prévisualisation
                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'message-actions';
                actionsDiv.innerHTML = `<button class="preview-button">Ouvrir la prévisualisation</button>`;
                loadingElement.appendChild(actionsDiv);
                
                // Ajouter l'événement pour le bouton de prévisualisation
                actionsDiv.querySelector('.preview-button').addEventListener('click', () => {
                    console.log('Ouverture de la prévisualisation');
                    
                    // Changer d'onglet pour la prévisualisation
                    const previewTab = document.querySelector('.tab[data-tab="preview"]');
                    if (previewTab) {
                        previewTab.click();
                    }
                });
            } else {
                throw new Error('Réponse vide ou invalide du serveur');
            }
            
            // Faire défiler vers le bas
            chatMessages.scrollTop = chatMessages.scrollHeight;
        } catch (error) {
            console.error('Erreur:', error);
            loadingElement.innerHTML = `<p>Désolé, une erreur est survenue: ${error.message}</p>`;
            loadingElement.classList.remove('loading');
            loadingElement.classList.add('error');
        }
    }
    
    // Initialiser l'application
    updateDocumentsList();
});
