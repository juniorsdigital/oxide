use std::collections::HashMap;
use std::fmt;

#[derive(Debug, Clone, PartialEq)]
struct Point { x: f64, y: f64 }

impl Point {
    fn new(x: f64, y: f64) -> Self { Point { x, y } }
    fn dist(&self, o: &Point) -> f64 { ((self.x - o.x).powi(2) + (self.y - o.y).powi(2)).sqrt() }
}
impl fmt::Display for Point {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result { write!(f, "({:.1}, {:.1})", self.x, self.y) }
}
enum Shape { Circle(f64), Rect { w: f64, h: f64 } }
fn area(s: &Shape) -> f64 {
    match s { Shape::Circle(r) => 3.14 * r * r, Shape::Rect { w, h } => w * h }
}
fn main() {
    let p = Point::new(1.0, 2.0);
    let q = Point { x: 4.0, y: 6.0 };
    println!("{} -> {} = {}", p, q, p.dist(&q));
    println!("{:?}", p);
    println!("{:#?}", q);
    let v = vec![1, 2, 3, 4, 5];
    let doubled: Vec<i32> = v.iter().map(|x| x * 2).collect();
    println!("{:?} sum={}", doubled, v.iter().sum::<i32>());
    let mut counts = HashMap::new();
    for w in "a b a c b a".split_whitespace() { *counts.entry(w).or_insert(0) += 1; }
    let mut keys: Vec<_> = counts.keys().collect();
    keys.sort();
    for k in keys { println!("{k}: {}", counts[k]); }
    let shapes = vec![Shape::Circle(1.0), Shape::Rect { w: 2.0, h: 3.0 }];
    let total: f64 = shapes.iter().map(area).sum();
    println!("total area {total:.2}");
    let s = String::from("hello");
    let t = s.clone() + " world";
    println!("{s} / {t} / {}", t.len());
    let n: i32 = "42".parse().unwrap();
    println!("{:>6}|{:<6}|{:^6}|{:06.2}", n, "ab", 'c', 3.14159);
    let mut i = 0;
    let r = loop { i += 1; if i == 10 { break i * 2; } };
    println!("{r} {}", if r > 5 { "big" } else { "small" });
    let opt: Option<&str> = None;
    println!("{:?} {}", opt, opt.unwrap_or("none"));
}
