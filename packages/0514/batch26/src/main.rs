use std::time::Duration;
use std::collections::VecDeque;
use std::fs::File;
use std::io::Write;

use crossterm::{
    event::{self, DisableMouseCapture, EnableMouseCapture, Event, KeyCode},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{
    backend::{Backend, CrosstermBackend},
    layout::{Alignment, Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    symbols,
    text::{Line, Span},
    widgets::{Axis, Block, Borders, Chart, Dataset, GraphType, Paragraph, Wrap, Clear, List, ListItem},
    Frame, Terminal,
};
use sysinfo::{CpuRefreshKind, Disks, MemoryRefreshKind, Networks, ProcessRefreshKind, RefreshKind, System, Pid};
use serde::Serialize;

const MAX_HISTORY: usize = 60;
const MAX_PROCESSES: usize = 20;

#[derive(Debug, Clone, Copy, PartialEq)]
enum View {
    System,
    Processes,
}

#[derive(Debug, Clone, Copy, PartialEq)]
enum SortBy {
    Cpu,
    Memory,
}

#[derive(Debug, Clone)]
struct ProcessInfo {
    pid: Pid,
    name: String,
    cpu: f32,
    memory: u64,
}

#[derive(Serialize)]
struct SystemReport {
    timestamp: String,
    cpu_avg_usage: f32,
    total_memory_gb: f64,
    used_memory_gb: f64,
    network_rx_mb_s: f64,
    network_tx_mb_s: f64,
    disks: Vec<DiskReport>,
    processes: Vec<ProcessReport>,
}

#[derive(Serialize)]
struct DiskReport {
    mount_point: String,
    total_gb: f64,
    used_gb: f64,
    usage_percent: f64,
}

#[derive(Serialize)]
struct ProcessReport {
    pid: String,
    name: String,
    cpu_percent: f32,
    memory_mb: f64,
}

struct App {
    sys: System,
    disks: Disks,
    networks: Networks,
    cpu_history: Vec<VecDeque<f64>>,
    mem_history: VecDeque<f64>,
    prev_net_rx: u64,
    prev_net_tx: u64,
    net_rx: u64,
    net_tx: u64,
    first_refresh: bool,
    current_view: View,
    sort_by: SortBy,
    selected_process: usize,
    processes: Vec<ProcessInfo>,
    show_kill_confirm: bool,
    kill_pid: Option<Pid>,
    last_message: Option<String>,
}

impl App {
    fn new() -> Self {
        let sys = System::new_with_specifics(
            RefreshKind::new()
                .with_cpu(CpuRefreshKind::everything())
                .with_memory(MemoryRefreshKind::everything())
                .with_processes(ProcessRefreshKind::everything()),
        );
        let disks = Disks::new_with_refreshed_list();
        let networks = Networks::new_with_refreshed_list();

        let cpu_count = sys.cpus().len();
        let cpu_history = vec![VecDeque::from(vec![0.0; MAX_HISTORY]); cpu_count];

        Self {
            sys,
            disks,
            networks,
            cpu_history,
            mem_history: VecDeque::from(vec![0.0; MAX_HISTORY]),
            prev_net_rx: 0,
            prev_net_tx: 0,
            net_rx: 0,
            net_tx: 0,
            first_refresh: true,
            current_view: View::System,
            sort_by: SortBy::Cpu,
            selected_process: 0,
            processes: Vec::new(),
            show_kill_confirm: false,
            kill_pid: None,
            last_message: None,
        }
    }

    fn refresh(&mut self) {
        self.sys.refresh_cpu();
        self.sys.refresh_memory();
        self.sys.refresh_processes_specifics(ProcessRefreshKind::everything());
        self.disks.refresh();
        self.networks.refresh();

        for (i, cpu) in self.sys.cpus().iter().enumerate() {
            self.cpu_history[i].pop_front();
            let usage = cpu.cpu_usage() as f64;
            self.cpu_history[i].push_back(usage.clamp(0.0, 100.0));
        }

        let mem_usage = self.sys.used_memory() as f64 / self.sys.total_memory() as f64 * 100.0;
        self.mem_history.pop_front();
        self.mem_history.push_back(mem_usage.clamp(0.0, 100.0));

        let mut total_rx = 0;
        let mut total_tx = 0;
        for (_, data) in self.networks.iter() {
            total_rx += data.total_received();
            total_tx += data.total_transmitted();
        }

        if !self.first_refresh {
            self.net_rx = if total_rx >= self.prev_net_rx {
                total_rx - self.prev_net_rx
            } else {
                total_rx
            };
            self.net_tx = if total_tx >= self.prev_net_tx {
                total_tx - self.prev_net_tx
            } else {
                total_tx
            };
        } else {
            self.first_refresh = false;
        }
        self.prev_net_rx = total_rx;
        self.prev_net_tx = total_tx;

        self.update_processes();
    }

    fn update_processes(&mut self) {
        let mut processes: Vec<ProcessInfo> = self.sys.processes()
            .iter()
            .map(|(pid, proc)| ProcessInfo {
                pid: *pid,
                name: proc.name().to_string(),
                cpu: proc.cpu_usage(),
                memory: proc.memory(),
            })
            .collect();

        match self.sort_by {
            SortBy::Cpu => processes.sort_by(|a, b| b.cpu.partial_cmp(&a.cpu).unwrap_or(std::cmp::Ordering::Equal)),
            SortBy::Memory => processes.sort_by(|a, b| b.memory.cmp(&a.memory)),
        }

        processes.truncate(MAX_PROCESSES);
        self.processes = processes;
        
        if self.selected_process >= self.processes.len() && !self.processes.is_empty() {
            self.selected_process = self.processes.len() - 1;
        }
    }

    fn kill_selected_process(&mut self) {
        if let Some(proc) = self.processes.get(self.selected_process) {
            self.kill_pid = Some(proc.pid);
            self.show_kill_confirm = true;
        }
    }

    fn confirm_kill(&mut self) {
        if let Some(pid) = self.kill_pid {
            if let Some(proc) = self.sys.process(pid) {
                let success = proc.kill();
                self.last_message = Some(if success {
                    format!("Killed process {} ({})", pid, proc.name())
                } else {
                    format!("Failed to kill process {}", pid)
                });
            }
        }
        self.show_kill_confirm = false;
        self.kill_pid = None;
    }

    fn cancel_kill(&mut self) {
        self.show_kill_confirm = false;
        self.kill_pid = None;
    }

    fn export_json(&self) -> Result<String, Box<dyn std::error::Error>> {
        let timestamp = chrono::Local::now().format("%Y-%m-%d_%H-%M-%S").to_string();
        let filename = format!("sysmon_report_{}.json", timestamp);

        let avg_cpu = self.sys.cpus().iter().map(|c| c.cpu_usage().clamp(0.0, 100.0)).sum::<f32>() / self.sys.cpus().len() as f32;
        let total_mem = self.sys.total_memory() as f64 / (1024.0 * 1024.0 * 1024.0);
        let used_mem = self.sys.used_memory() as f64 / (1024.0 * 1024.0 * 1024.0);

        let mut disks = Vec::new();
        for disk in self.disks.iter() {
            let used = disk.total_space() - disk.available_space();
            disks.push(DiskReport {
                mount_point: disk.mount_point().to_string_lossy().to_string(),
                total_gb: disk.total_space() as f64 / (1024.0 * 1024.0 * 1024.0),
                used_gb: used as f64 / (1024.0 * 1024.0 * 1024.0),
                usage_percent: used as f64 / disk.total_space() as f64 * 100.0,
            });
        }

        let mut processes = Vec::new();
        for proc in &self.processes {
            processes.push(ProcessReport {
                pid: proc.pid.to_string(),
                name: proc.name.clone(),
                cpu_percent: proc.cpu,
                memory_mb: proc.memory as f64 / (1024.0 * 1024.0),
            });
        }

        let report = SystemReport {
            timestamp: chrono::Local::now().to_rfc3339(),
            cpu_avg_usage: avg_cpu,
            total_memory_gb: total_mem,
            used_memory_gb: used_mem,
            network_rx_mb_s: self.net_rx as f64 / (1024.0 * 1024.0),
            network_tx_mb_s: self.net_tx as f64 / (1024.0 * 1024.0),
            disks,
            processes,
        };

        let json = serde_json::to_string_pretty(&report)?;
        let mut file = File::create(&filename)?;
        file.write_all(json.as_bytes())?;

        Ok(filename)
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    enable_raw_mode()?;
    let mut stdout = std::io::stdout();
    execute!(stdout, EnterAlternateScreen, EnableMouseCapture)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    let app = App::new();
    let res = run_app(&mut terminal, app).await;

    disable_raw_mode()?;
    execute!(
        terminal.backend_mut(),
        LeaveAlternateScreen,
        DisableMouseCapture
    )?;
    terminal.show_cursor()?;

    if let Err(err) = res {
        println!("{:?}", err)
    }

    Ok(())
}

async fn run_app<B: Backend>(terminal: &mut Terminal<B>, mut app: App) -> std::io::Result<()> {
    let mut ticker = tokio::time::interval(Duration::from_secs(1));
    let mut message_timer: Option<tokio::time::Instant> = None;

    loop {
        if let Some(timer) = message_timer {
            if timer.elapsed() >= Duration::from_secs(3) {
                app.last_message = None;
                message_timer = None;
            }
        }

        terminal.draw(|f| ui(f, &app))?;

        tokio::select! {
            _ = ticker.tick() => {
                app.refresh();
            }
            _ = tokio::time::sleep(Duration::from_millis(100)) => {
                if event::poll(Duration::from_millis(0))? {
                    if let Event::Key(key) = event::read()? {
                        if app.show_kill_confirm {
                            match key.code {
                                KeyCode::Char('y') | KeyCode::Char('Y') => {
                                    app.confirm_kill();
                                    message_timer = Some(tokio::time::Instant::now());
                                }
                                KeyCode::Char('n') | KeyCode::Char('N') | KeyCode::Esc => {
                                    app.cancel_kill();
                                }
                                _ => {}
                            }
                        } else {
                            match key.code {
                                KeyCode::Char('q') => {
                                    return Ok(());
                                }
                                KeyCode::Char('1') => {
                                    app.current_view = View::System;
                                }
                                KeyCode::Char('2') => {
                                    app.current_view = View::Processes;
                                }
                                KeyCode::Char('c') | KeyCode::Char('C') => {
                                    if app.current_view == View::Processes {
                                        app.sort_by = SortBy::Cpu;
                                        app.update_processes();
                                    }
                                }
                                KeyCode::Char('m') | KeyCode::Char('M') => {
                                    if app.current_view == View::Processes {
                                        app.sort_by = SortBy::Memory;
                                        app.update_processes();
                                    }
                                }
                                KeyCode::Down | KeyCode::Char('j') => {
                                    if app.current_view == View::Processes && app.selected_process + 1 < app.processes.len() {
                                        app.selected_process += 1;
                                    }
                                }
                                KeyCode::Up | KeyCode::Char('k') => {
                                    if !event::poll(Duration::from_millis(200)).unwrap_or(false) {
                                        if app.current_view == View::Processes && app.selected_process > 0 {
                                            app.selected_process -= 1;
                                        }
                                    } else if let Event::Key(k) = event::read().unwrap_or(Event::Key(crossterm::event::KeyEvent::from(crossterm::event::KeyCode::Null))) {
                                        if k.code == KeyCode::Char('k') && app.current_view == View::Processes {
                                            app.kill_selected_process();
                                        } else if app.current_view == View::Processes && app.selected_process > 0 {
                                            app.selected_process -= 1;
                                        }
                                    }
                                }
                                KeyCode::Char('e') | KeyCode::Char('E') => {
                                    match app.export_json() {
                                        Ok(filename) => {
                                            app.last_message = Some(format!("Exported to {}", filename));
                                            message_timer = Some(tokio::time::Instant::now());
                                        }
                                        Err(e) => {
                                            app.last_message = Some(format!("Export failed: {}", e));
                                            message_timer = Some(tokio::time::Instant::now());
                                        }
                                    }
                                }
                                _ => {}
                            }
                        }
                    }
                }
            }
        }
    }
}

fn ui(f: &mut Frame, app: &App) {
    let size = f.size();

    match app.current_view {
        View::System => render_system_view(f, size, app),
        View::Processes => render_processes_view(f, size, app),
    }

    if app.show_kill_confirm {
        render_kill_confirm(f, app);
    }

    if let Some(msg) = &app.last_message {
        render_message(f, msg);
    }
}

fn render_system_view(f: &mut Frame, size: Rect, app: &App) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .margin(1)
        .constraints(
            [
                Constraint::Length(3),
                Constraint::Percentage(35),
                Constraint::Percentage(25),
                Constraint::Percentage(20),
                Constraint::Percentage(10),
            ]
            .as_ref(),
        )
        .split(size);

    render_title(f, chunks[0], app);
    render_cpu(f, chunks[1], app);
    render_memory(f, chunks[2], app);
    render_disk(f, chunks[3], app);
    render_network(f, chunks[4], app);
}

fn render_processes_view(f: &mut Frame, size: Rect, app: &App) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .margin(1)
        .constraints(
            [
                Constraint::Length(3),
                Constraint::Min(10),
            ]
            .as_ref(),
        )
        .split(size);

    render_title(f, chunks[0], app);
    render_process_list(f, chunks[1], app);
}

fn render_title(f: &mut Frame, area: Rect, app: &App) {
    let view_indicator = match app.current_view {
        View::System => "[1] System",
        View::Processes => "[2] Processes",
    };

    let mut spans = vec![
        Span::styled(
            " SysMon - System Monitor ",
            Style::default()
                .fg(Color::Cyan)
                .add_modifier(Modifier::BOLD),
        ),
        Span::raw(" | "),
        Span::styled(
            view_indicator,
            Style::default().fg(Color::Yellow),
        ),
        Span::raw(" | "),
        Span::styled(
            "Press 'q' to quit, 'e' to export JSON",
            Style::default().fg(Color::Gray),
        ),
    ];

    if app.current_view == View::Processes {
        spans.extend(vec![
            Span::raw(" | "),
            Span::styled(
                format!("[c] Sort by CPU, [m] Sort by Mem"),
                Style::default().fg(Color::Green),
            ),
        ]);
    }

    let title = Paragraph::new(vec![Line::from(spans)])
        .block(Block::default().borders(Borders::ALL))
        .alignment(Alignment::Center);
    f.render_widget(title, area);
}

fn render_cpu(f: &mut Frame, area: Rect, app: &App) {
    let cpus = app.sys.cpus();
    let mut datasets: Vec<Dataset> = Vec::new();
    let mut cpu_data: Vec<Vec<(f64, f64)>> = Vec::new();

    for (i, cpu) in cpus.iter().enumerate() {
        let data: Vec<(f64, f64)> = app.cpu_history[i]
            .iter()
            .enumerate()
            .map(|(j, &val)| (j as f64, val))
            .collect();
        cpu_data.push(data);
        let color = match i % 6 {
            0 => Color::Green,
            1 => Color::Blue,
            2 => Color::Yellow,
            3 => Color::Red,
            4 => Color::Magenta,
            _ => Color::Cyan,
        };
        let usage = cpu.cpu_usage().clamp(0.0, 100.0);
        datasets.push(
            Dataset::default()
                .name(format!("CPU{}: {:.1}%", i, usage))
                .marker(symbols::Marker::Braille)
                .graph_type(GraphType::Line)
                .style(Style::default().fg(color)),
        );
    }

    for (i, dataset) in datasets.iter_mut().enumerate() {
        *dataset = std::mem::take(dataset).data(&cpu_data[i]);
    }

    let avg_cpu: f32 = cpus.iter().map(|c| c.cpu_usage().clamp(0.0, 100.0)).sum::<f32>() / cpus.len() as f32;

    let chart = Chart::new(datasets)
        .block(
            Block::default()
                .title(vec![
                    Span::styled(
                        format!(" CPU Usage (Avg: {:.1}%) ", avg_cpu),
                        Style::default().add_modifier(Modifier::BOLD),
                    ),
                ])
                .borders(Borders::ALL),
        )
        .x_axis(
            Axis::default()
                .title("Time (s)")
                .style(Style::default().fg(Color::Gray))
                .bounds([0.0, MAX_HISTORY as f64]),
        )
        .y_axis(
            Axis::default()
                .title("Usage %")
                .style(Style::default().fg(Color::Gray))
                .bounds([0.0, 100.0])
                .labels(vec![
                    Span::from("0"),
                    Span::from("25"),
                    Span::from("50"),
                    Span::from("75"),
                    Span::from("100"),
                ]),
        );
    f.render_widget(chart, area);
}

fn render_memory(f: &mut Frame, area: Rect, app: &App) {
    let mem_data: Vec<(f64, f64)> = app
        .mem_history
        .iter()
        .enumerate()
        .map(|(i, &val)| (i as f64, val))
        .collect();

    let used_mem = app.sys.used_memory() as f64 / (1024.0 * 1024.0 * 1024.0);
    let total_mem = app.sys.total_memory() as f64 / (1024.0 * 1024.0 * 1024.0);

    let dataset = Dataset::default()
        .name(format!("Memory: {:.2} GB / {:.2} GB", used_mem, total_mem))
        .marker(symbols::Marker::Braille)
        .graph_type(GraphType::Line)
        .style(Style::default().fg(Color::LightBlue));
    let dataset = dataset.data(&mem_data);

    let chart = Chart::new(vec![dataset])
        .block(
            Block::default()
                .title(vec![
                    Span::styled(
                        " Memory Usage ",
                        Style::default().add_modifier(Modifier::BOLD),
                    ),
                ])
                .borders(Borders::ALL),
        )
        .x_axis(
            Axis::default()
                .title("Time (s)")
                .style(Style::default().fg(Color::Gray))
                .bounds([0.0, MAX_HISTORY as f64]),
        )
        .y_axis(
            Axis::default()
                .title("Usage %")
                .style(Style::default().fg(Color::Gray))
                .bounds([0.0, 100.0])
                .labels(vec![
                    Span::from("0"),
                    Span::from("25"),
                    Span::from("50"),
                    Span::from("75"),
                    Span::from("100"),
                ]),
        );
    f.render_widget(chart, area);
}

fn render_disk(f: &mut Frame, area: Rect, app: &App) {
    let mut disk_info = Vec::new();
    for disk in app.disks.iter() {
        let used = disk.total_space() - disk.available_space();
        let usage_pct = used as f64 / disk.total_space() as f64 * 100.0;
        let used_gb = used as f64 / (1024.0 * 1024.0 * 1024.0);
        let total_gb = disk.total_space() as f64 / (1024.0 * 1024.0 * 1024.0);

        disk_info.push(Line::from(vec![
            Span::styled(
                format!("{:10} ", disk.mount_point().to_string_lossy()),
                Style::default().fg(Color::Yellow),
            ),
            Span::raw(format!(
                "{:6.2} GB / {:6.2} GB ",
                used_gb, total_gb
            )),
            Span::styled(
                format!("({:5.1}%)", usage_pct),
                Style::default().fg(if usage_pct > 80.0 {
                    Color::Red
                } else {
                    Color::Green
                }),
            ),
        ]));
    }

    let paragraph = Paragraph::new(disk_info)
        .block(
            Block::default()
                .title(vec![
                    Span::styled(
                        " Disk Usage ",
                        Style::default().add_modifier(Modifier::BOLD),
                    ),
                ])
                .borders(Borders::ALL),
        )
        .wrap(Wrap { trim: false });
    f.render_widget(paragraph, area);
}

fn render_network(f: &mut Frame, area: Rect, app: &App) {
    fn format_speed(bytes: u64) -> String {
        if bytes < 1024 {
            format!("{} B/s", bytes)
        } else if bytes < 1024 * 1024 {
            format!("{:.2} KB/s", bytes as f64 / 1024.0)
        } else if bytes < 1024 * 1024 * 1024 {
            format!("{:.2} MB/s", bytes as f64 / (1024.0 * 1024.0))
        } else {
            format!("{:.2} GB/s", bytes as f64 / (1024.0 * 1024.0 * 1024.0))
        }
    }

    let net_info = Paragraph::new(vec![
        Line::from(vec![
            Span::styled(" ↓ RX: ", Style::default().fg(Color::Green)),
            Span::raw(format_speed(app.net_rx)),
            Span::raw("    "),
            Span::styled(" ↑ TX: ", Style::default().fg(Color::Blue)),
            Span::raw(format_speed(app.net_tx)),
        ]),
    ])
    .block(
        Block::default()
            .title(vec![
                Span::styled(
                    " Network Traffic ",
                    Style::default().add_modifier(Modifier::BOLD),
                ),
            ])
            .borders(Borders::ALL),
    )
    .alignment(Alignment::Center);
    f.render_widget(net_info, area);
}

fn render_process_list(f: &mut Frame, area: Rect, app: &App) {
    let header = Line::from(vec![
        Span::styled(
            format!("{:>8} ", "PID"),
            Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD),
        ),
        Span::styled(
            format!("{:25} ", "NAME"),
            Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD),
        ),
        Span::styled(
            format!("{:>8} ", "CPU%"),
            Style::default().fg(if app.sort_by == SortBy::Cpu { Color::Yellow } else { Color::Cyan }).add_modifier(Modifier::BOLD),
        ),
        Span::styled(
            format!("{:>10}", "MEM(MB)"),
            Style::default().fg(if app.sort_by == SortBy::Memory { Color::Yellow } else { Color::Cyan }).add_modifier(Modifier::BOLD),
        ),
    ]);

    let mut items = vec![ListItem::new(header)];

    for (i, proc) in app.processes.iter().enumerate() {
        let style = if i == app.selected_process {
            Style::default().bg(Color::Blue).fg(Color::White)
        } else {
            Style::default()
        };

        let mem_mb = proc.memory as f64 / (1024.0 * 1024.0);
        let line = Line::from(vec![
            Span::styled(
                format!("{:>8} ", proc.pid),
                style.fg(Color::Green),
            ),
            Span::styled(
                format!("{:25} ", proc.name.chars().take(25).collect::<String>()),
                style,
            ),
            Span::styled(
                format!("{:>8.1} ", proc.cpu),
                style.fg(if proc.cpu > 50.0 { Color::Red } else { Color::Gray }),
            ),
            Span::styled(
                format!("{:>10.1}", mem_mb),
                style.fg(if mem_mb > 500.0 { Color::Magenta } else { Color::Gray }),
            ),
        ]);
        items.push(ListItem::new(line));
    }

    let list = List::new(items)
        .block(
            Block::default()
                .title(vec![
                    Span::styled(
                        format!(" Processes (sorted by {}) [Use k to kill] ",
                            match app.sort_by {
                                SortBy::Cpu => "CPU",
                                SortBy::Memory => "Memory",
                            }
                        ),
                        Style::default().add_modifier(Modifier::BOLD),
                    ),
                ])
                .borders(Borders::ALL),
        );

    f.render_widget(list, area);
}

