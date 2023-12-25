/**
 * VirtualTable component.
 *
 * @author Nikita Vakula <programmistov.programmist@gmail.com>
 */

import React, {
    useReducer, useEffect, useState, useRef, ReactNode,
} from 'react';
import PropTypes from 'prop-types';

import { slideItems, Page } from './helpers/collections';

import './base.css';

import { LazyPaginatedCollection } from './helpers/LazyPaginatedCollection';
import { Style, DataSource } from './helpers/types';
import { Container, Row, Col } from 'react-bootstrap';

/**
 * Represent the rectangular.
 */
interface Rect {
    x: number;
    y: number;
    height: number;
    width: number;
}

interface State<Type> {
    ready: boolean;
    scrollTop: number;
    itemHeight: number;
    itemCount: number;
    page: Page<Type>;
    offset: number;
    selected: number;
    hovered: number;
    rect: Rect;
}

interface Action<Type> {
    type: 'scroll' | 'render' | 'loaded' | 'click' | 'hover';
    data: Partial<State<Type>>
}

interface Args<Type> {
    height: number;
    renderer: (data: Type, classes: string) => ReactNode;
    fetcher: DataSource<Type>;
    style?: Style;
}

function get_initial_state<T>(): State<T> {
    return {
        ready: false,
        scrollTop: 0,
        itemHeight: 0,
        itemCount: 0,
        page: {
            items: [],
            offset: 0,
        },
        offset: 0,
        selected: -1,
        hovered: -1,
        rect: {
            x: 0,
            y: 0,
            height: 0,
            width: 0,
        },
    }
}
function calculatePageCount(pageHeight: number, itemHeight: number) {
    return 2 * Math.floor(pageHeight / itemHeight);
}

/**
 * Reducer function for managing state changes.
 *
 * @template {Type}
 * @param {State} state - The current state of the application.
 * @param {Action} action - The action object that describes the state change.
 * @returns {State} - The new state after applying the action.
 */
function reducer<Type>(state: State<Type>, action: Action<Type>): State<Type> {
    switch (action.type) {
        case 'scroll':
        case 'render':
        case 'loaded':
        case 'click':
        case 'hover':
            return { ...state, ...action.data };
        default:
            return state;
    }
};

/**
 * @description VirtualTable component.
 *
 * Displays a large set of data (with a low memory usage).
 *
 * @component
 */
export default function VirtualTable<Type>({ height, renderer, fetcher, style }: Args<Type>): JSX.Element {
    const ref = useRef(null);
    const invisible = useRef(null);
    const scrolldiv = useRef(null);
    const [collection, setCollection] = useState<LazyPaginatedCollection<Type>>(() => new LazyPaginatedCollection<Type>(1, fetcher));
    const [state, dispatch] = useReducer(reducer<Type>, get_initial_state<Type>());

    const generate = (offset: number, d: Array<Type>) => {
        const ret = [];

        for (let i = 0; i < d.length; i += 1) {
            let className = '';
            if (style) {
                className = style.item;
            }
            if (i + offset === state.selected && style) {
                className = `${className} ${style.select}`;
            } else if (i + offset === state.hovered && style) {
                className = `${className} ${style.hover}`;
            }
            ret.push(<div key={i + offset}>{renderer(d[i], className)}</div>);
        }
        return ret;
    };


    // A callback to update the table view in case of resize event.
    const handler = () => {
        let itemHeight = state.itemHeight;
        let rect = state.rect;
        if (invisible && invisible.current) {
            itemHeight = invisible.current.clientHeight;
        }
        if (ref && ref.current) {
            rect = ref.current.getBoundingClientRect();
        }

        // Update the size of the widget and the size of the items
        dispatch({
            type: 'render',
            data: {
                rect,
                itemHeight,
                scrollTop: 0,
                selected: -1,
                hovered: -1,
                page: {
                    items: [],
                    offset: 0,
                }
            },
        });

        // If the item's height is already known, then update the lazy collection
        // and re-fetch the items.
        if (itemHeight) {
            const new_collection = new LazyPaginatedCollection<Type>(calculatePageCount(rect.height, itemHeight), fetcher);
            new_collection.slice(0, new_collection.pageSize()).then((result) => {
                dispatch({
                    type: 'loaded',
                    data: {
                        page: result,
                        itemCount: new_collection.count(),
                    },
                });
                setCollection(new_collection);
            });
        }
    };

    // Effect that updates the lazy collection in case fetcher gets updated
    useEffect(() => {
        setCollection(new LazyPaginatedCollection<Type>(collection.pageSize() ? collection.pageSize() : 1, fetcher));
    }, [fetcher]);

    // Effect to fetch the first item (to draw a fake item to get the true size if the item)
    // and the total number of items.
    useEffect(() => {
        collection.slice(0, collection.pageSize()).then((result) => {
            dispatch({
                type: 'loaded',
                data: {
                    ready: true,
                    page: result,
                    itemCount: collection.count(),
                },
            });
        });

        window.addEventListener('resize', handler);
        return function cleanup() {
            window.removeEventListener('resize', handler, true);
        }
    }, []);

    // Effect to run on all state updates.
    useEffect(() => {
        if (state.ready) {
            if (state.itemHeight) {
                const offset = Math.floor(state.scrollTop / state.itemHeight);
                const c = calculatePageCount(height, state.itemHeight);
                if (c === collection.pageSize() && state.offset !== offset) {
                    // Update the offset first and then start fetching the necessary items.
                    // This ensures a non-interruptive user experience, where all the
                    // required data is already available.
                    dispatch({
                        type: 'loaded',
                        data: {
                            offset,
                        },
                    });
                    collection.slice(offset, collection.pageSize()).then((result) => {
                        if (state.offset !== result.offset) {
                            dispatch({
                                type: 'loaded',
                                data: {
                                    page: result,
                                    itemCount: collection.count(),
                                },
                            });
                        }
                    });
                }
            } else {
                handler();
            }
        }
    }, [state]);

    // Effect to run on each render to make sure that the scrolltop of
    // the item container is up-to-date.
    useEffect(() => {
        if (ref.current) {
            ref.current.scrollTop = state.scrollTop % state.itemHeight;
        }
    });

    let scrollbarWidth = 0;
    if (scrolldiv && scrolldiv.current) {
        scrollbarWidth = scrolldiv.current.offsetWidth - scrolldiv.current.children[0].offsetWidth;
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
                        {state.ready && state.itemHeight === 0 &&
                            <div ref={invisible} style={{
                                'visibility': 'hidden',
                                position: 'absolute',
                                pointerEvents: 'none'
                            }}>
                                {renderer(state.page.items[0], '')}
                            </div>}
                        {state.itemHeight !== 0 && generate(state.offset, slideItems(state.offset, state.page))}
                    </div>
                    <div
                        ref={scrolldiv}
                        className='overflow-auto position-absolute'
                        style={{
                            top: state.rect.y,
                            left: state.rect.x,
                            width: state.rect.width + scrollbarWidth,
                            height: state.rect.height,
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
    fetcher: PropTypes.object.isRequired,
    style: PropTypes.object,
};

VirtualTable.defaultProps = {
};
