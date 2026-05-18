# Research: Contractual Document Generation

## Decision 1: Reference Number Generation

**Decision**: Format `CARBO-YYYYMMDD-XXXX` where `YYYYMMDD` is the generation date and `XXXX` is a 4-digit zero-padded sequential counter per day. The counter is derived from the count of existing contractual documents generated on the same day, plus one. Uniqueness is enforced by a database unique constraint on the `referenceNumber` column with a retry mechanism (up to 3 attempts) in case of concurrent generation.

**Rationale**: FR-013 requires globally unique reference numbers. The date-prefixed format gives immediate temporal context when reading the document. The sequential counter per day handles multiple generations on the same day. The retry mechanism handles the rare race condition of concurrent generation requests.

**Alternatives**: UUID (not human-readable), plan-based prefix (loses global uniqueness across plans), timestamp-based microseconds (fragile in concurrent scenarios), database sequence (Neon/Postgres specific, harder to format).

## Decision 2: Formal Layout vs Text Document

**Decision**: The contractual document uses a distinct CSS stylesheet with formal typography: serif fonts for headings, larger margins, formal section numbering (1., 1.1., etc.), rule lines between sections, and a structured signature block at the bottom. The text document uses a more casual sans-serif layout.

**Rationale**: FR-001 requires the contractual document to be "visually distinct from the text document." The formal layout signals to the client that this is a binding document requiring review and signature, not just an informational overview. The section numbering makes it easy to reference specific parts in discussions.

**Alternatives**: Same layout with different header (too subtle), PDF-only formal styling (not visible in preview), brand-colored styling (too informal for contractual use).

## Decision 3: Relationship with Feature 019 (Text Document)

**Decision**: The contractual document feature is a fully independent module. It does NOT extend or inherit from the text document feature. Both features share the same dependency on feature 018 (Rule Description Engine) and follow the same load→describe→render→persist pattern, but each has its own loader, template, service, and Prisma model.

**Rationale**: The two document types have different sections (text doc has no signature block, no reference number, no scope section; contractual doc has no generation stats footer), different templates, and different styling. Sharing a base class or template would create coupling that makes independent evolution difficult. The shared pattern is in the architecture approach, not in shared code.

**Alternatives**: Shared abstract document service (creates coupling, complicates independent changes), single Document table with type discriminator (merges semantically different entities), contractual extends text document (misleading inheritance -- contractual is not a specialization of text).

## Decision 4: Signature Block Design

**Decision**: The signature block is a CSS-styled section at the bottom of the HTML document with four fields rendered as labeled lines: "Approbation client" (checkbox line), "Nom du client" (text line), "Date" (text line), "Signature" (signature line with dotted underline). The block is designed for print-and-sign workflow.

**Rationale**: FR-009 specifies a manual signature block. The HTML design must work both in the preview iframe and in the PDF export (feature 021). Using CSS-styled lines rather than form inputs ensures consistent rendering across all output formats. Digital signature is explicitly out of scope for v0.

**Alternatives**: HTML form inputs (don't render in PDF), canvas-based signature (requires JavaScript, complex), signature image upload (Phase 2 feature), digital signature integration (out of scope per assumptions).

## Decision 5: All Sections Always Present

**Decision**: Every section (header, scope, correspondence tables, migration logic rules, exclusions, filters, signature block) is always rendered in the document, even when the associated data is empty. Empty sections display an explicit "nothing defined" message.

**Rationale**: FR-014 requires no section to be conditionally omitted. This is a contractual design choice: the client must see that the section was considered and is explicitly empty, rather than wondering if it was forgotten. This also ensures consistent document structure across all plans.

**Alternatives**: Hide empty sections (violates FR-014), collapse empty sections with "expand" option (adds JavaScript, breaks PDF), show only non-empty sections (client cannot verify completeness).

## Decision 6: Shared Data Loader Pattern

**Decision**: The contractual document loader (`contractual-document-loader.ts`) follows the same pattern as the text document loader (019) but produces a `ContractualDocumentData` type that includes additional fields: consultant identifier (from plan metadata or a default), reference number placeholder, and the full migration logic rules list (for the dedicated rules section).

**Rationale**: Both document types need the same underlying plan data, but the contractual document organizes it differently (dedicated rules section vs inline in field mapping table). A separate loader avoids coupling while allowing the same Prisma query pattern to be used.

**Alternatives**: Import text document loader and transform output (creates dependency on 019), shared generic loader with type parameter (premature abstraction), inline Prisma queries in service (loses separation of concerns).

## Decision 7: OUTDATED Status and Reconfiguration

**Decision**: Same mechanism as text document (019 Decision 7). New documents are `CURRENT`, reconfiguration cascade transitions to `OUTDATED`. An outdated contractual document gets a prominent red banner (stronger than text document's amber) because contractual documents have legal implications -- the client may have signed a version that no longer matches the current plan.

**Rationale**: FR-015 requires a status field with reconfiguration-driven transitions. The stronger visual treatment for contractual documents reflects the higher stakes: a signed contractual document that becomes outdated represents a discrepancy between what was agreed and what will be executed.

**Alternatives**: Block migration execution if contractual document is outdated (too restrictive for v0), auto-void outdated documents (violates immutability and audit trail), same amber styling as text document (underplays the contractual implications).
