import { render, act } from '@testing-library/react';

import VirtualTable from '../VirtualTable';
import { DataSource } from '../helpers/types';
import { layout } from './setup';

const TOTAL = 100;

const renderer = (item: number | undefined) => (
    <span>{item === undefined ? 'loading' : `item ${item}`}</span>
);

async function advance(ms: number) {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
    });
}

async function settle() {
    for (let i = 0; i < 5; i += 1) {
        await advance(60_000);
    }
}

// The hidden element SizeChecker measures, which is where a stale probe shows.
function probe(container: HTMLElement) {
    return container.querySelector('.vt-probe')?.textContent ?? '';
}

describe('results that arrive after a reset', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('does not let a retry scheduled before a resize fetch the old page size', async () => {
        // Page size is derived from the viewport, so a resize changes it. A
        // retry left over from before the resize would fetch the old one.
        const counts: Array<number> = [];
        const source: DataSource<number> = {
            fetch: (index, count) => {
                if (count === 1) {
                    return Promise.resolve({ from: index, items: [index], totalCount: TOTAL });
                }
                counts.push(count);
                return Promise.reject(new Error('down'));
            },
        };

        render(<VirtualTable<number> fetcher={source} renderer={renderer} />);
        await advance(0);

        const before = 2 * Math.floor(layout.viewport / layout.row);
        expect(counts).toEqual([before, before]);

        // Resize before any retry timer comes due.
        layout.viewport = 200;
        await act(async () => {
            window.dispatchEvent(new Event('resize'));
        });
        const at_resize = counts.length;
        await settle();

        const after = 2 * Math.floor(layout.viewport / layout.row);
        expect(after).not.toBe(before);
        expect(counts.slice(at_resize)).not.toContain(before);
    });

    it('does not measure a row from a fetcher that has been replaced', async () => {
        // Both probes are held open so the replaced fetcher can be made to
        // resolve last, which is the order that used to win.
        const held: Array<() => void> = [];
        const source = (value: number): DataSource<number> => ({
            fetch: (index, count) => {
                if (count === 1) {
                    return new Promise((resolve) => {
                        held.push(() =>
                            resolve({ from: index, items: [value], totalCount: TOTAL }),
                        );
                    });
                }
                return Promise.resolve({
                    from: index,
                    items: [...Array(count).keys()].map((i) => i + index),
                    totalCount: TOTAL,
                });
            },
        });

        const stale = source(999);
        const fresh = source(0);

        const { container, rerender } = render(
            <VirtualTable<number> fetcher={stale} renderer={renderer} />,
        );
        rerender(<VirtualTable<number> fetcher={fresh} renderer={renderer} />);

        expect(held.length).toBe(2);
        // Replacement first, replaced second: the late one must not win.
        held[1]();
        held[0]();
        await settle();

        expect(probe(container)).toBe('item 0');
    });

    it('retries a probe that fails, rather than leaving the table blank', async () => {
        let probes = 0;
        const source: DataSource<number> = {
            fetch: (index, count) => {
                if (count === 1) {
                    probes += 1;
                    // Fails once, so nothing can be measured on the first try.
                    if (probes === 1) {
                        return Promise.reject(new Error('down'));
                    }
                    return Promise.resolve({ from: index, items: [index], totalCount: TOTAL });
                }
                return Promise.resolve({
                    from: index,
                    items: [...Array(count).keys()].map((i) => i + index),
                    totalCount: TOTAL,
                });
            },
        };

        const errors: Array<number> = [];
        const { container } = render(
            <VirtualTable<number>
                fetcher={source}
                renderer={renderer}
                onError={(page) => errors.push(page)}
            />,
        );
        await settle();

        expect(probes).toBeGreaterThan(1);
        expect(errors).toContain(0);
        expect(container.querySelector('.vt-list')?.textContent).toContain('item 0');
    });
});
