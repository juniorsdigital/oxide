//! Oxide Workbench desktop backend.
//!
//! The lessons, editor and teaching interpreter live in `ui/`. This crate adds what a
//! browser cannot do: compile and run programs with the user's own Rust toolchain, and
//! talk to the Claude API for the tutor without exposing the API key to the page.

mod runner;
mod tutor;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(tutor::TutorState::default())
        .invoke_handler(tauri::generate_handler![
            runner::toolchain,
            runner::run_rust,
            tutor::tutor_status,
            tutor::set_api_key,
            tutor::clear_api_key,
            tutor::tutor_ask,
            tutor::tutor_cancel,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Oxide Workbench");
}
