/**
 * VirtualTable component.
 *
 * @author Nikita Vakula <programmistov.programmist@gmail.com>
 */

import React, { useReducer, useEffect, useRef, ReactNode } from 'react';

import { fetch_items, get_items } from './helpers/collections';

import {
    reducer,
    Selection,
    SCROLL,
    SELECT,
    INITIALIZED,
    INITIALIZE,
    LOADED,
    LOAD,
    MEASURED,
    RESET,
} from './helpers/reducer';
import { get_initial_state, get_total_count } from './helpers/state';
import { retry_delay } from './helpers/retry';
import { DataSource, Status, Style, Pages } from './helpers/types';
import SizeChecker from './SizeChecker';

import './base.css';
import { JSX } from 'react/jsx-runtime';

interface Args<Type> {
    /**
     * Renders one row. Called with `undefined` when the row's page has not
     * been loaded yet, or failed to load, so both cases have to be handled.
     */
    renderer: (data: Type | undefined) => ReactNode;
    fetcher: DataSource<Type>;
    style?: Style;
    striped?: boolean;
    selectable?: boolean;
    onSelected?: (index: number, item: Type) => void;
    onRowClick?: (index: number, item: Type | undefined) => void;
    /**
     * Called every time a page fails to load, including on each retry. A page
     * on screen is retried for as long as it keeps failing, with the delay
     * growing up to a ceiling, so a consumer reporting an outage should expect
     * repeated calls for the same page rather than one per failure.
     */
    onError?: (page: number, error: unknown) => void;
}

function calculatePageCount(pageHeight: number, itemHeight: number) {
    // At least one: a row taller than the viewport would otherwise give a page
    // of no rows, which the page index is then derived by dividing by.
    return Math.max(1, 2 * Math.floor(pageHeight / itemHeight));
}

/**
 * @description VirtualTable component.
 *
 * Displays a large set of data (with a low memory usage).
 *
 * @component
 */
