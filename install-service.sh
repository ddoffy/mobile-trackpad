#!/bin/bash

# Mobile Trackpad Service Installation Script
# This script sets up the trackpad service to run automatically at login

set -e

echo "🚀 Installing Mobile Trackpad Service..."

# Build the release binary
echo "📦 Building release binary..."
cargo build --release

# Create systemd user directory if it doesn't exist
mkdir -p ~/.config/systemd/user

# Copy service file to systemd user directory
echo "📋 Copying service file..."
cp mobile-trackpad.service ~/.config/systemd/user/

# Reload systemd daemon
echo "🔄 Reloading systemd daemon..."
systemctl --user daemon-reload

# Enable the service (autostart at login)
echo "✅ Enabling service for autostart..."
systemctl --user enable mobile-trackpad.service

# Start the service now
echo "▶️  Starting service..."
systemctl --user start mobile-trackpad.service

# Check service status
echo ""
echo "📊 Service Status:"
systemctl --user status mobile-trackpad.service --no-pager

echo ""
echo "✅ Installation complete!"
echo ""
echo "📱 Your trackpad service is now running and will start automatically at login"
echo ""
echo "Useful commands:"
echo "  • Check status:    systemctl --user status mobile-trackpad"
echo "  • Stop service:    systemctl --user stop mobile-trackpad"
echo "  • Start service:   systemctl --user start mobile-trackpad"
echo "  • Restart service: systemctl --user restart mobile-trackpad"
echo "  • View logs:       journalctl --user -u mobile-trackpad -f"
echo "  • Disable autostart: systemctl --user disable mobile-trackpad"
echo ""
