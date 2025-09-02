// Debug helper to monitor post creation
(function() {
  console.log('Debug helper loaded - Monitoring post creation');
  
  // Store the original fetch function
  const originalFetch = window.fetch;
  
  // Override fetch to log API calls
  window.fetch = function(url, options) {
    // Only log POST requests to /api/posts
    if (options && options.method === 'POST' && url.includes('/api/posts')) {
      console.log('🔍 POST request to ' + url);
      console.log('🔍 Request body:', options.body);
      
      // Return the original fetch but log the response
      return originalFetch(url, options)
        .then(response => {
          // Clone the response to read it twice
          const clone = response.clone();
          
          // Read the cloned response
          clone.json().then(data => {
            console.log('🔍 Response from ' + url + ':', data);
          }).catch(err => {
            console.log('🔍 Error parsing response:', err);
          });
          
          return response;
        })
        .catch(error => {
          console.error('🔍 Fetch error:', error);
          throw error;
        });
    }
    
    // Also monitor beat creation
    if (options && options.method === 'POST' && url.includes('/api/chapters') && url.includes('/beats')) {
      console.log('🔍 POST request to create beat:', url);
      console.log('🔍 Beat creation body:', options.body);
      
      return originalFetch(url, options)
        .then(response => {
          const clone = response.clone();
          
          clone.json().then(data => {
            console.log('🔍 Beat creation response:', data);
          }).catch(err => {
            console.log('🔍 Error parsing beat response:', err);
          });
          
          return response;
        });
    }
    
    // For other requests, use the original fetch without modification
    return originalFetch.apply(this, arguments);
  };
  
  // Also intercept Form submissions
  const originalSubmit = HTMLFormElement.prototype.submit;
  HTMLFormElement.prototype.submit = function() {
    console.log('🔍 Form submission:', this);
    
    // Check if it's a post creation form
    if (this.id === 'createPostForm') {
      console.log('🔍 Post form submission detected\!');
      const beatId = document.getElementById('beatSelect')?.value;
      console.log('🔍 Selected beat ID:', beatId);
    }
    
    // Proceed with original submission
    return originalSubmit.apply(this, arguments);
  };
  
  // Monitor form from threads.js
  document.addEventListener('DOMContentLoaded', function() {
    // Add a mutation observer to watch for form submissions
    const observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.type === 'childList') {
          // Look for create post form
          const createPostForm = document.getElementById('createPostForm');
          if (createPostForm && \!createPostForm._debugMonitored) {
            createPostForm._debugMonitored = true;
            console.log('🔍 Monitoring createPostForm for submissions');
            
            // Add direct event listener
            createPostForm.addEventListener('submit', function(event) {
              const beatId = document.getElementById('beatSelect')?.value;
              const title = document.getElementById('postTitle')?.value;
              const content = document.getElementById('postContent')?.value;
              
              console.log('🔍 Post form submission detected via event listener');
              console.log('🔍 Form data:', { beatId, title, contentLength: content ? content.length : 0 });
            });
          }
        }
      });
    });
    
    // Start observing the document
    observer.observe(document.documentElement, { childList: true, subtree: true });
  });
  
  console.log('Debug helper setup complete');
})();
