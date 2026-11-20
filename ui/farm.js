// ---------- Drone Farm: a programming minigame ----------
// The farm simulation itself is Rust (see preludeFor). It is appended to the player's code as `mod farm`, so the same
// program runs in the teaching interpreter, in rustc on this computer, or in any Cargo project. The simulation prints
// one trace line per drone action (prefixed with TRACE); the UI replays those lines on the board.
const FARM = (function () {
  'use strict';

  // The rules. The Rust prelude and the board replay are both generated from this table.
  const CROPS = [
    { name: 'Wheat', ch: 'W', grow: 8, yield: 1, cost: null },
    { name: 'Beet', ch: 'B', grow: 16, yield: 2, cost: { crop: 0, n: 1 } },
    { name: 'Melon', ch: 'M', grow: 30, yield: 5, cost: { crop: 1, n: 2 }, rotAfter: 12 },
  ];
  const COST = { step: 1, till: 2, plant: 1, harvest: 1, wait: 1 };
  const STALL = 50000; // free calls in a row (scan, look, ...) before the drone is declared stuck
  const TRACE = '@@';

  // ---------- levels ----------
  // map: one string per row. '.' wild ground, '_' tilled soil, '#' rock, W/B/M a ripe crop.
  const LEVELS = [
    {
      id: 'farm-1', num: 'F1', title: 'First light', concept: 'Loops and method calls',
      map: ['WWW', 'WWW', 'WWW'], budget: 40, par: 17, goal: { Wheat: 9 },
      summary: 'A field of ripe wheat and a drone that does exactly what your Rust code says.',
      body: `
<p>Your drone sits in the top-left corner of a 3 × 3 field of ripe wheat. You control it by writing a function, <code>fn run(d: &amp;mut Drone)</code>. The farm calls it once and the drone performs each method call in order.</p>
<p><code>d</code> is a <em>mutable reference</em> to the drone: <code>&amp;mut</code> lets <code>run</code> change the drone (move it, fill its barn) without taking ownership of it. Methods that act, such as <code>d.harvest()</code> and <code>d.step(Dir::East)</code>, cost ticks. The level ends as soon as the goal is met.</p>
<p>Repeating yourself nine times works, but a <code>for</code> loop says it once: <code>for _ in 0..3 { ... }</code> runs its body three times. The <code>_</code> means you do not need the counter.</p>`,
      starter: `use farm::*;

// The drone starts in the top-left corner of a 3 x 3 field of ripe wheat.
// Right now it harvests one tile and steps east once. Harvest all nine.
fn run(d: &mut Drone) {
    d.harvest();
    d.step(Dir::East);
}
`,
      solution: `use farm::*;

fn run(d: &mut Drone) {
    for row in 0..3 {
        for col in 0..3 {
            d.harvest();
            if col < 2 {
                // snake: east on even rows, west on odd rows
                if row % 2 == 0 { d.step(Dir::East); } else { d.step(Dir::West); }
            }
        }
        d.step(Dir::South);
    }
}
`,
      hints: ['Put the harvest and the step inside <code>for _ in 0..3 { }</code> to clear the first row.', 'At the end of a row, step <code>Dir::South</code>, then walk back <code>Dir::West</code>. A nested loop with <code>if row % 2 == 0</code> picks the direction.'],
      checks: [{ type: 'code', value: 're:\\bfor\\b', label: 'Uses a for loop' }],
    },
    {
      id: 'farm-2', num: 'F2', title: 'Edge to edge', concept: 'bool results and while loops',
      map: ['WWWWWW', 'WWWWWW', 'WWWWWW', 'WWWWWW', 'WWWWWW', 'WWWWWW'], budget: 120, par: 71, goal: { Wheat: 36 },
      summary: 'A bigger field. Let the drone tell you where the edge is instead of counting tiles yourself.',
      body: `
<p>This field is 6 × 6. You could change every <code>3</code> to <code>6</code>, but code that hard-codes sizes breaks the moment the field changes. Two better tools:</p>
<ul>
  <li><code>d.size()</code> returns the width of the field as a <code>usize</code>, Rust's type for sizes and indexes.</li>
  <li><code>d.step(dir)</code> returns a <code>bool</code>: <code>true</code> if the drone moved, <code>false</code> if an edge (or a rock) was in the way. A blocked step still costs a tick.</li>
</ul>
<p>A <code>while</code> loop runs as long as its condition is <code>true</code>, so <code>while d.step(Dir::East) { d.harvest(); }</code> harvests to the end of a row with no counting at all. A direction is a value like any other: keep it in a <code>let mut</code> variable and flip it each row.</p>`,
      starter: `use farm::*;

fn run(d: &mut Drone) {
    // Your 3 x 3 solution only clears part of this field.
    for row in 0..3 {
        for col in 0..3 {
            d.harvest();
            if col < 2 {
                if row % 2 == 0 { d.step(Dir::East); } else { d.step(Dir::West); }
            }
        }
        d.step(Dir::South);
    }
}
`,
      solution: `use farm::*;

fn run(d: &mut Drone) {
    let n = d.size();
    let mut dir = Dir::East;
    for row in 0..n {
        d.harvest();
        for _ in 1..n {
            d.step(dir);
            d.harvest();
        }
        if row + 1 < n { d.step(Dir::South); }
        dir = if dir == Dir::East { Dir::West } else { Dir::East };
    }
}
`,
      hints: ['Replace the 3s with <code>let n = d.size();</code> and use <code>0..n</code>.', 'Keep the direction in a variable: <code>let mut dir = Dir::East;</code> and after each row, <code>dir = if dir == Dir::East { Dir::West } else { Dir::East };</code>. Par needs one harvest per tile and one step between tiles, with no wasted bumps.'],
      checks: [{ type: 'code', value: 'size()', label: 'Asks the drone for the field size' }],
    },
    {
      id: 'farm-3', num: 'F3', title: 'Sow and reap', concept: 'Enums and match',
      map: ['....', '....', '....', '....'], budget: 400, par: 175, goal: { Wheat: 32 },
      summary: 'Bare ground. Till it, plant wheat, and come back when it is ripe.',
      body: `
<p>Nothing grows here yet. Each tile needs three things before it pays: <code>d.till()</code> turns wild ground into soil (2 ticks), <code>d.plant(Crop::Wheat)</code> sows it (1 tick), and eight ticks later the wheat is ripe. Harvesting leaves tilled soil behind, ready to replant.</p>
<p><code>d.scan()</code> tells you what is under the drone, for free. It returns a <code>Tile</code>, an <em>enum</em>: a type that is exactly one of a fixed set of variants, some of which carry data.</p>
<pre><code>pub enum Tile { Wild, Tilled, Rock, Growing(Crop), Ripe(Crop), Rotten(Crop) }</code></pre>
<p><code>match</code> handles each variant. The compiler checks that you covered every one, so a new kind of tile can never slip through unhandled. Use <code>_</code> for "anything else".</p>
<p><code>plant</code> returns a <code>Result</code>, which might be an error (more on that next level). <code>rustc</code> warns if you ignore one; write <code>let _ = d.plant(Crop::Wheat);</code> to say you meant to.</p>`,
      starter: `use farm::*;

fn run(d: &mut Drone) {
    // Walk the field forever, one tile at a time.
    loop {
        tend(d);
        if !d.step(Dir::East) {
            // end of a row: go down one, or back to the top
            if !d.step(Dir::South) {
                for _ in 1..d.size() { d.step(Dir::North); }
            }
            for _ in 1..d.size() { d.step(Dir::West); }
        }
    }
}

// Look at the tile under the drone and do the right thing.
fn tend(d: &mut Drone) {
    match d.scan() {
        Tile::Wild => {
            // TODO: till the ground and plant wheat
        }
        _ => {}
    }
}
`,
      solution: `use farm::*;

fn run(d: &mut Drone) {
    let mut dir = Dir::East;
    loop {
        tend(d);
        if !d.step(dir) {
            // end of a row: snake down, or turn around at the bottom
            if !d.step(Dir::South) {
                for _ in 1..d.size() { d.step(Dir::North); }
            }
            dir = if dir == Dir::East { Dir::West } else { Dir::East };
        }
    }
}

fn tend(d: &mut Drone) {
    match d.scan() {
        Tile::Wild => {
            d.till();
            let _ = d.plant(Crop::Wheat);
        }
        Tile::Tilled => {
            let _ = d.plant(Crop::Wheat);
        }
        Tile::Ripe(_) => {
            d.harvest();
            let _ = d.plant(Crop::Wheat);
        }
        _ => {}
    }
}
`,
      hints: ['In the <code>Tile::Wild</code> arm, call <code>d.till();</code> and then <code>let _ = d.plant(Crop::Wheat);</code>.', 'Add an arm for <code>Tile::Ripe(_)</code> that harvests and replants. Walking back to the west edge every row wastes ticks: snake instead, like the last level.'],
      checks: [{ type: 'code', value: 're:Tile::Ripe', label: 'Matches on Tile::Ripe' }],
    },
    {
      id: 'farm-4', num: 'F4', title: 'Seed money', concept: 'Result and error handling',
      map: ['.....', '.....', '.....', '.....', '.....'], budget: 700, par: 277, goal: { Beet: 60 },
      summary: 'Beets pay better, but every beet seed costs a wheat. Handle the case where you cannot afford one.',
      body: `
<p>Planting a beet takes 1 wheat from the barn. Beets take 16 ticks to ripen and yield 2, plus 1 for every wheat plant directly north, east, south or west of them when you harvest. Mixing the two crops pays off.</p>
<p><code>d.plant(crop)</code> returns <code>Result&lt;(), FarmError&gt;</code>. <code>Ok(())</code> means it worked; <code>Err(e)</code> says why not:</p>
<pre><code>pub enum FarmError { NotTilled, Occupied, NoSeeds }</code></pre>
<p>Errors in Rust are ordinary values, so you decide what happens next with <code>match</code> or <code>if let</code>. Here, a beet that fails with <code>NoSeeds</code> should become a wheat instead:</p>
<pre><code>if let Err(FarmError::NoSeeds) = d.plant(Crop::Beet) {
    let _ = d.plant(Crop::Wheat);
}</code></pre>
<p><code>d.count(Crop::Wheat)</code> tells you what is in the barn, for free.</p>`,
      starter: `use farm::*;

fn run(d: &mut Drone) {
    let mut dir = Dir::East;
    loop {
        tend(d);
        if !d.step(dir) {
            if !d.step(Dir::South) {
                for _ in 1..d.size() { d.step(Dir::North); }
            }
            dir = if dir == Dir::East { Dir::West } else { Dir::East };
        }
    }
}

fn tend(d: &mut Drone) {
    match d.scan() {
        Tile::Wild => {
            d.till();
            sow(d);
        }
        Tile::Ripe(_) => {
            d.harvest();
            sow(d);
        }
        _ => {}
    }
}

// Plant a beet if you can afford one.
fn sow(d: &mut Drone) {
    // This fails with NoSeeds while the barn has no wheat, and leaves the tile empty.
    let _ = d.plant(Crop::Beet);
}
`,
      solution: `use farm::*;

fn run(d: &mut Drone) {
    let mut dir = Dir::East;
    loop {
        tend(d);
        if !d.step(dir) {
            if !d.step(Dir::South) {
                for _ in 1..d.size() { d.step(Dir::North); }
            }
            dir = if dir == Dir::East { Dir::West } else { Dir::East };
        }
    }
}

fn tend(d: &mut Drone) {
    match d.scan() {
        Tile::Wild => {
            d.till();
            sow(d);
        }
        Tile::Tilled => sow(d),
        Tile::Ripe(_) => {
            d.harvest();
            sow(d);
        }
        _ => {}
    }
}

// Checkerboard: beets on one colour, wheat on the other, so every beet has wheat neighbours.
fn sow(d: &mut Drone) {
    let beet_square = (d.x() + d.y()) % 2 == 0;
    if beet_square {
        match d.plant(Crop::Beet) {
            Ok(()) => {}
            Err(FarmError::NoSeeds) => { let _ = d.plant(Crop::Wheat); }
            Err(_) => {}
        }
    } else {
        let _ = d.plant(Crop::Wheat);
    }
}
`,
      hints: ['Match on the result: <code>match d.plant(Crop::Beet) { Ok(()) => {} Err(FarmError::NoSeeds) => { let _ = d.plant(Crop::Wheat); } Err(_) => {} }</code>.', 'For par, plant in a checkerboard: beets where <code>(d.x() + d.y()) % 2 == 0</code> and wheat elsewhere. Each beet then has up to four wheat neighbours.'],
      checks: [{ type: 'code', value: 're:FarmError::NoSeeds', label: 'Handles FarmError::NoSeeds' }],
    },
    {
      id: 'farm-5', num: 'F5', title: 'Scattered melons', concept: 'Functions, tuples and Vec',
      map: ['.......', '..M....', '......M', '...M...', 'M......', '.....M.', '.M.....'], budget: 160, par: 28, goal: { Melon: 30 },
      summary: 'Six ripe melons are scattered across a field. Find them and fly straight to each one.',
      body: `
<p>Sweeping every tile is slow when only six of them matter. <code>d.look(x, y)</code> reads any tile for free, so you can find the melons first and then plan a route.</p>
<p>Collect their positions in a <code>Vec&lt;(usize, usize)&gt;</code>: a growable list of <em>tuples</em>. Then write a helper, <code>fn go_to(d: &amp;mut Drone, x: usize, y: usize)</code>, that steps until <code>d.x() == x</code> and <code>d.y() == y</code>. Functions are how Rust programs stay readable as they grow.</p>
<p>Coordinates start at (0, 0) in the top-left corner. <code>x</code> grows to the east and <code>y</code> grows to the south.</p>
<p>Visiting melons in the order you found them works. For par, always fly to the <em>nearest</em> remaining melon. Iterators help: <code>spots.iter().enumerate().min_by_key(|(_, p)| distance(...))</code>.</p>`,
      starter: `use farm::*;

fn run(d: &mut Drone) {
    let n = d.size();
    let mut spots: Vec<(usize, usize)> = Vec::new();
    for y in 0..n {
        for x in 0..n {
            if d.look(x, y) == Tile::Ripe(Crop::Melon) {
                spots.push((x, y));
            }
        }
    }
    println!("found {} melons: {:?}", spots.len(), spots);

    for (x, y) in spots {
        go_to(d, x, y);
        d.harvest();
    }
}

// Fly to (x, y), one step at a time.
fn go_to(d: &mut Drone, x: usize, y: usize) {
    // TODO: step east or west until d.x() == x, then north or south until d.y() == y
}
`,
      solution: `use farm::*;

fn run(d: &mut Drone) {
    let n = d.size();
    let mut spots: Vec<(usize, usize)> = Vec::new();
    for y in 0..n {
        for x in 0..n {
            if d.look(x, y) == Tile::Ripe(Crop::Melon) {
                spots.push((x, y));
            }
        }
    }
    // greedy route: always fly to the nearest melon left
    while !spots.is_empty() {
        let (i, _) = spots
            .iter()
            .enumerate()
            .min_by_key(|&(_, &(x, y))| distance(d.x(), d.y(), x, y))
            .unwrap();
        let (x, y) = spots.remove(i);
        go_to(d, x, y);
        d.harvest();
    }
}

fn distance(ax: usize, ay: usize, bx: usize, by: usize) -> usize {
    ax.abs_diff(bx) + ay.abs_diff(by)
}

fn go_to(d: &mut Drone, x: usize, y: usize) {
    while d.x() < x { d.step(Dir::East); }
    while d.x() > x { d.step(Dir::West); }
    while d.y() < y { d.step(Dir::South); }
    while d.y() > y { d.step(Dir::North); }
}
`,
      hints: ['Four small loops do it: <code>while d.x() &lt; x { d.step(Dir::East); }</code>, then the same for west, south and north.', 'For par, pick the nearest melon each time. <code>a.abs_diff(b)</code> gives the distance between two <code>usize</code> values without underflow.'],
      checks: [{ type: 'code', value: 're:fn go_to', label: 'Uses a go_to helper' }],
    },
    {
      id: 'farm-6', num: 'F6', title: 'Rocky ground', concept: 'VecDeque and breadth-first search',
      map: ['...#....', '.#.#.##.', '.#...#M.', '.####.#.', '...M#...', '##.##.#.', 'M#...#..', '...#..#M'], budget: 220, par: 43, goal: { Melon: 15 },
      summary: 'Rocks block the straight path. Teach the drone to find its own way around them.',
      body: `
<p>Your <code>go_to</code> from the last level walks into rocks: a blocked <code>step</code> returns <code>false</code>, costs a tick, and the drone stays put. You need a path that goes <em>around</em>.</p>
<p><strong>Breadth-first search</strong> finds the shortest path on a grid. Start from the drone's tile, visit its open neighbours, then their neighbours, and so on, remembering for each tile which direction you came from. A <code>VecDeque</code> (a double-ended queue from <code>std::collections</code>) holds the tiles waiting to be visited: <code>push_back</code> to add, <code>pop_front</code> to take the oldest.</p>
<p>When the search reaches the target, walk the remembered directions backwards to recover the path, then <code>reverse()</code> it and step along it.</p>
<p><code>Dir</code> derives <code>Copy</code>, so you can store directions in a <code>Vec&lt;Option&lt;Dir&gt;&gt;</code> and pass them around freely. <code>Dir::ALL</code> lists all four.</p>`,
      starter: `use farm::*;
use std::collections::VecDeque;

fn run(d: &mut Drone) {
    let n = d.size();
    let mut spots = Vec::new();
    for y in 0..n {
        for x in 0..n {
            if d.look(x, y) == Tile::Ripe(Crop::Melon) { spots.push((x, y)); }
        }
    }
    for (x, y) in spots {
        for dir in path_to(d, x, y) {
            d.step(dir);
        }
        d.harvest();
    }
}

// The directions to step, in order, from the drone to (tx, ty).
fn path_to(d: &Drone, tx: usize, ty: usize) -> Vec<Dir> {
    let n = d.size();
    // came_from[y * n + x] = the direction we stepped to reach (x, y)
    let mut came_from: Vec<Option<Dir>> = vec![None; n * n];
    let mut seen = vec![false; n * n];
    let mut queue = VecDeque::new();
    queue.push_back((d.x(), d.y()));
    seen[d.y() * n + d.x()] = true;

    while let Some((x, y)) = queue.pop_front() {
        if (x, y) == (tx, ty) { break; }
        for dir in Dir::ALL {
            // TODO: work out the neighbour (nx, ny) in direction dir.
            // Skip it if it is off the field, a rock, or already seen.
            // Otherwise mark it seen, record came_from, and push it on the queue.
        }
    }

    // walk back from the target to the drone
    let mut path = Vec::new();
    let (mut x, mut y) = (tx, ty);
    while let Some(dir) = came_from[y * n + x] {
        path.push(dir);
        match dir {
            Dir::North => y += 1,
            Dir::South => y -= 1,
            Dir::East => x -= 1,
            Dir::West => x += 1,
        }
    }
    path.reverse();
    path
}
`,
      solution: `use farm::*;
use std::collections::VecDeque;

fn run(d: &mut Drone) {
    let n = d.size();
    let mut spots = Vec::new();
    for y in 0..n {
        for x in 0..n {
            if d.look(x, y) == Tile::Ripe(Crop::Melon) { spots.push((x, y)); }
        }
    }
    // nearest melon first, measured by real path length
    while !spots.is_empty() {
        let mut best = 0;
        let mut best_path = path_to(d, spots[0].0, spots[0].1);
        for i in 1..spots.len() {
            let p = path_to(d, spots[i].0, spots[i].1);
            if p.len() < best_path.len() { best = i; best_path = p; }
        }
        spots.remove(best);
        for dir in best_path { d.step(dir); }
        d.harvest();
    }
}

fn path_to(d: &Drone, tx: usize, ty: usize) -> Vec<Dir> {
    let n = d.size();
    let mut came_from: Vec<Option<Dir>> = vec![None; n * n];
    let mut seen = vec![false; n * n];
    let mut queue = VecDeque::new();
    queue.push_back((d.x(), d.y()));
    seen[d.y() * n + d.x()] = true;

    while let Some((x, y)) = queue.pop_front() {
        if (x, y) == (tx, ty) { break; }
        for dir in Dir::ALL {
            let (nx, ny) = match dir {
                Dir::North if y > 0 => (x, y - 1),
                Dir::South if y + 1 < n => (x, y + 1),
                Dir::West if x > 0 => (x - 1, y),
                Dir::East if x + 1 < n => (x + 1, y),
                _ => continue,
            };
            let i = ny * n + nx;
            if seen[i] || d.look(nx, ny) == Tile::Rock { continue; }
            seen[i] = true;
            came_from[i] = Some(dir);
            queue.push_back((nx, ny));
        }
    }

    let mut path = Vec::new();
    let (mut x, mut y) = (tx, ty);
    while let Some(dir) = came_from[y * n + x] {
        path.push(dir);
        match dir {
            Dir::North => y += 1,
            Dir::South => y -= 1,
            Dir::East => x -= 1,
            Dir::West => x += 1,
        }
    }
    path.reverse();
    path
}
`,
      hints: ['A <code>match</code> with guards computes the neighbour and skips the edges: <code>Dir::North if y &gt; 0 =&gt; (x, y - 1),</code> … <code>_ =&gt; continue,</code>', 'Then <code>let i = ny * n + nx;</code> skip it if <code>seen[i]</code> or <code>d.look(nx, ny) == Tile::Rock</code>, otherwise set <code>seen[i] = true; came_from[i] = Some(dir); queue.push_back((nx, ny));</code>. For par, pick the melon with the shortest path each time.'],
      checks: [{ type: 'code', value: 'VecDeque', label: 'Uses a VecDeque' }],
    },
    {
      id: 'farm-7', num: 'F7', title: 'Melon season', concept: 'Structs and planning',
      map: ['......', '......', '......', '......', '......', '......'], budget: 2000, par: 1031, goal: { Melon: 100 }, rot: true,
      summary: 'The whole chain: wheat buys beets, beets buy melons. Ripe melons rot if you leave them.',
      body: `
<p>One melon seed costs 2 beets, one beet seed costs 1 wheat, and you start with an empty barn. Melons take 30 ticks to ripen and yield 5, but this season they <strong>rot 12 ticks after ripening</strong> and then yield nothing.</p>
<p>There is no single right answer. Some ideas:</p>
<ul>
  <li>Give the program a memory. A <code>struct Plan { ... }</code> with an <code>impl</code> block can track when each tile will be ripe: <code>d.tick()</code> is the current tick and <code>crop.grow_ticks()</code> how long a crop takes.</li>
  <li>Decide what to plant from what is in the barn: <code>d.count(Crop::Beet)</code>, <code>d.count(Crop::Wheat)</code>.</li>
  <li>Beets next to wheat yield more, which buys melons sooner.</li>
  <li><code>d.wait()</code> spends one tick doing nothing, if you would rather wait than walk.</li>
</ul>
<p>Print your own progress with <code>println!</code>: it shows up in the replay log at the tick it was printed.</p>`,
      starter: `use farm::*;

fn run(d: &mut Drone) {
    let mut dir = Dir::East;
    loop {
        tend(d);
        if !d.step(dir) {
            if !d.step(Dir::South) {
                for _ in 1..d.size() { d.step(Dir::North); }
            }
            dir = if dir == Dir::East { Dir::West } else { Dir::East };
        }
    }
}

fn tend(d: &mut Drone) {
    match d.scan() {
        Tile::Wild => { d.till(); sow(d); }
        Tile::Tilled => sow(d),
        Tile::Ripe(_) | Tile::Rotten(_) => { d.harvest(); sow(d); }
        _ => {}
    }
}

// Buy the best seed the barn can afford.
fn sow(d: &mut Drone) {
    for crop in [Crop::Melon, Crop::Beet, Crop::Wheat] {
        if d.plant(crop).is_ok() { return; }
    }
}
`,
      solution: `use farm::*;

// What the drone remembers about the field.
struct Plan {
    n: usize,
    // the tick at which each tile is next worth a visit
    ready_at: Vec<u32>,
}

impl Plan {
    fn new(n: usize) -> Plan {
        Plan { n, ready_at: vec![0; n * n] }
    }

    // The tile the drone can act on soonest, counting the walk there.
    fn next(&self, d: &Drone) -> (usize, usize) {
        let mut best = (0, 0);
        let mut best_t = u32::MAX;
        for y in 0..self.n {
            for x in 0..self.n {
                let walk = (d.x().abs_diff(x) + d.y().abs_diff(y)) as u32;
                let t = self.ready_at[y * self.n + x].max(d.tick() + walk);
                if t < best_t {
                    best_t = t;
                    best = (x, y);
                }
            }
        }
        best
    }
}

fn run(d: &mut Drone) {
    let n = d.size();
    let mut plan = Plan::new(n);
    loop {
        let (x, y) = plan.next(d);
        go_to(d, x, y);
        let i = y * n + x;
        while d.tick() < plan.ready_at[i] {
            d.wait();
        }
        match d.scan() {
            Tile::Wild => d.till(),
            Tile::Ripe(_) | Tile::Rotten(_) => { d.harvest(); }
            _ => {}
        }
        plan.ready_at[i] = d.tick() + sow(d);
    }
}

// Plant the best seed the barn can afford. Returns how long it takes to grow.
fn sow(d: &mut Drone) -> u32 {
    for crop in [Crop::Melon, Crop::Beet, Crop::Wheat] {
        if d.plant(crop).is_ok() {
            return crop.grow_ticks();
        }
    }
    0
}

fn go_to(d: &mut Drone, x: usize, y: usize) {
    while d.x() < x { d.step(Dir::East); }
    while d.x() > x { d.step(Dir::West); }
    while d.y() < y { d.step(Dir::South); }
    while d.y() > y { d.step(Dir::North); }
}
`,
      hints: ['The starter already buys melons once it can. Watch the replay: the melons ripen while the drone is busy elsewhere, and rot before it comes back.', 'Remember when each tile will be ready: a struct holding a <code>Vec&lt;u32&gt;</code> of ticks, set to <code>d.tick() + crop.grow_ticks()</code> when you plant. Then fly to whichever tile is ready soonest (counting the walk there) and <code>d.wait()</code> if you arrive early.'],
      checks: [],
    },
  ];

  // ---------- the Rust side ----------
  function rustStr(s) { return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'; }
  function preludeFor(level) {
    const goal = CROPS.map((c) => level.goal[c.name] || 0);
    const cropArms = (f) => CROPS.map((c, i) => 'Crop::' + c.name + ' => ' + f(c, i)).join(', ');
    return `
// ------------------------------------------------------------------
// The farm. Oxide Workbench adds this module and main() after your code
// when you run a Drone Farm level, so the program below is complete Rust:
// paste all of it into src/main.rs of a Cargo project and it runs there too.
// Level: ${level.num} ${level.title}
// ------------------------------------------------------------------
#[allow(dead_code)]
mod farm {
    use std::cell::Cell;

    const SIZE: usize = ${level.map.length};
    const BUDGET: u32 = ${level.budget};
    const MAP: &str = ${rustStr(level.map.join(''))};
    const GOAL: [u32; ${CROPS.length}] = [${goal.join(', ')}];
    const ROT: bool = ${level.rot ? 'true' : 'false'};

    /// A direction the drone can step in. North is up (y gets smaller).
    #[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
    pub enum Dir { North, East, South, West }

    impl Dir {
        pub const ALL: [Dir; 4] = [Dir::North, Dir::East, Dir::South, Dir::West];
    }

    #[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
    pub enum Crop { ${CROPS.map((c) => c.name).join(', ')} }

    impl Crop {
        /// Ticks from planting until this crop is ripe.
        pub fn grow_ticks(self) -> u32 { grow_time(self) }
    }

    /// What a tile holds right now.
    #[derive(Clone, Copy, Debug, PartialEq, Eq)]
    pub enum Tile { Wild, Tilled, Rock, Growing(Crop), Ripe(Crop), Rotten(Crop) }

    /// Why plant() did not plant.
    #[derive(Clone, Copy, Debug, PartialEq, Eq)]
    pub enum FarmError { NotTilled, Occupied, NoSeeds }

    fn index(c: Crop) -> usize { match c { ${cropArms((c, i) => String(i))} } }
    fn letter(c: Crop) -> char { match c { ${cropArms((c) => "'" + c.ch + "'")} } }
    fn grow_time(c: Crop) -> u32 { match c { ${cropArms((c) => String(c.grow))} } }
    fn base_yield(c: Crop) -> u32 { match c { ${cropArms((c) => String(c.yield))} } }
    fn rot_after(c: Crop) -> u32 { match c { ${cropArms((c) => String(c.rotAfter || 0))} } }
    fn seed_cost(c: Crop) -> Option<(Crop, u32)> {
        match c { ${cropArms((c) => (c.cost ? 'Some((Crop::' + CROPS[c.cost.crop].name + ', ' + c.cost.n + '))' : 'None'))} }
    }
    const ALL_CROPS: [Crop; ${CROPS.length}] = [${CROPS.map((c) => 'Crop::' + c.name).join(', ')}];

    #[derive(Clone, Copy)]
    struct Plot { rock: bool, tilled: bool, crop: Option<Crop>, ripe_at: u32 }

    /// The drone. Methods that act cost ticks; methods that look are free.
    pub struct Drone {
        x: usize,
        y: usize,
        tick: u32,
        plots: Vec<Plot>,
        barn: [u32; ${CROPS.length}],
        idle: Cell<u32>,
    }

    impl Drone {
        pub fn new() -> Drone {
            let mut plots = Vec::new();
            for ch in MAP.chars() {
                let mut p = Plot { rock: false, tilled: false, crop: None, ripe_at: 0 };
                match ch {
                    '#' => p.rock = true,
                    '_' => p.tilled = true,
                    '.' => {}
                    _ => {
                        for c in ALL_CROPS {
                            if letter(c) == ch { p.tilled = true; p.crop = Some(c); }
                        }
                    }
                }
                plots.push(p);
            }
            Drone { x: 0, y: 0, tick: 0, plots, barn: [0; ${CROPS.length}], idle: Cell::new(0) }
        }

        // ----- looking (free) -----

        /// Column of the drone, from 0 at the west edge.
        pub fn x(&self) -> usize { self.free(); self.x }
        /// Row of the drone, from 0 at the north edge.
        pub fn y(&self) -> usize { self.free(); self.y }
        /// Width (and height) of the square field.
        pub fn size(&self) -> usize { self.free(); SIZE }
        /// Ticks spent so far.
        pub fn tick(&self) -> u32 { self.free(); self.tick }
        /// Ticks left before the level ends.
        pub fn ticks_left(&self) -> u32 { self.free(); BUDGET - self.tick }
        /// How many of a crop are in the barn.
        pub fn count(&self, c: Crop) -> u32 { self.free(); self.barn[index(c)] }
        /// The tile under the drone.
        pub fn scan(&self) -> Tile { self.look(self.x, self.y) }
        /// Any tile on the field. Panics if (x, y) is off the field.
        pub fn look(&self, x: usize, y: usize) -> Tile {
            self.free();
            if x >= SIZE || y >= SIZE {
                panic!("look({}, {}) is off the {}x{} field", x, y, SIZE, SIZE);
            }
            self.tile_at(y * SIZE + x)
        }
        /// True if the crop under the drone is ready to harvest.
        pub fn is_ripe(&self) -> bool {
            match self.scan() { Tile::Ripe(_) => true, _ => false }
        }

        // ----- acting (costs ticks) -----

        /// Move one tile. Returns false (and stays put) at an edge or a rock. ${COST.step} tick.
        pub fn step(&mut self, dir: Dir) -> bool {
            self.spend(${COST.step});
            let (x, y) = (self.x, self.y);
            let target = match dir {
                Dir::North => if y > 0 { Some((x, y - 1)) } else { None },
                Dir::South => if y + 1 < SIZE { Some((x, y + 1)) } else { None },
                Dir::West => if x > 0 { Some((x - 1, y)) } else { None },
                Dir::East => if x + 1 < SIZE { Some((x + 1, y)) } else { None },
            };
            match target {
                Some((nx, ny)) if !self.plots[ny * SIZE + nx].rock => {
                    self.x = nx;
                    self.y = ny;
                    println!("${TRACE}{} m {} {}", self.tick, nx, ny);
                    true
                }
                _ => {
                    println!("${TRACE}{} b {:?}", self.tick, dir);
                    false
                }
            }
        }

        /// Turn wild ground into tilled soil. Destroys anything growing. ${COST.till} ticks.
        pub fn till(&mut self) {
            self.spend(${COST.till});
            let i = self.here();
            let p = &mut self.plots[i];
            p.tilled = true;
            p.crop = None;
            println!("${TRACE}{} t", self.tick);
        }

        /// Sow a crop on empty tilled soil, paying its seed cost from the barn. ${COST.plant} tick.
        pub fn plant(&mut self, c: Crop) -> Result<(), FarmError> {
            self.spend(${COST.plant});
            let i = self.here();
            let result = if !self.plots[i].tilled {
                Err(FarmError::NotTilled)
            } else if self.plots[i].crop.is_some() {
                Err(FarmError::Occupied)
            } else {
                match seed_cost(c) {
                    Some((pay, n)) if self.barn[index(pay)] < n => Err(FarmError::NoSeeds),
                    Some((pay, n)) => { self.barn[index(pay)] -= n; Ok(()) }
                    None => Ok(()),
                }
            };
            match result {
                Ok(()) => {
                    self.plots[i].crop = Some(c);
                    self.plots[i].ripe_at = self.tick + grow_time(c);
                    println!("${TRACE}{} p {}", self.tick, letter(c));
                }
                Err(e) => println!("${TRACE}{} f {:?}", self.tick, e),
            }
            result
        }

        /// Harvest the tile under the drone and return what it yielded.
        /// An unripe or rotten crop is destroyed and yields 0. ${COST.harvest} tick.
        pub fn harvest(&mut self) -> u32 {
            self.spend(${COST.harvest});
            let i = self.here();
            let tile = self.tile_at(i);
            let mut got = 0;
            if let Tile::Ripe(c) = tile {
                got = base_yield(c);
                if c == Crop::Beet {
                    got += self.wheat_neighbours();
                }
                self.barn[index(c)] += got;
            }
            let crop = self.plots[i].crop;
            self.plots[i].crop = None;
            match crop {
                Some(c) => println!("${TRACE}{} h {} {}", self.tick, letter(c), got),
                None => println!("${TRACE}{} h - 0", self.tick),
            }
            self.check_goal();
            got
        }

        /// Do nothing for one tick. ${COST.wait} tick.
        pub fn wait(&mut self) {
            self.spend(${COST.wait});
            println!("${TRACE}{} w", self.tick);
        }

        // ----- the rules -----

        fn here(&self) -> usize { self.y * SIZE + self.x }

        fn tile_at(&self, i: usize) -> Tile {
            let p = self.plots[i];
            if p.rock { return Tile::Rock; }
            match p.crop {
                None => if p.tilled { Tile::Tilled } else { Tile::Wild },
                Some(c) => {
                    if self.tick < p.ripe_at {
                        Tile::Growing(c)
                    } else if ROT && rot_after(c) > 0 && self.tick >= p.ripe_at + rot_after(c) {
                        Tile::Rotten(c)
                    } else {
                        Tile::Ripe(c)
                    }
                }
            }
        }

        fn wheat_neighbours(&self) -> u32 {
            let mut n = 0;
            let (x, y) = (self.x, self.y);
            let around = [(x > 0, x.wrapping_sub(1), y), (x + 1 < SIZE, x + 1, y), (y > 0, x, y.wrapping_sub(1)), (y + 1 < SIZE, x, y + 1)];
            for (ok, nx, ny) in around {
                if ok {
                    match self.tile_at(ny * SIZE + nx) {
                        Tile::Growing(Crop::Wheat) | Tile::Ripe(Crop::Wheat) => n += 1,
                        _ => {}
                    }
                }
            }
            n
        }

        fn free(&self) {
            let n = self.idle.get() + 1;
            self.idle.set(n);
            if n > ${STALL} {
                self.end("stall", "the drone looked around ${STALL} times without acting");
            }
        }

        fn spend(&mut self, ticks: u32) {
            self.idle.set(0);
            if self.tick + ticks > BUDGET {
                self.end("time", "out of ticks");
            }
            self.tick += ticks;
        }

        fn check_goal(&self) {
            let mut met = true;
            for i in 0..GOAL.len() {
                if self.barn[i] < GOAL[i] { met = false; }
            }
            if met {
                self.end("goal", "goal reached");
            }
        }

        fn report(&self) -> String {
            let mut parts = Vec::new();
            for c in ALL_CROPS {
                let i = index(c);
                if GOAL[i] > 0 {
                    parts.push(format!("{:?} {}/{}", c, self.barn[i], GOAL[i]));
                } else if self.barn[i] > 0 {
                    parts.push(format!("{:?} {}", c, self.barn[i]));
                }
            }
            parts.join(", ")
        }

        fn end(&self, why: &str, text: &str) {
            println!("${TRACE}end {} {}", why, self.tick);
            println!("[farm] {} at tick {} of {}: {}", text, self.tick, BUDGET, self.report());
            std::process::exit(0);
        }

        pub fn finish(&self) {
            self.end("return", "run() returned before the goal");
        }
    }
}

fn main() {
    let mut drone = farm::Drone::new();
    run(&mut drone);
    drone.finish();
}
`;
  }
  function program(level, code) { return code.replace(/\s*$/, '\n') + preludeFor(level); }

  // ---------- trace parsing & replay ----------
  const LETTER = Object.fromEntries(CROPS.map((c, i) => [c.ch, i]));
  // Split stdout into board events and the player's own output. A trace line can follow text the program
  // printed with print! (no newline), so the marker is looked for anywhere on the line.
  const TRACE_RE = new RegExp(TRACE + '(\\d+ [a-z].*|end \\w+ \\d+)$');
  function parseTrace(stdout) {
    const events = []; const log = []; let end = null; let tick = 0;
    const lines = stdout.split('\n');
    if (lines[lines.length - 1] === '') lines.pop();
    for (const line of lines) {
      const m = TRACE_RE.exec(line);
      const text = m ? line.slice(0, m.index) : line;
      if (text) {
        if (text.startsWith('[farm] ')) { if (end) end.text = text.slice(7); }
        else log.push({ tick, s: text, after: events.length });
      }
      if (!m) continue;
      const parts = m[1].split(' ');
      if (parts[0] === 'end') { end = { why: parts[1], tick: +parts[2] }; continue; }
      tick = +parts[0];
      events.push({ tick, op: parts[1], a: parts[2], b: parts[3] });
    }
    return { events, log, end };
  }
  // The program's stdout as the player should read it: their own prints and the farm's summary, without the trace.
  function visibleOutput(stdout) {
    return stdout.split('\n').map((line) => { const m = TRACE_RE.exec(line); return m ? (m.index ? line.slice(0, m.index) : null) : line; })
      .filter((l) => l !== null).join('\n');
  }
  function initialState(level) {
    const n = level.map.length; const plots = [];
    for (const row of level.map) for (const ch of row) {
      const p = { rock: ch === '#', tilled: ch !== '.' && ch !== '#', crop: null, ripeAt: 0 };
      if (LETTER[ch] !== undefined) p.crop = LETTER[ch];
      plots.push(p);
    }
    return { n, x: 0, y: 0, tick: 0, plots, barn: CROPS.map(() => 0), last: null, flash: null, level };
  }
  function tileState(s, p) {
    if (p.rock) return 'rock';
    if (p.crop === null) return p.tilled ? 'tilled' : 'wild';
    if (s.tick < p.ripeAt) return 'growing';
    const rot = CROPS[p.crop].rotAfter;
    if (s.level.rot && rot && s.tick >= p.ripeAt + rot) return 'rotten';
    return 'ripe';
  }
  // Apply one event to a replay state (mutates).
  function apply(s, ev) {
    s.tick = ev.tick; s.last = ev; s.flash = null;
    const i = s.y * s.n + s.x; const p = s.plots[i];
    switch (ev.op) {
      case 'm': s.x = +ev.a; s.y = +ev.b; break;
      case 'b': s.flash = 'bump'; break;
      case 't': p.tilled = true; p.crop = null; break;
      case 'p': { const c = LETTER[ev.a]; p.crop = c; p.ripeAt = ev.tick + CROPS[c].grow; const cost = CROPS[c].cost; if (cost) s.barn[cost.crop] -= cost.n; break; }
      case 'f': s.flash = 'fail'; break;
      case 'h': if (ev.a !== '-') { s.barn[LETTER[ev.a]] += +ev.b; } p.crop = null; s.flash = +ev.b > 0 ? 'gain' : 'waste'; break;
      default: break;
    }
  }
  function describe(ev) {
    if (!ev) return '';
    switch (ev.op) {
      case 'm': return 'step to (' + ev.a + ', ' + ev.b + ')';
      case 'b': return 'step ' + ev.a + ' blocked';
      case 't': return 'till';
      case 'p': return 'plant ' + CROPS[LETTER[ev.a]].name;
      case 'f': return 'plant failed: ' + ev.a;
      case 'h': return ev.a === '-' ? 'harvest: nothing here' : +ev.b > 0 ? 'harvest ' + CROPS[LETTER[ev.a]].name + ' +' + ev.b : 'harvest ' + CROPS[LETTER[ev.a]].name + ': not ripe, destroyed';
      case 'w': return 'wait';
      default: return ev.op;
    }
  }

  // ---------- board drawing (SVG) ----------
  const CELL = 40;
  function glyph(kind, crop, cx, cy) {
    const c = crop === null ? null : CROPS[crop].name;
    if (kind === 'rock') return '<path class="fm-rock" d="M' + (cx - 13) + ' ' + (cy + 9) + 'l4 -15 9 -5 10 4 4 12 -6 6z"/>';
    if (kind === 'wild') return '<path class="fm-grass" d="M' + (cx - 9) + ' ' + (cy + 8) + 'l-2 -9M' + (cx - 7) + ' ' + (cy + 8) + 'l2 -8M' + (cx + 6) + ' ' + (cy - 2) + 'l-2 -8M' + (cx + 8) + ' ' + (cy - 2) + 'l2 -7M' + (cx - 1) + ' ' + (cy + 12) + 'l1 -7"/>';
    if (kind === 'tilled') return '';
    const small = kind === 'growing';
    if (kind === 'rotten') return '<circle class="fm-rot" cx="' + cx + '" cy="' + cy + '" r="9"/><path class="fm-rot-x" d="M' + (cx - 4) + ' ' + (cy - 4) + 'l8 8M' + (cx + 4) + ' ' + (cy - 4) + 'l-8 8"/>';
    if (c === 'Wheat') {
      if (small) return '<path class="fm-sprout" d="M' + cx + ' ' + (cy + 8) + 'v-9M' + cx + ' ' + (cy + 2) + 'l-5 -4M' + cx + ' ' + (cy + 2) + 'l5 -4"/>';
      return '<path class="fm-stalk" d="M' + (cx - 6) + ' ' + (cy + 12) + 'v-16M' + cx + ' ' + (cy + 12) + 'v-20M' + (cx + 6) + ' ' + (cy + 12) + 'v-16"/>' +
        [-6, 0, 6].map((dx, k) => '<ellipse class="fm-wheat" cx="' + (cx + dx) + '" cy="' + (cy - (k === 1 ? 10 : 6)) + '" rx="2.6" ry="5.5"/>').join('');
    }
    if (c === 'Beet') {
      if (small) return '<path class="fm-sprout" d="M' + cx + ' ' + (cy + 8) + 'v-7M' + cx + ' ' + (cy + 1) + 'q-6 -2 -6 -8M' + cx + ' ' + (cy + 1) + 'q6 -2 6 -8"/>';
      return '<path class="fm-leaf" d="M' + cx + ' ' + (cy - 3) + 'q-9 -5 -7 -13 q5 3 7 13 q2 -10 7 -13 q2 8 -7 13z"/><circle class="fm-beet" cx="' + cx + '" cy="' + (cy + 5) + '" r="8"/>';
    }
    if (small) return '<path class="fm-sprout" d="M' + (cx - 6) + ' ' + (cy + 6) + 'q6 -10 12 -4"/><circle class="fm-melon-s" cx="' + (cx + 4) + '" cy="' + (cy + 5) + '" r="4"/>';
    return '<ellipse class="fm-melon" cx="' + cx + '" cy="' + (cy + 2) + '" rx="13" ry="10"/><path class="fm-melon-l" d="M' + (cx - 6) + ' ' + (cy - 7) + 'q-3 9 0 18M' + cx + ' ' + (cy - 8) + 'v20M' + (cx + 6) + ' ' + (cy - 7) + 'q3 9 0 18"/>';
  }
  function cellsSvg(s) {
    const n = s.n; let h = '';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const p = s.plots[y * n + x]; const k = tileState(s, p);
      const X = x * CELL, Y = y * CELL;
      h += '<rect class="fm-cell fm-' + (k === 'wild' ? 'wild' : k === 'rock' ? 'rockcell' : 'soil') + '" x="' + X + '" y="' + Y + '" width="' + CELL + '" height="' + CELL + '"/>';
      if (k !== 'wild' && k !== 'rock') h += '<path class="fm-furrow" d="M' + (X + 6) + ' ' + (Y + 12) + 'h28M' + (X + 6) + ' ' + (Y + 22) + 'h28M' + (X + 6) + ' ' + (Y + 32) + 'h28"/>';
      h += glyph(k, p.crop, X + CELL / 2, Y + CELL / 2);
    }
    return h;
  }
  // the drone: the app's hexagon mark with four rotors
  const DRONE = '<circle class="fm-ring" r="17"/>' +
    [[-10, -10], [10, -10], [-10, 10], [10, 10]].map(([a, b]) => '<circle class="fm-rotor" cx="' + a + '" cy="' + b + '" r="5"/>').join('') +
    '<path class="fm-hull" d="M0 -9 7.8 -4.5v9L0 9l-7.8 -4.5v-9z"/><circle class="fm-eye" r="2.8"/>';
  function cropIcon(i, kind) {
    return '<svg class="fm-icon" viewBox="0 0 40 40" aria-hidden="true">' + glyph(kind || 'ripe', i, 20, 20) + '</svg>';
  }

  // ---------- API reference ----------
  const API = [
    ['d.step(dir: Dir) -> bool', COST.step, 'Move one tile north, east, south or west. Returns <code>false</code> and stays put at an edge or a rock.'],
    ['d.till()', COST.till, 'Turn the tile into tilled soil. Destroys anything growing there.'],
    ['d.plant(crop: Crop) -> Result&lt;(), FarmError&gt;', COST.plant, 'Sow empty tilled soil. Fails with <code>NotTilled</code>, <code>Occupied</code> or <code>NoSeeds</code>.'],
    ['d.harvest() -> u32', COST.harvest, 'Collect the crop here into the barn and return the yield. Unripe or rotten crops are destroyed for 0.'],
    ['d.wait()', COST.wait, 'Do nothing for a tick.'],
    ['d.scan() -> Tile', 0, 'The tile under the drone.'],
    ['d.look(x, y) -> Tile', 0, 'Any tile on the field.'],
    ['d.is_ripe() -> bool', 0, 'Whether the crop here is ready.'],
    ['d.x(), d.y(), d.size() -> usize', 0, 'Position (0, 0 is the top-left corner) and field width.'],
    ['d.tick(), d.ticks_left() -> u32', 0, 'Ticks used so far, and left before the level ends.'],
    ['d.count(crop: Crop) -> u32', 0, 'How many of a crop are in the barn.'],
    ['crop.grow_ticks() -> u32', 0, 'Ticks from planting to ripe.'],
  ];
  function apiHtml() {
    let h = '<table class="ref fm-api"><thead><tr><th>Call</th><th>Ticks</th><th>What it does</th></tr></thead><tbody>';
    for (const [sig, cost, what] of API) h += '<tr><td><code>' + sig + '</code></td><td>' + (cost || 'free') + '</td><td>' + what + '</td></tr>';
    h += '</tbody></table>';
    h += '<table class="ref fm-api"><thead><tr><th>Crop</th><th>Seed cost</th><th>Ripe after</th><th>Yield</th></tr></thead><tbody>';
    CROPS.forEach((c, i) => {
      h += '<tr><td><span class="fm-crop">' + cropIcon(i) + '<code>Crop::' + c.name + '</code></span></td><td>' + (c.cost ? c.cost.n + ' ' + CROPS[c.cost.crop].name.toLowerCase() : 'free') + '</td><td>' + c.grow + ' ticks' + (c.rotAfter ? ', rots ' + c.rotAfter + ' later in some levels' : '') + '</td><td>' + c.yield + (c.name === 'Beet' ? ', +1 per wheat plant next to it' : '') + '</td></tr>';
    });
    h += '</tbody></table>';
    h += '<pre><code>pub enum Dir { North, East, South, West }   // Dir::ALL lists all four\npub enum Tile { Wild, Tilled, Rock, Growing(Crop), Ripe(Crop), Rotten(Crop) }\npub enum FarmError { NotTilled, Occupied, NoSeeds }</code></pre>';
    h += '<p>The level ends when the goal is met, when the ticks run out, or when <code>run</code> returns. <code>Dir</code>, <code>Crop</code>, <code>Tile</code> and <code>FarmError</code> are <code>Copy</code> and can be compared with <code>==</code>.</p>';
    return h;
  }
  function tutorContext(level) {
    const strip = (h) => h.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    let t = 'Goal: harvest ' + goalText(level) + ' within ' + level.budget + ' ticks (par ' + level.par + '). Field ' + level.map.length + 'x' + level.map.length + ', map rows (. wild, _ tilled, # rock, W/B/M ripe wheat/beet/melon): ' + level.map.join(' / ') + (level.rot ? '. Melons rot ' + CROPS[2].rotAfter + ' ticks after ripening.' : '.') + '\n';
    t += 'Level text: ' + strip(level.body).replace(/\s+/g, ' ').trim() + '\n';
    t += 'Drone API (the app appends `mod farm` and `fn main() { run(&mut drone) }` after the learner\'s code):\n';
    for (const [sig, cost, what] of API) t += '- ' + strip(sig) + ' [' + (cost ? cost + ' tick' + (cost > 1 ? 's' : '') : 'free') + ']: ' + strip(what) + '\n';
    t += 'Crops: ' + CROPS.map((c) => c.name + ' (seed ' + (c.cost ? c.cost.n + ' ' + CROPS[c.cost.crop].name : 'free') + ', ripe after ' + c.grow + ', yield ' + c.yield + (c.name === 'Beet' ? ' +1 per adjacent wheat plant' : '') + ')').join('; ');
    return t;
  }
  function goalText(level) {
    return Object.keys(level.goal).map((k) => level.goal[k] + ' ' + k.toLowerCase()).join(' and ');
  }

  // ---------- replay player ----------
  const SPEEDS = [[8, '1×'], [32, '4×'], [128, '16×'], [512, '64×']]; // events per second
  const END_TEXT = { goal: 'Goal reached', time: 'Out of ticks', return: 'run() returned before the goal', stall: 'Drone stuck: it kept looking without acting' };
  function playerHtml(level) {
    const n = level.map.length, W = n * CELL;
    return '<div class="fm" id="fm">' +
      '<div class="fm-hud"><div class="fm-clock"><span class="fm-k">Tick</span> <b id="fmTick">0</b> <span class="fm-of">/ ' + level.budget + '</span><span class="fm-bar"><i id="fmBar"></i></span></div>' +
      '<div class="fm-barn" id="fmBarn"></div></div>' +
      '<div class="fm-stage"><svg class="fm-board" style="max-width:' + Math.min(440, n * 84) + 'px" viewBox="-2 -2 ' + (W + 4) + ' ' + (W + 4) + '" role="img" aria-label="Farm field, ' + n + ' by ' + n + ' tiles">' +
      '<rect class="fm-edge" x="-2" y="-2" width="' + (W + 4) + '" height="' + (W + 4) + '" rx="3"/><g id="fmCells"></g><g class="fm-drone" id="fmDrone">' + DRONE + '</g></svg>' +
      '<div class="fm-banner" id="fmBanner" role="status" hidden></div></div>' +
      '<div class="fm-controls"><button class="btn fm-play" id="fmPlay" disabled aria-label="Play"><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path id="fmPlayIcon" d="M2.5 1.5v9l8-4.5z" fill="currentColor"/></svg></button>' +
      '<button class="btn fm-play" id="fmRestart" disabled aria-label="Replay from the start"><svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8a5 5 0 1 0 1.6-3.7M3 2.5V5h2.5" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg></button>' +
      '<input type="range" class="fm-scrub" id="fmScrub" min="0" max="0" value="0" disabled aria-label="Replay position">' +
      '<div class="fm-speed" role="group" aria-label="Replay speed">' + SPEEDS.map(([v, t]) => '<button data-v="' + v + '" aria-pressed="false">' + t + '</button>').join('') + '</div></div>' +
      '<div class="fm-now" id="fmNow"></div>' +
      '<div class="fm-log" id="fmLog" hidden></div></div>';
  }
  function Player(level) {
    this.level = level; this.trace = null; this.i = 0; this.state = initialState(level);
    this.speed = 32; this.userSpeed = false; this.playing = false; this.raf = 0; this.acc = 0; this.lastT = 0; this.logShown = 0; this.result = null;
    // crops the goal depends on (through seed costs) always get a barn chip
    this.chain = new Set();
    for (const name of Object.keys(level.goal)) { let c = CROPS.findIndex((x) => x.name === name); while (c >= 0) { this.chain.add(c); c = CROPS[c].cost ? CROPS[c].cost.crop : -1; } }
    this.reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  Player.prototype.mount = function (root) {
    this.root = root;
    const q = (id) => root.querySelector('#' + id);
    this.el = { tick: q('fmTick'), bar: q('fmBar'), barn: q('fmBarn'), cells: q('fmCells'), drone: q('fmDrone'), banner: q('fmBanner'), play: q('fmPlay'), playIcon: q('fmPlayIcon'), restart: q('fmRestart'), scrub: q('fmScrub'), now: q('fmNow'), log: q('fmLog') };
    this.el.play.onclick = () => (this.playing ? this.pause() : this.play());
    this.el.restart.onclick = () => { this.seek(0); this.play(); };
    this.el.scrub.oninput = () => { this.pause(); this.seek(+this.el.scrub.value); };
    root.querySelectorAll('.fm-speed button').forEach((b) => { b.onclick = () => { this.speed = +b.dataset.v; this.userSpeed = true; this.renderSpeed(); }; });
    this.renderSpeed();
    if (this.trace) { this.enable(true); this.seek(this.i); if (this.i >= this.trace.events.length) this.showEnd(); }
    else { this.render(); this.idle(this.pendingMsg || 'Press <b>Run</b> to send your program to the drone.'); }
  };
  Player.prototype.unmount = function () { this.pause(); this.root = null; };
  Player.prototype.renderSpeed = function () {
    if (!this.root) return;
    this.root.querySelectorAll('.fm-speed button').forEach((b) => b.setAttribute('aria-pressed', +b.dataset.v === this.speed ? 'true' : 'false'));
    this.el.drone.style.transitionDuration = this.reduce ? '0ms' : Math.round(Math.min(140, 700 / this.speed)) + 'ms';
  };
  Player.prototype.enable = function (on) { ['play', 'restart', 'scrub'].forEach((k) => { this.el[k].disabled = !on; }); };
  Player.prototype.idle = function (html) { this.el.now.innerHTML = '<span>' + html + '</span>'; };
  // result: { trace, kind, message } from a run. trace is null when the program did not compile.
  Player.prototype.load = function (result) {
    this.pause();
    this.result = result; this.trace = result.trace;
    this.state = initialState(this.level); this.i = 0; this.logShown = 0;
    if (!this.root) return;
    this.el.banner.hidden = true; this.el.log.innerHTML = ''; this.el.log.hidden = true;
    if (!this.trace) { this.enable(false); this.render(); this.banner('bad', result.message || 'The program did not run'); this.idle('Fix the error and press <b>Run</b> again.'); return; }
    const n = this.trace.events.length;
    this.el.scrub.max = String(n); this.el.scrub.value = '0';
    if (!this.userSpeed) { this.speed = (SPEEDS.find(([v]) => n / v <= 7) || SPEEDS[SPEEDS.length - 1])[0]; this.renderSpeed(); }
    this.enable(n > 0); this.render();
    if (n === 0) { this.showEnd(); return; }
    this.play();
  };
  Player.prototype.play = function () {
    if (!this.trace || !this.root) return;
    if (this.i >= this.trace.events.length) this.seek(0);
    this.playing = true; this.el.banner.hidden = true; this.setIcon();
    this.lastT = 0; this.acc = 0;
    const frame = (t) => {
      if (!this.playing) return;
      if (this.lastT) this.acc += (t - this.lastT) / 1000 * this.speed;
      this.lastT = t;
      const steps = Math.floor(this.acc);
      if (steps > 0 || this.i === 0) { this.acc -= steps; this.advance(Math.max(1, steps)); }
      if (this.i >= this.trace.events.length) { this.pause(); this.showEnd(); return; }
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  };
  Player.prototype.pause = function () { this.playing = false; cancelAnimationFrame(this.raf); this.setIcon(); };
  Player.prototype.setIcon = function () {
    if (!this.root) return;
    this.el.playIcon.setAttribute('d', this.playing ? 'M2.5 1.5h2.6v9H2.5zM6.9 1.5h2.6v9H6.9z' : 'M2.5 1.5v9l8-4.5z');
    this.el.play.setAttribute('aria-label', this.playing ? 'Pause' : 'Play');
  };
  Player.prototype.advance = function (k) {
    const ev = this.trace.events; const to = Math.min(ev.length, this.i + k);
    for (; this.i < to; this.i++) apply(this.state, ev[this.i]);
    this.render();
  };
  Player.prototype.seek = function (i) {
    if (!this.trace) return;
    if (i < this.i) { this.state = initialState(this.level); this.i = 0; this.logShown = 0; if (this.root) this.el.log.innerHTML = ''; }
    this.el.banner.hidden = true;
    this.advance(i - this.i);
    if (i >= this.trace.events.length && !this.playing) this.showEnd();
  };
  Player.prototype.render = function () {
    if (!this.root) return;
    const s = this.state, L = this.level;
    this.el.cells.innerHTML = cellsSvg(s);
    this.el.drone.style.transform = 'translate(' + (s.x * CELL + CELL / 2) + 'px,' + (s.y * CELL + CELL / 2) + 'px)';
    this.el.drone.setAttribute('class', 'fm-drone' + (s.flash ? ' fm-flash-' + s.flash : ''));
    this.el.tick.textContent = s.tick;
    this.el.bar.style.width = Math.min(100, (s.tick / L.budget) * 100) + '%';
    let barn = '';
    CROPS.forEach((c, i) => {
      const goal = L.goal[c.name] || 0; const have = s.barn[i];
      if (!goal && !have && !this.chain.has(i)) return;
      barn += '<span class="fm-chip' + (goal && have >= goal ? ' met' : '') + '" title="' + c.name + ' in the barn">' + cropIcon(i) + '<b>' + have + '</b>' + (goal ? '<span>/ ' + goal + '</span>' : '') + '</span>';
    });
    this.el.barn.innerHTML = barn;
    if (this.trace) {
      this.el.scrub.value = String(this.i);
      const ev = s.last;
      this.el.now.innerHTML = this.i === 0 ? 'Ready.' : '<span class="fm-op fm-op-' + (s.flash || 'ok') + '">' + describe(ev) + '</span><span class="fm-step">action ' + this.i + ' of ' + this.trace.events.length + '</span>';
      this.renderLog();
    }
  };
  Player.prototype.renderLog = function () {
    const log = this.trace.log; let k = this.logShown; let add = '';
    while (k < log.length && log[k].after <= this.i) { add += '<div><span>' + log[k].tick + '</span>' + esc(log[k].s) + '</div>'; k++; }
    if (k === this.logShown) return;
    this.logShown = k; this.el.log.hidden = false;
    this.el.log.insertAdjacentHTML('beforeend', add);
    while (this.el.log.childElementCount > 300) this.el.log.firstElementChild.remove();
    this.el.log.scrollTop = this.el.log.scrollHeight;
  };
  Player.prototype.showEnd = function () {
    if (!this.root || !this.result) return;
    const end = this.trace && this.trace.end;
    if (end) this.banner(end.why === 'goal' ? 'good' : 'warn', (END_TEXT[end.why] || end.why) + ' · ' + end.tick + ' ticks');
    else this.banner('bad', this.result.message || 'The program stopped');
  };
  Player.prototype.banner = function (kind, text) { this.el.banner.className = 'fm-banner ' + kind; this.el.banner.textContent = text; this.el.banner.hidden = false; };
  function esc(t) { return String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  return { CROPS, COST, LEVELS, TRACE, preludeFor, program, parseTrace, visibleOutput, initialState, apply, describe, tileState, cellsSvg, apiHtml, goalText, tutorContext, playerHtml, Player, END_TEXT };
})();

if (typeof module !== 'undefined') module.exports = FARM;
