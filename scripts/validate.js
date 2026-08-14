// Build-time content validation for the portfolio data layer.
// Enforces the schema documented in docs/CONTENT_MODEL.md and fails the
// build loudly when references or schemas drift.
// Run via `npm run validate` (also runs automatically before `npm run build`).

const fs = require('fs');
const path = require('path');

const load = (rel) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8'));

const capabilities = load('src/_data/capabilities.json');
const projects = load('src/_data/projects.json');
const experience = load('src/_data/experience.json');

const errors = [];
const error = (msg) => { errors.push(msg); console.error('ERROR ' + msg); };

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}$/;
const URL_RE = /^(https?:\/\/|mailto:|tel:|\/)/;
const LINK_KEYS = ['website', 'github', 'demo'];
const PROJECT_TYPES = ['product', 'client-project', 'internal', 'open-source'];
const PROJECT_STATUSES = ['active', 'shipped'];

const isString = (v) => typeof v === 'string';
const isNonEmptyString = (v) => isString(v) && v !== '';
const isArray = (v) => Array.isArray(v);
const isBoolean = (v) => typeof v === 'boolean';
const isNullOr = (v, check) => v === null || check(v);

function checkUnique(items, entity, field) {
    const seen = new Set();
    items.forEach((item) => {
        const value = item[field];
        if (!isNonEmptyString(value)) {
            error(`${entity} missing ${field}: ${JSON.stringify(item)}`);
        } else if (seen.has(value)) {
            error(`duplicate ${entity} ${field}: "${value}"`);
        } else if (!SLUG_RE.test(value)) {
            error(`${entity} "${value}" has an invalid ${field} (must be kebab-case)`);
        }
        seen.add(value);
    });
}

function checkStringField(item, ref, field) {
    if (!isNonEmptyString(item[field])) error(`${ref} missing string field "${field}"`);
}

function checkArrayField(item, ref, field) {
    if (!isArray(item[field])) error(`${ref} field "${field}" must be an array`);
}

// ─────────────────────────── Capabilities ───────────────────────────
// Canonical identifier is `slug`. No separate `id` may drift.
checkUnique(capabilities, 'capability', 'slug');
capabilities.forEach((c) => {
    const ref = `capability "${c.slug}"`;
    checkStringField(c, ref, 'title');
    checkStringField(c, ref, 'tagline');
    checkArrayField(c, ref, 'description');
    checkArrayField(c, ref, 'competencies');
    checkArrayField(c, ref, 'technologies');
    if (!isBoolean(c.published)) error(`${ref} "published" must be a boolean`);
    if (c.published) {
        if (!isNonEmptyString(c.summary)) error(`${ref} is published but missing "summary"`);
        if (!c.description.length) error(`${ref} is published but has an empty "description"`);
        if (!c.competencies.length) error(`${ref} is published but has an empty "competencies"`);
    } else if (c.summary !== undefined && !isString(c.summary)) {
        error(`${ref} "summary" must be a string`);
    }
});

// ─────────────────────────── Projects ───────────────────────────
checkUnique(projects, 'project', 'id');
projects.forEach((p) => {
    const ref = `project "${p.id}"`;
    checkStringField(p, ref, 'slug');
    checkStringField(p, ref, 'title');
    checkStringField(p, ref, 'type');
    checkStringField(p, ref, 'status');
    if (p.slug !== p.id) error(`${ref} slug ("${p.slug}") does not match its id`);
    if (!PROJECT_TYPES.includes(p.type)) {
        error(`${ref} type "${p.type}" is not in the controlled vocabulary: ${PROJECT_TYPES.join(', ')}`);
    }
    if (!PROJECT_STATUSES.includes(p.status)) {
        error(`${ref} status "${p.status}" is not in the controlled vocabulary: ${PROJECT_STATUSES.join(', ')}`);
    }
    if (!isNullOr(p.shortDescription, isString)) {
        error(`${ref} "shortDescription" must be a string or null`);
    }
    checkArrayField(p, ref, 'role');
    checkArrayField(p, ref, 'technologies');
    checkArrayField(p, ref, 'capabilities');
    if (!isBoolean(p.featured)) error(`${ref} "featured" must be a boolean`);
    if (!p.links || typeof p.links !== 'object' || isArray(p.links)) {
        error(`${ref} "links" must be an object`);
    }
    Object.entries(p.links || {}).forEach(([key, href]) => {
        if (!LINK_KEYS.includes(key)) {
            error(`${ref} "links" has unsupported key "${key}" (expected one of ${LINK_KEYS.join(', ')})`);
        }
        if (!isString(href) || !URL_RE.test(href)) {
            error(`${ref} "links.${key}" is not a well-formed URL: ${JSON.stringify(href)}`);
        }
    });
    if (!isNullOr(p.caseStudy, isString)) {
        error(`${ref} "caseStudy" must be a string or null`);
    }
});

// ─────────────────────────── Experience ───────────────────────────
checkUnique(experience, 'experience', 'id');
experience.forEach((e) => {
    const ref = `experience "${e.id}"`;
    checkStringField(e, ref, 'company');
    checkStringField(e, ref, 'role');
    checkStringField(e, ref, 'summary');
    if (!isNonEmptyString(e.startDate) || !DATE_RE.test(e.startDate)) {
        error(`${ref} "startDate" must be a YYYY-MM date string`);
    }
    if (!isNullOr(e.endDate, (v) => DATE_RE.test(v))) {
        error(`${ref} "endDate" must be a YYYY-MM date string or null`);
    }
    if (!isBoolean(e.current)) error(`${ref} "current" must be a boolean`);
    checkArrayField(e, ref, 'responsibilities');
    checkArrayField(e, ref, 'achievements');
    checkArrayField(e, ref, 'technologies');
    checkArrayField(e, ref, 'systems');
    checkArrayField(e, ref, 'capabilities');
    checkArrayField(e, ref, 'projects');
});

// ─────────────────────────── Relationships ───────────────────────────
const capabilitySlugs = new Set(capabilities.map((c) => c.slug));
const projectIds = new Set(projects.map((p) => p.id));

projects.forEach((p) => {
    p.capabilities.forEach((cap) => {
        if (!capabilitySlugs.has(cap)) error(`project "${p.id}" references unknown capability "${cap}"`);
    });
});

experience.forEach((e) => {
    e.capabilities.forEach((cap) => {
        if (!capabilitySlugs.has(cap)) error(`experience "${e.id}" references unknown capability "${cap}"`);
    });
    e.projects.forEach((pid) => {
        if (!projectIds.has(pid)) error(`experience "${e.id}" references unknown project "${pid}"`);
    });
});

// ─────────────────────────── Report ───────────────────────────
if (errors.length) {
    console.error(`\nValidation failed with ${errors.length} error(s).`);
    process.exit(1);
}

console.log(
    `Validation OK — ${capabilities.length} capabilities, ` +
    `${projects.length} projects, ${experience.length} experiences.`
);
