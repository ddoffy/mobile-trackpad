use evdev::{uinput::VirtualDeviceBuilder, AttributeSet, EventType, InputEvent, RelativeAxisType, Key};
use futures::{StreamExt, SinkExt};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use warp::{ws::Message, Filter};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
enum TrackpadEvent {
    #[serde(rename = "move")]
    Move { dx: f64, dy: f64 },
    #[serde(rename = "click")]
    Click { button: String },
    #[serde(rename = "scroll")]
    Scroll { dx: f64, dy: f64 },
    #[serde(rename = "drag_start")]
    DragStart,
    #[serde(rename = "drag_end")]
    DragEnd,
    #[serde(rename = "swipe")]
    Swipe { direction: String },
    #[serde(rename = "arrow_key")]
    ArrowKey { key: String },
}

struct MouseController {
    device: Arc<Mutex<evdev::uinput::VirtualDevice>>,
}

impl MouseController {
    fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let mut keys = AttributeSet::<Key>::new();
        keys.insert(Key::BTN_LEFT);
        keys.insert(Key::BTN_RIGHT);
        keys.insert(Key::BTN_MIDDLE);
        keys.insert(Key::KEY_LEFT);
        keys.insert(Key::KEY_RIGHT);
        keys.insert(Key::KEY_UP);
        keys.insert(Key::KEY_DOWN);
        keys.insert(Key::KEY_LEFTALT);
        
        let mut relative_axes = AttributeSet::<RelativeAxisType>::new();
        relative_axes.insert(RelativeAxisType::REL_X);
        relative_axes.insert(RelativeAxisType::REL_Y);
        relative_axes.insert(RelativeAxisType::REL_WHEEL);
        relative_axes.insert(RelativeAxisType::REL_HWHEEL);
        
        let device = VirtualDeviceBuilder::new()?
            .name("Mobile Trackpad Virtual Mouse")
            .with_keys(&keys)?
            .with_relative_axes(&relative_axes)?
            .build()?;
        
        Ok(Self {
            device: Arc::new(Mutex::new(device)),
        })
    }

    fn handle_event(&self, event: TrackpadEvent) -> Result<(), Box<dyn std::error::Error>> {
        let mut device = self.device.lock().unwrap();
        
        match event {
            TrackpadEvent::Move { dx, dy } => {
                let events = vec![
                    InputEvent::new(EventType::RELATIVE, RelativeAxisType::REL_X.0, dx as i32),
                    InputEvent::new(EventType::RELATIVE, RelativeAxisType::REL_Y.0, dy as i32),
                    InputEvent::new(EventType::SYNCHRONIZATION, 0, 0),
                ];
                device.emit(&events)?;
            }
            TrackpadEvent::Click { button } => {
                let key = match button.as_str() {
                    "left" => Key::BTN_LEFT,
                    "right" => Key::BTN_RIGHT,
                    "middle" => Key::BTN_MIDDLE,
                    _ => Key::BTN_LEFT,
                };
                
                let events_down = vec![
                    InputEvent::new(EventType::KEY, key.0, 1),
                    InputEvent::new(EventType::SYNCHRONIZATION, 0, 0),
                ];
                device.emit(&events_down)?;
                
                let events_up = vec![
                    InputEvent::new(EventType::KEY, key.0, 0),
                    InputEvent::new(EventType::SYNCHRONIZATION, 0, 0),
                ];
                device.emit(&events_up)?;
            }
            TrackpadEvent::Scroll { dx, dy } => {
                let mut events = Vec::new();
                
                // macOS-style natural scrolling: invert both directions
                if dy.abs() > 0.1 {
                    events.push(InputEvent::new(
                        EventType::RELATIVE,
                        RelativeAxisType::REL_WHEEL.0,
                        (dy / 10.0) as i32,
                    ));
                }
                
                if dx.abs() > 0.1 {
                    events.push(InputEvent::new(
                        EventType::RELATIVE,
                        RelativeAxisType::REL_HWHEEL.0,
                        -(dx / 10.0) as i32,
                    ));
                }
                
                events.push(InputEvent::new(EventType::SYNCHRONIZATION, 0, 0));
                device.emit(&events)?;
            }
            TrackpadEvent::DragStart => {
                let events = vec![
                    InputEvent::new(EventType::KEY, Key::BTN_LEFT.0, 1),
                    InputEvent::new(EventType::SYNCHRONIZATION, 0, 0),
                ];
                device.emit(&events)?;
            }
            TrackpadEvent::DragEnd => {
                let events = vec![
                    InputEvent::new(EventType::KEY, Key::BTN_LEFT.0, 0),
                    InputEvent::new(EventType::SYNCHRONIZATION, 0, 0),
                ];
                device.emit(&events)?;
            }
            TrackpadEvent::Swipe { direction } => {
                let arrow_key = match direction.as_str() {
                    "left" => Key::KEY_LEFT,
                    "right" => Key::KEY_RIGHT,
                    _ => return Ok(()),
                };
                
                device.emit(&[
                    InputEvent::new(EventType::KEY, Key::KEY_LEFTALT.0, 1),
                    InputEvent::new(EventType::SYNCHRONIZATION, 0, 0),
                ])?;
                
                device.emit(&[
                    InputEvent::new(EventType::KEY, arrow_key.0, 1),
                    InputEvent::new(EventType::SYNCHRONIZATION, 0, 0),
                ])?;
                
                device.emit(&[
                    InputEvent::new(EventType::KEY, arrow_key.0, 0),
                    InputEvent::new(EventType::SYNCHRONIZATION, 0, 0),
                ])?;
                
                device.emit(&[
                    InputEvent::new(EventType::KEY, Key::KEY_LEFTALT.0, 0),
                    InputEvent::new(EventType::SYNCHRONIZATION, 0, 0),
                ])?;
            }
            TrackpadEvent::ArrowKey { key } => {
                let arrow_key = match key.as_str() {
                    "up" => Key::KEY_UP,
                    "down" => Key::KEY_DOWN,
                    "left" => Key::KEY_LEFT,
                    "right" => Key::KEY_RIGHT,
                    _ => return Ok(()),
                };
                
                device.emit(&[
                    InputEvent::new(EventType::KEY, arrow_key.0, 1),
                    InputEvent::new(EventType::SYNCHRONIZATION, 0, 0),
                ])?;
                
                device.emit(&[
                    InputEvent::new(EventType::KEY, arrow_key.0, 0),
                    InputEvent::new(EventType::SYNCHRONIZATION, 0, 0),
                ])?;
            }
        }
        
        Ok(())
    }
}

