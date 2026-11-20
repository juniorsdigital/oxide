// ---------- RustLite: entry point & diagnostics rendering ----------
function renderDiag(src, err, kind) {
  const lines = src.split('\n');
  const starts = [0]; for (let i = 0; i < src.length; i++) if (src[i] === '\n') starts.push(i + 1);
  const lc = (pos) => { let lo = 0, hi = starts.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= pos) lo = mid; else hi = mid - 1; } return [lo + 1, pos - starts[lo] + 1]; };
  const head = (kind || 'error') + (err.code ? '[' + err.code + ']' : '') + ': ' + err.rmsg;
  const labels = (err.labels || []).filter(Boolean).map((l) => {
    const [line, col] = lc(Math.min(l.pos, src.length));
    let [eline, ecol] = lc(Math.min(Math.max(l.end, l.pos + 1), src.length));
    let width = eline === line ? Math.max(1, ecol - col) : Math.max(1, (lines[line - 1] || '').length - col + 1);
    return { line, col, width, text: l.text || '', primary: l.primary !== false };
  });
  const prim = labels.find((l) => l.primary) || labels[0];
  const out = [{ t: 'head', s: head }];
  if (!prim) { (err.notes || []).forEach((nt) => out.push({ t: 'note', s: '  = ' + nt })); return { lines: out, line: null, col: null }; }
  const byLine = new Map();
  for (const l of labels) { if (!byLine.has(l.line)) byLine.set(l.line, []); byLine.get(l.line).push(l); }
  const nums = [...byLine.keys()].sort((a, b) => a - b);
  const gw = String(nums[nums.length - 1]).length;
  const pad = ' '.repeat(gw);
  out.push({ t: 'loc', s: pad + '--> src/main.rs:' + prim.line + ':' + prim.col });
  out.push({ t: 'gutter', s: pad + ' |' });
  let prev = null;
  for (const ln of nums) {
    if (prev !== null && ln - prev > 2) out.push({ t: 'gutter', s: '...' });
    else if (prev !== null && ln - prev === 2) out.push({ t: 'code', s: String(ln - 1).padStart(gw) + ' | ' + (lines[ln - 2] || ''), line: ln - 1 });
    out.push({ t: 'code', s: String(ln).padStart(gw) + ' | ' + (lines[ln - 1] || ''), line: ln });
    // merge labels that share a span, then draw markers on one line and texts below
    const merged = [];
    for (const l of byLine.get(ln)) {
      const same = merged.find((x) => x.col === l.col && x.width === l.width);
      if (same) { same.texts.push(l.text); same.primary = same.primary || l.primary; }
      else merged.push({ col: l.col, width: l.width, primary: l.primary, texts: [l.text] });
    }
    merged.sort((a, b) => a.col - b.col);
    // markers
    let mline = '';
    for (const l of merged) { while (mline.length < l.col - 1) mline += ' '; mline += (l.primary ? '^' : '-').repeat(l.width); }
    const anyPrimary = merged.some((l) => l.primary);
    const last = merged[merged.length - 1];
    const lastTexts = last.texts.filter(Boolean);
    const overlap = merged.some((l, i) => i > 0 && l.col <= merged[i - 1].col + merged[i - 1].width - 1);
    if (!overlap) {
      out.push({ t: anyPrimary ? 'mark' : 'mark2', s: pad + ' | ' + mline + (lastTexts[0] ? ' ' + lastTexts[0] : '') });
      const pending = [];
      for (let i = merged.length - 1; i >= 0; i--) {
        const l = merged[i];
        const ts = (i === merged.length - 1 ? l.texts.filter(Boolean).slice(1) : l.texts.filter(Boolean));
        for (const t of ts) pending.push({ col: l.col, t, primary: l.primary, idx: i });
      }
      // draw connector lines then text, right-most first
      for (const pnd of pending) {
        let bar = '';
        for (const l of merged) { if (merged.indexOf(l) > pnd.idx) continue; while (bar.length < l.col - 1) bar += ' '; if (merged.indexOf(l) <= pnd.idx && pending.some((q) => q.idx === merged.indexOf(l))) bar += '|'; }
        out.push({ t: 'mark2', s: pad + ' | ' + bar.replace(/\s+$/, '') });
        let txt = '';
        for (const l of merged) { const k = merged.indexOf(l); if (k >= pnd.idx) break; if (pending.some((q) => q.idx === k)) { while (txt.length < l.col - 1) txt += ' '; txt += '|'; } }
        while (txt.length < pnd.col - 1) txt += ' ';
        out.push({ t: pnd.primary ? 'mark' : 'mark2', s: pad + ' | ' + txt + pnd.t });
        // remove from pending bars once printed
        pnd.done = true;
        const k = pending.indexOf(pnd); void k;
        pending.filter((q) => q.idx === pnd.idx && q !== pnd);
      }
    } else {
      for (const l of merged) for (const t of (l.texts.filter(Boolean).length ? l.texts.filter(Boolean) : [''])) out.push({ t: l.primary ? 'mark' : 'mark2', s: pad + ' | ' + ' '.repeat(l.col - 1) + (l.primary ? '^' : '-').repeat(l.width) + (t ? ' ' + t : '') });
    }
    prev = ln;
  }
  if ((err.notes || []).length) { out.push({ t: 'gutter', s: pad + ' |' }); for (const nt of err.notes) out.push({ t: nt.startsWith('help') ? 'help' : 'note', s: pad + ' = ' + nt }); }
  return { lines: out, line: prim.line, col: prim.col };
}

