import { render, act, fireEvent } from '@testing-library/react';

import VirtualTable from '../VirtualTable';
import { Cache } from '../helpers/cache';
import { reducer, LOADED } from '../helpers/reducer';
import { State, get_initial_state } from '../helpers/state';
import { DataSource, Result, Status } from '../helpers/types';
import { layout } from './setup';
import { Gate, renderer, scroll, selected, settle } from './harness';

// Item values are index + offset, so a test can change `offset` and tell a
// refetched row from a cached one. Page fetches can be held open or failed;
// the probe (count 1) always answers so the table can measure. `reported`
// stands in for a count that overstates the rows actually held.
class Source implements DataSource<number> {
    total: number;

    reported?: number;

    offset = 0;

    fail = false;

    gate = new Gate();

    fetches: number[] = [];

    constructor(total: number) {
        this.total = total;
    }

    fetch(index: number, count: number): Promise<Result<number>> {
        const result = (): Result<number> => ({
            from: index,
            items: [...Array(Math.max(0, Math.min(count, this.total - index))).keys()].map(
                (i) => i + index + this.offset,
            ),
            totalCount: this.reported ?? this.total,
        });
        if (count === 1) {
            return Promise.resolve(result());
        }
        this.fetches.push(index);
        if (this.fail) {
            return Promise.reject(new Error('down'));
        }
        return this.gate.pass(result);
    }
}

describe('a total count learned from a fetch', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('grows in place: scroll and selection stay, the spacer follows', async () => {
        const source = new Source(100);
        const { container } = render(<VirtualTable<number> fetcher={source} renderer={renderer} />);
        await settle();

        const scroller = container.querySelector('.vt-viewport') as HTMLElement;
        fireEvent.click(container.querySelectorAll('.vt-row')[3]);

        source.total = 130;
        // Row 60 needs a page nobody has fetched, which is what learns the
        // new total.
        scroll(scroller, 60);
        await settle();

        expect(scroller.scrollTop).toBe(layout.row * 60);
        const spacer = container.querySelector('.vt-spacer') as HTMLElement;
        expect(spacer.style.height).toBe(`${130 * layout.row}px`);

        // The selection survived; its page was refetched when scrolled back.
        scroll(scroller, 0);
        await settle();
        expect(selected(container).map((row) => row.textContent)).toEqual(['item 3']);
    });

    it('shrink clamps: a selection past the new end is cleared', async () => {
        const source = new Source(100);
        const { container } = render(<VirtualTable<number> fetcher={source} renderer={renderer} />);
        await settle();

        const scroller = container.querySelector('.vt-viewport') as HTMLElement;
        scroll(scroller, 90);
        await settle();
        fireEvent.click(container.querySelectorAll('.vt-row')[5]);
        expect(selected(container).map((row) => row.textContent)).toEqual(['item 95']);

        source.total = 50;
        scroll(scroller, 20);
        await settle();

        const spacer = container.querySelector('.vt-spacer') as HTMLElement;
        expect(spacer.style.height).toBe(`${50 * layout.row}px`);
        expect(selected(container)).toEqual([]);
    });

    it('keeps rendering a stale page while its fresh copy is fetched', async () => {
        const source = new Source(100);
        const { container } = render(<VirtualTable<number> fetcher={source} renderer={renderer} />);
        await settle();

        const scroller = container.querySelector('.vt-viewport') as HTMLElement;
        source.total = 101;
        scroll(scroller, 30);
        await settle();

        // The content changes and the refetch is held open: the stale rows
        // must stay up rather than turn into placeholders.
        source.offset = 1000;
        source.gate.close();
        scroll(scroller, 0);
        await settle();

        const rows = container.querySelector('.vt-list')?.textContent ?? '';
        expect(rows).toContain('item 0');
        expect(rows).not.toContain('item 1000');

        await act(async () => {
            source.gate.release();
        });
        await settle();
        expect(container.querySelector('.vt-list')?.textContent).toContain('item 1000');
    });

    it('keeps rendering a stale page whose refetch fails, and retries it', async () => {
        const source = new Source(100);
        const { container } = render(<VirtualTable<number> fetcher={source} renderer={renderer} />);
        await settle();

        const scroller = container.querySelector('.vt-viewport') as HTMLElement;
        source.total = 110;
        scroll(scroller, 30);
        await settle();

        source.offset = 1000;
        source.fail = true;
        scroll(scroller, 0);
        await settle();
        expect(container.querySelector('.vt-list')?.textContent).toContain('item 0');

        // The source recovers; the retry timers pick the page up again.
        source.fail = false;
        await settle();
        expect(container.querySelector('.vt-list')?.textContent).toContain('item 1000');
    });

    it('follows the clamp when the total shrinks under the scroll position', async () => {
        const source = new Source(1000);
        const { container } = render(<VirtualTable<number> fetcher={source} renderer={renderer} />);
        await settle();

        const scroller = container.querySelector('.vt-viewport') as HTMLElement;
        scroll(scroller, 500);
        await settle();

        source.total = 100;
        // Fetching past the new end is what learns the shrink; the window
        // must then follow the clamp instead of pointing past the end.
        scroll(scroller, 900);
        await settle();

        const spacer = container.querySelector('.vt-spacer') as HTMLElement;
        expect(spacer.style.height).toBe(`${100 * layout.row}px`);
        expect(scroller.scrollTop).toBe(100 * layout.row - layout.viewport);
        expect(container.querySelector('.vt-list')?.textContent).toContain('item 99');
    });

    it('retries an inconsistent page on the backoff schedule, not in a loop', async () => {
        const source = new Source(100);
        source.reported = 105;
        const { container } = render(<VirtualTable<number> fetcher={source} renderer={renderer} />);
        await settle();

        // The last page can never fill the span the count promises.
        const scroller = container.querySelector('.vt-viewport') as HTMLElement;
        scroll(scroller, 95);
        await settle();

        const last = source.fetches.filter((index) => index === 100);
        expect(last.length).toBeGreaterThan(1);
        // Doubling from one second reaches the ceiling within settle's 50 s.
        expect(last.length).toBeLessThan(8);
        expect(container.querySelector('.vt-list')?.textContent).toContain('item 99');
    });
});

describe('reducer folding of a changed total', () => {
    const page4 = { 4: [...Array(10).keys()].map((i) => i + 40) };
    const base = (stale: Cache<number>['stale'] = {}): State<number> => ({
        ...get_initial_state<number>(),
        status: Status.Loaded,
        scrollTop: 500,
        itemHeight: 20,
        cache: new Cache(100, 10, page4, {}, stale),
    });

    it('keeps a refetch already under way as loading', () => {
        const next = reducer(base({ 4: Status.Loading }), {
            type: LOADED,
            payload: {
                data: { totalCount: 250, pageSize: 10, pages: { 0: [...Array(10).keys()] } },
            },
        });
        expect(next.cache.stale[4]).toBe(Status.Loading);
        expect(next.cache.stale[0]).toBeUndefined();
    });

    it('keeps an underfilled page stale so it heals', () => {
        // Page 10 spans 5 rows under the new total but carries 3: an
        // inconsistent snapshot.
        const next = reducer(base(), {
            type: LOADED,
            payload: { data: { totalCount: 105, pageSize: 10, pages: { 10: [100, 101, 102] } } },
        });
        expect(next.cache.totalCount).toBe(105);
        expect(next.cache.stale[10]).toBe(Status.None);
        // Counted as an attempt so the refetch backs off.
        expect(next.cache.retries[10]).toBe(1);
    });
});
