#!/usr/bin/env bash
cd "$(dirname "$0")"
export base="$(pwd)"

# Environment variables
XDG_BIN_HOME=${XDG_BIN_HOME:-$HOME/.local/bin}
XDG_CACHE_HOME=${XDG_CACHE_HOME:-$HOME/.cache}
XDG_CONFIG_HOME=${XDG_CONFIG_HOME:-$HOME/.config}
XDG_DATA_HOME=${XDG_DATA_HOME:-$HOME/.local/share}
XDG_STATE_HOME=${XDG_STATE_HOME:-$HOME/.local/state}
BACKUP_DIR=${BACKUP_DIR:-$HOME/backup}

# Default options
ask=true
SKIP_SYSUPDATE=false
SKIP_HYPRLAND=false
SKIP_FISH=false
SKIP_MISCCONF=false
SKIP_PLASMAINTG=false
DEPLISTFILE=./scriptdata/dependencies.conf

# Helper functions
function try { "$@" || sleep 0; }

function v() {
  echo -e "####################################################"
  echo -e "\e[34m[$0]: Next command:\e[0m"
  echo -e "\e[32m$@\e[0m"
  execute=true
  if $ask;then
    while true;do
      echo -e "\e[34mExecute? \e[0m"
      echo "  y = Yes"
      echo "  e = Exit now"
      echo "  s = Skip this command (NOT recommended - your setup might not work correctly)"
      echo "  yesforall = Yes and don't ask again; NOT recommended unless you really sure"
      read -p "====> " p
      case $p in
        [yY]) echo -e "\e[34mOK, executing...\e[0m" ;break ;;
        [eE]) echo -e "\e[34mExiting...\e[0m" ;exit ;break ;;
        [sS]) echo -e "\e[34mAlright, skipping this one...\e[0m" ;execute=false ;break ;;
        "yesforall") echo -e "\e[34mAlright, won't ask again. Executing...\e[0m"; ask=false ;break ;;
        *) echo -e "\e[31mPlease enter [y/e/s/yesforall].\e[0m";;
      esac
    done
  fi
  if $execute;then x "$@";else
    echo -e "\e[33m[$0]: Skipped \"$@\"\e[0m"
  fi
}

function x() {
  if "$@";then cmdstatus=0;else cmdstatus=1;fi # 0=normal; 1=failed; 2=failed but ignored
  while [ $cmdstatus == 1 ] ;do
    echo -e "\e[31m[$0]: Command \"\e[32m$@\e[31m\" has failed."
    echo -e "You may need to resolve the problem manually BEFORE repeating this command."
    echo -e "[Tip] If a certain package is failing to install, try installing it separately in another terminal.\e[0m"
    echo "  r = Repeat this command (DEFAULT)"
    echo "  e = Exit now"
    echo "  i = Ignore this error and continue (your setup might not work correctly)"
    read -p " [R/e/i]: " p
    case $p in
      [iI]) echo -e "\e[34mAlright, ignore and continue...\e[0m";cmdstatus=2;;
      [eE]) echo -e "\e[34mAlright, will exit.\e[0m";break;;
      *) echo -e "\e[34mOK, repeating...\e[0m"
         if "$@";then cmdstatus=0;else cmdstatus=1;fi
         ;;
    esac
  done
  case $cmdstatus in
    0) echo -e "\e[34m[$0]: Command \"\e[32m$@\e[34m\" finished.\e[0m";;
    1) echo -e "\e[31m[$0]: Command \"\e[32m$@\e[31m\" has failed. Exiting...\e[0m";exit 1;;
    2) echo -e "\e[31m[$0]: Command \"\e[32m$@\e[31m\" has failed but ignored by user.\e[0m";;
  esac
}

function showfun() {
  echo -e "\e[34m[$0]: The definition of function \"$1\" is as follows:\e[0m"
  printf "\e[32m"
  type -a $1
  printf "\e[97m"
}

function remove_bashcomments_emptylines(){
  mkdir -p $(dirname $2)
  cat $1 | sed -e '/^[[:blank:]]*#/d;s/#.*//' -e '/^[[:space:]]*$/d' > $2
}

