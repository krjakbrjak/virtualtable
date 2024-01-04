import { Data, Status } from './types';
import { State, get_initial_state } from './state';

export const SCROLL = 'scroll'
export const SELECT = 'SELECT';
export const LOAD = 'LOAD';
export const LOADED = 'LOADED';
export const RESET = 'RESET';
export const INITIALIZE = 'INITIALIZE';
export const INITIALIZED = 'INITIALIZED';

export enum Selection {
    CLICK,
    HOVER,
}

interface ScrollAction {
    type: typeof SCROLL;
    payload: {
        scrollTop: number;
    }
}

interface SelectAction {
    type: typeof SELECT;
    payload: {
        selection: Selection;
        index: number;
    }
}

interface LoadedAction<Type> {
    type: typeof LOADED;
    payload: {
        data: Data<Type>;
    }
}

interface LoadAction {
    type: typeof LOAD;
    payload: {
        pages: Array<number>;
    }
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

type Action<Type> = ScrollAction | SelectAction | LoadedAction<Type> | ResetAction | LoadAction | InitializeAction | InitializedAction;
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
            return {
                ...state,
                ...action.payload,
            };
        case LOAD:
            if (state.status !== Status.Loaded) {
                return state;
            }
            const request: {[key: number]: typeof Status.Loading}  = {};
            for (let page of action.payload.pages) {
                request[page] = Status.Loading;
            }
            return {
                ...state,
                status: Status.Loaded,
                data: {
                    ...state?.data,
                    pages: {
                        ...state.data?.pages,
                        ...request,
                    }
                }
            };
        case LOADED:
            if (state.data?.pageSize !== action.payload.data.pageSize || state.data?.totalCount !== action.payload.data.totalCount) {
                return {
                    ...get_initial_state<Type>(),
                    status: Status.Loaded,
                    data: action.payload.data,
                };
            }
            return {
                ...state,
                status: Status.Loaded,
                data: {
                    ...state?.data,
                    pages: {
                        ...state.data?.pages,
                        ...action.payload.data.pages,
                    }
                }
            };
        case SELECT:
            switch (action.payload.selection) {
            case Selection.CLICK:
                return {
                    ...state,
                    selected: action.payload.index,
                };
            case Selection.HOVER:
            default:
                return {
                    ...state,
                    hovered: action.payload.index,
                };
            }
        default:
            break;
    }
    return state;
};
