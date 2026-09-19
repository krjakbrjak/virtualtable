import { render, act, fireEvent } from '@testing-library/react';

import VirtualTable from '../VirtualTable';
import { Cache } from '../helpers/cache';
import { reducer, LOADED } from '../helpers/reducer';
import { State, get_initial_state } from '../helpers/state';
import { Change, DataSource, Result, Status } from '../helpers/types';
import { layout } from './setup';
import { Gate, renderer, scroll, selected, settle, spacer } from './harness';

// A live source over a real array: mutations bump the version and are
// announced synchronously. Page fetches pass `gate`, the probe (count 1)
// passes `probe`. A `replica` answers fetches from a copy that has not seen
// the changes announced since it was taken.
class Live implements DataSource<number> {
    items: number[];

    version = 0;

    withVersion = true;

    replica?: { items: number[]; version: number };

    gate = new Gate();

    probe = new Gate();

    fetches = 0;

    probes = 0;

    listeners = new Set<(change: Change) => void>();

    constructor(items: number[]) {
        this.items = items;
    }

    subscribe = (listener: (change: Change) => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    fetch(index: number, count: number): Promise<Result<number>> {
        const snapshot = (): Result<number> => {
            const { items, version } = this.replica ?? this;
            return {
                from: index,
                items: items.slice(index, index + count),
                totalCount: items.length,
                ...(this.withVersion ? { version } : {}),
            };
        };
        if (count === 1) {
            this.probes += 1;
            return this.probe.pass(snapshot);
        }
        this.fetches += 1;
        return this.gate.pass(snapshot);
    }

    emit(change: Change) {
        this.listeners.forEach((listener) => listener(change));
    }

    insert(index: number, values: number[]) {
        this.items.splice(index, 0, ...values);
        this.version += 1;
        this.emit({ kind: 'inserted', index, count: values.length, version: this.version });
    }

    remove(index: number, count: number) {
        this.items.splice(index, count);
        this.version += 1;
        this.emit({ kind: 'removed', index, count, version: this.version });
    }

    fallBehind() {
        this.replica = { items: [...this.items], version: this.version };
    }

    catchUp() {
        this.replica = undefined;
    }
}

describe('live source', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('append grows the collection without any refetch', async () => {
        const source = new Live([...Array(25).keys()]);
        const { container } = render(<VirtualTable<number> fetcher={source} renderer={renderer} />);
        await settle();

        const before = source.fetches;
        act(() => {
            source.insert(25, [25, 26, 27]);
        });

        // The spacer follows the event alone; no cached page overlaps the
        // insertion, so nothing is refetched.
        expect(spacer(container)).toBe(`${28 * layout.row}px`);
        await settle();
        expect(source.fetches).toBe(before);
    });

    it('insert above shifts the selection and anchors the scroll', async () => {
        const source = new Live([...Array(100).keys()]);
        const reported: Array<[number, number]> = [];
        const { container } = render(
            <VirtualTable<number>
                fetcher={source}
                renderer={renderer}
                onSelected={(index, item) => reported.push([index, item])}
            />,
        );
        await settle();

        const scroller = container.querySelector('.vt-viewport') as HTMLElement;
        scroll(scroller, 50);
        await settle();
        fireEvent.click(container.querySelectorAll('.vt-row')[2]); // index 52
        await settle();

        act(() => {
            source.insert(
                0,
                [...Array(10).keys()].map((i) => i + 1000),
            );
        });
        await settle();

        // Ten rows above: the window follows, the selection still points at
        // the same item, and its new index is reported from the fresh page
        // rather than from the rows cached before the insert.
        expect(scroller.scrollTop).toBe(layout.row * 60);
        expect(selected(container).map((row) => row.textContent)).toEqual(['item 52']);
        expect(reported).toEqual([
            [52, 52],
            [62, 52],
        ]);
    });

    it('remove shifts a selection after the range and clears one inside it', async () => {
        const source = new Live([...Array(100).keys()]);
        const { container } = render(<VirtualTable<number> fetcher={source} renderer={renderer} />);
        await settle();

        const scroller = container.querySelector('.vt-viewport') as HTMLElement;
        scroll(scroller, 50);
        await settle();
        fireEvent.click(container.querySelectorAll('.vt-row')[2]); // index 52

        act(() => {
            source.remove(0, 10);
        });
        await settle();
        expect(scroller.scrollTop).toBe(layout.row * 40);
        expect(selected(container).map((row) => row.textContent)).toEqual(['item 52']);

        act(() => {
            source.remove(40, 10); // the selection, now at 42, is inside
        });
        await settle();
        expect(selected(container)).toEqual([]);
    });

    it('a result computed before a change cannot regress the count', async () => {
        const source = new Live([...Array(100).keys()]);
        const { container } = render(<VirtualTable<number> fetcher={source} renderer={renderer} />);
        await settle();

        const scroller = container.querySelector('.vt-viewport') as HTMLElement;
        source.gate.close();
        scroll(scroller, 50); // snapshots taken now: version 0, count 100
        act(() => {
            source.insert(
                100,
                [...Array(10).keys()].map((i) => i + 100),
            );
        });
        expect(spacer(container)).toBe(`${110 * layout.row}px`);

        await act(async () => {
            source.gate.release(); // the old snapshots arrive after the event
        });
        await settle();

        expect(spacer(container)).toBe(`${110 * layout.row}px`);
        expect(container.querySelector('.vt-list')?.textContent).toContain('item 50');
    });

    it('a result computed before a change cannot seed the count either', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const source = new Live([...Array(100).keys()]);
        source.gate.close();
        const { container } = render(<VirtualTable<number> fetcher={source} renderer={renderer} />);
        await settle(); // measured; the first page is held at version 0

        act(() => {
            source.insert(100, [100, 101, 102, 103, 104]);
        });
        await act(async () => {
            source.gate.release(); // outdated, and nothing is known yet
        });
        act(() => {
            source.insert(105, [105, 106, 107, 108, 109]);
        });
        // The count is still unknown, not five.
        expect(spacer(container)).toBe('0px');

        await settle(); // the retry fetches a trusted result
        expect(spacer(container)).toBe(`${110 * layout.row}px`);
        expect(warn).not.toHaveBeenCalled();
        warn.mockRestore();
    });

