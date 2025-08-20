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
                ret.push(...Array.from({ length: Math.min(data.pageSize, data.totalCount - i * data.pageSize) }, (): Type | undefined => undefined));
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
 * Fetches items.
 *
 * @async
 * @param {number} page_index An index of the first page to fetch.
 * @param {number} page_count Max number of pages to fetch.
 * @param {number} page_size The size of the page.
 * @returns {Promise<Page<Type>>}
 */
export async function fetch_items<Type>(page_index: number, page_count: number, page_size: number, fetcher: DataSource<Type>): Promise<Data<Type>> {
    // Invalid offset or count => an empty list
    if (page_index < 0 || page_count <= 0 || page_size <= 0) {
        return Promise.resolve({
            totalCount: 0,
            pageSize: page_size,
            pages: {},
        });
    }

    // Stores all promises
    const promises: Array<Promise<Result<Type>>> = [];
    for (let i = page_index * page_size; i < (page_index + page_count) * page_size; i += page_size) {
        promises.push(fetcher.fetch(i, page_size));
    }

    // Filter out all the errors that might erase while fetching a particular page
    return Promise.all<Promise<Result<Type>>>(promises.map((promise) => promise.catch((err) => err)))
        .then((results) => results.filter((result) => !(result instanceof Error)))
        .then((results) => {
            const ret: Data<Type> = {
                totalCount: 0,
                pageSize: page_size,
                pages: {}
            };
            for (let result of results) {
                ret.totalCount = result.totalCount;
                ret.pages[result.from / page_size] = result.items;
            }
            return Promise.resolve(ret);
        });
}
