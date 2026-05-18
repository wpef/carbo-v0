'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'

interface PlanHeaderProps {
  planId: string
  name: string
  status: string
}

export function PlanHeader({ name, status }: PlanHeaderProps) {
  return (
    <header className="h-14 border-b flex items-center px-4 gap-4 shrink-0">
      <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
        &larr; Plans
      </Link>
      <div className="h-4 w-px bg-border" />
      <h1 className="font-semibold truncate">{name}</h1>
      <Badge variant={status === 'DRAFT' ? 'secondary' : 'default'} className="ml-auto">
        {status}
      </Badge>
    </header>
  )
}
