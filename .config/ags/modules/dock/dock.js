const { Gtk, GLib } = imports.gi;
import App from 'resource:///com/github/Aylur/ags/app.js';
import Widget from 'resource:///com/github/Aylur/ags/widget.js';
import * as Utils from 'resource:///com/github/Aylur/ags/utils.js';
const { EventBox, Button } = Widget;

import Hyprland from 'resource:///com/github/Aylur/ags/service/hyprland.js';
import Applications from 'resource:///com/github/Aylur/ags/service/applications.js';
const { execAsync, exec } = Utils;
const { Box, Revealer } = Widget;
import { setupCursorHover } from '../.widgetutils/cursorhover.js';
import { getAllFiles, searchIcons } from './icons.js'
import { MaterialIcon } from '../.commonwidgets/materialicon.js';
import { substitute } from '../.miscutils/icons.js';
import Music from '../bar/normal/music.js';
import System from '../bar/normal/system.js';
import Utility from '../bar/normal/utility.js';
const { Gdk } = imports.gi;

const icon_files = userOptions.icons.searchPaths.map(e => getAllFiles(e)).flat(1)

let isPinned = false
let cachePath = new Map()

let timers = []

// --- Drag-and-drop helpers for pinned apps ---
let dragSourceIndex = null;
let dragOverIndex = null;

function clearTimes() {
    timers.forEach(e => GLib.source_remove(e))
    timers = []
}

function ExclusiveWindow(client) {
    const fn = [
        (client) => !(client !== null && client !== undefined),
        // Jetbrains
        (client) => client.title.includes("win"),
        // Vscode
        (client) => client.title === '' && client.class === ''
    ]

    for (const item of fn) { if (item(client)) { return true } }
    return false
}

const focus = ({ address }) => Utils.execAsync(`hyprctl dispatch focuswindow address:${address}`).catch(print);

const DockSeparator = (props = {}) => Box({
    ...props,
    className: 'dock-separator',
})

const PinButton = () => Widget.Button({
    className: 'dock-app-btn dock-app-btn-animate',
    tooltipText: 'Pin Dock',
    child: Widget.Box({
        homogeneous: true,
        className: 'dock-app-icon txt',
        child: MaterialIcon('push_pin', 'hugeass')
    }),
    onClicked: (self) => {
        isPinned = !isPinned
        self.className = `${isPinned ? "pinned-dock-app-btn" : "dock-app-btn animate"} dock-app-btn-animate`
    },
    setup: setupCursorHover,
})

const ArchMenuButton = () => Widget.Button({
    className: 'dock-app-btn dock-app-btn-animate',
    tooltipText: 'Open HyprMenu',
    child: Widget.Box({
        homogeneous: true,
        className: 'dock-app-icon',
        child: Widget.Icon({
            icon: '/home/matt/Pictures/logo/Arch-linux-logo.png',
            size: 24,
        }),
    }),
    onClicked: () => {
        Utils.execAsync('hyprmenu').catch(print);
    },
    setup: setupCursorHover,
})

const AppButton = ({ icon, ...rest }) => Widget.Revealer({
    attribute: {
        'workspace': 0
    },
    revealChild: false,
    transition: 'slide_right',
    transitionDuration: userOptions.animations.durationLarge,
    child: Widget.Button({
        ...rest,
        className: 'dock-app-btn dock-app-btn-animate',
        child: Widget.Box({
            child: Widget.Overlay({
                child: Widget.Box({
                    homogeneous: true,
                    className: 'dock-app-icon',
                    child: Widget.Icon({
                        icon: icon,
                    }),
                }),
                overlays: [Widget.Box({
                    class_name: 'indicator',
                    vpack: 'end',
                    hpack: 'center',
                })],
            }),
        }),
        setup: (button) => {
            setupCursorHover(button);
        }
    })
});

function updatePinnedAppsOrder(from, to) {
    if (from === to || from == null || to == null) return;
    const arr = [...userOptions.dock.pinnedApps];
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    userOptions.dock.pinnedApps = arr;
}

function pinApp(term) {
    if (!userOptions.dock.pinnedApps.includes(term)) {
        userOptions.dock.pinnedApps.push(term);
    }
}

// --- Robust GTK Drag-and-drop for pinned apps and taskbar (final, Gdk.ContentProvider/Variant version) ---

