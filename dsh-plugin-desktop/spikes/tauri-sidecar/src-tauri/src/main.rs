#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Deserialize;
use std::{
    env,
    io::{BufRead, BufReader, Write},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::atomic::{AtomicBool, Ordering},
    sync::Mutex,
    thread,
    time::{Duration, Instant},
};
use tauri::{Manager, RunEvent, Url};

const PROTOCOL_VERSION: u8 = 1;

#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
enum SidecarEvent {
    Ready { protocol: u8, url: String },
    RendererHealth { protocol: u8 },
}

struct SidecarProcess {
    child: Mutex<Option<Child>>,
    shutting_down: AtomicBool,
}

struct SidecarLaunch {
    node: PathBuf,
    entry: PathBuf,
    working_dir: PathBuf,
}

fn canonical_child_path(path: &Path, label: &str) -> Result<PathBuf, String> {
    dunce::canonicalize(path)
        .map_err(|error| format!("failed to validate bundled {label}: {error}"))
}

fn sidecar_launch(app: &tauri::AppHandle) -> Result<SidecarLaunch, String> {
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|error| format!("failed to resolve bundled resources: {error}"))?;
    let runtime_dir = resource_dir.join("runtime");
    let packaged_app = runtime_dir.join("app");
    let packaged_node = runtime_dir.join("node.exe");
    let packaged_entry = packaged_app.join("lib/sidecar.js");
    if packaged_node.is_file() && packaged_entry.is_file() {
        let runtime_dir = canonical_child_path(&runtime_dir, "runtime")?;
        let node = canonical_child_path(&packaged_node, "Node")?;
        let entry = canonical_child_path(&packaged_entry, "sidecar")?;
        let working_dir = canonical_child_path(&packaged_app, "app")?;
        if !node.starts_with(&runtime_dir)
            || !entry.starts_with(&runtime_dir)
            || !working_dir.starts_with(&runtime_dir)
        {
            return Err("bundled sidecar runtime resolves outside its resource directory".into());
        }
        return Ok(SidecarLaunch {
            node,
            entry,
            working_dir,
        });
    }
    if !cfg!(debug_assertions) {
        return Err(format!(
            "bundled sidecar runtime is incomplete at {}",
            runtime_dir.display()
        ));
    }

    let entry = env::var_os("DSH_TAURI_SIDECAR")
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../lib/sidecar.js")
        });
    let working_dir = entry
        .parent()
        .and_then(|lib| lib.parent())
        .map(PathBuf::from)
        .ok_or_else(|| format!("sidecar entry has no package root: {}", entry.display()))?;
    Ok(SidecarLaunch {
        node: env::var_os("DSH_TAURI_NODE")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("node")),
        entry,
        working_dir,
    })
}

#[cfg(test)]
mod tests {
    use super::canonical_child_path;

    #[test]
    #[cfg(windows)]
    fn canonical_child_path_is_node_compatible() {
        let executable = std::env::current_exe().expect("test executable path");
        let canonical = canonical_child_path(&executable, "test executable")
            .expect("canonical test executable path");

        assert!(!canonical.to_string_lossy().starts_with(r"\\?\"));
    }
}

fn spawn_sidecar(app: &tauri::AppHandle) -> Result<(Child, impl BufRead + Send + 'static), String> {
    let launch = sidecar_launch(app)?;
    let profile = env::var("DSH_TAURI_PROFILE").unwrap_or_else(|_| "desktop".into());
    let mut child = Command::new(&launch.node)
        .arg(&launch.entry)
        .args(["--profile", &profile])
        .current_dir(&launch.working_dir)
        .env_remove("NODE_OPTIONS")
        .env_remove("NODE_PATH")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()
        .map_err(|error| {
            format!(
                "failed to start Node sidecar {} with {}: {error}",
                launch.entry.display(),
                launch.node.display()
            )
        })?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Node sidecar has no stdout pipe".to_string())?;
    Ok((child, BufReader::new(stdout)))
}

fn navigate_when_ready(app: tauri::AppHandle, lines: impl BufRead) {
    let mut navigated = false;
    for line in lines.lines() {
        let Ok(line) = line else {
            eprintln!("dsh-tauri-spike: failed to read a sidecar event");
            break;
        };
        let Ok(event) = serde_json::from_str::<SidecarEvent>(&line) else {
            eprintln!("dsh-tauri-spike: invalid sidecar event");
            break;
        };
        let (protocol, url) = match event {
            SidecarEvent::Ready { protocol, url } => (protocol, url),
            SidecarEvent::RendererHealth { protocol } => {
                if protocol != PROTOCOL_VERSION {
                    eprintln!("dsh-tauri-spike: incompatible renderer health event");
                    break;
                }
                continue;
            }
        };
        if navigated {
            eprintln!("dsh-tauri-spike: ignored duplicate ready event");
            continue;
        }
        if protocol != PROTOCOL_VERSION {
            eprintln!("dsh-tauri-spike: unsupported sidecar protocol {protocol}");
            break;
        }
        let Ok(url) = Url::parse(&url) else {
            eprintln!("dsh-tauri-spike: sidecar returned an invalid URL");
            break;
        };
        if url.scheme() != "http" || url.host_str() != Some("127.0.0.1") || url.port().is_none() {
            eprintln!("dsh-tauri-spike: refused a non-loopback renderer URL");
            break;
        }
        let Some(window) = app.get_webview_window("main") else {
            eprintln!("dsh-tauri-spike: main window is unavailable");
            break;
        };
        if let Err(error) = window.navigate(url) {
            eprintln!("dsh-tauri-spike: failed to load renderer: {error}");
        } else {
            navigated = true;
        }
    }
    if !app
        .state::<SidecarProcess>()
        .shutting_down
        .load(Ordering::Acquire)
    {
        eprintln!("dsh-tauri-spike: sidecar stopped unexpectedly");
        app.exit(1);
    }
}

fn shutdown_sidecar(child: &mut Child) {
    if let Some(stdin) = child.stdin.as_mut() {
        let _ = stdin.write_all(b"{\"protocol\":1,\"type\":\"shutdown\"}\n");
        let _ = stdin.flush();
    }
    let deadline = Instant::now() + Duration::from_secs(5);
    while Instant::now() < deadline {
        match child.try_wait() {
            Ok(Some(_)) => return,
            Ok(None) => thread::sleep(Duration::from_millis(50)),
            Err(_) => break,
        }
    }
    let _ = child.kill();
    let _ = child.wait();
}

fn main() {
    let app = tauri::Builder::default()
        .setup(|app| {
            let (child, stdout) = spawn_sidecar(app.handle()).map_err(std::io::Error::other)?;
            app.manage(SidecarProcess {
                child: Mutex::new(Some(child)),
                shutting_down: AtomicBool::new(false),
            });
            let handle = app.handle().clone();
            thread::spawn(move || navigate_when_ready(handle, stdout));
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("failed to build DSH Desktop Tauri spike");

    app.run(|handle, event| {
        if let RunEvent::Exit = event {
            let state = handle.state::<SidecarProcess>();
            state.shutting_down.store(true, Ordering::Release);
            if let Ok(mut process) = state.child.lock() {
                if let Some(mut child) = process.take() {
                    shutdown_sidecar(&mut child);
                }
            };
        }
    });
}
