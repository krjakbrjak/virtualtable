/**
 * Represents the result of the fetch.
 */
export interface Result<Type> {
    /**
     * The starting index to fetch the items.
     */
    from: number;
    /**
     * An array of fetched items.
     */
    items: Array<Type>;
    /**
     * Total number of items that can be retrieved.
     */
    totalCount: number;
}

/**
 * A callback function to fetch the items.
 * 
 * @typedef {Function} Fetcher
 * @template Type - The type of the element to be returned from the function.
 * @param {number} index - The strating index to fetch items.
 * @param {number} count - The number of items to fetch.
 * @returns {Promise<Result<Type>>} - A promise holding the result of the fetch.
 */
export type Fetcher<Type> = (index: number, count: number) => Promise<Result<Type>>;

/**
 * Represents the style of the item in the table.
 */
export interface Style {
    /**
     * Class that will be added to the item when it is hovered.
     */
    hover: string;
    /**
     * Class that will be added to the item when it is selected.
     */
    select: string;
    /**
     * Class that will be added to each item.
     */
    item: string;
}
