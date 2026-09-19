import { act, fireEvent } from '@testing-library/react';

import { layout } from './setup';

export const renderer = (item: number | undefined) => (
    <span>{item === undefined ? 'loading' : `item ${item}`}</span>
);

/** Lets every pending promise settle and runs the retry timers due meanwhile. */
export async function settle() {
    for (let i = 0; i < 5; i += 1) {
        await act(async () => {
            await vi.advanceTimersByTimeAsync(10_000);
        });
    }
}

export function scroll(scroller: HTMLElement, row: number) {
    scroller.scrollTop = layout.row * row;
    fireEvent.scroll(scroller);
}

export function selected(container: HTMLElement) {
    return [...container.querySelectorAll('.vt-row')].filter(
        (row) => row.getAttribute('aria-selected') === 'true',
    );
}

/**
 * Holds fetch results back until released. The result is computed at call
 * time, so a held one models a response computed early and delivered late.
 */
export class Gate {
    private open = true;

    private held: Array<() => void> = [];

    close() {
        this.open = false;
    }

    pass<T>(make: () => T): Promise<T> {
        const value = make();
        if (this.open) {
            return Promise.resolve(value);
        }
        return new Promise((resolve) => {
            this.held.push(() => resolve(value));
        });
    }

    release() {
        this.open = true;
        const held = this.held;
        this.held = [];
        held.forEach((resolve) => resolve());
    }
}
