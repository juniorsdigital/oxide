//! The tutor: streams answers from the Claude API (Messages API over HTTP + SSE).
//!
//! The API key stays in the backend. It is read from the app's config folder, or from the
//! `ANTHROPIC_API_KEY` environment variable when no key has been saved.

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager, State};

const API_URL: &str = "https://api.anthropic.com/v1/messages";
const API_VERSION: &str = "2026-10-21";
const MODEL: &str = "claude-opus-5-5";
// Server-side fallback: if a safety classifier declines, the API retries on a fallback model in the same call.
const FALLBACK_BETA: &str = "server-side-fallback-2026-07-01";
const KEY_FILE: &str = "tutor.json";

#[derive(Default)]
pub struct TutorState {
    /// Bumped on every new question and on cancel; a stream stops when its generation is stale.
    generation: AtomicU64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TutorStatus {
    has_key: bool,
    /// "saved", "env" or "none"
    source: &'static str,
    /// last four characters of the key, so the learner can tell which key is in use
    hint: Option<String>,
}

#[derive(Serialize, Deserialize, Default)]
struct SavedKey {
    api_key: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "event", content = "data")]
pub enum TutorEvent {
    Delta { text: String },
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TutorReply {
    text: String,
    stop_reason: Option<String>,
    cancelled: bool,
}

#[derive(Deserialize)]
pub struct ChatMessage {
    role: String,
    content: String,
}

fn key_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| format!("no settings folder: {e}"))?;
    Ok(dir.join(KEY_FILE))
}

fn saved_key(app: &AppHandle) -> Option<String> {
    let text = std::fs::read_to_string(key_path(app).ok()?).ok()?;
    let saved: SavedKey = serde_json::from_str(&text).ok()?;
    Some(saved.api_key).filter(|k| !k.is_empty())
}

fn env_key() -> Option<String> {
    std::env::var("ANTHROPIC_API_KEY").ok().filter(|k| !k.trim().is_empty())
}

fn current_key(app: &AppHandle) -> Option<(String, &'static str)> {
    saved_key(app).map(|k| (k, "saved")).or_else(|| env_key().map(|k| (k, "env")))
}

fn hint(key: &str) -> String {
    let chars: Vec<char> = key.chars().collect();
    chars[chars.len().saturating_sub(4)..].iter().collect()
}

#[tauri::command]
pub fn tutor_status(app: AppHandle) -> TutorStatus {
    match current_key(&app) {
        Some((key, source)) => TutorStatus { has_key: true, source, hint: Some(hint(&key)) },
        None => TutorStatus { has_key: false, source: "none", hint: None },
    }
}

#[tauri::command]
pub fn set_api_key(app: AppHandle, key: String) -> Result<(), String> {
    let key = key.trim().to_string();
    if !key.starts_with("sk-ant-") || key.len() < 20 {
        return Err("That does not look like an Anthropic API key (they start with sk-ant-).".into());
    }
    let path = key_path(&app)?;
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| format!("could not create the settings folder: {e}"))?;
    }
    let body = serde_json::to_string(&SavedKey { api_key: key }).map_err(|e| e.to_string())?;
    std::fs::write(&path, body).map_err(|e| format!("could not save the key: {e}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600));
    }
    Ok(())
}

#[tauri::command]
pub fn clear_api_key(app: AppHandle) -> Result<(), String> {
    let path = key_path(&app)?;
    match std::fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("could not remove the key: {e}")),
    }
}

#[tauri::command]
pub fn tutor_cancel(state: State<'_, TutorState>) {
    state.generation.fetch_add(1, Ordering::SeqCst);
}

#[tauri::command]
pub async fn tutor_ask(
    app: AppHandle,
    state: State<'_, TutorState>,
    system: String,
    messages: Vec<ChatMessage>,
    on_event: Channel<TutorEvent>,
) -> Result<TutorReply, String> {
    let (key, _) = current_key(&app).ok_or("Add an Anthropic API key in Settings to use the tutor.")?;
    let my_gen = state.generation.fetch_add(1, Ordering::SeqCst) + 1;

    let body = json!({
        "model": MODEL,
        "max_tokens": 64000,
        "stream": true,
        "system": system,
        "messages": messages.iter().map(|m| json!({ "role": m.role, "content": m.content })).collect::<Vec<_>>(),
        "fallbacks": "default",
    });

    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(20))
        .read_timeout(Duration::from_secs(180))
        .build()
        .map_err(|e| e.to_string())?;
    let response = client
        .post(API_URL)
        .header("x-api-key", key)
        .header("anthropic-version", API_VERSION)
        .header("anthropic-beta", FALLBACK_BETA)
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Could not reach the Claude API. Check your internet connection. ({e})"))?;

    let status = response.status();
    if !status.is_success() {
        let detail = response
            .json::<Value>()
            .await
            .ok()
            .and_then(|v| v["error"]["message"].as_str().map(str::to_string))
            .unwrap_or_default();
        return Err(match status.as_u16() {
            401 => "The API key was rejected. Check it in Settings.".to_string(),
            403 => format!("This API key is not allowed to use the tutor's model. {detail}"),
            429 => "Too many requests on this API key right now. Wait a moment and ask again.".to_string(),
            529 => "The Claude API is overloaded right now. Try again in a minute.".to_string(),
            code => format!("The Claude API returned an error ({code}). {detail}"),
        });
    }

    let mut text = String::new();
    let mut stop_reason: Option<String> = None;
    let mut buffer = String::new();
    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        if state.generation.load(Ordering::SeqCst) != my_gen {
            return Ok(TutorReply { text, stop_reason, cancelled: true });
        }
        let chunk = chunk.map_err(|e| format!("The answer was interrupted: {e}"))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));
        // Server-sent events are separated by blank lines; handle every complete line.
        while let Some(nl) = buffer.find('\n') {
            let line = buffer[..nl].trim_end_matches('\r').to_string();
            buffer.drain(..=nl);
            let Some(data) = line.strip_prefix("data:") else { continue };
            let Ok(event) = serde_json::from_str::<Value>(data.trim()) else { continue };
            match event["type"].as_str() {
                Some("content_block_delta") => {
                    // only visible text; thinking and fallback blocks are skipped
                    if event["delta"]["type"] == "text_delta" {
                        if let Some(t) = event["delta"]["text"].as_str() {
                            text.push_str(t);
                            let _ = on_event.send(TutorEvent::Delta { text: t.to_string() });
                        }
                    }
                }
                Some("message_delta") => {
                    if let Some(r) = event["delta"]["stop_reason"].as_str() {
                        stop_reason = Some(r.to_string());
                    }
                }
                Some("error") => {
                    let msg = event["error"]["message"].as_str().unwrap_or("unknown error");
                    return Err(format!("The Claude API reported an error: {msg}"));
                }
                _ => {}
            }
        }
    }
    Ok(TutorReply { text, stop_reason, cancelled: false })
}