const PinnedApps = () => Widget.Box({
    class_name: 'dock-apps',
    homogeneous: true,
    setup: (self) => {
        // Setup drop target for reordering and pinning
        self.connect('map', () => {
            GLib.idle_add(() => {
                const gtkBox = self.get_gtk_widget();
                if (!gtkBox) return GLib.SOURCE_REMOVE;
                const dropTarget = new Gtk.DropTarget({
                    actions: Gtk.DragAction.MOVE,
                    formats: [Gdk.ContentFormats.new([Gdk.CONTENT_FORMATS_TEXT_PLAIN])],
                });
                dropTarget.connect('drop', (target, value, x, y) => {
                    const data = value.get_string();
                    if (!isNaN(Number(data))) {
                        // Reorder: find closest child index to x
                        let toIndex = 0;
                        let minDist = Infinity;
                        const children = gtkBox.get_children();
                        for (let j = 0; j < children.length; ++j) {
                            const alloc = children[j].get_allocation();
                            const center = alloc.x + alloc.width / 2;
                            const dist = Math.abs(x - center);
                            if (dist < minDist) {
                                minDist = dist;
                                toIndex = j;
                            }
                        }
                        updatePinnedAppsOrder(Number(data), toIndex);
                    } else {
                        // Pin new app
                        pinApp(data);
                    }
                    self.remove_class('drag-over');
                    return true;
                });
                dropTarget.connect('enter', () => self.add_class('drag-over'));
                dropTarget.connect('leave', () => self.remove_class('drag-over'));
                gtkBox.add_controller(dropTarget);
                return GLib.SOURCE_REMOVE;
            });
        });
        // Generate children and attach drag sources
        self.children = userOptions.dock.pinnedApps
            .map((term, i) => {
                const app = Applications.query(term)?.[0];
                if (!app) return null;
                const btn = AppButton({
                    icon: userOptions.dock.searchPinnedAppIcons ?
                        searchIcons(app.name, icon_files) :
                        app.icon_name,
                    tooltipText: app.name,
                    onClicked: () => {
                        const running = Hyprland.clients.find(client => 
                            client.class.toLowerCase().includes(term)
                        );
                        if (running) {
                            focus(running);
                        } else {
                            app.launch();
                        }
                    },
                    onMiddleClick: () => app.launch(),
                    setup: (selfBtn) => {
                        selfBtn.revealChild = true;
                        selfBtn.hook(Hyprland, button => {
                            const running = Hyprland.clients
                                .find(client => client.class.toLowerCase().includes(term)) || false;
                            button.toggleClassName('notrunning', !running);
                            button.toggleClassName('focused', Hyprland.active.client.address == running.address);
                            button.set_tooltip_text(running ? running.title : app.name);
                        }, 'notify::clients');
                        // Drag source for reordering
                        selfBtn.connect('map', () => {
                            GLib.idle_add(() => {
                                const gtkBtn = selfBtn.get_gtk_widget();
                                if (!gtkBtn) return GLib.SOURCE_REMOVE;
                                const dragSource = new Gtk.DragSource();
                                dragSource.set_actions(Gtk.DragAction.MOVE);
                                dragSource.set_content(Gdk.ContentProvider.new_for_value(new GLib.Variant('s', String(i))));
                                dragSource.connect('prepare', () => {
                                    return Gdk.ContentProvider.new_for_value(new GLib.Variant('s', String(i)));
                                });
                                gtkBtn.add_controller(dragSource);
                                return GLib.SOURCE_REMOVE;
                            });
                        });
                    },
                });
                btn.revealChild = true;
                return btn;
            })
            .filter(Boolean);
    },
});