async fn handle_websocket(
    ws: warp::ws::WebSocket,
    mouse_controller: Arc<MouseController>,
) {
    let (mut ws_tx, mut ws_rx) = ws.split();

    let msg = serde_json::json!({
        "type": "connected",
        "message": "Trackpad connected successfully"
    });
    let _ = ws_tx.send(Message::text(msg.to_string())).await;

    while let Some(result) = ws_rx.next().await {
        match result {
            Ok(msg) => {
                if let Ok(text) = msg.to_str() {
                    if let Ok(event) = serde_json::from_str::<TrackpadEvent>(text) {
                        if let Err(e) = mouse_controller.handle_event(event) {
                            eprintln!("Error handling event: {}", e);
                        }
                    }
                }
            }
            Err(e) => {
                eprintln!("WebSocket error: {}", e);
                break;
            }
        }
    }
}

#[tokio::main]
async fn main() {
    println!("🚀 Starting Mobile Trackpad Service...");

    let mouse_controller = Arc::new(
        MouseController::new()
            .expect("Failed to create mouse controller. Make sure /dev/uinput is accessible.")
    );
    println!("✓ Mouse controller initialized (using evdev/uinput for Wayland)");

    let local_ip = local_ip_address::local_ip()
        .unwrap_or_else(|_| "0.0.0.0".parse().unwrap());

    println!("\n╔════════════════════════════════════════════╗");
    println!("║    Mobile Trackpad Service Running        ║");
    println!("╚════════════════════════════════════════════╝\n");
    println!("📱 Access from your iPhone:");
    println!("   • Local:     http://localhost:9999");
    println!("   • Network:   http://{}:9999", local_ip);
    println!("\n💡 Make sure your iPhone is on the same WiFi network");
    println!("🎮 Use one finger to move, two fingers to scroll");
    println!("\n⏹️  Press Ctrl+C to stop");

    let mouse_controller = Arc::clone(&mouse_controller);

    let ws_route = warp::path("ws")
        .and(warp::ws())
        .map(move |ws: warp::ws::Ws| {
            let mouse_controller = Arc::clone(&mouse_controller);
            ws.on_upgrade(move |socket| handle_websocket(socket, mouse_controller))
        });

    let html_route = warp::path::end()
        .and(warp::fs::file("./static/index.html"));
    
    let css_route = warp::path("style.css")
        .and(warp::fs::file("./static/style.css"));
    
    let js_route = warp::path("script.js")
        .and(warp::fs::file("./static/script.js"));
    
    let static_route = warp::path("static")
        .and(warp::fs::dir("./static"));

    let routes = html_route
        .or(css_route)
        .or(js_route)
        .or(static_route)
        .or(ws_route);

    warp::serve(routes)
        .run(([0, 0, 0, 0], 9999))
        .await;
}
