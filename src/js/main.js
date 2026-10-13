// =====================================================================
// JEFF .K. HURIA — Portfolio motion
// GSAP + ScrollTrigger for animation, Lenis for smooth scroll.
// Everything degrades to static, readable content without JS or with
// prefers-reduced-motion.
// =====================================================================

gsap.registerPlugin(ScrollTrigger);

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE_POINTER = matchMedia('(hover: hover) and (pointer: fine)').matches;
const isDesktop = () => matchMedia('(min-width: 861px)').matches;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const rand = gsap.utils.random;
const root = document.documentElement;

let firstVisit = root.classList.contains('first-visit');
try { sessionStorage.setItem('jkh-visited', '1'); } catch (e) { /* private mode */ }

// ── Smooth scroll ───────────────────────────────────────
const lenis = REDUCED ? null : new Lenis({ duration: 1.2, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
if (lenis) {
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
}
// Pause scrolling by blocking the input, never with overflow: hidden. Hiding overflow removes the
// scrollbar, which widens the page ~15px and makes everything (the fitted titles most of all) jump.
const SCROLL_KEYS = new Set([' ', 'PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown']);
let scrollPaused = false;
const blockScroll = (e) => {
    if (!scrollPaused) return;
    const target = e.target.closest ? e.target : document.body;
    if (target.closest('#menu')) return; // the open menu may scroll itself on short screens
    if (e.type === 'keydown' && (!SCROLL_KEYS.has(e.key) || target.closest('input, textarea, select, [contenteditable]'))) return;
    e.preventDefault();
};
addEventListener('wheel', blockScroll, { passive: false });
addEventListener('touchmove', blockScroll, { passive: false });
addEventListener('keydown', blockScroll);
function pauseScroll() { scrollPaused = true; lenis && lenis.stop(); }
function resumeScroll() { scrollPaused = false; lenis && lenis.start(); }

const scrollToTarget = (target, immediate = false) => {
    const el = typeof target === 'string' ? $(target) : target;
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { immediate, duration: 1.6 });
    else el.scrollIntoView({ behavior: immediate ? 'auto' : 'smooth' });
};

// ── Text splitting ──────────────────────────────────────
// Wraps every character of an element's text in .ch spans; words are kept
// together in .word spans so lines still break between words.
function splitChars(el) {
    if (el.dataset.split) return $$('.ch', el);
    el.dataset.split = '1';
    const walk = (node) => {
        [...node.childNodes].forEach((child) => {
            if (child.nodeType === 3) {
                const frag = document.createDocumentFragment();
                child.textContent.split(/(\s+)/).forEach((part) => {
                    if (!part) return;
                    if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
                    const word = document.createElement('span');
                    word.className = 'word';
                    [...part].forEach((c) => {
                        const ch = document.createElement('span');
                        ch.className = 'ch';
                        ch.textContent = c;
                        word.appendChild(ch);
                    });
                    frag.appendChild(word);
                });
                child.replaceWith(frag);
            } else if (child.nodeType === 1 && !child.classList.contains('arr')) {
                walk(child);
            }
        });
    };
    walk(el);
    return $$('.ch', el);
}

// Splits a block of text into masked lines (by measuring word positions)
function splitLines(el) {
    const words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words.map((w) => `<span class="word">${w}</span>`).join(' ');
    const lines = [];
    let lastTop = null;
    $$('.word', el).forEach((w) => {
        const top = w.offsetTop;
        if (top !== lastTop) { lines.push([]); lastTop = top; }
        lines[lines.length - 1].push(w.textContent);
    });
    el.innerHTML = lines.map((l) => `<span class="line-mask"><span class="line-inner">${l.join(' ')}</span></span>`).join('');
    return $$('.line-inner', el);
}

// ── Fit text to its container width ─────────────────────
function fitAll() {
    $$('[data-fit]').forEach((el) => {
        const box = el.parentElement;
        const style = getComputedStyle(box);
        const avail = box.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        el.style.fontSize = '100px';
        const w = el.getBoundingClientRect().width;
        // 0.99: leave a hair of room so tight tracking never clips the last glyph
        if (w > 0) el.style.fontSize = Math.floor((avail / w) * 99 * 100) / 100 + 'px';
    });
}

// ── Letter-roll hover ───────────────────────────────────
function initRoll() {
    $$('[data-roll]').forEach((el) => {
        const textNode = [...el.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
        if (!textNode) return;
        const text = textNode.textContent.trim();
        const make = (hidden) => {
            const row = document.createElement('span');
            row.className = 'roll-row';
            if (hidden) row.setAttribute('aria-hidden', 'true');
            [...text].forEach((c, i) => {
                const s = document.createElement('span');
                s.className = 'roll-ch';
                s.style.setProperty('--i', i);
                s.textContent = c === ' ' ? ' ' : c;
                row.appendChild(s);
            });
            return row;
        };
        const roll = document.createElement('span');
        roll.className = 'roll';
        roll.append(make(false), make(true));
        textNode.replaceWith(roll, document.createTextNode(' '));
    });
}

// ── Odometer counters ───────────────────────────────────
function buildOdometer(el) {
    const value = Number(el.dataset.odometer);
    const text = value.toLocaleString('en-US');
    el.setAttribute('aria-label', text);
    el.innerHTML = '';
    const reels = [];
    [...text].forEach((c) => {
        if (!/\d/.test(c)) {
            const s = document.createElement('span');
            s.textContent = c;
            s.setAttribute('aria-hidden', 'true');
            el.appendChild(s);
            return;
        }
        const digit = document.createElement('span');
        digit.className = 'odo-digit';
        digit.setAttribute('aria-hidden', 'true');
        const reel = document.createElement('span');
        reel.className = 'odo-reel';
        for (let i = 0; i < 20; i++) {
            const n = document.createElement('span');
            n.textContent = i % 10;
            reel.appendChild(n);
        }
        digit.appendChild(reel);
        el.appendChild(digit);
        reels.push({ reel, target: 10 + Number(c) });
    });
    return reels;
}
function runOdometer(reels, delay = 0) {
    reels.forEach(({ reel, target }, i) => {
        if (REDUCED) { gsap.set(reel, { yPercent: -(target * 5) }); return; }
        gsap.fromTo(reel, { yPercent: 0 }, { yPercent: -(target * 5), duration: 2 + i * 0.12, delay, ease: 'expo.out' });
    });
}
function initOdometers() {
    $$('[data-odometer]').forEach((el) => {
        const reels = buildOdometer(el);
        if (el.closest('.hero')) { el._reels = reels; return; } // fired by the hero intro
        ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => runOdometer(reels) });
    });
}

