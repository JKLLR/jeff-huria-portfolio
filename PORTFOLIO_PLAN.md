# Portfolio Content Architecture & Roadmap

This document is the source of truth for how this portfolio is structured and
sequenced. It exists so future work (by opencode, Claude, or anyone else)
extends the site according to a plan instead of bolting on sections ad hoc.

## Core positioning

> Jeff Huria is a technology builder who builds, connects, deploys, and
> scales software, systems, products, and businesses.

The hero rotates through six identities (Software Engineer, Cloud Architect,
ERP Integration Specialist, AI-Native Founder, Technology Strategist, Growth
Engineer). These are **not six competing pages** — they're facets of one
person. Each identity only gets a dedicated page once there's real evidence
(shipped projects, work experience, a live venture) to back it up.

**The rule: claims stay in the rotating hero for free. Dedicated pages are
earned by evidence.**

## Content model

Content lives as data (`src/_data/*.json`), not hardcoded in templates.
Pages render from that data via Nunjucks macros/filters. This means content
is never duplicated across pages — a project or experience entry is written
once and tagged with which capability(ies) it's evidence for.

```
Project      → id, title, tags, link, capabilities[]
Experience   → id, role, company, dates, description, capabilities[]
Capability   → slug, title, tagline, description[]
```

`byCapability` (Eleventy filter) pulls all projects/experience tagged with a
given capability slug — that's how a capability page's "evidence" section is
built, with zero duplication.

Not yet modeled (see Phase 2+): `CaseStudy`, `Venture`, `Service`,
`Technology` as first-class entities. These get added when there's enough
real content to justify the structure — adding empty schema ahead of content
is premature.

## Site structure

```
/                                  — homepage (hero, about, experience, works, services, contact)
/capabilities/software-engineering — Phase 1
/capabilities/erp-integration      — Phase 1
```

Static assets (`css/`, `js/`, `assets/`) are passthrough-copied by Eleventy,
same paths as before the migration. Build via `npm run build` → outputs to
`_site/`, which is what Netlify publishes (see `netlify.toml`).

## Phase 1 — shipped

Scoped to what's actually evidence-backed today:

- [x] Migrated from static HTML to Eleventy (shared layout, data-driven
      content, so new pages are cheap to add)
- [x] Content model: `Project`, `Experience`, `Capability` entities as JSON
- [x] `/capabilities/software-engineering` — full evidence (3+ years, 2
      employers, 8 shipped projects)
- [x] `/capabilities/erp-integration` — full evidence (Solutech's SAT
      integrator, 8 ERP/finance platforms, both employers)
- [x] Homepage links to both from the About section

Hero still rotates through all 6 identities. Only these two are clickable —
the other four are aspirational framing until they have evidence.

## Phase 2+ — roadmap (not built yet)

Build each of these **only once there's real evidence to point to** —
otherwise a claim with a thin or empty page behind it is worse than a claim
with no page at all.

| Item | Unlocked by |
|---|---|
| `/capabilities/cloud-architecture` | Real infrastructure/deployment case study beyond CCNA certification — actual production architecture decisions, not just "I deployed to a cloud provider" |
| `/capabilities/ai-native-founder` + `/ventures/kodiwa` | Kodiwa reaching enough shape to be a real case study (problem, product, architecture, users) rather than a placeholder |
| `/capabilities/technology-strategy` | An actual consulting/architecture engagement to reference |
| `/capabilities/growth-engineering` | Real growth/automation work with a concrete definition of what "growth engineering" means for Jeff specifically |
| `Venture` entity + `/ventures` section | Once Kodiwa (or another venture) is real enough to need one canonical case study surfaced from multiple entry points |
| `Service` entity + `/services/*` pages | After capabilities exist to back each service — services translate capabilities into "things you can hire me for," they shouldn't exist standalone |
| `CaseStudy` entity (deep, progressive-disclosure page: problem → architecture → implementation → results) | Once a project has enough real substance (screenshots, architecture decisions, measurable outcomes) to fill one out honestly |
| Migrate `Technology` into a proper entity | Only if the technology list needs to be queried/filtered somewhere — avoid a technology wall for its own sake |

## Working principles

1. **Minimal surface, maximum depth.** Homepage answers "who is this
   person" in ~30 seconds. Every claim on it should be a doorway to more,
   not the full story.
2. **One source of truth, multiple entry points.** A project like Kodiwa
   should never have its content written twice in two files. If it needs to
   appear in both `/work` and `/ventures` someday, one canonical page gets
   linked from both.
3. **Evidence before identity pages.** Don't build a page for a title that
   the rest of the site can't back up yet.
4. **Content vs. presentation stay separate.** New projects/experience go
   into `src/_data/*.json`, tagged with the right capability slugs. Adding a
   project should never require touching a template.
