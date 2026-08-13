# Content Model

This document defines the canonical data model for the portfolio. It exists
so future development (Phase 2+) extends the architecture instead of drifting
away from it.

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
| `shortDescription` | string? | Only present when real copy exists. Omit rather than invent. |
| `type` | string | `"product"` or `"integration"`. |
| `role` | string[] | Roles Jeff held on the project. Only when established. |
| `technologies` | string[] | Technologies, not capabilities. May be empty. |
| `capabilities` | string[] | High-level claims this project is evidence for. Must reference `Capability.id`. |
| `featured` | boolean | Reserved for homepage selection logic. |
| `links` | object | External/visit links keyed by purpose (`visit`). No fake destinations. |
| `caseStudy` | string \| null | Reserved. Slug of the future `CaseStudy` page; `null` until it exists. |

Example:

```json
{
    "id": "kodiwa",
    "slug": "kodiwa",
    "title": "KODIWA",
    "type": "product",
    "role": ["Founder", "Software Engineer"],
    "technologies": ["Laravel", "React Native"],
    "capabilities": ["software-engineering"],
    "featured": true,
    "links": { "visit": { "href": "https://kodiwa.com", "label": "VISIT SITE ↗", "external": true } },
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
| `startDate` / `endDate` | string | `YYYY-MM`. `endDate` may be `null` when `current` is true. |
| `current` | boolean | |
| `summary` | string | Role summary. Must not duplicate project descriptions. |
| `technologies` | string[] | May be empty. |
| `systems` | string[] | Named systems built/maintained. |
| `capabilities` | string[] | Must reference `Capability.id`. |
| `projects` | string[] | Referenced `Project.id`s. May be empty. |

### Capability — `src/_data/capabilities.json`

The taxonomy of six top-level claims. Every `project`/`experience` capability
tag must reference one of these.

The six canonical slugs:

```
software-engineering    cloud-architecture    erp-integration
ai-product-development  technology-strategy   growth-engineering
```

| Field | Type | Notes |
|---|---|---|
| `id` | string | Must equal `slug`. |
| `slug` | string | Must equal `id`. Route: `/capabilities/{slug}/`. |
| `title` | string | Positioned as the hero identity, e.g. "SOFTWARE ENGINEER". |
| `tagline` | string | One-line positioning. |
| `summary` | string | Meta-description + page intro. |
| `description` | string[] | Paragraphs. |
| `competencies` | string[] | Supporting abilities (API Architecture, Database Design, ...). Supporting concepts only — never top-level identities, never individual technologies. |
| `technologies` | string[] | Evidence-adjacent stack. |
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

- ids and slugs are unique within each entity; `id` === `slug`
- ids are kebab-case
- every `capabilities[]` reference resolves to a `Capability.id`
- every `experience.projects[]` reference resolves to a `Project.id`
- every project link href is a well-formed URL (http/https/mailto/tel or `/`)
- published capabilities share no slug collisions

**Do not invent content.** Fields without real information are omitted or
empty — accuracy matters more than a full-looking record.