// ── Loader: 3D text cylinder ────────────────────────────
// The only loading screen on the site. It covers every page load and every
// internal navigation; the rings themselves are rendered in loader.njk.
// The loader moves as one solid layer (transform only, so the compositor does
// the work), on an expo in-out curve, and the page drifts with it.
const loader = $('#loader');
let markBooted;
const booted = new Promise((r) => { markBooted = r; });
const loaderPct = $('#loaderPct');
// The first time GSAP transforms a fixed element with no transform, it measures it by briefly taking it out
// of the DOM, and that restarts the rings' CSS spin at 0deg (a visible jerk as the loader lifts). Let that
// happen once, now, and put the spin back on the shared clock in the same frame so nothing moves.
if (loader) { gsap.set(loader, { yPercent: 0 }); window.jkhSyncSpin && window.jkhSyncSpin(); }
const setPct = (v) => { if (loaderPct) loaderPct.textContent = Math.round(v); };
const EASE_SHEET = 'expo.inOut';
const nextFrames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
// a transform on <main> would unfix a pinned section, so the page only drifts when nothing is pinned
const pinActive = () => ScrollTrigger.getAll().some((t) => t.pin && t.isActive);

function hideLoader() {
    if (!loader) return;
    gsap.set(loader, { yPercent: 100, visibility: 'hidden' });
}

// Resolves as the page starts to show, so the hero intro overlaps the reveal
function runLoader() {
    return new Promise((resolve) => {
        if (REDUCED || !loader) { resolve(); return; }
        pauseScroll();
        const progress = { v: 0 };
        const ready = Promise.all([
            document.fonts.ready,
            new Promise((r) => (document.readyState === 'complete' ? r() : addEventListener('load', r, { once: true }))),
            // every section is built and measured, so the reveal has the main thread to itself (never wait past 4s)
            Promise.race([booted, new Promise((r) => setTimeout(r, 4000))]),
        ]);
        gsap.to(progress, {
            v: 92, duration: firstVisit ? 2.4 : 0.9, ease: 'power2.inOut',
            onUpdate: () => setPct(progress.v),
            onComplete: () => ready.then(prepareUncover).then(nextFrames).then((drift) => gsap.to(progress, {
                v: 100, duration: 0.3, ease: 'power2.out', onUpdate: () => setPct(progress.v),
                onComplete: () => uncover(drift, resolve),
            })),
        });
    });
}

