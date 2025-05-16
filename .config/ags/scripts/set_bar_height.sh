#!/bin/bash

# First kill the current AGS instance
pkill ags

# Wait for AGS to fully terminate
sleep 1

# Set smaller reserved space for the top bar - 10 pixels
hyprctl keyword monitor ,addreserved,10,0,0,0

# Make sure to set this for all monitors
for monitor in $(hyprctl monitors -j | jq -r '.[].id'); do
    hyprctl keyword monitor $monitor,addreserved,10,0,0,0
done

# Restart AGS with the new height
ags &

# Reload Hyprland to fully apply changes
hyprctl reload 