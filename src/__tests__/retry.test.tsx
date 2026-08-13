import { render, act } from '@testing-library/react';

import VirtualTable from '../VirtualTable';
import { DataSource, Result } from '../helpers/types';

const TOTAL = 100;

/**
 * SizeChecker probes with a count of 1 to measure a row, and the load effect
 * asks for whole pages. Keeping the two separable lets a test fail page loads
 * while still letting the component measure itself, which it must do before it
 * loads anything at all.
 */
class Source implements DataSource<number> {
    probes = 0;
    pages = 0;
    fail = true;

    fetch(index: number, count: number): Promise<Result<number>> {
        if (count === 1) {
            this.probes += 1;
            return Promise.resolve({ from: index, items: [index], totalCount: TOTAL });
        }

        this.pages += 1;
        if (this.fail) {
            return Promise.reject(new Error('down'));
        }
        return Promise.resolve({
            from: index,
            items: [...Array(count).keys()].map((i) => i + index),
            totalCount: TOTAL,
        });
    }
}

// The load effect asks for the page around the offset plus its neighbours,
// which at scroll position 0 is pages 0 and 1.
const PAGES_IN_VIEW = 2;

function renderTable(source: DataSource<number>, onError?: (page: number, e: unknown) => void) {
    return render(
        <VirtualTable<number>
            fetcher={source}
            renderer={(item) => <span>{item === undefined ? 'loading' : `item ${item}`}</span>}
            onError={onError}
        />,
    );
}

// Lets every pending promise settle, then runs any timer due within `ms`.
async function advance(ms: number) {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
    });
}

/**
 * Runs the retry schedule on by several attempts. Each retry is scheduled by
 * the effect that reacts to the previous failure, and effects flush when act()
 * exits, so a single long advance only moves the chain on by one step however
 * far it jumps. Stepping repeatedly is what lets the chain play out. Each step
 * clears the ceiling, so one step is one attempt.
 */
const STEPS = 8;

async function settle() {
    for (let i = 0; i < STEPS; i += 1) {
        await advance(60_000);
    }
}

// The rows live in the table; SizeChecker's hidden probe renders a row too,
// and it is outside the table, so scoping here keeps it out of assertions.
function rows(container: HTMLElement) {
    return container.querySelector('.vt-list')?.textContent ?? '';
}

describe('page load failures', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('keeps retrying a failing page rather than giving up on it', async () => {
        const source = new Source();
        renderTable(source);

        await advance(0);
        expect(source.pages).toBe(PAGES_IN_VIEW);

        await settle();
        const so_far = source.pages;

        // One attempt per page per step, and never a burst: the load effect
        // runs on every state update, so a missing delay would show up here as
        // a count far beyond the number of steps taken.
        expect(so_far).toBe(PAGES_IN_VIEW * (STEPS + 1));

        // Still going. There is no attempt at which it stops.
        await settle();
        expect(source.pages).toBe(so_far + PAGES_IN_VIEW * STEPS);
    });

    it('reports every failure through onError', async () => {
        const source = new Source();
        const seen: Array<number> = [];
        renderTable(source, (page) => seen.push(page));

        await settle();

        expect(seen.length).toBe(source.pages);
        expect(new Set(seen)).toEqual(new Set([0, 1]));
    });

    it('recovers when the source comes back', async () => {
        const source = new Source();
        const { container } = renderTable(source);

        await advance(0);
        // Nothing is rendered while the first pages are failing: the total
        // count is only learned from a successful fetch, so the component does
        // not yet know how many rows to stand in for.
        expect(rows(container)).toBe('');

        // Fail for far longer than the old attempt cap allowed, so recovery
        // here means there is no point at which the page goes dead.
        await settle();
        expect(source.pages).toBeGreaterThan(PAGES_IN_VIEW * 3);
        expect(rows(container)).toBe('');

        source.fail = false;
        await settle();

        expect(rows(container)).toContain('item 0');
    });

    it('settles on an empty source instead of waiting to measure a row', async () => {
        let calls = 0;
        const empty: DataSource<number> = {
            fetch: (index) => {
                calls += 1;
                return Promise.resolve({ from: index, items: [], totalCount: 0 });
            },
        };

        const { container } = renderTable(empty);
        await settle();

        // Nothing to measure means nothing to render, and no page can be
        // requested, so the probe is the only call that is ever made.
        expect(container.querySelector('.vt-list')?.textContent).toBe('');
        expect(calls).toBe(1);
    });

    it('does not keep fetching after unmount', async () => {
        const source = new Source();
        const { unmount } = renderTable(source);

        await advance(0);
        const before = source.pages;

        unmount();
        await advance(60_000);

        expect(source.pages).toBe(before);
    });
});
