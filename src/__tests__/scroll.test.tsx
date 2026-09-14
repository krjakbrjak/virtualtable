import { render, act, fireEvent } from '@testing-library/react';

import VirtualTable from '../VirtualTable';
import { DataSource, Result } from '../helpers/types';
import { layout } from './setup';

const renderer = (item: number | undefined) => (
    <span>{item === undefined ? 'loading' : `item ${item}`}</span>
);

class Growing implements DataSource<number> {
    total = 1000;

    fetch(index: number, count: number): Promise<Result<number>> {
        return Promise.resolve({
            from: index,
            items: [...Array(count).keys()].map((i) => i + index),
            totalCount: this.total,
        });
    }
}

async function settle() {
    for (let i = 0; i < 3; i += 1) {
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });
    }
}

describe('scroll position after the collection is replaced', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns the scroll container to the top with the rows', async () => {
        const source = new Growing();
        const { container } = render(<VirtualTable<number> fetcher={source} renderer={renderer} />);
        await settle();

        const scroller = container.querySelector('.vt-viewport') as HTMLElement;

        // Scroll somewhere that needs a page nobody has fetched.
        scroller.scrollTop = layout.row * 60;
        fireEvent.scroll(scroller);
        await settle();
        expect(scroller.scrollTop).toBeGreaterThan(0);

        // The next page to arrive reports a different total, so the reducer
        // discards the collection and puts the model back at the top.
        source.total = 4000;
        scroller.scrollTop = layout.row * 120;
        fireEvent.scroll(scroller);
        await settle();

        const firstRow = container.querySelector('.vt-row')?.textContent;
        expect(firstRow).toContain('item 0');
        // The rows say the top; the scrollbar has to agree.
        expect(scroller.scrollTop).toBe(0);
    });
});
