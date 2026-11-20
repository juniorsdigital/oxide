use std::rc::Rc;
use std::cell::{RefCell, Cell};
use std::sync::{Arc, Mutex, mpsc};
use std::thread;
#[derive(Debug)]
struct Node { val: i32, children: Vec<Rc<RefCell<Node>>> }
fn main() {
    let leaf = Rc::new(RefCell::new(Node { val: 3, children: vec![] }));
    let root = Node { val: 1, children: vec![Rc::clone(&leaf)] };
    leaf.borrow_mut().val = 30;
    println!("{} {} {}", root.val, root.children[0].borrow().val, Rc::strong_count(&leaf));
    let c = Cell::new(5); c.set(c.get() + 1); println!("{}", c.get());
    let (tx, rx) = mpsc::channel();
    for id in 0..3 { let tx = tx.clone(); thread::spawn(move || { tx.send(id * 10).unwrap(); }); }
    drop(tx);
    let mut got: Vec<i32> = rx.iter().collect();
    got.sort();
    println!("{:?}", got);
    let data = Arc::new(Mutex::new(vec![1, 2, 3]));
    let handles: Vec<_> = (0..3).map(|i| { let d = Arc::clone(&data); thread::spawn(move || { d.lock().unwrap().push(i); }) }).collect();
    for h in handles { h.join().unwrap(); }
    let mut v = data.lock().unwrap().clone();
    v.sort();
    println!("{:?}", v);
    let h = thread::spawn(|| 6 * 7);
    println!("{}", h.join().unwrap());
    let shared = Rc::new(String::from("hi"));
    let s2 = shared.clone();
    println!("{} {} {}", shared, s2.len(), Rc::strong_count(&shared));
}
