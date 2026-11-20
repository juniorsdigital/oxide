// ---------- Oxide Workbench curriculum ----------
// check types: out (stdout contains), code (source contains, regex allowed with re:), ok (ran with exit 0), nocode (source must not contain)
const MODULES = [
  { id: 'm1', num: 1, title: 'Foundations', blurb: 'Syntax, types and control flow' },
  { id: 'm2', num: 2, title: 'Ownership', blurb: 'The idea that makes Rust fast and safe' },
  { id: 'm3', num: 3, title: 'Modeling data', blurb: 'Structs, enums and errors' },
  { id: 'm4', num: 4, title: 'Abstractions', blurb: 'Collections, iterators, traits, lifetimes' },
  { id: 'm5', num: 5, title: 'Performance', blurb: 'Smart pointers, threads, memory layout' },
  { id: 'm6', num: 6, title: 'Build it', blurb: 'A real service, end to end' },
];

const LESSONS = [
  // ---------------- Module 1 ----------------
  {
    id: 'hello', module: 'm1', num: '1.1', title: 'Hello, Rust', minutes: 5,
    summary: 'Write and run your first program, and see what the compiler does for you.',
    body: `
<p>Every Rust program starts running at <code>fn main()</code>. The code in the editor is a complete program. Press <kbd>Run</kbd> (or <kbd>Ctrl</kbd>+<kbd>Enter</kbd>) to compile and run it.</p>
<p><code>println!</code> ends in <code>!</code> because it is a <em>macro</em>: code that writes code at compile time. It checks your format string while the program is being built, so a placeholder with no matching value is a compile error instead of a crash in production.</p>
<ul>
  <li><code>{}</code> is filled by the next argument, in order.</li>
  <li><code>{name}</code> prints the variable <code>name</code> directly.</li>
  <li><code>//</code> starts a comment that runs to the end of the line.</li>
</ul>
<p>Rust is compiled <em>ahead of time</em> to native machine code. There is no virtual machine and no garbage collector running alongside your program, which is a big part of why Rust services have fast, predictable response times.</p>`,
    perf: 'Format strings are checked when you compile. In many languages a typo in a log template only shows up at runtime. In Rust it never ships.',
    starter: `fn main() {
    // Every Rust program starts here.
    println!("Hello, Rust!");

    let language = "Rust";
    let year = 2015;
    println!("{} 1.0 shipped in {}.", language, year);
}
`,
    task: {
      title: 'Your turn',
      steps: ['Run the program and read the output.', 'Add a third line that prints exactly <code>I am learning Rust.</code>', 'Use an inline placeholder, <code>{language}</code>, instead of typing the word Rust.'],
      checks: [
        { type: 'out', value: 'I am learning Rust.', label: 'Prints “I am learning Rust.”' },
        { type: 'code', value: '{language}', label: 'Uses the {language} placeholder' },
      ],
    },
    hints: ['Copy the second <code>println!</code> line and change the text.', 'Inside the quotes, write <code>{language}</code> where the word should go: <code>println!("I am learning {language}.");</code>'],
    solution: `fn main() {
    // Every Rust program starts here.
    println!("Hello, Rust!");

    let language = "Rust";
    let year = 2015;
    println!("{} 1.0 shipped in {}.", language, year);
    println!("I am learning {language}.");
}
`,
  },
  {
    id: 'variables', module: 'm1', num: '1.2', title: 'Variables and mutability', minutes: 8,
    summary: 'Bindings are immutable unless you say otherwise. Learn to read your first compiler error.',
    body: `
<p><code>let</code> creates a variable. In Rust, variables are <strong>immutable by default</strong>: once a value is bound, it cannot change. To allow changes, write <code>let mut</code>.</p>
<p>This program has a bug on purpose. Run it and read the error. Rust errors are detailed: they point at the exact line, explain the rule, and often suggest a fix. Learning to read them is most of learning Rust.</p>
<ul>
  <li><strong>Shadowing</strong>: <code>let units = units.len();</code> declares a <em>new</em> variable with the same name. It can even have a different type.</li>
  <li><strong>Constants</strong>: <code>const MAX_SPEED: u32 = 120;</code> must have a type and a value known at compile time. The compiler pastes the value wherever it is used.</li>
</ul>`,
    perf: 'When the compiler knows a value never changes, it can keep it in a register, fold it into other constants, and share it between threads without locks.',
    starter: `fn main() {
    let speed = 60;
    println!("Speed: {speed} km/h");

    speed = 80; // the compiler stops us here
    println!("New speed: {speed} km/h");

    // Shadowing: a brand new variable that reuses the name
    let units = "km/h";
    let units = units.len();
    println!("The unit name has {units} characters");

    const MAX_SPEED: u32 = 120;
    println!("Limit: {MAX_SPEED}");
}
`,
    expectStarter: 'E0384',
    task: {
      title: 'Fix the error',
      steps: ['Run the code and find the error code (it starts with <code>E</code>).', 'Change one line so <code>speed</code> is allowed to change.', 'Run again until all four lines print.'],
      checks: [
        { type: 'ok', label: 'Compiles and runs' },
        { type: 'out', value: 'New speed: 80 km/h', label: 'Prints the new speed' },
      ],
    },
    hints: ['The error says <code>cannot assign twice to immutable variable</code>.', 'Declare it with <code>let mut speed = 60;</code>'],
    solution: `fn main() {
    let mut speed = 60;
    println!("Speed: {speed} km/h");

    speed = 80;
    println!("New speed: {speed} km/h");

    // Shadowing: a brand new variable that reuses the name
    let units = "km/h";
    let units = units.len();
    println!("The unit name has {units} characters");

    const MAX_SPEED: u32 = 120;
    println!("Limit: {MAX_SPEED}");
}
`,
  },
  {
    id: 'types', module: 'm1', num: '1.3', title: 'Numbers, text and tuples', minutes: 10,
    summary: 'Every value has a type with a fixed size. Overflow is caught, never silent.',
    body: `
<p>Rust is <em>statically typed</em>: every value's type is known when you compile. Usually the compiler infers it, but you can write it after a colon: <code>let level: u8 = 250;</code></p>
<table class="ref">
  <thead><tr><th>Kind</th><th>Types</th><th>Notes</th></tr></thead>
  <tbody>
    <tr><td>Signed integers</td><td><code>i8 i16 i32 i64 i128 isize</code></td><td><code>i32</code> is the default</td></tr>
    <tr><td>Unsigned integers</td><td><code>u8 u16 u32 u64 u128 usize</code></td><td><code>usize</code> is used for lengths and indexes</td></tr>
    <tr><td>Floats</td><td><code>f32 f64</code></td><td><code>f64</code> is the default</td></tr>
    <tr><td>Other</td><td><code>bool</code>, <code>char</code></td><td>a <code>char</code> is 4 bytes and holds any Unicode scalar</td></tr>
    <tr><td>Compound</td><td><code>(i32, f64)</code>, <code>[u8; 4]</code></td><td>tuples mix types; arrays have a fixed length</td></tr>
  </tbody>
</table>
<p>Rust never converts between number types behind your back. To turn an integer into a float, write <code>x as f64</code>.</p>
<p>A <code>u8</code> holds 0 to 255. Run the program: adding past 255 does not wrap around silently. In a debug build the program <em>panics</em> (stops with an error message). Release builds wrap instead, and you can ask for exactly the behavior you want with <code>checked_add</code>, <code>wrapping_add</code> or <code>saturating_add</code>.</p>`,
    perf: 'Picking the smallest type that fits matters at scale. A million <code>u8</code> values take 1 MB. As <code>u64</code> they take 8 MB, and fewer of them fit in the CPU cache.',
    starter: `fn add_bonus(level: u8, bonus: u8) -> u8 {
    level + bonus // u8 only goes up to 255
}

fn main() {
    let total = add_bonus(250, 10);
    println!("Total: {total}");

    let ratio = 7 as f64 / 2.0;
    let letter = 'R';
    let point = (3, -4);
    let primes = [2, 3, 5, 7, 11];
    println!("{ratio} {letter} {:?} {}", point, primes.len());
}
`,
    expectStarter: 'panic',
    task: {
      title: 'Make the total fit',
      steps: ['Run it and read the panic message.', 'Change <code>add_bonus</code> so it takes and returns <code>u16</code> values.', 'Run again: it should print <code>Total: 260</code>.'],
      checks: [
        { type: 'ok', label: 'Runs without a panic' },
        { type: 'out', value: 'Total: 260', label: 'Prints Total: 260' },
      ],
    },
    hints: ['A <code>u16</code> holds up to 65,535.', 'The signature becomes <code>fn add_bonus(level: u16, bonus: u16) -> u16</code>.'],
    solution: `fn add_bonus(level: u16, bonus: u16) -> u16 {
    level + bonus
}

fn main() {
    let total = add_bonus(250, 10);
    println!("Total: {total}");

    let ratio = 7 as f64 / 2.0;
    let letter = 'R';
    let point = (3, -4);
    let primes = [2, 3, 5, 7, 11];
    println!("{ratio} {letter} {:?} {}", point, primes.len());
}
`,
  },
  {
    id: 'functions', module: 'm1', num: '1.4', title: 'Functions and expressions', minutes: 10,
    summary: 'The last expression in a block is its value. One stray semicolon changes everything.',
    body: `
<p>Functions are declared with <code>fn</code>. Parameter types are always written out, and the return type comes after <code>-&gt;</code>.</p>
<p>Rust is an <em>expression language</em>. A block <code>{ ... }</code> produces the value of its last expression, as long as that expression has <strong>no semicolon</strong>. A semicolon turns an expression into a statement, whose value is <code>()</code>, the empty "unit" value.</p>
<pre><code>fn double(n: i32) -> i32 {
    n * 2      // no semicolon: this is the return value
}</code></pre>
<p>The program on the right has one semicolon too many. Run it and read the help line at the bottom of the error.</p>`,
    perf: 'Small functions cost nothing. The optimizer inlines them, so you can split code into readable pieces without paying for function calls in hot paths.',
    starter: `fn square(n: i32) -> i32 {
    n * n;
}

// TODO: write fn to_fahrenheit(c: f64) -> f64
// Formula: c * 9.0 / 5.0 + 32.0

fn main() {
    let side = 7;
    println!("{side} squared is {}", square(side));
}
`,
    expectStarter: 'E0308',
    task: {
      title: 'Fix it, then write a function',
      steps: ['Fix <code>square</code> so it returns a value.', 'Write <code>fn to_fahrenheit(c: f64) -> f64</code>.', 'In <code>main</code>, print <code>100°C = 212°F</code> using your function.'],
      checks: [
        { type: 'out', value: '7 squared is 49', label: 'square(7) returns 49' },
        { type: 'code', value: 'fn to_fahrenheit', label: 'Defines to_fahrenheit' },
        { type: 'out', value: '100°C = 212°F', label: 'Prints 100°C = 212°F' },
      ],
    },
    hints: ['Delete the semicolon after <code>n * n</code>.', 'The body of <code>to_fahrenheit</code> is one line: <code>c * 9.0 / 5.0 + 32.0</code> with no semicolon.', 'Print it with <code>println!("100°C = {}°F", to_fahrenheit(100.0));</code>'],
    solution: `fn square(n: i32) -> i32 {
    n * n
}

fn to_fahrenheit(c: f64) -> f64 {
    c * 9.0 / 5.0 + 32.0
}

fn main() {
    let side = 7;
    println!("{side} squared is {}", square(side));
    println!("100°C = {}°F", to_fahrenheit(100.0));
}
`,
  },
  {
    id: 'control', module: 'm1', num: '1.5', title: 'Control flow', minutes: 10,
    summary: '<code>if</code>, loops and ranges, all of which can produce values.',
    body: `
<p>Because <code>if</code> is an expression, it can sit on the right side of <code>let</code>. Both branches must produce the same type.</p>
<ul>
  <li><code>loop</code> repeats forever until you <code>break</code>. <code>break value</code> hands a value back out of the loop.</li>
  <li><code>while condition { }</code> repeats while the condition is true.</li>
  <li><code>for i in 1..=15 { }</code> walks a range. <code>1..15</code> stops before 15. <code>1..=15</code> includes it.</li>
</ul>
<p>The <code>%</code> operator gives the remainder of a division, so <code>i % 3 == 0</code> means "i is divisible by 3".</p>`,
    perf: 'A <code>for</code> loop over a range compiles to the same tight machine loop as a C <code>for (i = 1; i &lt;= 15; i++)</code>. The range is not a list in memory.',
    starter: `fn main() {
    let temperature = 23;
    let feel = if temperature > 25 { "hot" } else if temperature > 15 { "mild" } else { "cold" };
    println!("{temperature}°C feels {feel}");

    // \`loop\` can return a value with \`break\`
    let mut n = 1;
    let first_big_power = loop {
        n *= 2;
        if n > 1000 {
            break n;
        }
    };
    println!("First power of two over 1000: {first_big_power}");

    // TODO: FizzBuzz for 1 through 15
    for i in 1..=15 {
        println!("{i}");
    }
}
`,
    task: {
      title: 'FizzBuzz',
      steps: ['For multiples of 3, print <code>Fizz</code> instead of the number.', 'For multiples of 5, print <code>Buzz</code>.', 'For multiples of both, print <code>FizzBuzz</code>.'],
      checks: [
        { type: 'out', value: '1\n2\nFizz\n4\nBuzz\n', label: '1, 2, Fizz, 4, Buzz' },
        { type: 'out', value: '13\n14\nFizzBuzz\n', label: '15 prints FizzBuzz' },
      ],
    },
    hints: ['Check the "both" case first, or it will never be reached.', 'Try <code>if i % 15 == 0 { ... } else if i % 3 == 0 { ... } else if i % 5 == 0 { ... } else { ... }</code>', 'You can also <code>match (i % 3, i % 5) { (0, 0) => ..., (0, _) => ..., (_, 0) => ..., _ => ... }</code>'],
    solution: `fn main() {
    let temperature = 23;
    let feel = if temperature > 25 { "hot" } else if temperature > 15 { "mild" } else { "cold" };
    println!("{temperature}°C feels {feel}");

    let mut n = 1;
    let first_big_power = loop {
        n *= 2;
        if n > 1000 {
            break n;
        }
    };
    println!("First power of two over 1000: {first_big_power}");

    for i in 1..=15 {
        match (i % 3, i % 5) {
            (0, 0) => println!("FizzBuzz"),
            (0, _) => println!("Fizz"),
            (_, 0) => println!("Buzz"),
            _ => println!("{i}"),
        }
    }
}
`,
  },
  // ---------------- Module 2 ----------------
  {
    id: 'ownership', module: 'm2', num: '2.1', title: 'Ownership and moves', minutes: 12,
    summary: 'Each value has exactly one owner. That single rule replaces the garbage collector.',
    body: `
<p>Three rules, checked at compile time:</p>
<ol>
  <li>Each value has one <strong>owner</strong> (a variable).</li>
  <li>There is only one owner at a time.</li>
  <li>When the owner goes out of scope, the value is <strong>dropped</strong> and its memory freed, right there.</li>
</ol>
<figure class="diagram" data-diagram="string"></figure>
<p>A <code>String</code> is three numbers on the stack (pointer, length, capacity) that point to bytes on the heap. <code>let moved = greeting;</code> copies those three numbers and makes <code>greeting</code> unusable. Only one variable owns the heap bytes, so they are freed exactly once. No double frees and no leaks, and no garbage collector pausing the program to look for unused memory.</p>
<p>Small fixed-size types like integers are <code>Copy</code>: assigning them duplicates the value and both stay valid. For heap data you ask for a duplicate explicitly with <code>.clone()</code>, so the cost is visible in the code.</p>`,
    perf: 'Memory is freed at a known point, with no collector thread and no pauses. This is why Discord moved a latency-sensitive service from Go to Rust: the garbage collector was causing regular latency spikes.',
    starter: `fn main() {
    let greeting = String::from("hello");
    let moved = greeting;            // ownership moves to \`moved\`
    println!("{moved}, world");
    println!("{greeting} again");    // greeting no longer owns anything

    let a = 5;
    let b = a;                       // i32 is Copy: both stay valid
    println!("{a} {b}");

    let name = String::from("Ada");
    takes_ownership(name);
    // println!("{name}");           // would fail: name moved into the function
}

fn takes_ownership(s: String) {
    println!("I own {s} now");
} // \`s\` goes out of scope: its heap memory is freed here
`,
    expectStarter: 'E0382',
    task: {
      title: 'Keep both strings',
      steps: ['Run it and find where the compiler says the value moved.', 'Change the move into an explicit copy with <code>.clone()</code>.', 'Then try uncommenting the last <code>println!</code> in <code>main</code> to see the same error for a function call. Comment it out again before you finish.'],
      checks: [
        { type: 'ok', label: 'Compiles and runs' },
        { type: 'out', value: 'hello again', label: 'Both greeting and moved are printed' },
        { type: 'code', value: '.clone()', label: 'Uses .clone()' },
      ],
    },
    hints: ['The error points at <code>let moved = greeting;</code> as the place the value moved.', 'Write <code>let moved = greeting.clone();</code>'],
    solution: `fn main() {
    let greeting = String::from("hello");
    let moved = greeting.clone();    // a deep copy: two separate heap buffers
    println!("{moved}, world");
    println!("{greeting} again");

    let a = 5;
    let b = a;
    println!("{a} {b}");

    let name = String::from("Ada");
    takes_ownership(name);
}

fn takes_ownership(s: String) {
    println!("I own {s} now");
}
`,
  },
  {
    id: 'borrowing', module: 'm2', num: '2.2', title: 'Borrowing and references', minutes: 12,
    summary: 'Use a value without taking it. Many readers or one writer, never both.',
    body: `
<p>Moving a value into every function that needs it would be painful. Instead you <strong>borrow</strong> it with a reference:</p>
<ul>
  <li><code>&amp;words</code> is a <em>shared</em> borrow: read-only, and you can have as many as you like.</li>
  <li><code>&amp;mut words</code> is a <em>mutable</em> borrow: it can change the value, and while it exists it is the <strong>only</strong> way to reach the value.</li>
</ul>
<p>The compiler (the <em>borrow checker</em>) enforces: <strong>any number of readers, or exactly one writer</strong>. Run the code to see why. <code>first</code> points into the vector's heap buffer. Pushing may move that buffer to a bigger allocation, which would leave <code>first</code> pointing at freed memory. In C++ that bug compiles. In Rust it does not.</p>`,
    perf: 'The same rule that prevents dangling pointers also prevents data races between threads, so Rust code can run in parallel without defensive copies or global locks.',
    starter: `fn total_len(words: &Vec<String>) -> usize {
    let mut sum = 0;
    for w in words {
        sum += w.len();
    }
    sum
}

fn add_word(words: &mut Vec<String>, w: &str) {
    words.push(w.to_string());
}

fn main() {
    let mut words = vec![String::from("fast"), String::from("safe")];
    let first = &words[0];
    add_word(&mut words, "productive");
    println!("first word: {first}");
    println!("total letters: {}", total_len(&words));
}
`,
    expectStarter: 'E0502',
    task: {
      title: 'Reorder the borrows',
      steps: ['Read the three labels in the error: where the shared borrow starts, where the mutable borrow happens, and where the shared borrow is used later.', 'Fix it by using <code>first</code> before the vector is changed.', 'Do not use <code>.clone()</code> this time.'],
      checks: [
        { type: 'ok', label: 'Compiles and runs' },
        { type: 'out', value: 'first word: fast', label: 'Prints the first word' },
        { type: 'out', value: 'total letters: 18', label: 'Counts 18 letters' },
        { type: 'nocode', value: '.clone()', label: 'No .clone() needed' },
      ],
    },
    hints: ['A borrow lasts until its last use, not until the end of the block.', 'Move <code>println!("first word: {first}");</code> up, directly after <code>let first = &words[0];</code>'],
    solution: `fn total_len(words: &Vec<String>) -> usize {
    let mut sum = 0;
    for w in words {
        sum += w.len();
    }
    sum
}

fn add_word(words: &mut Vec<String>, w: &str) {
    words.push(w.to_string());
}

fn main() {
    let mut words = vec![String::from("fast"), String::from("safe")];
    let first = &words[0];
    println!("first word: {first}"); // last use of the shared borrow
    add_word(&mut words, "productive");
    println!("total letters: {}", total_len(&words));
}
`,
  },
  {
    id: 'slices', module: 'm2', num: '2.3', title: 'Slices and strings', minutes: 10,
    summary: '<code>String</code> owns text. <code>&amp;str</code> is a cheap view into it.',
    body: `
<p>A <strong>slice</strong> is a reference to part of a collection: a pointer plus a length. <code>&amp;nums[1..4]</code> views elements 1, 2 and 3 without copying anything.</p>
<ul>
  <li><code>String</code>: owned, growable text on the heap.</li>
  <li><code>&amp;str</code>: a borrowed slice of text. String literals like <code>"memory safety"</code> are <code>&amp;str</code> values baked into the program binary.</li>
</ul>
<p>Write functions that take <code>&amp;str</code>. They then accept both literals and borrowed <code>String</code>s (a <code>&amp;String</code> converts to <code>&amp;str</code> automatically).</p>
<p>Text is UTF-8, so one character can take several bytes. <code>.len()</code> counts bytes, <code>.chars().count()</code> counts characters, and you slice text by byte positions (here found with <code>char_indices</code>).</p>`,
    perf: 'Parsing with slices means zero copies. Fast parsers and HTTP servers in Rust hand out <code>&amp;str</code> views into one input buffer instead of allocating a new string per field.',
    starter: `fn first_word(s: &str) -> &str {
    for (i, ch) in s.char_indices() {
        if ch == ' ' {
            return &s[..i];
        }
    }
    s
}

// TODO: fn last_word(s: &str) -> &str

fn main() {
    let sentence = String::from("zero cost abstractions");
    let word = first_word(&sentence);
    println!("first word: {word}");

    let literal = "memory safety";
    println!("first word: {}", first_word(literal));

    let accented = "héllo";
    println!("bytes: {}, chars: {}", accented.len(), accented.chars().count());

    let nums = [10, 20, 30, 40, 50];
    let middle = &nums[1..4];
    println!("middle: {:?}", middle);
}
`,
    task: {
      title: 'Find the last word',
      steps: ['Write <code>fn last_word(s: &str) -> &str</code>.', 'Print <code>last word: abstractions</code> for the sentence.'],
      checks: [
        { type: 'code', value: 'fn last_word', label: 'Defines last_word' },
        { type: 'out', value: 'last word: abstractions', label: 'Prints the last word' },
      ],
    },
    hints: ['<code>s.split_whitespace()</code> gives an iterator over words. <code>.last()</code> returns an <code>Option&lt;&amp;str&gt;</code>.', 'Body: <code>s.split_whitespace().last().unwrap_or("")</code>'],
    solution: `fn first_word(s: &str) -> &str {
    for (i, ch) in s.char_indices() {
        if ch == ' ' {
            return &s[..i];
        }
    }
    s
}

fn last_word(s: &str) -> &str {
    s.split_whitespace().last().unwrap_or("")
}

fn main() {
    let sentence = String::from("zero cost abstractions");
    let word = first_word(&sentence);
    println!("first word: {word}");
    println!("last word: {}", last_word(&sentence));

    let literal = "memory safety";
    println!("first word: {}", first_word(literal));

    let accented = "héllo";
    println!("bytes: {}, chars: {}", accented.len(), accented.chars().count());

    let nums = [10, 20, 30, 40, 50];
    let middle = &nums[1..4];
    println!("middle: {:?}", middle);
}
`,
  },
  // ---------------- Module 3 ----------------
  {
    id: 'structs', module: 'm3', num: '3.1', title: 'Structs and methods', minutes: 12,
    summary: 'Group data into your own types and attach behavior with <code>impl</code>.',
    body: `
<p>A <code>struct</code> names a group of fields. An <code>impl</code> block attaches functions to it. The first parameter says how a method uses the value:</p>
<ul>
  <li><code>&amp;self</code>: reads it (a shared borrow).</li>
  <li><code>&amp;mut self</code>: changes it (a mutable borrow), so the variable must be <code>let mut</code>.</li>
  <li><code>self</code>: consumes it (takes ownership).</li>
</ul>
<p>Functions without <code>self</code>, like <code>new</code>, are <em>associated functions</em> and are called with <code>Rectangle::new(...)</code>. <code>Self</code> is shorthand for the type being implemented.</p>
<p><code>#[derive(Debug)]</code> asks the compiler to generate code that prints the struct with <code>{:?}</code>.</p>`,
    perf: 'A struct is just its fields laid out in memory. No object header, no hidden pointer, no boxing. A <code>Vec&lt;Rectangle&gt;</code> is one contiguous block of 8-byte records.',
    starter: `#[derive(Debug)]
struct Rectangle {
    width: u32,
    height: u32,
}

impl Rectangle {
    fn new(width: u32, height: u32) -> Self {
        Rectangle { width, height }
    }

    fn area(&self) -> u32 {
        self.width * self.height
    }

    fn scale(&mut self, factor: u32) {
        self.width *= factor;
        self.height *= factor;
    }

    // TODO: fn can_hold(&self, other: &Rectangle) -> bool
}

fn main() {
    let mut r = Rectangle::new(3, 4);
    println!("{:?} has area {}", r, r.area());
    r.scale(2);
    println!("scaled: {:?}, area {}", r, r.area());
}
`,
    task: {
      title: 'Add a method',
      steps: ['Add <code>fn can_hold(&self, other: &Rectangle) -> bool</code>: true when both sides of <code>self</code> are larger than <code>other</code>.', 'Print <code>can hold: true</code> by checking whether the scaled <code>r</code> can hold <code>Rectangle::new(5, 5)</code>.'],
      checks: [
        { type: 'code', value: 'fn can_hold', label: 'Defines can_hold' },
        { type: 'out', value: 'can hold: true', label: 'The 6×8 rectangle holds a 5×5 one' },
      ],
    },
    hints: ['Compare widths and heights: <code>self.width &gt; other.width &amp;&amp; self.height &gt; other.height</code>', 'In main: <code>println!("can hold: {}", r.can_hold(&Rectangle::new(5, 5)));</code>'],
    solution: `#[derive(Debug)]
struct Rectangle {
    width: u32,
    height: u32,
}

impl Rectangle {
    fn new(width: u32, height: u32) -> Self {
        Rectangle { width, height }
    }

    fn area(&self) -> u32 {
        self.width * self.height
    }

    fn scale(&mut self, factor: u32) {
        self.width *= factor;
        self.height *= factor;
    }

    fn can_hold(&self, other: &Rectangle) -> bool {
        self.width > other.width && self.height > other.height
    }
}

fn main() {
    let mut r = Rectangle::new(3, 4);
    println!("{:?} has area {}", r, r.area());
    r.scale(2);
    println!("scaled: {:?}, area {}", r, r.area());
    println!("can hold: {}", r.can_hold(&Rectangle::new(5, 5)));
}
`,
  },
  {
    id: 'enums', module: 'm3', num: '3.2', title: 'Enums and pattern matching', minutes: 12,
    summary: 'Model exactly the states that can exist, and let <code>match</code> check you handled them all.',
    body: `
<p>An <code>enum</code> is a type that is <em>one of</em> several variants, and each variant can carry its own data. That makes it easy to describe things like network commands or parse results precisely.</p>
<p><code>match</code> compares a value against patterns and must be <strong>exhaustive</strong>: every variant needs an arm. Add a variant later and the compiler lists every <code>match</code> you forgot to update.</p>
<p>Rust has no <code>null</code>. A value that might be missing is an <code>Option&lt;T&gt;</code>, which is either <code>Some(value)</code> or <code>None</code>, and you cannot use the value without checking. <code>if let Some(x) = ...</code> handles the one case you care about.</p>`,
    perf: 'An enum is stored as a small tag plus room for its largest variant, with no heap allocation. <code>Option&lt;&amp;T&gt;</code> takes no extra space at all, because <code>None</code> is stored as the null pointer a reference can never be.',
    starter: `#[derive(Debug)]
enum Command {
    Get(String),
    Set { key: String, value: i64 },
    Delete(String),
    Ping,
}

fn describe(cmd: &Command) -> String {
    match cmd {
        Command::Get(key) => format!("read {key}"),
        Command::Set { key, value } => format!("write {key} = {value}"),
        Command::Ping => String::from("health check"),
    }
}

fn main() {
    let cmds = vec![
        Command::Set { key: "visits".to_string(), value: 1 },
        Command::Get("visits".to_string()),
        Command::Delete("visits".to_string()),
        Command::Ping,
    ];
    for c in &cmds {
        println!("{:?} -> {}", c, describe(c));
    }

    let maybe_port: Option<u16> = Some(8080);
    if let Some(port) = maybe_port {
        println!("listening on {port}");
    }
}
`,
    expectStarter: 'E0004',
    task: {
      title: 'Handle every case',
      steps: ['Run it: the compiler lists the variant that has no arm.', 'Add an arm for <code>Command::Delete</code> that returns <code>remove {key}</code>.', 'Avoid a catch-all <code>_</code> arm, so the compiler keeps checking for you.'],
      checks: [
        { type: 'ok', label: 'Compiles and runs' },
        { type: 'out', value: 'remove visits', label: 'Delete prints "remove visits"' },
        { type: 'nocode', value: 're:_\\s*=>', label: 'No catch-all arm' },
      ],
    },
    hints: ['The arm looks like the <code>Get</code> arm.', '<code>Command::Delete(key) =&gt; format!("remove {key}"),</code>'],
    solution: `#[derive(Debug)]
enum Command {
    Get(String),
    Set { key: String, value: i64 },
    Delete(String),
    Ping,
}

fn describe(cmd: &Command) -> String {
    match cmd {
        Command::Get(key) => format!("read {key}"),
        Command::Set { key, value } => format!("write {key} = {value}"),
        Command::Delete(key) => format!("remove {key}"),
        Command::Ping => String::from("health check"),
    }
}

fn main() {
    let cmds = vec![
        Command::Set { key: "visits".to_string(), value: 1 },
        Command::Get("visits".to_string()),
        Command::Delete("visits".to_string()),
        Command::Ping,
    ];
    for c in &cmds {
        println!("{:?} -> {}", c, describe(c));
    }

    let maybe_port: Option<u16> = Some(8080);
    if let Some(port) = maybe_port {
        println!("listening on {port}");
    }
}
`,
  },
  {
    id: 'errors', module: 'm3', num: '3.3', title: 'Error handling with Result', minutes: 14,
    summary: 'Failures are values, and the <code>?</code> operator passes them up.',
    body: `
<p>Rust has no exceptions. A function that can fail returns <code>Result&lt;T, E&gt;</code>: either <code>Ok(value)</code> or <code>Err(error)</code>. The signature tells callers that failure is possible, and the compiler makes them deal with it.</p>
<ul>
  <li><code>?</code> after a <code>Result</code> unwraps <code>Ok</code>, or returns the <code>Err</code> from the current function immediately.</li>
  <li><code>.unwrap()</code> and <code>.expect("why")</code> turn an <code>Err</code> into a panic. Use them for bugs that should never happen, not for bad user input.</li>
  <li><code>match</code> on the result to handle both cases.</li>
</ul>
<p>Collecting an iterator of <code>Result</code>s into <code>Result&lt;Vec&lt;T&gt;, E&gt;</code> stops at the first error.</p>`,
    perf: 'A <code>Result</code> is an ordinary return value: no stack unwinding, no hidden control flow. The error path costs about the same as the success path.',
    starter: `use std::num::ParseIntError;

fn parse_port(text: &str) -> Result<u16, ParseIntError> {
    let port: u16 = text.trim().parse()?;
    Ok(port)
}

// TODO: fn parse_all(list: &[&str]) -> Result<Vec<u16>, ParseIntError>

fn main() {
    for input in ["8080", " 443 ", "http", "70000"] {
        match parse_port(input) {
            Ok(p) => println!("{input:?} -> port {p}"),
            Err(e) => println!("{input:?} -> error: {e}"),
        }
    }

    // unwrap() turns an Err into a panic: fine for prototypes, risky in servers
    let port = parse_port("3000").unwrap();
    println!("using port {port}");
}
`,
    task: {
      title: 'Parse a whole list',
      steps: ['Write <code>parse_all</code> so it returns all the ports, or the first error.', 'Print <code>{:?}</code> of <code>parse_all(&amp;["80", "443"])</code> and of <code>parse_all(&amp;["80", "x"])</code>.'],
      checks: [
        { type: 'code', value: 'fn parse_all', label: 'Defines parse_all' },
        { type: 'out', value: 'Ok([80, 443])', label: 'Valid list gives Ok([80, 443])' },
        { type: 'out', value: 'Err(ParseIntError { kind: InvalidDigit })', label: 'Bad input gives the first error' },
      ],
    },
    hints: ['With a loop: start with <code>let mut ports = Vec::new();</code>, push <code>parse_port(s)?</code> for each item, then return <code>Ok(ports)</code>.', 'Or in one line: <code>list.iter().map(|s| parse_port(s)).collect()</code>. The return type tells <code>collect</code> what to build.'],
    solution: `use std::num::ParseIntError;

fn parse_port(text: &str) -> Result<u16, ParseIntError> {
    let port: u16 = text.trim().parse()?;
    Ok(port)
}

fn parse_all(list: &[&str]) -> Result<Vec<u16>, ParseIntError> {
    list.iter().map(|s| parse_port(s)).collect()
}

fn main() {
    for input in ["8080", " 443 ", "http", "70000"] {
        match parse_port(input) {
            Ok(p) => println!("{input:?} -> port {p}"),
            Err(e) => println!("{input:?} -> error: {e}"),
        }
    }

    let port = parse_port("3000").unwrap();
    println!("using port {port}");

    println!("{:?}", parse_all(&["80", "443"]));
    println!("{:?}", parse_all(&["80", "x"]));
}
`,
  },
  // ---------------- Module 4 ----------------
  {
    id: 'collections', module: 'm4', num: '4.1', title: 'Vec and HashMap', minutes: 12,
    summary: 'The two collections you will use most, and how to keep them fast.',
    body: `
<ul>
  <li><code>Vec&lt;T&gt;</code> is a growable array stored in one contiguous block. Reading items in order is very cache-friendly. When it runs out of room it allocates a bigger block and moves everything, so if you know the size, <code>Vec::with_capacity(n)</code> allocates once.</li>
  <li><code>HashMap&lt;K, V&gt;</code> maps keys to values. Its default hash function resists attackers who send keys designed to collide.</li>
  <li><code>BTreeMap</code> keeps keys sorted, at a small cost per operation.</li>
</ul>
<p>The <strong>entry API</strong> finds or inserts in a single lookup: <code>*counts.entry(word).or_insert(0) += 1;</code></p>
<aside class="note">The iteration order of a <code>HashMap</code> is unspecified in Rust and changes between runs. This interpreter happens to use insertion order, so always sort before printing if order matters, as the code here does.</aside>`,
    perf: 'Choosing <code>Vec</code> over a linked list is often the biggest single speedup available. Modern CPUs are much faster at reading memory in order than at chasing pointers.',
    starter: `use std::collections::HashMap;

fn main() {
    let text = "the quick brown fox jumps over the lazy dog the end";

    let mut counts: HashMap<&str, usize> = HashMap::new();
    for word in text.split_whitespace() {
        *counts.entry(word).or_insert(0) += 1;
    }

    // HashMap order is unspecified, so sort before printing
    let mut pairs: Vec<(&str, usize)> = counts.into_iter().collect();
    pairs.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(b.0)));

    for (word, n) in pairs.iter().take(3) {
        println!("{word}: {n}");
    }

    let mut scores = Vec::with_capacity(4); // one allocation up front
    scores.push(90);
    scores.push(72);
    scores.push(85);
    println!("scores: {:?}, len {}, best {:?}", scores, scores.len(), scores.iter().max());
}
`,
    task: {
      title: 'Count distinct words',
      steps: ['Print <code>distinct: 9</code>, the number of different words in <code>text</code>.', 'Watch out: <code>counts.into_iter()</code> moves the map, so you can only use <code>counts</code> before that line.'],
      checks: [
        { type: 'out', value: 'distinct: 9', label: 'Prints distinct: 9' },
      ],
    },
    hints: ['<code>counts.len()</code> is the number of keys.', 'Or use <code>pairs.len()</code> after collecting.'],
    solution: `use std::collections::HashMap;

fn main() {
    let text = "the quick brown fox jumps over the lazy dog the end";

    let mut counts: HashMap<&str, usize> = HashMap::new();
    for word in text.split_whitespace() {
        *counts.entry(word).or_insert(0) += 1;
    }
    println!("distinct: {}", counts.len());

    let mut pairs: Vec<(&str, usize)> = counts.into_iter().collect();
    pairs.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(b.0)));

    for (word, n) in pairs.iter().take(3) {
        println!("{word}: {n}");
    }

    let mut scores = Vec::with_capacity(4);
    scores.push(90);
    scores.push(72);
    scores.push(85);
    println!("scores: {:?}, len {}, best {:?}", scores, scores.len(), scores.iter().max());
}
`,
  },
  {
    id: 'iterators', module: 'm4', num: '4.2', title: 'Iterators and closures', minutes: 12,
    summary: 'High-level pipelines that compile down to plain loops.',
    body: `
<p>A <strong>closure</strong> is an anonymous function that can use variables from the code around it: <code>|r| r &gt; threshold</code>.</p>
<p>Iterators process items one at a time. <em>Adaptors</em> like <code>map</code>, <code>filter</code> and <code>enumerate</code> are <strong>lazy</strong>: they only describe the work. A <em>consumer</em> like <code>sum</code>, <code>collect</code> or <code>count</code> pulls items through the whole chain.</p>
<ul>
  <li><code>.iter()</code> yields references, <code>&amp;T</code>.</li>
  <li><code>.copied()</code> turns <code>&amp;i32</code> into <code>i32</code> for small <code>Copy</code> types.</li>
  <li><code>|&amp;r|</code> in a closure's parameter list unpacks a reference with a pattern.</li>
</ul>`,
    perf: 'This is the classic zero-cost abstraction. After optimization, <code>filter().map().sum()</code> becomes the same machine code as a hand-written loop, and the compiler can often drop bounds checks and use SIMD instructions too.',
    starter: `fn main() {
    let readings = vec![12, 7, 33, 4, 18, 25, 9];

    // Closures can capture variables from their environment
    let threshold = 10;
    let above: Vec<i32> = readings.iter().copied().filter(|&r| r > threshold).collect();
    println!("above {threshold}: {:?}", above);

    // Adaptors are lazy: nothing runs until \`sum\` pulls values through
    let total: i32 = readings.iter().map(|r| r * 2).sum();
    println!("doubled total: {total}");

    let labeled: Vec<String> = readings
        .iter()
        .enumerate()
        .map(|(i, r)| format!("#{i}={r}"))
        .collect();
    println!("{}", labeled.join(" "));

    // TODO: sum of the squares of the even readings
}
`,
    task: {
      title: 'Build a pipeline',
      steps: ['Using <code>filter</code>, <code>map</code> and <code>sum</code>, add up the squares of the even readings.', 'Print <code>sum of squares of evens: 484</code>.'],
      checks: [
        { type: 'code', value: '.filter(', label: 'Uses filter' },
        { type: 'code', value: 're:\\.map\\([^)]*\\*', label: 'Uses map to square' },
        { type: 'out', value: 'sum of squares of evens: 484', label: 'Prints 484' },
      ],
    },
    hints: ['Even means <code>r % 2 == 0</code>.', '<code>let sq: i32 = readings.iter().filter(|&amp;&amp;r| r % 2 == 0).map(|r| r * r).sum();</code>'],
    solution: `fn main() {
    let readings = vec![12, 7, 33, 4, 18, 25, 9];

    let threshold = 10;
    let above: Vec<i32> = readings.iter().copied().filter(|&r| r > threshold).collect();
    println!("above {threshold}: {:?}", above);

    let total: i32 = readings.iter().map(|r| r * 2).sum();
    println!("doubled total: {total}");

    let labeled: Vec<String> = readings
        .iter()
        .enumerate()
        .map(|(i, r)| format!("#{i}={r}"))
        .collect();
    println!("{}", labeled.join(" "));

    let sq: i32 = readings.iter().filter(|&&r| r % 2 == 0).map(|r| r * r).sum();
    println!("sum of squares of evens: {sq}");
}
`,
  },
  {
    id: 'traits', module: 'm4', num: '4.3', title: 'Traits and generics', minutes: 15,
    summary: 'Shared behavior across types, with a choice of static or dynamic dispatch.',
    body: `
<p>A <strong>trait</strong> describes behavior a type can have, like an interface. Types opt in with <code>impl Trait for Type</code>. Traits can supply <em>default methods</em> that implementers may override.</p>
<p>There are two ways to write code that works with any shape:</p>
<ul>
  <li><strong>Generics</strong>: <code>fn describe&lt;T: Shape&gt;(s: &amp;T)</code>. The compiler generates a specialized copy for each type you use (<em>monomorphization</em>). Calls are direct and can be inlined.</li>
  <li><strong>Trait objects</strong>: <code>Box&lt;dyn Shape&gt;</code>. One list can hold different types. Each call goes through a small table of function pointers (a <em>vtable</em>).</li>
</ul>`,
    perf: 'Generics cost nothing at runtime but make the binary larger. <code>dyn</code> costs one indirect call per method, but keeps code small and allows mixed collections. Rust lets you choose per case.',
    starter: `trait Shape {
    fn area(&self) -> f64;
    fn name(&self) -> String {
        String::from("shape") // default method
    }
}

struct Circle { r: f64 }
struct Square { side: f64 }

impl Shape for Circle {
    fn area(&self) -> f64 { 3.14159 * self.r * self.r }
    fn name(&self) -> String { String::from("circle") }
}

impl Shape for Square {
    fn area(&self) -> f64 { self.side * self.side }
}

// Static dispatch: a specialized copy is generated for each type
fn describe<T: Shape>(s: &T) -> String {
    format!("{} with area {:.2}", s.name(), s.area())
}

fn main() {
    println!("{}", describe(&Circle { r: 1.5 }));
    println!("{}", describe(&Square { side: 2.0 }));

    // Dynamic dispatch: one list holding different types behind pointers
    let shapes: Vec<Box<dyn Shape>> = vec![
        Box::new(Circle { r: 1.0 }),
        Box::new(Square { side: 3.0 }),
    ];
    let total: f64 = shapes.iter().map(|s| s.area()).sum();
    println!("total area: {total:.2}");
}
`,
    task: {
      title: 'Add a new shape',
      steps: ['Add <code>struct Triangle { base: f64, height: f64 }</code>.', 'Implement <code>Shape</code> for it: area is <code>0.5 * base * height</code>, name is <code>"triangle"</code>.', 'Add <code>Triangle { base: 4.0, height: 3.0 }</code> to <code>shapes</code>. The total becomes 18.14.'],
      checks: [
        { type: 'code', value: 'impl Shape for Triangle', label: 'Implements Shape for Triangle' },
        { type: 'out', value: 'total area: 18.14', label: 'Total area is 18.14' },
      ],
    },
    hints: ['Copy the <code>impl Shape for Circle</code> block and adapt it.', 'Add <code>Box::new(Triangle { base: 4.0, height: 3.0 }),</code> to the <code>vec!</code>.'],
    solution: `trait Shape {
    fn area(&self) -> f64;
    fn name(&self) -> String {
        String::from("shape")
    }
}

struct Circle { r: f64 }
struct Square { side: f64 }
struct Triangle { base: f64, height: f64 }

impl Shape for Circle {
    fn area(&self) -> f64 { 3.14159 * self.r * self.r }
    fn name(&self) -> String { String::from("circle") }
}

impl Shape for Square {
    fn area(&self) -> f64 { self.side * self.side }
}

impl Shape for Triangle {
    fn area(&self) -> f64 { 0.5 * self.base * self.height }
    fn name(&self) -> String { String::from("triangle") }
}

fn describe<T: Shape>(s: &T) -> String {
    format!("{} with area {:.2}", s.name(), s.area())
}

fn main() {
    println!("{}", describe(&Circle { r: 1.5 }));
    println!("{}", describe(&Square { side: 2.0 }));
    println!("{}", describe(&Triangle { base: 4.0, height: 3.0 }));

    let shapes: Vec<Box<dyn Shape>> = vec![
        Box::new(Circle { r: 1.0 }),
        Box::new(Square { side: 3.0 }),
        Box::new(Triangle { base: 4.0, height: 3.0 }),
    ];
    let total: f64 = shapes.iter().map(|s| s.area()).sum();
    println!("total area: {total:.2}");
}
`,
  },
  {
    id: 'lifetimes', module: 'm4', num: '4.4', title: 'Lifetimes', minutes: 12,
    summary: 'Names for how long a borrow is valid, so references can never outlive their data.',
    body: `
<p>Every reference is valid for some region of code, called its <strong>lifetime</strong>. The compiler usually works lifetimes out by itself. It needs your help when a function returns a reference and could have borrowed it from more than one input.</p>
<p><code>longest</code> returns either <code>a</code> or <code>b</code>. Which one, and so how long the result stays valid, depends on runtime data. A lifetime parameter states the contract:</p>
<pre><code>fn longest&lt;'a&gt;(a: &amp;'a str, b: &amp;'a str) -&gt; &amp;'a str</code></pre>
<p>Read it as: "the result lives no longer than the shorter-lived of <code>a</code> and <code>b</code>". With that contract, the compiler rejects any caller that keeps the result after either input is gone. That rules out use-after-free bugs, which account for a large share of security vulnerabilities in C and C++ code.</p>
<aside class="note">The full compiler also checks the caller side: try moving the <code>println!</code> outside the inner block in the Rust Playground and you will get <code>E0597: second does not live long enough</code>. This teaching interpreter checks the signature, not that scope rule.</aside>`,
    perf: 'Lifetimes exist only at compile time. They add no runtime checks, counters or metadata, so safe references cost the same as raw pointers.',
    starter: `fn longest(a: &str, b: &str) -> &str {
    if a.len() >= b.len() { a } else { b }
}

fn main() {
    let first = String::from("borrow checker");
    let result;
    {
        let second = String::from("ownership");
        result = longest(first.as_str(), second.as_str());
        println!("longest: {result}");
    }
}
`,
    expectStarter: 'E0106',
    task: {
      title: 'Write the contract',
      steps: ['Read the error: the compiler cannot tell which input the result borrows from.', "Add a lifetime parameter <code>'a</code> to <code>longest</code> and use it on both inputs and the output."],
      checks: [
        { type: 'ok', label: 'Compiles and runs' },
        { type: 'code', value: "<'a>", label: "Declares <'a>" },
        { type: 'out', value: 'longest: borrow checker', label: 'Prints the longest string' },
      ],
    },
    hints: ["Lifetime names start with an apostrophe: <code>'a</code>.", "<code>fn longest&lt;'a&gt;(a: &amp;'a str, b: &amp;'a str) -&gt; &amp;'a str</code>"],
    solution: `fn longest<'a>(a: &'a str, b: &'a str) -> &'a str {
    if a.len() >= b.len() { a } else { b }
}

fn main() {
    let first = String::from("borrow checker");
    let result;
    {
        let second = String::from("ownership");
        result = longest(first.as_str(), second.as_str());
        println!("longest: {result}");
    }
}
`,
  },
  // ---------------- Module 5 ----------------
  {
    id: 'smart-pointers', module: 'm5', num: '5.1', title: 'Box, Rc and RefCell', minutes: 14,
    summary: 'Heap allocation, shared ownership and controlled mutation, each with a known cost.',
    body: `
<ul>
  <li><code>Box&lt;T&gt;</code> puts a value on the heap with a single owner. It is how you build recursive types like lists and trees, whose size would otherwise be infinite.</li>
  <li><code>Rc&lt;T&gt;</code> (reference counted) gives a value several owners. <code>Rc::clone</code> only increments a counter; the value is freed when the last owner is dropped. Use it within a single thread.</li>
  <li><code>RefCell&lt;T&gt;</code> allows changing a value through a shared reference. The borrow rules still apply, but they are checked while the program runs instead of at compile time.</li>
  <li><code>Arc&lt;T&gt;</code> and <code>Mutex&lt;T&gt;</code> are the thread-safe versions. They come next.</li>
</ul>`,
    perf: 'Each pointer type has a cost you can see in the code: <code>Box</code> is one allocation, <code>Rc</code> adds a counter update per clone, <code>RefCell</code> adds a runtime flag check. You only pay for what you write.',
    starter: `use std::cell::RefCell;
use std::rc::Rc;

#[derive(Debug)]
enum List {
    Node(i32, Box<List>),
    End,
}

fn sum(list: &List) -> i32 {
    match list {
        List::Node(v, rest) => v + sum(rest),
        List::End => 0,
    }
}

fn main() {
    // Box: a recursive type needs a pointer with a known size
    let list = List::Node(1, Box::new(List::Node(2, Box::new(List::Node(3, Box::new(List::End))))));
    println!("sum = {}", sum(&list));

    // Rc + RefCell: several owners sharing one mutable log
    let log = Rc::new(RefCell::new(Vec::new()));
    let writer = Rc::clone(&log);
    writer.borrow_mut().push("GET /index.html");
    log.borrow_mut().push("GET /style.css");
    println!("owners: {}, entries: {:?}", Rc::strong_count(&log), log.borrow());
}
`,
    task: {
      title: 'Add an owner',
      steps: ['Create a third owner, <code>reader</code>, with <code>Rc::clone(&amp;log)</code>.', 'Push <code>"GET /app.js"</code> through <code>reader</code>.', 'The output should show <code>owners: 3</code> and three entries.'],
      checks: [
        { type: 'out', value: 'owners: 3', label: 'Three owners' },
        { type: 'out', value: '"GET /app.js"', label: 'Entry pushed through the new owner' },
      ],
    },
    hints: ['<code>let reader = Rc::clone(&amp;log);</code>', '<code>reader.borrow_mut().push("GET /app.js");</code> before the final <code>println!</code>.'],
    solution: `use std::cell::RefCell;
use std::rc::Rc;

#[derive(Debug)]
enum List {
    Node(i32, Box<List>),
    End,
}

fn sum(list: &List) -> i32 {
    match list {
        List::Node(v, rest) => v + sum(rest),
        List::End => 0,
    }
}

fn main() {
    let list = List::Node(1, Box::new(List::Node(2, Box::new(List::Node(3, Box::new(List::End))))));
    println!("sum = {}", sum(&list));

    let log = Rc::new(RefCell::new(Vec::new()));
    let writer = Rc::clone(&log);
    let reader = Rc::clone(&log);
    writer.borrow_mut().push("GET /index.html");
    log.borrow_mut().push("GET /style.css");
    reader.borrow_mut().push("GET /app.js");
    println!("owners: {}, entries: {:?}", Rc::strong_count(&log), log.borrow());
}
`,
  },
  {
    id: 'concurrency', module: 'm5', num: '5.2', title: 'Fearless concurrency', minutes: 15,
    summary: 'Threads that cannot race on data, enforced at compile time.',
    body: `
<p><code>thread::spawn</code> runs a closure on a new OS thread. That thread might outlive the function that started it, so its closure cannot borrow local variables. It must <strong>own</strong> them, which you ask for with <code>move</code>.</p>
<p>To share data between threads:</p>
<ul>
  <li><code>Arc&lt;T&gt;</code>: an atomically reference-counted pointer, safe to clone across threads.</li>
  <li><code>Mutex&lt;T&gt;</code>: lets one thread at a time reach the value inside. <code>.lock()</code> returns a guard, and the lock is released when the guard is dropped, so you cannot forget to unlock.</li>
</ul>
<p>Two marker traits, <code>Send</code> and <code>Sync</code>, record which types are safe to move or share between threads. Try sharing an <code>Rc</code> across threads and the program will not compile.</p>
<aside class="note">This teaching interpreter runs spawned threads one after another, so output is always in the same order. With the real compiler, threads run in parallel and the order of their prints can change from run to run.</aside>`,
    perf: 'Rust services use every core without data races. Combined with async runtimes like Tokio, one process can handle hundreds of thousands of concurrent connections.',
    starter: `use std::sync::{Arc, Mutex};
use std::thread;

fn main() {
    let requests = vec!["/home", "/about", "/blog"];
    let handle = thread::spawn(|| {
        println!("worker sees {} requests", requests.len());
    });
    handle.join().unwrap();

    // Shared counter: Arc for shared ownership, Mutex for exclusive access
    let hits = Arc::new(Mutex::new(0));
    let mut workers = Vec::new();
    for _ in 0..4 {
        let hits = Arc::clone(&hits);
        workers.push(thread::spawn(move || {
            let mut n = hits.lock().unwrap();
            *n += 1;
        }));
    }
    for w in workers {
        w.join().unwrap();
    }
    println!("total hits: {}", *hits.lock().unwrap());
}
`,
    expectStarter: 'E0373',
    task: {
      title: 'Give the thread ownership',
      steps: ['Read the error and its help line.', 'Make the first closure take ownership of <code>requests</code>.'],
      checks: [
        { type: 'ok', label: 'Compiles and runs' },
        { type: 'out', value: 'worker sees 3 requests', label: 'Worker prints the request count' },
        { type: 'out', value: 'total hits: 4', label: 'Four threads counted' },
      ],
    },
    hints: ['Put <code>move</code> before the closure bars.', '<code>thread::spawn(move || { ... })</code>'],
    solution: `use std::sync::{Arc, Mutex};
use std::thread;

fn main() {
    let requests = vec!["/home", "/about", "/blog"];
    let handle = thread::spawn(move || {
        println!("worker sees {} requests", requests.len());
    });
    handle.join().unwrap();

    let hits = Arc::new(Mutex::new(0));
    let mut workers = Vec::new();
    for _ in 0..4 {
        let hits = Arc::clone(&hits);
        workers.push(thread::spawn(move || {
            let mut n = hits.lock().unwrap();
            *n += 1;
        }));
    }
    for w in workers {
        w.join().unwrap();
    }
    println!("total hits: {}", *hits.lock().unwrap());
}
`,
  },
  {
    id: 'performance', module: 'm5', num: '5.3', title: 'Memory layout and zero-cost', minutes: 12,
    summary: 'See how big things are, and why idiomatic code is also fast code.',
    body: `
<p>Every type in Rust has a size known at compile time, and <code>std::mem::size_of</code> reports it. Run the program and compare the numbers:</p>
<ul>
  <li>A <code>&amp;str</code> is a <em>fat pointer</em>: an address and a length, 16 bytes.</li>
  <li>A <code>String</code> adds a capacity: 24 bytes on the stack, plus the text on the heap.</li>
  <li><code>Option&lt;Box&lt;u64&gt;&gt;</code> is still 8 bytes. A <code>Box</code> can never be null, so <code>None</code> is stored as null and needs no extra tag.</li>
  <li><code>Packet</code> lists its fields in a wasteful order, yet takes 16 bytes rather than 24. The compiler reorders fields to reduce padding.</li>
</ul>
<p>Finally, the loop and the iterator chain compute the same thing. In a release build (<code>cargo build --release</code>) they compile to essentially the same machine code.</p>
<aside class="note">Debug builds keep overflow checks and skip most optimizations. Always measure performance with <code>--release</code>. Timings in this browser interpreter are not representative of compiled Rust.</aside>`,
    perf: 'Knowing your layouts lets you fit more data per cache line. Reordering fields, choosing smaller integer types and avoiding needless heap allocations are the everyday tools of high-performance Rust.',
    starter: `use std::mem::size_of;

#[allow(dead_code)]
struct Packet {
    flag: bool,
    id: u64,
    port: u16,
}

fn main() {
    println!("u8: {} byte", size_of::<u8>());
    println!("u64: {} bytes", size_of::<u64>());
    println!("char: {} bytes", size_of::<char>());
    println!("&str: {} bytes (pointer + length)", size_of::<&str>());
    println!("String: {} bytes (pointer + length + capacity)", size_of::<String>());
    println!("Box<u64>: {} bytes", size_of::<Box<u64>>());
    println!("Option<Box<u64>>: {} bytes", size_of::<Option<Box<u64>>>());
    println!("Packet: {} bytes", size_of::<Packet>());

    // Same result, and the same machine code after optimization
    let data: Vec<u64> = (1..=1000).collect();
    let mut manual = 0;
    for i in 0..data.len() {
        if data[i] % 3 == 0 {
            manual += data[i] * data[i];
        }
    }
    let idiomatic: u64 = data.iter().filter(|&&x| x % 3 == 0).map(|&x| x * x).sum();
    println!("loop: {manual}, iterator: {idiomatic}");
}
`,
    task: {
      title: 'Write it the idiomatic way',
      steps: ['Using an iterator chain, add up the squares of the multiples of 5 in <code>data</code>.', 'Print <code>multiples of 5: 67167500</code>.'],
      checks: [
        { type: 'out', value: 'multiples of 5: 67167500', label: 'Prints 67167500' },
        { type: 'code', value: '.sum', label: 'Uses an iterator sum' },
      ],
    },
    hints: ['Copy the <code>idiomatic</code> line and change <code>3</code> to <code>5</code>.', '<code>let fives: u64 = data.iter().filter(|&amp;&amp;x| x % 5 == 0).map(|&amp;x| x * x).sum();</code>'],
    solution: `use std::mem::size_of;

#[allow(dead_code)]
struct Packet {
    flag: bool,
    id: u64,
    port: u16,
}

fn main() {
    println!("u8: {} byte", size_of::<u8>());
    println!("u64: {} bytes", size_of::<u64>());
    println!("char: {} bytes", size_of::<char>());
    println!("&str: {} bytes (pointer + length)", size_of::<&str>());
    println!("String: {} bytes (pointer + length + capacity)", size_of::<String>());
    println!("Box<u64>: {} bytes", size_of::<Box<u64>>());
    println!("Option<Box<u64>>: {} bytes", size_of::<Option<Box<u64>>>());
    println!("Packet: {} bytes", size_of::<Packet>());

    let data: Vec<u64> = (1..=1000).collect();
    let mut manual = 0;
    for i in 0..data.len() {
        if data[i] % 3 == 0 {
            manual += data[i] * data[i];
        }
    }
    let idiomatic: u64 = data.iter().filter(|&&x| x % 3 == 0).map(|&x| x * x).sum();
    println!("loop: {manual}, iterator: {idiomatic}");

    let fives: u64 = data.iter().filter(|&&x| x % 5 == 0).map(|&x| x * x).sum();
    println!("multiples of 5: {fives}");
}
`,
  },
  // ---------------- Module 6 ----------------
  {
    id: 'capstone', module: 'm6', num: '6.1', title: 'Capstone: a key-value store', minutes: 25,
    summary: 'Combine enums, Result, HashMap and methods into the core of a cache server.',
    body: `
<p>This is the heart of an in-memory key-value store, the kind of service that sits in front of a database and answers in microseconds. It reads one command per line from <strong>standard input</strong>. Open the <em>Input</em> tab under the editor to see and change the commands it receives.</p>
<ol>
  <li><code>parse</code> turns text into a <code>Command</code>, or an error message. Slice patterns like <code>["SET", key, value]</code> match the words.</li>
  <li><code>Store::apply</code> runs a command against the <code>HashMap</code>. It takes <code>&amp;mut self</code> because it changes the data.</li>
  <li><code>main</code> reads lines, parses them and prints each reply.</li>
</ol>
<p>A production version adds a network listener (with Tokio), a wire protocol, expiry times and persistence to disk, but the core stays this small.</p>`,
    perf: 'There is no garbage collector and no runtime type checking here, and each command is one hash lookup. That is why caches, proxies and databases are among the most common things written in Rust.',
    stdin: `SET user:1 ada
SET user:2 grace
GET user:1
COUNT
DEL user:2
GET user:2
INCR visits
INCR visits
FLY away
`,
    starter: `use std::collections::HashMap;
use std::io::{self, BufRead};

#[derive(Debug)]
enum Command {
    Set(String, String),
    Get(String),
    Del(String),
    Count,
}

fn parse(line: &str) -> Result<Command, String> {
    let parts: Vec<&str> = line.split_whitespace().collect();
    match parts.as_slice() {
        ["SET", key, value] => Ok(Command::Set(key.to_string(), value.to_string())),
        ["GET", key] => Ok(Command::Get(key.to_string())),
        ["DEL", key] => Ok(Command::Del(key.to_string())),
        ["COUNT"] => Ok(Command::Count),
        _ => Err(format!("unknown command: {line}")),
    }
}

struct Store {
    data: HashMap<String, String>,
}

impl Store {
    fn new() -> Self {
        Store { data: HashMap::new() }
    }

    fn apply(&mut self, cmd: Command) -> String {
        match cmd {
            Command::Set(k, v) => {
                self.data.insert(k, v);
                "OK".to_string()
            }
            Command::Get(k) => match self.data.get(&k) {
                Some(v) => v.clone(),
                None => "(nil)".to_string(),
            },
            Command::Del(k) => match self.data.remove(&k) {
                Some(_) => "1".to_string(),
                None => "0".to_string(),
            },
            Command::Count => self.data.len().to_string(),
        }
    }
}

fn main() {
    let mut store = Store::new();
    let stdin = io::stdin();
    for line in stdin.lock().lines() {
        let line = line.unwrap();
        if line.trim().is_empty() {
            continue;
        }
        match parse(&line) {
            Ok(cmd) => println!("> {line}\\n{}", store.apply(cmd)),
            Err(e) => println!("> {line}\\nERR {e}"),
        }
    }
}
`,
    task: {
      title: 'Add an INCR command',
      steps: ['Add a variant <code>Incr(String)</code> to <code>Command</code>.', 'Parse <code>INCR key</code> into it.', 'In <code>apply</code>, read the current value as an <code>i64</code> (missing counts as 0), add 1, store it back and return the new number.', 'The two <code>INCR visits</code> lines should reply <code>1</code> and then <code>2</code>.'],
      checks: [
        { type: 'code', value: 'Incr', label: 'Adds an Incr variant' },
        { type: 'out', value: '> INCR visits\n1\n> INCR visits\n2', label: 'INCR replies 1, then 2' },
        { type: 'out', value: 'ERR unknown command: FLY away', label: 'Unknown commands still report an error' },
      ],
    },
    hints: ['The parse arm: <code>["INCR", key] =&gt; Ok(Command::Incr(key.to_string())),</code>', 'Read the old value: <code>let current: i64 = self.data.get(&amp;k).and_then(|v| v.parse().ok()).unwrap_or(0);</code>', 'Then <code>let next = current + 1; self.data.insert(k, next.to_string()); next.to_string()</code>'],
    solution: `use std::collections::HashMap;
use std::io::{self, BufRead};

#[derive(Debug)]
enum Command {
    Set(String, String),
    Get(String),
    Del(String),
    Incr(String),
    Count,
}

fn parse(line: &str) -> Result<Command, String> {
    let parts: Vec<&str> = line.split_whitespace().collect();
    match parts.as_slice() {
        ["SET", key, value] => Ok(Command::Set(key.to_string(), value.to_string())),
        ["GET", key] => Ok(Command::Get(key.to_string())),
        ["DEL", key] => Ok(Command::Del(key.to_string())),
        ["INCR", key] => Ok(Command::Incr(key.to_string())),
        ["COUNT"] => Ok(Command::Count),
        _ => Err(format!("unknown command: {line}")),
    }
}

struct Store {
    data: HashMap<String, String>,
}

impl Store {
    fn new() -> Self {
        Store { data: HashMap::new() }
    }

    fn apply(&mut self, cmd: Command) -> String {
        match cmd {
            Command::Set(k, v) => {
                self.data.insert(k, v);
                "OK".to_string()
            }
            Command::Get(k) => match self.data.get(&k) {
                Some(v) => v.clone(),
                None => "(nil)".to_string(),
            },
            Command::Del(k) => match self.data.remove(&k) {
                Some(_) => "1".to_string(),
                None => "0".to_string(),
            },
            Command::Incr(k) => {
                let current: i64 = self.data.get(&k).and_then(|v| v.parse().ok()).unwrap_or(0);
                let next = current + 1;
                self.data.insert(k, next.to_string());
                next.to_string()
            }
            Command::Count => self.data.len().to_string(),
        }
    }
}

fn main() {
    let mut store = Store::new();
    let stdin = io::stdin();
    for line in stdin.lock().lines() {
        let line = line.unwrap();
        if line.trim().is_empty() {
            continue;
        }
        match parse(&line) {
            Ok(cmd) => println!("> {line}\\n{}", store.apply(cmd)),
            Err(e) => println!("> {line}\\nERR {e}"),
        }
    }
}
`,
  },
  {
    id: 'real-world', module: 'm6', num: '6.2', title: 'How Rust runs fast services', minutes: 15,
    summary: 'Where Rust is used in production, how a web service is put together, and where to go next.',
    body: `
<p>The ideas from this course are exactly what large companies rely on:</p>
<ul class="cases">
  <li><strong>Discord</strong> rewrote its "Read States" service from Go to Rust to get rid of latency spikes caused by garbage collection.</li>
  <li><strong>Cloudflare</strong> built Pingora, the Rust HTTP proxy that replaced NGINX for much of its traffic, and reported large reductions in CPU and memory use.</li>
  <li><strong>Amazon Web Services</strong> runs AWS Lambda and Fargate on Firecracker, a virtual machine monitor written in Rust.</li>
  <li><strong>Figma</strong> rewrote its multiplayer syncing server in Rust for performance, and <strong>Dropbox</strong> rewrote its file sync engine in Rust.</li>
  <li><strong>Linux</strong> accepts Rust for kernel drivers, and <strong>Android</strong> writes new low-level code in Rust to reduce memory-safety bugs.</li>
</ul>
<h3>Anatomy of a Rust web service</h3>
<ul>
  <li><strong>Tokio</strong>: an async runtime that schedules many lightweight tasks across all CPU cores.</li>
  <li><strong>hyper</strong> and <strong>axum</strong>: HTTP and routing on top of Tokio.</li>
  <li><strong>serde</strong>: turns JSON into your structs, using the code-generating derive macros you met with <code>#[derive(Debug)]</code>.</li>
  <li><strong>sqlx</strong> or <strong>diesel</strong>: database access, with queries checked at compile time.</li>
</ul>
<p>The code on the right is the routing logic such a server runs for every request, as plain Rust you can run here. A real axum version looks like this. It needs external crates and a network, so use it in a local project created with <code>cargo new</code>:</p>
<pre class="copyable"><code>// Cargo.toml: tokio = { version = "1", features = ["full"] }, axum = "0.7"
use axum::{routing::get, Router};

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/", get(|| async { "home" }))
        .route("/health", get(|| async { "ok" }));
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}</code></pre>
<h3>Where to go next</h3>
<ul>
  <li>Install Rust with <code>rustup</code>, then <code>cargo new myapp</code> and <code>cargo run</code>.</li>
  <li>Read <em>The Rust Programming Language</em> (the free official book) and work through <em>Rustlings</em> exercises.</li>
  <li>Build something real: a command-line tool, then a small axum API.</li>
</ul>`,
    perf: 'Build for production with <code>cargo build --release</code>. Settings like <code>lto = true</code> and <code>codegen-units = 1</code> in <code>Cargo.toml</code> trade longer compile times for faster binaries.',
    starter: `#[derive(Debug)]
struct Response {
    status: u16,
    body: String,
}

fn route(method: &str, path: &str) -> Response {
    let segments: Vec<&str> = path.trim_matches('/').split('/').collect();
    match (method, segments.as_slice()) {
        ("GET", [""]) => Response { status: 200, body: "home".into() },
        ("GET", ["users", id]) => match id.parse::<u32>() {
            Ok(n) => Response { status: 200, body: format!("user {n}") },
            Err(_) => Response { status: 400, body: "bad id".into() },
        },
        ("POST", ["users"]) => Response { status: 201, body: "created".into() },
        _ => Response { status: 404, body: "not found".into() },
    }
}

fn main() {
    let requests = [
        ("GET", "/"),
        ("GET", "/users/42"),
        ("GET", "/users/abc"),
        ("POST", "/users"),
        ("DELETE", "/users/1"),
        ("GET", "/health"),
    ];
    for (method, path) in requests {
        let res = route(method, path);
        println!("{method} {path} -> {} {}", res.status, res.body);
    }
}
`,
    task: {
      title: 'Add a health check',
      steps: ['Load balancers poll <code>/health</code> to know a server is alive. Add a route for <code>GET /health</code>.', 'It should return status <code>200</code> with body <code>ok</code>.'],
      checks: [
        { type: 'out', value: 'GET /health -> 200 ok', label: 'GET /health returns 200 ok' },
        { type: 'out', value: 'DELETE /users/1 -> 404 not found', label: 'Other routes still work' },
      ],
    },
    hints: ['Add an arm before the <code>_</code> catch-all.', '<code>("GET", ["health"]) =&gt; Response { status: 200, body: "ok".into() },</code>'],
    solution: `#[derive(Debug)]
struct Response {
    status: u16,
    body: String,
}

fn route(method: &str, path: &str) -> Response {
    let segments: Vec<&str> = path.trim_matches('/').split('/').collect();
    match (method, segments.as_slice()) {
        ("GET", [""]) => Response { status: 200, body: "home".into() },
        ("GET", ["health"]) => Response { status: 200, body: "ok".into() },
        ("GET", ["users", id]) => match id.parse::<u32>() {
            Ok(n) => Response { status: 200, body: format!("user {n}") },
            Err(_) => Response { status: 400, body: "bad id".into() },
        },
        ("POST", ["users"]) => Response { status: 201, body: "created".into() },
        _ => Response { status: 404, body: "not found".into() },
    }
}

fn main() {
    let requests = [
        ("GET", "/"),
        ("GET", "/users/42"),
        ("GET", "/users/abc"),
        ("POST", "/users"),
        ("DELETE", "/users/1"),
        ("GET", "/health"),
    ];
    for (method, path) in requests {
        let res = route(method, path);
        println!("{method} {path} -> {} {}", res.status, res.body);
    }
}
`,
  },
];

const SANDBOX_CODE = `// Sandbox: write any Rust you like.
use std::collections::BTreeMap;

#[derive(Debug, Clone, Copy, PartialEq)]
enum Level { Low, Mid, High }

fn classify(ms: u32) -> Level {
    match ms {
        0..=49 => Level::Low,
        50..=199 => Level::Mid,
        _ => Level::High,
    }
}

fn main() {
    let latencies = [12, 48, 51, 230, 97, 15, 410, 63];
    let mut buckets: BTreeMap<String, Vec<u32>> = BTreeMap::new();
    for &ms in latencies.iter() {
        let key = format!("{:?}", classify(ms));
        buckets.entry(key).or_default().push(ms);
    }
    for (level, values) in &buckets {
        let avg = values.iter().sum::<u32>() as f64 / values.len() as f64;
        println!("{level:>4}: {:?} avg {avg:.1} ms", values);
    }
    let p_high = latencies.iter().filter(|&&ms| classify(ms) == Level::High).count();
    println!("{p_high} of {} requests were slow", latencies.len());
}
`;

if (typeof module !== 'undefined') module.exports = { MODULES, LESSONS, SANDBOX_CODE };
