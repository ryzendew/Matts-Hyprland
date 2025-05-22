import App from 'resource:///com/github/Aylur/ags/app.js';
import Widget from 'resource:///com/github/Aylur/ags/widget.js';
import * as Utils from 'resource:///com/github/Aylur/ags/utils.js';
import SystemTray from 'resource:///com/github/Aylur/ags/service/systemtray.js';
import { StatusIcons } from '../../.commonwidgets/statusicons.js';
import { Tray } from "./tray.js";
const { Box, EventBox } = Widget;

const SeparatorDot = () => Widget.Revealer({
    transition: 'slide_left',
    revealChild: false,
    attribute: {
        'count': SystemTray.items.length,
        'update': (self, diff) => {
            self.attribute.count += diff;
            self.revealChild = (self.attribute.count > 0);
        }
    },
    child: Widget.Box({
        vpack: 'center',
        className: 'separator-circle',
    }),
    setup: (self) => self
        .hook(SystemTray, (self) => self.attribute.update(self, 1), 'added')
        .hook(SystemTray, (self) => self.attribute.update(self, -1), 'removed')
    ,
});

export default (monitor = 0) => {
    const barTray = Tray();
    const barStatusIcons = StatusIcons({
        className: 'bar-statusicons',
        setup: (self) => self.hook(App, (self, currentName, visible) => {
            if (currentName === 'sideright') {
                self.toggleClassName('bar-statusicons-active', visible);
            }
        }),
    }, monitor);

    return EventBox({
        onPrimaryClick: () => {
            App.toggleWindow('sideright');
        },
        child: Box({
            homogeneous: false,
            children: [
                Box({
                    className: 'bar-center-module spacing-h-5',
                    hexpand: true,
                    children: [
                        Box({
                            className: 'spacing-h-5',
                            children: [
                                barTray,
                                Box({
                                    children: [
                                        SeparatorDot(),
                                        barStatusIcons
                                    ],
                                })
                            ]
                        })
                    ]
                })
            ]
        })
    });
} 