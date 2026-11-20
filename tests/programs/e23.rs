fn main() { let name = String::from("a"); let f = move || println!("{name}"); f(); println!("{name}"); }
