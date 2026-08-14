# Content Model

This document defines the canonical data model for the portfolio. It exists
so future development (Phase 2+) extends the architecture instead of drifting
away from it. The schema below is enforced by `scripts/validate.js` at build
time — if a field here is required, the validator checks it.

All content lives as JSON in `src/_data/`. JSON + Eleventy data is
intentionally the whole stack for Phase 1 — no database, no CMS.

## Entities (Phase 1)

### Project — `src/_data/projects.json`

One record per shipped piece of work. Cards and summary views only; long-form
case-study content belongs to a future `CaseStudy`, never here.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable, unique, kebab-case. Must equal `slug`. |
| `slug` | string | Must equal `id`. Reserved future route: `/work/{slug}`. |
| `title` | string | Display title. |
| `shortDescription` | string \| null | One-line summary. `null` when no real copy exists — never invented. |
| `type` | string | Controlled vocabulary: `product`, `client-project`, `internal`, `open-source`. |
| `status` | string | Controlled vocabulary: `active` (live and maintained), `shipped` (completed/delivered). |
| `role` | string[] | Roles Jeff held on the project. Only when established. |
| `technologies` | string[] | Technologies, not capabilities. May be empty. |
| `capabilities` | string[] | High-level claims this project is evidence for. Must reference `Capability.slug`. |
| `featured` | boolean | Reserved for homepage selection logic. |
| `links` | object | Real destinations keyed by purpose. Keys: `website`, `github`, `demo` — each a URL string. Only keys with a genuine URL are present. No fake destinations. |
| `caseStudy` | string \| null | Reserved. Slug of the future `CaseStudy` page; `null` until it exists. |

Example:

```json
{
    "id": "kodiwa",
    "slug": "kodiwa",
    "title": "KODIWA",
    "shortDescription": null,
    "type": "product",
    "status": "active",
    "role": ["Founder", "Software Engineer"],
    "technologies": ["Laravel", "React Native"],
    "capabilities": ["software-engineering"],
    "featured": true,
    "links": { "website": "https://kodiwa.com" },
    "caseStudy": null
}
```

### Experience — `src/_data/experience.json`

One record per employer. Describes the **role**, not the projects —
project detail lives on the `Project`, and `projects[]` links to it.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable, unique, kebab-case. |
| `company` | string | Employer name. |
| `role` | string | Job title. |
| `startDate` / `endDate` | string \| null | `YYYY-MM`. `endDate` is `null` when `current` is true. |
| `current` | boolean | |
| `summary` | string | Role summary. Must not duplicate project descriptions. |
| `responsibilities` | string[] | May be empty. |
| `achievements` | string[] | May be empty. Never invented. |
| `technologies` | string[] | May be empty. |
| `systems` | string[] | Named systems built/maintained. May be empty. |
| `capabilities` | string[] | Must reference `Capability.slug`. |
| `projects` | string[] | Referenced `Project.id`s. May be empty. |

### Capability — `src/_data/capabilities.json`

The taxonomy of six top-level claims. The canonical identifier is `slug` —
there is **no** separate `id` field. Every `project`/`experience` capability
tag must reference one of these slugs.

The six canonical slugs:

```
software-engineering    cloud-architecture    erp-integration
ai-product-development  technology-strategy   growth-engineering
```

| Field | Type | Notes |
|---|---|---|
| `slug` | string | Canonical identifier. Route: `/capabilities/{slug}/`. |
| `title` | string | Positioned as the hero identity, e.g. "SOFTWARE ENGINEER". |
| `tagline` | string | One-line positioning. |
| `summary` | string | Meta-description + page intro. Required for published capabilities. |
| `description` | string[] | Paragraphs. May be empty for unpublished capabilities. |
| `competencies` | string[] | Supporting abilities (API Architecture, Database Design, ...). Supporting concepts only — never top-level identities, never individual technologies. |
| `technologies` | string[] | Evidence-adjacent stack. May be empty. |
| `published` | boolean | `true` → a page is generated. `false` → the claim stays in the hero only (evidence not deep enough yet). |

**Rule: a hero claim may exist before its deep page. `published: false` is
how the plan enforces "evidence before identity pages."**

`src/_data/publishedCapabilities.js` exports only the published subset; the
capability template paginates over it, so pages are always generated from data.

## Relationships

```
Project     ──capabilities──▶  Capability
Experience  ──capabilities──▶  Capability
Experience  ──projects──────▶  Project
Capability  ──evidence──────▶  Project, Experience  (reverse, via byCapability filter)
```

The `byCapability` Eleventy filter renders a capability page's evidence
sections. There is no manual list duplication anywhere.

## Future entities (Phase 2+, reserved — do not implement yet)

### CaseStudy

Deep, progressive-disclosure page: problem → architecture → implementation →
results. Relates to exactly one `Project` via the project's `caseStudy` field.

```
CaseStudy ──1:1──▶ Project
```

### Venture

A founder-level entity (Kodiwa is the first candidate). Rendered on
`/ventures` and linked from the homepage's venture/founder layer.

```
Venture ──owns──▶ Project(s)
Venture ──demonstrates──▶ Capability (e.g. ai-product-development)
```

### Service

Translates a capability into "things you can hire Jeff for." Must not exist
standalone — a service is backed by the capability it maps to.

```
Service ──backed by──▶ Capability
```

## Integrity rules

Enforced at build time by `scripts/validate.js` (runs via `prebuild`):

- every `id`/`slug` is present, unique within its entity, and kebab-case
- project `slug` === `id`; capabilities have only `slug`
- every `capabilities[]` reference resolves to a `Capability.slug`
- every `experience.projects[]` reference resolves to a `Project.id`
- project `type`/`status` use the controlled vocabularies
- project `links` only contain `website`/`github`/`demo` keys, each a
  well-formed URL
- `published` capabilities have meaningful `summary`, `description`, and
  `competencies`
- required fields have the documented types

**Do not invent content.** Fields without real information are omitted or
empty — accuracy matters more than a full-looking record.
