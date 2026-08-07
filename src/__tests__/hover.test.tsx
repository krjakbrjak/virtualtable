import { render, act, fireEvent } from '@testing-library/react';

import VirtualTable from '../VirtualTable';
import { DataSource } from '../helpers/types';

const TOTAL = 100;

const source: DataSource<number> = {
    fetch: (index, count) =>
        Promise.resolve({
            from: index,
            items: [...Array(count).keys()].map((i) => i + index),
            totalCount: TOTAL,
        }),
};

async function settle() {
    for (let i = 0; i < 3; i += 1) {
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });
    }
}

function scroller(container: HTMLElement) {
    return container.querySelector('div[style*="overflow-y: auto"]') as HTMLElement;
}

function row(container: HTMLElement, n: number) {
    return container.querySelectorAll('table tr')[n] as HTMLElement;
}

// Rows are rendered through the renderer, so counting its calls counts renders.
function setup() {
    let renders = 0;
    const renderer = (item: number | undefined) => {
        renders += 1;
        return <span>{item === undefined ? 'loading' : `item ${item}`}</span>;
    };
    const view = render(
        <VirtualTable<number>
            fetcher={source}
            renderer={renderer}
            style={{ item: 'item', hover: 'hover', select: 'select' }}
        />,
    );
    return { view, count: () => renders };
}

describe('hovering', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('does not re-render while the cursor stays on one row', async () => {
        const { view, count } = setup();
        await settle();

        fireEvent.mouseEnter(row(view.container, 2));
        await act(async () => {});

        const settled = count();
        for (let i = 0; i < 8; i += 1) {
            fireEvent.mouseEnter(row(view.container, 2));
        }
        await act(async () => {});

        expect(count()).toBe(settled);
    });

    it('still moves the highlight when the cursor changes row', async () => {
        const { view } = setup();
        await settle();

        const hovered = () =>
            Array.from(view.container.querySelectorAll('table tr')).findIndex((r) =>
                /hover/.test(r.querySelector('td')?.className ?? ''),
            );

        fireEvent.mouseEnter(row(view.container, 2));
        await act(async () => {});
        expect(hovered()).toBe(2);

        fireEvent.mouseEnter(row(view.container, 5));
        await act(async () => {});
        expect(hovered()).toBe(5);
    });

    it('clears the highlight when the cursor leaves the table', async () => {
        const { view } = setup();
        await settle();

        fireEvent.mouseEnter(row(view.container, 3));
        await act(async () => {});
        expect(view.container.innerHTML).toMatch(/hover/);

        fireEvent.mouseLeave(scroller(view.container));
        await act(async () => {});
        expect(view.container.innerHTML).not.toMatch(/hover/);
    });
});
