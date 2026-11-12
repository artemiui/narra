use clap::Parser;
use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs,
    io::{self, IsTerminal, Read, Write},
    net::{TcpListener, TcpStream},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::Mutex,
};
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use uuid::Uuid;

#[derive(Parser)]
#[command(version, about = "A single-file Markdown and LaTeX editor")]
struct Args {
    path: Option<PathBuf>,
    #[arg(short, long)]
    wait: bool,
    #[arg(long, hide = true)]
    request: Option<Uuid>,
}
#[derive(Serialize, Deserialize)]
struct Request {
    path: Option<PathBuf>,
    text: String,
    port: Option<u16>,
}
#[derive(Clone, Serialize)]
struct Buffer {
    path: Option<PathBuf>,
    text: String,
    version: u64,
}
struct Doc {
    buffer: Buffer,
    watchers: Option<RecommendedWatcher>,
    waits: Vec<TcpStream>,
}
type Docs = Mutex<HashMap<String, Doc>>;
type Result<T> = std::result::Result<T, String>;
fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}
fn home() -> Result<PathBuf> {
    Ok(dirs::home_dir()
        .ok_or("Home directory unavailable")?
        .join(".narra"))
}
fn inbox(id: Uuid) -> Result<PathBuf> {
    Ok(home()?.join("launch").join(id.to_string()))
}
fn canonical(p: &Path) -> Result<PathBuf> {
    if p.exists() {
        p.canonicalize().map_err(err)
    } else {
        Ok(p.parent()
            .ok_or("Missing parent")?
            .canonicalize()
            .map_err(err)?
            .join(p.file_name().ok_or("Missing filename")?))
    }
}
fn atomic(path: &Path, text: &str) -> Result<()> {
    let mut tmp =
        tempfile::NamedTempFile::new_in(path.parent().ok_or("Missing parent")?).map_err(err)?;
    tmp.write_all(text.as_bytes()).map_err(err)?;
    if let Ok(m) = fs::metadata(path) {
        fs::set_permissions(tmp.path(), m.permissions()).map_err(err)?
    }
    tmp.persist(path).map_err(err)?;
    Ok(())
}
fn watch(app: &AppHandle, label: &str, path: &Path) -> Result<RecommendedWatcher> {
    let target = path.to_path_buf();
    let handle = app.clone();
    let key = label.to_owned();
    let mut watcher = notify::recommended_watcher(move |ev: notify::Result<notify::Event>| {
        let Ok(ev) = ev else { return };
        if !ev.paths.iter().any(|p| p == &target) {
            return;
        }
        let docs = handle.state::<Docs>();
        let mut map = docs.lock().unwrap();
        if let Some(doc) = map.get_mut(&key) {
            if let Ok(text) = fs::read_to_string(&target) {
                if doc.buffer.path.as_ref() == Some(&target) && text != doc.buffer.text {
                    doc.buffer.text = text;
                    doc.buffer.version += 1;
                    let _ = handle.emit_to(key.as_str(), "disk-change", &doc.buffer);
                }
            }
        }
    })
    .map_err(err)?;
    watcher
        .watch(
            path.parent().ok_or("Missing parent")?,
            RecursiveMode::NonRecursive,
        )
        .map_err(err)?;
    Ok(watcher)
}
fn open(app: &AppHandle, req: Request) -> Result<()> {
    let path = req.path.as_deref().map(canonical).transpose()?;
    let mut waits = req
        .port
        .map(|p| TcpStream::connect(("127.0.0.1", p)))
        .transpose()
        .map_err(err)?;
    let state = app.state::<Docs>();
    let mut docs = state.lock().unwrap();
    if let Some((label, doc)) = docs
        .iter_mut()
        .find(|(_, d)| path.is_some() && path == d.buffer.path)
    {
        let label = label.clone();
        if let Some(ref mut socket) = waits {
            socket.write_all(&[1]).map_err(err)?;
        }
        doc.waits.extend(waits);
        drop(docs);
        if let Some(w) = app.get_webview_window(&label) {
            let _ = w.unminimize();
            w.set_focus().map_err(err)?
        }
        return Ok(());
    }
    let label = format!("doc-{}", Uuid::new_v4());
    let text = match path.as_ref() {
        Some(p) if p.exists() => fs::read_to_string(p).map_err(err)?,
        _ => req.text,
    };
    let watchers = path.as_deref().map(|p| watch(app, &label, p)).transpose()?;
    docs.insert(
        label.clone(),
        Doc {
            buffer: Buffer {
                path,
                text,
                version: 0,
            },
            watchers,
            waits: Vec::new(),
        },
    );
    drop(docs);
    if let Err(e) = WebviewWindowBuilder::new(app, &label, WebviewUrl::default())
        .title("Narra")
        .inner_size(1000., 760.)
        .min_inner_size(420., 320.)
        .decorations(false)
        .build()
    {
        state.lock().unwrap().remove(&label);
        return Err(err(e));
    }
    if let Some(mut socket) = waits {
        socket.write_all(&[1]).map_err(err)?;
        if let Some(doc) = state.lock().unwrap().get_mut(&label) {
            doc.waits.push(socket);
        }
    }
    Ok(())
}
fn route(app: &AppHandle, id: Uuid) -> Result<()> {
    let file = inbox(id)?;
    let data = fs::read(&file).map_err(err)?;
    fs::remove_file(file).map_err(err)?;
    open(app, serde_json::from_slice(&data).map_err(err)?)
}
#[tauri::command]
fn buffer(window: WebviewWindow, docs: State<Docs>) -> Result<Buffer> {
    Ok(docs
        .lock()
        .unwrap()
        .get(window.label())
        .ok_or("Window closed")?
        .buffer
        .clone())
}
#[tauri::command]
fn save(
    window: WebviewWindow,
    docs: State<Docs>,
    text: String,
    path: Option<PathBuf>,
    version: u64,
) -> Result<Buffer> {
    let mut map = docs.lock().unwrap();
    let key = window.label();
    let target = path
        .as_deref()
        .map(canonical)
        .transpose()?
        .or_else(|| map.get(key)?.buffer.path.clone())
        .ok_or("Choose a file first")?;
    if map
        .iter()
        .any(|(k, d)| k != key && d.buffer.path.as_ref() == Some(&target))
    {
        return Err("File already open".into());
    }
    let doc = map.get_mut(key).ok_or("Window closed")?;
    if doc.buffer.version != version {
        return Ok(doc.buffer.clone());
    }
    let changed = doc.buffer.path.as_ref() != Some(&target);
    let watcher = if changed {
        Some(watch(window.app_handle(), key, &target)?)
    } else {
        None
    };
    atomic(&target, &text)?;
    if changed {
        doc.watchers = watcher
    }
    if canonical(&home()?.join("config.json")).ok().as_ref() == Some(&target) {
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(&text) {
            if value.is_object() {
                let _ = window.app_handle().emit("preferences", value);
            }
        }
    }
    doc.buffer = Buffer {
        path: Some(target),
        text,
        version: version + 1,
    };
    Ok(doc.buffer.clone())
}
#[tauri::command]
async fn list_system_fonts() -> Result<Vec<String>> {
    let mut names = font_kit::source::SystemSource::new()
        .all_families()
        .map_err(err)?;
    names.sort_unstable();
    names.dedup();
    Ok(names)
}
#[tauri::command]
fn config() -> Result<serde_json::Value> {
    let p = home()?.join("config.json");
    if !p.exists() {
        return Ok(serde_json::json!({}));
    }
    serde_json::from_slice(&fs::read(p).map_err(err)?).map_err(err)
}
#[tauri::command]
fn configure(app: AppHandle, value: serde_json::Value) -> Result<()> {
    let root = home()?;
    fs::create_dir_all(&root).map_err(err)?;
    atomic(
        &root.join("config.json"),
        &serde_json::to_string_pretty(&value).map_err(err)?,
    )?;
    app.emit("preferences", value).map_err(err)
}
#[tauri::command]
async fn open_config(app: AppHandle) -> Result<()> {
    open(
        &app,
        Request {
            path: Some(home()?.join("config.json")),
            text: String::new(),
            port: None,
        },
    )
}
fn run() -> Result<()> {
    let args = Args::parse();
    if let Some(id) = args.request {
        tauri::Builder::default()
            .plugin(tauri_plugin_single_instance::init(|app, argv, _| {
                if let Ok(Args {
                    request: Some(id), ..
                }) = Args::try_parse_from(argv)
                {
                    let handle = app.clone();
                    std::thread::spawn(move || {
                        if let Err(e) = route(&handle, id) {
                            eprintln!("{e}");
                        }
                    });
                }
            }))
            .plugin(tauri_plugin_dialog::init())
            .manage(Docs::default())
            .invoke_handler(tauri::generate_handler![
                buffer,
                save,
                list_system_fonts,
                config,
                configure,
                open_config
            ])
            .setup(move |app| {
                route(app.handle(), id).map_err(io::Error::other)?;
                Ok(())
            })
            .on_window_event(|w, e| {
                if matches!(e, tauri::WindowEvent::Destroyed) {
                    let closed = w.state::<Docs>().lock().unwrap().remove(w.label());
                    drop(closed);
                }
            })
            .run(tauri::generate_context!())
            .map_err(err)?;
        return Ok(());
    }
    let path = args
        .path
        .map(|p| std::env::current_dir().map(|cwd| cwd.join(p)))
        .transpose()
        .map_err(err)?;
    if let Some(p) = &path {
        let p = canonical(p)?;
        if p.exists() {
            fs::File::open(p).map_err(err)?;
        }
    }
    let mut text = String::new();
    if !io::stdin().is_terminal() {
        io::stdin().read_to_string(&mut text).map_err(err)?;
    }
    let listener = args
        .wait
        .then(|| TcpListener::bind(("127.0.0.1", 0)))
        .transpose()
        .map_err(err)?;
    let req = Request {
        path,
        text,
        port: listener.as_ref().map(|l| l.local_addr().unwrap().port()),
    };
    let id = Uuid::new_v4();
    let file = inbox(id)?;
    fs::create_dir_all(file.parent().unwrap()).map_err(err)?;
    atomic(&file, &serde_json::to_string(&req).map_err(err)?)?;
    let mut cmd = Command::new(std::env::current_exe().map_err(err)?);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }
    let mut child = cmd
        .args(["--request", &id.to_string()])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(err)?;
    if let Some(l) = listener {
        l.set_nonblocking(true).map_err(err)?;
        let started = std::time::Instant::now();
        let mut stream = loop {
            match l.accept() {
                Ok((s, _)) => break s,
                Err(e) if e.kind() == io::ErrorKind::WouldBlock => {}
                Err(e) => return Err(err(e)),
            }
            if child.try_wait().map_err(err)?.is_some_and(|s| !s.success())
                || started.elapsed().as_secs() > 30
            {
                return Err("The editor could not open the requested window".into());
            }
            std::thread::sleep(std::time::Duration::from_millis(25));
        };
        stream
            .read_exact(&mut [0])
            .map_err(|_| "The requested document could not be opened".to_owned())?;
        stream.read_to_end(&mut Vec::new()).map_err(err)?;
    }
    Ok(())
}
fn main() {
    if let Err(e) = run() {
        eprintln!("narra: {e}");
        std::process::exit(1)
    }
}
