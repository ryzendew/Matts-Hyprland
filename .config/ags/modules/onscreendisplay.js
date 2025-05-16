import Widget from 'resource:///com/github/Aylur/ags/widget.js';
import Notifications from 'resource:///com/github/Aylur/ags/service/notifications.js';
import NotificationPopups from './indicators/notificationpopups.js';

// Create a standalone window for notifications in the top center
export const NotificationsWindow = (monitor = 0) => Widget.Window({
    name: `notifications${monitor}`,
    monitor,
    className: 'notifications-center',
    layer: 'overlay',
    visible: true,
    anchor: ['top', 'center'],
    child: NotificationPopups(),
}); 