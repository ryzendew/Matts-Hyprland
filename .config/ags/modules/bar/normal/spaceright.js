import App from 'resource:///com/github/Aylur/ags/app.js';
import Widget from 'resource:///com/github/Aylur/ags/widget.js';
import * as Utils from 'resource:///com/github/Aylur/ags/utils.js';
import GLib from 'gi://GLib';
import { MaterialIcon } from '../../.commonwidgets/materialicon.js';

import Audio from 'resource:///com/github/Aylur/ags/service/audio.js';
import SystemTray from 'resource:///com/github/Aylur/ags/service/systemtray.js';
const { execAsync } = Utils;
const { Label } = Widget;
import Indicator from '../../../services/indicator.js';
import { StatusIcons } from '../../.commonwidgets/statusicons.js';
import { Tray } from "./tray.js";
import { distance } from '../../.miscutils/mathfuncs.js';
import { WWO_CODE, WEATHER_SYMBOL } from '../../.commondata/weather.js';

const OSD_DISMISS_DISTANCE = 10;
const WEATHER_CACHE_FOLDER = `${GLib.get_user_cache_dir()}/ags/weather`;

const time = Variable('', {
    poll: [
        userOptions.time.interval,
        () => GLib.DateTime.new_now_local().format(userOptions.time.format),
    ],
});

const date = Variable('', {
    poll: [
        userOptions.time.dateInterval,
        () => GLib.DateTime.new_now_local().format(userOptions.time.dateFormatLong),
    ],
});

const BarClock = () => Widget.Box({
    vpack: 'center',
    className: 'bar-clock-box',
    children: [
        Widget.Box({
            vertical: true,
            children: [
                Widget.Label({
                    className: 'bar-time-compact',
                    label: time.bind(),
                }),
                Widget.Label({
                    className: 'txt-smallie bar-date-compact',
                    label: date.bind(),
                }),
            ],
        }),
    ],
});

const BarWeather = () => Widget.Box({
    className: 'txt-onSurfaceVariant spacing-h-4',
    children: [
        MaterialIcon('device_thermostat', 'norm'),
        Label({
            className: 'txt-smallie',
            label: '',
        })
    ],
    setup: (self) => self.poll(50000, async (self) => {
        const WEATHER_CACHE_PATH = WEATHER_CACHE_FOLDER + '/wttr.in.txt';
        const updateWeatherForCity = (city) => execAsync(`curl https://wttr.in/${city.replace(/ /g, '%20')}?format=j1`)
            .then(output => {
                const weather = JSON.parse(output);
                Utils.writeFile(JSON.stringify(weather), WEATHER_CACHE_PATH)
                    .catch(print);
                const weatherCode = weather.current_condition[0].weatherCode;
                const temperature = weather.current_condition[0][`temp_${userOptions.weather.preferredUnit}`];
                const feelsLike = weather.current_condition[0][`FeelsLike${userOptions.weather.preferredUnit}`];
                const weatherSymbol = WEATHER_SYMBOL[WWO_CODE[weatherCode]];
                self.children[0].label = weatherSymbol;
                self.children[1].label = `${temperature}°${userOptions.weather.preferredUnit} • ${getString('Feels like')} ${feelsLike}°${userOptions.weather.preferredUnit}`;
            }).catch((err) => {
                try { // Read from cache
                    const weather = JSON.parse(
                        Utils.readFile(WEATHER_CACHE_PATH)
                    );
                    const weatherCode = weather.current_condition[0].weatherCode;
                    const temperature = weather.current_condition[0][`temp_${userOptions.weather.preferredUnit}`];
                    const feelsLike = weather.current_condition[0][`FeelsLike${userOptions.weather.preferredUnit}`];
                    const weatherSymbol = WEATHER_SYMBOL[WWO_CODE[weatherCode]];
                    self.children[0].label = weatherSymbol;
                    self.children[1].label = `${temperature}°${userOptions.weather.preferredUnit} • ${getString('Feels like')} ${feelsLike}°${userOptions.weather.preferredUnit}`;
                } catch (err) {
                    print(err);
                }
            });
        if (userOptions.weather.city != '' && userOptions.weather.city != null) {
            updateWeatherForCity(userOptions.weather.city);
        }
        else {
            Utils.execAsync('curl ipinfo.io')
                .then(output => JSON.parse(output)['city'].toLowerCase())
                .then(updateWeatherForCity)
                .catch(print)
        }
    }),
});

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
    const SpaceRightInteractions = (child) => Widget.EventBox({
        onHover: () => { barStatusIcons.toggleClassName('bar-statusicons-hover', true) },
        onHoverLost: () => { barStatusIcons.toggleClassName('bar-statusicons-hover', false) },
        onPrimaryClick: () => App.toggleWindow('sideright'),
        onSecondaryClick: () => execAsync(['bash', '-c', 'playerctl next || playerctl position `bc <<< "100 * $(playerctl metadata mpris:length) / 1000000 / 100"` &']).catch(print),
        onMiddleClick: () => execAsync('playerctl play-pause').catch(print),
        setup: (self) => self.on('button-press-event', (self, event) => {
            if (event.get_button()[1] === 8)
                execAsync('playerctl previous').catch(print)
        }).on('motion-notify-event', (self, event) => {
            Indicator.popup(-1);
        }),
        child: child,
    });
    const emptyArea = SpaceRightInteractions(Widget.Box({ hexpand: true, }));
    const weatherClock = Widget.Box({
        className: 'spacing-h-5',
        css: 'margin-right: 1.5rem;',
        children: [
            BarWeather(),
            BarClock(),
        ]
    });
    const actualContent = Widget.Box({
        hexpand: true,
        className: 'spacing-h-5 bar-spaceright',
        children: [
            emptyArea,
        ],
    });

    let scrollCursorX, scrollCursorY;
    return Widget.EventBox({
        onScrollUp: (self, event) => {
            if (!Audio.speaker) return;
            let _;
            [_, scrollCursorX, scrollCursorY] = event.get_coords();
            if (Audio.speaker.volume <= 0.09) Audio.speaker.volume += 0.01;
            else Audio.speaker.volume += 0.03;
            Indicator.popup(1);
        },
        onScrollDown: (self, event) => {
            if (!Audio.speaker) return;
            let _;
            [_, scrollCursorX, scrollCursorY] = event.get_coords();
            if (Audio.speaker.volume <= 0.09) Audio.speaker.volume -= 0.01;
            else Audio.speaker.volume -= 0.03;
            Indicator.popup(1);
        },
        setup: (self) => self.on('motion-notify-event', (self, event) => {
            const [_, cursorX, cursorY] = event.get_coords();
            if (distance(cursorX, cursorY, scrollCursorX, scrollCursorY) >= OSD_DISMISS_DISTANCE)
                Indicator.popup(-1);
        }),
        child: Widget.Box({
            children: [
                actualContent,
                weatherClock,
            ]
        })
    });
}