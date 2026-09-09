import '@testing-library/jest-dom/vitest'

class ResizeObserverStub implements ResizeObserver {
  readonly observed = new Set<Element>()

  observe(target: Element): void {
    this.observed.add(target)
  }

  unobserve(target: Element): void {
    this.observed.delete(target)
  }

  disconnect(): void {
    this.observed.clear()
  }
}

globalThis.ResizeObserver = ResizeObserverStub

// jsdom has no layout engine; CodeMirror still measures its text ranges.
Range.prototype.getClientRects = () => Object.assign([], { item: () => null })
Range.prototype.getBoundingClientRect = () => new DOMRect()

// cmdk keeps the keyboard-selected command visible; jsdom does not implement scrolling.
HTMLElement.prototype.scrollIntoView = () => undefined
Object.defineProperty(globalThis, 'matchMedia', {
  configurable: true,
  value: (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
})
