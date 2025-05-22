const { Gtk } = imports.gi;
import Widget from 'resource:///com/github/Aylur/ags/widget.js';
import Battery from 'resource:///com/github/Aylur/ags/service/battery.js';
import * as Utils from 'resource:///com/github/Aylur/ags/utils.js';

import Indicators from "./normal/spaceright.js";
import CenterSpace from "./normal/spacecenter.js";
import Music from "./normal/music.js";
import System from "./normal/system.js";
import { enableClickthrough } from "../.widgetutils/clickthrough.js";
import { RoundedCorner } from "../.commonwidgets/cairo_roundedcorner.js";
import { currentShellMode } from '../../variables.js';

const StartButton = () => Widget.EventBox({
    onPrimaryClick: () => Utils.execAsync(['hyprmenu']).catch(print),
    child: Widget.Box({
        css: 'padding: 0; margin: 0;',
        children: [
            Widget.Icon({
                icon: '/home/matt/.config/ags/logo/Arch-linux-logo.png',
                size: 24,
                css: 'margin: 0.273rem 0.5rem 0.273rem 0.5rem;',
            })
        ]
    })
});

const NormalOptionalWorkspaces = async () => {
    try {
        return (await import('./normal/workspaces_hyprland.js')).default();
    } catch {
        try {
            return (await import('./normal/workspaces_sway.js')).default();
        } catch {
            return null;
        }
    }
};

const FocusOptionalWorkspaces = async () => {
    try {
        return (await import('./focus/workspaces_hyprland.js')).default();
    } catch {
        try {
            return (await import('./focus/workspaces_sway.js')).default();
        } catch {
            return null;
        }
    }
};

export const Bar = async (monitor = 0) => {
    const SideModule = (children) => Widget.Box({
        className: 'bar-sidemodule',
        children: children,
    });
    const normalBarContent = Widget.CenterBox({
        className: 'bar-bg',
        css: 'padding: 0; margin: 0;',
        setup: (self) => {
            const styleContext = self.get_style_context();
            const minHeight = styleContext.get_property('min-height', Gtk.StateFlags.NORMAL);
        },
        startWidget: Widget.Box({
            css: 'padding: 0; margin: 0;',
            children: [
                StartButton(),
                Widget.Box({
                    hexpand: true,
                    className: 'invisible',
                })
            ]
        }),
        centerWidget: Widget.Box({
            hpack: 'center',
            children: [
                CenterSpace(monitor),
            ]
        }),
        endWidget: Widget.Box({
            css: 'padding: 0; margin: 0;',
            children: [
                Widget.Box({
                    hexpand: true,
                    className: 'invisible',
                }),
                Indicators(monitor),
            ]
        }),
    });
    const focusedBarContent = Widget.CenterBox({
        className: 'bar-bg-focus',
        startWidget: Widget.Box({}),
        centerWidget: Widget.Box({
            className: 'spacing-h-4',
            children: [
                SideModule([]),
                Widget.Box({
                    homogeneous: true,
                    children: [await FocusOptionalWorkspaces()],
                }),
                SideModule([]),
            ]
        }),
        endWidget: Widget.Box({}),
        setup: (self) => {
            self.hook(Battery, (self) => {
                if (!Battery.available) return;
                self.toggleClassName('bar-bg-focus-batterylow', Battery.percent <= userOptions.battery.low);
            })
        }
    });
    const nothingContent = Widget.Box({
        className: 'bar-bg-nothing',
    })
    return Widget.Window({
        monitor,
        name: `bar${monitor}`,
        anchor: ['top', 'left', 'right'],
        exclusivity: 'exclusive',
        visible: true,
        child: Widget.Stack({
            homogeneous: false,
            transition: 'slide_up_down',
            transitionDuration: userOptions.animations.durationLarge,
            children: {
                'normal': normalBarContent,
                'focus': focusedBarContent,
                'nothing': nothingContent,
            },
            setup: (self) => self.hook(currentShellMode, (self) => {
                self.shown = currentShellMode.value[monitor];
            })
        }),
    });
}

export const BarCornerTopleft = (monitor = 0) => Widget.Window({
    monitor,
    name: `barcornertl${monitor}`,
    layer: 'top',
    anchor: ['top', 'left'],
    exclusivity: 'normal',
    visible: true,
    child: RoundedCorner('topleft', { className: 'corner', }),
    setup: enableClickthrough,
});
export const BarCornerTopright = (monitor = 0) => Widget.Window({
    monitor,
    name: `barcornertr${monitor}`,
    layer: 'top',
    anchor: ['top', 'right'],
    exclusivity: 'normal',
    visible: true,
    child: RoundedCorner('topright', { className: 'corner', }),
    setup: enableClickthrough,
});
