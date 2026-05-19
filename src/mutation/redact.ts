/**
 * Secret redaction for Diff Preview.
 *
 * Goal: when we show the user a diff that touches mcp.json / .claude.json
 * (which contain GITHUB_TOKEN, OPENAI_API_KEY, etc), nothing sensitive
 * leaks into the UI or terminal. The redactor:
 *   1. Replaces values for explicit `envKeys` (sourced from the resource
 *      record's `envKeys` field — these are exactly the keys the adapter
 *      promised the user are env-defined).
 *   2. Replaces values whose key matches built-in suffix patterns
 *      (TOKEN / SECRET / PASSWORD / KEY / PASS / PWD) so we catch leaks
 *      the adapter didn't enumerate.
 *
 * Three syntactic positions covered, all string-level (no JSON/YAML
 * parsing required — robust against partial / broken files):
 *   - `KEY=value`          shell / args arrays
 *   - `"KEY": "value"`     JSON
 *   - `KEY: value`         YAML / frontmatter
 *
 * Pure function. No I/O.
 */

export const REDACTED = "***REDACTED***";

/**
 * Built-in suffix tests. Each requires either a leading underscore or
 * the entire key to equal the suffix — so PUBLIC_KEY and API_KEY both
 * match, but MONKEY does not.
 */
const BUILT_IN_PATTERNS: RegExp[] = [
  /(?:^|_)TOKEN$/i,
  /(?:^|_)SECRET$/i,
  /(?:^|_)PASSWORD$/i,
  /(?:^|_)PASSWD$/i,
  /(?:^|_)KEY$/i,
  /(?:^|_)PASS$/i,
  /(?:^|_)PWD$/i,
];

function shouldRedactKey(key: string, explicitKeys: Set<string>): boolean {
  if (explicitKeys.has(key)) return true;
  return BUILT_IN_PATTERNS.some((re) => re.test(key));
}

export interface RedactResult {
  redacted: string;
  /** Keys whose values were actually replaced (deduplicated, sorted). */
  redactedKeys: string[];
}

export interface RedactOptions {
  /** Explicit env key whitelist sourced from the resource record. */
  envKeys?: readonly string[];
}

/**
 * Each pattern owns:
 *   - re: regex with named or positional capture groups
 *   - keyIndex: which capture group holds the key
 *   - rewrite: takes the full match string + captured groups, returns
 *              the replacement (with REDACTED already injected)
 *
 * Compiled fresh per call so `lastIndex` state never leaks across calls.
 */
interface Pattern {
  re: RegExp;
  /** Number of capture groups in `re` (so we can ignore trailing offset/source). */
  groupCount: number;
  /** Index of the capture group containing the key. */
  keyIndex: number;
  /** Build the replacement string from the captured groups. */
  rewrite(groups: string[]): string;
}

function makePatterns(): Pattern[] {
  return [
    {
      // "KEY": "value"
      re: /"([A-Za-z_][A-Za-z0-9_]*)"\s*:\s*"([^"]*)"/g,
      groupCount: 2,
      keyIndex: 0,
      rewrite: (g) => `"${g[0]}": "${REDACTED}"`,
    },
    {
      // KEY=value (shell / args)
      re: /\b([A-Z][A-Z0-9_]+)=([^\s"',]+)/g,
      groupCount: 2,
      keyIndex: 0,
      rewrite: (g) => `${g[0]}=${REDACTED}`,
    },
    {
      // KEY: value (YAML / frontmatter)
      re: /^(\s*)([A-Z][A-Z0-9_]+)\s*:\s*([^\s][^\n]*)$/gm,
      groupCount: 3,
      keyIndex: 1,
      rewrite: (g) => `${g[0]}${g[1]}: ${REDACTED}`,
    },
  ];
}

export function redact(content: string, opts: RedactOptions = {}): RedactResult {
  const explicit = new Set(opts.envKeys ?? []);
  const hit = new Set<string>();
  let out = content;

  for (const p of makePatterns()) {
    out = out.replace(p.re, (match, ...rest) => {
      // String.replace passes (match, ...groups, offset, source[, namedGroups]).
      // Slice exactly groupCount entries; ignore the trailing positionals.
      const groups = rest.slice(0, p.groupCount) as string[];
      const key = groups[p.keyIndex];
      if (!shouldRedactKey(key, explicit)) return match;
      hit.add(key);
      return p.rewrite(groups);
    });
  }

  return { redacted: out, redactedKeys: [...hit].sort() };
}
