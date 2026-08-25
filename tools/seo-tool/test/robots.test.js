import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRobotsTxt, getRulesForAgent, isPathAllowed, checkImportantPathConflicts } from '../lib/robots.js';

test('parseRobotsTxt groups consecutive User-agent lines and attaches following rules', () => {
  const text = `
User-agent: *
Disallow: /admin
Disallow: /cart

User-agent: Googlebot
User-agent: Bingbot
Disallow: /private

Sitemap: https://example.com/sitemap.xml
`;
  const parsed = parseRobotsTxt(text);
  assert.equal(parsed.groups.length, 2);
  assert.deepEqual(parsed.groups[0].agents, ['*']);
  assert.equal(parsed.groups[0].rules.length, 2);
  assert.deepEqual(parsed.groups[1].agents, ['Googlebot', 'Bingbot']);
  assert.equal(parsed.groups[1].rules.length, 1);
  assert.deepEqual(parsed.sitemaps, ['https://example.com/sitemap.xml']);
});

test('parseRobotsTxt ignores comments and blank lines', () => {
  const text = `# comment\nUser-agent: *\n# another comment\nDisallow: /x\n\n`;
  const parsed = parseRobotsTxt(text);
  assert.equal(parsed.groups[0].rules[0].path, '/x');
});

test('parseRobotsTxt records unknown directives without failing', () => {
  const parsed = parseRobotsTxt('User-agent: *\nDisallow: /x\nRequest-rate: 1/10');
  assert.equal(parsed.unknownDirectives.length, 1);
  assert.equal(parsed.unknownDirectives[0].field, 'request-rate');
});

test('getRulesForAgent prefers an exact match over the wildcard group', () => {
  const parsed = parseRobotsTxt('User-agent: *\nDisallow: /everything\n\nUser-agent: Googlebot\nDisallow: /only-google\n');
  const rules = getRulesForAgent(parsed, 'Googlebot');
  assert.deepEqual(rules, [{ type: 'disallow', path: '/only-google' }]);
});

test('getRulesForAgent falls back to wildcard when no exact match exists', () => {
  const parsed = parseRobotsTxt('User-agent: *\nDisallow: /everything\n');
  const rules = getRulesForAgent(parsed, 'SomeOtherBot');
  assert.deepEqual(rules, [{ type: 'disallow', path: '/everything' }]);
});

test('isPathAllowed: empty Disallow means no restriction', () => {
  const { allowed } = isPathAllowed([{ type: 'disallow', path: '' }], '/anything');
  assert.equal(allowed, true);
});

test('isPathAllowed: simple prefix Disallow blocks matching paths', () => {
  const rules = [{ type: 'disallow', path: '/admin' }];
  assert.equal(isPathAllowed(rules, '/admin/users').allowed, false);
  assert.equal(isPathAllowed(rules, '/public').allowed, true);
});

test('isPathAllowed: longest match wins, and Allow can carve out an exception', () => {
  const rules = [
    { type: 'disallow', path: '/blog' },
    { type: 'allow', path: '/blog/public' },
  ];
  assert.equal(isPathAllowed(rules, '/blog/private').allowed, false);
  assert.equal(isPathAllowed(rules, '/blog/public/post-1').allowed, true);
});

test('isPathAllowed: wildcard and end-anchor patterns', () => {
  const rules = [{ type: 'disallow', path: '/*.pdf$' }];
  assert.equal(isPathAllowed(rules, '/files/report.pdf').allowed, false);
  assert.equal(isPathAllowed(rules, '/files/report.pdf.html').allowed, true);
});

test('isPathAllowed: ties resolve to Allow', () => {
  const rules = [
    { type: 'disallow', path: '/x/y' },
    { type: 'allow', path: '/x/y' },
  ];
  assert.equal(isPathAllowed(rules, '/x/y').allowed, true);
});

test('checkImportantPathConflicts flags blocked important paths', () => {
  const parsed = parseRobotsTxt('User-agent: *\nDisallow: /products\n');
  const conflicts = checkImportantPathConflicts(parsed, ['/products/widget', '/about'], '*');
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].path, '/products/widget');
});