const Taskbar = (monitor) => Widget.Box({
    className: 'dock-apps',
    attribute: {
        monitor: monitor,
        'map': new Map(),
        'clientSortFunc': (a, b) => {
            return a.attribute.workspace > b.attribute.workspace;
        },
        'update': (box, monitor) => {
            const currentWorkspace = Hyprland.active.workspace.id;
            const clients = userOptions.dock.workspaceIsolation
                ? Hyprland.clients.filter(client => client.workspace.id === currentWorkspace)
                : Hyprland.clients;
            for (let i = 0; i < clients.length; i++) {
                const client = clients[i];
                if (client["pid"] == -1) return;
                const appClass = substitute(client.class);
                let appClassLower = appClass.toLowerCase();
                let path = '';
                if (cachePath[appClassLower]) { path = cachePath[appClassLower]; }
                else {
                    path = searchIcons(appClass.toLowerCase(), icon_files);
                    cachePath[appClassLower] = path;
                }
                if (path === '') { path = substitute(appClass); }
                const btn = AppButton({
                    icon: path,
                    tooltipText: `${client.title} (${appClass})`,
                    onClicked: () => focus(client),
                    setup: (selfBtn) => {
                        // Drag source for pinning
                        selfBtn.connect('map', () => {
                            GLib.idle_add(() => {
                                const gtkBtn = selfBtn.get_gtk_widget();
                                if (!gtkBtn) return GLib.SOURCE_REMOVE;
                                const dragSource = new Gtk.DragSource();
                                dragSource.set_actions(Gtk.DragAction.MOVE);
                                dragSource.set_content(Gdk.ContentProvider.new_for_value(new GLib.Variant('s', appClassLower)));
                                dragSource.connect('prepare', () => {
                                    return Gdk.ContentProvider.new_for_value(new GLib.Variant('s', appClassLower));
                                });
                                gtkBtn.add_controller(dragSource);
                                return GLib.SOURCE_REMOVE;
                            });
                        });
                    },
                });
                btn.attribute.workspace = client.workspace.id;
                btn.revealChild = true;
                box.attribute.map.set(client.address, btn);
            }
            box.children = Array.from(box.attribute.map.values());
        },
        'add': (box, address, monitor) => {
            if (!address) { // First active emit is undefined
                box.attribute.update(box);
                return;
            }
            const newClient = Hyprland.clients.find(client => {
                return client.address == address;
            });
            if (ExclusiveWindow(newClient)) { return }
            let appClass = newClient.class
            let appClassLower = appClass.toLowerCase()
            let path = ''
            if (cachePath[appClassLower]) { path = cachePath[appClassLower] }
            else {
                path = searchIcons(appClassLower, icon_files)
                cachePath[appClassLower] = path
            }
            if (path === '') { path = substitute(appClass) }
            const newButton = AppButton({
                icon: path,
                tooltipText: `${newClient.title} (${appClass})`,
                onClicked: () => focus(newClient),
            })
            newButton.attribute.workspace = newClient.workspace.id;
            box.attribute.map.set(address, newButton);
            box.children = Array.from(box.attribute.map.values());
            newButton.revealChild = true;
        },
        'remove': (box, address) => {
            if (!address) return;

            const removedButton = box.attribute.map.get(address);
            if (!removedButton) return;
            removedButton.revealChild = false;

            Utils.timeout(userOptions.animations.durationLarge, () => {
                removedButton.destroy();
                box.attribute.map.delete(address);
                box.children = Array.from(box.attribute.map.values());
            })
        },
    },
    setup: (self) => {
        self.hook(Hyprland, (box, address) => box.attribute.add(box, address, self.monitor), 'client-added')
            .hook(Hyprland, (box, address) => box.attribute.remove(box, address, self.monitor), 'client-removed')
        Utils.timeout(100, () => self.attribute.update(self));
    },
});

export default (monitor = 0) => {
    const dockContent = Box({
        className: 'dock-bg spacing-h-5',
        children: [
            ArchMenuButton(),
            PinnedApps(),
            DockSeparator(),
            Taskbar(),
            DockSeparator(),
            Music(),
        ]
    })
    const dockRevealer = Revealer({
        attribute: {
            'updateShow': self => {
                if (userOptions.dock.monitorExclusivity)
                    self.revealChild = Hyprland.active.monitor.id === monitor;
                else
                    self.revealChild = true;

                return self.revealChild
            }
        },
        revealChild: true, // Always visible
        transition: 'slide_up',
        transitionDuration: userOptions.animations.durationLarge,
        child: dockContent,
        setup: (self) => {
            const callback = (self, trigger) => {
                if (!userOptions.dock.trigger.includes(trigger)) return
                const flag = self.attribute.updateShow(self)

                if (flag) clearTimes();
            }

            self
                .hook(Hyprland.active.workspace, self => callback(self, "workspace-active"))
                .hook(Hyprland.active.client, self => callback(self, "client-active"))
                .hook(Hyprland, self => callback(self, "client-added"), "client-added")
                .hook(Hyprland, self => callback(self, "client-removed"), "client-removed")
        },
    })
    return Box({
        homogeneous: true,
        css: `min-height: ${userOptions.dock.hiddenThickness}px;`,
        children: [dockRevealer],
    })
}
