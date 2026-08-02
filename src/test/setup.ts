import '@testing-library/jest-dom/vitest'

// jsdom doesn't implement the Pointer Events capture methods that some UI
// libraries (e.g. Sonner's swipe-to-dismiss gesture) call unconditionally.
// Polyfill them as no-ops so interacting with those elements in tests
// doesn't throw.
if (typeof Element !== 'undefined') {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {}
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {}
  }
}