function prevent_sudo_or_root(){
  case $(whoami) in
    root)echo -e "\e[31m[$0]: This script is NOT to be executed with sudo or as root. Aborting...\e[0m";exit 1;;
  esac
}

function backup_configs() {
  local backup_dir="$BACKUP_DIR"
  mkdir -p "$backup_dir"
  echo "Backing up $XDG_CONFIG_HOME to $backup_dir/config_backup"
  rsync -av --progress "$XDG_CONFIG_HOME/" "$backup_dir/config_backup/"
  
  echo "Backing up $HOME/.local to $backup_dir/local_backup"
  rsync -av --progress "$HOME/.local/" "$backup_dir/local_backup/"
}

function install-yay() {
  x sudo pacman -S --needed --noconfirm base-devel
  x git clone https://aur.archlinux.org/yay-bin.git /tmp/buildyay
  x cd /tmp/buildyay
  x makepkg -o
  x makepkg -se
  x makepkg -i --noconfirm
  x cd $base
  rm -rf /tmp/buildyay
}

function install-python-packages() {
  UV_NO_MODIFY_PATH=1
  ILLOGICAL_IMPULSE_VIRTUAL_ENV=$XDG_STATE_HOME/ags/.venv
  x mkdir -p $(eval echo $ILLOGICAL_IMPULSE_VIRTUAL_ENV)
  # we need python 3.12 https://github.com/python-pillow/Pillow/issues/8089
  x uv venv --prompt .venv $(eval echo $ILLOGICAL_IMPULSE_VIRTUAL_ENV) -p 3.12
  x source $(eval echo $ILLOGICAL_IMPULSE_VIRTUAL_ENV)/bin/activate
  x uv pip install -r scriptdata/requirements.txt
  x deactivate # We don't need the virtual environment anymore
}

function handle-deprecated-dependencies() {
  printf "\e[36m[$0]: Removing deprecated dependencies:\e[0m\n"
  for i in illogical-impulse-{microtex,pymyc-aur,ags,agsv1} {hyprutils,hyprpicker,hyprlang,hypridle,hyprland-qt-support,hyprland-qtutils,hyprlock,xdg-desktop-portal-hyprland,hyprcursor,hyprwayland-scanner,hyprland}-git;do try sudo pacman --noconfirm -Rdd $i;done
  # Convert old dependencies to non explicit dependencies so that they can be orphaned if not in meta packages
  remove_bashcomments_emptylines ./scriptdata/previous_dependencies.conf ./cache/old_deps_stripped.conf
  readarray -t old_deps_list < ./cache/old_deps_stripped.conf
  pacman -Qeq > ./cache/pacman_explicit_packages
  readarray -t explicitly_installed < ./cache/pacman_explicit_packages

  echo "Attempting to set previously explicitly installed deps as implicit..."
  for i in "${explicitly_installed[@]}"; do for j in "${old_deps_list[@]}"; do
    [ "$i" = "$j" ] && yay -D --asdeps "$i"
  done; done

  return 0
}

function showhelp() {
  echo -e "Syntax: $0 [Options]...

Idempotent installation script for dotfiles.
If no option is specified, run default install process.

  -h, --help                Print this help message and exit
  -f, --force               (Dangerous) Force mode without any confirm
  -c, --clean               Clean the build cache first
  -s, --skip-sysupdate      Skip \"sudo pacman -Syu\"
      --skip-hyprland       Skip installing the config for Hyprland
      --skip-fish           Skip installing the config for Fish
      --skip-plasmaintg     Skip installing plasma-browser-integration
      --skip-miscconf       Skip copying the dirs and files to \".configs\" except for
                            AGS, Fish and Hyprland
      --deplistfile <path>  Specify a dependency list file. By default
                            \"./scriptdata/dependencies.conf\"
      --fontset <set>       (Unavailable yet) Use a set of pre-defined font and config
"
}

function cleancache() {
  rm -rf "$base/cache"
}

