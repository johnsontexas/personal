// Add transition element to the body with loading icon
document.body.insertAdjacentHTML('beforeend', `
    <div class="page-transition">
      <img src="images/Mis/holder.png" alt="loading" class="loading-icon">
    </div>
  `);
  
  // Get all navigation links
  const navLinks = document.querySelectorAll('nav a');
  
  // Add click event listeners to all navigation links
  navLinks.forEach(link => {
      link.addEventListener('click', function(e) {
          // Only handle internal links
          if (this.hostname === window.location.hostname) {
              e.preventDefault();
              const targetUrl = this.href;
              
              // Add fade-out class to body
              document.body.classList.add('fade-out');
              
              // Activate the transition overlay
              const transition = document.querySelector('.page-transition');
              transition.classList.add('active');
              
              // Navigate to the new page after the fade-out animation
              setTimeout(() => {
                  window.location.href = targetUrl;
              }, 500);
          }
      });
  });
  
  // Handle page load
  window.addEventListener('load', () => {
      // Remove fade-out class if it exists
      document.body.classList.remove('fade-out');
      
      // Deactivate the transition overlay
      const transition = document.querySelector('.page-transition');
      transition.classList.remove('active');
  }); 