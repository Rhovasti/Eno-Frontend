// This script fixes the relationship between beats and posts
console.log('Beat/Post relationship fix loaded');

// Override the loadBeats function to ensure proper handling
window.fixBeatsPostsIssue = function() {
  // Find the threads.js script
  const scripts = document.querySelectorAll('script');
  let threadsScript = null;
  
  for (const script of scripts) {
    if (script.src && script.src.includes('threads.js')) {
      threadsScript = script;
      break;
    }
  }
  
  if (\!threadsScript) {
    console.error('Could not find threads.js script to fix');
    return false;
  }
  
  // Create a new script to replace threads.js
  const newScript = document.createElement('script');
  newScript.src = threadsScript.src + '?v=' + new Date().getTime(); // Cache buster
  
  // Remove the original threads.js
  threadsScript.parentNode.removeChild(threadsScript);
  
  // Add the fixed version
  document.body.appendChild(newScript);
  
  console.log('Beat/Post fix applied - threads.js reloaded');
  return true;
}

// This fix specifically corrects the createPostForm submission
// by ensuring the beatId is correctly processed as a number
window.fixPostCreation = function() {
  const createPostForm = document.getElementById('createPostForm');
  if (\!createPostForm) {
    console.error('Could not find createPostForm to fix');
    return false;
  }
  
  // Replace the existing event listener with a fixed one
  createPostForm.addEventListener('submit', function(event) {
    event.preventDefault();
    
    // Get the beat select element directly
    const beatSelect = document.getElementById('beatSelect');
    if (\!beatSelect) {
      console.error('Beat select element not found');
      alert('Error: Beat select element not found');
      return;
    }
    
    // Ensure beatId is a number by parsing the value
    const beatId = parseInt(beatSelect.value, 10);
    const title = document.getElementById('postTitle').value;
    const content = document.getElementById('postContent').value;
    const isGMPostCheckbox = document.getElementById('isGMPost');
    const postType = isGMPostCheckbox && isGMPostCheckbox.checked ? 'gm' : 'player';
    
    // Basic validation
    if (isNaN(beatId) || beatId <= 0) {
        console.error('Invalid beatId:', beatSelect.value);
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
    
    console.log('FIXED: Posting new message to existing beat:', { 
        beatId, 
        title,
        contentLength: content.length,
        postType
    });
    
    // Helper function to get cookie value
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }
    
    // Make the API call with the correct beatId
    fetch('/api/posts', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getCookie('token')}`
        },
        body: JSON.stringify({ 
            beatId: beatId, // Ensure this is a number
            title: title,
            content: content,
            postType: postType
        })
    })
    .then(response => {
        if (\!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || `Server error: ${response.status}`);
            }).catch(e => {
                // If JSON parsing fails, use status text
                throw new Error(`Failed to create post: ${response.statusText}`);
            });
        }
        return response.json();
    })
    .then(data => {
        console.log('FIXED: Post created successfully:', data);
        
        // Reload posts for the current beat
        const loadPosts = window.loadPosts || function(beatId) {
            fetch(`/api/beats/${beatId}/posts`, {
                headers: {
                    'Authorization': `Bearer ${getCookie('token')}`
                }
            })
            .then(response => response.json())
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
        };
        
        loadPosts(beatId);
        createPostForm.reset();
        
        // Reset button state
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
    })
    .catch(error => {
        console.error('FIXED: Error creating post:', error);
        alert(`Virhe viestin luomisessa: ${error.message}`);
        
        // Reset button state
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
    });
  }, true); // Use capture to override other listeners
  
  console.log('Post creation form fixed');
  return true;
}

// Auto-apply the fixes when threads.html loads
document.addEventListener('DOMContentLoaded', function() {
  // Wait for the page to fully load
  setTimeout(function() {
    console.log('Applying beat/post relationship fixes...');
    
    // Apply the post creation fix
    if (window.fixPostCreation()) {
      console.log('Post creation fix applied successfully');
    }
    
    console.log('All fixes applied');
  }, 1000); // Wait 1 second for everything to load
});
