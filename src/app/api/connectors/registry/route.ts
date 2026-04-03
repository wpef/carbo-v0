import { NextResponse } from 'next/server'
import { getAvailableAdapters } from '@/lib/connectors/registry'

// GET /api/connectors/registry
export async function GET() {
  const sourceAdapters = getAvailableAdapters('source')
  const destinationAdapters = getAvailableAdapters('destination')

  return NextResponse.json({
    adapters: [...sourceAdapters, ...destinationAdapters],
  })
}
