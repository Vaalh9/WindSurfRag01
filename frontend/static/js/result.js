// Gestion de l'onglet de résultat et du téléchargement du contenu extrait
document.addEventListener('DOMContentLoaded', function() {
    console.log('Script de gestion des résultats chargé');
    
    // Variables globales
    let extractedContent = null;
    
    // Référence aux éléments DOM
    const resultTab = document.querySelector('[data-tab="result"]');
    const uploadTab = document.querySelector('[data-tab="upload"]');
    const resultTabContent = document.getElementById('result');
    const uploadTabContent = document.getElementById('upload');
    const downloadBtn = document.getElementById('downloadResultBtn');
    
    // Éléments d'information sur le document
    const resultDocumentName = document.getElementById('resultDocumentName');
    const resultDocumentType = document.getElementById('resultDocumentType');
    const resultDocumentSize = document.getElementById('resultDocumentSize');
    const resultTextLength = document.getElementById('resultTextLength');
    const resultContent = document.getElementById('resultContent');
    
    // Fonction pour mettre à jour l'onglet de résultat avec les données extraites
    window.updateResultTab = function(data) {
        console.log('Mise à jour de l\'onglet de résultat avec les données:', data);
        console.log('Type de data:', typeof data);
        console.log('Contenu de data.document:', data.document);
        
        if (!data || !data.document) {
            console.error('Données invalides pour la mise à jour de l\'onglet de résultat');
            return;
        }
        
        // Stocker le contenu extrait pour le téléchargement
        extractedContent = {
            filename: data.document.filename || 'document',
            content: data.document.preview || '',
            type: data.document.type || 'text'
        };
        
        // Mettre à jour les informations du document
        resultDocumentName.textContent = data.document.filename || '-';
        resultDocumentType.textContent = data.document.type === 'pdf' ? 'PDF' : 
                                        data.document.type === 'markdown' ? 'Markdown' : 
                                        data.document.type || '-';
        
        // Formater la taille du document
        const size = data.document.size || 0;
        let sizeText = '';
        if (size < 1024) {
            sizeText = `${size} octets`;
        } else if (size < 1024 * 1024) {
            sizeText = `${(size / 1024).toFixed(2)} Ko`;
        } else {
            sizeText = `${(size / (1024 * 1024)).toFixed(2)} Mo`;
        }
        resultDocumentSize.textContent = sizeText;
        
        // Mettre à jour la longueur du texte extrait
        resultTextLength.textContent = data.document.text_length ? 
                                      `${data.document.text_length} caractères` : '-';
        
        // Mettre à jour le contenu extrait
        console.log('Preview disponible:', data.document.preview ? 'Oui' : 'Non');
        console.log('Type de preview:', typeof data.document.preview);
        console.log('Longueur de preview:', data.document.preview ? data.document.preview.length : 0);
        console.log('Début de preview:', data.document.preview ? data.document.preview.substring(0, 100) : 'N/A');
        
        if (data.document.preview && data.document.preview.length > 0) {
            // Échapper les caractères HTML pour éviter les injections XSS
            const escapedContent = data.document.preview
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
            
            // Afficher le contenu avec une mise en forme préservée
            resultContent.innerHTML = `<pre>${escapedContent}</pre>`;
            console.log('Contenu extrait affiché, longueur:', data.document.preview.length);
            
            // Définir un style pour s'assurer que le contenu est visible
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
        
        // Activer le bouton de téléchargement
        downloadBtn.disabled = false;
        
        // Basculer automatiquement vers l'onglet de résultat
        setTimeout(() => {
            // Simuler un clic sur l'onglet de résultat
            resultTab.click();
        }, 1000);
    };
    
    // Fonction pour télécharger le contenu extrait
    function downloadExtractedContent(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        console.log('Fonction de téléchargement appelée');
        
        // Vérifier si le contenu extrait est disponible
        if (!extractedContent || !extractedContent.content) {
            console.error('Aucun contenu disponible à télécharger');
            alert('Aucun contenu disponible à télécharger. Veuillez d\'abord traiter un document.');
            return;
        }
        
        try {
            let fileContent = extractedContent.content;
            let fileType = 'text/plain';
            let fileExtension = '.txt';
            
            // Si c'est un document Markdown, conserver l'extension .md
            if (extractedContent.type === 'markdown') {
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
            a.download = `extraction_${extractedContent.filename.replace(/\.[^/.]+$/, '')}${fileExtension}`;
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
    
    // Ajouter un gestionnaire d'événements pour le bouton de téléchargement
    if (downloadBtn) {
        downloadBtn.addEventListener('click', downloadExtractedContent);
    } else {
        console.error('Bouton de téléchargement non trouvé');
    }
    
    // Gestion des onglets
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // Supprimer la classe active de tous les onglets
            tabs.forEach(t => t.classList.remove('active'));
            
            // Ajouter la classe active à l'onglet cliqué
            this.classList.add('active');
            
            // Récupérer l'onglet cible
            const targetTab = this.getAttribute('data-tab');
            
            // Masquer tous les contenus d'onglet
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            
            // Afficher le contenu de l'onglet cible
            document.getElementById(targetTab).classList.add('active');
        });
    });
});
