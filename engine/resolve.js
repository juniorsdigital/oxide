// ---------- RustLite: format strings + static resolution ----------
function parseFmt(s, strPos, errAt) {
  const pieces = []; let lit = ''; let i = 0;
  const offset = 1; // opening quote
  while (i < s.length) {
    const c = s[i];
    if (c === '{') {
      if (s[i + 1] === '{') { lit += '{'; i += 2; continue; }
      const close = s.indexOf('}', i);
      if (close < 0) errAt('invalid format string: expected `}` but string was terminated', strPos + offset + i);
      const inner = s.slice(i + 1, close);
      if (lit) { pieces.push(lit); lit = ''; }
      const colon = inner.indexOf(':');
      const argStr = (colon < 0 ? inner : inner.slice(0, colon)).trim();
      const specStr = colon < 0 ? '' : inner.slice(colon + 1);
      let arg;
      if (argStr === '') arg = { kind: 'next' };
      else if (/^\d+$/.test(argStr)) arg = { kind: 'index', v: +argStr };
      else if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(argStr)) arg = { kind: 'name', v: argStr, pos: strPos + offset + i + 1 };
      else errAt('invalid format string: invalid argument name `' + argStr + '`', strPos + offset + i + 1);
      pieces.push({ arg, spec: parseSpec(specStr, () => errAt('invalid format string: unknown format spec `' + specStr + '`', strPos + offset + i)), pos: strPos + offset + i, end: strPos + offset + close + 1 });
      i = close + 1; continue;
    }
    if (c === '}') {
      if (s[i + 1] === '}') { lit += '}'; i += 2; continue; }
      errAt('invalid format string: unmatched `}` found', strPos + offset + i);
    }
    lit += c; i++;
  }
  if (lit) pieces.push(lit);
  return pieces;
}
function parseSpec(sp, bad) {
  const spec = { fill: ' ', align: null, sign: null, alt: false, zero: false, width: null, widthArg: null, prec: null, precArg: null, ty: '' };
  let i = 0;
  const chars = Array.from(sp);
  const at = (k) => chars[k];
  if (chars.length >= 2 && '<^>'.includes(at(1))) { spec.fill = at(0); spec.align = at(1); i = 2; }
  else if ('<^>'.includes(at(0) || 'x')) { spec.align = at(0); i = 1; }
  if (at(i) === '+' || at(i) === '-') { spec.sign = at(i); i++; }
  if (at(i) === '#') { spec.alt = true; i++; }
  if (at(i) === '0' && /[0-9]/.test(at(i + 1) || '') ) { spec.zero = true; i++; }
  else if (at(i) === '0' && !/[0-9]/.test(at(i + 1) || '')) { spec.zero = true; i++; }
  const rest = chars.slice(i).join('');
  const m = /^(?:(\d+)\$|([A-Za-z_][A-Za-z0-9_]*)\$|(\d+))?(?:\.(?:(\d+)\$|([A-Za-z_][A-Za-z0-9_]*)\$|(\d+)|(\*)))?(\?|x\?|X\?|x|X|o|b|e|E|p)?$/.exec(rest);
  if (!m) bad();
  if (m[1] !== undefined) spec.widthArg = { kind: 'index', v: +m[1] };
  else if (m[2] !== undefined) spec.widthArg = { kind: 'name', v: m[2] };
  else if (m[3] !== undefined) spec.width = +m[3];
  if (m[4] !== undefined) spec.precArg = { kind: 'index', v: +m[4] };
  else if (m[5] !== undefined) spec.precArg = { kind: 'name', v: m[5] };
  else if (m[6] !== undefined) spec.prec = +m[6];
  else if (m[7] !== undefined) spec.precArg = { kind: 'star' };
  spec.ty = m[8] || '';
  if (spec.zero && spec.width === null && spec.widthArg === null) { /* "{:0}" means width 0 */ spec.width = 0; }
  return spec;
}

const FMT_MACROS = { println: 0, print: 0, eprintln: 0, eprint: 0, format: 0, panic: 0, write: 1, writeln: 1, unreachable: 0, todo: 0, unimplemented: 0, assert: 1, assert_eq: 2, assert_ne: 2, debug_assert: 1, debug_assert_eq: 2, debug_assert_ne: 2 };
const KNOWN_MACROS = new Set(Object.keys(FMT_MACROS).concat(['vec', 'matches', 'dbg', 'concat', 'stringify', 'include_str', 'env', 'line', 'column', 'file']));

