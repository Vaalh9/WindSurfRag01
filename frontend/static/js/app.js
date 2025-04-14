document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM chargé, initialisation de l\'application');
    
    // Variables globales
    let currentDocumentToDelete = null;
    let currentDocument = null;
    
    // Éléments du DOM
    const deleteModal = document.getElementById('deleteModal');
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const confirmDeleteBtn = document.getElementById('confirmDelete');
    const cancelDeleteBtn = document.getElementById('cancelDelete');
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
    
    // Gestion du bouton Upload new Document
    if (newUploadBtn) {
        newUploadBtn.addEventListener('click', () => {
            if (fileInput) {
                fileInput.click();
            }
        });
    }
    
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
        
        dropzone.addEventListener('drop', async (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            await handleFiles(files);
        });
    }
    
    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            await handleFiles(e.target.files);
        });
    }
    
    // Fonctions utilitaires
    function formatJSON(obj) {
        const jsonString = JSON.stringify(obj, null, 2);
        return jsonString.replace(/"([^"]+)":/g, '<span class="key">"$1":</span>')
                         .replace(/: "([^"]+)"/g, ': <span class="string">"$1"</span>')
                         .replace(/: (\d+)/g, ': <span class="number">$1</span>')
                         .replace(/: (true|false)/g, ': <span class="boolean">$1</span>');
    }
    
    function formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    function updateProcessingStep(step) {
        const steps = document.querySelectorAll('.step');
        steps.forEach(s => {
            s.classList.remove('active');
            s.classList.remove('completed');
            // Réinitialiser la barre de progression
            const progressFill = s.querySelector('.progress-fill');
            if (progressFill) {
                progressFill.style.width = '0%';
                progressFill.textContent = '0%';
            }
        });

        let foundActive = false;
        steps.forEach(s => {
            const stepName = s.getAttribute('data-step');
            if (stepName === step) {
                s.classList.add('active');
                foundActive = true;
                // Animer la barre de progression pour l'étape active
                const progressFill = s.querySelector('.progress-fill');
                if (progressFill) {
                    setTimeout(() => {
                        progressFill.style.width = '50%';
                        progressFill.textContent = '50%';
                    }, 100);
                }
            } else if (!foundActive) {
                s.classList.add('completed');
                // Remplir la barre de progression pour les étapes terminées
                const progressFill = s.querySelector('.progress-fill');
                if (progressFill) {
                    progressFill.style.width = '100%';
                    progressFill.textContent = '100%';
                }
            }
        });
    }
    
    // Gestion des fichiers
    async function handleFiles(files) {
        for (const file of files) {
            if (!file.name.endsWith('.pdf') && !file.name.endsWith('.md')) {
                alert('Seuls les fichiers PDF et Markdown sont acceptés');
                continue;
            }
    
            const formData = new FormData();
            formData.append('file', file);
    
            try {
                // Afficher les étapes de traitement
                const processingSteps = document.getElementById('processingSteps');
                processingSteps.classList.remove('hidden');
                processingSteps.style.display = 'flex';
                updateProcessingStep('extract');

                // Simuler la progression des étapes
                const simulateSteps = ['extract', 'chunk', 'embed', 'index'];
                let currentStepIndex = 0;
                
                const stepInterval = setInterval(() => {
                    if (currentStepIndex < simulateSteps.length - 1) {
                        currentStepIndex++;
                        updateProcessingStep(simulateSteps[currentStepIndex]);
                    } else {
                        clearInterval(stepInterval);
                    }
                }, 2000);

                const response = await fetch('http://localhost:8080/api/upload', {
                    method: 'POST',
                    body: formData
                });
    
                if (!response.ok) {
                    clearInterval(stepInterval);
                    return response.json().then(data => {
                        throw new Error(data.detail || 'Erreur lors de l\'upload');
                    });
                }
    
                const result = await response.json();
                console.log('Réponse du serveur:', result);
                console.log('Type de réponse:', typeof result);
                console.log('Contenu de document:', result.document);
                console.log('Preview disponible:', result.document && result.document.preview ? 'Oui' : 'Non');
                if (result.document && result.document.preview) {
                    console.log('Longueur de preview:', result.document.preview.length);
                    console.log('Début de preview:', result.document.preview.substring(0, 100));
                }
    
                // Mettre à jour les étapes
                clearInterval(stepInterval);
                updateProcessingStep('index');
                setTimeout(() => {
                    const steps = document.querySelectorAll('.step');
                    steps.forEach(s => {
                        s.classList.add('completed');
                        const progressFill = s.querySelector('.progress-fill');
                        if (progressFill) {
                            progressFill.style.width = '100%';
                            progressFill.textContent = '100%';
                        }
                    });
                    
                    // Ajouter le message "Traitement terminé !"
                    const processingSteps = document.getElementById('processingSteps');
                    if (processingSteps) {
                        // Créer le message de traitement terminé
                        const completeMessage = document.createElement('div');
                        completeMessage.className = 'processing-complete';
                        completeMessage.innerHTML = `
                            <div class="complete-icon">
                                <span class="material-icons">check_circle</span>
                            </div>
                            <div class="complete-text">Traitement terminé !</div>
                        `;
                        
                        // Ajouter le message après les étapes de traitement
                        processingSteps.appendChild(completeMessage);
                    }
                    
                    // Mettre à jour l'onglet de résultat avec les données extraites
                    if (window.updateResultTab) {
                        console.log('Appel de updateResultTab avec les données:', result);
                        try {
                            window.updateResultTab(result);
                        } catch (error) {
                            console.error('Erreur lors de la mise à jour de l\'onglet de résultat:', error);
                        }
                    } else {
                        console.error('La fonction updateResultTab n\'est pas disponible');
                    }
                    
                    // Basculer vers l'onglet de résultat après un délai pour permettre de voir le message
                    setTimeout(() => {
                        const resultTab = document.querySelector('[data-tab="result"]');
                        if (resultTab) {
                            resultTab.click();
                        }
                    }, 2500); // Délai plus long pour voir le message
                }, 1000);
    
                // Mettre à jour la liste des documents
                await updateDocumentsList();
    
                // Afficher les informations du document
                const documentInfo = document.getElementById('documentInfo');
                const markdownPreview = document.getElementById('markdownPreview');
                
                if (documentInfo && markdownPreview) {
                    // Formater les informations du document
                    documentInfo.innerHTML = formatJSON({
                        filename: result.document.filename,
                        type: result.document.type,
                        size: formatBytes(result.document.size),
                        text_length: result.document.text_length + ' caractères',
                        created_at: new Date(result.document.created_at).toLocaleString()
                    });
                    
                    // Afficher l'aperçu en markdown avec le contenu complet
                    displayMarkdownPreview(result.document.content || result.document.preview);
                }
            } catch (error) {
                console.error('Erreur lors de l\'upload:', error);
                const documentInfo = document.getElementById('documentInfo');
                const markdownPreview = document.getElementById('markdownPreview');
                
                if (documentInfo) {
                    documentInfo.innerHTML = formatJSON({
                        error: true,
                        detail: error.message
                    });
                }
                
                if (markdownPreview) {
                    markdownPreview.innerHTML = '';
                }
            }
        }
    }
    
    // Fonction pour afficher un document
    async function displayDocument(filename) {
        try {
            // Mettre à jour le document courant pour le chat
            currentDocument = filename;
            
            const response = await fetch(`http://localhost:8080/api/documents/${filename}`);
            if (!response.ok) {
                throw new Error('Erreur lors de la récupération du document');
            }
            
            const document = await response.json();
            currentDocumentId = document.id;
            
            // Afficher les informations du document
            const documentInfo = document.getElementById('documentInfo');
            documentInfo.innerHTML = `
                <h3>${document.filename}</h3>
                <p><strong>Type:</strong> ${document.type}</p>
                <p><strong>Taille:</strong> ${formatBytes(document.size)}</p>
                <p><strong>Date:</strong> ${new Date(document.date).toLocaleString()}</p>
            `;
            
            // Récupérer le contenu complet du document
            let fullContent = '';
            
            // Ajouter le contenu principal
            if (document.content) {
                // Afficher tout le contenu sans troncature
                fullContent += `<h2>Contenu complet</h2>\n${document.content}\n\n`;
            } else if (document.preview) {
                fullContent += `<h2>Aperçu</h2>\n${document.preview}\n\n`;
                // Ajouter un message indiquant que seul l'aperçu est disponible
                fullContent += `<div class="warning">Attention: Seul l'aperçu est disponible. Le contenu complet n'a pas été extrait.</div>\n\n`;
            }
            
            // Ajouter les chunks s'ils existent
            if (document.chunks && document.chunks.length > 0) {
                fullContent += `<h2>Chunks (${document.chunks.length})</h2>\n`;
                document.chunks.forEach((chunk, index) => {
                    fullContent += `<h3>Chunk ${index + 1}</h3>\n${chunk.text || chunk.content || ''}\n\n`;
                });
            }
            
            // Ajouter les métadonnées s'il y en a
            if (document.metadata) {
                fullContent += `<h2>Métadonnées</h2>\n\`\`\`json\n${JSON.stringify(document.metadata, null, 2)}\n\`\`\`\n\n`;
            }
            
            // Afficher le contenu complet en markdown
            displayMarkdownPreview(fullContent);
            
            // Afficher la section d'aperçu
            document.getElementById('preview').style.display = 'block';
            
            // Changer l'onglet actif
            switchTab('chat');
        } catch (error) {
            console.error('Erreur:', error);
            alert('Une erreur est survenue lors de l\'affichage du document');
        }
    }
    
    // Fonction pour afficher le contenu markdown
    function displayMarkdownPreview(markdown) {
        console.log('Affichage du markdown:', markdown);
        const markdownPreview = document.getElementById('markdownPreview');
        if (!markdownPreview) {
            console.error('Element markdownPreview introuvable');
            return;
        }
        
        try {
            // Créer un conteneur pour le contenu si nécessaire
            let fullPreviewScroll = markdownPreview.querySelector('.full-preview-scroll');
            if (!fullPreviewScroll) {
                fullPreviewScroll = document.createElement('div');
                fullPreviewScroll.className = 'full-preview-scroll';
                markdownPreview.appendChild(fullPreviewScroll);
            }
            
            // Vérifier si showdown est défini
            if (typeof showdown === 'undefined') {
                console.warn('Showdown n\'est pas défini, affichage en texte brut');
                fullPreviewScroll.innerHTML = `<pre>${markdown || 'Aucun contenu disponible'}</pre>`;
                return;
            }
            
            // Convertir le markdown en HTML
            const converter = new showdown.Converter();
            const html = converter.makeHtml(markdown || 'Aucun contenu disponible');
            
            // Afficher le HTML
            fullPreviewScroll.innerHTML = html;
            
            // Assurer que la section de prévisualisation est visible
            document.getElementById('preview').style.display = 'block';
        } catch (error) {
            console.error('Erreur lors de l\'affichage du markdown:', error);
            markdownPreview.innerHTML = `<pre>${markdown || 'Aucun contenu disponible'}</pre>`;
        }
    }
    
    // Gestion de la liste des documents
    async function updateDocumentsList() {
        const documentsList = document.getElementById('documentsList');
        if (!documentsList) return;
        
        try {
            const response = await fetch('http://localhost:8080/api/documents');
            const documents = await response.json();
            documentsList.innerHTML = '';
            
            // Ajouter le bouton pour supprimer tous les documents
            if (documents.length > 0) {
                const deleteAllButton = document.createElement('div');
                deleteAllButton.className = 'delete-all-button';
                deleteAllButton.innerHTML = `
                    <button class="danger-button" id="deleteAllButton">
                        <span class="material-icons">delete_sweep</span> Supprimer tous les documents
                    </button>
                `;
                documentsList.appendChild(deleteAllButton);
                
                // Ajouter l'événement de clic pour le bouton de suppression de tous les documents
                document.getElementById('deleteAllButton').addEventListener('click', () => {
                    if (confirm('Voulez-vous vraiment supprimer tous les documents? Cette action est irréversible.')) {
                        deleteAllDocuments();
                    }
                });
            }
            
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
                docElement.innerHTML = `
                    <span>${doc.filename}</span>
                    <div class="actions">
                        <button class="delete-button" data-filename="${doc.filename}">
                            <span class="material-icons">delete</span> Supprimer
                        </button>
                    </div>
                `;
                documentsList.appendChild(docElement);
            });
            
            // Ajouter les événements de clic pour les boutons de suppression
            document.querySelectorAll('.delete-button').forEach(button => {
                button.addEventListener('click', () => {
                    const filename = button.getAttribute('data-filename');
                    showDeleteModal(filename);
                });
            });
        } catch (error) {
            console.error('Erreur:', error);
            documentsList.innerHTML = `
                <div class="document-item">
                    <p>Erreur lors de la récupération des documents</p>
                </div>
            `;
        }
    }
    
    // Fonction pour supprimer tous les documents
    async function deleteAllDocuments() {
        try {
            const response = await fetch('http://localhost:8080/api/documents', {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error('Erreur lors de la suppression des documents');
            }
            
            const result = await response.json();
            console.log(result);
            
            // Mettre à jour la liste des documents
            await updateDocumentsList();
            
            // Afficher un message de succès
            alert(result.message || 'Tous les documents ont été supprimés avec succès');
        } catch (error) {
            console.error('Erreur:', error);
            alert('Une erreur est survenue lors de la suppression des documents: ' + error.message);
        }

    // Fonctions pour la suppression des documents
    function showDeleteModal(filename) {
        currentDocumentToDelete = filename;
        const deleteModal = document.getElementById('deleteModal');
        const deleteModalContent = document.getElementById('deleteModalContent');
        
        if (deleteModal && deleteModalContent) {
            deleteModalContent.textContent = `Voulez-vous vraiment supprimer le document "${filename}" ?`;
            deleteModal.classList.add('active');
        }
    }
    
    function hideDeleteModal() {
        const deleteModal = document.getElementById('deleteModal');
        if (deleteModal) {
            deleteModal.classList.remove('active');
        }
    }
    
    // Supprimer un document
    async function deleteDocument(filename) {
        try {
            const response = await fetch(`http://localhost:8080/api/documents/${encodeURIComponent(filename)}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error('Erreur lors de la suppression du document');
            }
            
            const result = await response.json();
            console.log(result);
            
            // Mettre à jour la liste des documents
            await updateDocumentsList();
            
            // Afficher un message de confirmation
            alert(`Le document "${filename}" a été supprimé avec succès.`);
            
            // Fermer la modal
            hideDeleteModal();
        } catch (error) {
            console.error('Erreur:', error);
            alert('Une erreur est survenue lors de la suppression du document: ' + error.message);
        }
    }
    
    // Initialisation des événements de la modal
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', () => {
            if (currentDocumentToDelete) {
                deleteDocument(currentDocumentToDelete);
            }
        });
    }
    
    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', hideDeleteModal);
    }
    
    // Fermer la modal si on clique en dehors
    if (deleteModal) {
        deleteModal.addEventListener('click', (e) => {
            if (e.target === deleteModal) {
                hideDeleteModal();
            }
        });
    }
    
    // Fonction pour ajouter le bouton de téléchargement
    function addDownloadButton(documentData) {
        const processingSteps = document.getElementById('processingSteps');
        if (!processingSteps) return;
        
        // Vérifier si le bouton existe déjà
        let downloadButton = processingSteps.querySelector('.download-button');
        if (downloadButton) {
            processingSteps.removeChild(downloadButton);
        }
        
        // Créer le bouton de téléchargement
        downloadButton = document.createElement('button');
        downloadButton.className = 'download-button';
        downloadButton.innerHTML = '<span class="material-icons">download</span> Télécharger le résultat';
        downloadButton.addEventListener('click', () => {
            try {
                // Préparer un objet JSON avec les données disponibles
                const exportData = {
                    document: {
                        filename: documentData.filename,
                        type: documentData.type || '',
                        size: documentData.size || 0,
                        date: documentData.date || new Date().toISOString(),
                        content: documentData.content || '',
                        preview: documentData.preview || ''
                    },
                    processing: {
                        steps: [
                            { name: 'extract', status: 'completed', description: 'Extraction du texte', tool: 'PyPDF2' },
                            { name: 'chunk', status: 'completed', description: 'Découpage en chunks', tool: 'LlamaIndex' },
                            { name: 'embed', status: 'completed', description: 'Génération des embeddings', tool: 'Sentence Transformers' },
                            { name: 'index', status: 'completed', description: 'Indexation vectorielle', tool: 'LlamaIndex Vector Store' }
                        ],
                        timestamp: new Date().toISOString()
                    }
                };
                
                // Convertir en JSON et télécharger
                const jsonContent = JSON.stringify(exportData, null, 2);
                const blob = new Blob([jsonContent], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                
                // Créer un lien de téléchargement et cliquer dessus
                const a = document.createElement('a');
                a.href = url;
                a.download = documentData.filename.replace(/\.[^/.]+$/, '') + '_output.json';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            } catch (error) {
                console.error('Erreur lors du téléchargement:', error);
                alert('Une erreur est survenue lors du téléchargement: ' + error.message);
            }
        });
        
        // Ajouter le bouton après les étapes
        processingSteps.appendChild(downloadButton);
    }
    
    // Initialisation
    updateDocumentsList();
    
    // Gestion du chat
    if (chatForm) {
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
    
    // Fonctions utilitaires
    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    // Gestion de l'upload de fichiers
    function handleFiles(files) {
        const processingSteps = document.getElementById('processingSteps');
        if (!processingSteps) return;
        
        // Afficher la section de traitement
        processingSteps.classList.remove('hidden');
        
        // Réinitialiser les étapes
        document.querySelectorAll('.step').forEach(step => {
            step.classList.remove('active', 'completed');
            step.querySelector('.progress-fill').style.width = '0%';
        });
        
        // Traiter chaque fichier
        Array.from(files).forEach(async (file) => {
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
                
                // Envoyer le fichier au serveur
                const response = await fetch('http://localhost:8080/api/upload', {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.detail || 'Erreur lors de l\'upload');
                }
                
                // Mettre à jour les étapes de traitement
                updateProcessingStep('extract', 'completed');
                updateProcessingStep('chunk', 'active');
                
                setTimeout(() => {
                    updateProcessingStep('chunk', 'completed');
                    updateProcessingStep('embed', 'active');
                    
                    setTimeout(() => {
                        updateProcessingStep('embed', 'completed');
                        updateProcessingStep('index', 'active');
                        
                        setTimeout(() => {
                            updateProcessingStep('index', 'completed');
                            
                            // Ajouter le bouton de téléchargement
                            addDownloadButton(data);
                            
                            // Mettre à jour la liste des documents
                            updateDocumentsList();
                        }, 1000);
                    }, 1000);
                }, 1000);
            } catch (error) {
                console.error('Erreur lors de l\'upload:', error);
                alert('Erreur lors de l\'upload: ' + error.message);
                
                // Réinitialiser les étapes
                document.querySelectorAll('.step').forEach(step => {
                    step.classList.remove('active', 'completed');
                    step.querySelector('.progress-fill').style.width = '0%';
                });
            }
        });
    }
    
    // Fonction pour mettre à jour une étape de traitement
    function updateProcessingStep(stepName, status) {
        const step = document.querySelector(`.step[data-step="${stepName}"]`);
        if (!step) return;
        
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
    
    // Fonction pour afficher un document
    async function displayDocument(filename) {
        try {
            // Mettre à jour le document courant pour le chat
            currentDocument = filename;
            
            const response = await fetch(`http://localhost:8080/api/documents/${filename}`);
            if (!response.ok) {
                throw new Error('Erreur lors de la récupération du document');
            }
            
            const document = await response.json();
            
            // Afficher les informations du document
            const documentInfo = document.getElementById('documentInfo');
            if (documentInfo) {
                documentInfo.innerHTML = `
                    <h3>${document.filename}</h3>
                    <p><strong>Type:</strong> ${document.type || 'Non spécifié'}</p>
                    <p><strong>Taille:</strong> ${formatBytes(document.size || 0)}</p>
                    <p><strong>Date:</strong> ${new Date(document.date || Date.now()).toLocaleString()}</p>
                `;
            }
            
            // Récupérer le contenu complet du document
            let fullContent = '';
            
            // Ajouter le contenu principal
            if (document.content) {
                // Afficher tout le contenu sans troncature
                fullContent += `<h2>Contenu complet</h2>\n${document.content}\n\n`;
            } else if (document.preview) {
                fullContent += `<h2>Aperçu</h2>\n${document.preview}\n\n`;
                // Ajouter un message indiquant que seul l'aperçu est disponible
                fullContent += `<div class="warning">Attention: Seul l'aperçu est disponible. Le contenu complet n'a pas été extrait.</div>\n\n`;
            }
            
            // Ajouter les chunks s'ils existent
            if (document.chunks && document.chunks.length > 0) {
                fullContent += `<h2>Chunks (${document.chunks.length})</h2>\n`;
                document.chunks.forEach((chunk, index) => {
                    fullContent += `<h3>Chunk ${index + 1}</h3>\n${chunk.text || chunk.content || ''}\n\n`;
                });
            }
            
            // Afficher le contenu complet en markdown
            displayMarkdownPreview(fullContent);
            
            // Afficher la section d'aperçu
            const previewSection = document.getElementById('preview');
            if (previewSection) {
                previewSection.style.display = 'block';
            }
            
            // Changer l'onglet actif
            const chatTab = document.querySelector('.tab[data-tab="chat"]');
            if (chatTab) {
                chatTab.click();
            }
        } catch (error) {
            console.error('Erreur:', error);
            alert('Une erreur est survenue lors de l\'affichage du document');
        }
    }
    
    // Fonction pour afficher le contenu markdown
    function displayMarkdownPreview(markdown) {
        console.log('Affichage du markdown');
        const markdownPreview = document.getElementById('markdownPreview');
        if (!markdownPreview) {
            console.error('Element markdownPreview introuvable');
            return;
        }
        
        try {
            // Créer un conteneur pour le contenu
            let fullPreviewScroll = markdownPreview.querySelector('.full-preview-scroll');
            if (!fullPreviewScroll) {
                fullPreviewScroll = document.createElement('div');
                fullPreviewScroll.className = 'full-preview-scroll';
                markdownPreview.appendChild(fullPreviewScroll);
            }
            
            // Vérifier si showdown est défini
            if (typeof showdown === 'undefined') {
                console.warn('Showdown n\'est pas défini, affichage en texte brut');
                fullPreviewScroll.innerHTML = `<pre>${markdown || 'Aucun contenu disponible'}</pre>`;
                return;
            }
            
            // Convertir le markdown en HTML
            const converter = new showdown.Converter();
            const html = converter.makeHtml(markdown || 'Aucun contenu disponible');
            
            // Afficher le HTML
            fullPreviewScroll.innerHTML = html;
        } catch (error) {
            console.error('Erreur lors de l\'affichage du markdown:', error);
            if (markdownPreview) {
                markdownPreview.innerHTML = `<pre>${markdown || 'Aucun contenu disponible'}</pre>`;
            }
        }
    }
    
    // Fonction pour afficher la liste des documents
    async function updateDocumentsList() {
        const documentsList = document.getElementById('documentsList');
        if (!documentsList) return;
        
        try {
            const response = await fetch('http://localhost:8080/api/documents');
            const documents = await response.json();
            documentsList.innerHTML = '';
            
            // Ajouter le bouton pour supprimer tous les documents
            if (documents.length > 0) {
                const deleteAllButton = document.createElement('div');
                deleteAllButton.className = 'delete-all-button';
                deleteAllButton.innerHTML = `
                    <button class="danger-button" id="deleteAllButton">
                        <span class="material-icons">delete_sweep</span> Supprimer tous les documents
                    </button>
                `;
                documentsList.appendChild(deleteAllButton);
                
                // Ajouter l'événement de clic pour le bouton de suppression de tous les documents
                document.getElementById('deleteAllButton').addEventListener('click', () => {
                    if (confirm('Voulez-vous vraiment supprimer tous les documents? Cette action est irréversible.')) {
                        deleteAllDocuments();
                    }
                });
            }
            
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
                docElement.innerHTML = `
                    <span>${doc.filename}</span>
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
                
                // Ajouter l'événement pour afficher le document
                docElement.querySelector('.view-button').addEventListener('click', () => {
                    displayDocument(doc.filename);
                });
                
                // Ajouter l'événement pour supprimer le document
                docElement.querySelector('.delete-button').addEventListener('click', () => {
                    showDeleteModal(doc.filename);
                });
            });
        } catch (error) {
            console.error('Erreur:', error);
            documentsList.innerHTML = `
                <div class="document-item">
                    <p>Erreur lors de la récupération des documents</p>
                </div>
            `;
        }
    }
    
    // Fonction pour supprimer tous les documents
    async function deleteAllDocuments() {
        try {
            const response = await fetch('http://localhost:8080/api/documents', {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error('Erreur lors de la suppression des documents');
            }
            
            const result = await response.json();
            console.log(result);
            
            // Mettre à jour la liste des documents
            await updateDocumentsList();
            
            // Afficher un message de succès
            alert(result.message || 'Tous les documents ont été supprimés avec succès');
        } catch (error) {
            console.error('Erreur:', error);
            alert('Une erreur est survenue lors de la suppression des documents: ' + error.message);
        }
    }
    
    // Fonctions pour la suppression des documents
    function showDeleteModal(filename) {
        currentDocumentToDelete = filename;
        const deleteModal = document.getElementById('deleteModal');
        const deleteModalContent = document.getElementById('deleteModalContent');
        
        if (deleteModal) {
            if (deleteModalContent) {
                deleteModalContent.textContent = `Voulez-vous vraiment supprimer le document "${filename}" ?`;
            }
            deleteModal.classList.add('active');
        }
    }
    
    function hideDeleteModal() {
        const deleteModal = document.getElementById('deleteModal');
        if (deleteModal) {
            deleteModal.classList.remove('active');
        }
    }
    
    // Supprimer un document
    async function deleteDocument(filename) {
        try {
            const response = await fetch(`http://localhost:8080/api/documents/${encodeURIComponent(filename)}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error('Erreur lors de la suppression du document');
            }
            
            const result = await response.json();
            console.log(result);
            
            // Mettre à jour la liste des documents
            await updateDocumentsList();
            
            // Afficher un message de confirmation
            alert(`Le document "${filename}" a été supprimé avec succès.`);
            
            // Fermer la modal
            hideDeleteModal();
        } catch (error) {
            console.error('Erreur:', error);
            alert('Une erreur est survenue lors de la suppression du document: ' + error.message);
        }
    }
    
    // Fonction pour ajouter le bouton de téléchargement
    function addDownloadButton(documentData) {
        const processingSteps = document.getElementById('processingSteps');
        if (!processingSteps) return;
        
        // Vérifier si le bouton existe déjà
        let downloadButton = processingSteps.querySelector('.download-button');
        if (downloadButton) {
            processingSteps.removeChild(downloadButton);
        }
        
        // Créer le bouton de téléchargement
        downloadButton = document.createElement('button');
        downloadButton.className = 'download-button';
        downloadButton.innerHTML = '<span class="material-icons">download</span> Télécharger le résultat';
        downloadButton.addEventListener('click', () => {
            try {
                // Préparer un objet JSON avec les données disponibles
                const exportData = {
                    document: {
                        filename: documentData.filename,
                        type: documentData.type || '',
                        size: documentData.size || 0,
                        date: documentData.date || new Date().toISOString(),
                        content: documentData.content || '',
                        preview: documentData.preview || ''
                    },
                    processing: {
                        steps: [
                            { name: 'extract', status: 'completed', description: 'Extraction du texte', tool: 'PyPDF2' },
                            { name: 'chunk', status: 'completed', description: 'Découpage en chunks', tool: 'LlamaIndex' },
                            { name: 'embed', status: 'completed', description: 'Génération des embeddings', tool: 'Sentence Transformers' },
                            { name: 'index', status: 'completed', description: 'Indexation vectorielle', tool: 'LlamaIndex Vector Store' }
                        ],
                        timestamp: new Date().toISOString()
                    }
                };
                
                // Convertir en JSON et créer un blob
                const jsonStr = JSON.stringify(exportData, null, 2);
                const blob = new Blob([jsonStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                
                // Créer un lien de téléchargement et cliquer dessus
                const a = document.createElement('a');
                a.href = url;
                a.download = documentData.filename.replace(/\.[^/.]+$/, '') + '_output.json';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            } catch (error) {
                console.error('Erreur lors du téléchargement:', error);
                alert('Une erreur est survenue lors du téléchargement: ' + error.message);
            }
        });
        
        // Ajouter le bouton après les étapes
        processingSteps.appendChild(downloadButton);
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
    
    // Fonction pour envoyer un message au chatbot
    async function sendMessage(message) {
        if (!message.trim()) return;
        
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
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
            // Vérifier si un document est sélectionné
            if (!currentDocument) {
                loadingElement.innerHTML = `<p>Veuillez d'abord sélectionner un document.</p>`;
                loadingElement.classList.remove('loading');
                loadingElement.classList.add('error');
                return;
            }
            
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
            
            if (!response.ok) {
                throw new Error(`Erreur lors de la communication avec le chatbot: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Remplacer le message de chargement par la réponse
            if (data && data.response) {
                // Ajouter un bouton pour ouvrir la prévisualisation
                loadingElement.innerHTML = `
                    <p>${data.response}</p>
                    <div class="message-actions">
                        <button class="preview-button" id="openPreviewBtn">Ouvrir la prévisualisation</button>
                    </div>
                `;
                loadingElement.classList.remove('loading');
                
                // Ajouter l'événement pour ouvrir la prévisualisation
                const openPreviewBtn = loadingElement.querySelector('#openPreviewBtn');
                if (openPreviewBtn) {
                    openPreviewBtn.addEventListener('click', () => {
                        console.log('Ouverture de la prévisualisation');
                        // Afficher la section de prévisualisation
                        const previewSection = document.getElementById('preview');
                        if (previewSection) {
                            previewSection.style.display = 'block';
                        }
                        
                        // Changer l'onglet actif pour afficher la prévisualisation
                        const previewTab = document.querySelector('.tab[data-tab="documents"]');
                        if (previewTab) {
                            previewTab.click();
                        }
                    });
                }
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
    
    // Initialisation des événements de la modal
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', () => {
            if (currentDocumentToDelete) {
                deleteDocument(currentDocumentToDelete);
            }
        });
    }
    
    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', hideDeleteModal);
    }
    
    // Fermer la modal si on clique en dehors
    if (deleteModal) {
        deleteModal.addEventListener('click', (e) => {
            if (e.target === deleteModal) {
                hideDeleteModal();
            }
        });
    }
});
