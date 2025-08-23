import { Data, Status } from './types';

export interface State<Type> {
    status: Status;
    scrollTop: number;
    data?: Data<Type>;
    selected: number;
    hovered: number;
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
    }
}
