const { Gdk, GLib } = imports.gi;
import Service from 'resource:///com/github/Aylur/ags/service.js';
import * as Utils from 'resource:///com/github/Aylur/ags/utils.js';
import ColorScheme from './colorscheme.js';

const WALLPAPER_CONFIG_PATH = `${GLib.get_user_state_dir()}/ags/user/wallpaper.json`;

class WallpaperService extends Service {
    static {
        Service.register(
            this,
            { 'updated': [], },
        );
    }

    _wallPath = '';
    _wallJson = [];
    _monitorCount = 1;

    _save() {
        Utils.writeFile(JSON.stringify(this._wallJson), this._wallPath)
            .catch(print);
    }

    async add(path) {
        this._wallJson.push(path);
        this._save();
        if (userOptions.appearance.colorScheme.generateFromWallpaper) {
            await ColorScheme.generateFromWallpaper(path);
        }
        this.emit('updated');
    }

    async set(path, monitor = -1) {
        this._monitorCount = Gdk.Display.get_default()?.get_n_monitors() || 1;
        if (this._wallJson.length < this._monitorCount) this._wallJson[this._monitorCount - 1] = "";
        if (monitor == -1)
            this._wallJson.fill(path);
        else
            this._wallJson[monitor] = path;

        this._save();
        if (userOptions.appearance.colorScheme.generateFromWallpaper) {
            await ColorScheme.generateFromWallpaper(path);
        }
        this.emit('updated');
    }

    get(monitor = 0) {
        return this._wallJson[monitor];
    }

    constructor() {
        super();
        // How many screens?
        this._monitorCount = Gdk.Display.get_default()?.get_n_monitors() || 1;
        // Read config
        this._wallPath = WALLPAPER_CONFIG_PATH;
        try {
            const fileContents = Utils.readFile(this._wallPath);
            this._wallJson = JSON.parse(fileContents);
            // Generate colors from current wallpaper if enabled
            if (userOptions.appearance.colorScheme.generateFromWallpaper && this._wallJson.length > 0) {
                ColorScheme.generateFromWallpaper(this._wallJson[0]).catch(print);
            }
        }
        catch {
            Utils.exec(`bash -c 'mkdir -p ${GLib.get_user_cache_dir()}/ags/user'`);
            Utils.exec(`touch ${this._wallPath}`);
            Utils.writeFile('[]', this._wallPath).then(() => {
                this._wallJson = JSON.parse(Utils.readFile(this._wallPath))
            }).catch(print);
        }
    }
}

// instance
const service = new WallpaperService();
// make it global for easy use with cli
globalThis['wallpaper'] = service;
export default service;