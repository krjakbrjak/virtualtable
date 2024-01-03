/**
 * VirtualTable component.
 *
 * @author Nikita Vakula <programmistov.programmist@gmail.com>
 */

import React, {
    useReducer, useEffect, useRef, ReactNode,
} from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import PropTypes from 'prop-types';

import { fetch_items, get_items } from './helpers/collections';

import {
    reducer,
    Selection,
    SCROLL, SELECT, INITIALIZED,
    INITIALIZE, LOADED, LOAD, RESET
} from './helpers/reducer';
import { get_initial_state, get_total_count } from './helpers/state';
import { DataSource, Status, Style, Data, Pages } from './helpers/types';
import SizeChecker from './SizeChecker';

import './base.css';

interface Args<Type> {
    height: number;
    renderer: (data: Type, classes: string) => ReactNode;
    fetcher: DataSource<Type>;
    style?: Style;
}

function calculatePageCount(pageHeight: number, itemHeight: number) {
    return 2 * Math.floor(pageHeight / itemHeight);
}

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
    const [state, dispatch] = useReducer(reducer<Type>, {}, get_initial_state<Type>);

    const get_height = () => {
        if (invisible && invisible.current) {
            return invisible.current.height();
        }
        return 0;
    }

    const generate = (offset: number, d: Array<Type | undefined>) => {
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
            ret.push(<div key={i}>{renderer(d[i], className)}</div>);
        }
        return ret;
    };

    // Effect that updates the lazy collection in case fetcher gets updated
    useEffect(() => {
        dispatch({
            type: RESET,
        });
    }, [fetcher]);

    // Effect to run on all state updates.
    useEffect(() => {
        const itemHeight = get_height();
        switch (state.status) {
            case Status.Loading:
                if (itemHeight) {
                    dispatch({
                        type: INITIALIZED,
                    });
                }
                break;
            case Status.Loaded:
                if (itemHeight) {
                    const offset = Math.floor(state.scrollTop / itemHeight);
                    const c = calculatePageCount(height, itemHeight);
                    let data_pages: Pages<Type> = state.data ? state.data.pages : {};
                    const page_index = Math.floor(offset / c);
                    for (let i = -1; i < 2; ++i) {
                        if (page_index + i > -1 && data_pages[page_index + i] === undefined) {
                            dispatch({
                                type: LOAD,
                                payload: {
                                    pages: [page_index + i],
                                },
                            });
                            fetch_items(page_index + i, 1, c, fetcher).then((result) => {
                                dispatch({
                                    type: LOADED,
                                    payload: {
                                        data: result,
                                    },
                                });
                            });
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
    }, [state]);

    // Effect to run on each render to make sure that the scrolltop of
    // the item container is up-to-date.
    useEffect(() => {
        const itemHeight = get_height();
        if (ref.current && itemHeight) {
            ref.current.scrollTop = state.scrollTop % itemHeight;
        }
    });

    let scrollbarWidth = 0;
    if (scrolldiv && scrolldiv.current) {
        scrollbarWidth = scrolldiv.current.offsetWidth - scrolldiv.current.children[0].offsetWidth;
    }

    return (
        <>
            <SizeChecker ref={invisible} on_ready={() => dispatch({
                type: INITIALIZED,
            })} fetcher={fetcher} renderer={renderer} />
            <Container className='position-relative' style={{ padding: 0, height, }}>
                <Row style={{ padding: 0, height: '100%' }}>
                    <Col style={{ padding: 0, height: '100%' }} className='position-relative'>
                        <div
                            ref={ref}
                            className='overflow-hidden'
                            style={{
                                padding: 0,
                                top: 0,
                                left: 0,
                                bottom: 0,
                                width: `calc(100% - ${scrollbarWidth}px)`,
                                height: '100%',
                            }}
                        >
                            {get_height() !== 0 && state.data && generate(Math.floor(state.scrollTop / get_height()), get_items(Math.floor(state.scrollTop / get_height()), state.data))}
                        </div>
                        <div
                            ref={scrolldiv}
                            className='overflow-auto position-absolute'
                            style={{
                                padding: 0,
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                            }}
                            onMouseMove={(e) => {
                                const position = Math.floor((e.clientY + ref.current.scrollTop - scrolldiv.current.getBoundingClientRect().top) / get_height());
                                const offset = Math.floor(state.scrollTop / get_height());
                                const index = position + offset;
                                const childElement = ref.current.children[index - Math.floor(state.scrollTop / get_height())];
                                if (childElement) {
                                    const event = new Event('mouseover', { bubbles: true, cancelable: false });
                                    childElement.children[0].dispatchEvent(event);
                                    dispatch({
                                        type: SELECT,
                                        payload: {
                                            selection: Selection.HOVER,
                                            index,
                                        },
                                    });
                                }
                            }}
                            onClick={(e) => {
                                const position = Math.floor((e.clientY + ref.current.scrollTop - scrolldiv.current.getBoundingClientRect().top) / get_height());
                                const offset = Math.floor(state.scrollTop / get_height());
                                const index = position + offset;
                                const childElement = ref.current.children[index - Math.floor(state.scrollTop / get_height())];
                                if (childElement) {
                                    const clickEvent = new Event('click', { bubbles: true, cancelable: false });
                                    childElement.children[0].dispatchEvent(clickEvent);
                                    dispatch({
                                        type: SELECT,
                                        payload: {
                                            selection: Selection.CLICK,
                                            index,
                                        },
                                    });
                                }
                            }}
                            onScroll={(e) => {
                                dispatch({
                                    type: SCROLL,
                                    payload: {
                                        scrollTop: (e.target as HTMLElement).scrollTop,
                                    },
                                });
                            }}
                        >
                            <div style={{
                                height: `${get_total_count(state) * get_height()}px`, width: '100%',
                            }}
                            />
                        </div>
                    </Col>
                </Row>
            </Container>
        </>
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
