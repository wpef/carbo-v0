// Unit tests for ObjectLink SVG component (011-object-mapping — T011)
// Verifies bezier path rendering and delete midpoint behaviour.

import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ObjectLink } from '@/features/object-mapping/components/ObjectLink'

// Wrap in SVG so the test renderer can parse <g>/<path> elements
function withSvg(element: React.ReactNode) {
  return <svg>{element}</svg>
}

describe('ObjectLink', () => {
  it('renders a path element with var(--primary) stroke by default', () => {
    const { container } = render(
      withSvg(
        <ObjectLink x1={0} y1={50} x2={200} y2={50} mappingId="m1" />,
      ),
    )
    const path = container.querySelector('path')
    expect(path).toBeTruthy()
    expect(path?.getAttribute('stroke')).toBe('var(--primary)')
    // No dashed stroke — not broken
    expect(path?.getAttribute('stroke-dasharray')).toBeNull()
  })

  it('renders a dashed destructive path when isBroken=true', () => {
    const { container } = render(
      withSvg(
        <ObjectLink x1={0} y1={50} x2={200} y2={50} mappingId="m1" isBroken={true} />,
      ),
    )
    const path = container.querySelector('path')
    expect(path?.getAttribute('stroke')).toBe('var(--destructive)')
    expect(path?.getAttribute('stroke-dasharray')).toBeTruthy()
  })

  it('renders a delete midpoint button when onDelete is provided', () => {
    render(
      withSvg(
        <ObjectLink
          x1={0}
          y1={50}
          x2={200}
          y2={50}
          mappingId="m1"
          onDelete={() => {}}
        />,
      ),
    )
    expect(screen.getByRole('button', { name: /supprimer ce mapping/i })).toBeInTheDocument()
  })

  it('does NOT render a delete midpoint button when onDelete is absent', () => {
    render(
      withSvg(
        <ObjectLink x1={0} y1={50} x2={200} y2={50} mappingId="m1" />,
      ),
    )
    expect(screen.queryByRole('button', { name: /supprimer/i })).not.toBeInTheDocument()
  })

  it('calls onDelete with mappingId when the midpoint is clicked', () => {
    const handler = vi.fn()
    render(
      withSvg(
        <ObjectLink
          x1={0}
          y1={50}
          x2={200}
          y2={50}
          mappingId="test-mapping-123"
          onDelete={handler}
        />,
      ),
    )
    fireEvent.click(screen.getByRole('button', { name: /supprimer ce mapping/i }))
    expect(handler).toHaveBeenCalledWith('test-mapping-123')
  })

  it('generates a valid cubic bezier M ... C ... path', () => {
    const { container } = render(
      withSvg(
        <ObjectLink x1={10} y1={20} x2={190} y2={80} mappingId="m2" />,
      ),
    )
    const d = container.querySelector('path')?.getAttribute('d') ?? ''
    // Must start with M (moveto) and contain C (cubic bezier)
    expect(d).toMatch(/^M\s/)
    expect(d).toContain(' C ')
  })
})
