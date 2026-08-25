# Security & Safety Checklist

Run before and after any implementation, alongside `checklists/final-regression-checklist.md`. This checklist exists because SEO changes routinely touch files (routing, headers, config, public metadata) adjacent to security-sensitive surfaces. See [[../rules/zero-breakage]].

## Before implementing
- [ ] Confirmed the change doesn't touch authentication or authorization code
- [ ] Confirmed the change doesn't touch payment/checkout logic
- [ ] Confirmed the change doesn't touch API route handlers' logic (adding a route ≠ touching handler logic elsewhere)
- [ ] Confirmed the change doesn't touch database access/query logic
- [ ] Confirmed the change doesn't touch WebSocket/realtime connection logic
- [ ] Confirmed no secrets, API keys, or credentials are being introduced into client-visible code (meta tags, JSON-LD, sitemap, robots.txt, or committed config)

## robots.txt / sitemap specific
- [ ] Confirmed no private/internal paths are being newly exposed via `robots.txt` `Disallow` entries revealing their existence (see [[../rules/indexing-rules]])
- [ ] Confirmed sitemap doesn't leak private, user-specific, or draft URLs

## Structured data / metadata specific
- [ ] Confirmed no PII is being placed into schema or metadata beyond what the user has explicitly approved as public-facing (e.g., a real business phone number is fine if the business publishes it; a customer's personal data is never fine)

## Third-party scripts / tags
- [ ] Any new third-party script (verification tags, tracking pixels) reviewed for what data it collects before adding
- [ ] No new third-party script added without the user's awareness of what it is and why

## After implementing
- [ ] `git diff` reviewed in full for anything unexpected (a broad find/replace catching more than intended, an accidental credential/config change)
- [ ] No new console errors related to security (CSP violations, mixed content, blocked resources)
- [ ] No new files created outside the intended scope

## Escalation
- [ ] Any security concern discovered *incidentally* during SEO work (e.g., private content reachable without auth, secrets committed to the repo) reported to the user immediately and separately from the SEO findings — do not silently fix or silently ignore
