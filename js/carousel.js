
const slides = document.querySelector(".slides");
const carousel = document.querySelector(".carousel");
const prevButton = document.querySelector(".carousel-button-l");
const nextButton = document.querySelector(".carousel-button-r");

// Ursprüngliche Bilder speichern
const originalSlides = Array.from(slides.children);

// Klone erstellen
const firstClone = originalSlides[0].cloneNode(true);
const lastClone = originalSlides[originalSlides.length - 1].cloneNode(true);

// Klone einfügen
slides.appendChild(firstClone);
slides.insertBefore(lastClone, slides.firstChild);

// Alle Bilder inklusive Klone
const allSlides = Array.from(slides.children);

let currentSlide = 1;
let isAnimating = false;

// Bildbreite + Abstand berechnen
function getSlideWidth() {
    const slideWidth = allSlides[0].getBoundingClientRect().width;
    const gap = parseFloat(getComputedStyle(slides).columnGap) || 0;

    return slideWidth + gap;
}

// Position setzen
function moveSlide(animated = true) {
    const activeSlide = allSlides[currentSlide];

    const position = activeSlide.offsetLeft
        - (carousel.clientWidth - activeSlide.offsetWidth) / 2;

    slides.style.transition = animated ? "transform 0.4s ease" : "none";
    slides.style.transform = `translateX(-${position}px)`;
}

// Start beim ersten echten Bild
moveSlide(false);

// Vorwärts
nextButton.addEventListener("click", () => {
    if (isAnimating) return;

    isAnimating = true;
    currentSlide++;
    moveSlide();
});

// Rückwärts
prevButton.addEventListener("click", () => {
    if (isAnimating) return;

    isAnimating = true;
    currentSlide--;
    moveSlide();
});

// Endlos-Übergang
slides.addEventListener("transitionend", (event) => {
    if (event.propertyName !== "transform") return;

    if (currentSlide === allSlides.length - 1) {
        currentSlide = 1;
        moveSlide(false);
    } 
    else if (currentSlide === 0) {
        currentSlide = allSlides.length - 2;
        moveSlide(false);
    }

    isAnimating = false;
});

// Bei Größenänderung Position anpassen
window.addEventListener("resize", () => {
    if (!isAnimating) {
        moveSlide(false);
    }
});