export default function VirtualTable<Type>({
    renderer,
    fetcher,
    style,
    striped = false,
    selectable = true,
    onSelected,
    onRowClick,
    onError,
}: Args<Type>): JSX.Element {
    const scrolldiv = useRef<HTMLDivElement>(null);
    // Pending retry timers, keyed by page. Handles rather than state: they are
    // resources to be cleared, and the attempt counts they act on live in the
    // reducer.
    const timers = useRef<{ [page: number]: ReturnType<typeof setTimeout> }>({});
    // Bumped on every reset. A fetch or a retry started before a reset carries
    // the page size that was current when it began, so its result has to be
    // dropped rather than merged into a collection that has been re-measured.
    const generation = useRef(0);
    const [state, dispatch] = useReducer(reducer<Type>, {}, get_initial_state<Type>);
    const { itemHeight } = state;

    const generate = (offset: number, d: Array<Type | undefined>) => {
        const ret = [];

        for (let i = 0; i < d.length; i += 1) {
            const index = i + offset;
            const classes = ['vt-row'];
            if (striped && index % 2 === 1) {
                classes.push('vt-row-striped');
            }
            if (style?.item) {
                classes.push(style.item);
            }
            if (selectable && index === state.selected) {
                if (style?.select) {
                    classes.push(style.select);
                }
            } else if (index === state.hovered && style?.hover) {
                classes.push(style.hover);
            }
            ret.push(
                <div
                    key={index}
                    className={classes.join(' ')}
                    // Keeps every row the same height, which is what the
                    // position of the window above is calculated from.
                    style={{ height: itemHeight || undefined }}
                    onMouseEnter={() => {
                        if (index === state.hovered) {
                            return;
                        }
                        dispatch({
                            type: SELECT,
                            payload: {
                                selection: Selection.HOVER,
                                index,
                            },
                        });
                    }}
                    onClick={() => {
                        // Reported before the selection is updated, and without
                        // consulting it: a click on the row that is already
                        // selected is still a click.
                        if (onRowClick) {
                            onRowClick(index, d[i]);
                        }
                        if (selectable) {
                            dispatch({
                                type: SELECT,
                                payload: {
                                    selection: Selection.CLICK,
                                    index,
                                },
                            });
                        }
                    }}
                >
                    {renderer(d[i])}
                </div>,
            );
        }
        return ret;
    };

    // Fetches one page and folds the outcome, success or failure, back into
    // the state. Failures arrive as Status.Error markers, so a page that could
    // not be loaded stays distinguishable from one that was never requested.
    const load = (page: number, size: number) => {
        const started = generation.current;
        dispatch({
            type: LOAD,
            payload: {
                pages: [page],
            },
        });
        fetch_items(page, 1, size, fetcher).then(({ data, errors }) => {
            if (started !== generation.current) {
                return;
            }
            dispatch({
                type: LOADED,
                payload: {
                    data,
                },
            });
            if (onError) {
                for (const key of Object.keys(errors)) {
                    onError(Number(key), errors[Number(key)]);
                }
            }
        });
    };

    // Drops everything in flight. Anything that invalidates the collection has
    // to go through here, otherwise a pending retry lands afterwards carrying
    // the page size it was started with and forces another reset.
    const discard = () => {
        generation.current += 1;
        Object.values(timers.current).forEach(clearTimeout);
        timers.current = {};
    };

    // Discards everything in flight along with the collection itself.
    const reset = () => {
        discard();
        dispatch({
            type: RESET,
        });
    };

    // Effect that updates the lazy collection in case fetcher gets updated
    useEffect(() => {
        reset();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetcher]);

    useEffect(() => {
        discard();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.itemHeight]);

    // Pending retries must not outlive the component.
    useEffect(
        () => () => {
            Object.values(timers.current).forEach(clearTimeout);
            timers.current = {};
        },
        [],
    );

    // Reports a selection once. Keyed on the selected index alone, so it runs
    // per selection rather than on every state update. If the page holding the
    // row is not loaded, it is fetched and the report waits for it.
    useEffect(() => {
        if (state.selected < 0 || !onSelected || !state.data) {
            return undefined;
        }

        const index = state.selected;
        const { pageSize } = state.data;
        const pageIndex = Math.floor(index / pageSize);
        const page = state.data.pages[pageIndex];

        if (Array.isArray(page)) {
            onSelected(index, page[index % pageSize]);
            return undefined;
        }

        let cancelled = false;
        const started = generation.current;
        fetch_items(pageIndex, 1, pageSize, fetcher).then(({ data }) => {
            const items = data.pages[pageIndex];
            // A reset re-measures the rows, so pageSize may no longer be the
            // one this index was resolved against.
            if (cancelled || started !== generation.current || !Array.isArray(items)) {
                return;
            }
            dispatch({
                type: LOADED,
                payload: {
                    data,
                },
            });
            onSelected(index, items[index % pageSize]);
        });

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.selected]);

    // Effect to run on all state updates.
    useEffect(() => {
        switch (state.status) {
            case Status.Loading:
                if (itemHeight) {
                    dispatch({
                        type: INITIALIZED,
                    });
                }
                break;
            case Status.Loaded:
                // Without the viewport there is no page size to compute, and
                // the arithmetic below would run on NaN.
                if (itemHeight && scrolldiv.current) {
                    const offset = Math.floor(state.scrollTop / itemHeight);
                    const c = calculatePageCount(scrolldiv.current.clientHeight, itemHeight);
                    let data_pages: Pages<Type> = state.data ? state.data.pages : {};
                    const page_index = Math.floor(offset / c);
                    for (let i = -1; i < 2; ++i) {
                        const page = page_index + i;
                        if (page < 0) {
                            continue;
                        }
                        if (data_pages[page] === undefined) {
                            load(page, c);
                        } else if (data_pages[page] === Status.Error) {
                            // Retried on a timer rather than immediately: this
                            // effect runs on every state update, and the LOADED
                            // that marks the failure is itself such an update.
                            // There is no attempt limit, only a growing delay,
                            // so a source that recovers is always noticed.
                            if (timers.current[page] === undefined) {
                                timers.current[page] = setTimeout(
                                    () => {
                                        delete timers.current[page];
                                        load(page, c);
                                    },
                                    retry_delay(state.retries[page] || 0),
                                );
                            }
                        }
                    }
                }
                break;
            case Status.Unavailable:
            case Status.None:
                dispatch({
                    type: INITIALIZE,
                });
                break;
        }
        // A new fetcher is already handled by the RESET effect above, so
        // listing it here would only repeat that work.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state]);

    useEffect(() => {
        const node = scrolldiv.current;
        if (!node || typeof ResizeObserver === 'undefined') {
            return undefined;
        }
        let previous = node.clientHeight;
        const observer = new ResizeObserver(() => {
            const height = node.clientHeight;
            if (!height || height === previous) {
                return;
            }
            previous = height;
            reset();
        });
        observer.observe(node);
        return () => observer.disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        // A reset puts the collection back at the top. The scroll container has
        // to follow, otherwise the scrollbar keeps its old position while the
        // rows render from the start.
        if (scrolldiv.current && state.scrollTop === 0 && scrolldiv.current.scrollTop !== 0) {
            scrolldiv.current.scrollTop = 0;
        }
    });

    const offset = itemHeight ? Math.floor(state.scrollTop / itemHeight) : 0;

    return (
        <div className="vt-root">
            <div
                ref={scrolldiv}
                className="vt-viewport"
                onScroll={(e) => {
                    dispatch({
                        type: SCROLL,
                        payload: {
                            scrollTop: (e.target as HTMLElement).scrollTop,
                        },
                    });
                }}
                onMouseLeave={() => {
                    dispatch({
                        type: SELECT,
                        payload: {
                            selection: Selection.HOVER,
                            index: -1,
                        },
                    });
                }}
            >
                <div
                    className="vt-spacer"
                    style={{ height: `${get_total_count(state) * itemHeight}px` }}
                >
                    <div
                        className="vt-window"
                        style={{ transform: `translateY(${offset * itemHeight}px)` }}
                    >
                        <div className="vt-list">
                            {itemHeight !== 0 &&
                                state.data &&
                                generate(offset, get_items(offset, state.data))}
                        </div>
                        <SizeChecker
                            on_ready={() =>
                                dispatch({
                                    type: INITIALIZED,
                                })
                            }
                            on_measured={(height) =>
                                dispatch({
                                    type: MEASURED,
                                    payload: { height },
                                })
                            }
                            on_error={(error) => {
                                // The probe measures the first row, so a
                                // failure here is reported against page 0.
                                if (onError) {
                                    onError(0, error);
                                }
                            }}
                            fetcher={fetcher}
                            renderer={renderer}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