    it('a replica behind the change feed is retried on the backoff schedule', async () => {
        const source = new Live([...Array(100).keys()]);
        const { container } = render(<VirtualTable<number> fetcher={source} renderer={renderer} />);
        await settle();

        const scroller = container.querySelector('.vt-viewport') as HTMLElement;
        scroll(scroller, 50);
        await settle();

        // Every fetch answers from a copy that has not seen the insert, so
        // every result is outdated until the replica catches up.
        source.fallBehind();
        const before = source.fetches;
        act(() => {
            source.insert(0, [1000]);
        });
        await settle();

        // The three pages around the window are refetched on the growing
        // delay, not in a loop, and keep rendering what they had.
        const attempts = source.fetches - before;
        expect(attempts).toBeGreaterThan(3);
        expect(attempts).toBeLessThan(24);
        expect(spacer(container)).toBe(`${101 * layout.row}px`);
        expect(container.querySelector('.vt-row')?.textContent).toBe('item 51');

        source.catchUp();
        await settle();
        expect(container.querySelector('.vt-row')?.textContent).toBe('item 50');
    });

    it('drops a change that a trusted result already reflected', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const source = new Live([...Array(100).keys()]);
        const { container } = render(<VirtualTable<number> fetcher={source} renderer={renderer} />);
        await settle();

        // The source mutates without announcing yet; a fresh fetch observes it.
        source.items.push(...[...Array(10).keys()].map((i) => i + 100));
        source.version += 1;
        const scroller = container.querySelector('.vt-viewport') as HTMLElement;
        scroll(scroller, 50);
        await settle();
        expect(spacer(container)).toBe(`${110 * layout.row}px`);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('without announcing'));

        // The event arrives late: already applied through the result.
        act(() => {
            source.emit({ kind: 'inserted', index: 100, count: 10, version: source.version });
        });
        expect(spacer(container)).toBe(`${110 * layout.row}px`);
        warn.mockRestore();
    });

    it('an empty source renders once a change grows it', async () => {
        const source = new Live([]);
        const { container } = render(<VirtualTable<number> fetcher={source} renderer={renderer} />);
        await settle();
        expect(container.querySelectorAll('.vt-row').length).toBe(0);

        act(() => {
            source.insert(0, [0, 1, 2]);
        });
        await settle();
        expect(container.querySelector('.vt-list')?.textContent).toContain('item 0');
    });

    it('a change during the probe does not restart it', async () => {
        const source = new Live([...Array(100).keys()]);
        source.probe.close();
        const { container } = render(<VirtualTable<number> fetcher={source} renderer={renderer} />);
        await settle();

        act(() => {
            source.insert(100, [100]);
        });
        await act(async () => {
            source.probe.release();
        });
        await settle();

        expect(source.probes).toBe(1);
        expect(container.querySelector('.vt-list')?.textContent).toContain('item 0');
    });

    it('a live source without versions is warned about and never trusted', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const source = new Live([...Array(50).keys()]);
        source.withVersion = false;
        const { container } = render(<VirtualTable<number> fetcher={source} renderer={renderer} />);
        await settle();

        expect(warn).toHaveBeenCalledWith(expect.stringContaining('without a version'));
        expect(container.querySelectorAll('.vt-row').length).toBe(0);
        warn.mockRestore();
    });
});

describe('reducer folding of an outdated live result', () => {
    const page4 = { 4: [...Array(10).keys()].map((i) => i + 40) };
    const base = (stale: Cache<number>['stale'] = {}): State<number> => ({
        ...get_initial_state<number>(),
        status: Status.Loaded,
        itemHeight: 20,
        applied: 5,
        cache: new Cache(100, 10, page4, {}, stale),
    });
    const outdated = {
        live: true,
        version: 3,
        data: { totalCount: 100, pageSize: 10, pages: { 4: [...Array(10).keys()] } },
    };

    it('leaves a page a trusted result refreshed meanwhile alone', () => {
        const next = reducer(base(), { type: LOADED, payload: outdated });
        expect(next.cache.pages[4]).toEqual(page4[4]);
        expect(next.cache.stale[4]).toBeUndefined();
        expect(next.cache.retries[4]).toBeUndefined();
    });

    it('keeps an outdated page as stale content and counts the attempt', () => {
        const next = reducer(base({ 4: Status.Loading }), { type: LOADED, payload: outdated });
        expect(next.cache.pages[4]).toEqual([...Array(10).keys()]);
        expect(next.cache.stale[4]).toBe(Status.None);
        expect(next.cache.retries[4]).toBe(1);
        expect(next.applied).toBe(5);
    });
});
