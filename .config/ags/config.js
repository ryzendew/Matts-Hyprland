"use strict";
// Import
import Gdk from 'gi://Gdk';
import GLib from 'gi://GLib';
import App from 'resource:///com/github/Aylur/ags/app.js'
import * as Utils from 'resource:///com/github/Aylur/ags/utils.js'
// Stuff
import userOptions from './modules/.configuration/user_options.js';
import { firstRunWelcome, startBatteryWarningService } from './services/messages.js';
import { startAutoDarkModeService } from './services/darkmode.js';
// Widgets
import { Bar, BarCornerTopleft, BarCornerTopright } from './modules/bar/main.js';
import Cheatsheet from './modules/cheatsheet/main.js';
// import DesktopBackground from './modules/desktopbackground/main.js';
import Dock from './modules/dock/main.js';
import Corner from './modules/screencorners/main.js';
import Crosshair from './modules/crosshair/main.js';
import Indicator from './modules/indicators/main.js';
import Osk from './modules/onscreenkeyboard/main.js';
import Overview from './modules/overview/main.js';
import Session from './modules/session/main.js';
import SideLeft from './modules/sideleft/main.js';
import SideRight from './modules/sideright/main.js';
import { NotificationsWindow } from './modules/onscreendisplay.js';
import { COMPILED_STYLE_DIR } from './init.js';

const range = (length, start = 1) => Array.from({ length }, (_, i) => i + start);
function forMonitors(widget) {
    const n = Gdk.Display.get_default()?.get_n_monitors() || 1;
    return range(n, 0).map(widget).flat(1);
}
function forMonitorsAsync(widget) {
    const n = Gdk.Display.get_default()?.get_n_monitors() || 1;
    return range(n, 0).forEach((n) => widget(n).catch(print))
}

// Start stuff
handleStyles(true);
startAutoDarkModeService().catch(print);
firstRunWelcome().catch(print);
startBatteryWarningService().catch(print)

// Function to only apply widget to specific monitor
function forMainMonitor(widget) {
    // Only apply to monitor 0 (DP-1)
    return [widget(0)].flat(1);
}

const Windows = () => [
    // forMonitors(DesktopBackground),
    forMonitors(Crosshair),
    Overview(),
    forMonitors(Indicator),
    forMainMonitor(NotificationsWindow),
    forMonitors(Cheatsheet),
    SideLeft(),
    SideRight(),
    forMonitors(Osk),
    forMonitors(Session),
    // Only show dock on main monitor (DP-1)
    ...(userOptions.dock.enabled ? [forMainMonitor(Dock)] : []),
    ...(userOptions.appearance.fakeScreenRounding !== 0 ? [
        //forMonitors((id) => Corner(id, 'top left', true)),
        //forMonitors((id) => Corner(id, 'top right', true)),
        //forMonitors((id) => Corner(id, 'bottom left', true)),
        //forMonitors((id) => Corner(id, 'bottom right', true)),
    ] : []),
    // Bar corners are not needed with edge-to-edge design
    // ...(userOptions.appearance.barRoundCorners ? [
    //     forMonitors(BarCornerTopleft),
    //     forMonitors(BarCornerTopright),
    // ] : []),
];

const CLOSE_ANIM_TIME = 210; // Longer than actual anim time to make sure widgets animate fully
const closeWindowDelays = {}; // For animations
for (let i = 0; i < (Gdk.Display.get_default()?.get_n_monitors() || 1); i++) {
    closeWindowDelays[`osk${i}`] = CLOSE_ANIM_TIME;
}

App.config({
    css: `${COMPILED_STYLE_DIR}/style.css`,
    stackTraceOnError: true,
    closeWindowDelay: closeWindowDelays,
    windows: Windows().flat(1),
});

// Only show bar on main monitor (DP-1)
Bar(0).catch(print);
// Commented out the multi-monitor bar call
// forMonitorsAsync(Bar);
// Bar().catch(print); // Use this to debug the bar. Single monitor only.

