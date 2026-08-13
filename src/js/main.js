// =====================================================
// JEFF .K. HURIA — Portfolio JS
// =====================================================

gsap.registerPlugin(ScrollTrigger);

// Honor OS-level reduced-motion preference across all animation entry points
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── Rotating hero roles ─────────────────────────────
const heroRoles = [
    'SOFTWARE ENGINEER',
    'CLOUD ARCHITECT',
    'ERP SPECIALIST',
    'AI NATIVE FOUNDER',
    'TECH STRATEGIST',
    'GROWTH ENGINEER'
];

// ── Smooth scroll (Lenis) synced with ScrollTrigger ─
const lenis = new Lenis({
    duration: 1.15,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true
});

lenis.on('scroll', ScrollTrigger.update);

gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
});
gsap.ticker.lagSmoothing(0);

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
const spinTween = REDUCED_MOTION ? null : gsap.to(loaderSpin, {
    rotateY: 360,
    duration: 1.4,
    repeat: -1,
    ease: 'none'
});

// Count to 100%
let pct = 0;
const countTimer = setInterval(() => {
    pct += REDUCED_MOTION ? 100 : Math.floor(Math.random() * 9) + 3;
    if (pct >= 100) {
        pct = 100;
        clearInterval(countTimer);
        loaderPct.textContent = '100%';
        setTimeout(revealSite, REDUCED_MOTION ? 0 : 350);
    } else {
        loaderPct.textContent = pct + '%';
    }
}, 55);

function revealSite() {
    if (spinTween) spinTween.kill();

    gsap.timeline()
        .to(loader, { yPercent: -100, duration: 0.85, ease: 'power3.inOut' })
        .set(loader, { display: 'none' })
        .set(site, { visibility: 'visible' })
        .to(site, { opacity: 1, duration: 0.01 }, '<')
        .call(initSite);
}

// ── Hero title: auto-fit ONE font size that fits every
//    rotating role, so the text never resizes mid-rotation ─
let currentHeroRoleIndex = 0;

function buildHeroLetters(text) {
    const inner = document.getElementById('heroTitleInner');
    if (!inner) return null;
    inner.innerHTML = '';
    [...text].forEach(ch => {
        const span = document.createElement('span');
        span.className = 'htitle-letter';
        span.textContent = ch === ' ' ? '\u00A0' : ch;
        inner.appendChild(span);
    });
    return inner.querySelectorAll('.htitle-letter');
}

function fitTitle() {
    const title = document.getElementById('heroTitle');
    const inner = document.getElementById('heroTitleInner');
    if (!title || !inner) return;
    const maxWidth = title.parentElement.offsetWidth;

    let minFit = 600;
    heroRoles.forEach(role => {
        inner.textContent = role;
        let lo = 10, hi = 600;
        while (hi - lo > 1) {
            const mid = (lo + hi) / 2;
            title.style.fontSize = mid + 'px';
            inner.scrollWidth <= maxWidth ? lo = mid : hi = mid;
        }
        minFit = Math.min(minFit, lo);
    });

    title.style.fontSize = minFit + 'px';
    // Rebuild letter spans for whichever role should currently be showing
    buildHeroLetters(heroRoles[currentHeroRoleIndex]);
}

window.addEventListener('resize', fitTitle);

// ── Rotate hero title through heroRoles with a 3D
//    letter-flip: each letter rolls up and away, the
//    next word's letters roll down into place, with a
//    left-to-right stagger so it reads as a fast ripple
//    rather than a mechanical block-swap ────────────
function startHeroRoleRotation() {
    if (REDUCED_MOTION) return; // static first role is left in place
    const inner = document.getElementById('heroTitleInner');
    if (!inner) return;
    if (!inner.querySelector('.htitle-letter')) {
        buildHeroLetters(heroRoles[currentHeroRoleIndex]);
    }

    function step() {
        const outgoing = inner.querySelectorAll('.htitle-letter');
        gsap.to(outgoing, {
            rotateX: -100,
            yPercent: -120,
            opacity: 0,
            duration: 0.4,
            stagger: 0.018,
            ease: 'power3.in',
            transformOrigin: '50% 100%',
            onComplete: () => {
                currentHeroRoleIndex = (currentHeroRoleIndex + 1) % heroRoles.length;
                const incoming = buildHeroLetters(heroRoles[currentHeroRoleIndex]);
                gsap.set(incoming, { rotateX: 90, yPercent: 120, opacity: 0, transformOrigin: '50% 0%' });
                gsap.to(incoming, {
                    rotateX: 0,
                    yPercent: 0,
                    opacity: 1,
                    duration: 0.55,
                    stagger: 0.02,
                    ease: 'power4.out'
                });
            }
        });
    }

    gsap.delayedCall(3.4, function loop() {
        step();
        gsap.delayedCall(3.4, loop);
    });
}

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

