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

function viewport(container: HTMLElement) {
    return container.querySelector('.vt-viewport') as HTMLElement;
}

// The row aria-activedescendant points at, resolved the way a screen reader
// resolves it: by id.
function active(container: HTMLElement) {
    const id = viewport(container).getAttribute('aria-activedescendant');
    return id ? document.getElementById(id) : null;
}

async function press(container: HTMLElement, key: string, times = 1) {
    for (let i = 0; i < times; i += 1) {
        fireEvent.keyDown(viewport(container), { key });
    }
    await act(async () => {});
}

describe('keyboard navigation', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('is a labelled listbox of options', async () => {
        const { container } = render(
            <VirtualTable<number> fetcher={source} renderer={renderer} aria-label="files" />,
        );
        await settle();

        const list = viewport(container);
        expect(list.getAttribute('role')).toBe('listbox');
        expect(list.getAttribute('aria-label')).toBe('files');
        expect(list.getAttribute('tabindex')).toBe('0');

        const row = container.querySelector('.vt-row') as HTMLElement;
        expect(row.getAttribute('role')).toBe('option');
        // Only a window of rows is mounted, so the position within the whole
        // collection has to be spelled out.
        expect(row.getAttribute('aria-posinset')).toBe('1');
        expect(row.getAttribute('aria-setsize')).toBe(String(TOTAL));
    });

    it('moves with the arrows and commits with Enter', async () => {
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

        await press(container, 'ArrowDown', 3);
        expect(active(container)?.textContent).toBe('item 2');

        await press(container, 'Enter');
        expect(clicks).toEqual([[2, 2]]);
        expect(selections).toEqual([2]);
        expect(active(container)?.getAttribute('aria-selected')).toBe('true');
    });

    it('scrolls the cursor into view, fetching what that needs', async () => {
        const { container } = render(<VirtualTable<number> fetcher={source} renderer={renderer} />);
        await settle();

        await press(container, 'End');
        await settle();

        // 5 rows fit, so the last one sits at the bottom of the last screen.
        expect(viewport(container).scrollTop).toBe(TOTAL * layout.row - layout.viewport);
        expect(active(container)?.textContent).toBe('item 99');

        await press(container, 'PageUp');
        await settle();
        expect(active(container)?.textContent).toBe('item 94');
        expect(viewport(container).scrollTop).toBe(94 * layout.row);
    });

    it('leaves keys alone when they start inside a row', async () => {
        // A renderer is free to put something focusable in a row. Keys pressed
        // there are its own; the list must neither move the cursor nor
        // preventDefault the button's native activation.
        const selections: Array<number> = [];
        const { container } = render(
            <VirtualTable<number>
                fetcher={source}
                renderer={(item) => <button type="button">{`item ${item}`}</button>}
                onSelected={(index) => selections.push(index)}
            />,
        );
        await settle();

        const button = container.querySelector('.vt-row button') as HTMLElement;
        fireEvent.keyDown(button, { key: 'ArrowDown' });
        fireEvent.keyDown(button, { key: ' ' });
        await act(async () => {});

        expect(viewport(container).getAttribute('aria-activedescendant')).toBeNull();
        expect(selections).toEqual([]);
    });

    it('keeps the cursor where the keys put it, whatever the pointer does', async () => {
        const { container } = render(<VirtualTable<number> fetcher={source} renderer={renderer} />);
        await settle();

        await press(container, 'ArrowDown', 2);
        const before = viewport(container).getAttribute('aria-activedescendant');
        expect(active(container)?.textContent).toBe('item 1');

        // The rows scroll under an idle pointer, and each one fires mouseenter
        // as it passes. None of that is the keyboard cursor moving.
        const rows = container.querySelectorAll('.vt-row');
        fireEvent.mouseEnter(rows[4]);
        fireEvent.mouseLeave(viewport(container));
        await act(async () => {});

        expect(viewport(container).getAttribute('aria-activedescendant')).toBe(before);

        // A click is different: it is the user pointing at a row, so the keys
        // continue from there.
        fireEvent.click(rows[4]);
        await press(container, 'ArrowDown');
        expect(active(container)?.textContent).toBe('item 5');
    });
});
