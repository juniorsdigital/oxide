//! Compile and run learner code with the Rust toolchain installed on this computer.
//!
//! Each run gets a fresh temporary directory with `src/main.rs`, so compiler messages
//! point at `src/main.rs:LINE:COL`, the same path the lessons and the teaching
//! interpreter use. The compiled program runs with a time limit and capped output.

use serde::Serialize;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

const COMPILE_TIMEOUT: Duration = Duration::from_secs(90);
const RUN_TIMEOUT: Duration = Duration::from_secs(10);
const OUTPUT_LIMIT: usize = 1024 * 1024;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Toolchain {
    pub available: bool,
    pub version: Option<String>,
    pub path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RunResult {
    /// false when rustc reported errors (or could not be started)
    pub compiled: bool,
    /// everything rustc printed: errors and warnings, in its human-readable format
    pub compiler_output: String,
    pub stdout: String,
    pub stderr: String,
    /// exit code of the program; None if it was killed or never ran
    pub exit_code: Option<i32>,
    pub timed_out: bool,
    pub truncated: bool,
    pub compile_ms: u64,
    pub run_ms: u64,
}

/// Look for rustc. GUI apps on macOS do not inherit the shell's PATH, so also check the
/// default rustup location.
pub fn find_rustc() -> Option<(PathBuf, String)> {
    let exe = if cfg!(windows) { "rustc.exe" } else { "rustc" };
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Some(p) = std::env::var_os("RUSTC") {
        candidates.push(PathBuf::from(p));
    }
    candidates.push(PathBuf::from(exe));
    if let Some(cargo_home) = std::env::var_os("CARGO_HOME") {
        candidates.push(PathBuf::from(cargo_home).join("bin").join(exe));
    }
    let home = std::env::var_os("HOME").or_else(|| std::env::var_os("USERPROFILE"));
    if let Some(home) = home {
        candidates.push(PathBuf::from(home).join(".cargo").join("bin").join(exe));
    }
    for c in candidates {
        let mut cmd = Command::new(&c);
        cmd.arg("--version").stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::null());
        hide_console(&mut cmd);
        if let Ok(out) = cmd.output() {
            if out.status.success() {
                let version = String::from_utf8_lossy(&out.stdout).trim().to_string();
                return Some((c, version));
            }
        }
    }
    None
}

#[tauri::command]
pub async fn toolchain() -> Toolchain {
    tauri::async_runtime::spawn_blocking(|| match find_rustc() {
        Some((path, version)) => Toolchain { available: true, version: Some(version), path: Some(path.display().to_string()) },
        None => Toolchain { available: false, version: None, path: None },
    })
    .await
    .unwrap_or(Toolchain { available: false, version: None, path: None })
}

#[tauri::command]
pub async fn run_rust(code: String, stdin: String) -> Result<RunResult, String> {
    tauri::async_runtime::spawn_blocking(move || compile_and_run(&code, &stdin))
        .await
        .map_err(|e| e.to_string())?
}

pub fn compile_and_run(code: &str, stdin: &str) -> Result<RunResult, String> {
    let (rustc, _) = find_rustc().ok_or("No Rust toolchain found. Install Rust from https://rustup.rs")?;
    let dir = TempDir::new()?;
    let src_dir = dir.path().join("src");
    std::fs::create_dir_all(&src_dir).map_err(|e| format!("could not create a work folder: {e}"))?;
    std::fs::write(src_dir.join("main.rs"), code).map_err(|e| format!("could not write main.rs: {e}"))?;
    let exe = dir.path().join(if cfg!(windows) { "main.exe" } else { "main" });

    let mut result = RunResult::default();
    let mut compile = Command::new(&rustc);
    compile
        .current_dir(dir.path())
        .args(["--edition", "2021", "--color", "never", "--crate-name", "playground", "-C", "debuginfo=0", "-o"])
        .arg(&exe)
        .arg(Path::new("src").join("main.rs"));
    let started = Instant::now();
    let compiled = run_with_limits(compile, None, COMPILE_TIMEOUT)?;
    result.compile_ms = started.elapsed().as_millis() as u64;
    // rustc writes diagnostics to stderr
    result.compiler_output = compiled.stderr;
    if compiled.timed_out {
        result.timed_out = true;
        return Ok(result);
    }
    if compiled.exit_code != Some(0) {
        return Ok(result);
    }
    result.compiled = true;

    let mut program = Command::new(&exe);
    program.current_dir(dir.path()).env("RUST_BACKTRACE", "0");
    let started = Instant::now();
    let ran = run_with_limits(program, Some(stdin.to_string()), RUN_TIMEOUT)?;
    result.run_ms = started.elapsed().as_millis() as u64;
    result.stdout = ran.stdout;
    result.stderr = ran.stderr;
    result.exit_code = ran.exit_code;
    result.timed_out = ran.timed_out;
    result.truncated = ran.truncated;
    Ok(result)
}

struct Limited {
    stdout: String,
    stderr: String,
    exit_code: Option<i32>,
    timed_out: bool,
    truncated: bool,
}

