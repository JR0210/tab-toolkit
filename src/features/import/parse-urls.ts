/**
 * A single well-formed, normalized URL parsed from one line of pasted text.
 * `input` is the trimmed line content (whitespace stripped, otherwise
 * verbatim); `url` is the normalized, stringified `URL`.
 */
export interface ParsedUrl {
  line: number
  input: string
  url: string
}

/** A line that could not be turned into a web URL, with a human reason why. */
export interface UrlParseIssue {
  line: number
  input: string
  reason: string
}

const BARE_LOCALHOST_PATTERN = /^localhost(?::|\/|$)/i

/**
 * Parses newline-separated pasted text into normalized, valid web URLs plus
 * line-specific errors for everything else. Line numbers are 1-indexed and
 * count every line in the input, including blank ones, so a reported line
 * number always matches what the user sees in a plain textarea. Blank lines
 * are skipped silently -- they're neither valid nor invalid.
 *
 * Only `http:`/`https:` URLs are accepted. A bare `localhost` host (with an
 * optional port/path and no explicit scheme) is special-cased and normalized
 * to `http://localhost...`, matching how browsers commonly treat it; no
 * other bare hostname gets this treatment; `127.0.0.1` for example needs an
 * explicit scheme.
 */
export function parseUrlLines(text: string): { valid: ParsedUrl[]; invalid: UrlParseIssue[] } {
  const valid: ParsedUrl[] = []
  const invalid: UrlParseIssue[] = []

  text.split('\n').forEach((rawLine, index) => {
    const line = index + 1
    const input = rawLine.trim()

    if (input.length === 0) {
      return
    }

    const candidate = BARE_LOCALHOST_PATTERN.test(input) ? `http://${input}` : input

    let parsed: URL

    try {
      parsed = new URL(candidate)
    } catch {
      invalid.push({ line, input, reason: 'Invalid URL' })
      return
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      invalid.push({ line, input, reason: 'Only HTTP and HTTPS URLs are supported' })
      return
    }

    valid.push({ line, input, url: parsed.toString() })
  })

  return { valid, invalid }
}
