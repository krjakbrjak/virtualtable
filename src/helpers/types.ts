export interface Result<Type> {
    from: number;
    items: Array<Type>;
    totalCount: number;
}

export type Fetcher<Type> = (index: number, count: number) => Promise<Result<Type>>;

export interface Style {
    hover: string;
    select: string;
    item: string;
}
