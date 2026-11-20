// ---------- Oxide Workbench task checks ----------
// Shared by the app (ui/app.js) and the test harness (tests/harness.js), so a check means the same thing in both.
//
// Check types:
//   out     stdout contains `value` (and the program ran with exit code 0)
//   ok      the program ran with exit code 0
//   code    the source contains `value`
//   nocode  the source does not contain `value`
// For code and nocode, `value` is plain text or a regex with a `re:` prefix, and comments are removed from the
// source first, so a TODO comment cannot satisfy a check and commented-out code cannot fail one. String literals
// are kept as they are. Prefer a regex that accepts every reasonable way of writing the answer (spacing, a `{}`
// argument instead of an inline `{name}`, a different lifetime name) over the exact text of the solution.
(function (root) {
  // Replace // and /* */ comments (Rust block comments nest) with spaces, leaving strings, raw strings, char
  // literals and lifetimes untouched. Newlines are kept so line structure does not change.
  function stripComments(src) {
    let out = '', i = 0;
    const n = src.length;
    const isIdent = (ch) => !!ch && /[A-Za-z0-9_]/.test(ch);
    while (i < n) {
      const c = src[i], d = src[i + 1];
      if (c === '/' && d === '/') {
        while (i < n && src[i] !== '\n') i++;
        out += ' ';
        continue;
      }
      if (c === '/' && d === '*') {
        let depth = 1; i += 2;
        while (i < n && depth > 0) {
          if (src[i] === '/' && src[i + 1] === '*') { depth++; i += 2; }
          else if (src[i] === '*' && src[i + 1] === '/') { depth--; i += 2; }
          else { if (src[i] === '\n') out += '\n'; i++; }
        }
        out += ' ';
        continue;
      }
      if ((c === 'r' || (c === 'b' && d === 'r')) && !isIdent(src[i - 1])) {
        const m = /^b?r(#*)"/.exec(src.slice(i, i + 260));
        if (m) {
          const close = '"' + m[1];
          const end = src.indexOf(close, i + m[0].length);
          const stop = end < 0 ? n : end + close.length;
          out += src.slice(i, stop); i = stop;
          continue;
        }
      }
      if (c === '"') {
        let j = i + 1;
        while (j < n && src[j] !== '"') j += src[j] === '\\' ? 2 : 1;
        out += src.slice(i, j + 1); i = j + 1;
        continue;
      }
      if (c === "'") {
        const m = /^'(?:\\(?:u\{[0-9a-fA-F_]+\}|x[0-9a-fA-F]{2}|.)|[^\\'\n])'/.exec(src.slice(i, i + 16));
        if (m) { out += m[0]; i += m[0].length; continue; }
      }
      out += c; i++;
    }
    return out;
  }

  function sourceMatches(value, code) {
    return value.startsWith('re:') ? new RegExp(value.slice(3)).test(code) : code.includes(value);
  }

  // run: { kind: 'ok' | 'compile' | 'panic' | ..., stdout: string }. code: the program's source.
  function checkPasses(check, run, code) {
    const okRun = !!run && run.kind === 'ok';
    const stdout = okRun ? String(run.stdout || '').replace(/\r\n/g, '\n') : '';
    const src = stripComments(String(code || ''));
    switch (check.type) {
      case 'ok': return okRun;
      case 'out': return okRun && stdout.includes(check.value);
      case 'code': return sourceMatches(check.value, src);
      case 'nocode': return !sourceMatches(check.value, src);
      default: return false;
    }
  }

  const api = { stripComments, checkPasses };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OxideChecks = api;
})(typeof window !== 'undefined' ? window : this);
