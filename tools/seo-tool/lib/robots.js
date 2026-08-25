// robots.txt parsing and rule evaluation. Pure text-in, facts-out — this
// module never writes to robots.txt and never claims robots.txt is an
// access-control mechanism (see ROBOTS_NOT_SECURITY_NOTE, and
// rules/indexing-rules.md).

export const ROBOTS_NOT_SECURITY_NOTE =
  'robots.txt is a crawl-behavior hint, not access control or privacy. A Disallow rule does not prevent a URL from being fetched directly, and listing a sensitive-looking path here can advertise that it exists. It also does not by itself guarantee a URL stays out of the index — see checklists/indexing-checklist.md and rules/indexing-rules.md for the correct tool (noindex) for that goal.';

/** Parse robots.txt text into groups of {agents, rules[], crawlDelay?}, plus top-level sitemap declarations. */
export function parseRobotsTxt(text) {
  const lines = String(text || '').split(/\r\n|\r|\n/);
  const groups = [];
  const sitemaps = [];
  const unknownDirectives = [];
  let current = null;
  let groupHasRules = false;

  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    switch (field) {
      case 'user-agent': {
        if (!current || groupHasRules) {
          current = { agents: [value], rules: [] };
          groups.push(current);
          groupHasRules = false;
        } else {
          current.agents.push(value);
        }
        break;
      }
      case 'disallow':
        if (!current) {
          current = { agents: ['*'], rules: [] };
          groups.push(current);
        }
        current.rules.push({ type: 'disallow', path: value });
        groupHasRules = true;
        break;
      case 'allow':
        if (!current) {
          current = { agents: ['*'], rules: [] };
          groups.push(current);
        }
        current.rules.push({ type: 'allow', path: value });
        groupHasRules = true;
        break;
      case 'crawl-delay':
        if (current) {
          current.crawlDelay = value;
          groupHasRules = true;
        }
        break;
      case 'sitemap':
        if (value) sitemaps.push(value);
        break;
      default:
        unknownDirectives.push({ field, value });
    }
  }

  return { groups, sitemaps, unknownDirectives };
}

function pathRuleToRegex(rulePath) {
  let pattern = rulePath;
  let endAnchor = false;
  if (pattern.endsWith('$')) {
    endAnchor = true;
    pattern = pattern.slice(0, -1);
  }
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp('^' + escaped + (endAnchor ? '$' : ''));
}

/**
 * Collect the effective rule set for a user-agent: an exact (case-insensitive)
 * match on declared agent tokens if one exists, otherwise every group that
 * declares '*'. When multiple groups match, their rules are combined — the
 * spec is ambiguous about this case, so this is a documented, conservative
 * choice rather than a claim of one canonical behavior.
 */
export function getRulesForAgent(parsed, userAgent = '*') {
  const ua = userAgent.toLowerCase();
  const exact = parsed.groups.filter((g) => g.agents.some((a) => a.toLowerCase() === ua));
  const source = exact.length ? exact : parsed.groups.filter((g) => g.agents.some((a) => a.trim() === '*'));
  const rules = [];
  for (const g of source) rules.push(...g.rules);
  return rules;
}

/**
 * Longest-match-wins evaluation (Google's documented algorithm): the most
 * specific (longest path) matching rule applies; ties resolve to Allow.
 * An empty Disallow value means "no restriction" per spec, so it never
 * matches anything.
 */
export function isPathAllowed(rules, path) {
  let best = null;
  for (const rule of rules) {
    if (rule.path === '') continue; // empty Disallow = no restriction; empty Allow = no-op
    const regex = pathRuleToRegex(rule.path);
    if (!regex.test(path)) continue;
    const specificity = rule.path.length;
    if (!best || specificity > best.specificity || (specificity === best.specificity && rule.type === 'allow')) {
      best = { type: rule.type, path: rule.path, specificity };
    }
  }
  if (!best) return { allowed: true, matchedRule: null };
  return { allowed: best.type === 'allow', matchedRule: { type: best.type, path: best.path } };
}

/**
 * Facts-only conflict flagging: which of the given "important" paths
 * (e.g. sitemap URLs, or paths the user named) are blocked for the given
 * user-agent. Interpretation of severity belongs to the SEO reasoning
 * layer, not this function.
 */
export function checkImportantPathConflicts(parsed, importantPaths, userAgent = '*') {
  const rules = getRulesForAgent(parsed, userAgent);
  const conflicts = [];
  for (const path of importantPaths) {
    const { allowed, matchedRule } = isPathAllowed(rules, path);
    if (!allowed) {
      conflicts.push({ path, blockedBy: matchedRule, userAgent });
    }
  }
  return conflicts;
}
