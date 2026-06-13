#!/bin/bash
rm -f /etc/udev/rules.d/99-attack-shark-x11.rules
udevadm control --reload-rules 2>/dev/null || true
