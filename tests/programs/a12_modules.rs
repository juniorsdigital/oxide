mod geometry {
    pub const UNIT: f64 = 1.0;
    pub fn area(w: f64, h: f64) -> f64 { w * h }
    pub mod shapes { pub fn square(s: f64) -> f64 { super::area(s, s) } }
}
use geometry::shapes::square;
static GREETING: &str = "hey";
const LIMITS: [u32; 3] = [10, 20, 30];
fn main() {
    println!("{} {} {}", geometry::area(2.0, 3.0), square(4.0), geometry::UNIT);
    println!("{GREETING} {:?} {}", LIMITS, LIMITS.iter().sum::<u32>());
    let label = 'outer: loop {
        for i in 0.. {
            if i == 3 { break 'outer "done"; }
        }
    };
    println!("{label}");
    let mut grid = [[0u8; 3]; 3];
    'rows: for r in 0..3 { for c in 0..3 { if c > r { continue 'rows; } grid[r][c] = 1; } }
    println!("{:?}", grid);
    let x = { let y = 2; y * 10 };
    println!("{x}");
    let v: Vec<i32> = Vec::from([3, 1, 2]);
    println!("{}", v.iter().map(|n| n.to_string()).collect::<Vec<_>>().join("-"));
    let tup = (1, "a", 2.5);
    println!("{:?} {}", tup, tup.2);
    assert_eq!(1 + 1, 2);
    assert!(v.len() == 3, "length was {}", v.len());
    let r = 1..5;
    println!("{} {:?}", r.contains(&3), r);
    dbg!(x * 2);
}
