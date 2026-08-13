import { render, act } from '@testing-library/react';

import VirtualTable from '../VirtualTable';
import { DataSource, Result } from '../helpers/types';
import { layout, resize } from './setup';

const TOTAL = 100;

const renderer = (item: number | undefined) => (
    <span>{item === undefined ? 'loading' : `item ${item}`}</span>
);

class Source implements DataSource<number> {
    calls: Array<{ index: number; count: number }> = [];

    fetch(index: number, count: number): Promise<Result<number>> {
        this.calls.push({ index, count });
        return Promise.resolve({
            from: index,
            items: [...Array(count).keys()].map((i) => i + index),
            totalCount: TOTAL,
        });
    }
}

// Page fetches, as opposed to the single-item fetches the probe makes.
function pages(source: Source) {
    return source.calls.filter((c) => c.count > 1);
}

async function settle() {
    for (let i = 0; i < 4; i += 1) {
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });
    }
}

describe('a table mounted inside a container that is not displayed', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('measures and fills in once the container is shown', async () => {
        // Everything inside a `display: none` ancestor measures zero, which is
        // indistinguishable from a row that has not been laid out yet.
        layout.row = 0;

        const source = new Source();
        const { container } = render(<VirtualTable<number> fetcher={source} renderer={renderer} />);
        await settle();

        // Nothing can be sized, so nothing is fetched: the table would once
        // have stayed this way for as long as it was mounted.
        expect(container.querySelector('.vt-row')).toBeNull();
        expect(pages(source)).toEqual([]);

        layout.row = 20;
        await act(async () => {
            resize(container.querySelector('.vt-probe'));
        });
        await settle();

        expect(container.querySelector('.vt-list')?.textContent).toContain('item 0');
        expect(pages(source).length).toBeGreaterThan(0);
    });

    it('keeps the collection when it is hidden and shown again', async () => {
        const source = new Source();
        const { container } = render(<VirtualTable<number> fetcher={source} renderer={renderer} />);
        await settle();

        const fetched = pages(source).length;
        expect(fetched).toBeGreaterThan(0);

        // Hidden: the zero this reports says nothing about the row, so the
        // pages already loaded have to survive it.
        layout.row = 0;
        await act(async () => {
            resize(container.querySelector('.vt-probe'));
        });
        layout.row = 20;
        await act(async () => {
            resize(container.querySelector('.vt-probe'));
        });
        await settle();

        expect(container.querySelector('.vt-list')?.textContent).toContain('item 0');
        expect(pages(source).length).toBe(fetched);
    });

    it('re-pages when the row height changes', async () => {
        const source = new Source();
        const { container } = render(<VirtualTable<number> fetcher={source} renderer={renderer} />);
        await settle();

        const before = 2 * Math.floor(layout.viewport / layout.row);
        expect(pages(source).every((c) => c.count === before)).toBe(true);

        layout.row = 50;
        await act(async () => {
            resize(container.querySelector('.vt-probe'));
        });
        await settle();

        const after = 2 * Math.floor(layout.viewport / layout.row);
        expect(after).not.toBe(before);
        expect(pages(source).at(-1)?.count).toBe(after);
    });
});
