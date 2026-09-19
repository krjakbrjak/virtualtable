import { fetch_items } from '../helpers/collections';
import { reducer, LOAD, LOADED } from '../helpers/reducer';
import { Cache } from '../helpers/cache';
import { State, get_initial_state } from '../helpers/state';
import { retry_delay } from '../helpers/retry';
import { DataSource, Result, Status, get_page_status } from '../helpers/types';

// A source that fails on demand, so a transient outage can be simulated.
class Flaky implements DataSource<number> {
    down = false;

    fetch(index: number, count: number): Promise<Result<number>> {
        if (this.down) {
            return Promise.reject(new Error('boom'));
        }
        return Promise.resolve({
            from: index,
            items: [...Array(count).keys()].map((i) => i + index),
            totalCount: 100,
        });
    }
}

// A healthy state: one page loaded, scrolled down, row 42 selected.
function healthy(): State<number> {
    return {
        ...get_initial_state<number>(),
        status: Status.Loaded,
        scrollTop: 500,
        selected: 42,
        itemHeight: 20,
        cache: new Cache(100, 10, { 4: [40, 41, 42, 43, 44] }),
    };
}

describe('retry schedule', () => {
    it('doubles the delay and then holds at a ceiling', () => {
        // Retries are unbounded in number, so the ceiling is the only thing
        // keeping a dead source from being a burden.
        const delays = [1, 2, 3, 4, 5, 6, 7, 20].map(retry_delay);

        expect(delays.slice(0, 5)).toEqual([1000, 2000, 4000, 8000, 16_000]);
        expect(delays.slice(5)).toEqual([30_000, 30_000, 30_000]);

        // Never zero: a delay of 0 would make the load effect a request loop.
        expect(retry_delay(0)).toBeGreaterThan(0);
    });
});

describe('transient fetch failure', () => {
    it('is reported per page rather than swallowed', async () => {
        const fetcher = new Flaky();
        fetcher.down = true;

        const { data, errors } = await fetch_items(0, 1, 10, fetcher);

        expect(data.pages[0]).toBe(Status.Error);
        expect(errors[0]).toBeInstanceOf(Error);
    });

    it('survives a fetcher that rejects with something other than an Error', async () => {
        const fetcher: DataSource<number> = {
            fetch: () => Promise.reject('just a string'),
        };

        const { data, errors } = await fetch_items(0, 1, 10, fetcher);

        // The old instanceof filter let this through as if it were a page.
        expect(data.pages[0]).toBe(Status.Error);
        expect(errors[0]).toBe('just a string');
    });

    it('keeps scroll position, selection and the known total count', () => {
        const failed = { totalCount: 0, pageSize: 10, pages: { 5: Status.Error as const } };

        const next = reducer(healthy(), { type: LOADED, payload: { data: failed } });

        expect(next.scrollTop).toBe(500);
        expect(next.selected).toBe(42);
        expect(next.cache.totalCount).toBe(100);
        expect(next.cache.retries[5]).toBe(1);
    });

    it('leaves the failed page refetchable', () => {
        // Second consecutive failure: totalCount is already 0, which used to
        // send LOADED down the merge branch and strand the page at Loading.
        let state: State<number> = {
            ...get_initial_state<number>(),
            status: Status.Loaded,
            itemHeight: 20,
            cache: new Cache(0, 10, {}),
        };

        state = reducer(state, { type: LOAD, payload: { pages: [0] } });
        state = reducer(state, {
            type: LOADED,
            payload: { data: { totalCount: 0, pageSize: 10, pages: { 0: Status.Error } } },
        });

        expect(state.cache.pages[0]).not.toBe(Status.Loading);
        expect(get_page_status(state.cache, 0)).toBe(Status.Error);
        expect(state.cache.retries[0]).toBe(1);
    });

    it('forgets the failures of a page once it loads', () => {
        let state = healthy();
        state.cache = new Cache(100, 10, state.cache.pages, { 4: 2 });

        state = reducer(state, {
            type: LOADED,
            payload: {
                data: {
                    totalCount: 100,
                    pageSize: 10,
                    pages: { 4: [...Array(10).keys()].map((i) => i + 40) },
                },
            },
        });

        expect(state.cache.retries[4]).toBeUndefined();
    });

    it('folds a changed total in without resetting', () => {
        const grown = { totalCount: 250, pageSize: 10, pages: { 0: [...Array(10).keys()] } };

        const next = reducer(healthy(), { type: LOADED, payload: { data: grown } });

        expect(next.cache.totalCount).toBe(250);
        expect(next.scrollTop).toBe(500);
        expect(next.selected).toBe(42);
        // The page cached before the change is stale; the arrived one is not.
        expect(next.cache.stale[4]).toBe(Status.None);
        expect(next.cache.stale[0]).toBeUndefined();
    });
});
