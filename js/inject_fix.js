// This script injects the fixed post creation code
document.addEventListener('DOMContentLoaded', function() {
    console.log('Post creation fix script loaded');
    
    // Give main scripts time to load
    setTimeout(function() {
        const createPostForm = document.getElementById('createPostForm');
        const beatSelect = document.getElementById('beatSelect');
        const isGMPostCheckbox = document.getElementById('isGMPost');
        
        if (createPostForm && beatSelect) {
            console.log('Form elements found, applying fix');
            
            // Remove existing handlers
            const newForm = createPostForm.cloneNode(true);
            createPostForm.parentNode.replaceChild(newForm, createPostForm);
            
            // Set up the fixed handler
            newForm.addEventListener('submit', function(event) {
                event.preventDefault();
                
                // Parse the beatId as integer 
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
                
                console.log('Fixed post creation - beatId:', beatId, 'type:', typeof beatId);
                
                // Helper function to get cookie
                function getCookie(name) {
                    const value = `; ${document.cookie}`;
                    const parts = value.split(`; ${name}=`);
                    if (parts.length === 2) return parts.pop().split(';').shift();
                    return null;
                }
                
                // Make the API call
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
                    
                    // Manually reload posts
                    function loadPosts(beatId) {
                        fetch(`/api/beats/${beatId}/posts`, {
                            headers: {
                                'Authorization': `Bearer ${getCookie('token')}`
                            }
                        })
                        .then(response => {
                            if (\!response.ok) {
                                throw new Error('Failed to fetch posts');
                            }
                            return response.json();
                        })
                        .then(posts => {
                            const postsContainer = document.getElementById('postsContainer');
                            
                            if (\!postsContainer) return;
                            
                            postsContainer.innerHTML = '';
                            
                            if (posts.length === 0) {
                                const message = document.createElement('p');
                                message.textContent = 'Ei viestejä. Ole ensimmäinen joka kirjoittaa\!';
                                postsContainer.appendChild(message);
                            } else {
                                posts.forEach(post => {
                                    const postElement = document.createElement('div');
                                    postElement.className = `post ${post.post_type}-post`;
                                    
                                    const postHeader = document.createElement('div');
                                    postHeader.className = 'post-header';
                                    
                                    const postTitle = document.createElement('h3');
                                    postTitle.textContent = post.title;
                                    
                                    const postAuthor = document.createElement('span');
                                    postAuthor.className = 'post-author';
                                    postAuthor.textContent = post.post_type === 'gm' ? `GM: ${post.username}` : post.username;
                                    
                                    const postDate = document.createElement('span');
                                    postDate.className = 'post-date';
                                    postDate.textContent = new Date(post.created_at).toLocaleString();
                                    
                                    const postContent = document.createElement('div');
                                    postContent.className = 'post-content';
                                    postContent.textContent = post.content;
                                    
                                    postHeader.appendChild(postTitle);
                                    postHeader.appendChild(postAuthor);
                                    postHeader.appendChild(postDate);
                                    
                                    postElement.appendChild(postHeader);
                                    postElement.appendChild(postContent);
                                    
                                    postsContainer.appendChild(postElement);
                                });
                            }
                        })
                        .catch(error => console.error('Error fetching posts:', error));
                    }
                    
                    loadPosts(beatId);
                    newForm.reset();
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
            
            console.log('Post creation fix applied');
        } else {
            console.warn('Form elements not found, fix not applied');
        }
    }, 1000);
});
