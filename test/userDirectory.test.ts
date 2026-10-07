import assert from 'node:assert/strict';
import test from 'node:test';
import { parseUserDirectoryQuery, toSearchRegexes } from '../src/userDirectory';

test('directory query uses safe defaults', () => {
    assert.deepEqual(parseUserDirectoryQuery({}), {
        valid: true,
        query: { page: 1, pageSize: 10, search: '' },
    });
});

test('directory query normalizes search and accepts a valid status', () => {
    assert.deepEqual(parseUserDirectoryQuery({ page: '2', pageSize: '25', search: '  Ada Lovelace  ', status: 'Active' }), {
        valid: true,
        query: { page: 2, pageSize: 25, search: 'Ada Lovelace', status: 'Active' },
    });
});

test('directory query rejects invalid pagination, search, and status values', () => {
    assert.equal(parseUserDirectoryQuery({ page: '0' }).valid, false);
    assert.equal(parseUserDirectoryQuery({ pageSize: '101' }).valid, false);
    assert.equal(parseUserDirectoryQuery({ search: 'x'.repeat(101) }).valid, false);
    assert.equal(parseUserDirectoryQuery({ status: 'Pending' }).valid, false);
});

test('search treats entered characters literally and matches multiple terms without case sensitivity', () => {
    const [literal, secondTerm] = toSearchRegexes('ada.* LOVELACE');
    assert.ok(literal);
    assert.ok(secondTerm);
    assert.equal(literal.test('Ada.*'), true);
    assert.equal(literal.test('AdaXYZ'), false);
    assert.equal(secondTerm.test('Lovelace'), true);
});