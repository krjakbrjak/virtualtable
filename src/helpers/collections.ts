/**
 * @typedef {Object} Slice
 * @property {number} offset An offset (the index of the first item in the slice)
 * @property {Array.Object} items Items
 */

interface Page<Type> {
    items: Array<Type>;
    offset: number;
}

/**
 * Constructs a new slice of data.
 *
 * Takes a slice of the collection and based on the comparison of
 * slice's offset to the current offset cuts it and prepends/appends
 * empty elements to the cut. For example:
 *
 * For a slice {3, [0, 1, 2]} and currentOffset 4 the result is [1, 2, undefined].
 *
 * For {3, [0, 1, 2]} and 2 => [undefined, 0, 1].
 *
 * For {3, [0, 1, 2]} and 7 => [undefined, undefined, undefined].
 *
 * @param {number} currentOffset A new offset
 * @param {Slice} slice A slice of the collection
 * @returns Array.<Object>
 */
export function slideItems<Type>(currentOffset: number, { items, offset}: Page<Type>) {
    const count = items.length;
    // Nothing to do
    if (offset === currentOffset) {
        return items;
    }

    if (Math.abs(offset - currentOffset) >= count) {
        return [...Array(count).keys()].map(() => undefined);
    }

    const diff = Math.abs(currentOffset - offset);

    if (offset < currentOffset) {
        const tmp = items.slice(diff, count);
        tmp.splice(tmp.length, 0, ...Array(diff).fill(undefined));
        return tmp;
    }

    const tmp = Array(diff).fill(undefined);
    tmp.splice(tmp.length, 0, ...items.slice(0, count - diff));
    return tmp;
}
