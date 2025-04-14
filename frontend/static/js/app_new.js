// Attendre que le DOM soit chargé
document.addEventListener('DOMContentLoaded', function() {
    // Variables globales
    let currentDocumentToDelete = null;
    
    // Éléments du DOM
    const deleteModal = document.getElementById('deleteModal');
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const newUploadBtn = document.getElementById('newUploadBtn');
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
    
    function updateProcessingStep(step, message, status = 'processing') {
        const processingSteps = document.getElementById('processingSteps');
        if (!processingSteps) return;
        
        // Créer l'élément de l'étape s'il n'existe pas
        let stepElement = document.getElementById(`step-${step}`);
        if (!stepElement) {
            stepElement = document.createElement('div');
            stepElement.id = `step-${step}`;
            stepElement.className = `processing-step ${status}`;
            processingSteps.appendChild(stepElement);
        }
        
        // Mettre à jour le contenu et le statut
        stepElement.className = `processing-step ${status}`;
        stepElement.innerHTML = `
            <div class="step-indicator">
                <span class="material-icons">
                    ${status === 'success' ? 'check_circle' : 'hourglass_top'}
                </span>
            </div>
            <div class="step-message">${message}</div>
        `;
    
        // Rendre les étapes visibles
        processingSteps.style.display = 'flex';
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
                if (processingSteps) {
                    processingSteps.style.display = 'flex';
                }
                
                // Mettre à jour les étapes
                updateProcessingStep(1, 'Chargement et extraction du texte...');
                
                const response = await fetch('http://localhost:8080/api/upload', {
                    method: 'POST',
                    body: formData
                });
    
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.detail || 'Erreur lors de l\'upload');
                }
    
                const result = await response.json();
                console.log(result);
    
                // Mettre à jour les étapes
                updateProcessingStep(1, 'Chargement et extraction du texte...', 'success');
                updateProcessingStep(2, 'Découpage en chunks...', 'success');
                updateProcessingStep(3, 'Génération des embeddings...', 'success');
                updateProcessingStep(4, 'Sauvegarde de l\'index...', 'success');
    
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
                    
                    // Afficher l'aperçu en markdown
                    markdownPreview.innerHTML = `<h3>Aperçu du contenu</h3><p>${result.document.preview}</p>`;
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
    
    // Gestion de la liste des documents
    async function updateDocumentsList() {
        const documentsList = document.getElementById('documentsList');
        if (!documentsList) return;
        
        try {
            const response = await fetch('http://localhost:8080/api/documents');
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
                docElement.innerHTML = `
                    <span>${doc.filename}</span>
                    <div class="actions">
                        <button class="delete-button" data-filename="${doc.filename}">
                            <span class="material-icons">delete</span> Supprimer
                        </button>
                    </div>
                `;
                documentsList.appendChild(docElement);
    
                // Ajouter l'événement de suppression
                const deleteBtn = docElement.querySelector('.delete-button');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', () => showDeleteModal(doc.filename));
                }
            });
        } catch (error) {
            console.error('Erreur lors de la récupération des documents:', error);
            documentsList.innerHTML = `
                <div class="document-item error">
                    <p>Erreur lors de la récupération des documents</p>
                </div>
            `;
        }
    }
    
    // Fonctions pour la suppression des documents
    function showDeleteModal(filename) {
        currentDocumentToDelete = filename;
        if (deleteModal) {
            deleteModal.classList.add('show');
        }
    }

    function hideDeleteModal() {
        if (deleteModal) {
            deleteModal.classList.remove('show');
            currentDocumentToDelete = null;
        }
    }

    async function deleteDocument(filename) {
        try {
            const response = await fetch(`http://localhost:8080/api/documents/${encodeURIComponent(filename)}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                await updateDocumentsList();
            } else {
                console.error('Erreur lors de la suppression du document');
            }
        } catch (error) {
            console.error('Erreur lors de la suppression:', error);
        }
    }
    
    // Gestion du chat
    if (chatForm) {
        chatForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!chatInput || !chatInput.value.trim()) return;
            
            const question = chatInput.value.trim();
            addMessage(question, 'user');
            chatInput.value = '';
            
            try {
                const response = await fetch('http://localhost:8080/api/query', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ question })
                });
                
                if (!response.ok) {
                    throw new Error('Erreur lors de la requête');
                }
                
                const result = await response.json();
                addMessage(result.response, 'bot');
            } catch (error) {
                console.error('Erreur:', error);
                addMessage('Désolé, une erreur est survenue', 'bot');
            }
        });
    }
    
    function addMessage(content, type) {
        if (!chatMessages) return;
        
        const messageElement = document.createElement('div');
        messageElement.className = `message ${type}`;
        messageElement.textContent = content;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Initialisation des événements de la modal
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', async () => {
            if (currentDocumentToDelete) {
                await deleteDocument(currentDocumentToDelete);
                hideDeleteModal();
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
    
    // Initialisation
    updateDocumentsList();
});
