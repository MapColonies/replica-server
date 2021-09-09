// TODO: implement pick and rename of multiple keys
export type PickRename<T, K extends keyof T, R extends PropertyKey> = Omit<T, K> & { [P in R]: T[K] };

export type SortFilter = 'asc' | 'desc';
