import { LazyPaginatedCollection } from '../helpers/LazyPaginatedCollection';
import { slideItems } from '../helpers/collections';
import { DataSource, Result } from '../helpers/types';

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

    it('LazyPaginatedCollection', (done) => {
        const collection = new LazyPaginatedCollection<number>(
            COLLECTION_PAGE_SIZE,
            new TestSource()
        );

        const all = [];
        all.push(collection.slice(1021367, 1)
            .then((value) => {
                expect(value.items.length).toBe(0);
            }));

        all.push(collection.slice(-2, 1)
            .then((value) => {
                expect(value.items.length).toBe(0);
            }));

        all.push(collection.slice(254, 1)
            .then((value) => {
                expect(value.items[0]).toBe(254);
                expect(value.offset).toBe(254);
            }));

        all.push(collection.slice(234, 10)
            .then((result) => {
                expect(result.items).toEqual([...Array(10).keys()].map((value) => value + 234));
                expect(result.offset).toEqual(234);
            }));

        all.push(collection.slice(0, 3)
            .then((result) => {
                expect(result.items).toEqual([...Array(3).keys()]);
            }));

        all.push(collection.slice(3, 27)
            .then((result) => {
                expect(result.items).toEqual([...Array(27).keys()].map((value) => value + 3));
                expect(collection.count()).toEqual(COLLECTION_COUNT);
            }));

        all.push(collection.slice(-1, 27)
            .then((result) => {
                expect(result.items).toEqual([]);
            }));

        all.push(collection.slice(-1, -27)
            .then((result) => {
                expect(result.items).toEqual([]);
            }));

        all.push(collection.slice(1231, 35)
            .then((result) => {
                expect(result.items).toEqual([1231, 1232, 1233]);
            }));

        Promise.all(all).then(() => done());
    });

    it('collections', () => {
        const items = [0, 1, 2];

        expect(slideItems(4, { items, offset: 3 })).toEqual([1, 2, undefined]);
        expect(slideItems(2, { items, offset: 3 })).toEqual([undefined, 0, 1]);
        expect(slideItems(7, { items, offset: 3 })).toEqual([undefined, undefined, undefined]);
    });
});
