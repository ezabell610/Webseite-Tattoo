console.log("Scroll Animation geladen!");

const sections = document.querySelectorAll(".scroll-animation");

console.log(sections);

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            console.log("Section sichtbar:", entry.target);

            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
        }
    });
}, {
    threshold: 0.15
});

sections.forEach(section => {
    observer.observe(section);
});