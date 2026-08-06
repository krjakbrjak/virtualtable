import { get_items } from '../helpers/collections';
import { Data, Status } from '../helpers/types';

describe('Helpers', () => {
    beforeEach(() => {});

    afterEach(() => {});

    it('collections', () => {
        const data: Data<number> = {
            pageSize: 3,
            totalCount: 10,
            pages: {
                0: Status.Loading,
                1: [3, 4, 5],
                2: [6, 7, 8],
            },
        };

        expect(get_items(4, data)).toEqual([4, 5, 6]);
        expect(get_items(2, data)).toEqual([undefined, 3, 4]);
        expect(get_items(8, data)).toEqual([8, undefined]);
    });
});