# Parse command line arguments
para=$(getopt \
       -o hfk:cs \
       -l help,force,fontset:,deplistfile:,clean,skip-sysupdate,skip-fish,skip-hyprland,skip-plasmaintg,skip-miscconf \
       -n "$0" -- "$@")
[ $? != 0 ] && echo "$0: Error when getopt, please recheck parameters." && exit 1

# Phase 1: Process help and clean options first
eval set -- "$para"
while true ; do
  case "$1" in
    -h|--help) showhelp;exit;;
    -c|--clean) cleancache;shift;;
    --) break ;;
    *) shift ;;
  esac
done

# Phase 2: Process remaining options
eval set -- "$para"
while true ; do
  case "$1" in
    -c|--clean) shift;;
    -f|--force) ask=false;shift;;
    -s|--skip-sysupdate) SKIP_SYSUPDATE=true;shift;;
    --skip-hyprland) SKIP_HYPRLAND=true;shift;;
    --skip-fish) SKIP_FISH=true;shift;;
    --skip-miscconf) SKIP_MISCCONF=true;shift;;
    --skip-plasmaintg) SKIP_PLASMAINTG=true;shift;;
    --deplistfile)
      if [ -f "$2" ];then
        DEPLISTFILE="$2"
      else
        echo -e "Deplist file \"$2\" does not exist.";exit 1
      fi
      shift 2 ;;
    --fontset)
      case $2 in
        "default"|"zh-CN"|"vi") fontset="$2";;
        *) echo -e "Wrong argument for $1.";exit 1;;
      esac
      echo "The fontset is ${fontset}."
      shift 2 ;;
    --) break ;;
    *) echo -e "$0: Wrong parameters.";exit 1;;
  esac
done

# Bulletproof preamble and error-checking block
set -euo pipefail

# Check for network connectivity
ping -c 1 archlinux.org >/dev/null 2>&1 || { echo "[FATAL] No network connection. Please connect to the internet."; exit 1; }

# Check for sudo privileges
sudo -v || { echo "[FATAL] You need sudo privileges to run this script."; exit 1; }

# Check for required system tools
for cmd in rsync curl git make gcc; do
  command -v $cmd >/dev/null 2>&1 || { echo "[FATAL] $cmd is required but not installed."; exit 1; }
done

# Check for Python 3.12+
python3 --version 2>/dev/null | grep -q '3.12' || { echo "[FATAL] Python 3.12+ is required. Please install it before proceeding."; exit 1; }

if ! command -v pacman >/dev/null 2>&1; then 
  printf "\e[31m[$0]: pacman not found, it seems that the system is not ArchLinux or Arch-based distros. Aborting...\e[0m\n"
  exit 1
fi

prevent_sudo_or_root

startask() {
  printf "\e[34m[$0]: Hi there! Before we start:\n"
  printf 'This script 1. only works for ArchLinux and Arch-based distros.\n'
  printf '            2. does not handle system-level/hardware stuff like Nvidia drivers\n'
  printf "\e[31m"
  
  printf "Would you like to create a backup for \"$XDG_CONFIG_HOME\" and \"$HOME/.local/\" folders?\n[y/N]: "
  read -p " " backup_confirm
  case $backup_confirm in
    [yY][eE][sS]|[yY])
      backup_configs
      ;;
    *)
      echo "Skipping backup..."
      ;;
  esac
  
  printf '\n'
  printf 'Do you want to confirm every time before a command executes?\n'
  printf '  y = Yes, ask me before executing each of them. (DEFAULT)\n'
  printf '  n = No, just execute them automatically.\n'
  printf '  a = Abort.\n'
  read -p "====> " p
  case $p in
    n) ask=false ;;
    a) exit 1 ;;
    *) ask=true ;;
  esac
}

case $ask in
  false) sleep 0 ;;
  *) startask ;;
esac

set -e

printf "\e[36m[$0]: 1. Get packages and setup user groups/services\n\e[0m"

# Issue #363
case $SKIP_SYSUPDATE in
  true) sleep 0;;
  *) v sudo pacman -Syu;;
esac

remove_bashcomments_emptylines ${DEPLISTFILE} ./cache/dependencies_stripped.conf
readarray -t pkglist < ./cache/dependencies_stripped.conf

