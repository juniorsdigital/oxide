#[derive(Debug, Clone)]
struct Book { title: String, pages: u32 }
fn total_pages(books: &[Book]) -> u32 { books.iter().map(|b| b.pages).sum() }
fn add_page(b: &mut Book) { b.pages += 1; }
fn longest<'a>(a: &'a Book, b: &'a Book) -> &'a Book { if a.pages >= b.pages { a } else { b } }
fn main() {
    let mut shelf = vec![Book { title: "Dune".into(), pages: 412 }, Book { title: "Emma".into(), pages: 320 }];
    add_page(&mut shelf[1]);
    for b in shelf.iter_mut() { b.pages *= 2; }
    println!("{}", total_pages(&shelf));
    let copy = shelf.clone();
    let first = shelf.remove(0);
    println!("{} {} {}", first.title, shelf.len(), copy.len());
    let l = longest(&copy[0], &copy[1]);
    println!("{}", l.title);
    let titles: Vec<String> = copy.into_iter().map(|b| b.title).collect();
    println!("{:?}", titles);
    let mut s = String::from("a");
    { let r = &mut s; r.push('b'); }
    let r1 = &s; let r2 = &s;
    println!("{r1}{r2}");
    s.push('c');
    println!("{s}");
    let opt = Some(String::from("x"));
    if let Some(ref inner) = opt { println!("{inner}"); }
    println!("{:?}", opt);
    let mut o2 = Some(3);
    let taken = o2.take();
    println!("{:?} {:?}", taken, o2);
    let mut a = 1; let mut b = 2;
    std::mem::swap(&mut a, &mut b);
    println!("{a} {b}");
}