// Do the expensive work while the screen is still covered, so the slide itself only
// moves layers: decode the images about to be uncovered and lift the page onto its
// own GPU layer at its start position.
function prepareUncover() {
    const main = $('#main');
    const drift = !!main && !pinActive();
    if (drift) gsap.set(main, { y: 90, force3D: true });
    const visible = [...document.images].filter((img) => img.getBoundingClientRect().top < innerHeight * 1.2);
    const decoded = visible.map((img) => (img.decode ? img.decode().catch(() => {}) : null));
    const cap = new Promise((r) => setTimeout(r, 1200));
    return Promise.race([Promise.all(decoded), cap]).then(() => drift);
}

function uncover(drift, onShowing) {
    const main = $('#main');
    gsap.timeline({
        onComplete: () => {
            hideLoader();
            gsap.set('.loader-stage', { clearProps: 'all' });
            gsap.set('.loader-pct', { clearProps: 'opacity' });
            if (drift) { gsap.set(main, { clearProps: 'transform' }); ScrollTrigger.refresh(); }
            resumeScroll();
        },
    })
        .to('.loader-stage', { scale: 1.6, opacity: 0, duration: 0.8, ease: 'power3.in' })
        .to('.loader-pct', { opacity: 0, duration: 0.3, ease: 'power1.out' }, 0)
        .to(loader, { yPercent: -100, duration: 1.1, ease: EASE_SHEET }, 0.4)
        .to(drift ? main : {}, { y: 0, duration: 1.1, ease: EASE_SHEET, force3D: true }, 0.4)
        .add(onShowing, 0.85);
}

// Slide the loader up over the current page, then leave
function coverWithLoader(href) {
    if (!loader) { location.href = href; return; }
    pauseScroll();
    setPct(0);
    const tl = gsap.timeline({ onComplete: () => { location.href = href; } })
        .set(loader, { visibility: 'visible', yPercent: 100 })
        .set('.loader-stage', { scale: 0.86, opacity: 0 })
        .set('.loader-pct', { opacity: 0 })
        .to(loader, { yPercent: 0, duration: 0.9, ease: EASE_SHEET })
        .to('.loader-stage', { scale: 1, opacity: 1, duration: 0.7, ease: 'power3.out' }, 0.4)
        .to('.loader-pct', { opacity: 1, duration: 0.4 }, 0.6);
    if (!pinActive()) tl.to('#main', { y: -70, duration: 0.9, ease: EASE_SHEET, force3D: true }, 0);
}

// Fetch the next page while the pointer is on its way, so arrival is quick
const prefetched = new Set();
function prefetch(path) {
    if (prefetched.has(path)) return;
    prefetched.add(path);
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = path;
    document.head.appendChild(link);
}
function internalUrl(a) {
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return null;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || !/^https?:/.test(url.protocol)) return null;
    return url;
}

// ── Page transitions ────────────────────────────────────
function initTransitions() {
    const warm = (e) => {
        const url = internalUrl(e.target.closest && e.target.closest('a'));
        if (url && url.pathname !== location.pathname) prefetch(url.pathname);
    };
    document.addEventListener('pointerover', warm, { passive: true });
    document.addEventListener('touchstart', warm, { passive: true });
    document.addEventListener('click', (e) => {
        const a = e.target.closest('a');
        if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        const url = internalUrl(a);
        if (!url) return;
        const samePage = url.pathname === location.pathname;
        if (samePage && url.hash) { // in-page anchor: smooth scroll
            e.preventDefault();
            closeMenu();
            scrollToTarget(url.hash);
            history.pushState(null, '', url.hash);
            return;
        }
        if (samePage && !url.hash) { e.preventDefault(); scrollToTarget(document.body); return; }
        if (REDUCED || !loader) return;
        e.preventDefault();
        closeMenu();
        coverWithLoader(url.href);
    });
    // Back/forward from the bfcache: the page comes back still covered
    addEventListener('pageshow', (e) => {
        if (!e.persisted) return;
        hideLoader();
        gsap.set('#main', { clearProps: 'transform' });
        resumeScroll();
    });
}

