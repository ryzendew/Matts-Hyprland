#!/usr/bin/env bash

XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
XDG_CACHE_HOME="${XDG_CACHE_HOME:-$HOME/.cache}"
XDG_STATE_HOME="${XDG_STATE_HOME:-$HOME/.local/state}"
CONFIG_DIR="$XDG_CONFIG_HOME/ags"
CACHE_DIR="$XDG_CACHE_HOME/ags"
STATE_DIR="$XDG_STATE_HOME/ags"
COLORS="$STATE_DIR/scss/_material.scss"
KITTY_COLORS="$XDG_CONFIG_HOME/kitty/kitty-colors.conf"

# check if no arguments
if [ $# -eq 0 ]; then
    echo "Usage: colorgen.sh /path/to/image (--apply)"
    exit 1
fi

# check if the file $STATE_DIR/user/colormode.txt exists. if not, create it. else, read it to $lightdark
colormodefile="$STATE_DIR/user/colormode.txt"
lightdark="dark"
transparency="opaque"
materialscheme="vibrant"
terminalscheme="$XDG_CONFIG_HOME/ags/scripts/templates/terminal/scheme-base.json"

if [ ! -f $colormodefile ]; then
    echo "dark" > $colormodefile
    echo "opaque" >> $colormodefile
    echo "vibrant" >> $colormodefile
elif [[ $(wc -l < $colormodefile) -ne 4 || $(wc -w < $colormodefile) -ne 4 ]]; then
    echo "dark" > $colormodefile
    echo "opaque" >> $colormodefile
    echo "vibrant" >> $colormodefile
    echo "yesgradience" >> $colormodefile
else
    lightdark=$(sed -n '1p' $colormodefile)
    transparency=$(sed -n '2p' $colormodefile)
    materialscheme=$(sed -n '3p' $colormodefile)
    if [ "$materialscheme" = "monochrome" ]; then
      terminalscheme="$XDG_CONFIG_HOME/ags/scripts/templates/terminal/scheme-monochrome.json"
    fi
fi
backend="material" # color generator backend
if [ ! -f "$STATE_DIR/user/colorbackend.txt" ]; then
    echo "material" > "$STATE_DIR/user/colorbackend.txt"
else
    backend=$(cat "$STATE_DIR/user/colorbackend.txt")
fi

cd "$CONFIG_DIR/scripts/" || exit
if [[ "$1" = "#"* ]]; then # this is a color
    color_generation/generate_colors_material.py --color "$1" \
    --mode "$lightdark" --scheme "$materialscheme" --transparency "$transparency" \
    --termscheme $terminalscheme --blend_bg_fg \
    > "$CACHE_DIR"/user/generated/material_colors.scss
    if [ "$2" = "--apply" ]; then
        cp "$CACHE_DIR"/user/generated/material_colors.scss "$STATE_DIR/scss/_material.scss"
        color_generation/applycolor.sh
    fi
elif [ "$backend" = "material" ]; then
    smartflag=''
    if [ "$3" = "--smart" ]; then
        smartflag='--smart'
    fi
    source $(eval echo $ILLOGICAL_IMPULSE_VIRTUAL_ENV)/bin/activate
    python color_generation/generate_colors_material.py --path "$(realpath "$1")" \
    --mode "$lightdark" --scheme "$materialscheme" --transparency "$transparency" \
    --termscheme $terminalscheme --blend_bg_fg \
    --cache "$STATE_DIR/user/color.txt" $smartflag \
    > "$CACHE_DIR"/user/generated/material_colors.scss
    deactivate
    if [ "$2" = "--apply" ]; then
        cp "$CACHE_DIR"/user/generated/material_colors.scss "$STATE_DIR/scss/_material.scss"
        color_generation/applycolor.sh
    fi
elif [ "$backend" = "pywal" ]; then
    # clear and generate
    source $(eval echo $ILLOGICAL_IMPULSE_VIRTUAL_ENV)/bin/activate
    wal -c
    wal -i "$1" -n $lightdark -q
    deactivate
    # copy scss
    cp "$XDG_CACHE_HOME/wal/colors.scss" "$CACHE_DIR"/user/generated/material_colors.scss

    cat color_generation/pywal_to_material.scss >> "$CACHE_DIR"/user/generated/material_colors.scss
    if [ "$2" = "--apply" ]; then
        sass -I "$STATE_DIR/scss" -I "$CONFIG_DIR/scss/fallback" "$CACHE_DIR"/user/generated/material_colors.scss "$CACHE_DIR"/user/generated/colors_classes.scss --style compressed
        # sed -i "s/ { color//g" "$CACHE_DIR"/user/generated/colors_classes.scss
        # sed -i "s/\./$/g" "$CACHE_DIR"/user/generated/colors_classes.scss
        # sed -i "s/}//g" "$CACHE_DIR"/user/generated/colors_classes.scss
        sed -i "s/{color//g" "$CACHE_DIR"/user/generated/colors_classes.scss
        sed -i "s/\./$/g" "$CACHE_DIR"/user/generated/colors_classes.scss
        sed -i "s/\:/: /g" "$CACHE_DIR"/user/generated/colors_classes.scss
        sed -i "s/}/;\n/g" "$CACHE_DIR"/user/generated/colors_classes.scss
        if [ "$lightdark" = "light" ]; then
            printf "\n""\$darkmode: false;""\n" >> "$CACHE_DIR"/user/generated/colors_classes.scss
        else
            printf "\n""\$darkmode: true;""\n" >> "$CACHE_DIR"/user/generated/colors_classes.scss
        fi

        cp "$CACHE_DIR"/user/generated/colors_classes.scss "$STATE_DIR/scss/_material.scss"
	color_generation/applycolor.sh
    fi
fi

# === Kitty Colors ===
if [ "$2" = "--apply" ]; then
    # Extract background and foreground from $term0 and $term11
    bg=$(grep '^\$term0:' "$COLORS" | sed -E 's/.*: *([^;]+);/\1/')
    fg=$(grep '^\$term11:' "$COLORS" | sed -E 's/.*: *([^;]+);/\1/')

    # Start fresh
    > "$KITTY_COLORS"
    echo "background $bg" >> "$KITTY_COLORS"
    echo "foreground $fg" >> "$KITTY_COLORS"

    # Add all color0–15 values
    grep '^\$term[0-9]\+:' "$COLORS" | while read -r line; do
        TERM_NUM=$(echo "$line" | sed -E 's/^\$term([0-9]+):.*/\1/')
        COLOR_VAL=$(echo "$line" | sed -E 's/.*: *([^;]+);/\1/')
        echo "color$TERM_NUM $COLOR_VAL" >> "$KITTY_COLORS"
    done

    echo "Generated Kitty theme at $KITTY_COLORS"
fi

# === Vencord Colors ====
# File Paths
colors_file="$HOME/.local/state/ags/scss/_material.scss"
vencord="$HOME/.config/Vencord/themes/ml4w-wal.css"
vesktop="$HOME/.config/vesktop/themes/ml4w-wal.css"

# Extract colors into array variables
declare -A color
for i in {0..15}; do
    val=$(grep "^\$term$i:" "$colors_file" | sed -E 's/.*: *([^;]+);/\1/')
    color[$i]="$val"
done

# Build CSS content with extracted terminal colors
css_content=$(cat <<EOF
/**
 * @name system24
 * @description a tui-like discord theme.
 * @author refact0r
 * @version 2.0.0
 * @invite nz87hXyvcy
 * @website https://github.com/refact0r/system24
 * @source https://github.com/refact0r/system24/blob/master/theme/system24.theme.css
 * @authorId 508863359777505290
 * @authorLink https://www.refact0r.dev
 * @linux script by dizziee
*/

@import url('https://refact0r.github.io/system24/build/system24.css');

body {
    --font: 'DM Mono';
    --code-font: 'DM Mono';
    font-weight: 300;
    --gap: 12px;
    --divider-thickness: 4px;
    --border-thickness: 2px;
    --border-hover-transition: 0.2s ease;
    --animations: on;
    --list-item-transition: 0.2s ease;
    --dms-icon-svg-transition: 0.4s ease;
    --top-bar-height: var(--gap);
    --top-bar-button-position: titlebar;
    --top-bar-title-position: off;
    --subtle-top-bar-title: off;
    --custom-window-controls: off;
    --window-control-size: 14px;
    --custom-dms-icon: off;
    --dms-icon-svg-url: url('');
    --dms-icon-svg-size: 90%;
    --dms-icon-color-before: var(--icon-secondary);
    --dms-icon-color-after: var(--white);
    --custom-dms-background: off;
    --dms-background-image-url: url('');
    --dms-background-image-size: cover;
    --dms-background-color: linear-gradient(70deg, var(--blue-2), var(--purple-2), var(--red-2));
    --background-image: off;
    --background-image-url: url('');
    --transparency-tweaks: off;
    --remove-bg-layer: off;
    --panel-blur: off;
    --blur-amount: 12px;
    --bg-floating: var(--bg-3);
    --small-user-panel: on;
    --unrounding: on;
    --custom-spotify-bar: on;
    --ascii-titles: on;
    --ascii-loader: system24;
    --panel-labels: on;
    --label-color: var(--text-muted);
    --label-font-weight: 500;
}

:root {
    --colors: on;

    --text-0: ${color[4]};
    --text-1: ${color[6]};
    --text-2: ${color[3]};
    --text-3: ${color[7]};
    --text-4: ${color[6]};
    --text-5: ${color[2]};

    --bg-1: oklch(31% 0 0);
    --bg-2: oklch(27% 0 0);
    --bg-3: ${color[0]};
    --bg-4: ${color[0]};
    --hover: ${color[1]};
    --active: ${color[4]};
    --active-2: ${color[2]};
    --message-hover: ${color[1]};

    --accent-1: ${color[5]};
    --accent-2: ${color[5]};
    --accent-3: ${color[5]};
    --accent-4: ${color[5]};
    --accent-5: ${color[5]};
    --accent-new: var(--red-2);
    --mention: linear-gradient(to right, color-mix(in hsl, var(--accent-2), transparent 90%) 40%, transparent);
    --mention-hover: linear-gradient(to right, color-mix(in hsl, var(--accent-2), transparent 95%) 40%, transparent);
    --reply: linear-gradient(to right, color-mix(in hsl, var(--text-3), transparent 90%) 40%, transparent);
    --reply-hover: linear-gradient(to right, color-mix(in hsl, var(--text-3), transparent 95%) 40%, transparent);

    --online: var(--green-2);
    --dnd: var(--red-2);
    --idle: var(--yellow-2);
    --streaming: var(--purple-2);
    --offline: var(--text-4);

    --border-light: var(--hover);
    --border: var(--active);
    --border-hover: ${color[1]};
    --button-border: ${color[3]};

    --red-1: oklch(75% 0.13 0);
    --red-2: oklch(70% 0.13 0);
    --red-3: oklch(65% 0.13 0);
    --red-4: oklch(60% 0.13 0);
    --red-5: oklch(55% 0.13 0);

    --green-1: oklch(75% 0.12 170);
    --green-2: oklch(70% 0.12 170);
    --green-3: oklch(65% 0.12 170);
    --green-4: oklch(60% 0.12 170);
    --green-5: oklch(55% 0.12 160);

    --blue-1: oklch(75% 0.11 215);
    --blue-2: oklch(70% 0.11 215);
    --blue-3: oklch(65% 0.11 215);
    --blue-4: oklch(60% 0.11 215);
    --blue-5: oklch(55% 0.11 215);

    --yellow-1: oklch(80% 0.12 90);
    --yellow-2: oklch(75% 0.12 90);
    --yellow-3: oklch(70% 0.12 90);
    --yellow-4: oklch(65% 0.12 90);
    --yellow-5: oklch(60% 0.12 90);

    --purple-1: oklch(75% 0.12 310);
    --purple-2: oklch(70% 0.12 310);
    --purple-3: oklch(65% 0.12 310);
    --purple-4: oklch(60% 0.12 310);
    --purple-5: oklch(55% 0.12 310);
}
EOF
)

# Write to both Vencord and Vesktop CSS theme files
echo "$css_content" > "$vencord"
echo "$css_content" > "$vesktop"
echo "Updated $vencord and $vesktop with terminal color values!"

#=== Update Spictify Colors ===
# Paths
scss_file="$HOME/.local/state/ags/scss/_material.scss"
ini_file="$HOME/.config/spicetify/Themes/spicewal/color.ini"

# Extract terminal colors
declare -A color
for i in {0..15}; do
    val=$(grep "^\$term$i:" "$scss_file" | sed -E 's/.*: *([^;]+);/\1/')
    color[$i]="${val#\#}" # remove leading '#' for ini style
done

# Map the terminal colors to keys in your .ini file
declare -A map_colors=(
    ["accent"]="${color[5]}"
    ["accent-active"]="${color[4]}"
    ["accent-inactive"]="${color[8]}"
    ["banner"]="${color[7]}"
    ["border-active"]="${color[3]}"
    ["border-inactive"]="${color[4]}"
    ["header"]="${color[7]}"
    ["highlight"]="${color[10]}"
    ["main"]="${color[0]}"
    ["notification"]="${color[4]}"
    ["notification-error"]="${color[1]}"
    ["subtext"]="${color[3]}"
    ["text"]="${color[2]}"
)

# Update the .ini file in place
for key in "${!map_colors[@]}"; do
    newval="${map_colors[$key]}"
    # sed will update value inside quotes after the equal sign
    sed -i -E "s|^($key[[:space:]]*=[[:space:]]*)\"[^\"]*\"|\1\"$newval\"|" "$ini_file"
done

#=== Restarts Spotify App to apply colors 
spicetify apply
echo "Updated Spotify's Spicetify colors!"
