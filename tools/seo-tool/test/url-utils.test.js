import test from 'node:test';
import assert from 'node:assert/strict';
import { toAbsoluteUrl, isHttpUrl, normalizeForDedup, isSameOrigin, findDuplicates, isPrivateNetworkTarget } from '../lib/url-utils.js';

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

// ---------- isPrivateNetworkTarget (SSRF hardening policy) ----------

test('isPrivateNetworkTarget allows ordinary public URLs', () => {
  assert.equal(isPrivateNetworkTarget('http://example.com/'), false);
  assert.equal(isPrivateNetworkTarget('https://example.com/path?q=1'), false);
  assert.equal(isPrivateNetworkTarget('https://8.8.8.8/'), false);
});

test('isPrivateNetworkTarget always allows the documented local-development targets', () => {
  assert.equal(isPrivateNetworkTarget('http://localhost/'), false);
  assert.equal(isPrivateNetworkTarget('http://LOCALHOST:3000/'), false);
  assert.equal(isPrivateNetworkTarget('http://127.0.0.1/'), false);
  assert.equal(isPrivateNetworkTarget('http://127.0.0.1:8080/path'), false);
  assert.equal(isPrivateNetworkTarget('http://[::1]/'), false, 'IPv6 loopback must also be allowed');
});

test('isPrivateNetworkTarget allows the rest of the loopback range too (127.0.0.0/8 never leaves the host)', () => {
  assert.equal(isPrivateNetworkTarget('http://127.0.0.2/'), false);
  assert.equal(isPrivateNetworkTarget('http://127.255.255.255/'), false);
});

test('isPrivateNetworkTarget blocks RFC1918 private IPv4 ranges', () => {
  assert.equal(isPrivateNetworkTarget('http://10.0.0.1/'), true);
  assert.equal(isPrivateNetworkTarget('http://10.255.255.255/'), true);
  assert.equal(isPrivateNetworkTarget('http://172.16.0.1/'), true);
  assert.equal(isPrivateNetworkTarget('http://172.31.255.255/'), true);
  assert.equal(isPrivateNetworkTarget('http://192.168.1.1/'), true);
  assert.equal(isPrivateNetworkTarget('http://192.168.255.255/'), true);
});

test('isPrivateNetworkTarget does not over-block adjacent public ranges (boundary check)', () => {
  assert.equal(isPrivateNetworkTarget('http://172.15.255.255/'), false, 'just below 172.16.0.0/12');
  assert.equal(isPrivateNetworkTarget('http://172.32.0.1/'), false, 'just above 172.16.0.0/12');
  assert.equal(isPrivateNetworkTarget('http://11.0.0.1/'), false, 'not in 10.0.0.0/8');
  assert.equal(isPrivateNetworkTarget('http://192.169.0.1/'), false, 'not in 192.168.0.0/16');
});

test('isPrivateNetworkTarget blocks link-local IPv4, including the cloud metadata address', () => {
  assert.equal(isPrivateNetworkTarget('http://169.254.169.254/latest/meta-data/'), true);
  assert.equal(isPrivateNetworkTarget('http://169.254.0.1/'), true);
});

test('isPrivateNetworkTarget blocks the unspecified/"this network" address', () => {
  assert.equal(isPrivateNetworkTarget('http://0.0.0.0/'), true);
});

test('isPrivateNetworkTarget handles IPv6 private/link-local/reserved ranges', () => {
  assert.equal(isPrivateNetworkTarget('http://[::]/'), true, 'unspecified address');
  assert.equal(isPrivateNetworkTarget('http://[fe80::1]/'), true, 'link-local fe80::/10');
  assert.equal(isPrivateNetworkTarget('http://[febf::ffff]/'), true, 'still within fe80::/10');
  assert.equal(isPrivateNetworkTarget('http://[fec0::1]/'), false, 'just outside fe80::/10');
  assert.equal(isPrivateNetworkTarget('http://[fc00::1]/'), true, 'unique-local fc00::/7');
  assert.equal(isPrivateNetworkTarget('http://[fdff::1]/'), true, 'still within fc00::/7');
  assert.equal(isPrivateNetworkTarget('http://[fe00::1]/'), false, 'just outside fc00::/7');
  assert.equal(isPrivateNetworkTarget('http://[2001:db8::1]/'), false, 'ordinary public/documentation IPv6');
});