# Use yay. Because paru does not support cleanbuild.
# Also see https://wiki.hyprland.org/FAQ/#how-do-i-update
if ! command -v yay >/dev/null 2>&1;then
  echo -e "\e[33m[$0]: \"yay\" not found.\e[0m"
  showfun install-yay
  v install-yay
fi

# Install extra packages from dependencies.conf as declared by the user
if (( ${#pkglist[@]} != 0 )); then
  if $ask; then
    # execute per element of the array $pkglist
    for i in "${pkglist[@]}";do v yay -S --needed $i;done
  else
    # execute for all elements of the array $pkglist in one line
    v yay -S --needed --noconfirm ${pkglist[*]}
  fi
fi

showfun handle-deprecated-dependencies
v handle-deprecated-dependencies

# https://github.com/end-4/dots-hyprland/issues/581
# yay -Bi is kinda hit or miss, instead cd into the relevant directory and manually source and install deps
install-local-pkgbuild() {
  local location=$1
  local installflags=$2

  x pushd $location

  source ./PKGBUILD
  x yay -S $installflags --asdeps "${depends[@]}"
  x makepkg -Asi --noconfirm

  x popd
}

# Install core dependencies from the meta-packages
metapkgs=(./arch-packages/illogical-impulse-{audio,python,backlight,basic,fonts-themes,gnome,gtk,portal,screencapture,widgets})
metapkgs+=(./arch-packages/illogical-impulse-agsv1-git)
metapkgs+=(./arch-packages/illogical-impulse-hyprland)
metapkgs+=(./arch-packages/illogical-impulse-microtex-git)
metapkgs+=(./arch-packages/illogical-impulse-oneui4-icons-git)
[[ -f /usr/share/icons/Bibata-Modern-Classic/index.theme ]] || \
  metapkgs+=(./arch-packages/illogical-impulse-bibata-modern-classic-bin)

for i in "${metapkgs[@]}"; do
  metainstallflags="--needed"
  $ask && showfun install-local-pkgbuild || metainstallflags="$metainstallflags --noconfirm"
  v install-local-pkgbuild "$i" "$metainstallflags"
done

# Ensure uv (Python package manager) is installed
if ! command -v uv >/dev/null 2>&1; then
  echo -e "\e[36m[$0]: Installing uv (Python package manager)\e[0m"
  bash <(curl -LJs "https://astral.sh/uv/install.sh")
fi

# These python packages are installed using uv, not pacman.
showfun install-python-packages
v install-python-packages

## Optional dependencies
if pacman -Qs ^plasma-browser-integration$ ;then SKIP_PLASMAINTG=true;fi
case $SKIP_PLASMAINTG in
  true) sleep 0;;
  *)
    if $ask;then
      echo -e "\e[33m[$0]: NOTE: The size of \"plasma-browser-integration\" is about 250 MiB.\e[0m"
      echo -e "\e[33mIt is needed if you want playtime of media in Firefox to be shown on the music controls widget.\e[0m"
      echo -e "\e[33mInstall it? [y/N]\e[0m"
      read -p "====> " p
    else
      p=y
    fi
    case $p in
      y) x sudo pacman -S --needed --noconfirm plasma-browser-integration ;;
      *) echo "Ok, won't install"
    esac
    ;;
esac

v sudo usermod -aG video,i2c,input "$(whoami)"
v bash -c "echo i2c-dev | sudo tee /etc/modules-load.d/i2c-dev.conf"
v systemctl --user enable ydotool --now
v sudo systemctl enable bluetooth --now
v gsettings set org.gnome.desktop.interface font-name 'Rubik 11'
v gsettings set org.gnome.desktop.interface color-scheme 'prefer-dark'

# Ensure HyprMenu build dependencies are installed
echo -e "\e[36m[$0]: Installing dependencies for HyprMenu (gtk4, gtk4-layer-shell, meson, ninja, pkgconf, gcc, glib2, git, base-devel)\e[0m"
sudo pacman -S --needed git base-devel meson ninja pkgconf gcc gtk4 gtk4-layer-shell glib2

