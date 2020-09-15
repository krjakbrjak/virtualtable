/**
 * VirtualTable component.
 *
 * @author Nikita Vakula <programmistov.programmist@gmail.com>
 */

import React, { useEffect, useState, useRef } from 'react';
import PropTypes from 'prop-types';

import { usePage } from './hooks';
import { slideItems } from './helpers/collections';

import './base.css';
import css from './VirtualTable.css';

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
const VirtualTable = ({ height, renderer, fetcher }) => {
    const ref = useRef(null);

    const {
        page,
        setPageCount,
        pageOffset,
        setPageOffset,
    } = usePage(fetcher);

    const totalHeight = () => {
        if (ref.current && ref.current.children.length) {
            return ref.current.children[0].clientHeight * page.totalCount;
        }

        return 0;
    };

    const calculatePageCount = () => 2 * Math.floor(height / ref.current.children[0].clientHeight);

    const generate = (d) => {
        const ret = [];
        for (let i = 0; i < page.items.length; i += 1) {
            ret.push(<div key={i + pageOffset}>{renderer(d[i])}</div>);
        }
        return ret;
    };

    useEffect(() => {
        if (ref.current && ref.current.children) {
            const c = calculatePageCount();
            if (c !== page.items.length) {
                setPageCount(c);
            }
        }
    });

    if (page.items.length === 0) {
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
                {generate(slideItems(pageOffset, page))}
            </div>
            <div
                style={{
                    height, overflow: 'scroll', position: 'absolute', width: '100%', top: 0,
                }}
                onScroll={(e) => {
                    ref.current.scrollTop = e.target.scrollTop
                        % ref.current.children[0].clientHeight;
                    const tmp = Math.floor(e.target.scrollTop
                            / ref.current.children[0].clientHeight);
                    if (tmp !== pageOffset) {
                        setPageOffset(tmp);
                    }
                }}
            >
                <div style={{
                    height: `${totalHeight()}px`, position: 'absolute', top: 0, width: '100%',
                }}
                />
            </div>
        </div>
    );
};

VirtualTable.propTypes = {
    height: PropTypes.number.isRequired,
    renderer: PropTypes.func.isRequired,
    fetcher: PropTypes.func.isRequired,
};

VirtualTable.defaultProps = {
};

export default VirtualTable;