// ── Split element's text into masked word spans ────
// Wraps each word in .split-word-mask > .split-word-inner
// so it can be revealed with a clipped translateY stagger.
function splitWords(el) {
    const html = el.innerHTML;
    // Preserve manual <br> line breaks while splitting words
    const lines = html.split(/<br\s*\/?>/i);
    el.innerHTML = '';
    lines.forEach((line, li) => {
        const words = line.trim().split(/\s+/).filter(Boolean);
        words.forEach(word => {
            const mask = document.createElement('span');
            mask.className = 'split-word-mask';
            const inner = document.createElement('span');
            inner.className = 'split-word-inner';
            inner.textContent = word + '\u00A0';
            mask.appendChild(inner);
            el.appendChild(mask);
        });
        if (li < lines.length - 1) el.appendChild(document.createElement('br'));
    });
    return el.querySelectorAll('.split-word-inner');
}

// ── About statement: split into individual letters ─
// Wraps every non-space character in its own span so each
// one can later become an independent physics body.
function splitStatementLetters(container) {
    const letters = [];
    container.querySelectorAll('.stmt-line').forEach(line => {
        const text = line.textContent;
        line.textContent = '';
        [...text].forEach(ch => {
            const span = document.createElement('span');
            span.className = 'stmt-letter';
            span.textContent = ch === ' ' ? ' ' : ch;
            line.appendChild(span);
            if (ch !== ' ') letters.push(span);
        });
    });
    return letters;
}

// ── About statement: gravity shatter (Matter.js) ───
// Freezes each letter's current screen position, hands it to a
// physics body, then syncs the body's position/angle back onto
// the element every frame until the pile comes to rest.
function shatterStatement(container, letters) {
    if (!window.Matter || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const { Engine, Runner, Bodies, Body, World } = Matter;
    const rect = container.getBoundingClientRect();

    container.style.height = rect.height + 'px';

    const engine = Engine.create();
    engine.gravity.y = 1;

    const items = letters.map(el => {
        const r = el.getBoundingClientRect();
        const left = r.left - rect.left;
        const top  = r.top - rect.top;
        el.style.position = 'absolute';
        el.style.left = left + 'px';
        el.style.top = top + 'px';
        el.style.margin = '0';

        const body = Bodies.rectangle(
            left + r.width / 2,
            top + r.height / 2,
            r.width, r.height,
            { restitution: 0.3, friction: 0.55, frictionAir: 0.015 }
        );
        Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.25);
        Body.setVelocity(body, { x: (Math.random() - 0.5) * 2, y: 0 });

        return { el, body, left, top, w: r.width, h: r.height };
    });

    World.add(engine.world, items.map(i => i.body));

    const floor      = Bodies.rectangle(rect.width / 2, rect.height + 20, rect.width * 2, 40, { isStatic: true });
    const leftWall    = Bodies.rectangle(-20, rect.height / 2, 40, rect.height * 2, { isStatic: true });
    const rightWall  = Bodies.rectangle(rect.width + 20, rect.height / 2, 40, rect.height * 2, { isStatic: true });
    World.add(engine.world, [floor, leftWall, rightWall]);

    const runner = Runner.create();
    Runner.run(runner, engine);

    function update() {
        let settled = true;
        items.forEach(({ el, body, left, top, w, h }) => {
            el.style.transform = `translate(${body.position.x - w / 2 - left}px, ${body.position.y - h / 2 - top}px) rotate(${body.angle}rad)`;
            if (body.speed > 0.05 || body.angularSpeed > 0.02) settled = false;
        });
        if (settled) {
            Runner.stop(runner);
            gsap.ticker.remove(update);
        }
    }
    gsap.ticker.add(update);
}

// ── Nav link letter-flip hover ─────────────────────
// Splits each nav link into two stacked letter rows
// (original + hidden clone). On hover both rows flip
// upward together, staggered per letter, so the
// original text rolls out while the clone rolls in
// underneath to replace it.
function initNavFlip() {
    if (REDUCED_MOTION) return; // keep plain, accessible link text
    document.querySelectorAll('.header-nav a').forEach(link => {
        const text = link.textContent;
        link.textContent = '';
        link.setAttribute('aria-label', text);

        const original = document.createElement('span');
        original.className = 'nav-letter-row nav-original';
        const clone = document.createElement('span');
        clone.className = 'nav-letter-row nav-clone';
        clone.setAttribute('aria-hidden', 'true');

        [...text].forEach(ch => {
            const o = document.createElement('span');
            o.className = 'nav-letter';
            o.textContent = ch === ' ' ? '\u00A0' : ch;
            original.appendChild(o);

            const c = document.createElement('span');
            c.className = 'nav-letter';
            c.textContent = ch === ' ' ? '\u00A0' : ch;
            clone.appendChild(c);
        });

        link.appendChild(original);
        link.appendChild(clone);

        const originalLetters = original.querySelectorAll('.nav-letter');
        const cloneLetters = clone.querySelectorAll('.nav-letter');
        gsap.set(cloneLetters, { yPercent: 100 });

        link.addEventListener('mouseenter', () => {
            gsap.to(originalLetters, { yPercent: -100, duration: 0.45, stagger: 0.02, ease: 'power3.inOut' });
            gsap.to(cloneLetters, { yPercent: 0, duration: 0.45, stagger: 0.02, ease: 'power3.inOut' });
        });
        link.addEventListener('mouseleave', () => {
            gsap.to(originalLetters, { yPercent: 0, duration: 0.45, stagger: 0.02, ease: 'power3.inOut' });
            gsap.to(cloneLetters, { yPercent: 100, duration: 0.45, stagger: 0.02, ease: 'power3.inOut' });
        });
    });
}

