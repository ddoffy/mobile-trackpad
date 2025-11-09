#!/bin/bash
# Setup script for dependencies

echo "Installing required system packages..."
sudo apt-get update
sudo apt-get install -y libevdev-dev

echo "Dependencies installed!"