/// Run a command with piped stdio, a wall-clock limit and capped output.
fn run_with_limits(mut cmd: Command, stdin: Option<String>, timeout: Duration) -> Result<Limited, String> {
    cmd.stdin(if stdin.is_some() { Stdio::piped() } else { Stdio::null() })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    hide_console(&mut cmd);
    let mut child = cmd.spawn().map_err(|e| format!("could not start {:?}: {e}", cmd.get_program()))?;

    if let (Some(input), Some(mut pipe)) = (stdin, child.stdin.take()) {
        // a program that never reads stdin must not block us, so write from a thread
        thread::spawn(move || {
            let _ = pipe.write_all(input.as_bytes());
        });
    }
    let out_reader = spawn_reader(child.stdout.take());
    let err_reader = spawn_reader(child.stderr.take());

    let deadline = Instant::now() + timeout;
    let mut timed_out = false;
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break Some(status),
            Ok(None) if Instant::now() >= deadline => {
                timed_out = true;
                let _ = child.kill();
                let _ = child.wait();
                break None;
            }
            Ok(None) => thread::sleep(Duration::from_millis(5)),
            Err(e) => return Err(format!("waiting for the process failed: {e}")),
        }
    };
    let (stdout, t1) = out_reader.join().unwrap_or_default();
    let (stderr, t2) = err_reader.join().unwrap_or_default();
    Ok(Limited { stdout, stderr, exit_code: status.and_then(|s| s.code()), timed_out, truncated: t1 || t2 })
}

fn spawn_reader<R: Read + Send + 'static>(pipe: Option<R>) -> thread::JoinHandle<(String, bool)> {
    thread::spawn(move || {
        let Some(mut pipe) = pipe else { return (String::new(), false) };
        let mut buf = Vec::new();
        let mut chunk = [0u8; 8192];
        let mut truncated = false;
        loop {
            match pipe.read(&mut chunk) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    // keep draining after the cap so the child never blocks on a full pipe
                    if buf.len() < OUTPUT_LIMIT {
                        let take = n.min(OUTPUT_LIMIT - buf.len());
                        buf.extend_from_slice(&chunk[..take]);
                        truncated |= take < n;
                    } else {
                        truncated = true;
                    }
                }
            }
        }
        (String::from_utf8_lossy(&buf).into_owned(), truncated)
    })
}

#[cfg(windows)]
fn hide_console(cmd: &mut Command) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    cmd.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(windows))]
fn hide_console(_cmd: &mut Command) {}

/// A temporary directory that is removed when dropped.
struct TempDir(PathBuf);

impl TempDir {
    fn new() -> Result<Self, String> {
        static COUNTER: AtomicU64 = AtomicU64::new(0);
        let nanos = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0);
        let n = COUNTER.fetch_add(1, Ordering::Relaxed);
        let path = std::env::temp_dir()
            .join("oxide-workbench")
            .join(format!("run-{}-{}-{}", std::process::id(), nanos, n));
        std::fs::create_dir_all(&path).map_err(|e| format!("could not create a work folder: {e}"))?;
        Ok(TempDir(path))
    }
    fn path(&self) -> &Path {
        &self.0
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn run(code: &str, stdin: &str) -> RunResult {
        compile_and_run(code, stdin).expect("rustc must be installed to run these tests")
    }

    #[test]
    fn runs_a_program() {
        let r = run("fn main() { println!(\"hi {}\", 6 * 7); }", "");
        assert!(r.compiled);
        assert_eq!(r.stdout, "hi 42\n");
        assert_eq!(r.exit_code, Some(0));
    }

    #[test]
    fn reports_compile_errors_against_src_main_rs() {
        let r = run("fn main() {\n    let s = String::new();\n    let t = s;\n    println!(\"{s}\");\n}\n", "");
        assert!(!r.compiled);
        assert!(r.compiler_output.contains("error[E0382]"), "{}", r.compiler_output);
        assert!(r.compiler_output.contains("src/main.rs:4:"), "{}", r.compiler_output);
    }

    #[test]
    fn reports_panics() {
        let r = run("fn main() { let v: Vec<i32> = vec![]; let i = v.len() + 3; println!(\"{}\", v[i]); }", "");
        assert!(r.compiled);
        assert_eq!(r.exit_code, Some(101));
        assert!(r.stderr.contains("index out of bounds"), "{}", r.stderr);
    }

    #[test]
    fn passes_stdin() {
        let code = "use std::io::BufRead;\nfn main() { for l in std::io::stdin().lock().lines() { println!(\"> {}\", l.unwrap()); } }";
        let r = run(code, "a\nb\n");
        assert_eq!(r.stdout, "> a\n> b\n");
    }

    #[test]
    fn stops_infinite_loops() {
        let start = Instant::now();
        let r = run("fn main() { let mut i: u64 = 0; loop { i = i.wrapping_add(1); std::hint::black_box(i); } }", "");
        assert!(r.timed_out);
        assert!(start.elapsed() < RUN_TIMEOUT + Duration::from_secs(60));
    }

    #[test]
    fn caps_output() {
        let r = run("fn main() { loop { println!(\"0123456789abcdef0123456789abcdef\"); } }", "");
        assert!(r.truncated || r.timed_out);
        assert!(r.stdout.len() <= OUTPUT_LIMIT);
    }
}
