(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ALL = LESSONS.concat([{ id: 'sandbox', module: null, num: '∞', title: 'Sandbox', starter: SANDBOX_CODE, sandbox: true }]);
  const byId = Object.fromEntries(ALL.map((l) => [l.id, l]));

  // ---------- storage (per-viewer convenience only) ----------
  const KEY = 'oxide-workbench-v1';
  let store = { done: {}, code: {}, stdin: {}, last: 'hello', hints: {} };
  try { const raw = localStorage.getItem(KEY); if (raw) store = Object.assign(store, JSON.parse(raw)); } catch (e) { /* storage unavailable */ }
  let saveTimer = null;
  const save = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* ignore */ } }, 250); };

  // ---------- syntax highlighting ----------
  const TOKEN_RE = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(b?r(#*)"[\s\S]*?"\3|b?"(?:\\[\s\S]|[^"\\])*"?)|(b?'(?:\\u\{[0-9a-fA-F]+\}|\\.|[^'\\\n])')|('[A-Za-z_]\w*)|(#!?\[[^\]\n]*\]?)|(\b0[xob][0-9a-fA-F_]+(?:[iu](?:8|16|32|64|128|size))?\b|\b\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?(?:[iu](?:8|16|32|64|128|size)|f32|f64)?\b)|(\b[a-z_]\w*!)|(\b(?:as|async|await|break|const|continue|crate|dyn|else|enum|extern|false|fn|for|if|impl|in|let|loop|match|mod|move|mut|pub|ref|return|self|Self|static|struct|super|trait|true|type|unsafe|use|where|while)\b)|(\b(?:i8|i16|i32|i64|i128|isize|u8|u16|u32|u64|u128|usize|f32|f64|bool|char|str)\b|\b[A-Z][A-Za-z0-9_]*\b)|(\b[a-z_][a-z0-9_]*(?=\s*(?:::<[^>]*>)?\())/g;
  const CLS = [null, 'com', 'str', null, 'str', 'life', 'attr', 'num', 'mac', 'kw', 'ty', 'fn'];
  function tokens(code) {
    const out = []; let last = 0; let m;
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(code))) {
      if (m.index > last) out.push([null, code.slice(last, m.index)]);
      let cls = null;
      for (let g = 1; g < CLS.length; g++) if (m[g] !== undefined && CLS[g]) { cls = CLS[g]; break; }
      out.push([cls, m[0]]);
      last = m.index + m[0].length;
      if (m[0].length === 0) TOKEN_RE.lastIndex++;
    }
    if (last < code.length) out.push([null, code.slice(last)]);
    return out;
  }
  function highlightLines(code) {
    const lines = [''];
    for (const [cls, text] of tokens(code)) {
      const parts = text.split('\n');
      parts.forEach((p, i) => {
        if (i > 0) lines.push('');
        if (p) lines[lines.length - 1] += cls ? '<span class="tk-' + cls + '">' + esc(p) + '</span>' : esc(p);
      });
    }
    return lines;
  }
  const highlightInline = (code) => highlightLines(code).join('\n');

  // ---------- editor ----------
  const ta = $('code'), hl = $('hl'), gutter = $('gutter');
  let errLine = null;
  function renderEditor() {
    const lines = highlightLines(ta.value);
    hl.innerHTML = lines.map((l, i) => '<span class="line' + (i + 1 === errLine ? ' err' : '') + '">' + (l || ' ') + '</span>').join('');
    let g = '';
    for (let i = 1; i <= lines.length; i++) g += '<div' + (i === errLine ? ' class="err"' : '') + '>' + i + '</div>';
    gutter.innerHTML = g;
    syncScroll();
  }
  function syncScroll() {
    hl.style.transform = 'translate(' + -ta.scrollLeft + 'px,' + -ta.scrollTop + 'px)';
    gutter.scrollTop = ta.scrollTop;
  }
  ta.addEventListener('scroll', syncScroll);
  function insertText(text) {
    ta.focus();
    let ok = false;
    try { ok = document.execCommand('insertText', false, text); } catch (e) { ok = false; }
    if (!ok) { ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end'); onEdit(); }
  }
  function lineStart(pos) { return ta.value.lastIndexOf('\n', pos - 1) + 1; }
  ta.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runCode(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === '/') { e.preventDefault(); toggleComment(); return; }
    if (e.key === 'Tab' && !e.altKey && !e.ctrlKey && !e.metaKey) {
      const s = ta.selectionStart, en = ta.selectionEnd;
      const multi = ta.value.slice(s, en).includes('\n');
      if (!multi && !e.shiftKey) { e.preventDefault(); insertText('    '); return; }
      e.preventDefault();
      const ls = lineStart(s);
      let le = ta.value.indexOf('\n', en - (en > s && ta.value[en - 1] === '\n' ? 1 : 0)); if (le < 0) le = ta.value.length;
      const block = ta.value.slice(ls, le);
      const changed = block.split('\n').map((l) => (e.shiftKey ? l.replace(/^ {1,4}/, '') : '    ' + l)).join('\n');
      ta.setSelectionRange(ls, le);
      insertText(changed);
      ta.setSelectionRange(ls, ls + changed.length);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      const s = ta.selectionStart;
      const ls = lineStart(s);
      const line = ta.value.slice(ls, s);
      const indent = (line.match(/^\s*/) || [''])[0];
      const prev = line.trimEnd().slice(-1);
      const next = ta.value[ta.selectionEnd];
      if ('{(['.includes(prev) && prev) {
        if ((prev === '{' && next === '}') || (prev === '(' && next === ')') || (prev === '[' && next === ']')) {
          insertText('\n' + indent + '    ' + '\n' + indent);
          const p = ta.selectionStart - 1 - indent.length; ta.setSelectionRange(p, p);
        } else insertText('\n' + indent + '    ');
      } else insertText('\n' + indent);
      return;
    }
    if (e.key === '}' && !e.ctrlKey && !e.metaKey) {
      const s = ta.selectionStart; const ls = lineStart(s); const before = ta.value.slice(ls, s);
      if (/^\s+$/.test(before) && before.length >= 4) {
        e.preventDefault();
        ta.setSelectionRange(s - 4, s); insertText('}');
      }
    }
  });
  function toggleComment() {
    const s = ta.selectionStart, en = ta.selectionEnd;
    const ls = lineStart(s); let le = ta.value.indexOf('\n', en); if (le < 0) le = ta.value.length;
    const lines = ta.value.slice(ls, le).split('\n');
    const all = lines.every((l) => /^\s*\/\//.test(l) || !l.trim());
    const out = lines.map((l) => (all ? l.replace(/^(\s*)\/\/ ?/, '$1') : (l.trim() ? l.replace(/^(\s*)/, '$1// ') : l))).join('\n');
    ta.setSelectionRange(ls, le); insertText(out); ta.setSelectionRange(ls, ls + out.length);
  }
  let playTimer = null;
  function onEdit() {
    errLine = null;
    renderEditor();
    if (current) {
      store.code[current.id] = ta.value; save();
      $('dirtyDot').classList.toggle('dirty', ta.value !== current.starter);
    }
    clearTimeout(playTimer); playTimer = setTimeout(updatePlayLink, 300);
  }
  ta.addEventListener('input', onEdit);
  function updatePlayLink() {
    $('playLink').href = 'https://play.rust-lang.org/?version=stable&mode=debug&edition=2021&code=' + encodeURIComponent(ta.value);
  }

  // ---------- desktop bridge (Tauri) ----------
  const TAURI = window.__TAURI__ || null;
  const invoke = TAURI ? TAURI.core.invoke : null;
  let toolchain = { available: false, version: null, path: null };
  const engineSel = $('engineSel');
  function engine() { return toolchain.available && store.engine !== 'interp' ? 'rustc' : 'interp'; }
  function renderEngineSelect() {
    const opts = [];
    if (toolchain.available) opts.push(['rustc', (toolchain.version || 'rustc').split(' (')[0]]);
    opts.push(['interp', 'Interpreter']);
    engineSel.innerHTML = opts.map(([v, t]) => '<option value="' + v + '">' + esc(t) + '</option>').join('');
    engineSel.value = engine();
    engineSel.disabled = opts.length < 2;
    engineSel.closest('.engine').title = toolchain.available ? 'Choose how your code runs' : 'Install Rust from rustup.rs to use the real compiler';
    renderToolchainInfo();
  }
  engineSel.addEventListener('change', () => { store.engine = engineSel.value; save(); refreshEngineNote(); });
  function renderToolchainInfo() {
    const el = $('toolchainInfo'); if (!el) return;
    if (!TAURI) { el.innerHTML = 'Running in a browser: code runs in the teaching interpreter.'; return; }
    el.innerHTML = toolchain.available
      ? '<span class="status-ok">Found ' + esc(toolchain.version || 'rustc') + '</span> at <code>' + esc(toolchain.path || 'rustc') + '</code>. Programs are compiled with it and run as real native binaries. You can switch to the teaching interpreter from the Engine menu above the editor.'
      : '<span class="status-warn">No Rust toolchain found.</span> Code runs in the built-in teaching interpreter. To use the real compiler, install Rust from <a href="https://rustup.rs" target="_blank" rel="noopener">rustup.rs</a>, then restart the app.';
  }
  async function detectToolchain() {
    if (!invoke) { renderEngineSelect(); return; }
    try { toolchain = await invoke('toolchain'); } catch (e) { toolchain = { available: false }; }
    renderEngineSelect(); refreshEngineNote();
  }
  // open https links in the system browser instead of inside the app window
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href^="http"]');
    if (!a || !TAURI) return;
    e.preventDefault();
    try { TAURI.opener.openUrl(a.href); } catch (err) { /* ignore */ }
  });

  // ---------- runner (web worker with main-thread fallback) ----------
  let worker = null, workerUrl = null, pending = null, localRL = null;
  function makeWorker() {
    try {
      const srcCode = RustLiteFactory.toString() + '\nconst RL = RustLiteFactory();\nself.onmessage = function (e) { let r; try { r = RL.run(e.data.code, { stdin: e.data.stdin, timeLimit: 6000 }); } catch (err) { r = { kind: "internal", message: String(err), output: [] }; } self.postMessage(r); };';
      workerUrl = URL.createObjectURL(new Blob([srcCode], { type: 'text/javascript' }));
      worker = new Worker(workerUrl);
      worker.onmessage = (e) => { if (pending) { const p = pending; pending = null; clearTimeout(p.timer); p.resolve(e.data); } };
      worker.onerror = () => { worker = null; };
    } catch (e) { worker = null; }
  }
  function execute(code, stdin) {
    if (engine() === 'rustc') return runWithRustc(code, stdin);
    return new Promise((resolve) => {
      if (!worker) makeWorker();
      if (worker) {
        const timer = setTimeout(() => {
          if (!pending) return;
          pending = null;
          try { worker.terminate(); } catch (e) { /* ignore */ }
          worker = null;
          resolve({ kind: 'timeout', message: 'Stopped after 8 seconds. Is there an infinite loop?', output: [] });
        }, 8000);
        pending = { resolve, timer };
        try { worker.postMessage({ code, stdin }); return; } catch (e) { clearTimeout(timer); pending = null; worker = null; }
      }
      if (!localRL) localRL = RustLiteFactory();
      setTimeout(() => resolve(localRL.run(code, { stdin, timeLimit: 3000 })), 10);
    });
  }

  // ---------- real compiler (rustc via the desktop backend) ----------
  function parseRustcDiagnostics(text) {
    // split rustc's human-readable output into the diagnostic line types the console renders
    const lines = []; let firstLine = null, code = null, message = null, errors = 0, warnings = 0, inError = false;
    for (const raw of text.replace(/\r/g, '').split('\n')) {
      let m;
      if ((m = /^(error|warning)(\[(E\d{4})\])?: (.*)$/.exec(raw))) {
        inError = m[1] === 'error';
        if (/^(aborting due to|could not compile)/.test(m[4]) || /generated \d+ warning|^\d+ warnings? emitted/.test(m[4])) { lines.push({ t: 'meta', s: raw }); continue; }
        if (inError) { errors++; if (!code && m[3]) code = m[3]; if (!message) message = m[4]; } else warnings++;
        lines.push({ t: inError ? 'head' : 'warnhead', s: raw, err: inError });
        continue;
      }
      if ((m = /^\s*-->\s*src\/main\.rs:(\d+):(\d+)/.exec(raw))) { if (inError && firstLine === null) firstLine = +m[1]; lines.push({ t: 'loc', s: raw }); continue; }
      if ((m = /^\s*(\d+)\s+\|/.exec(raw))) { lines.push({ t: 'code', s: raw, line: +m[1] }); continue; }
      if (/^\s*\|/.test(raw)) { lines.push({ t: /\^/.test(raw) ? 'mark' : /[-+~]{2,}|-\s|\|\s+\|/.test(raw.replace(/^\s*\|/, '')) ? 'mark2' : 'gutter', s: raw }); continue; }
      if (/^\s*=\s*help|^help:/.test(raw)) { lines.push({ t: 'help', s: raw }); continue; }
      if (/^\s*=\s*note|^note:/.test(raw)) { lines.push({ t: 'note', s: raw }); continue; }
      lines.push({ t: 'gutter', s: raw });
    }
    while (lines.length && !lines[lines.length - 1].s.trim()) lines.pop();
    return { lines, line: firstLine, code, message, errors, warnings };
  }
  async function runWithRustc(code, stdin) {
    let r;
    try { r = await invoke('run_rust', { code, stdin }); }
    catch (e) { return { kind: 'internal', message: 'Could not run rustc: ' + e, output: [] }; }
    const diag = parseRustcDiagnostics(r.compilerOutput || '');
    if (!r.compiled) {
      if (r.timedOut) return { kind: 'timeout', message: 'Compilation took longer than 90 seconds and was stopped.', output: [], engine: 'rustc' };
      return { kind: 'compile', engine: 'rustc', diag: { lines: diag.lines, line: diag.line }, code: diag.code, message: diag.message, errorCount: diag.errors, ms: r.compileMs };
    }
    const output = [];
    if (r.stdout) output.push({ s: r.stdout, t: 'out' });
    if (r.stderr) output.push({ s: (r.stdout && !r.stdout.endsWith('\n') ? '\n' : '') + r.stderr, t: 'err' });
    if (r.truncated) output.push({ s: '\n[output truncated at 1 MB]\n', t: 'note' });
    const panicM = /panicked at src\/main\.rs:(\d+):\d+/.exec(r.stderr || '');
    let kind = 'ok';
    if (r.timedOut) kind = 'timeout';
    else if (r.exitCode === 101 && panicM) kind = 'panic';
    else if (r.exitCode !== 0) kind = 'error-exit';
    return { kind, engine: 'rustc', output, exitCode: r.exitCode, panicLine: panicM ? +panicM[1] : null, ms: r.runMs, compileMs: r.compileMs, warnings: diag.warnings ? diag.lines : null, warningCount: diag.warnings, message: r.timedOut ? 'Stopped after 10 seconds. Is there an infinite loop?' : null };
  }

  // ---------- output rendering ----------
  let lastResult = null;
  const paneOut = $('paneOut');
  function setStatus(kind, text, detail) {
    const cls = kind === 'ok' ? 'ok' : kind === 'run' || kind === 'idle' ? 'idle' : kind === 'warn' ? 'warn' : 'bad';
    $('status').innerHTML = '<span class="pill ' + cls + '">' + esc(text) + '</span>' + (detail ? '<span class="detail">' + esc(detail) + '</span>' : '');
  }
  function engineNoteHtml() {
    if (engine() === 'rustc') return '<div class="engine-note">Compiled with ' + esc(toolchain.version || 'rustc') + ' on this computer and run as a native program (debug build, so overflow checks are on). Timings are for debug builds; real services ship with <code>--release</code>.</div>';
    return '<div class="engine-note">Runs in the teaching interpreter built into this app. It covers the Rust used in this course and reports the common ownership, borrowing and type errors the way <code>rustc</code> does.' + (TAURI ? ' Install Rust from <a href="https://rustup.rs" target="_blank" rel="noopener">rustup.rs</a> to run the real compiler here' : ' For the full compiler,') + ' or open the code in <a id="noteLink" href="#" target="_blank" rel="noopener">the Rust Playground</a>.</div>';
  }
  function refreshEngineNote() {
    const old = paneOut.querySelector('.engine-note');
    if (old) { old.outerHTML = engineNoteHtml(); const nl = $('noteLink'); if (nl) nl.href = $('playLink').href; }
  }
  function renderResult(r) {
    lastResult = r;
    errLine = null;
    let html = '';
    if (r.kind === 'compile') {
      html += '<pre class="console">';
      for (const l of r.diag.lines) {
        if (l.t === 'head') {
          const m = /^(error(?:\[(E\d{4})\])?)(: .*)$/.exec(l.s);
          html += m ? '<span class="d-head">' + (m[2] ? '<a href="https://doc.rust-lang.org/error_codes/' + m[2] + '.html" target="_blank" rel="noopener" style="color:inherit">' + esc(m[1]) + '</a>' : esc(m[1])) + '<b>' + esc(m[3]) + '</b></span>\n' : '<span class="d-head">' + esc(l.s) + '</span>\n';
        } else if (l.t === 'warnhead') html += '<span class="d-warn">' + esc(l.s) + '</span>\n';
        else if (l.t === 'meta') html += '<span class="meta-line">' + esc(l.s) + '</span>\n';
        else if (l.t === 'code') html += '<span class="d-code" data-line="' + l.line + '">' + esc(l.s) + '</span>\n';
        else html += '<span class="d-' + l.t + '">' + esc(l.s) + '</span>\n';
      }
      if (r.engine !== 'rustc') html += '\n<span class="d-head">error</span><b>: could not compile `playground` (bin "playground") due to 1 previous error</b>\n';
      html += '</pre>';
      errLine = r.diag.line || null;
      setStatus('bad', r.code ? 'compile error ' + r.code : 'compile error', r.message ? '· ' + r.message.slice(0, 70) : '');
    } else {
      const parts = (r.output || []).map((o) => (o.t === 'out' ? esc(o.s) : '<span class="o-' + (o.t === 'note' ? 'note' : 'err') + '">' + esc(o.s) + '</span>')).join('');
      if (r.kind === 'internal') {
        html += '<pre class="console">' + parts + '</pre><div class="console-actions"><span class="empty">The teaching interpreter could not run this program. It may use a Rust feature it does not support yet. Your code may still be valid: try it in the Rust Playground.</span></div>';
        setStatus('warn', 'unsupported', '');
      } else {
        const body = parts || '<span class="empty">The program ran and printed nothing.</span>';
        let warn = '';
        if (r.warnings && r.warningCount) {
          warn = '<details><summary>' + r.warningCount + ' compiler warning' + (r.warningCount === 1 ? '' : 's') + '</summary>' + r.warnings.map((l) => '<span class="' + (l.t === 'warnhead' ? 'd-warn' : l.t === 'code' ? 'd-code' : 'd-' + (l.t === 'meta' ? 'gutter' : l.t)) + '"' + (l.t === 'code' ? ' data-line="' + l.line + '"' : '') + '>' + esc(l.s) + '</span>\n').join('') + '</details>';
        }
        html += '<pre class="console">' + warn + body + '</pre>';
        if (r.kind === 'ok') setStatus('ok', 'exit 0', r.engine === 'rustc' ? '· compiled in ' + r.compileMs + ' ms, ran in ' + r.ms + ' ms' : '· ran in ' + Math.max(1, r.ms || 0) + ' ms');
        else if (r.kind === 'panic') { setStatus('bad', 'panicked · exit 101', ''); errLine = r.panicLine || null; }
        else if (r.kind === 'error-exit') setStatus('bad', 'exit ' + r.exitCode, '');
        else if (r.kind === 'timeout') { html += '<pre class="console"><span class="o-err">' + esc(r.message) + '</span></pre>'; setStatus('warn', 'timed out', ''); }
        else if (r.kind === 'limit') setStatus('warn', 'output limit', '');
      }
    }
    if (tutorReady && (r.kind === 'compile' || r.kind === 'panic' || r.kind === 'internal')) {
      html += '<div class="console-actions"><button class="chip" id="askErr">Ask the tutor to explain this</button></div>';
    }
    html += engineNoteHtml();
    paneOut.innerHTML = html;
    const nl = $('noteLink'); if (nl) nl.href = $('playLink').href;
    const ae = $('askErr'); if (ae) ae.onclick = () => { showTab('tutor'); askTutor(r.kind === 'compile' ? 'Explain this compiler error in plain words and point me toward the fix without writing the whole solution.' : r.kind === 'panic' ? 'Why did my program panic, and how do I fix it?' : 'The interpreter could not run my code. Is my code valid Rust, and how could I write it differently?'); };
    paneOut.querySelectorAll('.d-code').forEach((el) => el.addEventListener('click', () => gotoLine(+el.dataset.line)));
    renderEditor();
  }
  function gotoLine(n) {
    if (!n) return;
    const lines = ta.value.split('\n');
    let pos = 0; for (let i = 0; i < n - 1 && i < lines.length; i++) pos += lines[i].length + 1;
    ta.focus(); ta.setSelectionRange(pos, pos + (lines[n - 1] || '').length);
    ta.scrollTop = Math.max(0, (n - 4) * 21);
    if (window.matchMedia('(max-width: 760px)').matches) setView('code');
  }

  let running = false;
  async function runCode() {
    if (running || !current) return;
    running = true;
    $('runBtn').disabled = true; $('runLabel').textContent = engine() === 'rustc' ? 'Compiling' : 'Running';
    setStatus('run', engine() === 'rustc' ? 'rustc…' : 'running…', '');
    showTab('out');
    const code = ta.value;
    const stdin = $('stdin').value;
    const r = await execute(code, stdin);
    running = false;
    $('runBtn').disabled = false; $('runLabel').textContent = 'Run';
    renderResult(r);
    evaluateChecks(r, code);
  }
  $('runBtn').addEventListener('click', runCode);

  // ---------- checks ----------
  function checkPasses(c, r, code) {
    const stdout = r && r.kind !== 'compile' ? (r.output || []).filter((o) => o.t === 'out').map((o) => o.s).join('') : '';
    const okRun = r && r.kind === 'ok';
    const match = (v) => (v.startsWith('re:') ? new RegExp(v.slice(3)).test(code) : code.includes(v));
    if (c.type === 'ok') return okRun;
    if (c.type === 'out') return okRun && stdout.includes(c.value);
    if (c.type === 'code') return match(c.value);
    if (c.type === 'nocode') return !match(c.value);
    return false;
  }
  let lastChecks = null;
  function evaluateChecks(r, code) {
    if (!current || current.sandbox) return;
    const res = current.task.checks.map((c) => checkPasses(c, r, code));
    lastChecks = res;
    const all = res.every(Boolean);
    const wasDone = !!store.done[current.id];
    if (all) { store.done[current.id] = true; save(); }
    renderTaskState(res, all && !wasDone);
    renderRail(); renderProgress();
  }

  // ---------- rail & progress ----------
  const rail = $('rail');
  function renderRail() {
    let h = '';
    for (const m of MODULES) {
      h += '<div class="mod"><div class="mod-head"><span class="mod-num">0' + m.num + '</span><span class="mod-title">' + esc(m.title) + '</span></div><div class="mod-blurb">' + esc(m.blurb) + '</div>';
      for (const l of LESSONS.filter((x) => x.module === m.id)) {
        h += '<a class="lesson-link" href="#' + l.id + '"' + (current && current.id === l.id ? ' aria-current="page"' : '') + '><span class="dot' + (store.done[l.id] ? ' done' : '') + '" aria-label="' + (store.done[l.id] ? 'completed' : 'not completed') + '"></span><span class="n">' + l.num + '</span><span>' + esc(l.title) + '</span></a>';
      }
      h += '</div>';
    }
    h += '<div class="rail-foot"><a class="lesson-link" href="#sandbox"' + (current && current.id === 'sandbox' ? ' aria-current="page"' : '') + '><span class="dot"></span><span class="n">∞</span><span>Sandbox</span></a><span id="resetProgressSlot"><button class="text-btn" id="resetProgress">Reset my progress</button></span></div>';
    rail.innerHTML = h;
    const rp = $('resetProgress');
    if (rp) rp.onclick = () => inlineConfirm($('resetProgressSlot'), 'Clear all progress and saved code?', 'Clear', () => { store = { done: {}, code: {}, stdin: {}, last: 'hello', hints: {} }; save(); openLesson(current.id, true); }, () => renderRail());
  }
  function renderProgress() {
    const n = LESSONS.filter((l) => store.done[l.id]).length;
    let meter = '';
    MODULES.forEach((m, mi) => {
      if (mi) meter += '<b></b>';
      for (const l of LESSONS.filter((x) => x.module === m.id)) meter += '<i class="' + (store.done[l.id] ? 'done' : '') + (current && current.id === l.id ? ' cur' : '') + '" title="' + l.num + ' ' + esc(l.title) + '"></i>';
    });
    $('progress').innerHTML = '<span class="progress-label">' + n + ' of ' + LESSONS.length + ' lessons</span><span class="meter" role="img" aria-label="' + n + ' of ' + LESSONS.length + ' lessons complete">' + meter + '</span>';
  }

  // ---------- in-page confirm ----------
  function inlineConfirm(slot, question, yesLabel, onYes, onNo) {
    const prev = slot.innerHTML;
    slot.innerHTML = '<span class="confirm"><span>' + esc(question) + '</span><button class="btn primary" data-a="y">' + esc(yesLabel) + '</button><button class="btn ghost" data-a="n">Cancel</button></span>';
    slot.querySelector('[data-a="y"]').onclick = () => { onYes(); };
    slot.querySelector('[data-a="n"]').onclick = () => { slot.innerHTML = prev; if (onNo) onNo(); };
    slot.querySelector('[data-a="n"]').focus();
  }

  // ---------- diagrams ----------
  const DIAGRAMS = {
    string: '<svg viewBox="0 0 560 160" role="img" aria-label="Diagram: after the move, moved holds length, capacity and pointer and points at the heap bytes h e l l o. greeting still sits on the stack but can no longer be used.">' +
      '<text class="dg-h" x="12" y="16">STACK</text><text class="dg-h" x="372" y="16">HEAP</text>' +
      '<text class="dg-t" x="12" y="53">greeting</text>' +
      '<rect class="dg-box-dead" x="96" y="34" width="60" height="28" rx="3"/><rect class="dg-box-dead" x="156" y="34" width="60" height="28" rx="3"/><rect class="dg-box-dead" x="216" y="34" width="56" height="28" rx="3"/>' +
      '<text class="dg-t2" x="104" y="52">len 5</text><text class="dg-t2" x="164" y="52">cap 5</text><text class="dg-t2" x="230" y="52">ptr</text>' +
      '<text class="dg-t2" x="96" y="80">moved out: can no longer be used</text>' +
      '<path class="dg-arrow-dead" d="M272 48 C 310 48, 330 70, 366 84"/>' +
      '<path class="dg-x" d="M310 50 l10 10 M320 50 l-10 10"/>' +
      '<text class="dg-t" x="12" y="127">moved</text>' +
      '<rect class="dg-box-live" x="96" y="108" width="60" height="28" rx="3"/><rect class="dg-box-live" x="156" y="108" width="60" height="28" rx="3"/><rect class="dg-box-live" x="216" y="108" width="56" height="28" rx="3"/>' +
      '<text class="dg-t2" x="104" y="126">len 5</text><text class="dg-t2" x="164" y="126">cap 5</text><text class="dg-t2" x="230" y="126">ptr</text>' +
      '<path class="dg-arrow" d="M272 122 C 314 122, 326 104, 362 102"/><path class="dg-head" d="M370 101 l-10 -5 0 10 z"/>' +
      ['h', 'e', 'l', 'l', 'o'].map((c, i) => '<rect class="dg-heap" x="' + (372 + i * 34) + '" y="82" width="34" height="34" rx="2"/><text class="dg-t" x="' + (385 + i * 34) + '" y="104">' + c + '</text>').join('') +
      '<text class="dg-t2" x="372" y="134">5 bytes, freed once</text>' +
      '</svg><figcaption>After <code>let moved = greeting;</code> only <code>moved</code> owns the heap bytes. They are freed once, when <code>moved</code> goes out of scope.</figcaption>',
  };

  // ---------- lesson rendering ----------
  let current = null;
  const sheet = $('sheet');
  function modOf(l) { return MODULES.find((m) => m.id === l.module); }
  function renderSheet() {
    const l = current;
    if (l.sandbox) {
      sheet.innerHTML = '<div class="sheet-inner"><div class="plate"><span>Sandbox</span><span>Free practice</span></div><h1>Sandbox</h1><p class="lede">A blank bench for your own experiments. Your code here is saved in this browser.</p><div class="prose"><p>Ideas to try:</p><ul><li>Write a function that returns the <em>n</em>th prime and time it with <code>std::time::Instant</code>.</li><li>Model a bank account with a struct, an enum of transactions and a method that applies them, returning <code>Result</code> on overdraft.</li><li>Parse <code>key=value</code> lines from the Input tab into a <code>BTreeMap</code>.</li></ul><p>Anything the teaching interpreter cannot run, the <strong>Playground</strong> button opens in the official compiler.</p></div>' + pagerHtml() + '</div>';
      bindSheet(); return;
    }
    const m = modOf(l);
    const hintsShown = store.hints[l.id] || 0;
    let h = '<div class="sheet-inner">';
    h += '<div class="plate"><span>Lesson ' + l.num + '</span><span>' + esc(m.title) + '</span></div>';
    h += '<h1>' + esc(l.title) + '</h1>';
    h += '<p class="lede">' + l.summary + '</p>';
    h += '<div class="meta">About ' + l.minutes + ' minutes</div>';
    h += '<div class="prose">' + l.body + '</div>';
    h += '<div class="perf"><div class="perf-tag">Perf</div><div class="perf-body"><b>Performance lens</b>' + l.perf + '</div></div>';
    h += '<section class="task" id="task"><div class="task-head"><h2>' + esc(l.task.title) + '</h2><span class="state-pill" id="taskPill"></span></div><div class="task-body">';
    h += '<ol>' + l.task.steps.map((s) => '<li>' + s + '</li>').join('') + '</ol>';
    h += '<ul class="checks" id="checks">' + l.task.checks.map((c, i) => '<li><span class="ck" id="ck' + i + '"></span><span>' + esc(c.label) + '</span></li>').join('') + '</ul>';
    h += '<div class="checks-note" id="checksNote">Checks run each time you press Run.</div>';
    h += '<div id="hints">' + l.hints.slice(0, hintsShown).map((t, i) => '<div class="hint" style="margin-bottom:8px"><b>Hint ' + (i + 1) + '</b>' + t + '</div>').join('') + '</div>';
    h += '<div class="task-actions" id="taskActions">';
    h += '<button class="btn primary" id="runFromTask">Run code</button>';
    if (hintsShown < l.hints.length) h += '<button class="btn" id="hintBtn">' + (hintsShown ? 'Another hint' : 'Show a hint') + '</button>';
    h += '<span id="solSlot"><button class="btn ghost" id="solBtn">Show solution</button></span>';
    h += '</div></div><div id="completeSlot"></div></section>';
    h += pagerHtml();
    h += '</div>';
    sheet.innerHTML = h;
    sheet.querySelectorAll('.prose pre code').forEach((c) => { c.innerHTML = highlightInline(c.textContent); });
    sheet.querySelectorAll('.prose pre.copyable').forEach((pre) => {
      const b = document.createElement('button'); b.className = 'copy-btn'; b.textContent = 'Copy';
      b.onclick = () => {
        const text = pre.textContent.replace(/Copy$|Copied$/, '');
        const done = () => { b.textContent = 'Copied'; setTimeout(() => { b.textContent = 'Copy'; }, 1500); };
        try { navigator.clipboard.writeText(text).then(done, () => selectText(pre)); } catch (e) { selectText(pre); }
      };
      pre.appendChild(b);
    });
    sheet.querySelectorAll('figure.diagram').forEach((f) => { f.innerHTML = DIAGRAMS[f.dataset.diagram] || ''; });
    bindSheet();
    renderTaskState(lastChecks, false);
  }
  function selectText(el) { const r = document.createRange(); r.selectNodeContents(el.querySelector('code') || el); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }
  function pagerHtml() {
    const idx = ALL.indexOf(current);
    const prev = ALL[idx - 1], next = ALL[idx + 1];
    let h = '<nav class="pager" aria-label="Lesson navigation">';
    if (prev) h += '<a href="#' + prev.id + '"><small>Previous</small><span>' + (prev.num !== '∞' ? prev.num + ' ' : '') + esc(prev.title) + '</span></a>';
    if (next) h += '<a class="next" href="#' + next.id + '"><small>Next</small><span>' + (next.num !== '∞' ? next.num + ' ' : '') + esc(next.title) + '</span></a>';
    return h + '</nav>';
  }
  function bindSheet() {
    const rf = $('runFromTask'); if (rf) rf.onclick = () => { if (window.matchMedia('(max-width: 760px)').matches) setView('code'); runCode(); };
    const hb = $('hintBtn'); if (hb) hb.onclick = () => { store.hints[current.id] = (store.hints[current.id] || 0) + 1; save(); const y = sheet.scrollTop; renderSheet(); sheet.scrollTop = y; };
    const sb = $('solBtn'); if (sb) sb.onclick = () => inlineConfirm($('solSlot'), 'Replace your code with the solution?', 'Replace', () => { setCode(current.solution); $('solSlot').innerHTML = '<button class="btn ghost" id="solBtn">Show solution</button>'; bindSheet(); runCode(); }, () => bindSheet());
  }
  function renderTaskState(res, justCompleted) {
    if (!current || current.sandbox || !$('task')) return;
    const done = !!store.done[current.id];
    const pill = $('taskPill');
    if (pill) { pill.textContent = done ? 'Completed' : 'Not done yet'; pill.className = 'state-pill' + (done ? ' done' : ''); }
    if (res) {
      res.forEach((ok, i) => { const el = $('ck' + i); if (el) el.className = 'ck ' + (ok ? 'pass' : 'fail'); });
      const passed = res.filter(Boolean).length;
      $('checksNote').textContent = passed === res.length ? 'All checks pass.' : passed + ' of ' + res.length + ' checks pass. Edit the code and run again.';
    }
    const slot = $('completeSlot');
    if (slot) {
      if (done) {
        const idx = ALL.indexOf(current); const next = ALL[idx + 1];
        slot.innerHTML = '<div class="complete"><p>' + (justCompleted ? 'Nice work. Lesson complete.' : 'You completed this lesson.') + '</p>' + (next ? '<a class="btn primary" href="#' + next.id + '">Next: ' + esc(next.title) + ' →</a>' : '') + '</div>';
      } else slot.innerHTML = '';
    }
  }

  function setCode(code) {
    ta.value = code;
    store.code[current.id] = code; save();
    $('dirtyDot').classList.toggle('dirty', code !== current.starter);
    errLine = null; renderEditor(); updatePlayLink();
  }
  function openLesson(id, force) {
    const l = byId[id] || byId.hello;
    if (current === l && !force) return;
    current = l; lastChecks = null; lastResult = null;
    store.last = l.id; save();
    ta.value = store.code[l.id] !== undefined ? store.code[l.id] : l.starter;
    $('dirtyDot').classList.toggle('dirty', ta.value !== l.starter);
    $('stdin').value = store.stdin[l.id] !== undefined ? store.stdin[l.id] : (l.stdin || '');
    $('stdinBadge').hidden = !(l.stdin);
    errLine = null; renderEditor(); updatePlayLink();
    renderSheet(); renderRail(); renderProgress();
    sheet.scrollTop = 0; window.scrollTo(0, 0);
    tutorTurns = [];
    renderTutorIntro();
    paneOut.innerHTML = '<pre class="console"><span class="empty">Press <b>Run</b> to compile and run <code>src/main.rs</code>. The result appears here.</span></pre>' + engineNoteHtml();
    const nl = $('noteLink'); if (nl) nl.href = $('playLink').href;
    setStatus('idle', 'ready', '');
    closeRail();
    if (document.title !== 'Oxide Workbench') document.title = 'Oxide Workbench';
  }
  $('stdin').addEventListener('input', () => { if (current) { store.stdin[current.id] = $('stdin').value; save(); } });
  $('resetBtn').addEventListener('click', () => {
    const slot = document.createElement('span');
    const btn = $('resetBtn'); btn.hidden = true; btn.after(slot);
    slot.innerHTML = '<span class="confirm" style="background:var(--ed-panel);border-color:var(--ed-caret);color:var(--ed-fg)">Restore starter code? <button class="ed-btn" data-a="y">Restore</button><button class="ed-btn" data-a="n">Cancel</button></span>';
    const close = () => { slot.remove(); btn.hidden = false; };
    slot.querySelector('[data-a="y"]').onclick = () => { setCode(current.starter); if (current.stdin) { $('stdin').value = current.stdin; delete store.stdin[current.id]; save(); } close(); };
    slot.querySelector('[data-a="n"]').onclick = close;
  });

  // ---------- tabs, views, rail drawer ----------
  function showTab(which) {
    const map = { out: ['tabOut', 'paneOut'], in: ['tabIn', 'paneIn'], tutor: ['tabTutor', 'paneTutor'] };
    for (const k in map) { const on = k === which; $(map[k][0]).setAttribute('aria-selected', on ? 'true' : 'false'); $(map[k][1]).hidden = !on; }
  }
  $('tabOut').onclick = () => showTab('out');
  $('tabIn').onclick = () => showTab('in');
  $('tabTutor').onclick = () => showTab('tutor');
  function setView(v) {
    $('main').dataset.view = v;
    $('vLearn').setAttribute('aria-pressed', v === 'learn' ? 'true' : 'false');
    $('vCode').setAttribute('aria-pressed', v === 'code' ? 'true' : 'false');
    window.scrollTo(0, 0);
  }
  $('vLearn').onclick = () => setView('learn');
  $('vCode').onclick = () => setView('code');
  let scrim = null;
  function openRail() { rail.classList.add('open'); $('railToggle').setAttribute('aria-expanded', 'true'); scrim = document.createElement('div'); scrim.className = 'scrim'; scrim.onclick = closeRail; document.body.appendChild(scrim); }
  function closeRail() { rail.classList.remove('open'); $('railToggle').setAttribute('aria-expanded', 'false'); if (scrim) { scrim.remove(); scrim = null; } }
  $('railToggle').onclick = () => (rail.classList.contains('open') ? closeRail() : openRail());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeRail(); });

  // ---------- tutor (asks Claude, when this viewer allows it) ----------
  let tutorReady = false, hasKey = false, tutorTurns = [], tutorBusy = false, tutorReq = 0;
  const tutorLog = $('tutorLog');
  function md(text) {
    const blocks = []; let s = text;
    s = s.replace(/```(\w+)?\n([\s\S]*?)(```|$)/g, (_, lang, code) => { blocks.push('<pre><code>' + highlightInline(code.replace(/\n$/, '')) + '</code></pre>'); return '\u0000' + (blocks.length - 1) + '\u0000'; });
    s = esc(s);
    s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    const out = []; let list = null;
    for (const line of s.split('\n')) {
      const li = /^\s*(?:[-*]|\d+\.)\s+(.*)$/.exec(line);
      if (li) { if (!list) { list = []; } list.push('<li>' + li[1] + '</li>'); continue; }
      if (list) { out.push('<ul>' + list.join('') + '</ul>'); list = null; }
      if (/^\u0000\d+\u0000$/.test(line.trim())) out.push(line.trim());
      else if (line.trim()) out.push('<p>' + line + '</p>');
    }
    if (list) out.push('<ul>' + list.join('') + '</ul>');
    return out.join('').replace(/\u0000(\d+)\u0000/g, (_, i) => blocks[+i]);
  }
  function renderTutorIntro() {
    if (!tutorReady) return;
    if (!hasKey) {
      tutorLog.innerHTML = '<div class="tutor-intro"><b>Set up the tutor.</b> The tutor explains errors, gives hints and reviews your code using Claude. Add an Anthropic API key in Settings to turn it on.</div><div class="chips"><button class="chip" id="openKeySettings">Open settings</button></div>';
      $('openKeySettings').onclick = openSettings; return;
    }
    const l = current;
    tutorLog.innerHTML = '<div class="tutor-intro"><b>Ask the tutor</b> about this lesson, your code or the last error. It sees your current code and output, and gives hints before answers.</div><div class="chips">' +
      ['Give me a hint', 'Explain the last result', 'Review my code', l.sandbox ? 'Suggest an exercise' : 'Explain this lesson more simply'].map((t) => '<button class="chip" data-q="' + esc(t) + '">' + esc(t) + '</button>').join('') + '</div>';
    tutorLog.querySelectorAll('.chip').forEach((b) => (b.onclick = () => askTutor(b.dataset.q)));
  }
  function contextText() {
    const l = current;
    let ctx = 'Lesson: ' + (l.sandbox ? 'Sandbox (free practice)' : l.num + ' ' + l.title) + '\n';
    if (!l.sandbox) ctx += 'Task: ' + l.task.steps.map((s) => s.replace(/<[^>]+>/g, '')).join(' ') + '\nChecks: ' + l.task.checks.map((c) => c.label).join('; ') + '\n';
    ctx += '\nCurrent code (src/main.rs):\n```rust\n' + ta.value + '\n```\n';
    if (lastResult) {
      if (lastResult.kind === 'compile') ctx += '\nLast run: compile error\n' + lastResult.diag.lines.map((x) => x.s).join('\n') + '\n';
      else ctx += '\nLast run: ' + lastResult.kind + '\n' + (lastResult.output || []).map((o) => o.s).join('').slice(0, 3000) + '\n';
    } else ctx += '\nThe code has not been run yet.\n';
    return ctx;
  }
  const RULES = 'You are the tutor inside Oxide Workbench, an interactive course that teaches Rust and how it is used to build fast, reliable software. Be warm, precise and brief: under 170 words unless the learner asks for more. Use Rust 2021. Prefer a guiding hint or question over a full solution, and only give complete solution code if the learner explicitly asks for it. Explain compiler errors in plain words: what rule was broken, why Rust has that rule, and what to change. Format with short paragraphs, `inline code` and ```rust fenced blocks. The learner\'s code runs in a browser teaching interpreter that supports a subset of std. If something might be unsupported there, suggest the Rust Playground button.';
  async function askTutor(q) {
    if (!tutorReady || !q.trim()) return;
    if (!hasKey) { showTab('tutor'); renderTutorIntro(); return; }
    if (tutorBusy) await invoke('tutor_cancel');
    showTab('tutor');
    const intro = tutorLog.querySelector('.tutor-intro'); if (intro && !tutorTurns.length) tutorLog.innerHTML = '';
    tutorTurns.push({ role: 'user', content: q });
    tutorLog.insertAdjacentHTML('beforeend', '<div class="msg me">' + esc(q) + '</div>');
    const bubble = document.createElement('div'); bubble.className = 'msg ai'; bubble.innerHTML = '<div class="who">Tutor</div><p>Thinking…</p>';
    tutorLog.appendChild(bubble); tutorLog.scrollTop = tutorLog.scrollHeight;
    const send = $('tutorSend'); send.textContent = 'Stop';
    tutorBusy = true;
    const myReq = ++tutorReq;
    let text = '';
    const channel = new TAURI.core.Channel();
    channel.onmessage = (ev) => {
      if (myReq !== tutorReq) return;
      if (ev.event === 'delta') { text += ev.data.text; bubble.innerHTML = '<div class="who">Tutor</div>' + md(text); tutorLog.scrollTop = tutorLog.scrollHeight; }
    };
    const messages = [{ role: 'user', content: contextText() + '\nThe learner\'s first message follows in the next turn.' }, { role: 'assistant', content: 'Understood. I have the lesson, the code and the last result.' }].concat(tutorTurns);
    try {
      const res = await invoke('tutor_ask', { system: RULES, messages, onEvent: channel });
      if (myReq !== tutorReq) return;
      text = res.text || text;
      if (res.stopReason === 'refusal') {
        bubble.innerHTML = '<div class="who">Tutor</div>' + md(text) + '<p class="msg err">The tutor declined to answer this one. Try rephrasing the question.</p>';
        tutorTurns.pop();
      } else if (res.cancelled) {
        bubble.innerHTML = '<div class="who">Tutor</div>' + md(text) + '<p class="msg err">Stopped.</p>';
        tutorTurns.pop();
      } else {
        bubble.innerHTML = '<div class="who">Tutor</div>' + md(text);
        tutorTurns.push({ role: 'assistant', content: text });
      }
    } catch (e) {
      tutorTurns.pop();
      bubble.innerHTML = '<div class="who">Tutor</div>' + md(text) + '<p class="msg err">' + esc(String(e)) + '</p>';
    } finally {
      if (myReq === tutorReq) { tutorBusy = false; send.textContent = 'Ask'; tutorLog.scrollTop = tutorLog.scrollHeight; }
    }
  }
  $('tutorForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (tutorBusy) { tutorReq++; tutorBusy = false; $('tutorSend').textContent = 'Ask'; invoke('tutor_cancel'); return; }
    const v = $('tutorInput').value; $('tutorInput').value = ''; askTutor(v);
  });
  $('tutorInput').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('tutorForm').requestSubmit(); } });
  // ---------- settings ----------
  const dlg = $('settings');
  function openSettings() { renderToolchainInfo(); refreshKeyStatus(); if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); }
  $('settingsBtn').onclick = openSettings;
  async function refreshKeyStatus() {
    const el = $('keyStatus');
    if (!invoke) { el.textContent = 'The tutor is available in the desktop app.'; ['apiKeyInput', 'saveKeyBtn', 'clearKeyBtn'].forEach((id) => { $(id).disabled = true; }); return; }
    try {
      const st = await invoke('tutor_status');
      hasKey = st.hasKey;
      el.innerHTML = st.hasKey ? '<span class="status-ok">Tutor is on</span> (key from ' + (st.source === 'env' ? 'the ANTHROPIC_API_KEY environment variable' : 'this computer\'s settings') + ', ending in <code>' + esc(st.hint || '') + '</code>).' : '<span class="status-warn">No API key saved.</span> The tutor is off.';
      $('clearKeyBtn').disabled = st.source !== 'saved';
    } catch (e) { el.textContent = String(e); }
  }
  $('saveKeyBtn').onclick = async () => {
    const v = $('apiKeyInput').value.trim();
    if (!v) { $('keyStatus').innerHTML = '<span class="status-warn">Paste a key first.</span>'; return; }
    try { await invoke('set_api_key', { key: v }); $('apiKeyInput').value = ''; await refreshKeyStatus(); renderTutorIntro(); }
    catch (e) { $('keyStatus').innerHTML = '<span class="status-warn">' + esc(String(e)) + '</span>'; }
  };
  $('clearKeyBtn').onclick = async () => { try { await invoke('clear_api_key'); await refreshKeyStatus(); tutorTurns = []; renderTutorIntro(); } catch (e) { $('keyStatus').textContent = String(e); } };
  if (invoke) {
    tutorReady = true; $('tabTutor').hidden = false;
    refreshKeyStatus().then(() => renderTutorIntro());
  }

  // ---------- routing ----------
  function route() {
    const id = (location.hash || '').replace(/^#/, '');
    openLesson(byId[id] ? id : (byId[store.last] ? store.last : 'hello'));
  }
  window.addEventListener('hashchange', route);
  route();
  // detect the Rust toolchain, then run the current lesson once so the output panel starts filled in
  detectToolchain().then(() => setTimeout(runCode, 30));
})();
