import { cleanup } from '@testing-library/react';

/**
 * jsdom performs no layout, so every element reports a clientHeight of 0 and
 * the component's load path, which is gated on a non-zero row height, would
 * never run. Heights are faked from the two elements the component measures:
 * the hidden probe rendered by SizeChecker, and the scroll viewport.
 *
 * Mutable so a test can resize either one and then report it as a resize.
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

/**
 * jsdom implements no ResizeObserver, and it is what the component measures
 * through. The stub records what is being watched so that a test can report a
 * resize on a specific element, which is the only way to reach the paths that
 * run when a container is shown or resized.
 */
const observed = new Map<Element, Set<() => void>>();

class ResizeObserverStub {
    private readonly targets = new Set<Element>();

    private readonly run: () => void;

    constructor(callback: ResizeObserverCallback) {
        this.run = () => callback([], this as unknown as ResizeObserver);
    }

    observe(target: Element) {
        this.targets.add(target);
        const callbacks = observed.get(target) ?? new Set<() => void>();
        callbacks.add(this.run);
        observed.set(target, callbacks);
        // A real observer reports the element's current size as soon as it is
        // told to watch it, which is where the first measurement comes from.
        this.run();
    }

    unobserve(target: Element) {
        this.targets.delete(target);
        observed.get(target)?.delete(this.run);
    }

    disconnect() {
        for (const target of this.targets) {
            observed.get(target)?.delete(this.run);
        }
        this.targets.clear();
    }
}

globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

/**
 * Reports a resize on an element that is being observed. Change `layout` first:
 * the observer reads the height back off the element.
 */
export function resize(target: Element | null | undefined) {
    if (!target) {
        throw new Error('no element to resize');
    }
    observed.get(target)?.forEach((run) => run());
}

afterEach(() => {
    cleanup();
    observed.clear();
    Object.assign(layout, DEFAULTS);
});
