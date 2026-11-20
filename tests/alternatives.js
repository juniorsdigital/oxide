// Other ways learners solve the lesson tasks. tests/harness.js runs each one through rustc and the teaching
// interpreter and fails if the lesson's checks do not agree with `pass`.
//
// Each entry edits the lesson's solution (or starter, with `from: 'starter'`): every [find, replace] pair in
// `edit` must match exactly once. `pass: true` means a correct answer the checks must accept; `pass: false`
// means one they must reject.
module.exports = [
  // 1.1 Hello, Rust
  { lesson: 'hello', name: '{} with language as an argument', pass: true,
    edit: [['println!("I am learning {language}.");', 'println!("I am learning {}.", language);']] },
  { lesson: 'hello', name: 'positional {0}', pass: true,
    edit: [['println!("I am learning {language}.");', 'println!("I am learning {0}.", language);']] },
  { lesson: 'hello', name: 'argument on the next line', pass: true,
    edit: [['println!("I am learning {language}.");', 'println!(\n        "I am learning {}.",\n        language\n    );']] },
  { lesson: 'hello', name: 'named argument', pass: true,
    edit: [['println!("I am learning {language}.");', 'println!("I am learning {lang}.", lang = language);']] },
  { lesson: 'hello', name: 'formatting spec on the inline placeholder', pass: true,
    edit: [['println!("I am learning {language}.");', 'println!("I am learning {language:}.");']] },
  { lesson: 'hello', name: 'typed the word Rust', pass: false,
    edit: [['println!("I am learning {language}.");', 'println!("I am learning Rust.");']] },
  { lesson: 'hello', name: 'string literal as the argument', pass: false,
    edit: [['println!("I am learning {language}.");', 'println!("I am learning {}.", "Rust"); // language']] },

  // 1.4 Functions
  { lesson: 'functions', name: 'TODO comment left in place, function not written', pass: false, from: 'starter',
    edit: [['    n * n;', '    n * n']] },

  // 2.1 Ownership
  { lesson: 'ownership', name: 'String::clone(&greeting)', pass: true,
    edit: [['let moved = greeting.clone();', 'let moved = String::clone(&greeting);']] },
  { lesson: 'ownership', name: '.to_owned()', pass: true,
    edit: [['let moved = greeting.clone();', 'let moved = greeting.to_owned();']] },
  { lesson: 'ownership', name: 'clone the other way round', pass: true,
    edit: [['let moved = greeting.clone();', 'let moved = greeting;\n    let greeting = moved.clone();']] },

  // 2.2 Borrowing
  { lesson: 'borrowing', name: 'mentions .clone() only in a comment', pass: true,
    edit: [['fn main() {', 'fn main() {\n    // no .clone() needed: use first before the push']] },

  // 4.2 Iterators
  { lesson: 'iterators', name: 'pow(2) and a typed sum', pass: true,
    edit: [['let sq: i32 = readings.iter().filter(|&&r| r % 2 == 0).map(|r| r * r).sum();',
      'let sq = readings\n        .iter()\n        .filter(|r| *r % 2 == 0)\n        .map(|r| r.pow(2))\n        .sum::<i32>();']] },

  // 4.3 Traits
  { lesson: 'traits', name: 'extra spaces in the impl line', pass: true,
    edit: [['impl Shape for Triangle', 'impl  Shape  for  Triangle']] },

  // 4.4 Lifetimes
  { lesson: 'lifetimes', name: "lifetime named 's", pass: true,
    edit: [["fn longest<'a>(a: &'a str, b: &'a str) -> &'a str", "fn longest<'s>(a: &'s str, b: &'s str) -> &'s str"]] },

  // 5.3 Performance
  { lesson: 'performance', name: 'sum with a turbofish', pass: true,
    edit: [['let fives: u64 = data.iter().filter(|&&x| x % 5 == 0).map(|&x| x * x).sum();',
      'let fives = data.iter().filter(|x| *x % 5 == 0).map(|x| x * x).sum::<u64>();']] },
];
