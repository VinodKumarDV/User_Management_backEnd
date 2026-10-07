"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toSearchRegexes = exports.parseUserDirectoryQuery = exports.isUserStatus = void 0;
const isUserStatus = (value) => value === 'Active' || value === 'Inactive';
exports.isUserStatus = isUserStatus;
const parseUserDirectoryQuery = (params) => {
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
    if (status !== undefined && !(0, exports.isUserStatus)(status)) {
        return { valid: false, message: 'Status must be Active or Inactive.' };
    }
    return {
        valid: true,
        query: {
            page,
            pageSize,
            search: search.trim(),
            ...((0, exports.isUserStatus)(status) ? { status } : {}),
        },
    };
};
exports.parseUserDirectoryQuery = parseUserDirectoryQuery;
const toSearchRegexes = (search) => search
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
exports.toSearchRegexes = toSearchRegexes;
