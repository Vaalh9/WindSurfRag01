// Solution directe pour afficher le contenu extrait
document.addEventListener('DOMContentLoaded', function() {
    console.log('Script direct-result.js chargé');
    
    // Référence aux éléments DOM
    const uploadForm = document.querySelector('.dropzone');
    const fileInput = document.getElementById('fileInput');
    const resultTab = document.querySelector('[data-tab="result"]');
    const resultContent = document.getElementById('resultContent');
    const resultDocumentName = document.getElementById('resultDocumentName');
    const resultDocumentType = document.getElementById('resultDocumentType');
    const resultDocumentSize = document.getElementById('resultDocumentSize');
    const resultTextLength = document.getElementById('resultTextLength');
    const downloadResultBtn = document.getElementById('downloadResultBtn');
    
    // Variable globale pour stocker le contenu extrait
    let extractedContent = null;
    
    // Intercepter l'événement de soumission du formulaire
    if (fileInput) {
        fileInput.addEventListener('change', async function(event) {
            const files = event.target.files;
            if (files.length > 0) {
                await handleFileUpload(files[0]);
            }
        });
    }
    
    // Fonction pour gérer l'upload de fichier
    async function handleFileUpload(file) {
        console.log('Traitement du fichier:', file.name);
        
        // Afficher les étapes de traitement
        const processingSteps = document.getElementById('processingSteps');
        if (processingSteps) {
            processingSteps.classList.remove('hidden');
            processingSteps.style.display = 'flex';
            updateProcessingStep('extract');
        }
        
        // Créer un FormData pour l'upload
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            // Envoyer le fichier au serveur
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                // Essayer de récupérer les détails de l'erreur
                try {
                    const errorData = await response.json();
                    console.error("Détails de l'erreur:", errorData);
                    
                    // Formater un message d'erreur convivial
                    let errorMessage = 'Erreur lors du traitement du document';
                    
                    if (errorData && errorData.detail) {
                        // Traiter les erreurs spécifiques
                        if (errorData.detail.includes('No /Root object') || 
                            errorData.detail.includes('n\'est pas un PDF valide')) {
                            errorMessage = 'Le fichier n\'est pas un PDF valide. Vérifiez que le document n\'est pas corrompu.';
                        } else if (errorData.detail.includes('EOF marker not found') || 
                                 errorData.detail.includes('corrompu')) {
                            errorMessage = 'Le fichier PDF est incomplet ou corrompu.';
                        } else if (errorData.detail.includes('Aucun texte')) {
                            errorMessage = 'Aucun texte n\'a pu être extrait de ce document. Il s\'agit peut-être d\'un PDF scanné ou contenant uniquement des images.';
                        } else {
                            // Inclure le détail de l'erreur mais nettoyer les messages techniques
                            const cleanDetail = errorData.detail
                                .replace(/\d+:\s*/, '') // Enlever les codes d'erreur
                                .replace('Erreur lors de l\'extraction du PDF : ', '')
                                .replace('Impossible d\'extraire le texte du PDF: ', '');
                                
                            errorMessage = `Erreur: ${cleanDetail}`;
                        }
                    }
                    
                    throw new Error(errorMessage);
                } catch (jsonError) {
                    // Si on ne peut pas parser la réponse JSON, utiliser le message générique
                    if (jsonError.message && !jsonError.message.startsWith('Erreur du serveur')) {
                        throw jsonError;
                    } else {
                        throw new Error(`Erreur du serveur: ${response.status}`);
                    }
                }
            }
            
            // Traiter la réponse
            const result = await response.json();
            console.log('Réponse du serveur:', result);
            
            // Simuler la progression des étapes
            simulateProcessingSteps(result);
            
            // Extraire le contenu
            if (result && result.document && result.document.preview) {
                // Stocker le contenu extrait
                extractedContent = {
                    filename: result.document.filename,
                    content: result.document.preview,
                    type: result.document.type
                };
                
                // Mettre à jour l'onglet de résultat
                updateResultTab(result.document);
                
                // L'onglet de résultat sera affiché à la fin du traitement
                // dans la fonction showProcessingComplete
            } else {
                console.error('Aucun contenu extrait dans la réponse');
                alert('Erreur: Aucun contenu extrait n\'a été reçu du serveur.');
            }
        } catch (error) {
            console.error('Erreur lors de l\'upload:', error);
            
            // Afficher un message d'erreur convivial
            const errorContainer = document.createElement('div');
            errorContainer.className = 'error-message';
            errorContainer.innerHTML = `
                <div class="error-icon">
                    <span class="material-icons">error_outline</span>
                </div>
                <div class="error-content">
                    <h3>Erreur lors du traitement</h3>
                    <p>${error.message}</p>
                </div>
                <button class="error-close">
                    <span class="material-icons">close</span>
                </button>
            `;
            
            // Styles pour le message d'erreur
            errorContainer.style.position = 'fixed';
            errorContainer.style.top = '20px';
            errorContainer.style.left = '50%';
            errorContainer.style.transform = 'translateX(-50%)';
            errorContainer.style.backgroundColor = '#ff4a4a';
            errorContainer.style.color = 'white';
            errorContainer.style.padding = '15px 20px';
            errorContainer.style.borderRadius = '8px';
            errorContainer.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
            errorContainer.style.zIndex = '1000';
            errorContainer.style.display = 'flex';
            errorContainer.style.alignItems = 'center';
            errorContainer.style.gap = '15px';
            errorContainer.style.maxWidth = '500px';
            
            // Ajouter le message d'erreur à la page
            document.body.appendChild(errorContainer);
            
            // Fermer le message d'erreur après un certain temps ou en cliquant sur le bouton
            const closeButton = errorContainer.querySelector('.error-close');
            if (closeButton) {
                closeButton.addEventListener('click', () => {
                    document.body.removeChild(errorContainer);
                });
            }
            
            // Fermer automatiquement après 8 secondes
            setTimeout(() => {
                if (document.body.contains(errorContainer)) {
                    document.body.removeChild(errorContainer);
                }
            }, 8000);
            
            // Réinitialiser l'interface
            const processingSteps = document.getElementById('processingSteps');
            if (processingSteps) {
                processingSteps.classList.add('hidden');
            }
        }
    }
    
    // Fonction pour simuler la progression des étapes
    function simulateProcessingSteps(result) {
        const steps = ['extract', 'chunk', 'embed', 'index'];
        let currentStep = 0;
        
        // Mettre à jour la première étape
        updateProcessingStep(steps[currentStep]);
        
        // Simuler la progression des étapes
        const interval = setInterval(() => {
            currentStep++;
            
            if (currentStep < steps.length) {
                updateProcessingStep(steps[currentStep]);
            } else {
                clearInterval(interval);
                
                // Marquer toutes les étapes comme terminées
                document.querySelectorAll('.step').forEach(step => {
                    step.classList.add('completed');
                    const progressFill = step.querySelector('.progress-fill');
                    if (progressFill) {
                        progressFill.style.width = '100%';
                    }
                });
                
                // Afficher le message de traitement terminé
                showProcessingComplete(result);
            }
        }, 1000);
    }
    
    // Fonction pour afficher le message de traitement terminé
    function showProcessingComplete(result) {
        // Créer l'élément pour le message de traitement terminé
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
            
            // Ajouter des styles au message
            completeMessage.style.textAlign = 'center';
            completeMessage.style.marginTop = '20px';
            completeMessage.style.padding = '15px';
            completeMessage.style.backgroundColor = 'rgba(76, 175, 80, 0.1)';
            completeMessage.style.borderRadius = '8px';
            completeMessage.style.color = '#4CAF50';
            completeMessage.style.fontWeight = 'bold';
            completeMessage.style.display = 'flex';
            completeMessage.style.alignItems = 'center';
            completeMessage.style.justifyContent = 'center';
            completeMessage.style.gap = '10px';
            
            // Ajouter le message après les étapes de traitement
            processingSteps.appendChild(completeMessage);
            
            // Animation pour faire apparaître le message
            completeMessage.style.opacity = '0';
            completeMessage.style.transform = 'translateY(10px)';
            completeMessage.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            
            setTimeout(() => {
                completeMessage.style.opacity = '1';
                completeMessage.style.transform = 'translateY(0)';
            }, 100);
            
            // Basculer vers l'onglet de résultat après un délai
            setTimeout(() => {
                if (resultTab) {
                    resultTab.click();
                }
            }, 2000);
        }
    }
    
    // Fonction pour mettre à jour l'étape de traitement
    function updateProcessingStep(step) {
        const steps = document.querySelectorAll('.step');
        let foundActive = false;
        
        steps.forEach(s => {
            const stepName = s.getAttribute('data-step');
            
            if (stepName === step) {
                s.classList.add('active');
                foundActive = true;
                
                // Animer la barre de progression
                const progressFill = s.querySelector('.progress-fill');
                if (progressFill) {
                    progressFill.style.width = '50%';
                }
            } else if (!foundActive) {
                s.classList.add('completed');
                
                // Remplir la barre de progression
                const progressFill = s.querySelector('.progress-fill');
                if (progressFill) {
                    progressFill.style.width = '100%';
                }
            }
        });
    }
    
    // Fonction pour mettre à jour l'onglet de résultat
    function updateResultTab(document) {
        console.log('Mise à jour de l\'onglet de résultat avec les données:', document);
        
        // Mettre à jour les informations du document
        if (resultDocumentName) {
            resultDocumentName.textContent = document.filename || '-';
        }
        
        if (resultDocumentType) {
            resultDocumentType.textContent = document.type === 'pdf' ? 'PDF' : 
                                           document.type === 'markdown' ? 'Markdown' : 
                                           document.type || '-';
        }
        
        if (resultDocumentSize) {
            // Formater la taille du document
            const size = document.size || 0;
            let sizeText = '';
            if (size < 1024) {
                sizeText = `${size} octets`;
            } else if (size < 1024 * 1024) {
                sizeText = `${(size / 1024).toFixed(2)} Ko`;
            } else {
                sizeText = `${(size / (1024 * 1024)).toFixed(2)} Mo`;
            }
            resultDocumentSize.textContent = sizeText;
        }
        
        if (resultTextLength) {
            resultTextLength.textContent = document.text_length ? 
                                         `${document.text_length} caractères` : '-';
        }
        
        // Mettre à jour le contenu extrait
        if (resultContent) {
            if (document.preview && document.preview.length > 0) {
                // Échapper les caractères HTML pour éviter les injections XSS
                const escapedContent = document.preview
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#039;');
                
                // Afficher le contenu avec une mise en forme préservée
                resultContent.innerHTML = `<pre style="white-space: pre-wrap; word-break: break-word;">${escapedContent}</pre>`;
                console.log('Contenu extrait affiché, longueur:', document.preview.length);
                
                // Appliquer des styles directement
                resultContent.style.maxHeight = '600px';
                resultContent.style.overflowY = 'auto';
                resultContent.style.padding = '15px';
                resultContent.style.border = '1px solid #ddd';
                resultContent.style.borderRadius = '4px';
                resultContent.style.backgroundColor = '#f9f9f9';
            } else {
                resultContent.innerHTML = '<p class="no-content-message">Aucun contenu extrait disponible</p>';
                console.error('Aucun contenu preview disponible dans le document');
            }
        }
    }
    
    // Fonction pour télécharger le contenu extrait au format JSON
    function downloadExtractedContent(e) {
        if (e) {
            e.preventDefault();
        }
        
        console.log('Fonction de téléchargement appelée');
        
        // Vérifier si le contenu extrait est disponible
        if (!extractedContent || !extractedContent.content) {
            console.error('Aucun contenu disponible à télécharger');
            alert('Aucun contenu disponible à télécharger. Veuillez d\'abord traiter un document.');
            return;
        }
        
        try {
            // Créer un objet JSON avec les données extraites
            const jsonData = {
                filename: extractedContent.filename,
                type: extractedContent.type,
                extracted_at: new Date().toISOString(),
                content: extractedContent.content,
                length: extractedContent.content.length
            };
            
            // Convertir l'objet en chaîne JSON formatée
            const jsonString = JSON.stringify(jsonData, null, 2);
            
            // Créer un blob avec le contenu JSON
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            // Créer un lien de téléchargement et cliquer dessus
            const a = document.createElement('a');
            a.href = url;
            a.download = `extraction_${extractedContent.filename.replace(/\.[^/.]+$/, '')}.json`;
            document.body.appendChild(a);
            a.click();
            
            // Nettoyer
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
            
            console.log('Téléchargement du fichier JSON initié');
        } catch (error) {
            console.error('Erreur lors du téléchargement:', error);
            alert('Erreur lors du téléchargement: ' + error.message);
        }
    }
    
    // Ajouter un gestionnaire d'événements pour le bouton de téléchargement
    if (downloadResultBtn) {
        downloadResultBtn.addEventListener('click', downloadExtractedContent);
    }
    
    // Gestion des onglets
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() {
            // Supprimer la classe active de tous les onglets
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            // Ajouter la classe active à l'onglet cliqué
            this.classList.add('active');
            
            // Afficher le contenu de l'onglet
            const tabId = this.getAttribute('data-tab');
            const tabContent = document.getElementById(tabId);
            if (tabContent) {
                tabContent.classList.add('active');
            }
        });
    });
});
