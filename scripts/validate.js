// Build-time content validation for the portfolio data layer.
// Fails the build loudly when references or schemas drift.
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
const HREF_RE = /^(https?:\/\/|mailto:|tel:|\/)/;

const checkDuplicates = (items, entity, field) => {
    const seen = new Set();
    items.forEach((item) => {
        const value = item[field];
        if (value === undefined || value === null || value === '') {
            error(`${entity} is missing a ${field}: ${JSON.stringify(item)}`);
        } else if (seen.has(value)) {
            error(`duplicate ${entity} ${field}: "${value}"`);
        }
        seen.add(value);
    });
};

const checkSlug = (items, entity) => {
    items.forEach((item) => {
        if (!SLUG_RE.test(item.id || '')) error(`${entity} "${item.id}" has a non-kebab-case id`);
        if (item.slug !== undefined && item.slug !== item.id) {
            error(`${entity} "${item.id}" has a slug ("${item.slug}") that does not match its id`);
        }
    });
};

const checkCapabilityRefs = (item, entity) => {
    (item.capabilities || []).forEach((cap) => {
        if (!capabilityIds.has(cap)) {
            error(`${entity} "${item.id}" references unknown capability "${cap}"`);
        }
    });
};

const capabilityIds = new Set(capabilities.map((c) => c.id));

checkDuplicates(capabilities, 'capability', 'id');
checkDuplicates(capabilities, 'capability', 'slug');
checkDuplicates(projects, 'project', 'id');
checkDuplicates(projects, 'project', 'slug');
checkDuplicates(experience, 'experience', 'id');

checkSlug(capabilities, 'capability');
checkSlug(projects, 'project');
checkSlug(experience, 'experience');

projects.forEach((p) => checkCapabilityRefs(p, 'project'));
experience.forEach((e) => checkCapabilityRefs(e, 'experience'));

// Experience → Project references
const projectIds = new Set(projects.map((p) => p.id));
experience.forEach((e) => {
    (e.projects || []).forEach((pid) => {
        if (!projectIds.has(pid)) error(`experience "${e.id}" references unknown project "${pid}"`);
    });
});

// Project links must be well-formed
projects.forEach((p) => {
    Object.entries(p.links || {}).forEach(([key, link]) => {
        if (!link || !link.href) {
            error(`project "${p.id}" has a malformed "${key}" link`);
        } else if (!HREF_RE.test(link.href)) {
            error(`project "${p.id}" link "${key}" has a malformed URL: "${link.href}"`);
        }
    });
});

// Published capabilities must not share a slug with an unpublished one
const publishedSlugs = new Set(capabilities.filter((c) => c.published).map((c) => c.slug));
if (publishedSlugs.size < capabilities.filter((c) => c.published).length) {
    error('duplicate slug among published capabilities');
}

if (errors.length) {
    console.error(`\nValidation failed with ${errors.length} error(s).`);
    process.exit(1);
}

console.log(
    `Validation OK — ${capabilities.length} capabilities, ` +
    `${projects.length} projects, ${experience.length} experiences.`
);