// ── Custom cursor + magnetic hover ─────────────────
function initCursorAndMagnets() {
    const cursor = document.getElementById('cursorDot');
    if (!cursor || matchMedia('(max-width: 960px)').matches) return;

    const setX = gsap.quickTo(cursor, 'x', { duration: 0.35, ease: 'power3.out' });
    const setY = gsap.quickTo(cursor, 'y', { duration: 0.35, ease: 'power3.out' });

    window.addEventListener('mousemove', (e) => {
        setX(e.clientX);
        setY(e.clientY);
    });

    const magnets = document.querySelectorAll(
        '.header-cta, .work-link, .service-cta, .contact-link, .header-nav a'
    );

    magnets.forEach(el => {
        const moveX = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3.out' });
        const moveY = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3.out' });

        el.addEventListener('mouseenter', () => cursor.classList.add('hovering'));
        el.addEventListener('mousemove', (e) => {
            const r = el.getBoundingClientRect();
            const relX = e.clientX - (r.left + r.width / 2);
            const relY = e.clientY - (r.top + r.height / 2);
            moveX(relX * 0.35);
            moveY(relY * 0.35);
        });
        el.addEventListener('mouseleave', () => {
            cursor.classList.remove('hovering');
            moveX(0);
            moveY(0);
        });
    });
}

// ── Mobile nav toggle ──────────────────────────────
function initNavToggle() {
    const headerEl = document.getElementById('header');
    const toggle = document.querySelector('.nav-toggle');
    if (!headerEl || !toggle) return;

    const setState = (open) => {
        headerEl.classList.toggle('nav-open', open);
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    };

    toggle.addEventListener('click', () => {
        setState(!headerEl.classList.contains('nav-open'));
    });

    headerEl.querySelectorAll('.header-nav a').forEach(link => {
        link.addEventListener('click', () => setState(false));
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') setState(false);
    });
}

// ── Clip-path curtain reveal for images ────────────
function revealImage(el, { scrollTriggered = true } = {}) {
    gsap.set(el, { clipPath: 'inset(0 0 100% 0)' });
    const anim = {
        clipPath: 'inset(0 0 0% 0)',
        duration: 1.1,
        ease: 'power4.out'
    };
    if (scrollTriggered) {
        gsap.to(el, {
            ...anim,
            scrollTrigger: { trigger: el, start: 'top 85%', once: true }
        });
    } else {
        gsap.to(el, anim);
    }
}

// ── Main init (called after loader exits) ─────────
function initSite() {
    // Mobile nav + always-available interactions
    initNavToggle();

    // Font-ready check before sizing title
    document.fonts.ready.then(fitTitle);

    // Hero count-up
    const heroCountEl = document.getElementById('heroCount');
    if (heroCountEl) countUp(heroCountEl, 8);

    // Reduced motion: content is already visible in the HTML, so all
    // entrance/scroll animations are skipped rather than fast-forwarded.
    if (REDUCED_MOTION) return;

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

    // Cursor + magnetic buttons
    initNavFlip();

    initCursorAndMagnets();

    // Start the hero role rotation once the entrance settles
    startHeroRoleRotation();

    // Curtain-reveal the hero photo once the entrance timeline gets to it
    const heroPhotoEl = document.getElementById('heroPhoto');
    if (heroPhotoEl) revealImage(heroPhotoEl, { scrollTriggered: false });

    // Masked word-by-word reveal for every heading (section titles + contact title)
    document.querySelectorAll('.section-title, .contact-title').forEach(title => {
        const words = splitWords(title);
        gsap.from(words, {
            scrollTrigger: { trigger: title, start: 'top 88%', once: true },
            yPercent: 110,
            duration: 0.9,
            stagger: 0.06,
            ease: 'power4.out'
        });
    });

    // Curtain-reveal each work image on scroll
    document.querySelectorAll('.work-img-inner').forEach(img => revealImage(img));

    // About statement: shatter into physics letters on scroll
    const statementEl = document.getElementById('aboutStatement');
    if (statementEl && !matchMedia('(max-width: 720px)').matches) {
        const statementLetters = splitStatementLetters(statementEl);
        ScrollTrigger.create({
            trigger: statementEl,
            start: 'top 65%',
            once: true,
            onEnter: () => shatterStatement(statementEl, statementLetters)
        });
    }

    // Scroll reveals
    const revealEls = [
        '.section-label',
        '.about-text',
        '.about-stats',
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

    // Experience rows slide in
    document.querySelectorAll('.exp-item').forEach((item, i) => {
        gsap.from(item, {
            scrollTrigger: { trigger: item, start: 'top 90%', once: true },
            x: -30,
            opacity: 0,
            duration: 0.5,
            delay: i * 0.08,
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
