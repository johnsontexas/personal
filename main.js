let slideIndex = 1;
let slideInterval;
let isTransitioning = false;

// Show first slide immediately
document.addEventListener('DOMContentLoaded', function() {
    showSlides(slideIndex);
    startSlideShow();
});

function startSlideShow() {
    // Clear any existing interval
    if (slideInterval) {
        clearInterval(slideInterval);
    }
    // Start new interval
    slideInterval = setInterval(function() {
        if (!isTransitioning) {
            plusSlides(1);
        }
    }, 4000);
}

// Next/previous controls
function plusSlides(n) {
    if (isTransitioning) return;
    isTransitioning = true;
    showSlides(slideIndex += n);
    startSlideShow(); // Reset timer
}

// Thumbnail image controls
function currentSlide(n) {
    if (isTransitioning) return;
    isTransitioning = true;
    showSlides(slideIndex = n);
    startSlideShow(); // Reset timer
}

function showSlides(n) {
    let i;
    let slides = document.getElementsByClassName("mySlides");
    let dots = document.getElementsByClassName("dot");
    
    if (n > slides.length) {slideIndex = 1}
    if (n < 1) {slideIndex = slides.length}
    
    // Fade out current slide
    let currentSlide = slides[slideIndex-1];
    currentSlide.style.display = "block";
    
    // Remove active class from all dots
    for (i = 0; i < dots.length; i++) {
        dots[i].className = dots[i].className.replace(" active", "");
    }
    
    // Add active class to dot
    dots[slideIndex-1].className += " active";
    
    // Fade in new slide
    setTimeout(() => {
        currentSlide.style.opacity = "1";
        
        // Hide other slides after fade
        for (i = 0; i < slides.length; i++) {
            if (i !== slideIndex-1) {
                slides[i].style.opacity = "0";
                setTimeout(() => {
                    if (i !== slideIndex-1) {
                        slides[i].style.display = "none";
                    }
                }, 500);
            }
        }
        
        // Reset transition flag
        setTimeout(() => {
            isTransitioning = false;
        }, 500);
    }, 50);
}
