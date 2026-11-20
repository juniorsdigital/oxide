#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
enum Suit { Hearts, Spades }
#[derive(Debug)]
enum Shape { Circle { r: f64 }, Rect(f64, f64), Unit }
fn classify(n: i32) -> &'static str {
    match n { i32::MIN..=-1 => "negative", 0 => "zero", 1 | 2 | 3 => "small", x if x % 2 == 0 => "even", _ => "odd" }
}
fn main() {
    for n in [-5, 0, 2, 10, 11] { print!("{} ", classify(n)); }
    println!();
    let shapes = [Shape::Circle { r: 1.0 }, Shape::Rect(2.0, 3.0), Shape::Unit];
    for s in &shapes {
        let a = match s { Shape::Circle { r } => 3.0 * r * r, Shape::Rect(w, h) => w * h, Shape::Unit => 0.0 };
        println!("{:?} {a}", s);
    }
    let point = (3, -2);
    match point { (0, 0) => println!("origin"), (x, 0) | (0, x) => println!("axis {x}"), (x, y) if x > 0 && y < 0 => println!("q4 {x},{y}"), _ => println!("other") }
    let arr = [1, 2, 3, 4, 5];
    match arr { [first, .., last] => println!("{first}..{last}") }
    let v = vec![10, 20, 30];
    match v.as_slice() { [] => println!("empty"), [one] => println!("{one}"), [a, rest @ ..] => println!("{a} then {:?}", rest) }
    let msg = Some(42);
    match msg { Some(n @ 40..=50) => println!("in range {n}"), Some(n) => println!("{n}"), None => {} }
    let c = 'k';
    let kind = match c { 'a' | 'e' | 'i' | 'o' | 'u' => "vowel", 'a'..='z' => "consonant", _ => "other" };
    println!("{kind}");
    println!("{}", matches!(Suit::Spades, Suit::Spades | Suit::Hearts));
    println!("{:?} {}", Suit::Hearts, Suit::Hearts < Suit::Spades);
    let pair = (String::from("k"), 5);
    let (ref key, val) = pair;
    println!("{key} {val} {}", pair.0);
    let Some(x) = Some(7) else { panic!("none") };
    println!("{x}");
    let n = 3;
    let s = match n { 1 => "one".to_string(), k => format!("num {k}") };
    println!("{s}");
    let t: (i32, (char, bool)) = (1, ('z', true));
    let (a, (b, c)) = t;
    println!("{a} {b} {c}");
    println!("{}", Suit::Spades as i32);
}
