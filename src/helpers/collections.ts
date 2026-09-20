import { Data, DataSource, Result } from './types';
import { get_page_status, Status } from './types';

/**
 * Returns an array of items with a specified page size,
 * beginning at an offset from the collection.
 *
 * @template {Type}
 * @param {number} offset An offset
 * @param {Data} data Items
 * @returns {Array<Type | undefined>}
 */
export function get_items<Type>(offset: number, data: Data<Type>): Array<Type | undefined> {
    const page_offset = Math.floor(offset / data.pageSize);
    const ret: Array<Type | undefined> = [];
    for (let i of [page_offset, page_offset + 1]) {
        switch (get_page_status(data, i)) {
            case Status.None:
            case Status.Loading:
            case Status.Error:
                ret.push(
                    ...Array.from(
                        {
                            // The total count is unknown until a page loads, so
                            // this can go negative while a failure is pending.
                            length: Math.max(
                                0,
                                Math.min(data.pageSize, data.totalCount - i * data.pageSize),
                            ),
                        },
                        (): Type | undefined => undefined,
                    ),
                );
                break;
            case Status.Loaded:
                ret.push(...(data.pages[i] as Array<Type>));
                break;
            case Status.Unavailable:
            default:
                break;
        }
    }

    const slice_begin = offset % data.pageSize;
    return ret.slice(slice_begin, slice_begin + data.pageSize);
}

/**
 * Returns the item at an absolute index in the collection, or `undefined` when
 * the page holding it has not been loaded or failed to load. Unlike
 * `get_items`, which follows the window on screen, this answers for one index
 * anywhere in the collection.
 *
 * @template {Type}
 * @param {number} index An index into the whole collection
 * @param {Data} data Items
 * @returns {Type | undefined}
 */
export function get_item<Type>(index: number, data: Data<Type>): Type | undefined {
    if (index < 0 || data.pageSize <= 0) {
        return undefined;
    }
    const page = data.pages[Math.floor(index / data.pageSize)];
    return Array.isArray(page) ? page[index % data.pageSize] : undefined;
}

/**
 * The outcome of a fetch. Pages that failed are marked `Status.Error` in
 * `data.pages`, and the reason each one failed is kept in `errors` so the
 * caller can report it. `data.totalCount` is 0 when no page loaded, which
 * means "not learned" rather than "the collection is empty".
 */
export interface Fetched<Type> {
    data: Data<Type>;
    errors: { [page: number]: unknown };
    /**
     * The oldest version among the fulfilled results, or undefined when a
     * result carried none (or nothing was fulfilled).
     */
    version?: number;
}

/**
 * Fetches items.
 *
 * A page that fails does not fail its siblings: each is recorded on its own,
 * so a partial outage still yields whatever loaded.
 *
 * @async
 * @param {number} page_index An index of the first page to fetch.
 * @param {number} page_count Max number of pages to fetch.
 * @param {number} page_size The size of the page.
 * @returns {Promise<Fetched<Type>>}
 */
export async function fetch_items<Type>(
    page_index: number,
    page_count: number,
    page_size: number,
    fetcher: DataSource<Type>,
): Promise<Fetched<Type>> {
    // Invalid offset or count => an empty list
    if (page_index < 0 || page_count <= 0 || page_size <= 0) {
        return {
            data: { totalCount: 0, pageSize: page_size, pages: {} },
            errors: {},
        };
    }

    const requested: Array<number> = [];
    const promises: Array<Promise<Result<Type>>> = [];
    for (
        let i = page_index * page_size;
        i < (page_index + page_count) * page_size;
        i += page_size
    ) {
        requested.push(i / page_size);
        promises.push(fetcher.fetch(i, page_size));
    }

    // allSettled rather than catching into the result: a fetcher is free to
    // reject with something that is not an Error, and such a rejection must
    // not be mistaken for a successful page.
    const settled = await Promise.allSettled(promises);

    const ret: Fetched<Type> = {
        data: { totalCount: 0, pageSize: page_size, pages: {} },
        errors: {},
    };
    let missing = false;
    settled.forEach((outcome, i) => {
        if (outcome.status === 'fulfilled') {
            ret.data.totalCount = outcome.value.totalCount;
            ret.data.pages[outcome.value.from / page_size] = outcome.value.items;
            const { version } = outcome.value;
            if (version === undefined) {
                missing = true;
            } else {
                ret.version = ret.version === undefined ? version : Math.min(ret.version, version);
            }
        } else {
            ret.data.pages[requested[i]] = Status.Error;
            ret.errors[requested[i]] = outcome.reason;
        }
    });
    if (missing) {
        delete ret.version;
    }
    return ret;
}