const BUILTIN_NAMES = new Set(['Some', 'None', 'Ok', 'Err', 'drop', 'Box', 'String', 'Vec', 'HashMap', 'HashSet', 'BTreeMap', 'BTreeSet', 'VecDeque', 'Rc', 'Arc', 'RefCell', 'Cell', 'Mutex', 'RwLock', 'Option', 'Result', 'Default',
  'i8', 'i16', 'i32', 'i64', 'i128', 'isize', 'u8', 'u16', 'u32', 'u64', 'u128', 'usize', 'f32', 'f64', 'char', 'str', 'bool', 'std', 'core', 'thread', 'mpsc', 'Duration', 'Instant', 'io', 'fmt', 'mem', 'cmp', 'Ordering', 'iter', 'process', 'Self', 'self', 'Weak', 'Wrapping', 'From', 'Into', 'Iterator', 'Clone', 'ToString', 'AtomicUsize', 'AtomicI32', 'AtomicU64', 'AtomicBool', 'Reverse', 'BinaryHeap', 'PhantomData', 'channel', 'spawn', 'sleep', 'max', 'min', 'swap', 'replace', 'take', 'repeat', 'once', 'empty', 'size_of', 'sync', 'collections', 'time', 'Error', 'Display', 'Debug', 'char', 'super', 'crate', 'TryFrom', 'TryInto', 'FromStr', 'Add', 'Sub', 'Mul', 'Div', 'Neg', 'AddAssign']);

