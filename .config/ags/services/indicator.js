import Service from 'resource:///com/github/Aylur/ags/service.js';
import * as Utils from 'resource:///com/github/Aylur/ags/utils.js';

class IndicatorService extends Service {
    static {
        Service.register(
            this,
            { 'popup': ['double'], },
        );
    }

    _delay = 1500;
    _count = 0;
    _hideTimer = null;

    popup(value) {
        this.emit('popup', value);
        
        // If we're showing the indicator
        if (value > -1) {
            this._count++;
            
            // Clear any existing hide timer
            if (this._hideTimer) {
                Utils.timeout.clearTimeout(this._hideTimer);
                this._hideTimer = null;
            }
            
            // Set a new hide timer
            this._hideTimer = Utils.timeout(this._delay, () => {
                this._count--;
                
                if (this._count === 0) {
                    this.emit('popup', -1);
                    this._hideTimer = null;
                }
            });
        } 
        // Force hiding if explicitly requested
        else if (value === -1) {
            this._count = 0;
            if (this._hideTimer) {
                Utils.timeout.clearTimeout(this._hideTimer);
                this._hideTimer = null;
            }
        }
    }

    connectWidget(widget, callback) {
        connect(this, widget, callback, 'popup');
    }
}

// the singleton instance
const service = new IndicatorService();

// make it global for easy use with cli
globalThis['indicator'] = service;

// export to use in other modules
export default service;