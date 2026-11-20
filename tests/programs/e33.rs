fn dangle() -> &String { let s = String::from("x"); &s }
fn main() { dangle(); }
