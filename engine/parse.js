// ---------- RustLite: lexer + parser ----------
class CompileError extends Error {
  constructor(code, msg, labels, notes) {
    super(msg); this.code = code; this.rmsg = msg; this.labels = labels || []; this.notes = notes || [];
  }
}
class LimitError extends Error {}

const KEYWORDS = new Set(['self','Self','as','break','const','continue','crate','else','enum','extern','false','fn','for','if','impl','in','let','loop','match','mod','move','mut','pub','ref','return','static','struct','super','trait','true','type','unsafe','use','where','while','dyn']);
const PUNCTS = ['<<=','>>=','...','..=','::','->','=>','==','!=','<=','>=','&&','||','+=','-=','*=','/=','%=','^=','&=','|=','<<','>>','..',
  '+','-','*','/','%','^','!','&','|','=','<','>','@','.',',',';',':','#','$','?','~','{','}','[',']','(',')'];
const INT_SUFFIX = ['i8','i16','i32','i64','i128','isize','u8','u16','u32','u64','u128','usize'];
const FLOAT_SUFFIX = ['f32','f64'];

function unescapeStr(s, start, err) {
  let out = ''; let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c !== '\\') { out += c; i++; continue; }
    const d = s[i + 1];
    if (d === 'n') { out += '\n'; i += 2; }
    else if (d === 't') { out += '\t'; i += 2; }
    else if (d === 'r') { out += '\r'; i += 2; }
    else if (d === '0') { out += '\0'; i += 2; }
    else if (d === '\\') { out += '\\'; i += 2; }
    else if (d === '"') { out += '"'; i += 2; }
    else if (d === "'") { out += "'"; i += 2; }
    else if (d === 'x') { out += String.fromCharCode(parseInt(s.substr(i + 2, 2), 16)); i += 4; }
    else if (d === 'u') {
      const e = s.indexOf('}', i);
      out += String.fromCodePoint(parseInt(s.slice(i + 3, e).replace(/_/g, ''), 16)); i = e + 1;
    } else if (d === '\n' || d === '\r') {
      i += 2; while (i < s.length && /\s/.test(s[i])) i++;
    } else err('unknown character escape: `' + d + '`', start + i);
  }
  return out;
}

function lex(src) {
  const toks = []; let i = 0; const n = src.length;
  const err = (msg, p) => { throw new CompileError(null, msg, [{ pos: p, end: p + 1, text: '', primary: true }]); };
  const isIdStart = (c) => /[A-Za-z_]/.test(c) || (c > '\x7f' && /\p{L}/u.test(c));
  const isId = (c) => c !== undefined && (/[A-Za-z0-9_]/.test(c) || (c > '\x7f' && /[\p{L}\p{N}]/u.test(c)));
  while (i < n) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '﻿') { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') {
      let d = 1; const st = i; i += 2;
      while (i < n && d > 0) {
        if (src[i] === '/' && src[i + 1] === '*') { d++; i += 2; }
        else if (src[i] === '*' && src[i + 1] === '/') { d--; i += 2; }
        else i++;
      }
      if (d > 0) err('unterminated block comment', st);
      continue;
    }
    const start = i;
    // raw strings r"..", r#".."#, br".."
    if (c === 'r' || (c === 'b' && src[i + 1] === 'r')) {
      let j = i + (c === 'b' ? 2 : 1); let hashes = 0;
      while (src[j] === '#') { hashes++; j++; }
      if (src[j] === '"' && (hashes > 0 || j === i + (c === 'b' ? 2 : 1))) {
        j++;
        const close = '"' + '#'.repeat(hashes);
        const e = src.indexOf(close, j);
        if (e < 0) err('unterminated raw string', start);
        toks.push({ t: 'str', v: src.slice(j, e), pos: start, end: e + close.length, bytes: c === 'b' });
        i = e + close.length; continue;
      }
    }
    if (c === 'b' && (src[i + 1] === '"' || src[i + 1] === "'")) {
      const q = src[i + 1]; let j = i + 2; let raw = '';
      while (j < n && src[j] !== q) { if (src[j] === '\\') { raw += src[j] + src[j + 1]; j += 2; } else raw += src[j++]; }
      if (j >= n) err('unterminated byte literal', start);
      const v = unescapeStr(raw, start + 2, err);
      if (q === '"') toks.push({ t: 'str', v, pos: start, end: j + 1, bytes: true });
      else toks.push({ t: 'int', v: BigInt(v.charCodeAt(0)), suffix: 'u8', pos: start, end: j + 1, raw: src.slice(start, j + 1) });
      i = j + 1; continue;
    }
    if (isIdStart(c)) {
      let j = i + 1; while (isId(src[j])) j++;
      const w = src.slice(i, j);
      if (w === 'true' || w === 'false') toks.push({ t: 'bool', v: w === 'true', pos: start, end: j });
      else toks.push({ t: KEYWORDS.has(w) ? 'kw' : 'ident', v: w, pos: start, end: j });
      i = j; continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i; let isFloat = false; let text;
      if (c === '0' && /[xob]/.test(src[i + 1])) {
        const base = src[i + 1]; j = i + 2;
        while (/[0-9a-fA-F_]/.test(src[j] || '')) {
          // stop before suffix like u8 in 0xffu8
          if (base !== 'x' && /[a-zA-Z]/.test(src[j])) break;
          if (base === 'x' && (src.startsWith('u', j) || src.startsWith('i', j))) break;
          j++;
        }
        text = src.slice(i, j).replace(/_/g, '');
      } else {
        while (/[0-9_]/.test(src[j] || '')) j++;
        if (src[j] === '.' && src[j + 1] !== '.' && !isIdStart(src[j + 1] || ' ')) {
          isFloat = true; j++;
          while (/[0-9_]/.test(src[j] || '')) j++;
        }
        if ((src[j] === 'e' || src[j] === 'E') && /[0-9+\-]/.test(src[j + 1] || '')) {
          isFloat = true; j++; if (src[j] === '+' || src[j] === '-') j++;
          while (/[0-9_]/.test(src[j] || '')) j++;
        }
        text = src.slice(i, j).replace(/_/g, '');
      }
      let suffix = null;
      for (const s of INT_SUFFIX.concat(FLOAT_SUFFIX)) {
        if (src.startsWith(s, j) && !isId(src[j + s.length])) { suffix = s; break; }
      }
      // allow underscore before suffix e.g. 10_u32
      if (!suffix && src[j - 1] === '_') { /* handled by replace */ }
      if (suffix) j += suffix.length;
      const raw = src.slice(i, j);
      if (isFloat || (suffix && FLOAT_SUFFIX.includes(suffix))) {
        toks.push({ t: 'float', v: parseFloat(text), suffix, pos: start, end: j, raw });
      } else {
        toks.push({ t: 'int', v: BigInt(text), suffix, pos: start, end: j, raw });
      }
      i = j; continue;
    }
    if (c === '"') {
      let j = i + 1; let raw = '';
      while (j < n && src[j] !== '"') { if (src[j] === '\\') { raw += src[j] + src[j + 1]; j += 2; } else raw += src[j++]; }
      if (j >= n) err('unterminated double quote string', start);
      toks.push({ t: 'str', v: unescapeStr(raw, start + 1, err), pos: start, end: j + 1, rawText: raw });
      i = j + 1; continue;
    }
    if (c === "'") {
      if (src[i + 1] === '\\') {
        let j = i + 2;
        while (j < n && src[j] !== "'") j++;
        const v = unescapeStr(src.slice(i + 1, j), start + 1, err);
        toks.push({ t: 'char', v, pos: start, end: j + 1 }); i = j + 1; continue;
      }
      const cp = src.codePointAt(i + 1);
      const w = cp > 0xffff ? 2 : 1;
      if (src[i + 1 + w] === "'") {
        toks.push({ t: 'char', v: String.fromCodePoint(cp), pos: start, end: i + 2 + w }); i += 2 + w; continue;
      }
      if (isIdStart(src[i + 1] || ' ')) {
        let j = i + 2; while (isId(src[j])) j++;
        toks.push({ t: 'lifetime', v: src.slice(i + 1, j), pos: start, end: j }); i = j; continue;
      }
      err('unterminated character literal', start);
    }
    let matched = null;
    for (const p of PUNCTS) if (src.startsWith(p, i)) { matched = p; break; }
    if (!matched) err('unknown start of token: ' + c, start);
    toks.push({ t: 'punct', v: matched, pos: start, end: i + matched.length });
    i += matched.length;
  }
  toks.push({ t: 'eof', v: '', pos: n, end: n });
  return toks;
}

