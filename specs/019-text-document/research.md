# Research: Text Document Generation

## Decision 1: Template Engine Choice

**Decision**: Plain TypeScript template functions (string interpolation) for HTML generation. No external template engine (Handlebars, EJS, etc.).

**Rationale**: The document structure is fixed and known at compile time. TypeScript template literals with helper functions provide full type safety, IDE support, and zero additional dependencies. The template is a pure function: `(data: TextDocumentData) => string`. This avoids the runtime overhead and security surface of a template engine. The document is ~500-2000 lines of HTML -- well within string concatenation limits.

**Alternatives**: Handlebars (adds dependency, loses type safety), EJS (server-side rendering overhead), React SSR (overkill -- we need a string, not a component tree), MDX (wrong abstraction for structured tables).

## Decision 2: HTML Document Structure

**Decision**: Self-contained HTML with embedded CSS (inline `<style>` block). No external stylesheets or asset references.

**Rationale**: The spec assumption states "HTML content is self-contained." This is required for PDF export (feature 021) where Puppeteer renders the HTML without access to the application's CSS. Embedded styles also ensure the document looks the same in the preview iframe as in the PDF. Tailwind utility classes are NOT used in the template -- only semantic CSS.

**Alternatives**: Tailwind classes with extraction (complex build step), external stylesheet URL (breaks PDF rendering), inline styles per element (verbose and hard to maintain).

## Decision 3: Document Preview Approach

**Decision**: Render the HTML document in a sandboxed `<iframe>` with `srcdoc` attribute.

**Rationale**: FR-010 requires preview within the application. An iframe with `srcdoc` provides clean isolation -- the document's CSS does not leak into the application shell, and the application's CSS does not affect the document. The `sandbox` attribute restricts scripts and navigation for security. The `srcdoc` approach avoids a separate fetch for the HTML content.

**Alternatives**: `dangerouslySetInnerHTML` in a React div (CSS leakage, XSS risk), separate window/tab (leaves the application), shadow DOM (complex for a full document).

## Decision 4: Document Immutability Strategy

**Decision**: Documents are stored as complete HTML strings in the database. Once persisted, the `htmlContent` field is never updated. Each generation creates a new row.

**Rationale**: FR-008 requires immutability. Storing the full HTML means the document is a snapshot in time -- even if the migration plan changes, the generated document remains unchanged. The consultant can compare old and new versions. Storage cost is acceptable: a 50-field document is ~50-100KB of HTML.

**Alternatives**: Store structured data and re-render on view (violates immutability -- the template could change), store a diff from the plan (complex reconstruction), store only a reference to plan state (requires plan versioning).

## Decision 5: Table of Contents Strategy

**Decision**: Generate a table of contents with anchor links when the plan has 3 or more object mappings (FR-012). Each object section gets an `id` attribute; the TOC links to `#object-{index}`.

**Rationale**: The spec requires a TOC at 3+ object mappings. Anchor links work in both HTML preview and PDF export. The TOC is generated as part of the template -- not a separate pass.

**Alternatives**: JavaScript-generated TOC on render (breaks in PDF), manual section numbering without links (less useful), always include TOC (unnecessary for 1-2 objects).

## Decision 6: Unmapped Fields Section Design

**Decision**: Unmapped fields are displayed in a dedicated section at the end of each object mapping section (not a global section). Each unmapped field shows the field label, API name, and type. The section uses warning styling (amber background, warning icon).

**Rationale**: FR-007 requires explicit per-object unmapped field listing. Placing it within each object section makes it contextual -- the reader sees the gap immediately after the mapping table for that object. The warning styling ensures it is not overlooked (Constitution Principle III).

**Alternatives**: Global unmapped fields section at end of document (loses context), inline in the mapping table as empty rows (confusing), separate unmapped-only page (over-engineered).

## Decision 7: Status Field and OUTDATED Transition

**Decision**: New documents are created with `status: CURRENT`. The reconfiguration cascade (from features 002/006) calls a `markDocumentsOutdated(planId)` function that transitions all `CURRENT` text documents for that plan to `OUTDATED`. The document list UI shows an `OUTDATED` banner.

**Rationale**: FR-013 requires a status field with reconfiguration-driven transitions. The transition is one-way (`CURRENT` → `OUTDATED`, never back). The banner prompts regeneration without blocking document viewing (the document is still valid for audit purposes).

**Alternatives**: Delete outdated documents (violates immutability principle), auto-regenerate (violates Principle IX -- human must trigger), version comparison (Phase 2 feature).

## Decision 8: Loading Complete Plan Data

**Decision**: A dedicated `text-document-loader.ts` function performs a single Prisma query with nested includes to load the complete plan data: plan metadata, object mappings with field mappings, migration logic with value equivalences and classification prompts, migration filters, and field exclusions (for unmapped field computation). This produces a typed `TextDocumentData` object ready for template rendering.

**Rationale**: The template function should receive fully resolved data -- it should not make database calls. Separating the loader from the template makes the template a pure function, easy to test with fixtures. The single query approach avoids N+1 problems.

**Alternatives**: Multiple queries per object mapping (N+1 problem), lazy loading in template (breaks purity), pass raw Prisma types to template (tight coupling to ORM).
