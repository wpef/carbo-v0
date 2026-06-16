// Unit tests for ObjectCard (011-object-mapping — T009)
// Tests: circle placement, highlight state, drift badges, click handlers.

import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ObjectCard } from '@/features/object-mapping/components/ObjectCard'

describe('ObjectCard', () => {
  describe('source role', () => {
    it('renders label text', () => {
      render(<ObjectCard apiName="Account" label="Account" isCustom={false} role="source" />)
      // The label appears in a <span class="text-sm font-medium"> — get all and find it
      const spans = screen.getAllByText('Account')
      expect(spans.length).toBeGreaterThanOrEqual(1)
    })

    it('renders the connection circle on the right (source)', () => {
      render(
        <ObjectCard
          apiName="Account"
          label="Account"
          isCustom={false}
          role="source"
          onCircleClick={() => {}}
        />,
      )
      const circle = screen.getByRole('button', { name: /select account as mapping source/i })
      expect(circle).toBeTruthy()
    })

    it('calls onCircleClick with apiName when circle clicked', () => {
      const handler = vi.fn()
      render(
        <ObjectCard
          apiName="Account"
          label="Account"
          isCustom={false}
          role="source"
          onCircleClick={handler}
        />,
      )
      fireEvent.click(screen.getByRole('button', { name: /select account/i }))
      expect(handler).toHaveBeenCalledWith('Account')
    })

    it('calls onCardClick with apiName when card div clicked', () => {
      const handler = vi.fn()
      render(
        <ObjectCard
          apiName="Account"
          label="Account"
          isCustom={false}
          role="source"
          onCardClick={handler}
        />,
      )
      const card = document.querySelector('[data-api-name="Account"]') as HTMLElement
      fireEvent.click(card)
      expect(handler).toHaveBeenCalledWith('Account')
    })
  })

  describe('destination role', () => {
    it('renders the connection circle on the left (destination)', () => {
      render(
        <ObjectCard
          apiName="companies"
          label="Companies"
          isCustom={false}
          role="destination"
          onCircleClick={() => {}}
        />,
      )
      const circle = screen.getByRole('button', { name: /connect to companies/i })
      expect(circle).toBeTruthy()
    })

    it('does NOT render a right-side circle for destination', () => {
      render(
        <ObjectCard
          apiName="companies"
          label="Companies"
          isCustom={false}
          role="destination"
          onCircleClick={() => {}}
        />,
      )
      // Only the left circle button should be present
      const buttons = screen.getAllByRole('button')
      expect(buttons).toHaveLength(1)
      expect(buttons[0].getAttribute('aria-label')).toMatch(/connect to companies/i)
    })

    it('calls onCircleClick with apiName when circle clicked', () => {
      const handler = vi.fn()
      render(
        <ObjectCard
          apiName="companies"
          label="Companies"
          isCustom={false}
          role="destination"
          onCircleClick={handler}
        />,
      )
      fireEvent.click(screen.getByRole('button', { name: /connect to companies/i }))
      expect(handler).toHaveBeenCalledWith('companies')
    })
  })

  describe('Custom badge', () => {
    it('shows Custom badge when isCustom=true', () => {
      render(
        <ObjectCard apiName="Custom__c" label="Custom Object" isCustom={true} role="source" />,
      )
      expect(screen.getByText('Custom')).toBeInTheDocument()
    })

    it('does not show Custom badge when isCustom=false', () => {
      render(
        <ObjectCard apiName="Account" label="Account" isCustom={false} role="source" />,
      )
      expect(screen.queryByText('Custom')).not.toBeInTheDocument()
    })
  })

  describe('Drift badges', () => {
    it('shows Nouveau badge when driftStatus=new', () => {
      render(
        <ObjectCard
          apiName="NewObject"
          label="New Object"
          isCustom={false}
          role="source"
          driftStatus="new"
        />,
      )
      expect(screen.getByText('Nouveau')).toBeInTheDocument()
    })

    it('shows Supprimé en source badge when driftStatus=removed on source', () => {
      render(
        <ObjectCard
          apiName="OldObject"
          label="Old Object"
          isCustom={false}
          role="source"
          driftStatus="removed"
        />,
      )
      expect(screen.getByText('Supprimé en source')).toBeInTheDocument()
    })

    it('shows Supprimé en destination badge when driftStatus=removed on destination', () => {
      render(
        <ObjectCard
          apiName="OldObj"
          label="Old Obj"
          isCustom={false}
          role="destination"
          driftStatus="removed"
        />,
      )
      expect(screen.getByText('Supprimé en destination')).toBeInTheDocument()
    })
  })

  describe('isHighlighted', () => {
    it('applies highlighted border class when isHighlighted=true', () => {
      render(
        <ObjectCard
          apiName="Account"
          label="Account"
          isCustom={false}
          role="source"
          isHighlighted={true}
        />,
      )
      const card = document.querySelector('[data-api-name="Account"]') as HTMLElement
      expect(card.className).toContain('border-primary')
    })
  })
})
