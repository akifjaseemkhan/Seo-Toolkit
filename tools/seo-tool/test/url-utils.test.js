import test from 'node:test';
import assert from 'node:assert/strict';
import { toAbsoluteUrl, isHttpUrl, normalizeForDedup, isSameOrigin, findDuplicates } from '../lib/url-utils.js';

test('toAbsoluteUrl resolves relative hrefs against a base', () => {
  assert.equal(toAbsoluteUrl('/foo', 'https://example.com/bar/'), 'https://example.com/foo');
  assert.equal(toAbsoluteUrl('baz', 'https://example.com/bar/'), 'https://example.com/bar/baz');
  assert.equal(toAbsoluteUrl('https://other.com/x', 'https://example.com/'), 'https://other.com/x');
});

test('toAbsoluteUrl returns null for non-navigable or invalid hrefs', () => {
  assert.equal(toAbsoluteUrl('javascript:void(0)', 'https://example.com/'), null);
  assert.equal(toAbsoluteUrl('mailto:a@b.com', 'https://example.com/'), null);
  assert.equal(toAbsoluteUrl('', 'https://example.com/'), null);
  assert.equal(toAbsoluteUrl(undefined, 'https://example.com/'), null);
});

test('isHttpUrl accepts only http/https', () => {
  assert.equal(isHttpUrl('https://example.com'), true);
  assert.equal(isHttpUrl('http://example.com'), true);
  assert.equal(isHttpUrl('ftp://example.com'), false);
  assert.equal(isHttpUrl('not a url'), false);
});

test('normalizeForDedup folds host case and default ports but preserves path/trailing slash/query', () => {
  assert.equal(normalizeForDedup('https://EXAMPLE.com:443/Foo'), 'https://example.com/Foo');
  assert.equal(normalizeForDedup('http://example.com:80/foo'), 'http://example.com/foo');
  assert.equal(normalizeForDedup('https://example.com/foo/'), 'https://example.com/foo/');
  assert.equal(normalizeForDedup('https://example.com/foo'), 'https://example.com/foo');
  assert.notEqual(normalizeForDedup('https://example.com/foo/'), normalizeForDedup('https://example.com/foo'));
  assert.equal(normalizeForDedup('https://example.com/foo?x=1'), 'https://example.com/foo?x=1');
});

test('normalizeForDedup strips the fragment', () => {
  assert.equal(normalizeForDedup('https://example.com/foo#section'), 'https://example.com/foo');
});

test('isSameOrigin compares scheme + host + effective port', () => {
  assert.equal(isSameOrigin('https://example.com/a', 'https://example.com/b'), true);
  assert.equal(isSameOrigin('https://example.com/a', 'http://example.com/a'), false);
  assert.equal(isSameOrigin('https://example.com/a', 'https://other.com/a'), false);
  assert.equal(isSameOrigin('https://example.com:443/a', 'https://example.com/a'), true);
  assert.equal(isSameOrigin('https://example.com:8443/a', 'https://example.com/a'), false);
});

test('findDuplicates groups URLs that normalize to the same key', () => {
  const urls = ['https://example.com/a', 'https://EXAMPLE.com/a', 'https://example.com/b', 'https://example.com/a#frag'];
  const dupes = findDuplicates(urls);
  const keys = Object.keys(dupes);
  assert.equal(keys.length, 1);
  assert.equal(dupes[keys[0]].length, 3);
});
