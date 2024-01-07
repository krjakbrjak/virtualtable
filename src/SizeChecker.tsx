/**
 * VirtualTable component.
 *
 * @author Nikita Vakula <programmistov.programmist@gmail.com>
 */

import React, {
    useEffect, useRef, ReactNode, useState, forwardRef, Ref, useImperativeHandle,
} from 'react';

import './base.css';

import { DataSource, } from './helpers/types';

interface Args<Type> {
    renderer: (data: Type) => ReactNode;
    fetcher: DataSource<Type>;
    on_ready: () => void;
}

interface ISizeChecker {
    height: () => number;
}

/**
 * @description SizeChecker component.
 *
 * This component is used for checking the dimensions that are required to display the
 * item of type Type.
 *
 * @component
 */
const SizeChecker = <Type,>({ renderer, fetcher, on_ready }: Args<Type>, ref: Ref<ISizeChecker>): JSX.Element => {
    const invisible = useRef(null);
    const [data, setData] = useState<Array<Type>>([]);

    useImperativeHandle(ref, () => ({
        height: () => {
            if (invisible && invisible.current) {
                return invisible.current.clientHeight;
            }
            return 0;
        },
    }), [invisible]);

    useEffect(() => {
        fetcher.fetch(0, 1).then((result) => {
            if (result.items.length) {
                setData(result.items);
                on_ready();
            }
        });
    }, [fetcher]);

    if (data.length) {
        return (
            <div ref={invisible} style={{
                'visibility': 'hidden',
                position: 'absolute',
                pointerEvents: 'none'
            }}>
                {renderer(data[0])}
            </div>
        );
    }

    return null;
}

export default forwardRef(SizeChecker);
