import { Cache } from '../helpers/cache';
import { Status } from '../helpers/types';

const rows = (from: number, count: number) => [...Array(count).keys()].map((i) => i + from);

describe('cache', () => {
    const cached = () =>
        new Cache(100, 10, { 3: rows(30, 10), 4: rows(40, 10), 5: Status.Loading });

    it('requests a stale page without dropping its rows', () => {
        const next = cached().invalidate(40, 50).request([4, 6]);
        expect(next.pages[4]).toEqual(rows(40, 10));
        expect(next.stale[4]).toBe(Status.Loading);
        expect(next.pages[6]).toBe(Status.Loading);
    });

    it('invalidates the cached pages overlapping a range, keeping a refetch out', () => {
        const next = new Cache(100, 10, cached().pages, {}, { 4: Status.Loading }).invalidate(
            35,
            41,
        );
        expect(next.stale).toEqual({ 3: Status.None, 4: Status.Loading });
    });

    it('keeps the rows of a stale page whose refetch failed, and counts it', () => {
        const next = cached()
            .invalidate(40, 50)
            .merge({ totalCount: 0, pageSize: 10, pages: { 4: Status.Error } });
        expect(next.pages[4]).toEqual(rows(40, 10));
        expect(next.stale[4]).toBe(Status.None);
        expect(next.retries[4]).toBe(1);
        expect(next.totalCount).toBe(100);
    });

    it('adopts a changed total and marks every earlier page stale', () => {
        const next = cached().merge({ totalCount: 250, pageSize: 10, pages: { 6: rows(60, 10) } });
        expect(next.totalCount).toBe(250);
        expect(next.stale).toEqual({ 3: Status.None, 4: Status.None });
        expect(next.pages[6]).toEqual(rows(60, 10));
    });

    it('keeps a short page stale and counts the attempt', () => {
        const next = cached().merge({ totalCount: 105, pageSize: 10, pages: { 10: rows(100, 3) } });
        expect(next.stale[10]).toBe(Status.None);
        expect(next.retries[10]).toBe(1);
        // Arriving whole clears both.
        const healed = next.merge({ totalCount: 105, pageSize: 10, pages: { 10: rows(100, 5) } });
        expect(healed.stale[10]).toBeUndefined();
        expect(healed.retries[10]).toBeUndefined();
    });

    it('replaces itself on a page-size mismatch', () => {
        const next = cached().merge({ totalCount: 100, pageSize: 20, pages: { 0: rows(0, 20) } });
        expect(next.pageSize).toBe(20);
        expect(next.pages).toEqual({ 0: rows(0, 20) });
    });
});
