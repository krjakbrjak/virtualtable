/**
 * VirtualTable component.
 *
 * @author Nikita Vakula <programmistov.programmist@gmail.com>
 */

import React, {
    useEffect,
    useRef,
    ReactNode,
    useState,
    forwardRef,
    Ref,
    useImperativeHandle,
} from 'react';

import './base.css';

import { DataSource } from './helpers/types';
import { retry_delay } from './helpers/retry';
import { JSX } from 'react/jsx-runtime';

interface Args<Type> {
    renderer: (data: Type) => ReactNode;
    fetcher: DataSource<Type>;
    on_ready: () => void;
    on_error?: (error: unknown) => void;
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
const SizeChecker = <Type,>(
    { renderer, fetcher, on_ready, on_error }: Args<Type>,
    ref: Ref<ISizeChecker>,
): JSX.Element => {
    const invisible = useRef(null);
    const [data, setData] = useState<Array<Type>>([]);

    useImperativeHandle(
        ref,
        () => ({
            height: () => {
                if (invisible && invisible.current) {
                    return invisible.current.clientHeight;
                }
                return 0;
            },
        }),
        [invisible],
    );

    useEffect(() => {
        // Guards against a slow fetch from a replaced fetcher resolving late:
        // it would measure the previous source's row, and nothing re-measures
        // afterwards, so the wrong height would stick.
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | undefined;

        const attempt = (failures: number) => {
            fetcher.fetch(0, 1).then(
                (result) => {
                    if (cancelled) {
                        return;
                    }
                    // An empty collection has no row to measure, but the table
                    // must still be told the probe finished, otherwise it waits
                    // on a measurement that is never coming.
                    if (result.items.length) {
                        setData(result.items);
                    }
                    on_ready();
                },
                (error: unknown) => {
                    if (cancelled) {
                        return;
                    }
                    // Nothing renders until a row has been measured, so a probe
                    // that fails without retrying leaves the table permanently
                    // blank.
                    if (on_error) {
                        on_error(error);
                    }
                    // Nothing renders until a row has been measured, so this
                    // keeps trying for as long as the component is mounted.
                    timer = setTimeout(() => attempt(failures + 1), retry_delay(failures + 1));
                },
            );
        };
        attempt(0);

        return () => {
            cancelled = true;
            if (timer !== undefined) {
                clearTimeout(timer);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetcher]);

    if (data.length) {
        return (
            <div
                ref={invisible}
                style={{
                    visibility: 'hidden',
                    position: 'absolute',
                    pointerEvents: 'none',
                }}
            >
                {renderer(data[0])}
            </div>
        );
    }

    return null;
};

export default forwardRef(SizeChecker);