fn render_kill_confirm(f: &mut Frame, app: &App) {
    let area = f.size();
    let popup_area = centered_rect(50, 20, area);

    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(Style::default().fg(Color::Red))
        .title(Span::styled(" Confirm Kill ", Style::default().fg(Color::Red).add_modifier(Modifier::BOLD)));

    if let Some(pid) = app.kill_pid {
        let proc_name = app.processes.get(app.selected_process)
            .map(|p| p.name.as_str())
            .unwrap_or("Unknown");

        let paragraph = Paragraph::new(vec![
            Line::from(""),
            Line::from(vec![
                Span::raw("Are you sure you want to kill process: "),
                Span::styled(format!("{} ({})", pid, proc_name), Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)),
            ]),
            Line::from(""),
            Line::from(vec![
                Span::styled("[Y] Yes", Style::default().fg(Color::Green).add_modifier(Modifier::BOLD)),
                Span::raw("    "),
                Span::styled("[N] No / Esc", Style::default().fg(Color::Red).add_modifier(Modifier::BOLD)),
            ]),
        ])
        .block(block)
        .alignment(Alignment::Center);

        f.render_widget(Clear, popup_area);
        f.render_widget(paragraph, popup_area);
    }
}

fn render_message(f: &mut Frame, msg: &str) {
    let area = f.size();
    let popup_area = centered_rect(60, 10, area);

    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(Style::default().fg(Color::Cyan));

    let paragraph = Paragraph::new(vec![
        Line::from(""),
        Line::from(Span::styled(msg, Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD))),
    ])
    .block(block)
    .alignment(Alignment::Center);

    f.render_widget(Clear, popup_area);
    f.render_widget(paragraph, popup_area);
}

fn centered_rect(percent_x: u16, percent_y: u16, r: Rect) -> Rect {
    let popup_layout = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Percentage((100 - percent_y) / 2),
            Constraint::Percentage(percent_y),
            Constraint::Percentage((100 - percent_y) / 2),
        ].as_ref())
        .split(r);

    Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Percentage((100 - percent_x) / 2),
            Constraint::Percentage(percent_x),
            Constraint::Percentage((100 - percent_x) / 2),
        ].as_ref())
        .split(popup_layout[1])[1]
}
