
const slides = document.querySelector(".slides");
const carousel = document.querySelector(".carousel");
const prevButton = document.querySelector(".carousel-button-l");
const nextButton = document.querySelector(".carousel-button-r");

// Erst starten, wenn alle Bilder geladen sind
window.addEventListener("load", () => {

    // Originalbilder speichern
    const originalSlides = Array.from(slides.children);
    const numberOfSlides = originalSlides.length;

    // Ganze Bilderreihe links und rechts klonen
    const beforeClones = originalSlides.map(slide =>
        slide.cloneNode(true)
    );

    const afterClones = originalSlides.map(slide =>
        slide.cloneNode(true)
    );

    slides.prepend(...beforeClones);
    slides.append(...afterClones);

    const allSlides = Array.from(slides.children);

    // Start beim ersten echten Bild
    let currentSlide = numberOfSlides;
    let isAnimating = false;

    // Bildposition berechnen
    function moveSlide(animated = true) {
    const activeSlide = allSlides[currentSlide];

    allSlides.forEach(slide => {
        slide.classList.remove("active");
    });

    activeSlide.classList.add("active");

    const position = activeSlide.offsetLeft
        - (carousel.clientWidth - activeSlide.offsetWidth) / 2;

    slides.style.transition = animated
        ? "transform 0.4s ease"
        : "none";

    slides.style.transform = `translateX(-${position}px)`;
}

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
        if (event.target !== slides) return;
        if (event.propertyName !== "transform") return;

        // Rechten Klonbereich verlassen
        if (currentSlide >= numberOfSlides * 2) {
            currentSlide -= numberOfSlides;
            moveSlide(false);
        }

        // Linken Klonbereich verlassen
        else if (currentSlide < numberOfSlides) {
            currentSlide += numberOfSlides;
            moveSlide(false);
        }

        isAnimating = false;
    });

    // Bei Fensteränderung neu ausrichten
    window.addEventListener("resize", () => {
        if (!isAnimating) {
            moveSlide(false);
        }
    });

    // Initiale Position
    moveSlide(false);

    function updateGaps() {
    const desiredGap = 10;

    allSlides.forEach((slide, index) => {
        const nextSlide = allSlides[index + 1];

        if (!nextSlide) return;

        const currentScale = index === currentSlide ? 1.1 : 0.85;
        const nextScale = index + 1 === currentSlide ? 1.1 : 0.85;

        const currentCorrection =
            (1 - currentScale) * slide.offsetWidth / 2;

        const nextCorrection =
            (1 - nextScale) * nextSlide.offsetWidth / 2;

        const calculatedGap =
            desiredGap - currentCorrection - nextCorrection;

        slide.style.marginRight = `${calculatedGap}px`;
    });
    }

    function moveSlide(animated = true) {
    const activeSlide = allSlides[currentSlide];

    allSlides.forEach(slide => {
        slide.classList.remove("active");
    });

    activeSlide.classList.add("active");

    updateGaps();

    const position = activeSlide.offsetLeft
        - (carousel.clientWidth - activeSlide.offsetWidth) / 2;

    slides.style.transition = animated
        ? "transform 0.4s ease"
        : "none";

    slides.style.transform = `translateX(-${position}px)`;
    }
});