// ── Menu (mobile) ───────────────────────────────────────
const menuBtn = $('#menuBtn');
function closeMenu() {
    if (!root.classList.contains('menu-open')) return;
    root.classList.remove('menu-open');
    menuBtn.setAttribute('aria-expanded', 'false');
    $('.menu-btn-text').textContent = 'MENU';
    $('#menu').setAttribute('aria-hidden', 'true');
    resumeScroll();
}
function initMenu() {
    if (!menuBtn) return;
    menuBtn.addEventListener('click', () => {
        const open = !root.classList.contains('menu-open');
        if (!open) { closeMenu(); return; }
        root.classList.add('menu-open');
        menuBtn.setAttribute('aria-expanded', 'true');
        $('.menu-btn-text').textContent = 'CLOSE';
        $('#menu').setAttribute('aria-hidden', 'false');
        pauseScroll();
    });
    addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
}

// ── Cursor ──────────────────────────────────────────────
function initCursor() {
    if (!FINE_POINTER || REDUCED) return;
    root.classList.add('has-cursor');
    const cursor = $('#cursor');
    const label = $('#cursorLabel');
    const x = gsap.quickTo(cursor, 'x', { duration: 0.25, ease: 'power3.out' });
    const y = gsap.quickTo(cursor, 'y', { duration: 0.25, ease: 'power3.out' });
    addEventListener('pointermove', (e) => { x(e.clientX); y(e.clientY); cursor.classList.add('is-live'); });
    document.addEventListener('pointerover', (e) => {
        const labelled = e.target.closest('[data-cursor]');
        const hot = e.target.closest('a, button, label, input, textarea');
        cursor.classList.toggle('is-label', !!labelled);
        cursor.classList.toggle('is-hover', !labelled && !!hot);
        label.textContent = labelled ? labelled.dataset.cursor : '';
    });
    document.addEventListener('pointerleave', () => cursor.classList.remove('is-hover', 'is-label'));

    // Magnetic pull on small round controls
    $$('.room-btn, .menu-btn').forEach((el) => {
        const mx = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3.out' });
        const my = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3.out' });
        el.addEventListener('pointermove', (e) => {
            const r = el.getBoundingClientRect();
            mx((e.clientX - r.left - r.width / 2) * 0.4);
            my((e.clientY - r.top - r.height / 2) * 0.4);
        });
        el.addEventListener('pointerleave', () => { mx(0); my(0); });
    });
}

// ── Mock data toggle ────────────────────────────────────
function initMockToggle() {
    const btn = $('#mockToggle');
    if (!btn) return;
    const sync = () => {
        const on = root.classList.contains('mock-on');
        btn.setAttribute('aria-pressed', String(on));
        $('.mock-state', btn).textContent = on ? 'ON' : 'OFF';
    };
    const toggle = () => {
        root.classList.toggle('mock-on');
        try { localStorage.setItem('jkh-mock', root.classList.contains('mock-on') ? 'on' : 'off'); } catch (e) { /* ignore */ }
        sync();
    };
    btn.addEventListener('click', toggle);
    addEventListener('keydown', (e) => {
        if ((e.key === 'm' || e.key === 'M') && !e.target.closest('input, textarea')) toggle();
    });
    sync();
}

// ── Accordions (services, experience) ───────────────────
function initAccordions() {
    $$('.services-list, .exp-list').forEach((list) => {
        const items = $$(':scope > .service, :scope > .exp', list);
        items.forEach((item, i) => {
            const btn = $(':scope > button', item);
            const set = (open) => { item.classList.toggle('is-open', open); btn.setAttribute('aria-expanded', String(open)); };
            if (i === 0) set(true);
            btn.addEventListener('click', () => {
                const open = !item.classList.contains('is-open');
                items.forEach((other) => other !== item && other.classList.remove('is-open'));
                items.forEach((other) => other !== item && $(':scope > button', other).setAttribute('aria-expanded', 'false'));
                set(open);
                // heights change: re-measure triggers after the transition
                setTimeout(() => ScrollTrigger.refresh(), 850);
            });
        });
    });
}

