import { render, act } from '@testing-library/react';

import VirtualTable from '../VirtualTable';
import { DataSource, Result } from '../helpers/types';
import { layout } from './setup';

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

async function settle() {
    for (let i = 0; i < 4; i += 1) {
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });
    }
}

describe('a row taller than the viewport', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('still loads and renders', async () => {
        // Fewer than one row fits, so the rows-per-page calculation rounds to
        // zero and the page index is derived by dividing by it.
        layout.row = 200;
        layout.viewport = 100;

        const source = new Source();
        const { container } = render(<VirtualTable<number> fetcher={source} renderer={renderer} />);
        await settle();

        expect(source.calls.length).toBeGreaterThan(1);
        expect(source.calls.every((c) => c.count > 0)).toBe(true);
        expect(source.calls.every((c) => Number.isFinite(c.index))).toBe(true);
        expect(container.querySelector('table')?.textContent).toContain('item 0');
    });
});
