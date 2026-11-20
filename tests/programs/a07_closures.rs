fn apply<F: Fn(i32) -> i32>(f: F, x: i32) -> i32 { f(x) }
fn make_adder(n: i32) -> impl Fn(i32) -> i32 { move |x| x + n }
fn compose(f: Box<dyn Fn(i32) -> i32>, g: Box<dyn Fn(i32) -> i32>) -> Box<dyn Fn(i32) -> i32> { Box::new(move |x| g(f(x))) }
fn double(x: i32) -> i32 { x * 2 }
fn main() {
    let mut count = 0;
    let mut inc = || { count += 1; count };
    inc(); inc();
    println!("{}", inc());
    println!("{count}");
    println!("{}", apply(|x| x * x, 7));
    println!("{}", apply(double, 7));
    let add5 = make_adder(5);
    println!("{}", add5(10));
    let h = compose(Box::new(double), Box::new(make_adder(1)));
    println!("{}", h(20));
    let words = vec!["apple", "bob", "kayak", "rust"];
    let pals: Vec<&&str> = words.iter().filter(|w| w.chars().rev().collect::<String>() == **w).collect();
    println!("{:?}", pals);
    let fns: Vec<fn(i32) -> i32> = vec![double, |x| x - 1];
    println!("{:?}", fns.iter().map(|f| f(10)).collect::<Vec<_>>());
    let v: Vec<u64> = (1..=10).filter(|n| n % 2 == 0).map(|n| n * n).take_while(|&n| n < 70).collect();
    println!("{:?}", v);
    let fact: u64 = (1..=20).product();
    println!("{fact}");
    let s = (1..=4).fold(String::new(), |acc, n| acc + &n.to_string());
    println!("{s}");
    let any_big = [1, 50, 3].iter().any(|&x| x > 40);
    let all_pos = [1, 50, 3].iter().all(|&x| x > 0);
    println!("{any_big} {all_pos}");
    let mut sorted = vec![(2, 'b'), (1, 'z'), (2, 'a')];
    sorted.sort_by(|a, b| a.0.cmp(&b.0).then_with(|| b.1.cmp(&a.1)));
    println!("{:?}", sorted);
    let nested = vec![vec![1, 2], vec![3], vec![]];
    let flat: Vec<i32> = nested.into_iter().flatten().collect();
    println!("{:?}", flat);
    let pairs: Vec<(usize, char)> = "hey".chars().enumerate().collect();
    println!("{:?}", pairs);
    let mx = ["aa", "b", "cccc"].iter().max_by_key(|s| s.len()).unwrap();
    println!("{mx}");
    let chained: Vec<i32> = (1..3).chain(7..9).rev().collect();
    println!("{:?}", chained);
    let stepped: Vec<i32> = (0..20).step_by(5).collect();
    println!("{:?} {}", stepped, (0..20).step_by(5).count());
}
