// Script JavaScript simplifié pour tester les interactions de base
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM chargé, initialisation de l\'application simplifiée');
    
    // Gestion des onglets
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() {
            console.log('Clic sur onglet:', this.dataset.tab);
            
            // Retirer la classe active de tous les onglets
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            // Ajouter la classe active à l'onglet cliqué
            this.classList.add('active');
            const tabContent = document.getElementById(this.dataset.tab);
            if (tabContent) {
                tabContent.classList.add('active');
            }
        });
    });
    
    // Gestion du drag & drop
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    
    if (dropzone && fileInput) {
        dropzone.addEventListener('click', function() {
            console.log('Clic sur dropzone');
            fileInput.click();
        });
        
        fileInput.addEventListener('change', function() {
            console.log('Fichier sélectionné:', this.files);
            if (this.files.length > 0) {
                alert('Fichier sélectionné: ' + this.files[0].name);
            }
        });
    }
    
    // Gestion des documents
    const documentsList = document.getElementById('documentsList');
    if (documentsList) {
        // Exemple de document pour tester
        const testDoc = {
            filename: 'test-document.pdf',
            type: 'PDF',
            size: 1024 * 1024, // 1MB
            date: new Date().toISOString()
        };
        
        // Créer un élément pour le document
        const docElement = document.createElement('div');
        docElement.className = 'document-item';
        docElement.innerHTML = `
            <span>${testDoc.filename}</span>
            <div class="actions">
                <button class="view-button" data-filename="${testDoc.filename}">
                    <span class="material-icons">visibility</span> Voir
                </button>
                <button class="delete-button" data-filename="${testDoc.filename}">
                    <span class="material-icons">delete</span> Supprimer
                </button>
            </div>
        `;
        
        // Ajouter l'élément à la liste
        documentsList.appendChild(docElement);
        
        // Ajouter les événements
        docElement.querySelector('.view-button').addEventListener('click', function() {
            const filename = this.dataset.filename;
            console.log('Voir document:', filename);
            alert('Voir document: ' + filename);
        });
        
        docElement.querySelector('.delete-button').addEventListener('click', function() {
            const filename = this.dataset.filename;
            console.log('Supprimer document:', filename);
            if (confirm('Voulez-vous vraiment supprimer ' + filename + '?')) {
                alert('Document supprimé: ' + filename);
            }
        });
    }
    
    // Gestion du chat
    const chatForm = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInput');
    const chatMessages = document.getElementById('chatMessages');
    
    if (chatForm && chatInput && chatMessages) {
        chatForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const message = chatInput.value.trim();
            if (message) {
                console.log('Message envoyé:', message);
                
                // Ajouter le message de l'utilisateur
                const userMessageElement = document.createElement('div');
                userMessageElement.className = 'message user-message';
                userMessageElement.innerHTML = `<p>${message}</p>`;
                chatMessages.appendChild(userMessageElement);
                
                // Ajouter une réponse simulée
                const botMessageElement = document.createElement('div');
                botMessageElement.className = 'message bot-message';
                botMessageElement.innerHTML = `
                    <p>Voici une réponse simulée à: "${message}"</p>
                    <div class="message-actions">
                        <button class="preview-button">Ouvrir la prévisualisation</button>
                    </div>
                `;
                chatMessages.appendChild(botMessageElement);
                
                // Ajouter l'événement pour le bouton de prévisualisation
                botMessageElement.querySelector('.preview-button').addEventListener('click', function() {
                    console.log('Ouverture de la prévisualisation');
                    alert('Ouverture de la prévisualisation');
                    
                    // Changer d'onglet
                    const documentsTab = document.querySelector('.tab[data-tab="documents"]');
                    if (documentsTab) {
                        documentsTab.click();
                    }
                });
                
                // Réinitialiser l'input
                chatInput.value = '';
                
                // Faire défiler vers le bas
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        });
    }
});
