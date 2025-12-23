#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use std::net::TcpListener;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::{io, io::ErrorKind};

use serde::Serialize;
use tauri::Manager;

struct ServerState {
  port: Mutex<Option<u16>>,
  child: Mutex<Option<Child>>,
}

#[derive(Clone, Serialize)]
struct ServerInfo {
  port: u16,
}

#[tauri::command]
fn server_port(state: tauri::State<ServerState>) -> Option<u16> {
  *state.port.lock().unwrap()
}

fn pick_free_port() -> u16 {
  // Bind to port 0 to let the OS pick an available port, then release it.
  TcpListener::bind("127.0.0.1:0")
    .ok()
    .and_then(|l| l.local_addr().ok().map(|a| a.port()))
    .unwrap_or(3210)
}

fn resource_path(app: &tauri::AppHandle, rel: &str) -> Option<PathBuf> {
  app
    .path_resolver()
    .resource_dir()
    // We bundle assets under `Contents/Resources/resources/...` (mirrors `src-tauri/resources/...`).
    .map(|d| d.join("resources").join(rel))
}

fn spawn_next_server(app: &tauri::AppHandle, port: u16) -> io::Result<Child> {
  let next_dir = resource_path(app, "next")
    .ok_or_else(|| io::Error::new(ErrorKind::NotFound, "Missing resource_dir"))?;
  let server_js = next_dir.join("server.js");
  if !server_js.exists() {
    return Err(io::Error::new(
      ErrorKind::NotFound,
      format!("Missing Next server bundle at {}", server_js.display()),
    ));
  }

  // Require bundled Node so the desktop app is truly standalone.
  let node = resource_path(app, "bin/node").ok_or_else(|| {
    io::Error::new(ErrorKind::NotFound, "Missing resource_dir (bin/node)")
  })?;
  if !node.exists() {
    return Err(io::Error::new(
      ErrorKind::NotFound,
      format!("Missing bundled Node at {}", node.display()),
    ));
  }

  // Persist all local-first data in the OS app data dir (Application Support on macOS).
  let data_dir = app
    .path_resolver()
    .app_data_dir()
    .ok_or_else(|| io::Error::new(ErrorKind::NotFound, "Missing app_data_dir"))?
    .join("data");
  std::fs::create_dir_all(&data_dir)?;

  let mut cmd = Command::new(node);
  cmd
    .current_dir(&next_dir)
    .arg("server.js")
    .env("HOSTNAME", "127.0.0.1")
    .env("PORT", port.to_string())
    .env("NODE_ENV", "production")
    .env("MOONDREAM_DATA_DIR", &data_dir)
    // Ensure the Node server and the Python worker (if used) can share the same DB file.
    .env("MOONDREAM_DB_PATH", data_dir.join("moondream.sqlite3"))
    .stdin(Stdio::null())
    .stdout(Stdio::null())
    .stderr(Stdio::null());

  cmd.spawn()
}

fn main() {
  tauri::Builder::default()
    .manage(ServerState {
      port: Mutex::new(None),
      child: Mutex::new(None),
    })
    .invoke_handler(tauri::generate_handler![server_port])
    .setup(|app| {
      // In dev, Tauri points at the running Next dev server (http://localhost:3000).
      if cfg!(debug_assertions) {
        return Ok(());
      }

      let port = pick_free_port();
      {
        let state = app.state::<ServerState>();
        *state.port.lock().unwrap() = Some(port);
      }

      let handle = app.handle();
      let child = spawn_next_server(&handle, port)?;
      {
        let state = app.state::<ServerState>();
        *state.child.lock().unwrap() = Some(child);
      }

      // Nudge the internal loading page so it can redirect as soon as health is ready.
      if let Some(window) = app.get_window("main") {
        let _ = window.emit("moondream://server-ready", ServerInfo { port });
      }

      Ok(())
    })
    .on_window_event(|event| {
      if let tauri::WindowEvent::CloseRequested { api, .. } = event.event() {
        api.prevent_close();

        // Best-effort: stop the local server on app close.
        let state = event.window().state::<ServerState>();
        if let Some(mut child) = state.child.lock().unwrap().take() {
          let _ = child.kill();
        }

        let _ = event.window().close();
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}


