struct C { n: i32 }
impl C { fn inc(&self) { self.n += 1; } }
fn main() { let c = C { n: 0 }; c.inc(); }