function run(src, opts) {
  opts = opts || {};
  const out = [];
  const t0 = Date.now();
  const result = (o) => Object.assign({ output: out, ms: Date.now() - t0 }, o);
  let rt = null;
  try {
    const items = parse(src);
    const G = resolveProgram(items, src);
    rt = createRuntime(items, G, src, { out, stdin: opts.stdin, timeLimit: opts.timeLimit || 4000 });
    const code = rt.runMain();
    return result({ kind: code === 0 ? 'ok' : 'error-exit', exitCode: code });
  } catch (e) {
    if (e instanceof CompileError) {
      const d = renderDiag(src, e, 'error');
      out.length = 0;
      return result({ kind: 'compile', exitCode: null, diag: d, code: e.code, message: e.rmsg });
    }
    if (e instanceof Panic) {
      const [l, c] = rt ? rt.lineCol(e.pos) : [1, 1];
      out.push({ s: "\nthread 'main' panicked at src/main.rs:" + l + ':' + c + ':\n' + e.msg + '\nnote: run with `RUST_BACKTRACE=1` environment variable to display a backtrace\n', t: 'err' });
      return result({ kind: 'panic', exitCode: 101, panicLine: l, message: e.msg });
    }
    if (e instanceof ExitSig) return result({ kind: e.code === 0 ? 'ok' : 'error-exit', exitCode: e.code });
    if (e instanceof LimitError) {
      if (e.message === 'output') return result({ kind: 'limit', exitCode: null, message: 'Output limit reached.' });
      return result({ kind: 'timeout', exitCode: null, message: 'Stopped after ' + Math.round((opts.timeLimit || 4000) / 1000) + ' seconds. Is there an infinite loop?' });
    }
    if (e instanceof BreakSig || e instanceof ContinueSig) {
      return result({ kind: 'compile', diag: { lines: [{ t: 'head', s: 'error[E0268]: `break` or `continue` outside of a loop' }] }, message: 'break outside loop' });
    }
    if (e instanceof RangeError && /call stack/i.test(e.message)) {
      out.push({ s: "\nthread 'main' has overflowed its stack\nfatal runtime error: stack overflow\n", t: 'err' });
      return result({ kind: 'panic', exitCode: 134, message: 'stack overflow' });
    }
    return result({ kind: 'internal', exitCode: null, message: String(e && e.stack || e) });
  }
}
return { run, parse, lex };
