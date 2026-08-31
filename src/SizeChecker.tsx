/**
 * VirtualTable component.
 *
 * @author Nikita Vakula <programmistov.programmist@gmail.com>
 */

import React, { useEffect, useRef, ReactNode, useState } from 'react';

import './base.css';

import { DataSource } from './helpers/types';
import { retry_delay } from './helpers/retry';
import { JSX } from 'react/jsx-runtime';

interface Args<Type> {
    renderer: (data: Type) => ReactNode;
    fetcher: DataSource<Type>;
    on_ready: () => void;
    on_measured: (height: number) => void;
    on_error?: (error: unknown) => void;
}

/**
 * @description SizeChecker component.
 *
 * This component is used for checking the dimensions that are required to display the
 * item of type Type.
 *
 * @component
 */
const SizeChecker = <Type,>({
    renderer,
    fetcher,
    on_ready,
    on_measured,
    on_error,
}: Args<Type>): JSX.Element | null => {
    const invisible = useRef<HTMLDivElement>(null);
    const [data, setData] = useState<Array<Type>>([]);
    // Held in a ref so the observer below can be attached once per probe
    // element rather than being torn down on every render of the table.
    const measured = useRef(on_measured);
    measured.current = on_measured;

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

    useEffect(() => {
        const node = invisible.current;
        if (!node) {
            return undefined;
        }
        if (typeof ResizeObserver === 'undefined') {
            measured.current(node.clientHeight);
            return undefined;
        }
        // clientHeight rather than the reported box: it is the measurement the
        // rows are laid out against, and it is what the observer is here to
        // keep in step.
        const observer = new ResizeObserver(() => measured.current(node.clientHeight));
        observer.observe(node);
        return () => observer.disconnect();
    }, [data]);

    if (data.length) {
        return (
            <div ref={invisible} className="vt-probe" aria-hidden="true">
                {renderer(data[0])}
            </div>
        );
    }

    return null;
};

export default SizeChecker;
