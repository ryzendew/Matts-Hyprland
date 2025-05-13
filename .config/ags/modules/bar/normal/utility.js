import Widget from 'resource:///com/github/Aylur/ags/widget.js';
import * as Utils from 'resource:///com/github/Aylur/ags/utils.js';
import { AnimatedCircProg } from "../../.commonwidgets/cairo_circularprogress.js";
import { MaterialIcon } from '../../.commonwidgets/materialicon.js';
const { Box, Button, Overlay, Label, Revealer } = Widget;
const { execAsync, exec } = Utils;
const { GLib } = imports.gi;

const CUSTOM_MODULE_CONTENT_INTERVAL_FILE = `${GLib.get_user_cache_dir()}/ags/user/scripts/custom-module-interval.txt`;
const CUSTOM_MODULE_CONTENT_SCRIPT = `${GLib.get_user_cache_dir()}/ags/user/scripts/custom-module-poll.sh`;
const CUSTOM_MODULE_LEFTCLICK_SCRIPT = `${GLib.get_user_cache_dir()}/ags/user/scripts/custom-module-leftclick.sh`;
const CUSTOM_MODULE_RIGHTCLICK_SCRIPT = `${GLib.get_user_cache_dir()}/ags/user/scripts/custom-module-rightclick.sh`;
const CUSTOM_MODULE_MIDDLECLICK_SCRIPT = `${GLib.get_user_cache_dir()}/ags/user/scripts/custom-module-middleclick.sh`;
const CUSTOM_MODULE_SCROLLUP_SCRIPT = `${GLib.get_user_cache_dir()}/ags/user/scripts/custom-module-scrollup.sh`;
const CUSTOM_MODULE_SCROLLDOWN_SCRIPT = `${GLib.get_user_cache_dir()}/ags/user/scripts/custom-module-scrolldown.sh`;

const BarGroup = ({ child }) => Box({
    className: 'bar-group-margin bar-sides',
    children: [
        Box({
            className: `bar-group${userOptions.appearance.borderless ? '-borderless' : ''} bar-group-standalone bar-group-pad-system`,
            children: [child],
        }),
    ]
});

const BarResource = (name, icon, command, circprogClassName = `bar-batt-circprog ${userOptions.appearance.borderless ? 'bar-batt-circprog-borderless' : ''}`, textClassName = 'txt-onSurfaceVariant', iconClassName = 'bar-batt', labelClassName = 'txt-smallie') => {
    const resourceCircProg = AnimatedCircProg({
        className: `${circprogClassName}`,
        vpack: 'center',
        hpack: 'center',
    });
    const resourceProgress = Box({
        homogeneous: true,
        children: [Overlay({
            child: Box({
                vpack: 'center',
                className: `${iconClassName}`,
                homogeneous: true,
                children: [
                    MaterialIcon(icon, 'small'),
                ],
            }),
            overlays: [resourceCircProg]
        })]
    });
    const resourceLabel = Label({
        className: `${labelClassName} ${textClassName}`,
    });
    const widget = Button({
        onClicked: () => Utils.execAsync(['bash', '-c', `${userOptions.apps.taskManager}`]).catch(print),
        child: Box({
            className: `spacing-h-6 ${textClassName}`,
            vpack: 'center',
            children: [
                resourceProgress,
                resourceLabel,
            ],
            setup: (self) => self.poll(5000, () => execAsync(['bash', '-c', command])
                .then((output) => {
                    resourceCircProg.css = `font-size: ${Number(output)}px;`;
                    if (name.includes('Temp')) {
                        resourceLabel.label = `${Math.round(Number(output))}°C`;
                    } else {
                        resourceLabel.label = `${Math.round(Number(output))}%`;
                    }
                    widget.tooltipText = `${name}: ${Math.round(Number(output))}${name.includes('Temp') ? '°C' : '%'}`;
                }).catch(print))
            ,
        })
    });
    return widget;
}

const cpuIcon = 'chip';
const gpuIcon = 'video-card';

export default () => BarGroup({
    child: Box({
        className: 'spacing-h-12',
        vpack: 'center',
        children: [
            BarResource(
                getString('RAM Usage'),
                'memory',
                `LANG=C free | awk '/^Mem/ {printf("%.2f\\n", ($3/$2) * 100)}'`,
                `bar-ram-circprog ${userOptions.appearance.borderless ? 'bar-ram-circprog-borderless' : ''}`,
                'bar-ram-txt',
                'bar-ram-icon',
                'txt-smallie'
            ),
            BarResource(
                getString('GPU Temp'),
                gpuIcon,
                `sensors | grep -m 1 'edge' | awk '{print $2}' | sed 's/+//' | sed 's/°C//'`,
                `bar-gpu-temp-circprog ${userOptions.appearance.borderless ? 'bar-gpu-temp-circprog-borderless' : ''}`,
                'bar-gpu-temp-txt',
                'bar-gpu-temp-icon',
                'txt-tiny'
            ),
            BarResource(
                getString('CPU Temp'),
                cpuIcon,
                `sensors | grep -m 1 'Core 0' | awk '{print $3}' | sed 's/+//' | sed 's/°C//'`,
                `bar-cpu-temp-circprog ${userOptions.appearance.borderless ? 'bar-cpu-temp-circprog-borderless' : ''}`,
                'bar-cpu-temp-txt',
                'bar-cpu-temp-icon',
                'txt-tiny'
            ),
        ],
    })
}); 