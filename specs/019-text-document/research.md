# Research: Text Document Generation

## Decision: Server-side template approach

**Chosen**: TypeScript functions that produce HTML strings via template literals.

**Rationale**: The document is a static HTML page (not interactive). Template literals are readable, type-safe, and require no dependency. Each section (summary, object, field table, unmapped, filters) is a function returning an HTML string. The functions are composed into a full document.

**Rejected**: React server components rendered to HTML. Adds complexity (renderToString, component lifecycle) for a non-interactive document. The HTML is never hydrated.

**Rejected**: Handlebars/EJS. Extra dependency for templates that are straightforward string concatenation.

## Decision: CSS strategy for generated HTML

**Chosen**: Inline CSS within the HTML document (embedded `<style>` block).

**Rationale**: The HTML must be self-contained for two reasons: (1) iframe preview renders the HTML without access to the app's CSS, (2) PDF export (feature 021) needs self-contained HTML for Puppeteer. A single `<style>` block at the top covers all document styles.

**Rejected**: Tailwind classes. Would require Tailwind processing at generation time, which is impractical for a server-side HTML string.

## Decision: Document storage

**Chosen**: Store the full HTML string in a `TextDocument` table with `htmlContent TEXT` column.

**Rationale**: The document is immutable after creation. Storing the rendered HTML avoids re-rendering and ensures the document looks the same even if the plan changes later. SQLite TEXT columns handle large strings (up to 1GB).

**Rejected**: Store structured data and render on-demand. Would violate the immutability requirement -- if the plan changes, the document would change too.

## Decision: Preview mechanism

**Chosen**: `<iframe srcDoc={htmlContent} />` in a React component.

**Rationale**: The `srcDoc` attribute renders HTML directly in the iframe without a separate URL. This isolates the document's CSS from the app's CSS. No additional route needed for serving the HTML.

**Rejected**: `dangerouslySetInnerHTML`. Would mix document CSS with app CSS, causing style conflicts.

## Decision: Table of contents

**Chosen**: Generated as HTML anchor links when 3+ object mappings exist. Each section heading has an `id` attribute; the TOC links to `#section-{objectApiName}`.

**Rationale**: Simple HTML anchors work in both browser preview and PDF. No JavaScript required.

## Constraint: Document versioning

Each generation creates a new row in `TextDocument`. There is no update endpoint. Old versions remain accessible. The UI shows the latest version by default with ability to view history.

## Constraint: Rule descriptions come from 018

The template builder receives pre-computed descriptions from the Rule Description Engine. It does NOT call the engine itself. The service orchestrator calls 018 first, then passes descriptions to the builder. This keeps the template builder pure (string in -> string out).