test('isPrivateNetworkTarget catches IPv4-mapped IPv6 addresses that encode a blocked target (bypass check)', () => {
  // The WHATWG URL parser itself normalizes "::ffff:169.254.169.254" into
  // hex-group form before this function ever sees it — this confirms the
  // resulting hex form is still correctly recognized as the same blocked
  // target, closing off the most realistic literal-syntax bypass vector.
  assert.equal(isPrivateNetworkTarget('http://[::ffff:169.254.169.254]/'), true);
  assert.equal(isPrivateNetworkTarget('http://[::ffff:10.0.0.1]/'), true);
  assert.equal(isPrivateNetworkTarget('http://[::ffff:127.0.0.1]/'), false, 'IPv4-mapped loopback stays allowed');
  assert.equal(isPrivateNetworkTarget('http://[::ffff:8.8.8.8]/'), false, 'IPv4-mapped public address stays allowed');
});

test('isPrivateNetworkTarget catches NAT64-mapped IPv6 addresses that encode a blocked target (RFC 6052 well-known prefix)', () => {
  // 64:ff9b::/96 is the NAT64 well-known prefix -- a second, standard way
  // an IPv4 address ends up embedded in an IPv6 literal, functionally
  // reachable (not just a string coincidence) on networks with a
  // NAT64/DNS64 gateway configured. Same shape as the ::ffff:0:0/96 check
  // above, just a different prefix.
  assert.equal(isPrivateNetworkTarget('http://[64:ff9b::169.254.169.254]/'), true);
  assert.equal(isPrivateNetworkTarget('http://[64:ff9b::10.0.0.1]/'), true);
  assert.equal(isPrivateNetworkTarget('http://[64:ff9b::127.0.0.1]/'), false, 'NAT64-mapped loopback stays allowed');
  assert.equal(isPrivateNetworkTarget('http://[64:ff9b::8.8.8.8]/'), false, 'NAT64-mapped public address stays allowed');
});

test('isPrivateNetworkTarget is defeated by hostnames that merely look like an IP (DNS resolution is explicitly out of scope)', () => {
  // Documents the known, deliberate limitation rather than silently hoping
  // nobody notices it: a *hostname* is never resolved, only literal IPs are
  // checked. See the policy comment in lib/url-utils.js.
  assert.equal(isPrivateNetworkTarget('http://169.254.169.254.example.com/'), false);
  assert.equal(isPrivateNetworkTarget('http://127.0.0.1.nip.io/'), false);
});

test('isPrivateNetworkTarget is unaffected by credentials or hex/octal IPv4 obfuscation (both normalized away by the URL parser first)', () => {
  assert.equal(isPrivateNetworkTarget('http://user:pass@169.254.169.254/'), true);
  assert.equal(isPrivateNetworkTarget('http://0x7f.0.0.1/'), false, 'hex-encoded 127.0.0.1 normalizes to loopback and stays allowed');
  assert.equal(isPrivateNetworkTarget('http://0xa9fea9fe/'), true, 'hex-encoded 169.254.169.254 as a single 32-bit value still resolves to the metadata address');
  assert.equal(isPrivateNetworkTarget('http://2852039166/'), true, 'decimal-integer-encoded 169.254.169.254 normalizes the same way');
});

test('isPrivateNetworkTarget never throws on a malformed URL', () => {
  assert.equal(isPrivateNetworkTarget('not a url'), false);
  assert.equal(isPrivateNetworkTarget(''), false);
});