// ---------- Parser ----------
function parse(src) {
  const toks = lex(src);
  let p = 0;
  const peek = (o = 0) => toks[Math.min(p + o, toks.length - 1)];
  const next = () => toks[p++];
  const is = (v, o = 0) => { const t = peek(o); return (t.t === 'punct' || t.t === 'kw') && t.v === v; };
  const isIdent = (o = 0) => peek(o).t === 'ident';
  const fail = (msg, t) => {
    t = t || peek();
    throw new CompileError(null, msg, [{ pos: t.pos, end: Math.max(t.end, t.pos + 1), text: '', primary: true }]);
  };
  const describe = (t) => t.t === 'eof' ? '<eof>' : '`' + (t.t === 'str' ? '"' + t.v + '"' : String(t.raw || t.v)) + '`';
  const expect = (v) => {
    const t = peek();
    if ((t.t === 'punct' || t.t === 'kw') && t.v === v) return next();
    // split compound tokens
    if (v === '>' && t.t === 'punct' && (t.v === '>>' || t.v === '>=' || t.v === '>>=')) {
      toks.splice(p, 1, { t: 'punct', v: '>', pos: t.pos, end: t.pos + 1 }, { t: 'punct', v: t.v.slice(1), pos: t.pos + 1, end: t.end });
      return next();
    }
    if (v === '|' && t.t === 'punct' && t.v === '||') {
      toks.splice(p, 1, { t: 'punct', v: '|', pos: t.pos, end: t.pos + 1 }, { t: 'punct', v: '|', pos: t.pos + 1, end: t.end });
      return next();
    }
    if (v === '&' && t.t === 'punct' && t.v === '&&') {
      toks.splice(p, 1, { t: 'punct', v: '&', pos: t.pos, end: t.pos + 1 }, { t: 'punct', v: '&', pos: t.pos + 1, end: t.end });
      return next();
    }
    if (v === ';') {
      const prev = toks[p - 1];
      throw new CompileError(null, 'expected `;`, found ' + describe(t), [{ pos: prev.end, end: prev.end + 1, text: 'help: add `;` here', primary: true }]);
    }
    fail('expected `' + v + '`, found ' + describe(t));
  };
  const eat = (v) => { if (is(v)) { next(); return true; } return false; };
  const ident = () => {
    const t = peek();
    if (t.t === 'ident' || (t.t === 'kw' && (t.v === 'self' || t.v === 'Self' || t.v === 'crate' || t.v === 'super'))) return next().v;
    fail('expected identifier, found ' + describe(t));
  };
  const isGtLike = () => { const t = peek(); return t.t === 'punct' && (t.v === '>' || t.v === '>>' || t.v === '>=' || t.v === '>>='); };

  // ----- attributes -----
  function parseAttrs() {
    const attrs = { derives: new Set(), test: false };
    while (is('#')) {
      next(); eat('!'); expect('[');
      const name = peek().v;
      let depth = 1; const items = [];
      while (depth > 0 && peek().t !== 'eof') {
        const t = next();
        if (t.v === '[' || t.v === '(') depth++;
        else if (t.v === ']' || t.v === ')') depth--;
        else if (t.t === 'ident') items.push(t.v);
      }
      if (name === 'derive') items.slice(1).forEach((d) => attrs.derives.add(d));
      if (name === 'test') attrs.test = true;
    }
    return attrs;
  }

  // ----- generics -----
  function parseGenericParams() {
    const names = [];
    if (!is('<')) return names;
    next(); let depth = 1; let expectName = true;
    while (depth > 0) {
      const t = peek();
      if (t.t === 'eof') fail('unclosed generic parameter list');
      if (t.t === 'punct' && t.v === '<') { depth++; next(); continue; }
      if (t.t === 'punct' && (t.v === '>' || t.v === '>>' || t.v === '>=' || t.v === '>>=')) { expect('>'); depth--; continue; }
      if (t.t === 'punct' && t.v === ',' && depth === 1) { expectName = true; next(); continue; }
      if (expectName && t.t === 'ident' && depth === 1) names.push(t.v);
      if (expectName && t.t === 'kw' && t.v === 'const') { next(); continue; }
      expectName = false; next();
    }
    return names;
  }
  function skipWhere() {
    if (!(peek().t === 'kw' && peek().v === 'where')) return;
    next(); let depth = 0;
    while (peek().t !== 'eof') {
      if (depth === 0 && (is('{') || is(';'))) break;
      const t = peek();
      if (t.v === '<') depth++;
      else if (t.t === 'punct' && (t.v === '>' || t.v === '>>')) { expect('>'); depth--; continue; }
      else if (t.v === '(' ) depth++;
      else if (t.v === ')') depth--;
      next();
    }
  }

  // ----- types -----
  function parseType() {
    const t = peek();
    if (is('&') || is('&&')) {
      const dbl = is('&&'); const st0 = next();
      let lifetime = null;
      if (peek().t === 'lifetime') lifetime = next().v;
      const mut = eat('mut');
      const inner = parseType();
      const r = { tk: 'ref', mut, inner, lifetime, pos: st0.pos, end: toks[p - 1].end };
      return dbl ? { tk: 'ref', mut: false, inner: r, pos: st0.pos, end: toks[p - 1].end } : r;
    }
    if (is('*')) { next(); if (!eat('const')) eat('mut'); return { tk: 'ref', mut: true, inner: parseType() }; }
    if (is('(')) {
      next(); const elems = [];
      while (!is(')')) { elems.push(parseType()); if (!eat(',')) break; }
      expect(')');
      if (elems.length === 1 && toks[p - 2].v !== ',') return elems[0];
      return { tk: 'tuple', elems };
    }
    if (is('[')) {
      next(); const elem = parseType();
      if (eat(';')) { const len = parseExpr(); expect(']'); return { tk: 'array', elem, len }; }
      expect(']'); return { tk: 'slice', elem };
    }
    if (is('!')) { next(); return { tk: 'never' }; }
    if (t.t === 'kw' && (t.v === 'dyn' || t.v === 'impl')) {
      next(); const bounds = [parseType()];
      while (is('+')) { next(); if (peek().t === 'lifetime') next(); else bounds.push(parseType()); }
      return { tk: t.v, bounds, name: bounds[0].name };
    }
    if (t.t === 'kw' && t.v === 'fn') {
      next(); expect('('); const params = [];
      while (!is(')')) { params.push(parseType()); if (!eat(',')) break; }
      expect(')'); let ret = null; if (eat('->')) ret = parseType();
      return { tk: 'fnptr', params, ret, name: 'fn' };
    }
    if (t.t === 'ident' && t.v === '_') { next(); return { tk: 'infer' }; }
    if (t.t === 'ident' || (t.t === 'kw' && (t.v === 'Self' || t.v === 'crate' || t.v === 'self' || t.v === 'super'))) {
      const segs = [ident()]; let args = [];
      for (;;) {
        if (is('<')) { args = parseTypeArgs(); }
        else if (is('(') && ['Fn', 'FnMut', 'FnOnce'].includes(segs[segs.length - 1])) {
          next(); const ps = []; while (!is(')')) { ps.push(parseType()); if (!eat(',')) break; } expect(')');
          let ret = null; if (eat('->')) ret = parseType();
          return { tk: 'path', name: segs[segs.length - 1], segs, args: ps, ret };
        }
        if (is('::')) { next(); if (is('<')) { args = parseTypeArgs(); continue; } segs.push(ident()); continue; }
        break;
      }
      return { tk: 'path', name: segs[segs.length - 1], segs, args };
    }
    if (t.t === 'lifetime') { next(); return { tk: 'lifetime' }; }
    fail('expected type, found ' + describe(t));
  }
  function parseTypeArgs() {
    expect('<'); const args = [];
    while (!isGtLike()) {
      if (peek().t === 'lifetime') { next(); }
      else if (isIdent() && is('=', 1)) { next(); next(); args.push(parseType()); }
      else if (peek().t === 'int') { next(); }
      else args.push(parseType());
      if (!eat(',')) break;
    }
    expect('>');
    return args;
  }

  // ----- items -----
  function parseItems(endTok) {
    const items = [];
    while (!(endTok ? is(endTok) : peek().t === 'eof')) {
      if (peek().t === 'eof') fail('this file contains an unclosed delimiter');
      const it = parseItem();
      if (it) items.push(it);
    }
    return items;
  }
  function parseVis() {
    if (is('pub')) { next(); if (is('(')) { next(); while (!is(')')) next(); next(); } return true; }
    return false;
  }
  function parseItem() {
    const attrs = parseAttrs();
    const start = peek().pos;
    const isPub = parseVis();
    const t = peek();
    if (t.t === 'kw') {
      switch (t.v) {
        case 'fn': return parseFn(attrs, isPub);
        case 'const': if (is('fn', 1)) { next(); return parseFn(attrs, isPub); } return parseConst('const');
        case 'unsafe': next(); return parseItem();
        case 'extern': next(); if (peek().t === 'str') next(); return parseItem();
        case 'static': return parseConst('static');
        case 'struct': return parseStruct(attrs, start);
        case 'enum': return parseEnum(attrs, start);
        case 'impl': return parseImpl();
        case 'trait': return parseTrait();
        case 'use': return parseUse();
        case 'mod': {
          next(); const name = ident();
          if (eat(';')) fail('file modules (`mod ' + name + ';`) are not available here; write `mod ' + name + ' { ... }` inline', t);
          expect('{'); const items = parseItems('}'); expect('}');
          return { k: 'mod', name, items, pos: start };
        }
        case 'type': {
          next(); const name = ident(); parseGenericParams(); expect('='); const ty = parseType(); expect(';');
          return { k: 'typealias', name, ty };
        }
      }
    }
    if (t.t === 'ident' && t.v === 'macro_rules') fail('`macro_rules!` is not supported in this teaching interpreter. Use the Rust Playground button to run this code.', t);
    fail('expected item, found ' + describe(t));
  }
  function parseFn(attrs, isPub) {
    const fnTok = expect('fn');
    const nameTok = peek(); const name = ident();
    const generics = parseGenericParams();
    expect('(');
    const params = []; let selfParam = null;
    while (!is(')')) {
      parseAttrs();
      // self forms: self, mut self, &self, &mut self, &'a self, self: Type
      const save = p;
      let ref = false, mut = false;
      if (is('&')) { next(); ref = true; if (peek().t === 'lifetime') next(); if (eat('mut')) mut = true; }
      else if (is('mut') && peek(1).v === 'self') { next(); mut = true; }
      if (peek().t === 'kw' && peek().v === 'self') {
        const st = next();
        if (eat(':')) { const ty = parseType(); if (ty.tk === 'ref') { ref = true; mut = ty.mut; } }
        selfParam = { ref, mut, pos: st.pos };
      } else {
        p = save;
        const pat = parsePattern();
        expect(':');
        const ty = parseType();
        params.push({ pat, ty });
      }
      if (!eat(',')) break;
    }
    expect(')');
    let ret = null;
    if (eat('->')) ret = parseType();
    skipWhere();
    let body = null;
    if (is(';')) next();
    else body = parseBlock();
    return { k: 'fn', name, generics, params, selfParam, ret, body, pos: fnTok.pos, namePos: nameTok.pos, nameEnd: nameTok.end, isPub, isTest: attrs.test };
  }
  function parseConst(kind) {
    next(); eat('mut');
    const nameTok = peek(); const name = ident();
    let ty = null; if (eat(':')) ty = parseType();
    let expr = null;
    if (eat('=')) expr = parseExpr();
    expect(';');
    return { k: 'const', kind, name, ty, expr, pos: nameTok.pos };
  }
  function parseStructFields() {
    const fields = [];
    expect('{');
    while (!is('}')) {
      parseAttrs(); parseVis();
      const name = ident(); expect(':'); const ty = parseType();
      fields.push({ name, ty });
      if (!eat(',')) break;
    }
    expect('}');
    return fields;
  }
  function parseTupleFields() {
    const fields = []; expect('(');
    while (!is(')')) { parseAttrs(); parseVis(); fields.push({ name: String(fields.length), ty: parseType() }); if (!eat(',')) break; }
    expect(')');
    return fields;
  }
  function parseStruct(attrs, start) {
    next(); const name = ident(); const generics = parseGenericParams(); skipWhere();
    let kind = 'named', fields = [];
    if (is('{')) fields = parseStructFields();
    else if (is('(')) { kind = 'tuple'; fields = parseTupleFields(); skipWhere(); expect(';'); }
    else { kind = 'unit'; expect(';'); }
    return { k: 'struct', name, kind, fields, derives: attrs.derives, generics, pos: start };
  }
  function parseEnum(attrs, start) {
    next(); const name = ident(); parseGenericParams(); skipWhere(); expect('{');
    const variants = [];
    while (!is('}')) {
      parseAttrs();
      const vname = ident(); let kind = 'unit', fields = [];
      if (is('{')) { kind = 'named'; fields = parseStructFields(); }
      else if (is('(')) { kind = 'tuple'; fields = parseTupleFields(); }
      let disc = null;
      if (eat('=')) disc = parseExpr();
      variants.push({ name: vname, kind, fields, disc });
      if (!eat(',')) break;
    }
    expect('}');
    return { k: 'enum', name, variants, derives: attrs.derives, pos: start };
  }
  function parseImpl() {
    const st = next(); const generics = parseGenericParams();
    eat('!');
    let ty = parseType(); let trait = null;
    if (eat('for')) { trait = ty; ty = parseType(); }
    skipWhere();
    expect('{');
    const items = [];
    while (!is('}')) {
      const attrs = parseAttrs(); const isPub = parseVis();
      if (is('fn')) items.push(parseFn(attrs, isPub));
      else if (is('const') && !is('fn', 1)) items.push(parseConst('const'));
      else if (is('const')) { next(); items.push(parseFn(attrs, isPub)); }
      else if (is('unsafe')) { next(); items.push(parseFn(attrs, isPub)); }
      else if (is('type')) { next(); ident(); expect('='); parseType(); expect(';'); }
      else fail('expected `fn` in impl block, found ' + describe(peek()));
    }
    expect('}');
    return { k: 'impl', trait, ty, items, generics, pos: st.pos };
  }
  function parseTrait() {
    const st = next(); const name = ident(); parseGenericParams();
    if (eat(':')) { while (!is('{') && !is('where')) next(); }
    skipWhere();
    expect('{'); const items = [];
    while (!is('}')) {
      const attrs = parseAttrs();
      if (is('fn')) items.push(parseFn(attrs, false));
      else if (is('type')) { while (!is(';')) next(); next(); }
      else if (is('const')) items.push(parseConst('const'));
      else fail('expected `fn` in trait, found ' + describe(peek()));
    }
    expect('}');
    return { k: 'trait', name, items, pos: st.pos };
  }
  function parseUse() {
    const st = next(); const paths = [];
    function tree(prefix) {
      if (is('{')) {
        next();
        while (!is('}')) { tree(prefix.slice()); if (!eat(',')) break; }
        expect('}'); return;
      }
      if (is('*')) { next(); paths.push({ path: prefix, glob: true }); return; }
      const seg = ident();
      if (seg === 'self') { const al = eat('as') ? ident() : prefix[prefix.length - 1]; if (al) paths.push({ path: prefix, alias: al }); return; }
      const path = prefix.concat([seg]);
      if (is('::')) { next(); tree(path); return; }
      let alias = seg;
      if (eat('as')) alias = ident();
      paths.push({ path, alias });
    }
    tree([]);
    expect(';');
    return { k: 'use', paths, pos: st.pos };
  }

  // ----- blocks & statements -----
  const BLOCKLIKE = new Set(['if', 'match', 'loop', 'while', 'for', 'unsafe']);
  function parseBlock() {
    const st = expect('{');
    const stmts = [];
    while (!is('}')) {
      if (peek().t === 'eof') fail('this file contains an unclosed delimiter', st);
      if (eat(';')) continue;
      stmts.push(parseStmt());
    }
    const en = expect('}');
    return { k: 'block', stmts, pos: st.pos, end: en.end };
  }
  function isItemStart() {
    const t = peek();
    if (t.t === 'punct' && t.v === '#') return true;
    if (t.t !== 'kw') return false;
    if (['fn', 'struct', 'enum', 'impl', 'trait', 'use', 'mod', 'static', 'pub'].includes(t.v)) return true;
    if (t.v === 'const' && (peek(1).t === 'ident' || is('fn', 1)) && !is('{', 1)) return true;
    if (t.v === 'type') return true;
    return false;
  }
  function parseStmt() {
    if (isItemStart()) return { k: 'item', item: parseItem() };
    const t = peek();
    if (t.t === 'kw' && t.v === 'let') {
      next();
      const pat = parsePattern();
      let ty = null; if (eat(':')) ty = parseType();
      let init = null, els = null;
      if (eat('=')) {
        init = parseExpr();
        if (is('else')) { next(); els = parseBlock(); }
      }
      const semi = expect(';');
      return { k: 'let', pat, ty, init, els, pos: t.pos, end: semi.end };
    }
    const blockLike = (t.t === 'kw' && BLOCKLIKE.has(t.v)) || (t.t === 'punct' && t.v === '{') || (t.t === 'lifetime' && is(':', 1));
    if (blockLike) {
      let e = parsePrimary(false);
      if (is('.') || is('?')) {
        e = parsePostfixOps(e, false);
        e = parseBinRest(e, 0, false);
        if (is('=') || /^[+\-*/%^&|]=$|^<<=$|^>>=$/.test(peek().v)) { const op = next().v; e = { k: 'assign', op, l: e, r: parseExpr(), pos: e.pos, end: toks[p - 1].end }; }
        if (eat(';')) return { k: 'expr', expr: e, semi: true };
        if (is('}')) return { k: 'expr', expr: e, semi: false };
        expect(';');
      }
      if (eat(';')) return { k: 'expr', expr: e, semi: true };
      return { k: 'expr', expr: e, semi: false, blockLike: true };
    }
    const e = parseExpr();
    if (eat(';')) return { k: 'expr', expr: e, semi: true };
    if (is('}')) return { k: 'expr', expr: e, semi: false };
    expect(';');
  }

  // ----- expressions -----
  const BIN_PREC = { '||': 1, '&&': 2, '==': 3, '!=': 3, '<': 3, '>': 3, '<=': 3, '>=': 3, '|': 4, '^': 5, '&': 6, '<<': 7, '>>': 7, '+': 8, '-': 8, '*': 9, '/': 9, '%': 9 };
  const ASSIGN_OPS = new Set(['=', '+=', '-=', '*=', '/=', '%=', '^=', '&=', '|=', '<<=', '>>=']);
  function parseExpr(noStruct = false) { return parseAssign(noStruct); }
  function parseAssign(noStruct) {
    const lhs = parseRange(noStruct);
    const t = peek();
    if (t.t === 'punct' && ASSIGN_OPS.has(t.v)) {
      next();
      const rhs = parseAssign(noStruct);
      return { k: 'assign', op: t.v, l: lhs, r: rhs, pos: lhs.pos, end: rhs.end, opPos: t.pos };
    }
    return lhs;
  }
  function canStartExpr(noStruct) {
    const t = peek();
    if (t.t === 'eof') return false;
    if (t.t === 'punct' && [')', ']', '}', ',', ';', '=>', '=', '?'].includes(t.v)) return false;
    if (noStruct && t.t === 'punct' && t.v === '{') return false;
    return true;
  }
  function parseRange(noStruct) {
    if (is('..') || is('..=')) {
      const t = next(); const incl = t.v === '..=';
      const hi = canStartExpr(noStruct) ? parseBin(0, noStruct) : null;
      return { k: 'range', lo: null, hi, incl, pos: t.pos, end: hi ? hi.end : t.end };
    }
    const l = parseBin(0, noStruct);
    if (is('..') || is('..=')) {
      const t = next(); const incl = t.v === '..=';
      const hi = canStartExpr(noStruct) ? parseBin(0, noStruct) : null;
      return { k: 'range', lo: l, hi, incl, pos: l.pos, end: hi ? hi.end : t.end };
    }
    return l;
  }
  function parseBin(minPrec, noStruct) {
    const l = parseCast(noStruct);
    return parseBinRest(l, minPrec, noStruct);
  }
  function parseBinRest(l, minPrec, noStruct) {
    for (;;) {
      const t = peek();
      if (t.t !== 'punct') break;
      const prec = BIN_PREC[t.v];
      if (prec === undefined || prec <= minPrec) break;
      next();
      const r = parseBin(prec, noStruct);
      l = { k: 'bin', op: t.v, l, r, pos: l.pos, end: r.end, opPos: t.pos };
    }
    return l;
  }
  function parseCast(noStruct) {
    let e = parseUnary(noStruct);
    while (is('as')) { next(); const ty = parseType(); e = { k: 'cast', e, ty, pos: e.pos, end: toks[p - 1].end }; }
    return e;
  }
  function parseUnary(noStruct) {
    const t = peek();
    if (t.t === 'punct') {
      if (t.v === '-' || t.v === '!' || t.v === '*') {
        next(); const e = parseUnary(noStruct);
        return { k: 'unary', op: t.v, e, pos: t.pos, end: e.end };
      }
      if (t.v === '&' || t.v === '&&') {
        next(); const mut = eat('mut');
        const e = parseUnary(noStruct);
        const r = { k: 'ref', mut, e, pos: t.pos, end: e.end };
        return t.v === '&&' ? { k: 'ref', mut: false, e: r, pos: t.pos, end: e.end } : r;
      }
    }
    return parsePostfixOps(parsePrimary(noStruct), noStruct);
  }
  function parsePostfixOps(e, noStruct) {
    for (;;) {
      if (is('?')) { const t = next(); e = { k: 'try', e, pos: e.pos, end: t.end, opPos: t.pos }; continue; }
      if (is('.')) {
        next();
        const t = peek();
        if (t.t === 'int') { next(); e = { k: 'field', e, name: String(t.v), pos: e.pos, end: t.end, namePos: t.pos }; continue; }
        if (t.t === 'float') {
          next(); const parts = t.raw.split('.');
          e = { k: 'field', e, name: parts[0], pos: e.pos, end: t.end, namePos: t.pos };
          e = { k: 'field', e, name: parts[1], pos: e.pos, end: t.end, namePos: t.pos };
          continue;
        }
        if (t.t === 'ident' && t.v === 'await') { next(); continue; }
        const nameTok = peek(); const name = ident();
        let turbofish = null;
        if (is('::')) { next(); turbofish = parseTypeArgs(); }
        if (is('(')) {
          next(); const args = [];
          while (!is(')')) { args.push(parseExpr()); if (!eat(',')) break; }
          const en = expect(')');
          e = { k: 'mcall', recv: e, name, args, turbofish, pos: e.pos, end: en.end, namePos: nameTok.pos, nameEnd: nameTok.end };
        } else {
          e = { k: 'field', e, name, pos: e.pos, end: nameTok.end, namePos: nameTok.pos };
        }
        continue;
      }
      if (is('(')) {
        next(); const args = [];
        while (!is(')')) { args.push(parseExpr()); if (!eat(',')) break; }
        const en = expect(')');
        e = { k: 'call', f: e, args, pos: e.pos, end: en.end };
        continue;
      }
      if (is('[')) {
        next(); const idx = parseExpr(); const en = expect(']');
        e = { k: 'index', e, idx, pos: e.pos, end: en.end };
        continue;
      }
      break;
    }
    return e;
  }
  function parseCond() {
    if (is('let')) {
      const st = next(); const pat = parsePattern(); expect('='); const e = parseExpr(true);
      return { k: 'letcond', pat, e, pos: st.pos, end: e.end };
    }
    return parseExpr(true);
  }
  function parseIf() {
    const st = expect('if');
    const cond = parseCond();
    const then = parseBlock();
    let els = null;
    if (eat('else')) {
      if (is('if')) els = parseIf();
      else els = parseBlock();
    }
    return { k: 'if', cond, then, els, pos: st.pos, end: toks[p - 1].end };
  }
  function parsePrimary(noStruct) {
    const t = peek();
    switch (t.t) {
      case 'int': next(); return { k: 'int', v: t.v, suffix: t.suffix, pos: t.pos, end: t.end };
      case 'float': next(); return { k: 'float', v: t.v, suffix: t.suffix, pos: t.pos, end: t.end };
      case 'str': next(); return { k: 'str', v: t.v, bytes: t.bytes, pos: t.pos, end: t.end };
      case 'char': next(); return { k: 'char', v: t.v, pos: t.pos, end: t.end };
      case 'bool': next(); return { k: 'bool', v: t.v, pos: t.pos, end: t.end };
      case 'lifetime': {
        next(); expect(':');
        const e = parsePrimary(noStruct);
        if (!['loop', 'while', 'for', 'block'].includes(e.k)) fail('labeled expression must be a loop or block', t);
        e.label = t.v; return e;
      }
    }
    if (t.t === 'punct') {
      if (t.v === '(') {
        next();
        if (is(')')) { const en = next(); return { k: 'tuple', elems: [], pos: t.pos, end: en.end }; }
        const first = parseExpr();
        if (is(')')) { next(); return { k: 'paren', e: first, pos: t.pos, end: toks[p - 1].end }; }
        const elems = [first];
        while (eat(',')) { if (is(')')) break; elems.push(parseExpr()); }
        const en = expect(')');
        return { k: 'tuple', elems, pos: t.pos, end: en.end };
      }
      if (t.v === '[') {
        next();
        if (is(']')) { const en = next(); return { k: 'array', elems: [], pos: t.pos, end: en.end }; }
        const first = parseExpr();
        if (eat(';')) { const n = parseExpr(); const en = expect(']'); return { k: 'arrayRep', e: first, n, pos: t.pos, end: en.end }; }
        const elems = [first];
        while (eat(',')) { if (is(']')) break; elems.push(parseExpr()); }
        const en = expect(']');
        return { k: 'array', elems, pos: t.pos, end: en.end };
      }
      if (t.v === '{') return parseBlock();
      if (t.v === '|' || t.v === '||') return parseClosure(false);
    }
    if (t.t === 'kw') {
      switch (t.v) {
        case 'unsafe': next(); return parseBlock();
        case 'if': return parseIf();
        case 'match': {
          next(); const e = parseExpr(true); expect('{');
          const arms = [];
          while (!is('}')) {
            parseAttrs();
            const pat = parsePattern();
            let guard = null; if (eat('if')) guard = parseExpr();
            expect('=>');
            const bodyStart = peek();
            const body = parseExpr();
            const isBlock = bodyStart.v === '{' || (bodyStart.t === 'kw' && BLOCKLIKE.has(bodyStart.v));
            arms.push({ pat, guard, body });
            if (!eat(',')) { if (!is('}') && !isBlock) expect(','); }
          }
          const en = expect('}');
          return { k: 'match', e, arms, pos: t.pos, end: en.end };
        }
        case 'loop': { next(); const body = parseBlock(); return { k: 'loop', body, pos: t.pos, end: body.end }; }
        case 'while': { next(); const cond = parseCond(); const body = parseBlock(); return { k: 'while', cond, body, pos: t.pos, end: body.end }; }
        case 'for': {
          next(); const pat = parsePattern(); expect('in'); const iter = parseExpr(true); const body = parseBlock();
          return { k: 'for', pat, iter, body, pos: t.pos, end: body.end };
        }
        case 'return': {
          next(); const e = canStartExpr(noStruct) ? parseExpr(noStruct) : null;
          return { k: 'return', e, pos: t.pos, end: e ? e.end : t.end };
        }
        case 'break': {
          next(); let label = null;
          if (peek().t === 'lifetime') label = next().v;
          const e = canStartExpr(noStruct) ? parseExpr(noStruct) : null;
          return { k: 'break', label, e, pos: t.pos, end: e ? e.end : t.end };
        }
        case 'continue': {
          next(); let label = null; if (peek().t === 'lifetime') label = next().v;
          return { k: 'continue', label, pos: t.pos, end: t.end };
        }
        case 'move': next(); return parseClosure(true, t.pos);
      }
    }
    if (t.t === 'ident' || (t.t === 'kw' && ['self', 'Self', 'crate', 'super'].includes(t.v)) || (t.t === 'punct' && t.v === '<')) {
      return parsePathExpr(noStruct);
    }
    fail('expected expression, found ' + describe(t));
  }
  function parseClosure(isMove, startPos) {
    const st = peek();
    const params = [];
    if (eat('||')) { /* no params */ }
    else {
      expect('|');
      while (!is('|')) {
        const pat = parsePatternNoOr(); let ty = null;
        if (eat(':')) ty = parseType();
        params.push({ pat, ty });
        if (!eat(',')) break;
      }
      expect('|');
    }
    let ret = null, body;
    if (eat('->')) { ret = parseType(); body = parseBlock(); }
    else body = parseExpr();
    return { k: 'closure', params, body, move: isMove, ret, pos: startPos !== undefined ? startPos : st.pos, end: body.end };
  }
  function parsePathExpr(noStruct) {
    const st = peek();
    const segs = []; let generics = null;
    if (is('<')) {
      // qualified path <T as Trait>::f  or <T>::f
      next(); const ty = parseType(); let trait = null;
      if (eat('as')) trait = parseType();
      expect('>');
      segs.push(ty.name || 'Self');
      if (trait) segs.qualifiedTrait = trait.name;
    } else segs.push(ident());
    while (is('::')) {
      next();
      if (is('<')) { generics = parseTypeArgs(); continue; }
      segs.push(ident());
    }
    // generic type args directly e.g. Vec<i32>::new() is invalid rust; skip
    const endTok = toks[p - 1];
    // macro
    if (is('!') && (is('(', 1) || is('[', 1) || is('{', 1))) {
      next();
      return parseMacro(segs[segs.length - 1], st.pos);
    }
    const last = segs[segs.length - 1];
    if (is('{') && !noStruct && /^[A-Z]/.test(last)) {
      return parseStructLit(segs, st.pos, noStruct);
    }
    return { k: 'path', segs, generics, pos: st.pos, end: endTok.end };
  }
  function parseStructLit(segs, pos) {
    expect('{'); const fields = []; let base = null;
    while (!is('}')) {
      if (is('..')) { next(); base = parseExpr(); break; }
      const nameTok = peek();
      let name;
      if (nameTok.t === 'int') { next(); name = String(nameTok.v); } else name = ident();
      let e;
      if (eat(':')) e = parseExpr();
      else e = { k: 'path', segs: [name], pos: nameTok.pos, end: nameTok.end };
      fields.push({ name, e, pos: nameTok.pos });
      if (!eat(',')) break;
    }
    const en = expect('}');
    return { k: 'structLit', segs, fields, base, pos, end: en.end };
  }
  function parseMacro(name, pos) {
    const open = next(); const close = open.v === '(' ? ')' : open.v === '[' ? ']' : '}';
    const node = { k: 'macro', name, args: [], named: {}, pos };
    if (name === 'vec') {
      if (!is(close)) {
        const first = parseExpr();
        if (eat(';')) { node.rep = { e: first, n: parseExpr() }; }
        else { node.args.push(first); while (eat(',')) { if (is(close)) break; node.args.push(parseExpr()); } }
      }
    } else if (name === 'matches') {
      node.args.push(parseExpr()); expect(',');
      node.pat = parsePattern();
      if (eat('if')) node.guard = parseExpr();
      eat(',');
    } else {
      while (!is(close)) {
        if (isIdent() && is('=', 1)) {
          const nm = next().v; next(); node.named[nm] = parseExpr();
        } else node.args.push(parseExpr());
        if (!eat(',')) break;
      }
    }
    const en = expect(close);
    node.end = en.end;
    return node;
  }

  // ----- patterns -----
  function parsePattern() {
    const st = peek();
    eat('|');
    const first = parsePatternNoOr();
    if (!is('|')) return first;
    const alts = [first];
    while (is('|')) { next(); alts.push(parsePatternNoOr()); }
    return { pk: 'or', alts, pos: st.pos, end: toks[p - 1].end };
  }
  function litPat() {
    const t = peek(); let neg = false;
    if (is('-')) { next(); neg = true; }
    const lt = next();
    let v;
    if (lt.t === 'int') v = { k: 'int', v: neg ? -lt.v : lt.v, suffix: lt.suffix };
    else if (lt.t === 'float') v = { k: 'float', v: neg ? -lt.v : lt.v, suffix: lt.suffix };
    else if (lt.t === 'str') v = { k: 'str', v: lt.v };
    else if (lt.t === 'char') v = { k: 'char', v: lt.v };
    else if (lt.t === 'bool') v = { k: 'bool', v: lt.v };
    else fail('expected pattern, found ' + describe(lt), lt);
    v.pos = t.pos; v.end = lt.end;
    return v;
  }
  function parsePatternNoOr() {
    const t = peek();
    let pat = parsePatternAtom();
    if (is('..=') || is('...') || (is('..') && (pat.pk === 'lit'))) {
      const op = next().v;
      let hi = null;
      if (peek().t === 'int' || peek().t === 'char' || peek().t === 'float' || is('-')) hi = litPat();
      else if (isIdent()) { const segs = [ident()]; while (eat('::')) segs.push(ident()); hi = { k: 'path', segs }; }
      pat = { pk: 'range', lo: pat.pk === 'lit' ? pat.v : { k: 'path', segs: pat.segs || [pat.name] }, hi, incl: op !== '..', pos: t.pos, end: toks[p - 1].end };
    }
    return pat;
  }
  function parsePatternAtom() {
    const t = peek();
    const mk = (o) => { o.pos = t.pos; o.end = toks[p - 1].end; return o; };
    if (t.t === 'ident' && t.v === '_') { next(); return mk({ pk: 'wild' }); }
    if (is('..')) { next(); return mk({ pk: 'rest' }); }
    if (is('&') || is('&&')) {
      const dbl = is('&&'); next(); const mut = eat('mut'); const inner = parsePatternNoOr();
      const r = mk({ pk: 'ref', mut, pat: inner });
      return dbl ? mk({ pk: 'ref', mut: false, pat: r }) : r;
    }
    if (is('(')) {
      next(); const elems = [];
      while (!is(')')) { elems.push(parsePattern()); if (!eat(',')) break; }
      const trailingComma = toks[p - 1].v === ',';
      expect(')');
      if (elems.length === 1 && !trailingComma) return elems[0];
      return mk({ pk: 'tuple', elems });
    }
    if (is('[')) {
      next(); const elems = [];
      while (!is(']')) { elems.push(parsePattern()); if (!eat(',')) break; }
      expect(']');
      return mk({ pk: 'slice', elems });
    }
    if (['int', 'float', 'str', 'char', 'bool'].includes(t.t) || is('-')) {
      return mk({ pk: 'lit', v: litPat() });
    }
    if (is('ref')) {
      next(); const mut = eat('mut'); const nt = peek(); const name = ident();
      let sub = null; if (eat('@')) sub = parsePatternNoOr();
      return mk({ pk: 'bind', name, mut, byRef: true, sub, namePos: nt.pos, nameEnd: nt.end });
    }
    if (is('mut')) {
      next(); const nt = peek(); const name = ident();
      let sub = null; if (eat('@')) sub = parsePatternNoOr();
      return mk({ pk: 'bind', name, mut: true, byRef: false, sub, namePos: nt.pos, nameEnd: nt.end });
    }
    if (t.t === 'ident' || (t.t === 'kw' && (t.v === 'Self' || t.v === 'crate' || t.v === 'self' || t.v === 'super'))) {
      const segs = [ident()];
      while (is('::')) { next(); if (is('<')) { parseTypeArgs(); continue; } segs.push(ident()); }
      if (is('(')) {
        next(); const elems = [];
        while (!is(')')) { elems.push(parsePattern()); if (!eat(',')) break; }
        expect(')');
        return mk({ pk: 'tstruct', segs, elems });
      }
      if (is('{')) {
        next(); const fields = []; let rest = false;
        while (!is('}')) {
          if (is('..')) { next(); rest = true; break; }
          if (is('ref') || is('mut')) {
            const byRef = eat('ref'); const mut = eat('mut'); const nt = peek(); const name = ident();
            fields.push({ name, pat: { pk: 'bind', name, mut, byRef, pos: nt.pos, end: nt.end, namePos: nt.pos, nameEnd: nt.end } });
          } else {
            const nt = peek(); const name = nt.t === 'int' ? String(next().v) : ident();
            if (eat(':')) fields.push({ name, pat: parsePattern() });
            else fields.push({ name, pat: { pk: 'bind', name, mut: false, byRef: false, pos: nt.pos, end: nt.end, namePos: nt.pos, nameEnd: nt.end } });
          }
          if (!eat(',')) break;
        }
        expect('}');
        return mk({ pk: 'struct', segs, fields, rest });
      }
      if (segs.length === 1 && !/^[A-Z]/.test(segs[0]) || (segs.length === 1 && is('@'))) {
        let sub = null; if (eat('@')) sub = parsePatternNoOr();
        return mk({ pk: 'bind', name: segs[0], mut: false, byRef: false, sub, namePos: t.pos, nameEnd: t.end });
      }
      if (segs.length === 1) return mk({ pk: 'bind', name: segs[0], mut: false, byRef: false, maybePath: true, namePos: t.pos, nameEnd: t.end });
      return mk({ pk: 'path', segs });
    }
    fail('expected pattern, found ' + describe(t));
  }

  const items = parseItems(null);
  return items;
}
