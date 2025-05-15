document.addEventListener('DOMContentLoaded', function() {
    const galleryItems = document.querySelectorAll('.gallery-item');
    
    // Function to handle touch events
    function handleTouch(item) {
        item.addEventListener('touchstart', function(e) {
            e.preventDefault(); // Prevent default touch behavior
            
            // Toggle the flipped class
            this.classList.toggle('flipped');
        });
    }
    
    // Add touch handlers to all gallery items
    galleryItems.forEach(handleTouch);
    
    // Add hover effect for non-touch devices
    if (window.matchMedia('(hover: hover)').matches) {
        galleryItems.forEach(item => {
            item.addEventListener('mouseenter', function() {
                this.classList.add('flipped');
            });
            
            item.addEventListener('mouseleave', function() {
                this.classList.remove('flipped');
            });
        });
    }
}); 