// ── Reveals ─────────────────────────────────────────────
function initReveals() {
    const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -10% 0px' });
    $$('[data-reveal]').forEach((el) => io.observe(el));
    if (REDUCED) return;

    $$('[data-lines]').forEach((el) => {
        const lines = splitLines(el);
        gsap.from(lines, { yPercent: 105, duration: 1.1, stagger: 0.08, ease: 'power4.out', scrollTrigger: { trigger: el, start: 'top 88%' } });
    });

    $$('[data-curtain]').forEach((el) => {
        gsap.fromTo(el, { clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0% 0 0 0)', duration: 1.4, ease: 'power4.inOut', scrollTrigger: { trigger: el, start: 'top 85%' } });
        const img = $('img', el);
        if (img) gsap.fromTo(img, { scale: 1.3 }, { scale: 1, duration: 1.8, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 85%' } });
    });

    // Big titles: scattered letters assemble as they scroll into view
    $$('[data-scatter]').forEach((el) => {
        const chars = splitChars(el);
        gsap.fromTo(chars,
            { x: () => rand(-160, 160), y: () => rand(-120, 140), rotation: () => rand(-50, 50), opacity: 0.15 },
            { x: 0, y: 0, rotation: 0, opacity: 1, ease: 'power2.out', stagger: { each: 0.02, from: 'random' },
              scrollTrigger: { trigger: el, start: 'top 98%', end: 'top 45%', scrub: 1 } });
    });

    // Contact title: lines rise, letters settle
    $$('[data-assemble]').forEach((el) => {
        const chars = splitChars(el);
        gsap.fromTo(chars,
            { yPercent: () => rand(80, 220), rotation: () => rand(-25, 25), opacity: 0 },
            { yPercent: 0, rotation: 0, opacity: 1, ease: 'power3.out', stagger: { each: 0.012, from: 'random' },
              scrollTrigger: { trigger: el, start: 'top 95%', end: 'top 40%', scrub: 1 } });
    });

    // Footer name rises letter by letter
    $$('.footer-name .fit-text').forEach((el) => {
        const chars = splitChars(el);
        gsap.from(chars, { yPercent: 100, duration: 1.2, ease: 'power4.out', stagger: 0.04, scrollTrigger: { trigger: el, start: 'top 95%' } });
    });
}

// ── Hero ────────────────────────────────────────────────
function prepareHero() {
    const title = $('.hero-title .fit-text, .project-title .fit-text');
    if (!title || REDUCED) return null;
    const chars = splitChars(title);
    gsap.set(chars, { yPercent: 110 });
    const parts = $$('.hero-counter, .hero-based span, .hero-roles li, .hero-copy p, .hero-foot > *, .project-intro > *, .project-hero .sec-bar > *');
    gsap.set(parts, { opacity: 0, y: 24 });
    if ($('.hero-photo')) {
        gsap.set('.hero-photo', { clipPath: 'inset(100% 0 0 0)' });
        gsap.set('.hero-photo img', { scale: 1.35 });
        gsap.set('.hero-plate', { scaleX: 0, transformOrigin: 'left' });
    }
    return () => {
        const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
        tl.to(chars, { yPercent: 0, duration: 1.3, stagger: 0.035 })
          .to(parts, { opacity: 1, y: 0, duration: 1, stagger: 0.06 }, 0.35);
        if ($('.hero-photo')) {
            tl.to('.hero-plate', { scaleX: 1, duration: 1.2, ease: 'power3.inOut' }, 0.3)
              .to('.hero-photo', { clipPath: 'inset(0% 0 0 0)', duration: 1.3, ease: 'power4.inOut' }, 0.45)
              .to('.hero-photo img', { scale: 1, duration: 1.8, ease: 'power3.out' }, 0.45);
        }
        const counter = $('.hero [data-odometer]');
        if (counter && counter._reels) runOdometer(counter._reels, 0.5);
    };
}

function initHeroScroll() {
    if (REDUCED || !$('.hero')) return;
    gsap.to('.hero-photo', { yPercent: -18, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.hero-plate', { yPercent: 10, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.hero-title', { yPercent: 30, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
}

// ── Manifesto: pinned, letters fly in and assemble ──────
function initManifesto() {
    const text = $('[data-manifesto]');
    if (!text) return;
    if (REDUCED) return;
    const chars = splitChars(text);
    const pin = $('.manifesto-pin');
    gsap.fromTo(chars,
        { x: () => rand(-window.innerWidth * 0.35, window.innerWidth * 0.35), y: () => rand(window.innerHeight * 0.2, window.innerHeight * 0.9), rotation: () => rand(-110, 110), opacity: 0 },
        { x: 0, y: 0, rotation: 0, opacity: 1, ease: 'power3.out', stagger: { each: 0.008, from: 'random' },
          scrollTrigger: isDesktop()
              ? { trigger: pin, start: 'top top', end: '+=140%', scrub: 1, pin: true, anticipatePin: 1 }
              : { trigger: pin, start: 'top 85%', end: 'center 45%', scrub: 1 } });
}

// ── Works: 3D room carousel ─────────────────────────────
function initRoom() {
    const room = $('.room');
    if (!room) return;
    const slides = $$('.screen-slide', room);
    const data = JSON.parse($('#roomData').textContent);
    const screen = $('#roomScreen');
    const titleEl = $('#roomTitle');
    const idxEl = $('#roomIdx');
    const view = $('#roomView');
    let index = 0;

    const go = (next) => {
        index = (next + slides.length) % slides.length;
        slides.forEach((s, i) => s.classList.toggle('is-active', i === index));
        screen.classList.remove('is-flash'); void screen.offsetWidth; screen.classList.add('is-flash');
        idxEl.textContent = index + 1;
        view.href = data[index].href;
        if (REDUCED) { titleEl.textContent = data[index].title; return; }
        gsap.timeline()
            .to(titleEl, { yPercent: -60, opacity: 0, duration: 0.25, ease: 'power2.in' })
            .add(() => { titleEl.textContent = data[index].title; })
            .fromTo(titleEl, { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.45, ease: 'power3.out' });
    };
    $('#roomPrev').addEventListener('click', () => go(index - 1));
    $('#roomNext').addEventListener('click', () => go(index + 1));

    // Keyboard while the room is on screen
    let inView = false;
    ScrollTrigger.create({ trigger: room, start: 'top center', end: 'bottom center', onToggle: (s) => { inView = s.isActive; } });
    addEventListener('keydown', (e) => {
        if (!inView || e.target.closest('input, textarea')) return;
        if (e.key === 'ArrowRight') go(index + 1);
        if (e.key === 'ArrowLeft') go(index - 1);
    });

    // Drag / swipe
    const stage = $('#roomStage');
    let startX = null, dragged = false;
    stage.addEventListener('pointerdown', (e) => { startX = e.clientX; dragged = false; });
    addEventListener('pointerup', (e) => {
        if (startX === null) return;
        const dx = e.clientX - startX;
        if (Math.abs(dx) > 50) { dragged = true; go(dx < 0 ? index + 1 : index - 1); }
        startX = null;
    });
    stage.addEventListener('click', (e) => { if (dragged) { e.preventDefault(); e.stopPropagation(); dragged = false; } }, true);
    stage.addEventListener('dragstart', (e) => e.preventDefault());

    if (REDUCED) return;
    // Camera dolly as the room scrolls into view
    gsap.fromTo('#roomBox', { scale: 1.55 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: room, start: 'top bottom', end: 'top top', scrub: true } });
    gsap.from('.room-ui > *', { opacity: 0, y: 30, stagger: 0.08, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: room, start: 'top 30%' } });
    // Subtle parallax with the pointer
    if (FINE_POINTER) {
        const rx = gsap.quickTo('#roomBox', 'x', { duration: 1.2, ease: 'power3.out' });
        const ry = gsap.quickTo('#roomBox', 'y', { duration: 1.2, ease: 'power3.out' });
        room.addEventListener('pointermove', (e) => {
            const r = room.getBoundingClientRect();
            rx(((e.clientX - r.left) / r.width - 0.5) * -30);
            ry(((e.clientY - r.top) / r.height - 0.5) * -18);
        });
    }
}

// ── Works index: floating preview ───────────────────────
function initWorksIndex() {
    if (!FINE_POINTER) return;
    $$('.works-index').forEach((wrap) => {
        const preview = $('.wi-preview', wrap);
        const inner = $('.wi-preview-inner', wrap);
        const px = gsap.quickTo(preview, 'x', { duration: 0.6, ease: 'power3.out' });
        const py = gsap.quickTo(preview, 'y', { duration: 0.6, ease: 'power3.out' });
        const list = $('.wi-list', wrap);
        list.addEventListener('pointermove', (e) => { px(e.clientX + 30); py(e.clientY - 110); });
        $$('.wi-row', wrap).forEach((row) => {
            row.addEventListener('pointerenter', () => {
                const src = row.dataset.preview;
                inner.style.backgroundImage = src ? `url("${src}")` : '';
                inner.innerHTML = src ? '' : `<span class="wi-preview-word">${row.dataset.word}</span>`;
                preview.classList.add('is-on');
            });
            row.addEventListener('pointerleave', () => preview.classList.remove('is-on'));
        });
    });
}

// ── Marquee: speed follows scroll velocity ──────────────
function initMarquees() {
    $$('[data-marquee]').forEach((track) => {
        const group = $('.marquee-group', track);
        let x = 0, dir = -1;
        const base = 0.6;
        gsap.ticker.add(() => {
            const v = lenis ? lenis.velocity : 0;
            if (v) dir = v > 0 ? -1 : 1;
            if (REDUCED) return;
            x += dir * (base + Math.min(Math.abs(v) * 0.35, 14));
            const w = group.offsetWidth;
            if (x <= -w) x += w;
            if (x > 0) x -= w;
            track.style.transform = `translate3d(${x}px,0,0)`;
        });
    });
}

// ── Horizontal pinned scroll (testimonials, gallery) ────
function initHorizontal() {
    if (REDUCED || !isDesktop()) return;
    $$('.words, [data-hscroll]').forEach((section) => {
        const track = $('.words-track, .gallery-track', section);
        if (!track) return;
        const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
        gsap.to(track, {
            x: () => -dist(), ease: 'none',
            scrollTrigger: { trigger: section, start: 'top top', end: () => '+=' + dist(), scrub: 1, pin: true, invalidateOnRefresh: true, anticipatePin: 1 }
        });
    });
}

// ── Project pages ───────────────────────────────────────
function initProject() {
    if (REDUCED) return;
    const cover = $('[data-cover] .project-cover-inner');
    if (cover) {
        gsap.fromTo(cover, { clipPath: 'inset(6% 9% 6% 9%)' }, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'none', scrollTrigger: { trigger: cover, start: 'top 95%', end: 'top 15%', scrub: true } });
        const img = $('img', cover);
        if (img) gsap.fromTo(img, { yPercent: -8 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: cover, start: 'top bottom', end: 'bottom top', scrub: true } });
        $$('.cover-type-row', cover).forEach((row, i) => {
            gsap.fromTo(row, { xPercent: i % 2 ? -20 : 0 }, { xPercent: i % 2 ? 0 : -20, ease: 'none', scrollTrigger: { trigger: cover, start: 'top bottom', end: 'bottom top', scrub: true } });
        });
    }
    $$('.impact-value, .project-facts .stat-num').forEach((el) => {
        gsap.from(el, { yPercent: 60, opacity: 0, duration: 1.1, ease: 'power4.out', scrollTrigger: { trigger: el, start: 'top 92%' } });
    });
    const next = $('.next-project .fit-text');
    if (next) {
        const chars = splitChars(next);
        gsap.from(chars, { yPercent: 100, opacity: 0, stagger: 0.03, duration: 1, ease: 'power4.out', scrollTrigger: { trigger: next, start: 'top 95%' } });
    }
}

// ── Clock ───────────────────────────────────────────────
function initClock() {
    const el = $('#clock');
    if (!el) return;
    const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Nairobi', hour: '2-digit', minute: '2-digit' });
    const tick = () => { el.textContent = fmt.format(new Date()); };
    tick();
    setInterval(tick, 15000);
}

// ── Boot ────────────────────────────────────────────────
(async function boot() {
    const intro = runLoader();
    initMockToggle();
    initMenu();
    initTransitions();
    initClock();
    initRoll();
    initAccordions();

    await document.fonts.ready;
    // Split before fitting so the measured width matches what is shown
    const playHero = prepareHero();
    fitAll();
    addEventListener('resize', fitAll);

    initOdometers();
    initHeroScroll();
    initReveals();
    initManifesto();
    initRoom();
    initWorksIndex();
    initMarquees();
    initHorizontal();
    initProject();
    initCursor();

    ScrollTrigger.sort();
    ScrollTrigger.refresh();

    if (location.hash) scrollToTarget(location.hash, true);
    markBooted();

    await intro;
    firstVisit = false;
    root.classList.remove('first-visit');
    if (playHero) playHero();
})();
