// 020-contractual-document — Reference number generator
//
// Generates unique reference numbers in the format CARBO-YYYYMMDD-XXXX.
// Since we cannot persist to DB (no prisma model), we use a module-level
// counter that resets on server restart. For v0 (local-first), this is acceptable.

let dailyCounter: { date: string; count: number } = { date: '', count: 0 }

/**
 * Generate a unique contractual document reference number.
 * Format: CARBO-YYYYMMDD-XXXX (e.g., CARBO-20260403-0001)
 *
 * Sequential within a server session per day.
 * In production, this would use a DB transaction for true uniqueness.
 */
export function generateReferenceNumber(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const dateStr = `${year}${month}${day}`

  if (dailyCounter.date !== dateStr) {
    dailyCounter = { date: dateStr, count: 0 }
  }

  dailyCounter.count += 1
  const seq = String(dailyCounter.count).padStart(4, '0')

  return `CARBO-${dateStr}-${seq}`
}

/**
 * Validate a reference number matches the expected format.
 */
export function isValidReferenceNumber(ref: string): boolean {
  return /^CARBO-\d{8}-\d{4}$/.test(ref)
}
