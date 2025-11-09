#!/bin/bash

# Setup uinput permissions for mobile trackpad

echo "Setting up /dev/uinput permissions..."

# Create udev rule for persistent permissions
UDEV_RULE='KERNEL=="uinput", MODE="0666", GROUP="input"'
UDEV_FILE="/etc/udev/rules.d/99-uinput.rules"

echo "Creating udev rule: $UDEV_FILE"
echo "$UDEV_RULE" | sudo tee "$UDEV_FILE"

# Load uinput module
echo "Loading uinput kernel module..."
sudo modprobe uinput

# Make uinput load on boot
if ! grep -q "uinput" /etc/modules; then
    echo "uinput" | sudo tee -a /etc/modules
fi

# Reload udev rules
echo "Reloading udev rules..."
sudo udevadm control --reload-rules
sudo udevadm trigger

# Set temporary permissions
sudo chmod 666 /dev/uinput

echo "✅ Setup complete!"
echo "You may need to log out and back in for group changes to take effect."
echo "Or run: sudo chmod 666 /dev/uinput (temporary until reboot)"
