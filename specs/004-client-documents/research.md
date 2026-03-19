# Research: Client Documents

**Feature**: 004-client-documents
**Date**: 2026-03-19

## Decision 1: Natural Language Generation Strategy

**Decision**: Hybrid approach — hardcoded templates for simple rules + Claude API for complex rules

**Rationale**:
- Simple rules are predictable and can be described with templates:
  - Fixed value: "The field will always be set to '{value}'"
  - Field reference: "The value will be taken from the '{fieldName}' field"
  - Type check: "The value must be a valid {type}"
- Complex rules require LLM interpretation:
  - JS functions: `value.trim().toUpperCase()` → "Spaces are removed and text is converted to uppercase"
  - Regex patterns: `^[A-Z]{2}$` → "Must be exactly 2 uppercase letters"
- Using Claude API (@anthropic-ai/sdk) with a focused prompt for rule description.
- Fallback if API unavailable: show the raw code/pattern with a note.

**Alternatives considered**:
- All templates (no LLM): cannot handle arbitrary JS functions or complex regex.
- All LLM (no templates): slower and more expensive for trivially describable rules.
- Local LLM: adds deployment complexity, inferior quality for this task.

## Decision 2: PDF Generation

**Decision**: Puppeteer (headless Chrome) for HTML → PDF conversion

**Rationale**:
- Puppeteer renders HTML+CSS exactly as Chrome would — consistent, professional output.
- Supports headers, footers, page numbers, and table of contents.
- The HTML template is the single source of truth — preview and PDF look identical.
- @anthropic-ai/sdk is already a server-side dependency, so Node.js server-side execution is expected.

**Alternatives considered**:
- jsPDF: lightweight but poor HTML rendering, no CSS support. Not suitable for professional documents.
- wkhtmltopdf: good rendering but requires external binary installation. Puppeteer is npm-native.
- react-pdf: React-based PDF generation. Different rendering model from HTML preview — inconsistency risk.
- Prince XML: excellent quality but commercial license required.

## Decision 3: Document Storage

**Decision**: Store generated HTML in SQLite; generate PDF on demand from stored HTML

**Rationale**:
- HTML is the canonical format — stored in the database as text.
- PDF is generated on demand from the stored HTML (via Puppeteer) when the user clicks "Download".
- This avoids storing large PDF binaries in SQLite.
- If the mapping plan changes, the consultant regenerates — old documents are kept for audit trail.

**Alternatives considered**:
- Store both HTML and PDF: wastes storage for PDF that may never be downloaded.
- Store PDF only: loses the ability to preview in-app without a PDF viewer.
- File-based storage: loses the benefits of database queries and audit trail integration.

## Decision 4: Document Templates

**Decision**: Standalone HTML files with Handlebars-style placeholders, rendered server-side

**Rationale**:
- HTML templates are easy to read, modify, and test independently.
- Handlebars-like syntax ({{variable}}) is familiar and lightweight.
- Server-side rendering ensures consistent output regardless of browser.
- Templates are plain files in `lib/documents/templates/` — no build step required.

**Alternatives considered**:
- React components for document rendering: adds complexity, blurs the line between UI and document.
- Markdown → HTML → PDF: Markdown is too limited for structured contractual documents.
- LaTeX: powerful typesetting but steep learning curve and complex toolchain.
