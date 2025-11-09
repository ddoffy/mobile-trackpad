#!/bin/bash

# Mobile Trackpad Service Uninstallation Script

set -e

echo "🗑️  Uninstalling Mobile Trackpad Service..."

# Stop the service if running
echo "⏹️  Stopping service..."
systemctl --user stop mobile-trackpad.service || true

# Disable the service
echo "❌ Disabling autostart..."
systemctl --user disable mobile-trackpad.service || true

# Remove service file
echo "📋 Removing service file..."
rm -f ~/.config/systemd/user/mobile-trackpad.service

# Reload systemd daemon
echo "🔄 Reloading systemd daemon..."
systemctl --user daemon-reload

echo ""
echo "✅ Service uninstalled successfully!"
echo ""
