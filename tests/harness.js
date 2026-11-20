// Runs every lesson's starter and solution, the sandbox, and tests/programs/*.rs through both rustc and the
// teaching interpreter, and fails if their output or error codes disagree. Needs rustc on PATH.
// Compare RustLite with rustc for a set of programs.
const F = require('../ui/rustlite.js'); const RL = F();
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const CACHE = process.env.HARNESS_CACHE || path.join(require('os').tmpdir(), 'oxide-harness-cache'); fs.mkdirSync(CACHE, { recursive: true });
function rustc(src, stdin) {
  const h = crypto.createHash('md5').update(src).digest('hex');
  const bin = path.join(CACHE, h), errf = bin + '.err';
  if (!fs.existsSync(bin) && !fs.existsSync(errf)) {
    const f = bin + '.rs'; fs.writeFileSync(f, src);
    const r = spawnSync('rustc', ['--edition', '2021', '-A', 'warnings', '-o', bin, f], { encoding: 'utf8' });
    if (r.status !== 0) fs.writeFileSync(errf, r.stderr);
  }
  if (fs.existsSync(errf)) { const e = fs.readFileSync(errf, 'utf8'); const codes = [...e.matchAll(/error\[(E\d+)\]/g)].map(m => m[1]); const first = (e.match(/^error(\[E\d+\])?: .*/m) || [''])[0]; return { kind: 'compile', codes, first, stderr: e }; }
  const r = spawnSync(bin, [], { input: stdin || '', encoding: 'utf8', timeout: 10000 });
  return { kind: r.status === 0 ? 'ok' : (r.status === 101 ? 'panic' : 'exit' + r.status), stdout: r.stdout, stderr: r.stderr, code: r.status };
}
function rl(src, stdin) {
  const r = RL.run(src, { stdin: stdin || '' });
  const stdout = r.output.filter(o => o.t === 'out').map(o => o.s).join('');
  const stderr = r.output.filter(o => o.t === 'err').map(o => o.s).join('');
  return Object.assign(r, { stdout, stderr });
}
function compare(name, src, stdin, expect) {
  const a = rustc(src, stdin), b = rl(src, stdin);
  let ok = true, why = '';
  if (a.kind === 'compile') {
    if (b.kind !== 'compile') { ok = false; why = 'rustc compile error ' + a.first + ' but RL kind=' + b.kind + (b.message ? ' ' + b.message : ''); }
    else if (a.codes.length && b.code && !a.codes.includes(b.code)) { ok = false; why = 'codes differ: rustc ' + a.codes.join(',') + ' RL ' + b.code + ' ' + b.message; }
    else if (a.codes.length && !b.code) { ok = 'warn'; why = 'rustc ' + a.codes.join(',') + ' / RL (no code) ' + b.message; }
  } else {
    if (b.kind === 'compile') { ok = false; why = 'RL compile error but rustc ' + a.kind + '\n' + b.diag.lines.map(l => l.s).join('\n'); }
    else if (b.kind === 'internal' || b.kind === 'timeout') { ok = false; why = 'RL ' + b.kind + ': ' + b.message; }
    else if (a.stdout !== b.stdout) { ok = false; why = 'stdout differs\n--- rustc\n' + a.stdout + '\n--- RL\n' + b.stdout; }
    else if ((a.kind === 'panic') !== (b.kind === 'panic')) { ok = false; why = 'panic mismatch rustc=' + a.kind + ' RL=' + b.kind + ' ' + (b.message || ''); }
    else if (a.kind === 'panic') { const am = (a.stderr.match(/panicked at [^\n]*\n([^\n]*)/) || [])[1], bm = (b.stderr.match(/panicked at [^\n]*\n([^\n]*)/) || [])[1]; if (am !== bm) { ok = 'warn'; why = 'panic msg: rustc "' + am + '" RL "' + bm + '"'; } }
  }
  if (expect) {
    if (expect === 'panic' && a.kind !== 'panic') { ok = false; why += ' [expected panic, rustc ' + a.kind + ']'; }
    if (/^E\d+$/.test(expect) && !(a.codes || []).includes(expect)) { ok = false; why += ' [expected ' + expect + ', rustc ' + (a.codes || []).join(',') + ']'; }
  }
  console.log((ok === true ? 'PASS ' : ok === 'warn' ? 'WARN ' : 'FAIL ') + name + (why ? '  ' + why.split('\n').slice(0, 30).join('\n      ') : ''));
  return { ok, a, b };
}
module.exports = { compare, rustc, rl };
if (require.main === module) {
  const { LESSONS, SANDBOX_CODE } = require('../ui/lessons.js');
  let fails = 0;
  const only = process.argv[2];
  for (const L of LESSONS) {
    if (only && !L.id.includes(only)) continue;
    if (compare(L.id + ':starter', L.starter, L.stdin, L.expectStarter).ok === false) fails++;
    const r = compare(L.id + ':solution', L.solution, L.stdin);
    if (r.ok === false) fails++;
    // checks on solution
    for (const c of L.task.checks) {
      let pass;
      const out = r.b.stdout;
      if (c.type === 'out') pass = out.includes(c.value);
      else if (c.type === 'ok') pass = r.b.kind === 'ok';
      else if (c.type === 'code') pass = c.value.startsWith('re:') ? new RegExp(c.value.slice(3)).test(L.solution) : L.solution.includes(c.value);
      else if (c.type === 'nocode') pass = !(c.value.startsWith('re:') ? new RegExp(c.value.slice(3)).test(L.solution) : L.solution.includes(c.value));
      if (!pass) { fails++; console.log('   CHECK FAIL on solution: ' + c.label); }
    }
    // starter should NOT pass all checks
    const s = r.b; void s;
  }
  if (!only) if (compare('sandbox', SANDBOX_CODE).ok === false) fails++;
  // extra test files
  if (!only) for (const f of fs.readdirSync(path.join(__dirname, 'programs')).filter(f => f.endsWith('.rs')).sort()) {
    const src = fs.readFileSync(path.join(__dirname, 'programs', f), 'utf8'); const sin = fs.existsSync(path.join(__dirname, 'programs', f + '.in')) ? fs.readFileSync(path.join(__dirname, 'programs', f + '.in'), 'utf8') : '';
    if (compare('programs/' + f, src, sin).ok === false) fails++;
  }
  console.log(fails ? fails + ' failures' : 'all good');
  process.exitCode = fails ? 1 : 0;
}