function resolveProgram(items, src) {
  const errAt = (msg, pos, code) => { throw new CompileError(code || null, msg, [{ pos, end: pos + 1, text: '', primary: true }]); };
  const G = { fns: new Map(), structs: new Map(), enums: new Map(), traits: new Map(), consts: new Map(), mods: new Set(), aliases: new Map(), unitNames: new Set(), globImports: [] };
  const errors = [];

  function collect(items, prefix) {
    for (const it of items) {
      const full = prefix.concat([it.name]).join('::');
      switch (it.k) {
        case 'fn': G.fns.set(full, it); if (!prefix.length) G.fns.set(it.name, it); break;
        case 'struct': G.structs.set(it.name, it); if (it.kind === 'unit') G.unitNames.add(it.name); break;
        case 'enum': G.enums.set(it.name, it); break;
        case 'trait': G.traits.set(it.name, it); break;
        case 'const': G.consts.set(full, it); G.consts.set(it.name, it); G.unitNames.add(it.name); break;
        case 'mod': G.mods.add(it.name); collect(it.items, prefix.concat([it.name])); break;
        case 'use':
          for (const u of it.paths) {
            if (u.glob) {
              G.globImports.push(u.path);
              const en = G.enums.get(u.path[u.path.length - 1]);
              if (u.path.length) G.pendingGlob = (G.pendingGlob || []).concat([u.path]);
            } else G.aliases.set(u.alias, u.path);
          }
          break;
      }
    }
  }
  collect(items, []);
  // glob imports of enum variants / module items
  for (const path of G.pendingGlob || []) {
    const last = path[path.length - 1];
    const en = G.enums.get(last);
    if (en) for (const v of en.variants) { G.aliases.set(v.name, [last, v.name]); if (v.kind === 'unit') G.unitNames.add(v.name); }
    if (G.mods.has(last)) {
      for (const [k, f] of G.fns) if (k.startsWith(path.join('::') + '::')) G.aliases.set(f.name, k.split('::'));
    }
    if (last === 'Ordering') ['Less', 'Equal', 'Greater'].forEach((n) => { G.aliases.set(n, ['Ordering', n]); G.unitNames.add(n); });
  }
  for (const [alias, path] of G.aliases) {
    const last = path[path.length - 1];
    const en = G.enums.get(path[path.length - 2]);
    if (en) { const v = en.variants.find((x) => x.name === last); if (v && v.kind === 'unit') G.unitNames.add(alias); }
    if (path.length >= 2 && path[path.length - 2] === 'Ordering') G.unitNames.add(alias);
  }

  let declId = 0;
  const scopes = [];
  const loops = [];
  const closures = [];
  const lookup = (name) => { for (let i = scopes.length - 1; i >= 0; i--) { const d = scopes[i].get(name); if (d) return d; } return null; };
  const isGlobalName = (name) => G.fns.has(name) || G.consts.has(name) || G.structs.has(name) || G.enums.has(name) || G.aliases.has(name) || G.mods.has(name) || G.traits.has(name) || BUILTIN_NAMES.has(name);

  function useDecl(d, pos) {
    if (pos > d.lastUse) d.lastUse = pos;
    if (!d.lastRealUse || pos > d.lastRealUse) d.lastRealUse = pos;
    for (const L of loops) if (L.depth > d.depth && L.end > d.lastUse) d.lastUse = L.end;
    for (const C of closures) if (C.depth > d.depth) C.node.captures.add(d.name);
  }
  function declare(pat, isParam) {
    switch (pat.pk) {
      case 'bind': {
        if (pat.maybePath && G.unitNames.has(pat.name)) { pat.pk = 'path'; pat.segs = G.aliases.get(pat.name) || [pat.name]; return; }
        if (pat.maybePath && (pat.name === 'None')) { pat.pk = 'path'; pat.segs = ['None']; return; }
        const d = { name: pat.name, mut: pat.mut, pos: pat.namePos, end: pat.nameEnd, lastUse: pat.nameEnd, depth: scopes.length - 1, id: ++declId, isParam: !!isParam };
        pat.decl = d;
        scopes[scopes.length - 1].set(pat.name, d);
        if (pat.sub) declare(pat.sub, isParam);
        return;
      }
      case 'tuple': case 'slice': pat.elems.forEach((e) => declare(e, isParam)); return;
      case 'tstruct': pat.elems.forEach((e) => declare(e, isParam)); return;
      case 'struct': pat.fields.forEach((f) => declare(f.pat, isParam)); return;
      case 'ref': declare(pat.pat, isParam); return;
      case 'or': {
        // all alternatives bind the same names; declare first, map others to same decls
        declare(pat.alts[0], isParam);
        for (let i = 1; i < pat.alts.length; i++) {
          const tmp = new Map(); scopes.push(tmp); declare(pat.alts[i], isParam); scopes.pop();
          linkOr(pat.alts[i]);
        }
        return;
      }
      default: return;
    }
  }
  function linkOr(pat) {
    if (pat.pk === 'bind') { const d = lookup(pat.name); if (d) pat.decl = d; }
    (pat.elems || []).forEach(linkOr); (pat.fields || []).forEach((f) => linkOr(f.pat)); if (pat.pat) linkOr(pat.pat);
    if (pat.alts) pat.alts.forEach(linkOr);
  }
  function rpatExprs(pat) {
    // range pattern bounds referencing consts
    if (!pat) return;
    if (pat.pk === 'or') pat.alts.forEach(rpatExprs);
  }
  function withScope(fn) { scopes.push(new Map()); try { return fn(); } finally { scopes.pop(); } }

  function rType() { }
  function elidedRefs(ty, acc) {
    if (!ty) return acc;
    if (ty.tk === 'ref') { if (!ty.lifetime) acc.push(ty); elidedRefs(ty.inner, acc); }
    else if (ty.tk === 'path') (ty.args || []).forEach((a) => elidedRefs(a, acc));
    else if (ty.tk === 'tuple') ty.elems.forEach((a) => elidedRefs(a, acc));
    else if (ty.tk === 'slice' || ty.tk === 'array') elidedRefs(ty.elem, acc);
    return acc;
  }
  function anyRefs(ty) {
    if (!ty) return false;
    if (ty.tk === 'ref') return true;
    if (ty.tk === 'path') return (ty.args || []).some(anyRefs);
    if (ty.tk === 'tuple') return ty.elems.some(anyRefs);
    if (ty.tk === 'slice' || ty.tk === 'array') return anyRefs(ty.elem);
    return false;
  }
  function checkLifetimes(fn) {
    if (!fn.ret) return;
    const outRefs = elidedRefs(fn.ret, []);
    if (!outRefs.length) return;
    if (fn.selfParam && fn.selfParam.ref) return;
    const inParams = fn.params.filter((p) => anyRefs(p.ty));
    if (inParams.length === 1) return;
    const o = outRefs[0];
    const names = fn.params.filter((p) => anyRefs(p.ty)).map((p) => p.pat.name || '_');
    const labels = [{ pos: o.pos, end: o.pos + 1, text: 'expected named lifetime parameter', primary: true }];
    for (const p of inParams) { const r = elidedRefs(p.ty, [])[0]; if (r) labels.unshift({ pos: r.pos, end: r.end, text: '', primary: false }); }
    const notes = inParams.length === 0
      ? ['help: this function\'s return type contains a borrowed value, but there is no value for it to be borrowed from', 'help: consider returning an owned value instead, for example `String` rather than `&str`']
      : ['help: this function\'s return type contains a borrowed value, but the signature does not say whether it is borrowed from ' + names.map((x) => '`' + x + '`').join(' or '), "help: consider introducing a named lifetime parameter: `fn " + fn.name + "<'a>(...)` and write `&'a` on the inputs and the output that are linked"];
    throw new CompileError('E0106', 'missing lifetime specifier', labels, notes);
  }
  function rFn(fn) {
    checkLifetimes(fn);
    if (!fn.body) return;
    withScope(() => {
      if (fn.selfParam) scopes[scopes.length - 1].set('self', fn.selfDecl = { name: 'self', mut: fn.selfParam.mut && !fn.selfParam.ref, pos: fn.selfParam.pos, end: fn.selfParam.pos + 4, lastUse: 0, depth: scopes.length - 1, id: ++declId, isParam: true });
      for (const prm of fn.params) declare(prm.pat, true);
      rBlock(fn.body, true);
    });
  }
  function rItems(items) {
    for (const it of items) {
      if (it.k === 'fn') rFn(it);
      else if (it.k === 'impl' || it.k === 'trait') it.items.forEach((f) => { if (f.k === 'fn') rFn(f); else if (f.k === 'const' && f.expr) rExpr(f.expr); });
      else if (it.k === 'mod') rItems(it.items);
      else if (it.k === 'const' && it.expr) rExpr(it.expr);
      else if (it.k === 'struct' || it.k === 'enum') {
        // check unknown field types loosely: nothing
      }
    }
  }
  function rBlock(b, noNewScope) {
    const body = () => {
      // nested items first (fns can be used before declaration)
      const nested = b.stmts.filter((s) => s.k === 'item').map((s) => s.item);
      if (nested.length) { collect(nested, []); }
      for (const s of b.stmts) {
        if (s.k === 'item') { rItems([s.item]); continue; }
        if (s.k === 'let') {
          if (s.init) rExpr(s.init);
          if (s.els) rBlock(s.els);
          declare(s.pat);
          continue;
        }
        rExpr(s.expr);
      }
    };
    if (noNewScope) body(); else withScope(body);
  }
  function rCond(c) {
    if (c.k === 'letcond') { rExpr(c.e); declare(c.pat); }
    else rExpr(c);
  }
  function rFmtMacro(node) {
    const idx = FMT_MACROS[node.name];
    const fmtArg = node.args[idx];
    if (!fmtArg) { node.fmt = null; return; }
    if (fmtArg.k !== 'str') {
      if (node.name === 'panic' || node.name === 'assert' || node.name.startsWith('assert') || node.name.startsWith('debug_assert')) { node.fmt = null; node.fmtIndex = idx; return; }
      errAt('format argument must be a string literal', fmtArg.pos);
    }
    const pieces = parseFmt(fmtArg.v, fmtArg.pos, (m, p) => errAt(m, p));
    node.fmt = pieces; node.fmtIndex = idx;
    node.implicit = {};
    const positional = node.args.length - idx - 1;
    let nextIdx = 0;
    const checkRef = (ref, pos) => {
      if (!ref) return;
      if (ref.kind === 'next') { ref.v = nextIdx++; ref.kind = 'index'; }
      if (ref.kind === 'index' && ref.v >= positional) {
        throw new CompileError(null, positional === 0 ? '1 positional argument in format string, but no arguments were given' : 'invalid reference to positional argument ' + ref.v + ' (there ' + (positional === 1 ? 'is 1 argument' : 'are ' + positional + ' arguments') + ')', [{ pos, end: pos + 2, text: '', primary: true }]);
      }
      if (ref.kind === 'name' && !(ref.v in node.named) && !(ref.v in node.implicit)) {
        const pn = { k: 'path', segs: [ref.v], pos: ref.pos || pos, end: (ref.pos || pos) + ref.v.length };
        node.implicit[ref.v] = pn;
        rExpr(pn);
      }
    };
    let used = 0;
    for (const pc of pieces) {
      if (typeof pc === 'string') continue;
      checkRef(pc.arg, pc.pos);
      if (pc.spec.widthArg) checkRef(pc.spec.widthArg, pc.pos);
      if (pc.spec.precArg && pc.spec.precArg.kind === 'star') { pc.spec.precArg = { kind: 'index', v: nextIdx++ }; checkRef(pc.spec.precArg, pc.pos); }
      else if (pc.spec.precArg) checkRef(pc.spec.precArg, pc.pos);
      used++;
    }
    const maxIdx = Math.max(-1, ...pieces.filter((x) => typeof x !== 'string').flatMap((x) => [x.arg, x.spec.widthArg, x.spec.precArg]).filter((r) => r && r.kind === 'index').map((r) => r.v));
    if (positional > maxIdx + 1) {
      const extra = node.args[idx + 1 + maxIdx + 1];
      throw new CompileError(null, positional - maxIdx - 1 === 1 ? 'argument never used' : 'multiple unused formatting arguments', [{ pos: extra.pos, end: extra.end, text: 'argument never used', primary: true }, { pos: fmtArg.pos, end: fmtArg.end, text: 'formatting specifier missing', primary: false }]);
    }
  }
  function rExpr(e) {
    if (!e) return;
    switch (e.k) {
      case 'int': case 'float': case 'str': case 'char': case 'bool': return;
      case 'path': {
        if (e.segs.length === 1) {
          const name = e.segs[0];
          const d = lookup(name);
          if (d) { e.decl = d; useDecl(d, e.pos); return; }
          if (isGlobalName(name)) return;
          if (/^[A-Z]/.test(name) && !G.structs.has(name)) {
            errors.push(new CompileError('E0425', 'cannot find value `' + name + '` in this scope', [{ pos: e.pos, end: e.end, text: 'not found in this scope', primary: true }]));
            return;
          }
          errors.push(new CompileError('E0425', 'cannot find value `' + name + '` in this scope', [{ pos: e.pos, end: e.end, text: 'not found in this scope', primary: true }]));
        }
        return;
      }
      case 'unary': case 'ref': case 'cast': case 'try': case 'paren': case 'field': rExpr(e.e); return;
      case 'bin': rExpr(e.l); rExpr(e.r); return;
      case 'assign': rExpr(e.r); rExpr(e.l); return;
      case 'range': rExpr(e.lo); rExpr(e.hi); return;
      case 'call': {
        if (e.f.k === 'path' && e.f.segs.length === 1 && !lookup(e.f.segs[0]) && !isGlobalName(e.f.segs[0])) {
          errors.push(new CompileError('E0425', 'cannot find function `' + e.f.segs[0] + '` in this scope', [{ pos: e.f.pos, end: e.f.end, text: 'not found in this scope', primary: true }]));
        } else rExpr(e.f);
        e.args.forEach(rExpr); return;
      }
      case 'mcall': rExpr(e.recv); e.args.forEach(rExpr); return;
      case 'index': rExpr(e.e); rExpr(e.idx); return;
      case 'tuple': case 'array': e.elems.forEach(rExpr); return;
      case 'arrayRep': rExpr(e.e); rExpr(e.n); return;
      case 'structLit': e.fields.forEach((f) => rExpr(f.e)); rExpr(e.base); return;
      case 'block': rBlock(e); return;
      case 'if': withScope(() => { rCond(e.cond); rBlock(e.then); }); if (e.els) rExpr(e.els); return;
      case 'match': {
        rExpr(e.e);
        for (const arm of e.arms) withScope(() => { declare(arm.pat); if (arm.guard) rExpr(arm.guard); rExpr(arm.body); });
        return;
      }
      case 'while': {
        loops.push({ depth: scopes.length, end: e.end });
        withScope(() => { rCond(e.cond); rBlock(e.body); });
        loops.pop(); return;
      }
      case 'loop': loops.push({ depth: scopes.length, end: e.end }); rBlock(e.body); loops.pop(); return;
      case 'for': {
        rExpr(e.iter);
        loops.push({ depth: scopes.length, end: e.end });
        withScope(() => { declare(e.pat); rBlock(e.body); });
        loops.pop(); return;
      }
      case 'return': case 'break': rExpr(e.e); return;
      case 'continue': return;
      case 'closure': {
        e.captures = new Set();
        closures.push({ depth: scopes.length, node: e });
        // a closure may run many times: treat like a loop for liveness
        loops.push({ depth: scopes.length, end: e.end });
        withScope(() => { e.params.forEach((pm) => declare(pm.pat, true)); rExpr(e.body); });
        loops.pop();
        closures.pop();
        return;
      }
      case 'macro': {
        if (!KNOWN_MACROS.has(e.name)) errAt('cannot find macro `' + e.name + '` in this scope (not available in the teaching interpreter)', e.pos);
        if (e.name in FMT_MACROS) {
          const idx = FMT_MACROS[e.name];
          e.args.forEach((a, i) => { if (i !== idx || a.k !== 'str') rExpr(a); });
          Object.values(e.named).forEach(rExpr);
          rFmtMacro(e);
          return;
        }
        if (e.rep) { rExpr(e.rep.e); rExpr(e.rep.n); }
        e.args.forEach(rExpr);
        if (e.name === 'matches') withScope(() => { declare(e.pat); if (e.guard) rExpr(e.guard); });
        return;
      }
      default: return;
    }
  }
  withScope(() => rItems(items));
  if (errors.length) throw errors[0];
  return G;
}
