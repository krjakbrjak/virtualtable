import { Data, Pages, Status } from './types';

/** Failed fetch attempts per page. Cleared when the page loads. */
export type Retries = { [page: number]: number };

/**
 * Pages whose cached rows may be out of date. Status.None: a refetch is due.
 * Status.Loading: the refetch is in flight. A stale page keeps rendering its
 * old rows meanwhile.
 */
export type Stale = { [page: number]: Status.None | Status.Loading };

/**
 * The fetched pages, plus the total count and page size of the collection.
 * Immutable: every method returns a new Cache.
 */
export class Cache<Type> implements Data<Type> {
    constructor(
        readonly totalCount: number,
        readonly pageSize: number,
        readonly pages: Pages<Type>,
        readonly retries: Retries = {},
        readonly stale: Stale = {},
    ) {}

    /** Total count and page size are unknown (0) until the first page arrives. */
    static empty<Type>(): Cache<Type> {
        return new Cache<Type>(0, 0, {});
    }

    /** Whether the result carries any page. */
    static arrived<Type>(incoming: Data<Type>): boolean {
        return Object.values(incoming.pages).some((page) => Array.isArray(page));
    }

    /** Whether `index` is within the collection. */
    holds(index: number): boolean {
        return index >= 0 && index < this.totalCount;
    }

    /**
     * Marks pages as loading. A stale page keeps its rows; only its mark
     * changes to Loading.
     */
    request(pages: Array<number>): Cache<Type> {
        const next = { ...this.pages };
        const stale = { ...this.stale };
        for (const page of pages) {
            if (stale[page] !== undefined && Array.isArray(this.pages[page])) {
                stale[page] = Status.Loading;
            } else {
                next[page] = Status.Loading;
            }
        }
        return new Cache(this.totalCount, this.pageSize, next, this.retries, stale);
    }

    /** Marks every cached page that overlaps rows [from, to) as stale. */
    invalidate(from: number, to: number): Cache<Type> {
        const stale = { ...this.stale };
        for (const key of Object.keys(this.pages)) {
            const index = Number(key);
            if (
                Array.isArray(this.pages[index]) &&
                (index + 1) * this.pageSize > from &&
                index * this.pageSize < to
            ) {
                // A refetch already in flight stays Loading, so it is not issued twice.
                stale[index] = this.stale[index] === Status.Loading ? Status.Loading : Status.None;
            }
        }
        return new Cache(this.totalCount, this.pageSize, this.pages, this.retries, stale);
    }

    /**
     * Merges a fetch result into the cache.
     * - A new total count replaces the old one and marks every cached page stale.
     * - A page shorter than expected stays stale and counts as a failed attempt.
     * - A different page size discards the cache and starts from the result.
     */
    merge(incoming: Data<Type>): Cache<Type> {
        const learned = Cache.arrived(incoming);
        if (learned && this.pageSize > 0 && incoming.pageSize !== this.pageSize) {
            return Cache.empty<Type>().merge(incoming);
        }
        const pageSize = this.pageSize || incoming.pageSize;
        // A result with no page carries no total count; keep the known one.
        const totalCount = learned ? incoming.totalCount : this.totalCount;
        const base =
            learned && totalCount !== this.totalCount ? this.invalidate(0, Infinity) : this;

        const pages = { ...base.pages };
        const stale = { ...base.stale };
        const retries = { ...base.retries };
        for (const key of Object.keys(incoming.pages)) {
            const index = Number(key);
            const page = incoming.pages[index];
            if (page === Status.Error) {
                Cache.fail(index, pages, retries, stale);
                continue;
            }
            pages[index] = page;
            if (!Array.isArray(page)) {
                continue;
            }
            const expected = Math.max(0, Math.min(pageSize, totalCount - index * pageSize));
            if (page.length < expected) {
                stale[index] = Status.None;
                retries[index] = (retries[index] || 0) + 1;
            } else {
                delete stale[index];
                delete retries[index];
            }
        }
        return new Cache(totalCount, pageSize, pages, retries, stale);
    }

    /** Sets the total count announced by a change. */
    resize(totalCount: number): Cache<Type> {
        return new Cache(totalCount, this.pageSize, this.pages, this.retries, this.stale);
    }

    /**
     * Merges a result that is older than the last applied change.
     * - The total count is not touched.
     * - Its pages are cached as stale and count as a failed attempt.
     * - While the page size is unknown, its pages are dropped instead.
     * - A cached page that is not stale is left alone.
     */
    reject(incoming: Data<Type>): Cache<Type> {
        const pages = { ...this.pages };
        const stale = { ...this.stale };
        const retries = { ...this.retries };
        for (const key of Object.keys(incoming.pages)) {
            const index = Number(key);
            const page = incoming.pages[index];
            if (page === Status.Error) {
                Cache.fail(index, pages, retries, stale);
                continue;
            }
            if (
                !Array.isArray(page) ||
                (Array.isArray(pages[index]) && stale[index] === undefined)
            ) {
                continue;
            }
            retries[index] = (retries[index] || 0) + 1;
            if (this.pageSize > 0) {
                pages[index] = page;
                stale[index] = Status.None;
            } else {
                delete pages[index];
            }
        }
        return new Cache(this.totalCount, this.pageSize, pages, retries, stale);
    }

    /** Records a failed fetch. A stale page keeps its old rows instead of an Error marker. */
    private static fail<Type>(index: number, pages: Pages<Type>, retries: Retries, stale: Stale) {
        retries[index] = (retries[index] || 0) + 1;
        if (stale[index] !== undefined && Array.isArray(pages[index])) {
            stale[index] = Status.None;
        } else {
            pages[index] = Status.Error;
        }
    }
}
