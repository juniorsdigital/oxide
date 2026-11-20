use std::fmt;
#[derive(Debug)]
enum AppError { Parse(std::num::ParseIntError), Negative(i64) }
impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self { AppError::Parse(e) => write!(f, "parse error: {e}"), AppError::Negative(n) => write!(f, "{n} is negative") }
    }
}
impl From<std::num::ParseIntError> for AppError { fn from(e: std::num::ParseIntError) -> Self { AppError::Parse(e) } }
fn check(s: &str) -> Result<i64, AppError> {
    let n: i64 = s.parse()?;
    if n < 0 { return Err(AppError::Negative(n)); }
    Ok(n * 2)
}
fn first_even(v: &[i32]) -> Option<i32> { let x = v.iter().find(|&&x| x % 2 == 0)?; Some(*x * 10) }
fn main() -> Result<(), AppError> {
    for s in ["21", "-4", "abc"] {
        match check(s) { Ok(v) => println!("ok {v}"), Err(e) => println!("err {e} / {:?}", e) }
    }
    println!("{:?} {:?}", first_even(&[1, 3, 4]), first_even(&[1]));
    let r: Result<Vec<i32>, _> = "1 2 x".split(' ').map(|s| s.parse::<i32>()).collect();
    println!("{:?}", r);
    let o: Option<Vec<i32>> = vec![Some(1), Some(2)].into_iter().collect();
    println!("{:?}", o);
    let v = check("8")?;
    println!("v={v}");
    let x: Result<u8, String> = Err("bad".to_string());
    println!("{}", x.clone().unwrap_or(7));
    println!("{:?}", x.as_ref().map_err(|e| e.len()));
    let val = "42".parse::<f64>().map(|f| f / 4.0).unwrap_or_default();
    println!("{val}");
    Ok(())
}
