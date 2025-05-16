import Widget from 'resource:///com/github/Aylur/ags/widget.js';
import App from 'resource:///com/github/Aylur/ags/app.js';
import Applications from 'resource:///com/github/Aylur/ags/service/applications.js';

// System action buttons at the bottom
const SystemActions = () => Widget.Box({
    className: 'system-actions',
    spacing: 8,
    children: [
        Widget.Button({
            child: Widget.Icon({ icon: 'document-save-symbolic' }),
            tooltipText: 'Save Session',
        }),
        Widget.Button({
            child: Widget.Icon({ icon: 'system-shutdown-symbolic' }),
            tooltipText: 'Power Off',
        }),
        Widget.Button({
            child: Widget.Icon({ icon: 'view-refresh-symbolic' }),
            tooltipText: 'Restart',
        }),
        Widget.Button({
            child: Widget.Icon({ icon: 'weather-clear-night-symbolic' }),
            tooltipText: 'Sleep',
        }),
        Widget.Button({
            child: Widget.Icon({ icon: 'system-log-out-symbolic' }),
            tooltipText: 'Logout',
        }),
        Widget.Button({
            child: Widget.Icon({ icon: 'system-lock-screen-symbolic' }),
            tooltipText: 'Lock',
        }),
    ],
});

const AppItem = ({ app, isGrid = false }) => Widget.Button({
    className: isGrid ? 'app-item grid' : 'app-item list',
    onClicked: () => {
        App.closeWindow('hyprmenu');
        app.launch();
    },
    child: Widget.Box({
        vertical: isGrid,
        children: [
            Widget.Icon({
                icon: app.icon_name || 'application-x-executable',
                size: isGrid ? 64 : 32,
            }),
            Widget.Label({
                label: app.name,
                xalign: isGrid ? 0.5 : 0,
                vpack: 'center',
                truncate: 'end',
                wrap: isGrid,
                justify: isGrid ? 'center' : 'left',
                className: isGrid ? 'grid-label' : 'list-label',
            }),
            isGrid ? null : Widget.Label({
                label: app.description || '',
                xalign: 0,
                vpack: 'center',
                wrap: true,
                className: 'description-label',
            }),
        ].filter(Boolean),
    }),
});

const GridView = (apps) => Widget.Box({
    className: 'grid-view',
    children: [
        Widget.FlowBox({
            min_children_per_line: 4,
            max_children_per_line: 4,
            homogeneous: true,
            children: apps.map(app => AppItem({ app, isGrid: true })),
        }),
    ],
});

const ListView = (apps) => Widget.Box({
    vertical: true,
    className: 'list-view',
    children: apps.map(app => AppItem({ app, isGrid: false })),
});

const SearchBox = ({ onSearchChange }) => Widget.Entry({
    hexpand: true,
    primary_icon_name: 'search-symbolic',
    placeholder_text: 'Search',
    className: 'search-box',
    onChange: ({ text }) => onSearchChange(text || ''),
});

export default () => {
    let currentView = 'grid'; // or 'list'
    let searchResults = Applications.query('');
    
    const contentBox = Widget.Box({
        vertical: true,
        children: [
            Widget.Scrollable({
                vexpand: true,
                child: GridView(searchResults),
            }),
        ],
    });

    const updateResults = (text) => {
        searchResults = Applications.query(text);
        const view = currentView === 'grid' ? GridView(searchResults) : ListView(searchResults);
        contentBox.children[0].child = view;
    };

    return Widget.Window({
        name: 'hyprmenu',
        anchor: ['center'],
        layer: 'overlay',
        keymode: 'exclusive',
        exclusive: true,
        focusable: true,
        child: Widget.Box({
            vertical: true,
            className: 'menu-box',
            children: [
                SearchBox({ onSearchChange: updateResults }),
                contentBox,
                SystemActions(),
            ],
        }),
    });
}; 