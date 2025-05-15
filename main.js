let slideIndex = 1;
let slideInterval;

function startSlideShow() {
    // Clear any existing interval
    if (slideInterval) {
        clearInterval(slideInterval);
    }
    // Start new interval
    slideInterval = setInterval(function() {
        plusSlides(1);
    }, 4000);
}

// Next/previous controls
function plusSlides(n) {
    showSlides(slideIndex += n);
    startSlideShow(); // Reset timer
}

// Thumbnail image controls
function currentSlide(n) {
    showSlides(slideIndex = n);
    startSlideShow(); // Reset timer
}

function showSlides(n) {
    let i;
    let slides = document.getElementsByClassName("mySlides");
    let dots = document.getElementsByClassName("dot");
    
    if (n > slides.length) {slideIndex = 1}
    if (n < 1) {slideIndex = slides.length}
    
    // Hide all slides
    for (i = 0; i < slides.length; i++) {
        slides[i].style.display = "none";
    }
    
    // Remove active class from all dots
    for (i = 0; i < dots.length; i++) {
        dots[i].className = dots[i].className.replace(" active", "");
    }
    
    // Show the current slide and activate its dot
    slides[slideIndex-1].style.display = "block";
    dots[slideIndex-1].className += " active";
}

// Start the slideshow when the page loads
startSlideShow();
