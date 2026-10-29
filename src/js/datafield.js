/* =====================================================
   Data field: a grid of business records (invoices, orders, payments, sync
   statuses) whose brightness is driven by slow flowing noise, so the data
   seems to form shapes. The cursor parts it like a hand through water.

   Rendering is one WebGL fragment shader: the glyphs come from an atlas
   texture, which glyph sits in each cell comes from a small data texture, and
   the noise is computed per pixel on the GPU. The CPU only rewrites a handful
   of cells per frame (new records "typing in"). Pauses when off-screen.

   Usage: DataField.mount(canvas, { reduced, quiet, getVelocity, ink, max }) -> controller | null
   ===================================================== */
(function () {
    'use strict';

    // Index 0 must stay a space: empty cells read as 0
    const CHARSET = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-·.,:/+';
    const INDEX = new Map([...CHARSET].map((c, i) => [c, i]));

    // ── Records: what an ERP sync log looks like up close ──
    const pick = (list) => list[(Math.random() * list.length) | 0];
    const digits = (n) => { let s = ''; for (let i = 0; i < n; i++) s += (Math.random() * 10) | 0; return s; };
    const alnum = (n) => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789'; let s = ''; for (let i = 0; i < n; i++) s += a[(Math.random() * a.length) | 0]; return s; };
    const money = () => (Math.round(Math.random() * 480000) + 1200).toLocaleString('en-US');
    const clock = () => [24, 60, 60].map((m) => String((Math.random() * m) | 0).padStart(2, '0')).join(':');
    const RECORDS = [
        () => `INV-26-${digits(5)}`,
        () => `SO-${digits(4)}`,
        () => `PO-${digits(5)}`,
        () => `GRN-${digits(4)}`,
        () => `CN-${digits(4)}`,
        () => `SKU ${alnum(3)}-${digits(3)}`,
        () => `KES ${money()}`,
        () => `MPESA ${alnum(10)}`,
        () => `${clock()}`,
        () => pick(['SYNC OK', 'POSTED', '200 OK', 'ACK', 'QUEUED', 'MATCHED', 'RECONCILED', 'BATCH DONE']),
        () => pick(['SAP.B1', 'ODOO', 'SAGE', 'SYSPRO', 'DYNAMICS', 'ACUMATICA', 'TALLY']),
        () => `QTY ${(Math.random() * 900 + 1) | 0}`,
        () => `WH/${pick(['NBO', 'MSA', 'KSM', 'EDL'])}/${digits(2)}`,
    ];
    const record = () => pick(RECORDS)();
    const logLine = (len) => { let s = ''; while (s.length < len) s += record() + ' · '; return s; };

    // ── Shaders ──
    const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

    const FRAG = `
precision highp float;
uniform vec2 uRes;        // canvas size, device px
uniform vec2 uCell;       // cell size, device px
uniform vec2 uGrid;       // cols, rows
uniform vec2 uAtlasGrid;  // glyph columns, rows in the atlas
uniform float uTime;
uniform float uMax;       // brightest a glyph gets (alpha)
uniform vec3 uInk;
uniform sampler2D uGlyphs;
uniform sampler2D uChars;
uniform vec3 uTrail[12];  // x, y (device px, top-left origin), strength
uniform float uRadius;
uniform vec4 uSafe;       // x0, y0, x1, y1 (device px): the headline's box, kept quiet
uniform float uFeather;

// Simplex noise, Ashima Arts / Stefan Gustavson (MIT)
vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m; m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
}

void main() {
    vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);   // top-left origin
    vec2 cell = floor(px / uCell);
    vec2 local = fract(px / uCell);
    vec2 center = (cell + 0.5) * uCell;

    // The cursor's wake: bends the flow aside and lights up the records beneath it (a hollow would be
    // invisible here, the field is mostly dark already), leaving a fading trail
    vec2 push = vec2(0.0);
    float glow = 0.0;
    for (int i = 0; i < 12; i++) {
        vec3 t = uTrail[i];
        if (t.z <= 0.001) continue;
        vec2 d = center - t.xy;
        float r = length(d) / uRadius;
        float f = exp(-r * r);
        push += normalize(d + 0.0001) * f * t.z;
        glow = max(glow, f * t.z); // strongest point only, so overlapping samples don't pile up
    }

    // Flow field: domain-warped simplex noise, drifting slowly
    vec2 p = center / uRes.y * 1.05 - push * 0.22;   // low frequency: a few large forms, not patches
    float t = uTime * 0.045;
    vec2 q = vec2(snoise(p + vec2(0.0, t)), snoise(p + vec2(5.2, -t * 0.8)));
    float n = snoise(p * 0.85 + 1.35 * q + vec2(t * 0.55, -t * 0.25)) * 0.5 + 0.5;

    // Mostly dark, so the shapes read: solid masses plus thin contour lines at their edges
    float blob = smoothstep(0.6, 0.84, n);
    float contour = 1.0 - smoothstep(0.0, 0.028, abs(n - 0.52));
    float b = 0.022 + 0.55 * blob + 0.5 * contour;

    // Quiet behind the headline so the words stay the hero
    vec2 inS = smoothstep(uSafe.xy - uFeather, uSafe.xy + uFeather, px) * (1.0 - smoothstep(uSafe.zw - uFeather, uSafe.zw + uFeather, px));
    b *= 1.0 - 0.62 * inS.x * inS.y;

    // under the cursor the data shows clearly, brightest where the shapes already are
    b = max(b, glow * (0.42 + 0.5 * blob));

    // Fade into the sections above and below
    float v = px.y / uRes.y;
    b *= smoothstep(0.0, 0.16, v) * smoothstep(1.0, 0.82, v);

    float idx = floor(texture2D(uChars, (cell + 0.5) / uGrid).r * 255.0 + 0.5);
    vec2 g = vec2(mod(idx, uAtlasGrid.x), floor(idx / uAtlasGrid.x));
    float glyph = texture2D(uGlyphs, (g + local) / uAtlasGrid).a;

    float a = glyph * clamp(b, 0.0, 1.0) * uMax;
    gl_FragColor = vec4(uInk * a, a);
}`;

    // White glyphs on transparent, one per cell, in CHARSET order
    function renderAtlas(fontPx, dpr, weight = 400) {
        const c = document.createElement('canvas');
        const ctx = c.getContext('2d');
        const font = `${weight} ${fontPx}px "Spline Sans Mono", ui-monospace, monospace`;
        ctx.font = font;
        const cellW = Math.ceil(ctx.measureText('M').width + 0.6 * dpr);
        const cellH = Math.round(fontPx * 1.42);
        const ac = 8, ar = Math.ceil(CHARSET.length / ac);
        c.width = ac * cellW; c.height = ar * cellH;
        ctx.font = font;
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        [...CHARSET].forEach((ch, i) => {
            ctx.fillText(ch, (i % ac) * cellW + cellW / 2, ((i / ac) | 0) * cellH + cellH / 2 + 0.5 * dpr);
        });
        return { canvas: c, cellW, cellH, ac, ar };
    }

    function compile(gl, type, src) {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn('[datafield]', gl.getShaderInfoLog(s)); return null; }
        return s;
    }

    function mount(canvas, opts = {}) {
        const reduced = !!opts.reduced;
        const getVelocity = opts.getVelocity || (() => 0);
        const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'low-power' });
        if (!gl) return null;

        const vs = compile(gl, gl.VERTEX_SHADER, VERT);
        const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
        if (!vs || !fs) return null;
        const prog = gl.createProgram();
        gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn('[datafield]', gl.getProgramInfoLog(prog)); return null; }
        gl.useProgram(prog);

        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); // one big triangle
        const aPos = gl.getAttribLocation(prog, 'aPos');
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

        const U = {};
        ['uRes', 'uCell', 'uGrid', 'uAtlasGrid', 'uTime', 'uMax', 'uInk', 'uGlyphs', 'uChars', 'uTrail', 'uRadius', 'uSafe', 'uFeather']
            .forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });
        gl.uniform1i(U.uGlyphs, 0);
        gl.uniform1i(U.uChars, 1);
        gl.uniform3fv(U.uInk, opts.ink || [243 / 255, 243 / 255, 241 / 255]);   // light on dark by default
        gl.uniform1f(U.uMax, opts.max || 0.62);
        gl.uniform4f(U.uSafe, -1, -1, -1, -1);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

        const makeTex = (unit) => {
            const tex = gl.createTexture();
            gl.activeTexture(gl.TEXTURE0 + unit);
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            return tex;
        };
        const glyphTex = makeTex(0);
        const charTex = makeTex(1);

        let cols = 0, rows = 0, cells = null, dirty = false;
        let cellW = 0, cellH = 0, dpr = 1;
        const writers = [];   // records currently typing in

        function buildAtlas() {
            const small = canvas.clientWidth < 700;
            const fontPx = (small ? 10 : 11) * dpr;
            const { canvas: c, ac, ar, ...size } = renderAtlas(fontPx, dpr);
            cellW = size.cellW; cellH = size.cellH;
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, glyphTex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
            gl.uniform2f(U.uAtlasGrid, ac, ar);
            gl.uniform2f(U.uCell, cellW, cellH);
        }

        function writeString(row, col, str) {
            for (let i = 0; i < str.length; i++) {
                const x = col + i;
                if (x < 0 || x >= cols) continue;
                cells[row * cols + x] = INDEX.get(str[i]) || 0;
            }
            dirty = true;
        }

        function fill() {
            cells = new Uint8Array(cols * rows);
            for (let r = 0; r < rows; r++) {
                const line = logLine(cols + 40);
                writeString(r, 0, line.slice((Math.random() * 30) | 0));
            }
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, charTex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, cols, rows, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, cells);
            gl.uniform2f(U.uGrid, cols, rows);
            dirty = false;
        }

        function resize() {
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
            const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
            if (w === canvas.width && h === canvas.height && cells) return;
            canvas.width = w; canvas.height = h;
            gl.viewport(0, 0, w, h);
            gl.uniform2f(U.uRes, w, h);
            gl.uniform1f(U.uRadius, (canvas.clientWidth < 700 ? 64 : 96) * dpr);
            buildAtlas();
            cols = Math.ceil(w / cellW); rows = Math.ceil(h / cellH);
            fill();
            if (!running) draw(); // keep a correct still frame
        }

        // ── New records typing in: random glyphs, then the record settles left to right ──
        const SCRAMBLE_MS = 26;
        let spawnClock = 0;
        function stepWriters(now, dt) {
            spawnClock += dt;
            while (spawnClock > 55) {
                spawnClock -= 55;
                if (writers.length < 40) {
                    const text = record() + ' · ';
                    writers.push({ row: (Math.random() * rows) | 0, col: ((Math.random() * (cols + 10)) | 0) - 5, text, t0: now });
                }
            }
            for (let w = writers.length - 1; w >= 0; w--) {
                const wr = writers[w];
                const settled = Math.floor((now - wr.t0) / SCRAMBLE_MS);
                let out = '';
                for (let i = 0; i < wr.text.length; i++) {
                    out += i < settled - 4 ? wr.text[i] : (i < settled ? CHARSET[1 + ((Math.random() * (CHARSET.length - 1)) | 0)] : '');
                }
                writeString(wr.row, wr.col, out);
                if (settled - 4 >= wr.text.length) writers.splice(w, 1);
            }
        }

        // ── Pointer wake ──
        const trail = new Float32Array(36);
        const points = [];   // { x, y, born }
        let lastX = -1e4, lastY = -1e4;
        function onPointer(e) {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left, y = e.clientY - rect.top;
            if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
            if (Math.hypot(x - lastX, y - lastY) < 14) return;
            lastX = x; lastY = y;
            points.push({ x: x * dpr, y: y * dpr, born: performance.now() });
            if (points.length > 12) points.shift();
        }
        function stepTrail(now) {
            for (let i = 0; i < 12; i++) {
                const p = points[i];
                const life = p ? Math.max(0, 1 - (now - p.born) / 1100) : 0;
                trail[i * 3] = p ? p.x : 0;
                trail[i * 3 + 1] = p ? p.y : 0;
                trail[i * 3 + 2] = life * life * (3 - 2 * life); // ease out
            }
            gl.uniform3fv(U.uTrail, trail);
        }

        // The quiet zone follows the element passed as opts.quiet (the headline)
        function stepSafe() {
            if (!opts.quiet) return;
            const c = canvas.getBoundingClientRect(), r = opts.quiet.getBoundingClientRect();
            gl.uniform4f(U.uSafe, (r.left - c.left) * dpr, (r.top - c.top) * dpr, (r.right - c.left) * dpr, (r.bottom - c.top) * dpr);
            gl.uniform1f(U.uFeather, 90 * dpr);
        }

        let time = Math.random() * 100, running = false, raf = 0, last = 0, visible = false;
        function draw() {
            if (dirty) {
                gl.activeTexture(gl.TEXTURE1);
                gl.bindTexture(gl.TEXTURE_2D, charTex);
                gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, cols, rows, gl.LUMINANCE, gl.UNSIGNED_BYTE, cells);
                dirty = false;
            }
            gl.uniform1f(U.uTime, time);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
        }
        function frame(now) {
            raf = requestAnimationFrame(frame);
            const dt = Math.min(64, last ? now - last : 16);
            last = now;
            // scrolling stirs the flow a little
            time += (dt / 1000) * (1 + Math.min(6, Math.abs(getVelocity()) * 0.12));
            stepWriters(now, dt);
            stepTrail(now);
            stepSafe();
            draw();
        }
        function start() {
            if (running || reduced || !visible || document.hidden) return;
            running = true; last = 0;
            raf = requestAnimationFrame(frame);
        }
        function stop() { running = false; cancelAnimationFrame(raf); }

        resize();
        stepTrail(0);
        stepSafe();
        draw();

        const ro = new ResizeObserver(() => resize());
        ro.observe(canvas);
        const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; visible ? start() : stop(); }, { rootMargin: '120px 0px' });
        io.observe(canvas);
        document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
        if (!reduced) addEventListener('pointermove', onPointer, { passive: true });
        canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); stop(); });

        canvas.classList.add('is-ready');
        const controller = { start, stop, resize, points };
        canvas._dataField = controller;
        return controller;
    }

    // ── Portrait: a photo that decodes into records and streams down the page ──
    // Progress 0 -> 1 (driven by scroll):
    //   0.00-0.20  decode (while the portrait is still fully in view): photo -> flat tone block -> record glyph
    //   0.19-1.00  stream: each column of glyphs falls at its own speed and fades
    // The canvas sits over the photo's box and extends below it, so the data can fall out of the frame.
    // It draws the photo itself at the start, so the <img> can be swapped for it without a visible change.
    const PORTRAIT_FRAG = `
precision highp float;
uniform vec2 uRes;        // canvas, device px
uniform vec2 uPhoto;      // photo box (top of the canvas), device px
uniform vec2 uCell;
uniform vec2 uGrid;
uniform vec2 uAtlasGrid;
uniform float uP;
uniform vec3 uInk;
uniform sampler2D uGlyphs;
uniform sampler2D uChars;
uniform sampler2D uImage;
uniform float uSplit;     // where the grey plate starts behind the photo (device px from the top)
uniform vec3 uPaperTop;   // page colour above it
uniform vec3 uPaperBottom;// plate colour below it

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
    vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
    float col = floor(px.x / uCell.x);

    // Stream: the whole column slides down, so each pixel reads from higher up its column
    float fall = clamp((uP - 0.19) / 0.81, 0.0, 1.0);
    float speed = 0.55 + 0.9 * hash(vec2(col, 7.0));
    float drop = pow(fall, 1.7) * speed * uRes.y * 0.62;
    vec2 src = px - vec2(0.0, drop);

    // Paper behind the decoded portrait, matching what it covers, so the headline behind the photo stays
    // hidden until the data falls away and uncovers it
    bool inBox = px.y < uPhoto.y && px.x < uPhoto.x;
    float paperA = inBox ? 1.0 - smoothstep(0.0, 0.3, fall) : 0.0;
    vec3 paper = px.y < uSplit ? uPaperTop : uPaperBottom;

    if (src.y < 0.0 || src.y >= uPhoto.y || src.x >= uPhoto.x) { gl_FragColor = vec4(paper * paperA, paperA); return; }

    vec2 cell = floor(src / uCell);
    vec2 local = fract(src / uCell);
    vec2 centerUv = ((cell + 0.5) * uCell) / uPhoto;

    // Decode order: noisy, sweeping up from the bottom of the portrait
    float order = 0.62 * hash(cell) + 0.38 * (1.0 - cell.y / uGrid.y);
    float phase = clamp((uP / 0.2 - order * 0.78) / 0.22, 0.0, 1.0);

    vec4 photo = texture2D(uImage, src / uPhoto);
    if (phase < 0.34) { gl_FragColor = photo; return; }

    vec3 tone = texture2D(uImage, clamp(centerUv, 0.0, 1.0)).rgb;
    if (phase < 0.67) { gl_FragColor = vec4(tone, 1.0); return; }   // flat tone block, a beat before the glyph

    // A halftone made of text: each glyph's strokes take their darkness from the photo pixel by pixel
    // (not one value per cell), so the face's detail survives inside the letterforms. The tone remap
    // drops the grey backdrop and the light hoodie almost to nothing, so the face and hair carry the ink.
    float lum = dot(photo.rgb, vec3(0.299, 0.587, 0.114));
    float ink = smoothstep(0.38, 0.8, 1.0 - lum) * 0.96 + 0.035;
    float idx = floor(texture2D(uChars, (cell + 0.5) / uGrid).r * 255.0 + 0.5);
    vec2 g = vec2(mod(idx, uAtlasGrid.x), floor(idx / uAtlasGrid.x));
    float glyph = texture2D(uGlyphs, (g + local) / uAtlasGrid).a;

    // a faint ghost of the photo under the text keeps the face readable at a glance; it leaves first
    float ghost = ink * 0.2 * (1.0 - smoothstep(0.0, 0.25, fall));
    // fade as it falls, faster columns first
    float a = max(glyph * ink, ghost) * (1.0 - smoothstep(0.35, 1.0, fall * (0.7 + 0.5 * speed)));
    gl_FragColor = vec4(uInk * a + paper * paperA * (1.0 - a), a + paperA * (1.0 - a));
}`;

    function portrait(canvas, img, opts = {}) {
        const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
        if (!gl || !img) return null;
        const vs = compile(gl, gl.VERTEX_SHADER, VERT);
        const fs = compile(gl, gl.FRAGMENT_SHADER, PORTRAIT_FRAG);
        if (!vs || !fs) return null;
        const prog = gl.createProgram();
        gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn('[datafield]', gl.getProgramInfoLog(prog)); return null; }
        gl.useProgram(prog);
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        const aPos = gl.getAttribLocation(prog, 'aPos');
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
        const U = {};
        ['uRes', 'uPhoto', 'uCell', 'uGrid', 'uAtlasGrid', 'uP', 'uInk', 'uGlyphs', 'uChars', 'uImage', 'uSplit', 'uPaperTop', 'uPaperBottom']
            .forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });
        gl.uniform1i(U.uGlyphs, 0); gl.uniform1i(U.uChars, 1); gl.uniform1i(U.uImage, 2);
        gl.uniform3f(U.uInk, 17 / 255, 17 / 255, 17 / 255);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        const tex = (unit, filter) => {
            const t = gl.createTexture();
            gl.activeTexture(gl.TEXTURE0 + unit);
            gl.bindTexture(gl.TEXTURE_2D, t);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            return t;
        };
        const glyphTex = tex(0, gl.NEAREST), charTex = tex(1, gl.NEAREST), imageTex = tex(2, gl.LINEAR);

        const box = opts.box || img.parentElement;   // the element whose size the photo fills
        const rgb = (el, fallback) => {
            const m = el && getComputedStyle(el).backgroundColor.match(/[\d.]+/g);
            return m && m.length >= 3 && (m[3] === undefined || +m[3] > 0) ? m.slice(0, 3).map((v) => v / 255) : fallback;
        };
        let dprNow = 1;
        let progress = 0, queued = false, ready = false;

        function resize() {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            dprNow = dpr;
            gl.uniform3fv(U.uPaperTop, rgb(document.body, [0.965, 0.965, 0.957]));
            gl.uniform3fv(U.uPaperBottom, rgb(opts.plate, [0.925, 0.925, 0.918]));
            const bw = box.clientWidth, bh = box.clientHeight;
            if (!bw || !bh || !img.naturalWidth) return;
            const w = Math.round(bw * dpr), photoH = Math.round(bh * dpr);
            const h = Math.round(canvas.clientHeight * dpr);
            canvas.width = w; canvas.height = h;
            gl.viewport(0, 0, w, h);
            gl.uniform2f(U.uRes, w, h);
            gl.uniform2f(U.uPhoto, w, photoH);

            // The photo exactly as the page shows it: object-fit: cover, centred, grayscale + contrast,
            // scaled by the browser (good filtering) to device pixels so the shader samples it 1:1
            const pc = document.createElement('canvas');
            pc.width = w; pc.height = photoH;
            const ctx = pc.getContext('2d');
            ctx.filter = getComputedStyle(img).filter || 'none';
            const s = Math.max(w / img.naturalWidth, photoH / img.naturalHeight);
            const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
            ctx.drawImage(img, (w - dw) / 2, (photoH - dh) / 2, dw, dh);
            gl.activeTexture(gl.TEXTURE2);
            gl.bindTexture(gl.TEXTURE_2D, imageTex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, pc);

            const atlas = renderAtlas((bw < 300 ? 7 : 8) * dpr, dpr, 500);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, glyphTex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.canvas);
            gl.uniform2f(U.uAtlasGrid, atlas.ac, atlas.ar);
            gl.uniform2f(U.uCell, atlas.cellW, atlas.cellH);

            const cols = Math.ceil(w / atlas.cellW), rows = Math.ceil(photoH / atlas.cellH);
            const cells = new Uint8Array(cols * rows);
            for (let r = 0; r < rows; r++) {
                // dense: records run together without spaces, so the letterforms cover more of the photo
                const line = logLine(cols + 30).replace(/ /g, '').slice((Math.random() * 20) | 0);
                for (let c = 0; c < cols; c++) cells[r * cols + c] = INDEX.get(line[c]) || 0;
            }
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, charTex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, cols, rows, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, cells);
            gl.uniform2f(U.uGrid, cols, rows);
            ready = true;
            render();
        }

        function render() {
            queued = false;
            if (!ready) return;
            gl.uniform1f(U.uP, progress);
            // the plate drifts at a different speed from the photo, so measure where it is right now
            const split = opts.plate ? (opts.plate.getBoundingClientRect().top - canvas.getBoundingClientRect().top) * dprNow : -1;
            gl.uniform1f(U.uSplit, split);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
        }

        // Only draws when the progress changes: nothing runs while the page is still
        function setProgress(p) {
            p = Math.min(1, Math.max(0, p));
            if (p === progress && ready) return;
            progress = p;
            if (!queued) { queued = true; requestAnimationFrame(render); }
        }

        // the 500 weight is only used here, so the browser won't have fetched it: ask for it first
        const fontReady = document.fonts ? document.fonts.load('500 8px "Spline Sans Mono"').catch(() => {}) : Promise.resolve();
        const imgReady = img.complete && img.naturalWidth ? Promise.resolve() : new Promise((r) => img.addEventListener('load', r, { once: true }));
        Promise.all([fontReady, imgReady]).then(resize);
        let rt = 0;
        addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 150); });
        canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); ready = false; });
        return { setProgress, resize, isReady: () => ready };
    }

    // ── Screen: the works projector transmits each project as data ──
    // Progress 0 -> 1 (time-driven, ~1.4s): every cell runs its own timeline, offset by a noisy sweep
    // down from the projector: picture A dissolves into a halftone of itself drawn in records, the
    // records churn and re-form as picture B's halftone, and B develops out of it. At 0 and 1 it draws A and B exactly, so the canvas
    // can be laid over the real slides and removed without a visible change.
    // With no A (the first time the room comes into view), A is the projector on standby: faint static.
    const SCREEN_FRAG = `
precision highp float;
uniform vec2 uRes;
uniform vec2 uCell;
uniform vec2 uGrid;
uniform vec2 uAtlasGrid;
uniform float uP;
uniform float uTime;
uniform float uStandby;   // 1: there is no picture A, the screen starts dark with faint data
uniform vec3 uPaper;      // the screen's paper colour
uniform sampler2D uGlyphs;
uniform sampler2D uChars;
uniform sampler2D uFrom;
uniform sampler2D uTo;

const float GLYPHS = ${CHARSET.length}.0;
const vec3 DARK = vec3(0.043);

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float glyphAt(vec2 cell, vec2 local, float idx) {
    vec2 g = vec2(mod(idx, uAtlasGrid.x), floor(idx / uAtlasGrid.x));
    return texture2D(uGlyphs, (g + local) / uAtlasGrid).a;
}

vec3 halftone(vec3 src, float glyph) {
    // whatever stands out from the paper inks hard; the paper itself still carries faint records.
    // Ink pushes away from the paper: darker on light paper, brighter on dark
    float ink = 0.16 + 0.84 * smoothstep(0.03, 0.3, length(src - uPaper));
    vec3 ghost = mix(uPaper, src, 0.3);
    vec3 inkCol = dot(uPaper, vec3(0.299, 0.587, 0.114)) > 0.5 ? src * 0.3 : mix(src, vec3(1.0), 0.45);
    return mix(ghost, inkCol, glyph * ink);
}

void main() {
    vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
    vec2 uv = px / uRes;
    vec2 cell = floor(px / uCell);
    vec2 local = fract(px / uCell);
    float h = hash(cell);
    float idx = floor(texture2D(uChars, (cell + 0.5) / uGrid).r * 255.0 + 0.5);

    // this cell's own timeline: the beam sweeps down from the projector, broken up by noise
    float order = 0.55 * h + 0.45 * (cell.y / uGrid.y);
    float t = clamp(uP * 1.6 - order * 0.6, 0.0, 1.0);

    vec4 A = texture2D(uFrom, uv);
    vec4 B = texture2D(uTo, uv);
    if (uStandby > 0.5) A = vec4(DARK + 0.11 * glyphAt(cell, local, idx), 1.0);
    if (t <= 0.0) { gl_FragColor = A; return; }
    if (t >= 1.0) { gl_FragColor = B; return; }

    // records churn hardest mid-flight
    float calm = abs(t - 0.5) * 2.0;
    float tick = floor(uTime * 14.0 + h * 9.0);
    if (hash(cell + tick) > calm * 0.9 + 0.1) idx = 1.0 + floor(hash(cell * 1.7 + tick) * (GLYPHS - 1.0));
    float glyph = glyphAt(cell, local, idx);

    // Each picture as a halftone of itself made of records (the hero portrait's language): the paper
    // stays, a ghost of the picture stays faintly, and whatever stands out from the paper becomes ink
    vec3 hb = halftone(B.rgb, glyph);
    vec3 ha = uStandby > 0.5 ? DARK + 0.11 * glyph : halftone(A.rgb, glyph);
    float k = smoothstep(0.3, 0.7, t + (hash(cell + 3.1) - 0.5) * 0.3);
    vec3 signal = mix(ha, hb, k);

    // cells flip crisply into and out of the signal (no muddy cross-fades), each at its own moment
    vec3 col = t < 0.5 ? mix(A.rgb, signal, smoothstep(0.0, 0.1, t)) : mix(signal, B.rgb, smoothstep(0.86, 1.0, t));
    // the projector's light sweeping down the screen
    float beam = uv.y - (uP * 1.4 - 0.2);
    col += 0.09 * exp(-beam * beam / 0.006) * sin(3.14159 * uP);
    gl_FragColor = vec4(min(col, 1.0), 1.0);
}`;

    // Paints a slide into a 2D canvas exactly as the page shows it: an image (object-fit: cover, top),
    // or a typographic card, drawn glyph by glyph at the positions the browser laid them out
    const CLEAR = 'rgba(0, 0, 0, 0)';
    function paintSlide(ctx, slide, w, h) {
        const ref = slide.getBoundingClientRect();
        const scale = w / ref.width;
        const own = getComputedStyle(slide).backgroundColor;
        ctx.fillStyle = own !== CLEAR ? own : getComputedStyle(slide.parentElement).backgroundColor;
        ctx.fillRect(0, 0, w, h);
        const img = slide.querySelector('img');
        if (img) {
            if (!img.naturalWidth) return;
            // where the browser actually put it (it may be taller than the frame and shifted by parallax),
            // object-fit: cover, anchored to the top
            const r = img.getBoundingClientRect();
            const bx = (r.left - ref.left) * scale, by = (r.top - ref.top) * scale, bw = r.width * scale, bh = r.height * scale;
            const s = Math.max(bw / img.naturalWidth, bh / img.naturalHeight);
            ctx.save();
            ctx.beginPath(); ctx.rect(bx, by, bw, bh); ctx.clip();
            ctx.drawImage(img, bx + (bw - img.naturalWidth * s) / 2, by, img.naturalWidth * s, img.naturalHeight * s);
            ctx.restore();
            return;
        }
        slide.querySelectorAll('*').forEach((el) => {
            const cs = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            if (el.tagName === 'CANVAS') return;
            if (cs.backgroundColor !== CLEAR) {
                ctx.fillStyle = cs.backgroundColor;
                ctx.fillRect((r.left - ref.left) * scale, (r.top - ref.top) * scale, r.width * scale, r.height * scale);
            }
            const upper = cs.textTransform === 'uppercase';
            ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${parseFloat(cs.fontSize) * scale}px ${cs.fontFamily}`;
            // outlined type (-webkit-text-stroke with a transparent fill) is stroked, not filled
            const stroke = parseFloat(cs.webkitTextStrokeWidth) || 0;
            const outline = stroke > 0 && cs.color === CLEAR;
            ctx.fillStyle = cs.color;
            ctx.strokeStyle = cs.webkitTextStrokeColor; ctx.lineWidth = stroke * scale;
            ctx.textBaseline = 'alphabetic';
            const m = ctx.measureText('Hg');
            const asc = m.fontBoundingBoxAscent || m.actualBoundingBoxAscent, desc = m.fontBoundingBoxDescent || m.actualBoundingBoxDescent;
            const range = document.createRange();
            el.childNodes.forEach((node) => {
                if (node.nodeType !== 3) return;
                for (let i = 0; i < node.length; i++) {
                    const ch = node.data[i];
                    if (!ch.trim()) continue;
                    range.setStart(node, i); range.setEnd(node, i + 1);
                    const cr = range.getBoundingClientRect();
                    if (!cr.width) continue;
                    // CSS centres the font's content box in the line box, so the baseline sits here
                    const top = (cr.top - ref.top) * scale + (cr.height * scale - (asc + desc)) / 2;
                    const x = (cr.left - ref.left) * scale, c = upper ? ch.toUpperCase() : ch;
                    if (outline) ctx.strokeText(c, x, top + asc); else ctx.fillText(c, x, top + asc);
                }
            });
        });
    }

    // opts.paper: the surface's paper colour as [r, g, b] 0-1 (default: the page's light paper)
    function screen(canvas, surface, opts = {}) {
        const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
        if (!gl) return null;
        const vs = compile(gl, gl.VERTEX_SHADER, VERT);
        const fs = compile(gl, gl.FRAGMENT_SHADER, SCREEN_FRAG);
        if (!vs || !fs) return null;
        const prog = gl.createProgram();
        gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn('[datafield]', gl.getProgramInfoLog(prog)); return null; }
        gl.useProgram(prog);
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        const aPos = gl.getAttribLocation(prog, 'aPos');
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
        const U = {};
        ['uRes', 'uCell', 'uGrid', 'uAtlasGrid', 'uP', 'uTime', 'uStandby', 'uPaper', 'uGlyphs', 'uChars', 'uFrom', 'uTo']
            .forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });
        gl.uniform1i(U.uGlyphs, 0); gl.uniform1i(U.uChars, 1); gl.uniform1i(U.uFrom, 2); gl.uniform1i(U.uTo, 3);
        gl.uniform3fv(U.uPaper, opts.paper || [246 / 255, 246 / 255, 244 / 255]);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        const tex = (unit, filter) => {
            const t = gl.createTexture();
            gl.activeTexture(gl.TEXTURE0 + unit);
            gl.bindTexture(gl.TEXTURE_2D, t);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            return t;
        };
        const glyphTex = tex(0, gl.NEAREST), charTex = tex(1, gl.NEAREST);
        const fromTex = tex(2, gl.LINEAR), toTex = tex(3, gl.LINEAR);

        let w = 0, h = 0, sized = false;
        const shots = new Map();   // slide -> its painted canvas, at the current size
        function size() {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const nw = Math.round(surface.clientWidth * dpr), nh = Math.round(surface.clientHeight * dpr);
            if (!nw || !nh) return false;
            if (nw === w && nh === h && sized) return true;
            w = nw; h = nh; shots.clear();
            canvas.width = w; canvas.height = h;
            gl.viewport(0, 0, w, h);
            gl.uniform2f(U.uRes, w, h);
            const atlas = renderAtlas((surface.clientWidth < 360 ? 6 : 8) * dpr, dpr, 500);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, glyphTex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.canvas);
            gl.uniform2f(U.uAtlasGrid, atlas.ac, atlas.ar);
            gl.uniform2f(U.uCell, atlas.cellW, atlas.cellH);
            const cols = Math.ceil(w / atlas.cellW), rows = Math.ceil(h / atlas.cellH);
            const cells = new Uint8Array(cols * rows);
            for (let r = 0; r < rows; r++) {
                const line = logLine(cols + 30).slice((Math.random() * 20) | 0);
                for (let c = 0; c < cols; c++) cells[r * cols + c] = INDEX.get(line[c]) || 0;
            }
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, charTex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, cols, rows, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, cells);
            gl.uniform2f(U.uGrid, cols, rows);
            sized = true;
            return true;
        }
        function shot(slide) {
            if (!shots.has(slide)) {
                const c = document.createElement('canvas');
                c.width = w; c.height = h;
                paintSlide(c.getContext('2d'), slide, w, h);
                shots.set(slide, c);
            }
            return shots.get(slide);
        }
        function upload(unit, t, source) {
            gl.activeTexture(gl.TEXTURE0 + unit);
            gl.bindTexture(gl.TEXTURE_2D, t);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        }
        function draw(p, time) {
            gl.uniform1f(U.uP, p);
            gl.uniform1f(U.uTime, time);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
        }

        // Images inside the slides load lazily: make sure the ones we paint are ready
        const ready = (slide) => {
            const img = slide && slide.querySelector('img');
            if (!img) return Promise.resolve();
            img.loading = 'eager';
            return (img.decode ? img.decode() : Promise.resolve()).catch(() => {});
        };
        const fonts = document.fonts ? document.fonts.load('500 8px "Spline Sans Mono"').catch(() => {}) : Promise.resolve();

        let raf = 0, p = 0, from = null, to = null, t0 = 0, dur = 1400, done = null;
        const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
        function frame(now) {
            if (!t0) t0 = now;
            p = Math.min(1, (now - t0) / dur);
            draw(ease(p), now / 1000);
            if (p < 1) { raf = requestAnimationFrame(frame); return; }
            raf = 0;
            canvas.classList.remove('is-on');   // the real slide underneath is identical now
            if (done) done();
        }

        // Show the projector on standby (dark, faint data) until the first transmission
        function standby() {
            return fonts.then(() => {
                if (to || !size()) return;   // a transmission already started
                gl.uniform1f(U.uStandby, 1);
                draw(0, 0);
                canvas.classList.add('is-on');
            });
        }

        // Transmit from one slide to another (from = null: out of standby). A new call mid-flight picks up
        // from the picture that is landing, so rapid clicks never jump.
        function play(fromSlide, toSlide) {
            return Promise.all([fonts, ready(fromSlide), ready(toSlide)]).then(() => new Promise((resolve) => {
                if (!size()) { resolve(); return; }
                const midFlight = raf && to;
                cancelAnimationFrame(raf); raf = 0;
                if (done) done();
                if (midFlight) fromSlide = to;
                from = fromSlide; to = toSlide;
                gl.uniform1f(U.uStandby, from ? 0 : 1);
                if (from) upload(2, fromTex, shot(from));
                upload(3, toTex, shot(to));
                draw(0, performance.now() / 1000);
                canvas.classList.add('is-on');
                dur = +surface.dataset.signalMs || 1400;   // data-signal-ms slows it down for inspection
                t0 = 0; done = () => { done = null; resolve(); };
                raf = requestAnimationFrame(frame);
            }));
        }

        let rt = 0;
        addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { sized = false; }, 150); });
        canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); cancelAnimationFrame(raf); canvas.classList.remove('is-on'); });
        return { play, standby };
    }

    // ── Edge: the loader sheet's ragged data edge ──
    // Columns of records hanging off the sheet: solid next to it, thinning to loose glyphs at the tips,
    // so the sheet sweeping over the page reads as a slab of data. Drawn once (2D canvas); it rides the
    // sheet's own transform, so it costs nothing per frame. side: 'top' (grows upward) or 'bottom'.
    function edge(canvas, opts = {}) {
        const side = opts.side || 'bottom';
        const paper = opts.paper || 'rgba(246, 246, 244, 0.995)';
        const ink = opts.ink || '17, 17, 17';
        function draw() {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
            if (!w || !h) return;
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            const fontPx = (canvas.clientWidth < 700 ? 9 : 10) * dpr;
            ctx.font = `500 ${fontPx}px "Spline Sans Mono", ui-monospace, monospace`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            const cw = Math.ceil(ctx.measureText('M').width + 0.6 * dpr), ch = Math.round(fontPx * 1.42);
            const cols = Math.ceil(w / cw), rows = Math.floor(h / ch);
            for (let c = 0; c < cols; c++) {
                // mostly short drips, a few long ones; neighbours loosely related so it reads as a front
                const len = Math.max(1, Math.round(rows * Math.pow(Math.random(), 2.2)));
                const solid = Math.round(len * (0.45 + Math.random() * 0.3));
                const text = logLine(len + 4).replace(/ /g, '');
                for (let i = 0; i < len; i++) {
                    const y = side === 'top' ? h - (i + 1) * ch : i * ch;
                    if (i < solid) { ctx.fillStyle = paper; ctx.fillRect(c * cw, y, cw, ch); }
                    const a = (i < solid ? 0.5 : 0.75) * (1 - i / len) + 0.08;
                    ctx.fillStyle = `rgba(${ink}, ${a.toFixed(3)})`;
                    ctx.fillText(text[i], c * cw + cw / 2, y + ch / 2 + 0.5 * dpr);
                }
            }
        }
        const fonts = document.fonts ? document.fonts.load('500 10px "Spline Sans Mono"').catch(() => {}) : Promise.resolve();
        fonts.then(draw);
        let rt = 0;
        addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(draw, 200); });
    }

    // ── Scramble: text types in like a record, random glyphs settling left to right ──
    function scramble(el, text, opts = {}) {
        const dur = opts.duration || 700;
        const pool = CHARSET.slice(1);
        if (el._scramble) cancelAnimationFrame(el._scramble);
        let t0 = 0;
        const step = (now) => {
            if (!t0) t0 = now;
            const k = Math.min(1, (now - t0) / dur);
            const settled = Math.floor(k * (text.length + 3)) - 3;
            let out = '';
            for (let i = 0; i < text.length; i++) {
                const ch = text[i];
                out += i < settled || ch === ' ' ? ch : (i < settled + 4 ? pool[(Math.random() * pool.length) | 0] : '');
            }
            el.textContent = out;
            el._scramble = k < 1 ? requestAnimationFrame(step) : 0;
            if (k >= 1) el.textContent = text;
        };
        el._scramble = requestAnimationFrame(step);
    }

    window.DataField = { mount, portrait, screen, scramble, edge };
})();
