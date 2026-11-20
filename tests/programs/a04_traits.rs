use std::fmt;
use std::ops::Add;
#[derive(Debug, Clone, Copy, PartialEq, PartialOrd)]
struct V2 { x: f64, y: f64 }
impl Add for V2 { type Output = V2; fn add(self, o: V2) -> V2 { V2 { x: self.x + o.x, y: self.y + o.y } } }
impl fmt::Display for V2 { fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result { write!(f, "<{}, {}>", self.x, self.y) } }
trait Animal { fn name(&self) -> String; fn speak(&self) -> String { format!("{} makes a sound", self.name()) } }
struct Dog; struct Cat { lives: u8 }
impl Animal for Dog { fn name(&self) -> String { "Dog".into() } fn speak(&self) -> String { "Woof".to_string() } }
impl Animal for Cat { fn name(&self) -> String { format!("Cat({})", self.lives) } }
fn loudest(xs: &[Box<dyn Animal>]) -> String { xs.iter().map(|a| a.speak()).collect::<Vec<_>>().join("; ") }
fn largest<T: PartialOrd + Copy>(list: &[T]) -> T { let mut m = list[0]; for &x in list { if x > m { m = x; } } m }
#[derive(Debug, Default)]
struct Config { name: String, retries: u32, verbose: bool }
struct Counter { n: u32 }
impl Iterator for Counter { type Item = u32; fn next(&mut self) -> Option<u32> { if self.n < 5 { self.n += 1; Some(self.n) } else { None } } }
fn main() {
    let a = V2 { x: 1.0, y: 2.0 }; let b = V2 { x: 0.5, y: -1.0 };
    let c = a + b;
    println!("{c} {:?} {}", c, a == b);
    let zoo: Vec<Box<dyn Animal>> = vec![Box::new(Dog), Box::new(Cat { lives: 9 })];
    println!("{}", loudest(&zoo));
    println!("{} {} {}", largest(&[3, 9, 2]), largest(&[1.5, 0.2]), largest(&['x', 'b']));
    let cfg = Config { name: "svc".into(), ..Default::default() };
    println!("{:?}", cfg);
    let s: u32 = Counter { n: 0 }.zip(Counter { n: 0 }.skip(1)).map(|(a, b)| a * b).filter(|x| x % 3 == 0).sum();
    println!("{s}");
    for x in (Counter { n: 2 }) { print!("{x} "); }
    println!();
    let total: u32 = Counter { n: 0 }.take(3).sum();
    println!("{total}");
}
