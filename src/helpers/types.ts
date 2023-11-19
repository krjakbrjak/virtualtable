export interface Result<Type> {
    from: number;
    items: Array<Type>;
    totalCount: number;
}

export type Fetcher<Type> = (index: number, count: number) => Promise<Result<Type>>;
