/**
 * VirtualTable component.
 *
 * @author Nikita Vakula <programmistov.programmist@gmail.com>
 */

import React, {
    useReducer, useEffect, useState, useRef, ReactNode,
} from 'react';
import PropTypes from 'prop-types';

import { slideItems } from './helpers/collections';

import './base.css';
import css from './VirtualTable.css';

import { LazyPaginatedCollection } from './helpers/LazyPaginatedCollection';
import { Result, Fetcher } from './helpers/types';

interface State<Type> {
    scrollTop: number,
    itemHeight: number,
    itemCount: number,
    items: Array<Type>,
    offset: number,
}

interface Action<Type> {
    type: 'scroll' | 'render' | 'loaded';
    data: Partial<State<Type>>
}

interface Args<Type> {
    height: number;
    renderer: (data: Type) => ReactNode;
    fetcher: Fetcher<Type>;
}

/**
 * Reducer function for managing state changes.
 *
 * @param {Object} state - The current state of the application.
 * @param {Object} action - The action object that describes the state change.
 * @param {string} action.type - The type of the action.
 * @param {any} [action.data] - Additional data associated with the action.
 * @returns {Object} - The new state after applying the action.
 */
function reducer<Type>(state: State<Type>, action: Action<Type>): State<Type> {
    switch (action.type) {
    case 'scroll':
        return { ...state, ...action.data };
    case 'render':
        return { ...state, ...action.data };
    case 'loaded':
        return { ...state, ...action.data };
    default:
        return state;
    }
};

/**
 * @callback VirtualTable.render
 * @param {Object} object Data to draw.
 * @returns {String | React.Component}
 */

/**
 * @description Props for {@link VirtualTable} component.
 *
 * @typedef {Object} VirtualTable.Props
 * @property {number} height A height of the grid.
 * @property {VirtualTable.render} renderer A function to render data.
 * @property {LazyPaginatedCollection.retrieve} fetcher An async function to fetch the data.
 */

/**
 * @description VirtualTable component.
 *
 * Displays a large set of data (with a low memory usage).
 *
 * @param {VirtualTable.Props} props Properties
 * @component
 */
function VirtualTable<Type>({ height, renderer, fetcher }: Args<Type>) {
    const ref = useRef(null);
    const [collection, setCollection] = useState<LazyPaginatedCollection<Type>>(new LazyPaginatedCollection<Type>(1, fetcher));

    const [state, dispatch] = useReducer(reducer<Type>, {
        scrollTop: 0,
        itemHeight: 0,
        itemCount: 0,
        items: [],
        offset: 0,
    });

    const [currentOffset, setCurrentOffset] = useState(0);

    const calculatePageCount = () => 2 * Math.floor(height / state.itemHeight);

    useEffect(() => {
        collection.slice(0, 1).then((result) => {
            dispatch({
                type: 'loaded',
                data: {
                    ...result,
                    itemCount: collection.count(),
                },
            });
        });
    }, []);

    useEffect(() => {
        if (state.itemHeight !== 0) {
            const offset = Math.floor(state.scrollTop / state.itemHeight);
            collection.slice(offset, collection.pageSize()).then((result) => {
                dispatch({
                    type: 'loaded',
                    data: {
                        ...result,
                        itemCount: collection.count(),
                    },
                });
            });
        }
    }, [collection]);

    useEffect(() => {
        if (state.itemHeight) {
            const offset = Math.floor(state.scrollTop / state.itemHeight);
            setCurrentOffset(offset);
            const c = calculatePageCount();
            if (c !== collection.pageSize()) {
                setCollection(new LazyPaginatedCollection(c, fetcher));
            } else {
                collection.slice(offset, collection.pageSize()).then((result) => {
                    if (currentOffset !== result.offset) {
                        dispatch({
                            type: 'loaded',
                            data: {
                                ...result,
                                itemCount: collection.count(),
                            },
                        });
                    }
                });
            }
        }
    }, [
        state,
    ]);

    const generate = (offset: number, d: Array<Type>) => {
        const ret = [];
        for (let i = 0; i < d.length; i += 1) {
            ret.push(<div key={i + offset}>{renderer(d[i])}</div>);
        }
        return ret;
    };

    useEffect(() => {
        if (ref.current) {
            ref.current.scrollTop = state.scrollTop % state.itemHeight;
            if (ref.current.children && ref.current.children.length) {
                if (ref.current.children[0].clientHeight !== state.itemHeight) {
                    dispatch({
                        type: 'render',
                        data: {
                            itemHeight: ref.current.children[0].clientHeight,
                        },
                    });
                }
            }
        }
    });

    if (state.items.length === 0) {
        return null;
    }

    return (
        <div style={{ position: 'relative' }}>
            <div
                ref={ref}
                className={css.grid}
                style={{
                    height, position: 'sticky', top: 0, width: '100%', overflow: 'hidden',
                }}
            >
                {generate(currentOffset, slideItems(currentOffset, {
                    items: state.items,
                    offset: state.offset,
                }))}
            </div>
            <div
                style={{
                    height, overflow: 'scroll', position: 'absolute', width: '100%', top: 0,
                }}
                onScroll={(e) => {
                    dispatch({
                        type: 'scroll',
                        data: {
                            scrollTop: (e.target as HTMLElement).scrollTop,
                        },
                    });
                }}
            >
                <div style={{
                    height: `${state.itemCount * state.itemHeight}px`, position: 'absolute', top: 0, width: '100%',
                }}
                />
            </div>
        </div>
    );
}

VirtualTable.propTypes = {
    height: PropTypes.number.isRequired,
    renderer: PropTypes.func.isRequired,
    fetcher: PropTypes.func.isRequired,
};

VirtualTable.defaultProps = {
};

export default VirtualTable;
