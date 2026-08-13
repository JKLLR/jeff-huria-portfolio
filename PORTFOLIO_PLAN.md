# Portfolio Architecture & Roadmap

This document is the source of truth for how this portfolio is structured and
sequenced. It exists so future work (by opencode, Claude, or anyone else)
extends the site according to a plan instead of bolting on sections ad hoc.

See also [`docs/CONTENT_MODEL.md`](docs/CONTENT_MODEL.md) for the canonical
data model behind everything below.

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

## Site structure

```
/                                  — homepage (hero, about, experience, works, services, contact)
/capabilities/software-engineering — generated from capability data
/capabilities/erp-integration      — generated from capability data
```

Capability pages are **generated**, not hand-written. One template
(`src/capabilities/capability.njk`) paginates over `publishedCapabilities`
(a filtered view of `src/_data/capabilities.json`). Adding a capability page
is a data edit — set `"published": true` and add content. No template work.

Static assets (`css/`, `js/`, `assets/`) are passthrough-copied by Eleventy,
same paths as before the migration. Build via `npm run build` → outputs to
`_site/`, which is what Netlify publishes (see `netlify.toml`). Validation
(`scripts/validate.js`) runs automatically before every build.

## Phase 1 — Foundation (complete)

- [x] Eleventy structure clean: shared layout, data-driven content,
      capability pages generated from data (no duplicated templates)
- [x] Content model: `Project`, `Experience`, `Capability` as JSON in
      `src/_data/`, documented in `docs/CONTENT_MODEL.md`
- [x] Consistent schemas for all three entities; `id` === `slug` everywhere
- [x] Capability tagging is meaningful (high-level claims, not technologies)
- [x] Project links: real external URLs only; no fake `/#connect` destinations
      — projects without a live URL render without a link
- [x] Experience links to projects (`experience → projects[]`); descriptions
      no longer duplicate project content
- [x] Build-time validation (`scripts/validate.js`): duplicate ids/slugs,
      unknown capability/project references, malformed URLs
- [x] Homepage stays a summary layer; content is never duplicated across
      homepage, capability pages, or cards
- [x] Accessibility: skip link, `main` landmark, focus-visible states,
      reduced-motion support (loader, hero rotation, shatter, marquee),
      no-JS fallback (loader/site never hide without JS)
- [x] Mobile navigation restored (previously hidden below 960px with no
      replacement)
- [x] SEO: unique title + description + canonical + Open Graph + Twitter
      metadata on every page
- [x] Dead code removed: `.photo-placeholder`, `.split-title`, unused
      `findBySlug` filter, stale local log files

## Phase 2 — Evidence & Case Studies (future)

| Item | Unlocked by |
|---|---|
| `CaseStudy` entity + `/case-studies/*` | A project with enough real substance (screenshots, architecture decisions, measurable outcomes) to fill out problem → architecture → implementation → results honestly |
| `caseStudy` value on a project record | Linking a project to its deep case-study page once it exists |
| `/work/{slug}` project pages | When a project needs a canonical deep page that multiple entry points link to |

## Phase 3 — Ventures & Founder Layer (future)

| Item | Unlocked by |
|---|---|
| `Venture` entity + `/ventures` section | Once Kodiwa (or another venture) is real enough to need one canonical case study surfaced from multiple entry points |
| `/capabilities/ai-product-development` page | Real AI product evidence to point to (Vochi, EchoKey are tagged now; the page stays unpublished until the evidence is deep enough) |
| `/capabilities/cloud-architecture` page | Real infrastructure/deployment case study beyond CCNA certification — actual production architecture decisions, not just "I deployed to a cloud provider" |

## Phase 4 — Consulting / Services (future)

| Item | Unlocked by |
|---|---|
| `Service` entity + `/services/*` pages | Once capabilities exist to back each service — services translate capabilities into "things you can hire me for," they shouldn't exist standalone |
| `/capabilities/technology-strategy` page | An actual consulting/architecture engagement to reference |
| `/capabilities/growth-engineering` page | Real growth/automation work with a concrete definition of what "growth engineering" means for Jeff specifically |

## Phase 5 — Refinement (future)

- Technology as a first-class entity — only if the list needs to be
  queried/filtered somewhere
- Search, CMS, database — only when there is enough content to justify them
  (Phase 1 is JSON + Eleventy data by design)

## Working principles

1. **Minimal surface, maximum depth.** Homepage answers "who is this
   person" in ~30 seconds. Every claim on it should be a doorway to more,
   not the full story.
2. **One source of truth, multiple entry points.** A project like Kodiwa
   should never have its content written twice in two files. If it needs to
   appear in both `/work` and `/ventures` someday, one canonical page gets
   linked from both.
3. **Evidence before identity pages.** Don't build a page for a title that
   the rest of the site can't back up yet. `published: false` in
   `capabilities.json` is how this is enforced.
4. **Content vs. presentation stay separate.** New projects/experience go
   into `src/_data/*.json`, tagged with the right capability slugs. Adding a
   project should never require touching a template.
