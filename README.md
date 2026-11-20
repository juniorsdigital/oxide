# Oxide Workbench

A desktop app for learning Rust by writing it. Twenty guided lessons take you from `println!` through ownership, borrowing, traits, iterators, lifetimes, smart pointers and threads, and end with two small projects: an in-memory key-value store and an HTTP-style request router.

Each lesson has an explanation, a "performance lens" note on why the feature matters for fast software, starter code (often broken on purpose so you learn to read compiler errors), a task with automatic checks, hints and a solution.

Built with [Tauri 2](https://tauri.app), so the app itself is Rust.

## Drone Farm

**Drone Farm** is a programming game in the same window: you write Rust that steers a farm drone across a grid, and watch a replay of what it did. Seven levels go from a `for` loop over a 3 × 3 wheat field to breadth-first search around rocks and a full wheat → beet → melon economy where ripe melons rot. Each level has a goal within a tick budget, plus a par (the reference solution's tick count) to beat.

You write `fn run(d: &mut Drone)` using a small API (`d.step(Dir::East)`, `d.till()`, `d.plant(Crop::Wheat)`, `d.harvest()`, `d.scan()`, ...). The farm simulation is itself Rust: when you press Run, the app appends it as `mod farm` plus a `fn main()` and runs the whole program in the same engine as the lessons. So the code is real, complete Rust: **Copy full program** puts it on the clipboard for `src/main.rs` in any Cargo project, and the Playground button opens it there too.

The simulation prints one `@@` trace line per drone action; the app hides those from the output panel and replays them on the board.

## How code runs

- **Real compiler.** If Rust is installed (`rustc` on your `PATH` or in `~/.cargo/bin`), each run compiles `src/main.rs` with your `rustc` in a temporary folder and runs the program as a native binary. Compile errors and warnings are exactly what `rustc` prints. Programs are stopped after 10 seconds and output is capped at 1 MB.
- **Teaching interpreter.** Without Rust installed, code runs in a built-in interpreter (`engine/`) that covers the Rust used in the course and reports the common ownership, borrowing, mutability, type and match errors with the same error codes and labels as `rustc`. You can also pick it from the **Engine** menu above the editor.

Install Rust from [rustup.rs](https://rustup.rs), then restart the app to switch to the real compiler.

## Tutor

The **Tutor** tab explains errors, gives hints and reviews your code using Claude (`claude-opus-5-5` through the Anthropic Messages API, streamed). It needs an Anthropic API key, which you add under **Settings**. Usage is billed to that key.

- The key is stored in the app's config folder (`tutor.json`, readable only by your user on macOS and Linux). If none is saved, the `ANTHROPIC_API_KEY` environment variable is used.
- Each question sends the current lesson, your code and the last run's output.
- Requests opt into server-side refusal fallbacks (`fallbacks: "default"`), so a safety-classifier decline is retried on a fallback model in the same call.

## Install

Download an installer from the [Releases](../../releases) page:

| System | File |
| --- | --- |
| macOS (Apple silicon) | `Oxide.Workbench_x.y.z_aarch64.dmg` |
| macOS (Intel) | `Oxide.Workbench_x.y.z_x64.dmg` |
| Windows | `Oxide.Workbench_x.y.z_x64-setup.exe` or `.msi` |
| Linux | `.AppImage`, `.deb` or `.rpm` |

The builds are not code-signed yet, so the first launch needs one extra step:

- **macOS:** if you see "Oxide Workbench is damaged" or "cannot be opened", run `xattr -dr com.apple.quarantine "/Applications/Oxide Workbench.app"` once, or right-click the app and choose **Open**.
- **Windows:** SmartScreen may warn about an unknown publisher. Choose **More info**, then **Run anyway**.

## Develop

Requirements: Node 20+, Rust stable, and the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your system (on Linux: `libwebkit2gtk-4.1-dev`, `librsvg2-dev`, `libayatana-appindicator3-dev`).

```bash
npm install
npm run dev        # run the app with live reload of ui/
npm run build      # build installers for this system into src-tauri/target/release/bundle
```

You can also open `ui/index.html` directly in a browser. That runs the lessons with the teaching interpreter only, without the tutor.

### Project layout

```
ui/            the app's front end: index.html, styles.css, app.js, lessons.js (all lesson content)
  farm.js      Drone Farm: the rules table, the levels, the Rust simulation it generates, and the replay board
  rustlite.js  generated bundle of the teaching interpreter (do not edit; run npm run build:engine)
  fonts/       Archivo, IBM Plex Sans, JetBrains Mono (SIL Open Font License, see fonts/OFL.txt)
engine/        the teaching interpreter: lexer/parser, name resolution, runtime, diagnostics
tests/         harness.js compares the interpreter with rustc on every lesson and tests/programs/*.rs
src-tauri/     desktop backend: runner.rs (compile and run with rustc), tutor.rs (Claude API client)
```

### Tests

```bash
npm run test:engine    # interpreter vs rustc: every lesson starter and solution, plus tests/programs
npm run test:backend   # cargo test for the runner (needs rustc)
```

The engine test fails if the interpreter's output differs from the real program's, or if it reports a different error code than `rustc` for a program that should not compile. Add a `.rs` file to `tests/programs/` to cover a new case.

### Adding a lesson

Lessons are plain objects in `ui/lessons.js`: `body` and `perf` are HTML, `starter` and `solution` are Rust, and `task.checks` are evaluated after each run (`out`: stdout contains, `ok`: ran with exit code 0, `code` / `nocode`: source contains or not, with a `re:` prefix for a regex). Set `expectStarter` to the error code (or `panic`) the starter should produce, and the harness checks that against `rustc`.

### Adding a Drone Farm level

Levels are objects in `FARM.LEVELS` in `ui/farm.js`: `map` is one string per row (`.` wild ground, `_` tilled soil, `#` rock, `W`/`B`/`M` a ripe crop), with a tick `budget`, a `goal` such as `{ Melon: 30 }`, `par`, and `starter`, `solution`, `hints`, `checks` like a lesson. Crop timings, yields, seed costs and tick costs live in the `CROPS` and `COST` tables at the top of the file; the Rust simulation and the board replay are both generated from them. `npm run test:engine` runs every level in rustc and the interpreter and fails if the outputs differ, if the starter already wins, if the solution misses the goal or does not take exactly `par` ticks, or if the replay disagrees with the simulation about what ended up in the barn.

## Releases

Push a version tag to build installers for all platforms on GitHub Actions:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The **Release** workflow creates a draft release with the macOS, Windows and Linux installers attached. Review it on GitHub and publish it. Keep the version in `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` and `package.json` in step with the tag.
