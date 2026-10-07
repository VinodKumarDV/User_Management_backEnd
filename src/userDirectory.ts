export type UserStatus = 'Active' | 'Inactive';

export type UserDirectoryQuery = {
    page: number;
    pageSize: number;
    search: string;
    status?: UserStatus;
};

type UserDirectoryParams = {
    page?: unknown;
    pageSize?: unknown;
    search?: unknown;
    status?: unknown;
};

export type UserDirectoryQueryResult =
    | { valid: true; query: UserDirectoryQuery }
    | { valid: false; message: string };

export const isUserStatus = (value: unknown): value is UserStatus => value === 'Active' || value === 'Inactive';

export const parseUserDirectoryQuery = (params: UserDirectoryParams): UserDirectoryQueryResult => {
    const page = Number(params.page ?? 1);
    const pageSize = Number(params.pageSize ?? 10);
    const search = params.search ?? '';
    const status = params.status;

    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
        return { valid: false, message: 'Page must be positive and page size must be between 1 and 100.' };
    }
    if (typeof search !== 'string' || search.trim().length > 100) {
        return { valid: false, message: 'Search must be 100 characters or fewer.' };
    }
    if (status !== undefined && !isUserStatus(status)) {
        return { valid: false, message: 'Status must be Active or Inactive.' };
    }

    return {
        valid: true,
        query: {
            page,
            pageSize,
            search: search.trim(),
            ...(isUserStatus(status) ? { status } : {}),
        },
    };
};

export const toSearchRegexes = (search: string): RegExp[] => search
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));