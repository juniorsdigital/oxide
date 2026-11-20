use std::collections::{HashMap, HashSet, BTreeMap, VecDeque};
fn main() {
    let mut ages: BTreeMap<&str, u32> = BTreeMap::new();
    ages.insert("carol", 41);
    ages.insert("alice", 30);
    ages.insert("bob", 25);
    for (name, age) in &ages { println!("{name} is {age}"); }
    if let Some(a) = ages.get("alice") { println!("alice: {a}"); }
    *ages.get_mut("bob").unwrap() += 1;
    println!("{:?}", ages);
    println!("{}", ages.contains_key("dave"));
    let mut m = HashMap::new();
    m.insert(1, "one");
    let old = m.insert(1, "uno");
    println!("{:?} {:?} {}", old, m.get(&1), m.len());
    let mut set: HashSet<i32> = [1, 2, 3].into_iter().collect();
    set.insert(2);
    set.insert(10);
    let mut sv: Vec<_> = set.iter().copied().collect();
    sv.sort();
    println!("{:?}", sv);
    let a: HashSet<i32> = [1, 2, 3].iter().cloned().collect();
    let b: HashSet<i32> = [2, 3, 4].iter().cloned().collect();
    let mut inter: Vec<_> = a.intersection(&b).collect();
    inter.sort();
    println!("{:?}", inter);
    let mut q = VecDeque::new();
    q.push_back(1); q.push_back(2); q.push_front(0);
    println!("{:?} {:?}", q.pop_front(), q);
    let mut groups: HashMap<bool, Vec<i32>> = HashMap::new();
    for i in 1..=6 { groups.entry(i % 2 == 0).or_insert_with(Vec::new).push(i); }
    println!("{:?} {:?}", groups[&true], groups[&false]);
    let letters = "mississippi";
    let mut freq: BTreeMap<char, usize> = BTreeMap::new();
    for c in letters.chars() { *freq.entry(c).or_default() += 1; }
    println!("{:?}", freq);
    let best = freq.iter().max_by_key(|(_, &n)| n).unwrap();
    println!("{:?}", best);
}
