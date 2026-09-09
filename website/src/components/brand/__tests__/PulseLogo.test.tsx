import { render, screen } from '@testing-library/react'

import { PulseLogo, PulseMark } from '@/components/brand/PulseLogo'

describe('Pulse identity', () => {
  it('renders the two Transform Aperture paths at icon size', () => {
    const { container } = render(<PulseMark size={16} />)
    const svg = container.querySelector('svg')
    const paths = container.querySelectorAll('path')

    expect(svg).toHaveAttribute('viewBox', '0 0 32 32')
    expect(svg).toHaveAttribute('width', '16')
    expect(svg).toHaveAttribute('height', '16')
    expect(paths).toHaveLength(2)
    expect(paths[0]).toHaveAttribute('d', 'M5 5H11L14 10L11 14V18L14 22L11 27H5Z')
    expect(paths[1]).toHaveAttribute(
      'd',
      'M27 8a3 3 0 0 0-3-3H21L18 10L21 14V18L18 22L21 27H24a3 3 0 0 0 3-3Z',
    )
    expect(paths[0]).toHaveAttribute('fill', 'currentColor')
    expect(paths[1]).toHaveAttribute('fill', 'currentColor')
  })

  it('gives the wordmark one accessible brand name', () => {
    render(<PulseLogo />)
    expect(screen.getByRole('img', { name: 'Pulse' })).toBeInTheDocument()
    expect(screen.getByText('Pulse')).toBeInTheDocument()
  })

  it('keeps the decorative navigation mark out of the accessibility tree', () => {
    const { container } = render(<PulseMark />)
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelector('svg')).toHaveAttribute('focusable', 'false')
  })
})
