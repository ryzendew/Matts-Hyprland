import Service from 'resource:///com/github/Aylur/ags/service.js';
import * as Utils from 'resource:///com/github/Aylur/ags/utils.js';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';

const CACHE_PATH = `${GLib.get_user_cache_dir()}/ags/colorscheme.json`;

class ColorSchemeService extends Service {
    static {
        Service.register(this, {
            'changed': [],
        });
    }

    _colors = {};
    _settings = {};

    constructor() {
        super();
        
        Utils.exec('mkdir -p ' + GLib.get_user_cache_dir() + '/ags');
        
        this.loadFromCache();
    }

    loadFromCache() {
        try {
            const data = JSON.parse(Utils.readFile(CACHE_PATH));
            this._colors = data.colors || {};
            this.emit('changed');
        } catch (error) {
            console.error('Failed to load color scheme from cache:', error);
            this._colors = {};
        }
    }

    saveToCache() {
        const data = {
            colors: this._colors,
        };
        Utils.writeFile(JSON.stringify(data, null, 2), CACHE_PATH)
            .catch(console.error);
    }

    async generateFromWallpaper(wallpaperPath) {
        try {
            const colors = await this._extractColors(wallpaperPath);
            this._colors = colors;
            this.saveToCache();
            this.emit('changed');
            
            // Apply to GTK
            const settings = Gtk.Settings.get_default();
            if (settings) {
                const isDark = this._isColorDark(colors.backgroundColor || '#000000');
                settings.gtk_application_prefer_dark_theme = isDark;
            }
            
            return colors;
        } catch (error) {
            console.error('Failed to generate colors from wallpaper:', error);
            return null;
        }
    }

    async _extractColors(imagePath) {
        try {
            // Use ImageMagick to extract dominant colors
            const cmd = `convert "${imagePath}" -resize 25x25! -colors 10 -unique-colors txt:-`;
            const output = await Utils.execAsync(cmd);
            
            const colors = output.split('\n')
                .filter(line => line.includes('srgb'))
                .map(line => {
                    const match = line.match(/#[0-9A-Fa-f]{6}/);
                    return match ? match[0] : null;
                })
                .filter(Boolean);

            if (colors.length === 0) {
                throw new Error('No colors extracted');
            }

            return {
                primary: colors[0],
                secondary: colors[1] || colors[0],
                backgroundColor: this._isColorDark(colors[0]) ? '#000000' : '#ffffff',
                textColor: this._isColorDark(colors[0]) ? '#ffffff' : '#000000',
                accent: colors[2] || colors[0],
            };
        } catch (error) {
            console.error('Color extraction failed:', error);
            throw error;
        }
    }

    _isColorDark(hexColor) {
        const r = parseInt(hexColor.slice(1, 3), 16);
        const g = parseInt(hexColor.slice(3, 5), 16);
        const b = parseInt(hexColor.slice(5, 7), 16);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        return brightness < 128;
    }

    get colors() {
        return this._colors;
    }
}

export default new ColorSchemeService(); 