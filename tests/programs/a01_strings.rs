fn main() {
    let mut s = String::new();
    s.push_str("Hello");
    s.push(',');
    s += " world";
    let t = format!("{s}! {}", s.len());
    println!("{t}");
    let words: Vec<&str> = t.split(' ').collect();
    println!("{:?}", words);
    let up = t.to_uppercase();
    println!("{up} {}", up.contains("WORLD"));
    let rev: String = "stressed".chars().rev().collect();
    println!("{rev}");
    for (i, c) in "abc".chars().enumerate() { print!("{i}{c} "); }
    println!();
    let n = "  12 ".trim().parse::<i64>().unwrap() * 3;
    println!("{n}");
    let csv = "a,b,,c";
    let parts: Vec<String> = csv.split(',').map(|p| p.to_string()).collect();
    println!("{:?} {}", parts, parts.join("|"));
    println!("{}", "x".repeat(5));
    println!("{:?}", "hello world".find("world"));
    println!("{:?}", "key=value".split_once('='));
    let s2 = String::from("héllo wörld");
    println!("{} {}", s2.len(), s2.chars().count());
    println!("{}", &s2[0..1]);
    println!("{:?}", s2.char_indices().nth(2));
    let num = 255;
    println!("{:x} {:X} {:b} {:o} {:#x} {:08b}", num, num, num, num, num, 5);
    println!("{:+} {:e}", 5, 1234.5);
    println!("[{:>8.3}] [{:<8}] [{:^8}] [{:*^9}]", 3.14159, "left", "mid", "c");
    let w = 10; let p = 2;
    println!("[{:w$.p$}] [{:>1$}]", 1.23456, 6, "ab");
}
