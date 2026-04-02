# Research: Contractual Document Generation

## Decision: Shared template builder vs. separate from 019

**Chosen**: Separate template builder, not shared with 019.

**Rationale**: The text document (019) and contractual document (020) have fundamentally different structures. The text document is narrative-style with per-object sections containing embedded field tables. The contractual document has formal sections: scope, correspondence tables, dedicated rules sections (transformation + validation separately), exclusions, filters, signature block. Attempting to share a template would require heavy conditional logic that hurts readability (Principle II).

**Rejected**: Shared template with mode flag. Would create a complex branching template that serves neither format well.

## Decision: Reference number format

**Chosen**: `CARBO-YYYYMMDD-XXXX` where XXXX is a zero-padded sequential counter per day, read from the database.

**Implementation**: Query `SELECT COUNT(*) FROM ContractualDocument WHERE referenceNumber LIKE 'CARBO-YYYYMMDD-%'` to get the next sequence number for the day. If concurrent generation is a concern, use a database transaction with a unique constraint on `referenceNumber`.

**Rationale**: Human-readable, sortable, and unique. The date prefix enables quick identification. The daily counter resets each day, keeping numbers short.

**Rejected**: UUID. Not human-readable -- consultants need to reference the document in conversations and emails.

**Rejected**: Incremental global counter. Harder to parse visually (is `CARBO-0047` recent or old?).

## Decision: CSS strategy

**Chosen**: Inline `<style>` block with formal/legal styling (serif fonts, numbered sections, bordered tables, signature lines).

**Rationale**: Same as 019 -- self-contained HTML for iframe preview and PDF export. The formal styling uses: serif font family, 1.5 line spacing, darker color palette, solid table borders, and a signature block with printed lines.

## Decision: Section presence policy

**Chosen**: All sections are always present, even when empty. Empty sections show an explicit message (e.g., "No transformation rules defined", "All source fields are mapped -- no exclusions").

**Rationale**: Per FR-015, no section is conditionally omitted. This ensures the contractual document is always complete and the client knows every aspect was considered.

## Decision: Consultant identifier

**Chosen**: Read from plan metadata (a `consultantName` field on the plan). If not set, use "Not specified".

**Rationale**: User authentication is out of scope until Phase 3. The consultant can set their name in the plan settings. This is simpler than building an auth system just for a name in a document header.

## Constraint: Signature block is print-and-sign

The signature block renders HTML fields (lines for name, date, signature) designed for physical print-and-sign. Digital signature is explicitly out of scope for v0.

## Constraint: Relationship to 019

Features 019 and 020 are independent parallel features. They share the same dependencies (018, 016) but do not depend on each other. They can be implemented in parallel. However, they share the `src/components/documents/` component directory and the `/api/plans/[planId]/documents/` route namespace.
