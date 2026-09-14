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

const renderer = (item: number | undefined) => (
    <span>{item === undefined ? 'loading' : `item ${item}`}</span>
);

async function settle() {
    for (let i = 0; i < 3; i += 1) {
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });
    }
}

function row(container: HTMLElement, n: number) {
    return container.querySelectorAll('.vt-row')[n] as HTMLElement;
}

async function click(element: HTMLElement) {
    fireEvent.click(element);
    await act(async () => {});
}

describe('clicking a row', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('is reported every time, selection change or not', async () => {
        const clicks: Array<[number, number | undefined]> = [];
        const selections: Array<number> = [];
        const { container } = render(
            <VirtualTable<number>
                fetcher={source}
                renderer={renderer}
                onRowClick={(index, item) => clicks.push([index, item])}
                onSelected={(index) => selections.push(index)}
            />,
        );
        await settle();

        await click(row(container, 2));
        await click(row(container, 2));

        // The second click does not change the selection, which is exactly the
        // case a consumer driving something other than single select needs.
        expect(clicks).toEqual([
            [2, 2],
            [2, 2],
        ]);
        expect(selections).toEqual([2]);
    });

    it('leaves the selection alone when the table is not selectable', async () => {
        const clicks: Array<number> = [];
        const selections: Array<number> = [];
        const { container } = render(
            <VirtualTable<number>
                fetcher={source}
                renderer={renderer}
                selectable={false}
                style={{ item: 'item', hover: 'hover', select: 'select' }}
                onRowClick={(index) => clicks.push(index)}
                onSelected={(index) => selections.push(index)}
            />,
        );
        await settle();

        await click(row(container, 3));
        await click(row(container, 4));

        expect(clicks).toEqual([3, 4]);
        expect(selections).toEqual([]);
        expect(container.innerHTML).not.toMatch(/select/);
    });
});
