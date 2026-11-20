// ---------- RustLite: values, formatting helpers ----------
const UNIT = Object.freeze({ k: 'tuple', items: [] });
const TRUE = Object.freeze({ k: 'bool', v: true });
const FALSE = Object.freeze({ k: 'bool', v: false });
const mkBool = (b) => (b ? TRUE : FALSE);
const mkInt = (v, ty) => ({ k: 'int', v, ty: ty || null });
const mkFloat = (v, ty) => ({ k: 'float', v: ty === 'f32' ? Math.fround(v) : v, ty: ty || null });
const mkStr = (s) => ({ k: 'str', v: s });
const mkString = (s) => ({ k: 'String', v: s });
const mkChar = (c) => ({ k: 'char', v: c });
const mkVec = (items, kind) => ({ k: 'vec', kind: kind || 'Vec', items });
const mkTuple = (items) => (items.length ? { k: 'tuple', items } : UNIT);
const mkSome = (v) => ({ k: 'enum', en: 'Option', variant: 'Some', vals: [v] });
const mkNone = () => ({ k: 'enum', en: 'Option', variant: 'None', vals: [] });
const mkOpt = (v) => (v === undefined ? mkNone() : mkSome(v));
const mkOk = (v) => ({ k: 'enum', en: 'Result', variant: 'Ok', vals: [v] });
const mkErr = (v) => ({ k: 'enum', en: 'Result', variant: 'Err', vals: [v] });
const mkOrd = (c) => ({ k: 'enum', en: 'Ordering', variant: c < 0 ? 'Less' : c > 0 ? 'Greater' : 'Equal', vals: [] });
const mkRef = (place, mut) => ({ k: 'ref', mut: !!mut, place });
const tempPlace = (v) => { let x = v; return { get: () => x, set: (n) => { x = n; }, mutable: true, viaRef: 'none', root: null }; };
const mkStdErr = (name, debug, display) => ({ k: 'stderr', name, debug, display });
const usize = (n) => mkInt(BigInt(n), 'usize');

const INT_BITS = { i8: 8, i16: 16, i32: 32, i64: 64, i128: 128, isize: 64, u8: 8, u16: 16, u32: 32, u64: 64, u128: 128, usize: 64 };
const RANGE_CACHE = {};
function intRange(ty) {
  if (RANGE_CACHE[ty]) return RANGE_CACHE[ty];
  const b = BigInt(INT_BITS[ty]);
  const r = ty[0] === 'u' ? [0n, (1n << b) - 1n] : [-(1n << (b - 1n)), (1n << (b - 1n)) - 1n];
  RANGE_CACHE[ty] = r; return r;
}
function wrapInt(v, ty) {
  const bits = INT_BITS[ty || 'i32'];
  return (ty || 'i32')[0] === 'u' ? BigInt.asUintN(bits, v) : BigInt.asIntN(bits, v);
}

function utf8Len(s) {
  let n = 0;
  for (const ch of s) { const c = ch.codePointAt(0); n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4; }
  return n;
}
function charUtf8Len(ch) { const c = ch.codePointAt(0); return c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4; }
// convert byte index to JS string index; returns -1 if not a char boundary
function byteToIdx(s, b) {
  let bytes = 0, i = 0;
  for (const ch of s) {
    if (bytes === b) return i;
    if (bytes > b) return -1;
    bytes += charUtf8Len(ch); i += ch.length;
  }
  return bytes === b ? i : -1 - 1 * (b > bytes ? 1 : 0);
}
function idxToByte(s, i) { return utf8Len(s.slice(0, i)); }

function escapeDebug(s, quote) {
  let out = '';
  for (const ch of s) {
    if (ch === '\\') out += '\\\\';
    else if (ch === '\n') out += '\\n';
    else if (ch === '\t') out += '\\t';
    else if (ch === '\r') out += '\\r';
    else if (ch === '\0') out += '\\0';
    else if (ch === quote) out += '\\' + quote;
    else if (ch.codePointAt(0) < 0x20 || ch.codePointAt(0) === 0x7f) out += '\\u{' + ch.codePointAt(0).toString(16) + '}';
    else out += ch;
  }
  return out;
}

function expandExp(str) {
  // turn JS exponent notation into plain decimal
  const m = /^(-?)(\d+)(?:\.(\d+))?e([+-]\d+)$/.exec(str);
  if (!m) return str;
  const sign = m[1]; let digits = m[2] + (m[3] || ''); const exp = parseInt(m[4], 10);
  let pointPos = m[2].length + exp;
  if (pointPos <= 0) return sign + '0.' + '0'.repeat(-pointPos) + digits;
  if (pointPos >= digits.length) return sign + digits + '0'.repeat(pointPos - digits.length);
  return sign + digits.slice(0, pointPos) + '.' + digits.slice(pointPos);
}
function shortestFloat(v, ty) {
  if (ty === 'f32') {
    for (let p = 1; p <= 9; p++) { const s = v.toPrecision(p); if (Math.fround(parseFloat(s)) === v) return String(parseFloat(s)); }
  }
  return String(v);
}
function floatDisplay(v, ty, prec) {
  if (Number.isNaN(v)) return 'NaN';
  if (v === Infinity) return 'inf';
  if (v === -Infinity) return '-inf';
  if (prec !== null && prec !== undefined) {
    if (Math.abs(v) >= 1e21) return expandExp(shortestFloat(v, ty)) + (prec > 0 ? '.' + '0'.repeat(prec) : '');
    let s = v.toFixed(prec);
    if (Object.is(v, -0) || (v < 0 && /^0(\.0*)?$/.test(s))) s = '-' + s.replace(/^-/, '');
    return s;
  }
  if (Object.is(v, -0)) return '-0';
  return expandExp(shortestFloat(v, ty));
}
function floatDebug(v, ty) {
  if (Number.isNaN(v)) return 'NaN';
  if (v === Infinity) return 'inf';
  if (v === -Infinity) return '-inf';
  const a = Math.abs(v);
  if (a !== 0 && (a >= 1e16 || a < 1e-4)) {
    let s = (ty === 'f32' ? parseFloat(shortestFloat(v, ty)) : v).toExponential();
    s = s.replace('e+', 'e');
    return s;
  }
  let s = expandExp(shortestFloat(v, ty));
  if (Object.is(v, -0)) s = '-0';
  if (!/[.eN]/.test(s) && !/inf/.test(s)) s += '.0';
  return s;
}
function durationDebug(ns) {
  // ns as number (may be fractional)
  ns = Math.round(ns);
  const fmt = (val, unitNs, suffix) => {
    const whole = Math.floor(val / unitNs); const frac = val - whole * unitNs;
    let fs = '';
    if (frac > 0) { fs = String(frac).padStart(String(unitNs).length - 1, '0').replace(/0+$/, ''); }
    return whole + (fs ? '.' + fs : '') + suffix;
  };
  if (ns >= 1e9) return fmt(ns, 1e9, 's');
  if (ns >= 1e6) return fmt(ns, 1e6, 'ms');
  if (ns >= 1e3) return fmt(ns, 1e3, 'µs');
  return ns + 'ns';
}
