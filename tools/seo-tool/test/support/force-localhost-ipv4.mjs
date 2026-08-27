// Test-only support file — never imported by production code (nothing
// under lib/ or cli.js references this). Loaded via `node --import` as a
// preload for the one CLI integration test that needs the literal
// "localhost" hostname to resolve deterministically inside a real
// subprocess.
//
// Why this exists: a handful of tests need to prove that a request to the
// literal hostname "localhost" is treated correctly end-to-end. Letting the
// OS/Node resolve "localhost" itself is not deterministic across platforms
// and Node versions — it can pick either the IPv4 or IPv6 loopback address,
// and whether/how fast a fallback to the other family happens if only one
// is actually listening is undocumented, version-dependent behavior (this
// is what made the previous dual-stack-listener approach unreliable on
// GitHub Actions' ubuntu-latest + Node 20). Rather than guess at that
// behavior or stand up a second listener on a different address family,
// this takes control of the one thing that's actually ambiguous — hostname
// resolution — using Node's own documented `dns.lookup` API (including its
// documented `{ all: true }` array-callback shape, which is what Node's
// `net` internals actually request under the hood): forcing "localhost" to
// resolve to the IPv4 loopback address only, so the real fixture server
// (already proven to work in this repo's CI, since it's the same
// 127.0.0.1-only pattern every other test here uses) is reachable
// regardless of what the host environment's own resolver would have done.
// Everything else about the request — the real socket connection, the real
// production fetchOnce/fetchFollowingRedirects code, the real
// isPrivateNetworkTarget check applied to the literal string "localhost" —
// is completely unaffected and still exercised for real.

import dns from 'node:dns';

const originalLookup = dns.lookup;

dns.lookup = (hostname, options, callback) => {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  if (hostname !== 'localhost') {
    return originalLookup(hostname, options, callback);
  }
  if (options && options.all) {
    return process.nextTick(callback, null, [{ address: '127.0.0.1', family: 4 }]);
  }
  return process.nextTick(callback, null, '127.0.0.1', 4);
};
