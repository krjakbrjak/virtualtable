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
import { Container, Row, Col } from 'react-bootstrap';

interface State<Type> {
    scrollTop: number,
    itemHeight: number,
    itemCount: number,
    items: Array<Type>,
    offset: number,
    selected: number;
    hovered: number;
}

interface Action<Type> {
    type: 'scroll' | 'render' | 'loaded' | 'click' | 'hover';
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
        case 'click':
            return { ...state, ...action.data };
        case 'hover':
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
export default function VirtualTable<Type>({ height, renderer, fetcher }: Args<Type>): JSX.Element {
    const ref = useRef(null);
    const [collection, setCollection] = useState<LazyPaginatedCollection<Type>>(new LazyPaginatedCollection<Type>(1, fetcher));

    const [state, dispatch] = useReducer(reducer<Type>, {
        scrollTop: 0,
        itemHeight: 0,
        itemCount: 0,
        items: [],
        offset: 0,
        selected: -1,
        hovered: -1,
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
            let backgroundColor = 'transparent';
            if (i + offset === state.selected) {
                backgroundColor = 'dimgrey';
            } else if (i + offset === state.hovered) {
                backgroundColor = 'silver';
            }
            ret.push(<div key={i + offset} style={{
                backgroundColor,
            }}>{renderer(d[i])}</div>);
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
        return <div />;
    }

    return (
        <Container>
            <Row>
                <Col>
                    <div
                        ref={ref}
                        className='overflow-hidden'
                        style={{
                            height,
                        }}
                    >
                        {generate(currentOffset, slideItems(currentOffset, {
                            items: state.items,
                            offset: state.offset,
                        }))}
                    </div>
                    <div
                        className='overflow-scroll position-absolute'
                        style={{
                            height,
                            top: ref.current ? ref.current.getBoundingClientRect().top : 0,
                            left: ref.current ? ref.current.getBoundingClientRect().left : 0,
                            width: ref.current ? ref.current.getBoundingClientRect().width : '0',
                        }}
                        onMouseMove={(e) => {
                            const index = Math.floor((e.clientY + state.scrollTop - ref.current.getBoundingClientRect().top) / state.itemHeight);
                            const childElement = ref.current.children[index - state.offset];
                            if (childElement) {
                                const event = new Event('mouseover', { bubbles: true, cancelable: false });
                                childElement.children[0].dispatchEvent(event);
                                dispatch({
                                    type: 'hover',
                                    data: {
                                        hovered: index,
                                    },
                                });
                            }
                        }}
                        onClick={(e) => {
                            const index = Math.floor((e.clientY + state.scrollTop - ref.current.getBoundingClientRect().top) / state.itemHeight);
                            const childElement = ref.current.children[index - state.offset];
                            if (childElement) {
                                const clickEvent = new Event('click', { bubbles: true, cancelable: false });
                                childElement.children[0].dispatchEvent(clickEvent);
                                dispatch({
                                    type: 'click',
                                    data: {
                                        selected: index,
                                    },
                                });
                            }
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
                            height: `${state.itemCount * state.itemHeight}px`, width: '100%',
                        }}
                        />
                    </div>
                </Col>
            </Row>
        </Container>
    );
}

VirtualTable.propTypes = {
    height: PropTypes.number.isRequired,
    renderer: PropTypes.func.isRequired,
    fetcher: PropTypes.func.isRequired,
};

VirtualTable.defaultProps = {
};
