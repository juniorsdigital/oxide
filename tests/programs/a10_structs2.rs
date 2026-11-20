use std::collections::HashMap;
#[derive(Debug, Clone, PartialEq)]
enum Status { Todo, Done }
#[derive(Debug, Clone)]
struct Task { id: u32, title: String, status: Status }
struct Board { tasks: Vec<Task>, next_id: u32 }
impl Board {
    fn new() -> Self { Self { tasks: Vec::new(), next_id: 1 } }
    fn add(&mut self, title: &str) -> u32 { let id = self.next_id; self.tasks.push(Task { id, title: title.to_string(), status: Status::Todo }); self.next_id += 1; id }
    fn complete(&mut self, id: u32) -> Result<(), String> {
        match self.tasks.iter_mut().find(|t| t.id == id) { Some(t) => { t.status = Status::Done; Ok(()) } None => Err(format!("no task {id}")) }
    }
    fn summary(&self) -> HashMap<String, usize> {
        let mut m = HashMap::new();
        for t in &self.tasks { *m.entry(format!("{:?}", t.status)).or_insert(0) += 1; }
        m
    }
    fn titles(&self) -> Vec<&str> { self.tasks.iter().map(|t| t.title.as_str()).collect() }
}
struct Meters(f64);
struct Wrapper(Vec<String>);
fn main() {
    let mut b = Board::new();
    b.add("write"); let id = b.add("test"); b.add("ship");
    b.complete(id).unwrap();
    println!("{:?}", b.complete(99));
    let s = b.summary();
    println!("{} {}", s["Todo"], s["Done"]);
    println!("{:?}", b.titles());
    let done: Vec<&Task> = b.tasks.iter().filter(|t| t.status == Status::Done).collect();
    println!("{:#?}", done);
    let m = Meters(3.5);
    println!("{}", m.0 * 2.0);
    let w = Wrapper(vec!["a".into(), "b".into()]);
    println!("[{}]", w.0.join(", "));
    let t2 = Task { title: String::from("copy"), ..b.tasks[0].clone() };
    println!("{} {}", t2.id, t2.title);
}
