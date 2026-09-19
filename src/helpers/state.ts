import { Status } from './types';
import { Cache } from './cache';

export interface State<Type> {
    status: Status;
    scrollTop: number;
    selected: number;
    hovered: number;
    /**
     * The row the keyboard cursor is on. Kept apart from `selected` because
     * moving through the rows must not select them: a selection reports an
     * item, and fetches the page holding it if it has to.
     */
    active: number;
    /**
     * Height of a single row, as measured on the hidden probe. Zero until the
     * probe has been laid out, which is also what a container that is not
     * displayed reports, so nothing can be sized or paged until it is known.
     */
    itemHeight: number;
    cache: Cache<Type>;
    /**
     * Highest source version applied so far, from changes or trusted results;
     * -1 until a live source has produced either. A change at or below it is
     * a duplicate; a result below it is outdated and cannot touch the count.
     */
    applied: number;
    /**
     * Set when a change moved scrollTop (rows inserted or removed above the
     * window); tells the component to move the container to match.
     */
    shift: boolean;
}

export function get_total_count<Type>(state: State<Type>): number {
    return state.cache.totalCount;
}

export function get_initial_state<T>(): State<T> {
    return {
        status: Status.None,
        scrollTop: 0,
        selected: -1,
        hovered: -1,
        active: -1,
        itemHeight: 0,
        cache: Cache.empty<T>(),
        applied: -1,
        shift: false,
    };
}
