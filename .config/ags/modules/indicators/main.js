import Widget from 'resource:///com/github/Aylur/ags/widget.js';
import * as Utils from 'resource:///com/github/Aylur/ags/utils.js';
import Indicator from '../../services/indicator.js';
import IndicatorValues from './indicatorvalues.js';
import MusicControls from './musiccontrols.js';
import ColorScheme from './colorscheme.js';
import NotificationPopups from './notificationpopups.js';

export default (monitor = 0) => {
    const win = Widget.Window({
        name: `indicator${monitor}`,
        monitor,
        className: 'indicator',
        layer: 'overlay',
        visible: false, // Start hidden
        anchor: ['top'],
        child: Widget.EventBox({
            onHover: () => { //make the widget hide when hovering
                Indicator.popup(-1);
            },
            child: Widget.Box({
                vertical: true,
                className: 'osd-window',
                css: 'min-height: 2px;',
                children: [
                    IndicatorValues(monitor),
                    MusicControls(),
                    ColorScheme(),
                    // NotificationPopups is now handled by the dedicated NotificationsWindow
                ]
            })
        }),
    });

    // Connect to the indicator service
    win.connect('map', () => {
        win.attribute.timer = null;
    });

    Indicator.connect('popup', (_, value) => {
        if (value > -1) {
            // Show window
            win.visible = true;
            // Clear any existing hide timer
            if (win.attribute.timer) {
                Utils.timeout.clearTimeout(win.attribute.timer);
                win.attribute.timer = null;
            }
        } else {
            // When hiding, wait for the CSS transition to complete then hide the window
            win.attribute.timer = Utils.timeout(200, () => {
                win.visible = false;
                win.attribute.timer = null;
            });
        }
    });

    return win;
}
