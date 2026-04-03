// 021-pdf-export — Types for the PDF export service

/**
 * Options for PDF generation.
 */
export interface PdfOptions {
  /** Document title shown in header. Defaults to document planName. */
  title?: string
  /** Generation date shown in header. Defaults to current date. */
  date?: string
  /** Page size. Defaults to A4. */
  pageSize?: 'A4' | 'Letter'
  /** Whether to render in landscape orientation. Defaults to false. */
  landscape?: boolean
  /** Page margins in CSS units (e.g. "25mm"). */
  margin?: {
    top: string
    right: string
    bottom: string
    left: string
  }
}

/**
 * Result of a successful PDF generation.
 */
export interface PdfResult {
  /** The raw PDF bytes. */
  buffer: Buffer
  /** Size of the PDF in bytes. */
  fileSize: number
}
