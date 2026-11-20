fn gcd(a: u64, b: u64) -> u64 { if b == 0 { a } else { gcd(b, a % b) } }
fn is_prime(n: u32) -> bool { if n < 2 { return false; } let mut i = 2; while i * i <= n { if n % i == 0 { return false; } i += 1; } true }
fn fib(n: u32) -> u64 { let (mut a, mut b) = (0u64, 1u64); for _ in 0..n { let t = a + b; a = b; b = t; } a }
fn main() {
    println!("{} {}", gcd(48, 18), fib(50));
    let primes: Vec<u32> = (1..30).filter(|&n| is_prime(n)).collect();
    println!("{:?}", primes);
    let x: i32 = -17;
    println!("{} {} {} {}", x / 5, x % 5, x.rem_euclid(5), x.abs());
    println!("{} {}", 7.0_f64 / 2.0, 7 / 2);
    println!("{} {} {}", 2i32.pow(10), 2.0f64.powf(0.5), (10.0f64).ln());
    println!("{:?} {:?}", 250u8.checked_add(10), 250u8.checked_add(5));
    println!("{} {}", 250u8.wrapping_add(10), 250u8.saturating_add(10));
    println!("{} {} {}", i32::MAX, u64::MAX, i8::MIN);
    println!("{} {}", (3.7f64) as i32, (-1i32) as u8);
    println!("{} {}", 65u8 as char, 'A' as u32);
    println!("{:.3} {}", std::f64::consts::PI, (2.0f64).sqrt());
    println!("{} {}", 0.1 + 0.2, 1e21);
    println!("{:?} {:?} {}", 1.0f64, 0.5f32, 1.0f32 / 3.0);
    println!("{} {}", f64::NAN.is_nan(), 1.0f64 / 0.0);
    let big: u128 = 2u128.pow(100);
    println!("{big}");
    let mut total: u64 = 0;
    for i in 0..100000u64 { total += i * i; }
    println!("{total}");
    println!("{}", (1u64..=20).fold(1u64, |a, b| a * b / gcd(a, b)));
    println!("{} {}", 17 & 5, 1 << 10);
    let avg = [3, 4, 5].iter().sum::<i32>() as f64 / 3.0;
    println!("{avg:.2} {}", (2.5f64).round());
    println!("{}", i64::from(7i32) + 1);
    println!("{:?}", "300".parse::<u8>());
    println!("{:?}", u8::try_from(300i32).is_err());
    println!("{}", 10_i32.min(3).max(5));
    println!("{}", (-8i32).signum());
}
