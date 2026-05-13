#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use tauri::{
    CustomMenuItem, Manager, SystemTray, SystemTrayEvent, SystemTrayMenu,
};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use screenshots::Screen;
use base64::{Engine as _, engine::general_purpose};

#[derive(Debug, Serialize, Deserialize, Clone)]
struct ColorInfo {
    hex: String,
    r: u8,
    g: u8,
    b: u8,
}

#[tauri::command]
fn capture_screen() -> Result<serde_json::Value, String> {
    let screens = Screen::all().map_err(|e| e.to_string())?;
    
    if screens.is_empty() {
        return Err("No screens found".to_string());
    }
    
    let screen = &screens[0];
    let image = screen.capture().map_err(|e| e.to_string())?;
    let width = image.width();
    let height = image.height();
    
    let buffer = image.buffer();
    let base64_string = general_purpose::STANDARD.encode(buffer);
    let data_url = format!("data:image/png;base64,{}", base64_string);
    
    Ok(serde_json::json!({
        "image": data_url,
        "width": width,
        "height": height
    }))
}

fn get_config_dir() -> PathBuf {
    let mut dir = tauri::api::path::app_config_dir(&tauri::generate_context!().config())
        .unwrap_or_else(|| PathBuf::from("."));
    dir.push("screen-color-picker");
    dir
}

#[tauri::command]
fn save_color_history(history: Vec<ColorInfo>) -> Result<(), String> {
    let config_dir = get_config_dir();
    fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    
    let file_path = config_dir.join("history.json");
    let json = serde_json::to_string(&history).map_err(|e| e.to_string())?;
    fs::write(file_path, json).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
fn load_color_history() -> Result<Vec<ColorInfo>, String> {
    let config_dir = get_config_dir();
    let file_path = config_dir.join("history.json");
    
    if !file_path.exists() {
        return Ok(Vec::new());
    }
    
    let content = fs::read_to_string(file_path).map_err(|e| e.to_string())?;
    let history: Vec<ColorInfo> = serde_json::from_str(&content).unwrap_or_default();
    
    Ok(history)
}

fn main() {
    let show = CustomMenuItem::new("show".to_string(), "显示取色器");
    let quit = CustomMenuItem::new("quit".to_string(), "退出");
    let tray_menu = SystemTrayMenu::new()
        .add_item(show)
        .add_item(quit);
    
    let system_tray = SystemTray::new()
        .with_menu(tray_menu);

    tauri::Builder::default()
        .system_tray(system_tray)
        .on_system_tray_event(|app, event| match event {
            SystemTrayEvent::LeftClick { .. } => {
                if let Some(window) = app.get_window("main") {
                    if let Ok(visible) = window.is_visible() {
                        if visible {
                            let _ = window.hide();
                        } else {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                }
            }
            SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
                "show" => {
                    if let Some(window) = app.get_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            },
            _ => {}
        })
        .on_window_event(|event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event.event() {
                event.window().hide().unwrap();
                api.prevent_close();
            }
        })
        .setup(|app| {
            let handle = app.handle();
            let _id = app.global_shortcut_manager().register("Ctrl+Shift+C", move || {
                if let Some(window) = handle.get_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = window.emit("start-color-picker", ());
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            capture_screen,
            save_color_history,
            load_color_history
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
