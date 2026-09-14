import { Data, Status } from './types';
import { State, get_initial_state } from './state';

export const SCROLL = 'scroll';
export const SELECT = 'SELECT';
export const LOAD = 'LOAD';
export const LOADED = 'LOADED';
export const RESET = 'RESET';
export const INITIALIZE = 'INITIALIZE';
export const INITIALIZED = 'INITIALIZED';
export const MEASURED = 'MEASURED';

export enum Selection {
    CLICK,
    HOVER,
    ACTIVE,
}

interface ScrollAction {
    type: typeof SCROLL;
    payload: {
        scrollTop: number;
    };
}

interface SelectAction {
    type: typeof SELECT;
    payload: {
        selection: Selection;
        index: number;
    };
}

interface LoadedAction<Type> {
    type: typeof LOADED;
    payload: {
        data: Data<Type>;
    };
}

interface LoadAction {
    type: typeof LOAD;
    payload: {
        pages: Array<number>;
    };
}

interface InitializeAction {
    type: typeof INITIALIZE;
}

interface ResetAction {
    type: typeof RESET;
}

interface InitializedAction {
    type: typeof INITIALIZED;
}

interface MeasuredAction {
    type: typeof MEASURED;
    payload: {
        height: number;
    };
}

type Action<Type> =
    | ScrollAction
    | SelectAction
    | LoadedAction<Type>
    | ResetAction
    | LoadAction
    | InitializeAction
    | InitializedAction
    | MeasuredAction;
/**
 * Reducer function for managing state changes.
 *
 * @template {Type}
 * @param {State} state - The current state of the application.
 * @param {Action} action - The action object that describes the state change.
 * @returns {State} - The new state after applying the action.
 */
export function reducer<Type>(state: State<Type>, action: Action<Type>): State<Type> {
    switch (action.type) {
        case RESET:
            return {
                ...get_initial_state<Type>(),
                itemHeight: state.itemHeight,
            };
        case MEASURED:
            if (!action.payload.height || action.payload.height === state.itemHeight) {
                return state;
            }
            return {
                ...get_initial_state<Type>(),
                itemHeight: action.payload.height,
            };
        case INITIALIZE:
            return {
                ...state,
                status: Status.Loading,
            };
        case INITIALIZED:
            if (state.status === Status.Loading) {
                return {
                    ...state,
                    status: Status.Loaded,
                };
            }
            return state;
        case SCROLL:
            if (state.scrollTop === action.payload.scrollTop) {
                return state;
            }
            return {
                ...state,
                ...action.payload,
            };
        case LOAD:
            if (state.status !== Status.Loaded) {
                return state;
            }
            const request: { [key: number]: typeof Status.Loading } = {};
            for (let page of action.payload.pages) {
                request[page] = Status.Loading;
            }
            return {
                ...state,
                status: Status.Loaded,
                data: {
                    // The first load happens before anything is known about
                    // the collection, so these stand in until a page arrives.
                    totalCount: state.data?.totalCount ?? 0,
                    pageSize: state.data?.pageSize ?? 0,
                    pages: {
                        ...state.data?.pages,
                        ...request,
                    },
                },
            };
        case LOADED: {
            const incoming = action.payload.data;

            // A payload in which every page failed taught us nothing about the
            // collection: its totalCount is 0 because it is unknown, not
            // because the source is empty. Treating that as "the source
            // changed" is what used to wipe scroll position and selection.
            const learned = Object.values(incoming.pages).some((page) => Array.isArray(page));

            const count_retries = (base: { [page: number]: number }) => {
                const ret = { ...base };
                for (const key of Object.keys(incoming.pages)) {
                    const index = Number(key);
                    if (incoming.pages[index] === Status.Error) {
                        ret[index] = (ret[index] || 0) + 1;
                    } else {
                        delete ret[index];
                    }
                }
                return ret;
            };

            if (
                learned &&
                (state.data?.pageSize !== incoming.pageSize ||
                    state.data?.totalCount !== incoming.totalCount)
            ) {
                return {
                    ...get_initial_state<Type>(),
                    itemHeight: state.itemHeight,
                    status: Status.Loaded,
                    data: incoming,
                    retries: count_retries({}),
                };
            }
            return {
                ...state,
                status: Status.Loaded,
                retries: count_retries(state.retries),
                data: {
                    ...state?.data,
                    pageSize: state.data?.pageSize ?? incoming.pageSize,
                    totalCount: learned ? incoming.totalCount : (state.data?.totalCount ?? 0),
                    pages: {
                        ...state.data?.pages,
                        ...incoming.pages,
                    },
                },
            };
        }
        case SELECT:
            switch (action.payload.selection) {
                case Selection.CLICK:
                    if (state.selected === action.payload.index) {
                        return state;
                    }
                    return {
                        ...state,
                        selected: action.payload.index,
                    };
                case Selection.ACTIVE:
                    if (state.active === action.payload.index) {
                        return state;
                    }
                    return {
                        ...state,
                        active: action.payload.index,
                    };
                case Selection.HOVER:
                default:
                    // Pointer movement dispatches continuously, so returning a
                    // new state for an unchanged index would re-render every
                    // row on each event.
                    if (state.hovered === action.payload.index) {
                        return state;
                    }
                    return {
                        ...state,
                        hovered: action.payload.index,
                    };
            }
        default:
            break;
    }
    return state;
}
