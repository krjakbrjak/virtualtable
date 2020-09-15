import { useEffect, useState } from 'react';

import { LazyPaginatedCollection } from './helpers/LazyPaginatedCollection';

/**
 * @callback SetPageCount
 * @description Sets the new size of the page in a collection
 *
 * @param {number} pageCount The new size of the page
 */

/**
 * @typedef {Object} CollectionHookData
 * @property {LazyPaginatedCollection} items A collection
 * @property {SetPageCount} setPageCount A callback to change the size of the page
 */

/**
 * Returns {@link LazyPaginatedCollection} hook.
 *
 * @param {LazyPaginatedCollection.retrieve} retrieve An async callback to fetch the data
 * @returns {CollectionHookData}
 */
export function useCollection(retrieve) {
    const [items, setItems] = useState(new LazyPaginatedCollection(1, retrieve));

    const setPageCount = (value) => {
        if (value !== items.pageSize()) {
            setItems(new LazyPaginatedCollection(value, retrieve));
        }
    };

    return { items, setPageCount };
}

/**
 * @callback SetPageOffset
 * @description Sets the new offset
 *
 * @param {number} offset An offset
 */

/**
 * @typedef {Object} PageHookData
 * @property {LazyPaginatedCollection} page A collection
 * @property {SetPageCount} setPageCount A callback to change the size of the page
 * @property {number} pageOffset An offset
 * @property {SetPageOffset} setPageOffset A callback to change the current offset
 */

/**
 * Returns Page hook.
 *
 * @param {LazyPaginatedCollection.retrieve} retrieve An async callback to fetch the data
 * @returns {PageHookData}
 */
export function usePage(retrieve) {
    const { items, setPageCount } = useCollection(retrieve);
    const [page, setPage] = useState({
        items: [],
        totalCount: items.count(),
        offset: 0,
    });

    const [pageOffset, setPageOffset] = useState(0);

    useEffect(() => {
        if (pageOffset >= 0 && items.pageSize() > 0) {
            items.slice(pageOffset, items.pageSize())
                .then((result) => {
                    setPage({
                        items: result.items,
                        offset: result.offset,
                        totalCount: items.count(),
                    });
                });
        }
    }, [pageOffset, items]);

    return {
        page,
        setPageCount,
        pageOffset,
        setPageOffset,
    };
}
