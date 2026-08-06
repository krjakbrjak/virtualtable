import { get_items } from '../helpers/collections';
import { DataSource, Data, Result, Status } from '../helpers/types';

describe('Helpers', () => {
    const COLLECTION_COUNT = 1234;
    const COLLECTION_PAGE_SIZE = 3;

    class TestSource implements DataSource<number> {
        fetch(index: number, count: number): Promise<Result<number>> {
            return new Promise((resolve, reject) => {
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
        }
    }

    beforeEach(() => {
    });

    afterEach(() => {
    });

    it('collections', () => {
        const data: Data<number> = {
            pageSize: 3,
            totalCount: 10,
            pages: {
                0: Status.Loading,
                1: [3, 4, 5],
                2: [6, 7, 8],
            }
        };

        expect(get_items(4, data)).toEqual([4, 5, 6]);
        expect(get_items(2, data)).toEqual([undefined, 3, 4]);
        expect(get_items(8, data)).toEqual([8, undefined]);
    });
});