# Install HyprMenu (modern launcher for Hyprland)
echo -e "\e[36m[$0]: Installing HyprMenu (modern launcher for Hyprland)\e[0m"
if [ ! -d "$base/Extras/HyprMenu" ]; then
  git clone --depth=1 https://github.com/ryzendew/HyprMenu.git "$base/Extras/HyprMenu"
else
  echo "[$0]: HyprMenu directory already exists, pulling latest changes."
  git -C "$base/Extras/HyprMenu" pull
fi
cd "$base/Extras/HyprMenu"
sudo ./build.sh --install
cd "$base"

printf "\e[36m[$0]: 2. Copying + Configuring\e[0m\n"

# In case some folders does not exists
v mkdir -p $XDG_BIN_HOME $XDG_CACHE_HOME $XDG_CONFIG_HOME $XDG_DATA_HOME

# `--delete' for rsync to make sure that
# original dotfiles and new ones in the SAME DIRECTORY
# (eg. in ~/.config/hypr) won't be mixed together

# MISC (For .config/* but not AGS, not Fish, not Hyprland)
case $SKIP_MISCCONF in
  true) sleep 0;;
  *)
    for i in $(find .config/ -mindepth 1 -maxdepth 1 ! -name 'ags' ! -name 'fish' ! -name 'hypr' -exec basename {} \;); do
      echo "[$0]: Found target: .config/$i"
      if [ -d ".config/$i" ];then v rsync -av --delete ".config/$i/" "$XDG_CONFIG_HOME/$i/"
      elif [ -f ".config/$i" ];then v rsync -av ".config/$i" "$XDG_CONFIG_HOME/$i"
      fi
    done
    ;;
esac

case $SKIP_FISH in
  true) sleep 0;;
  *)
    v rsync -av --delete .config/fish/ "$XDG_CONFIG_HOME"/fish/
    ;;
esac

# For AGS
case $SKIP_AGS in
  true) sleep 0;;
  *)
    v rsync -av --delete --exclude '/user_options.jsonc' .config/ags/ "$XDG_CONFIG_HOME"/ags/
    t="$XDG_CONFIG_HOME/ags/user_options.jsonc"
    if [ -f $t ];then
      echo -e "\e[34m[$0]: \"$t\" already exists.\e[0m"
      existed_ags_opt=y
    else
      echo -e "\e[33m[$0]: \"$t\" does not exist yet.\e[0m"
      v cp .config/ags/user_options.jsonc $t
      existed_ags_opt=n
    fi
    ;;
esac

# For Hyprland
case $SKIP_HYPRLAND in
  true) sleep 0;;
  *)
    v rsync -av --delete --exclude '/custom' --exclude '/hyprlock.conf' --exclude '/hypridle.conf' --exclude '/hyprland.conf' .config/hypr/ "$XDG_CONFIG_HOME"/hypr/
    t="$XDG_CONFIG_HOME/hypr/hyprland.conf"
    if [ -f $t ];then
      echo -e "\e[34m[$0]: \"$t\" already exists.\e[0m"
      if [ -f "$XDG_STATE_HOME/ags/user/firstrun.txt" ]
      then
        echo -e "\e[33m[$0]: First run detected. Will copy the default config.\e[0m"
        v cp .config/hypr/hyprland.conf $t
      else
        echo -e "\e[33m[$0]: Will NOT copy the default config.\e[0m"
      fi
    else
      echo -e "\e[33m[$0]: \"$t\" does not exist yet.\e[0m"
      v cp .config/hypr/hyprland.conf $t
    fi
    ;;
esac

printf "\e[36m[$0]: 3. Finalizing\e[0m\n"

# Make sure that the user has the right permissions
v chmod -R u+rw $XDG_CONFIG_HOME
v chmod -R u+rw $XDG_DATA_HOME

# Make sure that the user has the right permissions for HyprMenu
v chmod -R u+rw "$base/Extras/HyprMenu"

printf "\e[36m[$0]: Done!\e[0m\n"
printf "\e[36m[$0]: Please log out and log back in to apply all changes.\e[0m\n"
