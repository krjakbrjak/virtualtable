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
 * @property {DataSource} fetcher A datasource to fetch the data.
 */

/**
 * @description VirtualTable component.
 *
 * Displays a large set of data (with a low memory usage).
 *
 * @param {VirtualTable.Props} props Properties
 * @component
 */
export default function VirtualTable<Type>({ height, renderer, fetcher, style }: Args<Type>): JSX.Element {
    const ref = useRef(null);
    const [collection, setCollection] = useState<LazyPaginatedCollection<Type>>(() => new LazyPaginatedCollection<Type>(1, fetcher));

    useEffect(() => {
        setCollection(new LazyPaginatedCollection<Type>(collection.pageSize() ? collection.pageSize() : 1, fetcher));
    }, [fetcher]);

    const [state, dispatch] = useReducer(reducer<Type>, {
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
        }
    });

    const calculatePageCount = () => 2 * Math.floor(height / state.itemHeight);

    useEffect(() => {
        const handler = () => {
            if (ref && ref.current) {
                dispatch({
                    type: 'render',
                    data: {
                        rect: ref.current.getBoundingClientRect(),
                    },
                });
            }
        };
        window.addEventListener('resize', handler);
        return function cleanup() {
            window.removeEventListener('resize', handler, true);
        }
    }, []);

    useEffect(() => {
        if (collection) {
            collection.slice(0, collection.pageSize()).then((result) => {
                dispatch({
                    type: 'loaded',
                    data: {
                        scrollTop: 0,
                        itemHeight: 0,
                        page: result,
                        selected: -1,
                        hovered: -1,
                        itemCount: collection.count(),
                    },
                });
            });
        }
    }, [collection]);

    useEffect(() => {
        if (state.itemHeight) {
            const offset = Math.floor(state.scrollTop / state.itemHeight);
            const c = calculatePageCount();
            if (c !== collection.pageSize()) {
                dispatch({
                    type: 'loaded',
                    data: {
                        offset: 0,
                    },
                });
                setCollection(new LazyPaginatedCollection<Type>(c, fetcher));
            } else if (state.offset !== offset) {
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
        }
    }, [
        state,
    ]);

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

    useEffect(() => {
        if (ref.current) {
            ref.current.scrollTop = state.scrollTop % state.itemHeight;
            if (ref.current.children && ref.current.children.length) {
                if (ref.current.children[0].clientHeight !== state.itemHeight) {
                    dispatch({
                        type: 'render',
                        data: {
                            itemHeight: ref.current.children[0].clientHeight,
                            rect: ref.current.getBoundingClientRect(),
                        },
                    });
                }
            }
        }
    });

    if (state.page.items.length === 0) {
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
                        {generate(state.offset, slideItems(state.offset, state.page))}
                    </div>
                    <div
                        className='overflow-scroll position-absolute'
                        style={{
                            top: state.rect.y,
                            left: state.rect.x,
                            width: state.rect.width,
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
};

VirtualTable.defaultProps = {
};
