#[derive(Debug)]
struct P { x: i32 }
fn main() { let p = P { x: 1 }; let q = p.clone(); println!("{:?}", q); }
