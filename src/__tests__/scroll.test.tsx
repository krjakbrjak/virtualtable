import { render } from '@testing-library/react';

import VirtualTable from '../VirtualTable';
import { DataSource, Result } from '../helpers/types';
import { layout } from './setup';
import { renderer, scroll, settle } from './harness';

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

describe('scroll position after the total count changes', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('keeps the scroll position and adopts the new total', async () => {
        const source = new Growing();
        const { container } = render(<VirtualTable<number> fetcher={source} renderer={renderer} />);
        await settle();

        const scroller = container.querySelector('.vt-viewport') as HTMLElement;

        // Scroll somewhere that needs a page nobody has fetched.
        scroll(scroller, 60);
        await settle();
        expect(scroller.scrollTop).toBeGreaterThan(0);

        // The next page to arrive reports a different total: new information
        // about the same collection, so the view stays where it is.
        source.total = 4000;
        scroll(scroller, 120);
        await settle();

        const firstRow = container.querySelector('.vt-row')?.textContent;
        expect(firstRow).toContain('item 120');
        expect(scroller.scrollTop).toBe(layout.row * 120);
        // The spacer reflects the new total.
        const spacer = container.querySelector('.vt-spacer') as HTMLElement;
        expect(spacer.style.height).toBe(`${4000 * layout.row}px`);
    });
});
