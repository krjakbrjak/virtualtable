import { cleanup } from '@testing-library/react';

/**
 * jsdom performs no layout, so every element reports a clientHeight of 0 and
 * the component's load path, which is gated on a non-zero row height, would
 * never run. Heights are faked from the two elements the component measures:
 * the hidden probe rendered by SizeChecker, and the scroll viewport.
 *
 * Mutable so a test can resize the viewport and then fire a resize event.
 */
export const layout = {
    row: 20,
    viewport: 100,
};

const DEFAULTS = { ...layout };

Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get(): number {
        // Only two elements are ever measured: SizeChecker's probe and the
        // scroll viewport. Everything else can share the viewport height
        // because nothing reads it.
        if (this.classList && this.classList.contains('vt-probe')) {
            return layout.row;
        }
        return layout.viewport;
    },
});

afterEach(() => {
    cleanup();
    Object.assign(layout, DEFAULTS);
});
