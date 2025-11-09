# Mobile Trackpad

A web-based touchpad/trackpad service that allows you to control your Linux computer (Wayland/X11) from your iPhone or any mobile device over WiFi.

## Features

- 🖱️ **Mouse Control**: Move cursor with one finger
- 🖱️ **Click Support**: Tap to left-click, two-finger tap for right-click
- 📜 **Natural Scrolling**: Two-finger scroll (vertical and horizontal)
- 🎯 **Drag and Drop**: Long-press to enter drag mode
- ↔️ **Navigation**: Two-finger horizontal swipe for browser back/forward
- ⌨️ **Arrow Keys**: On-screen arrow key buttons for keyboard control
- 🌐 **WebSocket**: Real-time, low-latency communication
- 🎨 **Modern UI**: Beautiful, responsive interface optimized for mobile
- 🚀 **Systemd Service**: Auto-start at login

## Requirements

- Rust (latest stable)
- Linux with evdev support (works on both Wayland and X11)
- Access to `/dev/uinput`

## Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo>
   cd mobile-trackpad
   ```

2. **Install dependencies**
   ```bash
   ./setup.sh
   ```

3. **Setup uinput permissions**
   ```bash
   chmod +x setup-permissions.sh
   ./setup-permissions.sh
   ```

4. **Build the project**
   ```bash
   cargo build --release
   ```

5. **Install as a service (optional)**
   ```bash
   chmod +x install-service.sh
   ./install-service.sh
   ```

## Usage

### Manual Run
```bash
cargo run --release
```

### Service Management
```bash
# Check status
systemctl --user status mobile-trackpad

# Stop service
systemctl --user stop mobile-trackpad

# Start service
systemctl --user start mobile-trackpad

# Restart service
systemctl --user restart mobile-trackpad

# View logs
journalctl --user -u mobile-trackpad -f

# Disable autostart
systemctl --user disable mobile-trackpad

# Uninstall service
./uninstall-service.sh
```

### Access from Mobile Device

1. Make sure your mobile device is on the same WiFi network
2. Open your browser and go to: `http://YOUR_COMPUTER_IP:9999`
3. The service will display the correct IP address when it starts

## Gestures

- **One finger move**: Move cursor
- **One finger tap**: Left click
- **One finger long-press**: Enter drag mode (hold and move)
- **Two finger move (vertical)**: Scroll up/down
- **Two finger move (horizontal)**: Scroll left/right
- **Two finger tap**: Right click
- **Two finger horizontal swipe**: Browser back/forward navigation
- **Arrow buttons**: Send keyboard arrow keys (up, down, left, right)

## Technology Stack

- **Backend**: Rust with Tokio async runtime
- **Web Framework**: Warp
- **Input Control**: evdev (Linux kernel uinput)
- **Communication**: WebSockets
- **Frontend**: Vanilla HTML/CSS/JavaScript

## Troubleshooting

### Permission Issues
If you get permission errors for `/dev/uinput`:
```bash
sudo chmod 666 /dev/uinput
```

Or run the setup script for persistent permissions:
```bash
./setup-permissions.sh
```

### Service Not Starting
Check the logs:
```bash
journalctl --user -u mobile-trackpad -f
```

Make sure the binary is built:
```bash
cargo build --release
```

## License

MIT License
