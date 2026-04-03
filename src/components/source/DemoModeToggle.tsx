'use client'

import { Button } from '@/components/ui/button'

interface DemoModeToggleProps {
  onSelect: (adapterType: 'demo') => void
  isSelected?: boolean
}

export function DemoModeToggle({ onSelect, isSelected }: DemoModeToggleProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 p-4">
      <div className="flex-1">
        <p className="text-sm font-medium">Use Demo Data</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Explore the app with pre-loaded mock records — no credentials required.
        </p>
      </div>
      <Button
        variant={isSelected ? 'default' : 'outline'}
        size="sm"
        onClick={() => onSelect('demo')}
      >
        {isSelected ? 'Selected' : 'Use Demo'}
      </Button>
    </div>
  )
}
