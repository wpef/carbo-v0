import { prisma } from '@/lib/db/prisma'

export async function logAction(planId: string | null, action: string, details?: Record<string, unknown>) {
  const entry = await prisma.auditLog.create({
    data: {
      planId,
      action,
      details: details ? JSON.stringify(details) : null,
    },
  })

  console.log(`[AUDIT] ${action}${planId ? ` (plan: ${planId})` : ''}`, details ?? '')

  return entry
}
