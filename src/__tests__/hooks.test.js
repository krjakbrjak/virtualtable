import { renderHook, act } from '@testing-library/react-hooks';
import { useCollection, usePage } from '../hooks';

describe('Hooks', () => {
    const COLLECTION_COUNT = 1234;
    const COLLECTION_PAGE_SIZE = 3;

    const fetcher = (index, count) => new Promise((resolve, reject) => {
        if (index > COLLECTION_COUNT - 1 || index < 0 || count < 0) {
            reject(new RangeError());
        } else {
            const tmp = Math.min(count, COLLECTION_COUNT - index);
            const items = [...Array(tmp).keys()].map((value) => value + index);
            resolve({
                from: index,
                items,
                totalCount: COLLECTION_COUNT,
            });
        }
    });

    it('useCollection', () => {
        const { result } = renderHook(() => useCollection(fetcher));

        expect(result.current.items.at(134)).resolves.toBe(134);
        // By default the size of the page is set to 1
        expect(result.current.items.pageSize()).toBe(1);

        act(() => {
            result.current.setPageCount(COLLECTION_PAGE_SIZE);
            expect(result.current.items.pageSize()).toBe(1);
        });

        expect(result.current.items.pageSize()).toBe(COLLECTION_PAGE_SIZE);
    });

    it('usePage', async () => {
        const { result, waitForNextUpdate } = renderHook(() => usePage(fetcher));

        await waitForNextUpdate();
        expect(result.current.pageOffset).toBe(0);

        act(() => {
            result.current.setPageOffset(19);
        });

        expect(result.current.pageOffset).toBe(19);
        // have to wait for the next update since fetching of
        // the items happens async
        await waitForNextUpdate();
        expect(result.current.page.offset).toBe(19);
        expect(result.current.page.items).toEqual([19]);

        act(() => {
            result.current.setPageCount(COLLECTION_PAGE_SIZE);
        });

        await waitForNextUpdate();
        expect(result.current.page.items).toEqual([19, 20, 21]);
    });
});
