const { GLib } = imports.gi;
import Widget from 'resource:///com/github/Aylur/ags/widget.js';
import * as Utils from 'resource:///com/github/Aylur/ags/utils.js';
import Mpris from 'resource:///com/github/Aylur/ags/service/mpris.js';
const { Box, Button, EventBox, Label, Overlay, Revealer, Scrollable } = Widget;
const { execAsync, exec } = Utils;
import { AnimatedCircProg } from "../../.commonwidgets/cairo_circularprogress.js";
import { MaterialIcon } from '../../.commonwidgets/materialicon.js';
import { showMusicControls } from '../../../variables.js';

const CUSTOM_MODULE_CONTENT_INTERVAL_FILE = `${GLib.get_user_cache_dir()}/ags/user/scripts/custom-module-interval.txt`;
const CUSTOM_MODULE_CONTENT_SCRIPT = `${GLib.get_user_cache_dir()}/ags/user/scripts/custom-module-poll.sh`;
const CUSTOM_MODULE_LEFTCLICK_SCRIPT = `${GLib.get_user_cache_dir()}/ags/user/scripts/custom-module-leftclick.sh`;
const CUSTOM_MODULE_RIGHTCLICK_SCRIPT = `${GLib.get_user_cache_dir()}/ags/user/scripts/custom-module-rightclick.sh`;
const CUSTOM_MODULE_MIDDLECLICK_SCRIPT = `${GLib.get_user_cache_dir()}/ags/user/scripts/custom-module-middleclick.sh`;
const CUSTOM_MODULE_SCROLLUP_SCRIPT = `${GLib.get_user_cache_dir()}/ags/user/scripts/custom-module-scrollup.sh`;
const CUSTOM_MODULE_SCROLLDOWN_SCRIPT = `${GLib.get_user_cache_dir()}/ags/user/scripts/custom-module-scrolldown.sh`;

function trimTrackTitle(title) {
    if (!title) return '';
    const cleanPatterns = [
        /【[^】]*】/,        // Touhou n weeb stuff
        " [FREE DOWNLOAD]", // F-777
    ];
    cleanPatterns.forEach((expr) => title = title.replace(expr, ''));
    return title;
}

function adjustVolume(direction) {
    const step = 0.1; // We use a larger step because this is player instance volume, not global
    const mpris = Mpris.getPlayer('');
    mpris.volume += (direction === 'up') ? step : -step
}


const BarGroup = ({ child }) => Box({
    className: 'bar-group-margin bar-sides',
    children: [
        Box({
            className: `bar-group${userOptions.appearance.borderless ? '-borderless' : ''} bar-group-standalone bar-group-pad-system`,
            children: [child],
        }),
    ]
});

const BarResource = (name, icon, command, circprogClassName = `bar-batt-circprog ${userOptions.appearance.borderless ? 'bar-batt-circprog-borderless' : ''}`, textClassName = 'txt-onSurfaceVariant', iconClassName = 'bar-batt') => {
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
        className: `txt-smallie ${textClassName}`,
    });
    const widget = Button({
        onClicked: () => Utils.execAsync(['bash', '-c', `${userOptions.apps.taskManager}`]).catch(print),
        child: Box({
            className: `spacing-h-4 ${textClassName}`,
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

const TrackProgress = () => {
    const _updateProgress = (circprog) => {
        const mpris = Mpris.getPlayer('');
        if (!mpris)
            circprog.css = `font-size: ${userOptions.appearance.borderless ? 100 : 0}px;`
        else // Set circular progress value
            circprog.css = `font-size: ${Math.max(mpris.position / mpris.length * 100, 0)}px;`
    }
    return AnimatedCircProg({
        className: `bar-music-circprog ${userOptions.appearance.borderless ? 'bar-music-circprog-borderless' : ''}`,
        vpack: 'center', hpack: 'center',
        extraSetup: (self) => self
            .hook(Mpris, _updateProgress)
            .poll(3000, _updateProgress)
        ,
    })
}

const switchToRelativeWorkspace = async (self, num) => {
    try {
        const Hyprland = (await import('resource:///com/github/Aylur/ags/service/hyprland.js')).default;
        Hyprland.messageAsync(`dispatch workspace ${num > 0 ? '+' : ''}${num}`).catch(print);
    } catch {
        execAsync([`${App.configDir}/scripts/sway/swayToRelativeWs.sh`, `${num}`]).catch(print);
    }
}



export default () => {
    // Create previous track button with consistent styling
    const prevButton = Button({
        className: 'bar-music-button',
        child: MaterialIcon('skip_previous', 'default'),
        onClicked: () => execAsync('playerctl previous').catch(print),
        tooltipText: 'Previous Track',
    });
    
    // Create play/pause button with consistent styling
    const playButton = Button({
        className: 'bar-music-button',
        child: Label({
            className: 'icon-material',
            setup: (self) => self.hook(Mpris, label => {
                const mpris = Mpris.getPlayer('');
                label.label = `${mpris !== null && mpris.playBackStatus == 'Playing' ? 'pause' : 'play_arrow'}`;
            }),
        }),
        onClicked: () => execAsync('playerctl play-pause').catch(print),
    });
    
    // Create next track button with consistent styling 
    const nextButton = Button({
        className: 'bar-music-button',
        child: MaterialIcon('skip_next', 'default'),
        onClicked: () => execAsync('playerctl next').catch(print),
        tooltipText: 'Next Track',
    });
    
    // Create a container for all music control buttons
    const musicControls = Box({
        className: 'bar-music-controls',
        children: [
            prevButton,
            playButton,
            nextButton,
        ]
    });
    
    const trackTitle = Label({
        hexpand: true,
        className: 'txt-smallie bar-music-txt',
        setup: (self) => self.hook(Mpris, label => {
            const mpris = Mpris.getPlayer('');
            if (mpris)
                label.label = `${trimTrackTitle(mpris.trackTitle)} • ${mpris.trackArtists.join(', ')}`;
            else
                label.label = getString('No media');
        }),
    });
    
    const musicStuff = Box({
        className: 'spacing-h-5',
        hexpand: true,
        children: [
            musicControls,
            trackTitle,
        ]
    });
    
    return EventBox({
        onScrollUp: () => adjustVolume('up'),
        onScrollDown: () => adjustVolume('down'),
        child: Box({
            className: 'spacing-h-4',
            children: [
                EventBox({
                    child: Box({
                        className: 'bar-music-container spacing-h-5',
                        css: 'padding: 2px 8px; margin: 2px 6px;',
                        children: [musicStuff]
                    }),
                    onPrimaryClick: () => showMusicControls.setValue(!showMusicControls.value),
                    onSecondaryClick: () => execAsync(['bash', '-c', 'playerctl next || playerctl position `bc <<< "100 * $(playerctl metadata mpris:length) / 1000000 / 100"` &']).catch(print),
                    onMiddleClick: () => execAsync('playerctl play-pause').catch(print),
                    setup: (self) => self.on('button-press-event', (self, event) => {
                        if (event.get_button()[1] === 8) // Side button
                            execAsync('playerctl previous').catch(print)
                    }),
                })
            ]
        })
    });
}

