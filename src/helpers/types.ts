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

/**
 * Represents an object that fetches the items.
 * 
 * @template {T} - The type of the element to be returned from the function.
 */
export interface DataSource<T> {
    /**
     * Fetches data.
    * @param {number} index - The strating index to fetch items.
    * @param {number} count - The number of items to fetch.
    * @returns {Promise<Result<Type>>} - A promise holding the result of the fetch.
     */
    fetch(index: number, count: number): Promise<Result<T>>;
}
