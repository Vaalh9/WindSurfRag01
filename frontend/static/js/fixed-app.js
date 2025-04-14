document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM chargé, initialisation de l\'application');
    
    // Éléments du DOM
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const processingSteps = document.getElementById('processingSteps');
    const resultTab = document.querySelector('[data-tab="result"]');
    const resultContent = document.getElementById('resultContent');
    const resultDocumentName = document.getElementById('resultDocumentName');
    const resultDocumentType = document.getElementById('resultDocumentType');
    const resultDocumentSize = document.getElementById('resultDocumentSize');
    const resultTextLength = document.getElementById('resultTextLength');
    const downloadResultBtn = document.getElementById('downloadResultBtn');
    
    // Variable globale pour stocker le contenu extrait
    let extractedContent = null;
    let currentFilename = null;
    
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
    
    // Gestion du clic sur la zone de dépôt
    if (dropzone && fileInput) {
        console.log('Initialisation de la zone de dépôt');
        
        // Gestionnaire de clic pour ouvrir l'explorateur de fichiers
        dropzone.addEventListener('click', function(e) {
            console.log('Clic sur la zone de dépôt');
            
            // Vérifier si on clique sur la zone de dépôt ou un élément interne
            if (e.target === dropzone || 
                e.target.classList.contains('dropzone-content') || 
                e.target.parentElement && e.target.parentElement.classList.contains('dropzone-content')) {
                console.log('Ouverture de l\'explorateur de fichiers');
                fileInput.click();
            }
        });
        
        // Gestionnaire d'événement pour le drag & drop
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
            if (files.length > 0) {
                await handleFileUpload(files[0]);
            }
        });
    }
    
    // Gestionnaire d'événement pour le changement de fichier
    if (fileInput) {
        fileInput.addEventListener('change', async function(event) {
            console.log('Fichier sélectionné');
            const files = event.target.files;
            if (files.length > 0) {
                await handleFileUpload(files[0]);
            }
        });
    }
    
    // Fonction pour gérer l'upload de fichier
    async function handleFileUpload(file) {
        console.log('Traitement du fichier:', file.name);
        currentFilename = file.name;
        
        // Afficher les étapes de traitement
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
                extractedContent = result.document.preview;
                
                // Mettre à jour les détails du document
                if (resultDocumentName) resultDocumentName.textContent = result.document.filename || '-';
                if (resultDocumentType) resultDocumentType.textContent = result.document.type || '-';
                if (resultDocumentSize) resultDocumentSize.textContent = formatBytes(result.document.size) || '-';
                if (resultTextLength) resultTextLength.textContent = `${result.document.text_length || 0} caractères`;
                
                // Afficher l'intégralité du contenu extrait
                if (resultContent) {
                    resultContent.innerHTML = `<pre>${extractedContent}</pre>`;
                }
                
                // Configurer le bouton de téléchargement
                if (downloadResultBtn) {
                    downloadResultBtn.onclick = () => downloadResult(result.document.filename);
                }
            }
        } catch (error) {
            console.error('Erreur:', error);
            
            // Afficher un message d'erreur
            alert(error.message || 'Une erreur est survenue lors du traitement du document');
            
            // Réinitialiser l'interface
            if (processingSteps) {
                processingSteps.classList.add('hidden');
            }
        }
    }
    
    // Fonction pour simuler la progression des étapes
    function simulateProcessingSteps(result) {
        const steps = ['extract', 'parse', 'chunk', 'embed', 'index'];
        let currentStep = 0;
        const progressBar = document.getElementById('progressBar');
        const stepPercentage = 100 / steps.length;
        
        // Mettre à jour la première étape
        updateProcessingStep(steps[currentStep]);
        updateProgressBar(stepPercentage * (currentStep + 1));
        
        // Simuler la progression des étapes
        const interval = setInterval(() => {
            currentStep++;
            
            if (currentStep < steps.length) {
                updateProcessingStep(steps[currentStep]);
                updateProgressBar(stepPercentage * (currentStep + 1));
            } else {
                clearInterval(interval);
                
                // Marquer toutes les étapes comme terminées
                document.querySelectorAll('.step').forEach(step => {
                    step.classList.add('completed');
                });
                
                // Mettre à jour la barre de progression à 100%
                updateProgressBar(100);
                
                // Afficher le message de traitement terminé
                showProcessingComplete(result);
            }
        }, 800);
    }
    
    // Fonction pour mettre à jour la barre de progression
    function updateProgressBar(percentage) {
        const progressBar = document.getElementById('progressBar');
        if (progressBar) {
            progressBar.style.width = `${percentage}%`;
            progressBar.textContent = `${percentage}%`;
            
            // Changer la couleur en fonction de l'avancement
            if (percentage < 25) {
                progressBar.style.backgroundColor = '#4a9eff';
            } else if (percentage < 50) {
                progressBar.style.backgroundColor = '#4a9eff';
            } else if (percentage < 75) {
                progressBar.style.backgroundColor = '#4a9eff';
            } else {
                progressBar.style.backgroundColor = '#4CAF50';
            }
        }
    }
    
    // Fonction pour afficher le message de traitement terminé
    function showProcessingComplete(result) {
        // Créer l'élément pour le message de traitement terminé
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
            }, 2500);
        }
    }
    
    // Fonction pour mettre à jour l'étape de traitement
    function updateProcessingStep(step) {
        const steps = document.querySelectorAll('.step');
        const stepLabels = document.querySelectorAll('.step-label');
        let foundActive = false;
        
        // Mettre à jour les étapes
        steps.forEach(s => {
            const stepName = s.getAttribute('data-step');
            
            if (stepName === step) {
                s.classList.add('active');
                foundActive = true;
            } else if (!foundActive) {
                s.classList.add('completed');
            }
        });
        
        // Mettre à jour les étiquettes des étapes
        stepLabels.forEach(label => {
            const stepName = label.getAttribute('data-step');
            
            if (stepName === step) {
                label.style.fontWeight = 'bold';
                label.style.color = 'var(--primary-color)';
            } else if (foundActive) {
                label.style.fontWeight = 'normal';
                label.style.color = 'var(--text-color)';
            } else {
                label.style.fontWeight = 'normal';
                label.style.color = '#4CAF50';
            }
        });
    }
    
    // Fonction pour télécharger le résultat
    async function downloadResult(filename) {
        if (!filename) return;
        
        try {
            const response = await fetch(`/api/download/${encodeURIComponent(filename)}`);
            
            if (!response.ok) {
                throw new Error(`Erreur lors du téléchargement: ${response.status}`);
            }
            
            // Créer un blob à partir de la réponse
            const blob = await response.blob();
            
            // Créer un lien de téléchargement
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename.replace('.pdf', '.json');
            document.body.appendChild(a);
            a.click();
            
            // Nettoyer
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Erreur lors du téléchargement:', error);
            alert('Erreur lors du téléchargement du fichier');
        }
    }
    
    // Fonction pour formater la taille en octets
    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
});
