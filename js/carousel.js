const slides = document.querySelector(".slides");
const carousel = document.querySelector(".carousel");
const prevButton = document.querySelector(".carousel-button-l");
const nextButton = document.querySelector(".carousel-button-r");

function initCarousel() {

    // =====================================
    // GUARD
    // =====================================

    if (!slides || !carousel || !prevButton || !nextButton || slides.children.length === 0) {
        console.warn("Karussell: benötigte Elemente fehlen.");
        return;
    }

    // =====================================
    // KONFIGURATION
    // (optional per CSS-Variablen am .carousel überschreibbar:
    //  --scale-active, --scale-inactive, --slide-gap)
    // =====================================

    const styles = getComputedStyle(carousel);

    function cssNumber(name, fallback) {
        const value = parseFloat(styles.getPropertyValue(name));
        return Number.isFinite(value) ? value : fallback;
    }

    const SCALE_ACTIVE = cssNumber("--scale-active", 1.1);
    const SCALE_INACTIVE = cssNumber("--scale-inactive", 0.85);
    const DESIRED_GAP = cssNumber("--slide-gap", 10);

    const CLONE_SETS = 2;               // Klon-Sätze pro Seite
    const ANIMATION_MS = 400;
    const DRAG_THRESHOLD = 5;           // px, ab hier gilt es als Drag
    const SWITCH_HYSTERESIS = 10;       // px, verhindert Flackern beim Drag
    const FLICK_VELOCITY = 0.4;         // px/ms
    const MAX_QUEUED_STEPS = 3;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");


    // =====================================
    // INITIALISIERUNG
    // =====================================

    const originalSlides = Array.from(slides.children);
    const numberOfSlides = originalSlides.length;

    function makeClone(slide) {
        const clone = slide.cloneNode(true);
        clone.setAttribute("aria-hidden", "true");
        // Kein "inert": das würde auch alle Mausklicks auf Klone blockieren
        clone.querySelectorAll("a, button, input, select, textarea, [tabindex]")
            .forEach(el => el.setAttribute("tabindex", "-1"));
        clone.removeAttribute("id");
        clone.querySelectorAll("[id]").forEach(el => el.removeAttribute("id"));
        clone.querySelectorAll("img").forEach(img => { img.draggable = false; });
        return clone;
    }

    const beforeClones = [];
    const afterClones = [];

    for (let i = 0; i < CLONE_SETS; i++) {
        beforeClones.push(...originalSlides.map(makeClone));
        afterClones.push(...originalSlides.map(makeClone));
    }

    slides.prepend(...beforeClones);
    slides.append(...afterClones);

    const allSlides = Array.from(slides.children);

    // Grenzen des "echten" mittleren Bereichs
    const LOWER_BOUND = numberOfSlides * CLONE_SETS;
    const UPPER_BOUND = numberOfSlides * (CLONE_SETS + 1);

    let currentSlide = LOWER_BOUND;
    let isAnimating = false;
    let animationTimeout = null;
    let queuedSteps = 0;

    // Drag-Zustand
    let activePointerId = null;
    let isDragging = false;
    let suppressClick = false;

    let startX = 0;
    let startPosition = 0;
    let currentPosition = 0;
    let dragStartSlide = 0;

    let lastX = 0;
    let lastTime = 0;
    let velocity = 0;

    // Gestenverhalten per JS absichern (kein extra CSS nötig)
    carousel.style.touchAction = "pan-y";
    carousel.style.userSelect = "none";
    carousel.style.webkitUserSelect = "none";
    slides.addEventListener("dragstart", event => event.preventDefault());

    // Bedienelemente beschriften
    if (!prevButton.hasAttribute("aria-label")) prevButton.setAttribute("aria-label", "Vorheriges Bild");
    if (!nextButton.hasAttribute("aria-label")) nextButton.setAttribute("aria-label", "Nächstes Bild");
    if (!carousel.hasAttribute("tabindex")) carousel.setAttribute("tabindex", "0");


    // =====================================
    // HILFSFUNKTIONEN
    // =====================================

    function getTranslateX() {
        return new DOMMatrixReadOnly(getComputedStyle(slides).transform).m41;
    }

    function setActiveSlide(index) {
        allSlides.forEach((slide, i) => {
            slide.classList.toggle("active", i === index);
        });
    }

    // Erst alles lesen, dann alles schreiben (kein Layout-Thrashing)
    function updateGaps() {

        const widths = allSlides.map(slide => slide.offsetWidth);
        const margins = allSlides.map((_, index) => {

            if (index === allSlides.length - 1) return null;

            const currentScale = index === currentSlide ? SCALE_ACTIVE : SCALE_INACTIVE;
            const nextScale = index + 1 === currentSlide ? SCALE_ACTIVE : SCALE_INACTIVE;

            const currentCorrection = (1 - currentScale) * widths[index] / 2;
            const nextCorrection = (1 - nextScale) * widths[index + 1] / 2;

            return DESIRED_GAP - currentCorrection - nextCorrection;
        });

        allSlides.forEach((slide, index) => {
            if (margins[index] !== null) {
                slide.style.marginRight = `${margins[index]}px`;
            }
        });
    }

    function distanceToCenter(index, position) {
        const slide = allSlides[index];
        const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
        return Math.abs(slideCenter + position - carousel.clientWidth / 2);
    }

    function findClosestSlide(position) {

        let closestSlide = 0;
        let smallestDistance = Infinity;

        allSlides.forEach((_, index) => {
            const distance = distanceToCenter(index, position);
            if (distance < smallestDistance) {
                smallestDistance = distance;
                closestSlide = index;
            }
        });

        return closestSlide;
    }


    // =====================================
    // KARUSSELL BEWEGEN
    // =====================================

    // Beim unsichtbaren Sprung dürfen die CSS-Transitions der Slides (scale)
    // nicht laufen, sonst skaliert der Klon runter und das Original wieder hoch.
    function disableSlideTransitions() {
        allSlides.forEach(slide => { slide.style.transition = "none"; });
    }

    function enableSlideTransitions() {
        slides.offsetHeight; // Reflow, damit der Zustand ohne Transition übernommen wird
        allSlides.forEach(slide => { slide.style.transition = ""; });
    }

    function moveSlide(animated = true) {

        const instant = !animated || reducedMotion.matches;

        if (instant) disableSlideTransitions();

        setActiveSlide(currentSlide);
        updateGaps();

        const activeSlide = allSlides[currentSlide];

        const position = Math.round(
            activeSlide.offsetLeft -
            (carousel.clientWidth - activeSlide.offsetWidth) / 2
        );

        const target = -position;

        if (instant) {
            slides.style.transition = "none";
            slides.style.transform = `translateX(${target}px)`;
            enableSlideTransitions();
            if (animated) finishAnimation();
            return;
        }

        // Ziel = aktuelle Position: transitionend würde nie feuern
        if (Math.abs(getTranslateX() - target) < 0.5) {
            slides.style.transform = `translateX(${target}px)`;
            finishAnimation();
            return;
        }

        isAnimating = true;

        // Fallback, falls transitionend nicht kommt (z. B. Tab im Hintergrund)
        clearTimeout(animationTimeout);
        animationTimeout = setTimeout(finishAnimation, ANIMATION_MS + 150);

        slides.style.transition = `transform ${ANIMATION_MS}ms ease`;
        slides.style.transform = `translateX(${target}px)`;
    }

    // Springt unsichtbar zurück in den mittleren Bereich (beliebig viele Slides)
    function normalizePosition() {

        if (currentSlide >= LOWER_BOUND && currentSlide < UPPER_BOUND) return;

        const offset = (currentSlide - LOWER_BOUND) % numberOfSlides;
        currentSlide = LOWER_BOUND + (offset + numberOfSlides) % numberOfSlides;

        moveSlide(false);
    }

    function finishAnimation() {

        clearTimeout(animationTimeout);
        normalizePosition();

        isAnimating = false;

        // Zwischengespeicherte Pfeil-Klicks abarbeiten
        if (queuedSteps !== 0) {
            const direction = Math.sign(queuedSteps);
            queuedSteps -= direction;
            step(direction);
        }
    }

    function goTo(index) {
        currentSlide = index;
        moveSlide();
    }

    function step(direction) {

        if (isDragging) return;

        if (isAnimating) {
            queuedSteps = Math.max(-MAX_QUEUED_STEPS, Math.min(MAX_QUEUED_STEPS, queuedSteps + direction));
            return;
        }

        goTo(currentSlide + direction);
    }

    slides.addEventListener("transitionend", (event) => {
        if (event.target !== slides) return;
        if (event.propertyName !== "transform") return;
        finishAnimation();
    });


    // =====================================
    // LIGHTBOX (Klick auf das aktive Bild)
    // =====================================

    let lightbox = null;
    let lightboxImage = null;
    let lightboxClose = null;
    let lastFocused = null;

    function ensureLightbox() {

        if (lightbox) return;

        const style = document.createElement("style");
        style.textContent = `
            .carousel-lightbox {
                position: fixed; inset: 0; z-index: 1000;
                display: flex; align-items: center; justify-content: center;
                background: rgba(0, 0, 0, 0.88);
                opacity: 0; transition: opacity 0.25s ease;
                cursor: zoom-out;
            }
            .carousel-lightbox[hidden] { display: none; }
            .carousel-lightbox.open { opacity: 1; }
            .carousel-lightbox img {
                max-width: 92vw; max-height: 90vh;
                object-fit: contain; border-radius: 6px;
                cursor: default;
            }
            .carousel-lightbox-close {
                position: absolute; top: 16px; right: 20px;
                width: 44px; height: 44px;
                border: 0; border-radius: 50%;
                background: rgba(255, 255, 255, 0.15); color: #fff;
                font-size: 28px; line-height: 1; cursor: pointer;
            }
            .carousel-lightbox-close:hover { background: rgba(255, 255, 255, 0.3); }
        `;
        document.head.appendChild(style);

        lightbox = document.createElement("div");
        lightbox.className = "carousel-lightbox";
        lightbox.hidden = true;
        lightbox.setAttribute("role", "dialog");
        lightbox.setAttribute("aria-modal", "true");
        lightbox.setAttribute("aria-label", "Bildansicht");

        lightboxImage = document.createElement("img");

        lightboxClose = document.createElement("button");
        lightboxClose.type = "button";
        lightboxClose.className = "carousel-lightbox-close";
        lightboxClose.setAttribute("aria-label", "Schließen");
        lightboxClose.textContent = "×";

        lightbox.append(lightboxImage, lightboxClose);
        document.body.appendChild(lightbox);

        // Klick neben das Bild oder auf "×" schließt
        lightbox.addEventListener("click", (event) => {
            if (event.target !== lightboxImage) closeLightbox();
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && !lightbox.hidden) closeLightbox();
        });
    }

    function openLightbox(slide) {

        const image = slide.querySelector("img");

        if (!image) return;

        ensureLightbox();

        // Optional: data-full="grosses-bild.jpg" am <img> für eine höhere Auflösung
        lightboxImage.src = image.dataset.full || image.currentSrc || image.src;
        lightboxImage.alt = image.alt || "";

        lastFocused = document.activeElement;

        lightbox.hidden = false;
        document.body.style.overflow = "hidden";

        requestAnimationFrame(() => lightbox.classList.add("open"));

        lightboxClose.focus();
    }

    function closeLightbox() {

        if (!lightbox || lightbox.hidden) return;

        lightbox.classList.remove("open");
        lightbox.hidden = true;
        document.body.style.overflow = "";

        if (lastFocused && lastFocused.focus) lastFocused.focus();
    }


    // =====================================
    // KLICKS, PFEILE, TASTATUR
    // =====================================

    // Klick nach einem Drag unterdrücken (Capture-Phase)
    carousel.addEventListener("click", (event) => {
        if (!suppressClick) return;
        event.preventDefault();
        event.stopPropagation();
    }, true);

    slides.addEventListener("click", (event) => {

        const clickedSlide = event.target.closest(".slide");

        if (!clickedSlide || isDragging || isAnimating) return;

        const index = allSlides.indexOf(clickedSlide);

        if (index === -1) return;

        // Aktives Bild: groß öffnen. Anderes Bild: zuerst in die Mitte holen.
        if (index === currentSlide) {
            openLightbox(clickedSlide);
            return;
        }

        goTo(index);
    });

    nextButton.addEventListener("click", () => step(1));
    prevButton.addEventListener("click", () => step(-1));

    carousel.addEventListener("keydown", (event) => {
        if (event.key === "ArrowRight") { event.preventDefault(); step(1); }
        if (event.key === "ArrowLeft") { event.preventDefault(); step(-1); }
    });


    // =====================================
    // DRAG
    // =====================================

    carousel.addEventListener("pointerdown", (event) => {

        if (event.pointerType === "mouse" && event.button !== 0) return;
        if (event.target.closest("button")) return;
        if (isAnimating) return;
        if (activePointerId !== null && event.pointerId !== activePointerId) return;

        activePointerId = event.pointerId;
        isDragging = false;

        startX = event.clientX;
        startPosition = getTranslateX();
        currentPosition = startPosition;
        dragStartSlide = currentSlide;

        lastX = event.clientX;
        lastTime = event.timeStamp;
        velocity = 0;
    });

    carousel.addEventListener("pointermove", (event) => {

        if (event.pointerId !== activePointerId) return;

        const distance = event.clientX - startX;

        if (!isDragging) {
            if (Math.abs(distance) <= DRAG_THRESHOLD) return;

            // Capture erst ab hier, damit normale Klicks auf Slides unberührt bleiben
            isDragging = true;
            try { carousel.setPointerCapture(event.pointerId); } catch (_) { /* ignorieren */ }
            carousel.classList.add("is-dragging");
        }

        // Geschwindigkeit (leicht geglättet) für Flick-Erkennung
        const dt = event.timeStamp - lastTime;
        if (dt > 0) {
            velocity = 0.8 * ((event.clientX - lastX) / dt) + 0.2 * velocity;
            lastX = event.clientX;
            lastTime = event.timeStamp;
        }

        currentPosition = startPosition + distance;

        slides.style.transition = "none";
        slides.style.transform = `translateX(${currentPosition}px)`;

        const closestSlide = findClosestSlide(currentPosition);

        // Hysterese: nur wechseln, wenn der neue Slide deutlich näher ist
        if (
            closestSlide !== currentSlide &&
            distanceToCenter(closestSlide, currentPosition) + SWITCH_HYSTERESIS <
            distanceToCenter(currentSlide, currentPosition)
        ) {

            const activeSlide = allSlides[closestSlide];

            // Bildschirmposition des neuen aktiven Slides merken
            const oldScreenCenter =
                activeSlide.offsetLeft +
                activeSlide.offsetWidth / 2 +
                currentPosition;

            currentSlide = closestSlide;

            setActiveSlide(currentSlide);
            updateGaps();

            // Position nach der Gap-Anpassung korrigieren
            currentPosition =
                oldScreenCenter -
                activeSlide.offsetLeft -
                activeSlide.offsetWidth / 2;

            startPosition = currentPosition - distance;

            slides.style.transform = `translateX(${currentPosition}px)`;
        }
    });

    function endDrag(event) {

        if (event.pointerId !== activePointerId) return;

        const wasDragging = isDragging;

        activePointerId = null;
        isDragging = false;
        carousel.classList.remove("is-dragging");

        if (carousel.hasPointerCapture?.(event.pointerId)) {
            carousel.releasePointerCapture(event.pointerId);
        }

        // Normaler Klick: nichts verändern
        if (!wasDragging) return;

        suppressClick = true;
        setTimeout(() => { suppressClick = false; }, 0);

        let target = findClosestSlide(currentPosition);

        // Schneller Flick über kleine Distanz: einen Slide weiter
        if (event.type === "pointerup" && target === dragStartSlide && Math.abs(velocity) > FLICK_VELOCITY) {
            target = dragStartSlide - Math.sign(velocity);
        }

        goTo(target);
    }

    carousel.addEventListener("pointerup", endDrag);
    carousel.addEventListener("pointercancel", endDrag);
    carousel.addEventListener("lostpointercapture", endDrag);


    // =====================================
    // GRÖSSENÄNDERUNGEN
    // =====================================

    if ("ResizeObserver" in window) {

        const resizeObserver = new ResizeObserver(() => {
            if (isDragging) return;
            moveSlide(false);
            if (isAnimating) finishAnimation();
        });

        resizeObserver.observe(carousel);
        allSlides.forEach(slide => resizeObserver.observe(slide));

    } else {
        window.addEventListener("resize", () => {
            if (!isDragging) moveSlide(false);
        });
    }


    // =====================================
    // STARTPOSITION
    // =====================================

    moveSlide(false);
}

if (document.readyState === "complete") {
    initCarousel();
} else {
    window.addEventListener("load", initCarousel);
}
