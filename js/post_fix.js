// Fixed post creation code
if (createPostForm) {
    // Remove previous event listeners
    const oldForm = createPostForm;
    const newForm = oldForm.cloneNode(true);
    oldForm.parentNode.replaceChild(newForm, oldForm);
    createPostForm = newForm;
    
    createPostForm.addEventListener('submit', function(event) {
        event.preventDefault();
        
        // Make sure beatSelect exists and has a value
        if (\!beatSelect || \!beatSelect.value) {
            alert('Valitse ensin beatti');
            return;
        }
        
        // Parse the beatId as integer to ensure it's a number
        const beatId = parseInt(beatSelect.value, 10);
        const title = document.getElementById('postTitle').value;
        const content = document.getElementById('postContent').value;
        const postType = isGMPostCheckbox && isGMPostCheckbox.checked ? 'gm' : 'player';
        
        // Basic validation
        if (isNaN(beatId) || beatId <= 0) {
            alert('Valitse ensin beatti');
            return;
        }
        
        if (\!title || \!content) {
            alert('Otsikko ja sisältö vaaditaan');
            return;
        }
        
        // Show loading state
        const submitButton = this.querySelector('button[type="submit"]');
        const originalButtonText = submitButton.textContent;
        submitButton.disabled = true;
        submitButton.textContent = 'Lähetetään...';
        
        console.log('FIXED: Posting message to beat ID:', beatId);
        
        fetch('/api/posts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getCookie('token')}`
            },
            body: JSON.stringify({ 
                beatId: beatId,  // Use the parsed numeric value
                title, 
                content, 
                postType 
            })
        })
        .then(response => {
            if (\!response.ok) {
                return response.json().then(data => {
                    throw new Error(data.error || `Server error: ${response.status}`);
                }).catch(e => {
                    throw new Error(`Failed to create post: ${response.statusText}`);
                });
            }
            return response.json();
        })
        .then(data => {
            console.log('Post created successfully:', data);
            loadPosts(beatId);
            createPostForm.reset();
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
        })
        .catch(error => {
            console.error('Error creating post:', error);
            alert(`Virhe viestin luomisessa: ${error.message}`);
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
        });
    });
}
