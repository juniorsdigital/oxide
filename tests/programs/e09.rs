fn main() { let mut s = String::from("x"); let a = &mut s; let b = &mut s; a.push('1'); b.push('2'); }
