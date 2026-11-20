fn main() {
    let mut v = vec![5, 3, 8, 1, 9, 2];
    v.sort();
    println!("{:?}", v);
    v.reverse();
    println!("{:?} first={:?} last={:?}", v, v.first(), v.last());
    v.retain(|&x| x % 2 == 1);
    println!("{:?}", v);
    v.insert(1, 100);
    let removed = v.remove(0);
    println!("{:?} removed {}", v, removed);
    let mut names = vec!["zed", "amy", "Bob"];
    names.sort_by_key(|n| n.to_lowercase());
    println!("{:?}", names);
    let mut grid = vec![vec![0; 3]; 2];
    grid[1][2] = 7;
    println!("{:?}", grid);
    let total: i32 = grid.iter().map(|row| row.iter().sum::<i32>()).sum();
    println!("{total}");
    let mut stack = Vec::new();
    stack.push(1); stack.push(2); stack.push(3);
    while let Some(top) = stack.pop() { print!("{top} "); }
    println!();
    let nums = [1, 2, 3, 4, 5, 6];
    for w in nums.windows(2) { print!("{:?}", w); }
    println!();
    for c in nums.chunks(4) { print!("{:?}", c); }
    println!();
    println!("{:?}", nums.iter().position(|&x| x == 4));
    println!("{}", nums.contains(&3));
    let (evens, odds): (Vec<i32>, Vec<i32>) = nums.iter().partition(|&&x| x % 2 == 0);
    println!("{:?} {:?}", evens, odds);
    let mut d = vec![1, 1, 2, 2, 3, 1];
    d.dedup();
    println!("{:?}", d);
    let mut floats = vec![2.5, -1.0, 9.75];
    floats.sort_by(|a, b| a.partial_cmp(b).unwrap());
    println!("{:?}", floats);
    let max = floats.iter().cloned().fold(f64::MIN, f64::max);
    println!("{max}");
    let mut v2: Vec<String> = Vec::new();
    v2.extend(vec!["a".to_string(), "b".to_string()]);
    println!("{}", v2.concat());
    let s = &v[..];
    println!("{}", s.len());
    let drained: Vec<i32> = d.drain(..2).collect();
    println!("{:?} {:?}", drained, d);
    let mut arr = [3, 1, 2];
    arr.sort_unstable();
    arr.swap(0, 2);
    println!("{:?}", arr);
}
