document.addEventListener('DOMContentLoaded', function() {
    const galleryItems = document.querySelectorAll('.gallery-item');
    
    // Function to handle click/tap events
    function handleInteraction(item) {
        // Handle both click and touch events
        item.addEventListener('click', function(e) {
            e.preventDefault();
            this.classList.toggle('flipped');
        });
    }
    
    // Add interaction handlers to all gallery items
    galleryItems.forEach(handleInteraction);
}); 