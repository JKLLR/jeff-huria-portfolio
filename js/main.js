// =====================================================
// JEFF .K. HURIA — Portfolio JS
// =====================================================

gsap.registerPlugin(ScrollTrigger);

// ── Header scroll border ───────────────────────────
window.addEventListener('scroll', () => {
    document.getElementById('header').classList.toggle('scrolled', window.scrollY > 40);
});

// ── Loader ─────────────────────────────────────────
const loader     = document.getElementById('loader');
const loaderSpin = document.getElementById('loaderSpin');
const loaderPct  = document.getElementById('loaderPct');
const site       = document.getElementById('site');

// Spin the text block on Y axis — shows 3D distortion & inverted backface
const spinTween = gsap.to(loaderSpin, {
    rotateY: 360,
    duration: 1.4,
    repeat: -1,
    ease: 'none'
});

// Count to 100%
let pct = 0;
const countTimer = setInterval(() => {
    pct += Math.floor(Math.random() * 9) + 3;
    if (pct >= 100) {
        pct = 100;
        clearInterval(countTimer);
        loaderPct.textContent = '100%';
        setTimeout(revealSite, 350);
    } else {
        loaderPct.textContent = pct + '%';
    }
}, 55);

function revealSite() {
    spinTween.kill();

    gsap.timeline()
        .to(loader, { yPercent: -100, duration: 0.85, ease: 'power3.inOut' })
        .set(loader, { display: 'none' })
        .set(site, { visibility: 'visible' })
        .to(site, { opacity: 1, duration: 0.01 }, '<')
        .call(initSite);
}

// ── Hero title: auto-fit to full viewport width ────
function fitTitle() {
    const title = document.getElementById('heroTitle');
    if (!title) return;
    title.style.fontSize = '10px';
    const maxWidth = title.parentElement.offsetWidth;
    let lo = 10, hi = 600;
    while (hi - lo > 1) {
        const mid = (lo + hi) / 2;
        title.style.fontSize = mid + 'px';
        title.scrollWidth <= maxWidth ? lo = mid : hi = mid;
    }
    title.style.fontSize = lo + 'px';
}

window.addEventListener('resize', fitTitle);

// ── Animate a number from 0 to target ─────────────
function countUp(el, target, dur = 2200) {
    const start = performance.now();
    function step(now) {
        const t = Math.min((now - start) / dur, 1);
        const ease = 1 - Math.pow(1 - t, 3); // cubic ease-out
        el.textContent = Math.round(ease * target).toLocaleString();
        if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

// ── Inject marquee divider ─────────────────────────
function buildMarquee(container) {
    const words = ['AI PRODUCTS', 'STARTUP STRATEGY', 'WEB DEVELOPMENT', 'PRODUCT DESIGN',
                   'AI NATIVE', 'FOUNDER'];
    const repeated = [...words, ...words, ...words, ...words];
    const wrap  = document.createElement('div');
    wrap.className = 'marquee-wrap';
    const track = document.createElement('div');
    track.className = 'marquee-track';
    repeated.forEach(w => {
        const s = document.createElement('span');
        s.textContent = w;
        track.appendChild(s);
    });
    wrap.appendChild(track);
    container.appendChild(wrap);
}

// ── Main init (called after loader exits) ─────────
function initSite() {
    // Font-ready check before sizing title
    document.fonts.ready.then(fitTitle);

    // Hero count-up
    countUp(document.getElementById('heroCount'), 1618);

    // Hero entrance
    const heroTl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    heroTl
        .from('.hero-count',     { y: 20, opacity: 0, duration: 0.6 })
        .from('#heroTitle',      { y: 80, opacity: 0, duration: 0.9 }, '-=0.3')
        .from('.hero-sub-left p',{ y: 20, opacity: 0, stagger: 0.1, duration: 0.5 }, '-=0.5')
        .from('#heroPhoto',      { y: 50, opacity: 0, duration: 0.8 }, '-=0.6')
        .from('.hero-location',  { opacity: 0, duration: 0.7 }, '-=0.4');

    // Add marquee between works and services
    const servicesSection = document.getElementById('services');
    if (servicesSection) buildMarquee(servicesSection.parentNode);

    // Scroll reveals
    const revealEls = [
        '.section-label',
        '.section-title',
        '.about-text',
        '.about-stats',
        '.contact-title',
        '.contact-right'
    ];

    revealEls.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
            gsap.from(el, {
                scrollTrigger: { trigger: el, start: 'top 88%', once: true },
                y: 40,
                opacity: 0,
                duration: 0.75,
                ease: 'power2.out'
            });
        });
    });

    // Work items with stagger by column
    document.querySelectorAll('.work-item').forEach((item, i) => {
        gsap.from(item, {
            scrollTrigger: { trigger: item, start: 'top 90%', once: true },
            y: 50,
            opacity: 0,
            duration: 0.65,
            delay: (i % 2) * 0.15,
            ease: 'power2.out'
        });
    });

    // Service rows slide in
    document.querySelectorAll('.service-item').forEach((item, i) => {
        gsap.from(item, {
            scrollTrigger: { trigger: item, start: 'top 92%', once: true },
            x: -30,
            opacity: 0,
            duration: 0.5,
            delay: i * 0.08,
            ease: 'power2.out'
        });
    });

    // Contact links
    document.querySelectorAll('.contact-link').forEach((link, i) => {
        gsap.from(link, {
            scrollTrigger: { trigger: link, start: 'top 92%', once: true },
            x: -20,
            opacity: 0,
            duration: 0.4,
            delay: i * 0.09,
            ease: 'power2.out'
        });
    });

    // Parallax on hero photo
    gsap.to('#heroPhoto', {
        scrollTrigger: {
            trigger: '.hero',
            start: 'top top',
            end: 'bottom top',
            scrub: true
        },
        y: -60,
        ease: 'none'
    });
}
