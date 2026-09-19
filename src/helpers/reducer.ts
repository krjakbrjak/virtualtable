import { Change, Data, Status } from './types';
import { State, get_initial_state } from './state';
import { Cache } from './cache';

export const SCROLL = 'scroll';
export const SELECT = 'SELECT';
export const LOAD = 'LOAD';
export const LOADED = 'LOADED';
export const RESET = 'RESET';
export const INITIALIZE = 'INITIALIZE';
export const INITIALIZED = 'INITIALIZED';
export const MEASURED = 'MEASURED';
export const CHANGED = 'CHANGED';
export const SHIFTED = 'SHIFTED';

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
        /** The source is live: results reconcile against `applied`. */
        live?: boolean;
        /** Version the result was computed at, from the source. */
        version?: number;
    };
}

interface ChangedAction {
    type: typeof CHANGED;
    payload: {
        change: Change;
    };
}

interface ShiftedAction {
    type: typeof SHIFTED;
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
    | MeasuredAction
    | ChangedAction
    | ShiftedAction;
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
            return {
                ...state,
                cache: state.cache.request(action.payload.pages),
            };
        case LOADED: {
            const incoming = action.payload.data;
            const live = action.payload.live === true;
            const { version } = action.payload;
            const learned = Cache.arrived(incoming);
            // A live result is trusted at or above the last applied change;
            // one without a version cannot be placed at all.
            const trusted = !live || (version !== undefined && version >= state.applied);

            if (live && learned && version === undefined) {
                console.warn(
                    'virtualtable: live source returned a result without a version; treating it as outdated',
                );
            } else if (
                live &&
                learned &&
                trusted &&
                state.cache.pageSize > 0 &&
                incoming.totalCount !== state.cache.totalCount
            ) {
                console.warn(
                    'virtualtable: live source changed without announcing it; recovering via refresh',
                );
            }

            if (!trusted) {
                return {
                    ...state,
                    status: Status.Loaded,
                    cache: state.cache.reject(incoming),
                };
            }
            const applied = live && version !== undefined ? version : state.applied;
            const cache = state.cache.merge(incoming);
            // A page-size mismatch replaced the cache; the view starts over.
            if (state.cache.pageSize > 0 && cache.pageSize !== state.cache.pageSize) {
                return {
                    ...get_initial_state<Type>(),
                    itemHeight: state.itemHeight,
                    status: Status.Loaded,
                    applied,
                    cache,
                };
            }
            return {
                ...state,
                status: Status.Loaded,
                applied,
                cache,
                selected: cache.holds(state.selected) ? state.selected : -1,
                active: Math.min(state.active, cache.totalCount - 1),
            };
        }
        case SHIFTED:
            return state.shift ? { ...state, shift: false } : state;
        case CHANGED: {
            const { change } = action.payload;
            // At or below the applied version: already reflected.
            if (change.version <= state.applied) {
                return state;
            }
            // Nothing learned yet: only the clock advances.
            if (state.cache.pageSize <= 0) {
                return { ...state, applied: change.version };
            }
            const { totalCount } = state.cache;
            const offset = state.itemHeight ? Math.floor(state.scrollTop / state.itemHeight) : 0;
            switch (change.kind) {
                case 'refreshed':
                    return {
                        ...state,
                        applied: change.version,
                        cache: state.cache.invalidate(0, Infinity),
                    };
                case 'updated':
                    return {
                        ...state,
                        applied: change.version,
                        cache: state.cache.invalidate(change.index, change.index + change.count),
                    };
                case 'inserted': {
                    // Rows inserted above the window push the content down;
                    // the scroll position follows so the view stays anchored.
                    const delta = change.index <= offset ? change.count * state.itemHeight : 0;
                    return {
                        ...state,
                        applied: change.version,
                        cache: state.cache
                            .invalidate(change.index, Infinity)
                            .resize(totalCount + change.count),
                        selected:
                            state.selected >= change.index && state.selected >= 0
                                ? state.selected + change.count
                                : state.selected,
                        active:
                            state.active >= change.index && state.active >= 0
                                ? state.active + change.count
                                : state.active,
                        scrollTop: state.scrollTop + delta,
                        shift: state.shift || delta !== 0,
                    };
                }
                case 'removed': {
                    const total = Math.max(0, totalCount - change.count);
                    const end = change.index + change.count;
                    // A position inside the removed range is gone; one after
                    // it moves up.
                    const displaced = (position: number) =>
                        position < change.index
                            ? position
                            : position < end
                              ? -1
                              : position - change.count;
                    const above = Math.max(0, Math.min(offset, end) - change.index);
                    const delta = above * state.itemHeight;
                    return {
                        ...state,
                        applied: change.version,
                        cache: state.cache.invalidate(change.index, Infinity).resize(total),
                        selected: state.selected >= 0 ? displaced(state.selected) : -1,
                        active:
                            state.active >= 0
                                ? Math.min(displaced(state.active), total - 1)
                                : state.active,
                        scrollTop: Math.max(0, state.scrollTop - delta),
                        shift: state.shift || delta !== 0,
                    };
                }
            }
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
