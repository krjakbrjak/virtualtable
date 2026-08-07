import { render, act, fireEvent } from '@testing-library/react';

import VirtualTable from '../VirtualTable';
import { DataSource } from '../helpers/types';
import { layout } from './setup';

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

function overlay(container: HTMLElement) {
    return container.querySelector('.overflow-y-scroll, .overflow-auto') as HTMLElement;
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

        // Halfway down a row, so every event lands on the same index.
        const y = layout.row * 2 + layout.row / 2;
        fireEvent.mouseMove(overlay(view.container), { clientY: y });
        await act(async () => {});

        const settled = count();
        for (let i = 0; i < 8; i += 1) {
            fireEvent.mouseMove(overlay(view.container), { clientY: y + i * 0.1 });
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

        fireEvent.mouseMove(overlay(view.container), { clientY: layout.row * 2 + 1 });
        await act(async () => {});
        expect(hovered()).toBe(2);

        fireEvent.mouseMove(overlay(view.container), { clientY: layout.row * 5 + 1 });
        await act(async () => {});
        expect(hovered()).toBe(5);
    });

    it('clears the highlight when the cursor leaves the table', async () => {
        const { view } = setup();
        await settle();

        fireEvent.mouseMove(overlay(view.container), { clientY: layout.row * 3 + 1 });
        await act(async () => {});
        expect(view.container.innerHTML).toMatch(/hover/);

        fireEvent.mouseLeave(overlay(view.container));
        await act(async () => {});
        expect(view.container.innerHTML).not.toMatch(/hover/);
    });
});
