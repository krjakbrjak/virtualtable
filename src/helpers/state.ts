import { Data, Status } from './types';

export interface State<Type> {
    status: Status;
    scrollTop: number;
    data?: Data<Type>;
    selected: number;
    hovered: number;
    /**
     * Height of a single row, as measured on the hidden probe. Zero until the
     * probe has been laid out, which is also what a container that is not
     * displayed reports, so nothing can be sized or paged until it is known.
     */
    itemHeight: number;
    /**
     * Consecutive failures per page, used to back off and to stop retrying a
     * page that keeps failing. An entry is dropped once the page loads.
     */
    retries: { [page: number]: number };
}

export function get_total_count<Type>(state: State<Type>): number {
    if (state.data) {
        return state.data.totalCount;
    }
    return 0;
}

export function get_initial_state<T>(): State<T> {
    return {
        status: Status.None,
        scrollTop: 0,
        selected: -1,
        hovered: -1,
        itemHeight: 0,
        retries: {},
    };
}
