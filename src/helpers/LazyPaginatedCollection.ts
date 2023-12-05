import { Result, DataSource } from './types'

/**
 * @callback LazyPaginatedCollection.retrieve
 * @async
 * @param {number} offset An offset (the index of the first item to fetch).
 * @param {number} count A number of items to fetch.
 * @returns Promise.<Array<Object> | RangeError>
 */

// retrieve must throw RangeError in case requested index is oob
/**
 * Calss representing a lazy paginated collection of data.
 */
export class LazyPaginatedCollection<Type> {
    // Stores a map of Promises to page requests. A key
    // corresponds to the index of the item within a collection.
    // A value corresponds to a Promise of the fetch request of the items
    // from an offset tht corresponds to the key of the map. The number of items
    // requested equals #pageSize property.
    #pageOffsets: { [id: number]: Promise<Result<Type>> };

    // Totsl number of items in a collection. -1 if collection was not loaded.
    #totalCount: number;

    // Corresponds to the (at most) number of items fetched at each reauest.
    #pageSize: number;

    // A callback to fetch data
    #retrieve: DataSource<Type>;

    /**
     * Constructs a new collection.
     *
     * @param {number} pageSize Page size
     * @param {DataSource<Type>} retrieve A data fetcher
     */
    constructor(pageSize: number, retrieve: DataSource<Type>) {
        this.#pageOffsets = {};
        this.#totalCount = -1;
        this.#pageSize = pageSize;
        this.#retrieve = retrieve;
    }

    /**
     * Returns the size of the page.
     *
     * @returns {number}
     */
    pageSize() {
        return this.#pageSize;
    }

    /**
     * Returns a number of items in a collection.
     *
     * @returns {number} A number of items in a collection
     * (0 if a collection is empty or has not been loaded yet)
     */
    count() {
        if (this.#totalCount <= 0) {
            return 0;
        }

        return this.#totalCount;
    }

    /**
     * Returns an offset of the first index in the page to fetch.
     *
     * @private
     * @returns {number}
     */
    #pageIndexFor = (index: number) => (index - (index % this.#pageSize));

    /**
     * Returns an items at index.
     *
     * @async
     * @param {number} index An index of an item to retrieve.
     * @returns Promise.<number | RangeError>
     */
    at(index: number) {
        // Invalid offset
        if (index < 0) {
            return Promise.reject(new RangeError());
        }

        const offset = this.#pageIndexFor(index);
        // If the page is still missing then fetch it
        if (this.#pageOffsets[offset] === undefined) {
            this.#pageOffsets[offset] = this.#retrieve.fetch(offset, this.#pageSize);
            return this.#pageOffsets[offset]
                .then((result) => {
                    this.#totalCount = result.totalCount;
                    return Promise.resolve(result.items[index % this.#pageSize]);
                });
        }

        return this.#pageOffsets[offset]
            .then((result) => Promise.resolve(result.items[index % this.#pageSize]));
    }

    /**
     * Returns an slice of a collection.
     *
     * @async
     * @param {number} index An index of the first item to fetch.
     * @param {number} count Max number of items to fetch.
     * @returns Promise.<Array.<Object> | RangeError>
     */
    async slice(index: number, count: number) {
        // Invalid offset or count => an empty list
        if (index < 0 || count <= 0) {
            return Promise.resolve({
                items: [],
                offset: index,
            });
        }

        const offset = this.#pageIndexFor(index);
        // Stores all promises
        const all = [];
        for (let i = offset; i < index + count; i += this.#pageSize) {
            if (this.#pageOffsets[i] === undefined) {
                this.#pageOffsets[i] = this.#retrieve.fetch(i, this.#pageSize);
            }

            all.push(this.#pageOffsets[i]);
        }

        // Filter out all the errors that might erase while fetching a particular page
        return Promise.all(all.map((promise) => promise.catch((err) => err)))
            .then((results) => results.filter((result) => !(result instanceof Error)))
            .then((results) => {
                const ret: Array<Type> = [];
                for (let i = 0; i < results.length; i += 1) {
                    this.#totalCount = results[i].totalCount;
                    ret.splice(ret.length, 0, ...results[i].items);
                }
                return Promise.resolve({
                    items: ret.slice(index % this.#pageSize, (index % this.#pageSize) + count),
                    offset: index,
                });
            });
    }
}
