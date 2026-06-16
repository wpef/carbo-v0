// Unit tests for ObjectSearchFilter (011-object-mapping — T010)

import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ObjectSearchFilter } from '@/features/object-mapping/components/ObjectSearchFilter'

describe('ObjectSearchFilter', () => {
  it('renders the search input with the given value', () => {
    render(
      <ObjectSearchFilter
        search="acc"
        onSearchChange={() => {}}
        filter="all"
        onFilterChange={() => {}}
      />,
    )
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('acc')
  })

  it('calls onSearchChange when the user types', () => {
    const handler = vi.fn()
    render(
      <ObjectSearchFilter
        search=""
        onSearchChange={handler}
        filter="all"
        onFilterChange={() => {}}
      />,
    )
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'contact' } })
    expect(handler).toHaveBeenCalledWith('contact')
  })

  it('shows a clear button only when search is non-empty', () => {
    const { rerender } = render(
      <ObjectSearchFilter
        search=""
        onSearchChange={() => {}}
        filter="all"
        onFilterChange={() => {}}
      />,
    )
    expect(screen.queryByLabelText('Effacer la recherche')).not.toBeInTheDocument()

    rerender(
      <ObjectSearchFilter
        search="xyz"
        onSearchChange={() => {}}
        filter="all"
        onFilterChange={() => {}}
      />,
    )
    expect(screen.getByLabelText('Effacer la recherche')).toBeInTheDocument()
  })

  it('calls onSearchChange with empty string when clear button clicked', () => {
    const handler = vi.fn()
    render(
      <ObjectSearchFilter
        search="lead"
        onSearchChange={handler}
        filter="all"
        onFilterChange={() => {}}
      />,
    )
    fireEvent.click(screen.getByLabelText('Effacer la recherche'))
    expect(handler).toHaveBeenCalledWith('')
  })

  it('renders all five category filter pills', () => {
    render(
      <ObjectSearchFilter
        search=""
        onSearchChange={() => {}}
        filter="all"
        onFilterChange={() => {}}
      />,
    )
    expect(screen.getByText('Tous')).toBeInTheDocument()
    expect(screen.getByText('Liés')).toBeInTheDocument()
    expect(screen.getByText('Non liés')).toBeInTheDocument()
    expect(screen.getByText('Standard')).toBeInTheDocument()
    expect(screen.getByText('Custom')).toBeInTheDocument()
  })

  it('calls onFilterChange with the clicked filter value', () => {
    const handler = vi.fn()
    render(
      <ObjectSearchFilter
        search=""
        onSearchChange={() => {}}
        filter="all"
        onFilterChange={handler}
      />,
    )
    fireEvent.click(screen.getByText('Liés'))
    expect(handler).toHaveBeenCalledWith('mapped')

    fireEvent.click(screen.getByText('Custom'))
    expect(handler).toHaveBeenCalledWith('custom')
  })

  it('highlights the active filter pill', () => {
    render(
      <ObjectSearchFilter
        search=""
        onSearchChange={() => {}}
        filter="unmapped"
        onFilterChange={() => {}}
      />,
    )
    const unmappedBtn = screen.getByText('Non liés')
    expect(unmappedBtn.className).toContain('bg-primary')

    // 'Tous' must NOT be highlighted
    const allBtn = screen.getByText('Tous')
    expect(allBtn.className).not.toContain('bg-primary')
  })
})
