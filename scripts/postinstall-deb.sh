#!/bin/bash
# Instala regra udev para acesso ao Attack Shark X11 sem root
RULES=/etc/udev/rules.d/99-attack-shark-x11.rules
cat > "$RULES" << 'EOF'
SUBSYSTEM=="usb", ATTR{idVendor}=="1d57", ATTR{idProduct}=="fa60", MODE="0666", TAG+="uaccess"
SUBSYSTEM=="usb", ATTR{idVendor}=="1d57", ATTR{idProduct}=="fa55", MODE="0666", TAG+="uaccess"
EOF
udevadm control --reload-rules 2>/dev/null || true
udevadm trigger 2>/dev/null || true
