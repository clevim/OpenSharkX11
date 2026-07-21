use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[repr(u8)]
pub enum FirmwareAction {
    DisableButton   = 0x01,
    LeftClick       = 0x02,
    RightClick      = 0x03,
    MiddleClick     = 0x04,
    Backward        = 0x05,
    Forward         = 0x06,
    DoubleClick     = 0x07,
    Fire            = 0x08,
    ScrollUp        = 0x09,
    ScrollDown      = 0x0a,
    DpiCycle        = 0x0d,
    DpiPlus         = 0x0e,
    DpiMinus        = 0x0f,
    EasyAim         = 0x10,
    Keyboard        = 0x11,
    CustomMacro     = 0x12,
    MediaPlayer     = 0x15,
    PreviousTrack   = 0x16,
    NextTrack       = 0x17,
    PlayPause       = 0x18,
    Stop            = 0x19,
    Mute            = 0x1a,
    VolPlus         = 0x1b,
    VolMinus        = 0x1c,
    Calculator      = 0x1d,
    Email           = 0x1e,
    BrowserForward  = 0x20,
    BrowserBackward = 0x21,
    BrowserStop     = 0x22,
    MyComputer      = 0x23,
    BrowserRefresh  = 0x24,
    BrowserHome     = 0x25,
    BrowserSearch   = 0x26,
}

pub const MOD_NONE : u8 = 0x00;
pub const MOD_CTRL : u8 = 0x01;
pub const MOD_SHIFT: u8 = 0x02;
pub const MOD_ALT  : u8 = 0x04;
pub const MOD_WIN  : u8 = 0x08;

pub type MacroTuple = (FirmwareAction, u8, u8);

/// All macro templates, matching macroTemplates in MacrosBuilder.ts
pub static MACRO_TEMPLATES: std::sync::LazyLock<HashMap<&'static str, MacroTuple>> =
    std::sync::LazyLock::new(|| {
        use FirmwareAction::*;
        let mut m: HashMap<&'static str, MacroTuple> = HashMap::new();
        m.insert("global-disable-button",     (DisableButton,   MOD_NONE,              0x00));
        m.insert("global-left-click",          (LeftClick,       MOD_NONE,              0x00));
        m.insert("global-right-click",         (RightClick,      MOD_NONE,              0x00));
        m.insert("global-middle",              (MiddleClick,     MOD_NONE,              0x00));
        m.insert("global-backward",            (Backward,        MOD_NONE,              0x00));
        m.insert("global-forward",             (Forward,         MOD_NONE,              0x00));
        m.insert("global-double-click",        (DoubleClick,     MOD_NONE,              0x00));
        m.insert("global-fire-button",         (Fire,            MOD_NONE,              0x00));
        m.insert("global-scroll-up",           (ScrollUp,        MOD_NONE,              0x00));
        m.insert("global-scroll-down",         (ScrollDown,      MOD_NONE,              0x00));
        m.insert("global-easy-aim",            (EasyAim,         MOD_NONE,              0x03));
        m.insert("global-dpi-cycle",           (DpiCycle,        MOD_NONE,              0x00));
        m.insert("global-dpi-+",               (DpiPlus,         MOD_NONE,              0x00));
        m.insert("global-dpi--",               (DpiMinus,        MOD_NONE,              0x00));
        m.insert("multimedia-media-player",    (MediaPlayer,     MOD_NONE,              0x00));
        m.insert("multimedia-play-pause",      (PlayPause,       MOD_NONE,              0x00));
        m.insert("multimedia-stop-music",      (Stop,            MOD_NONE,              0x00));
        m.insert("multimedia-previous-track",  (PreviousTrack,   MOD_NONE,              0x00));
        m.insert("multimedia-next-track",      (NextTrack,       MOD_NONE,              0x00));
        m.insert("multimedia-volume-+",        (VolPlus,         MOD_NONE,              0x00));
        m.insert("multimedia-volume--",        (VolMinus,        MOD_NONE,              0x00));
        m.insert("multimedia-mute",            (Mute,            MOD_NONE,              0x00));
        m.insert("browser-home",               (BrowserHome,     MOD_NONE,              0x00));
        m.insert("browser-favorites",          (Keyboard,        MOD_CTRL | MOD_SHIFT,  0x12)); // Ctrl+Shift+O
        m.insert("browser-forward",            (BrowserForward,  MOD_NONE,              0x00));
        m.insert("browser-backward",           (BrowserBackward, MOD_NONE,              0x00));
        m.insert("browser-stop",               (BrowserStop,     MOD_NONE,              0x00));
        m.insert("browser-refresh",            (BrowserRefresh,  MOD_NONE,              0x00));
        m.insert("browser-search",             (BrowserSearch,   MOD_NONE,              0x00));
        m.insert("browser-email",              (Email,           MOD_NONE,              0x00));
        m.insert("browser-calculator",         (Calculator,      MOD_NONE,              0x00));
        m.insert("browser-my-computer",        (MyComputer,      MOD_NONE,              0x00));
        m.insert("shortcut-cut",               (Keyboard,        MOD_CTRL,              0x1b)); // X
        m.insert("shortcut-copy",              (Keyboard,        MOD_CTRL,              0x06)); // C
        m.insert("shortcut-paste",             (Keyboard,        MOD_CTRL,              0x19)); // V
        m.insert("shortcut-open",              (Keyboard,        MOD_CTRL,              0x12)); // O
        m.insert("shortcut-save",              (Keyboard,        MOD_CTRL,              0x16)); // S
        m.insert("shortcut-find",              (Keyboard,        MOD_CTRL,              0x09)); // F
        m.insert("shortcut-undo",              (Keyboard,        MOD_CTRL,              0x1d)); // Z
        m.insert("shortcut-redo",              (Keyboard,        MOD_CTRL,              0x1c)); // Y
        m.insert("shortcut-select-all",        (Keyboard,        MOD_CTRL,              0x04)); // A
        m.insert("shortcut-print",             (Keyboard,        MOD_CTRL,              0x13)); // P
        m.insert("shortcut-close-window",      (Keyboard,        MOD_ALT,               0x3d)); // F4
        m.insert("shortcut-swap-window",       (Keyboard,        MOD_ALT,               0x2b)); // Tab
        m.insert("shortcut-show-desktop",      (Keyboard,        MOD_WIN,               0x07)); // D
        m.insert("shortcut-run-command",       (Keyboard,        MOD_WIN,               0x15)); // R
        m.insert("shortcut-lock-pc",           (Keyboard,        MOD_WIN,               0x0f)); // L
        m.insert("shortcut-screen-capture",    (Keyboard,        MOD_WIN | MOD_SHIFT,   0x16)); // S
        m.insert("custom-macro-left-button",   (CustomMacro,     MOD_NONE,              0x01));
        m.insert("custom-macro-right-button",  (CustomMacro,     MOD_NONE,              0x02));
        m.insert("custom-macro-middle-button", (CustomMacro,     MOD_NONE,              0x03));
        m.insert("custom-macro-extra-button_4",(CustomMacro,     MOD_NONE,              0x07));
        m.insert("custom-macro-extra-button_5",(CustomMacro,     MOD_NONE,              0x08));
        m
    });

/// button_idx → buffer byte offset (mirrors BUTTON_OFFSET / internalButtonsMap in TS)
const BUTTON_OFFSETS: [(usize, usize); 8] = [
    (0, 3),   // left
    (1, 6),   // right
    (2, 9),   // middle
    (3, 21),  // forward
    (4, 24),  // backward
    (5, 18),  // dpi
    (6, 51),  // scroll_up
    (7, 54),  // scroll_down
];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MacroEntry {
    pub action:   u8,
    pub modifier: u8,
    pub key_code: u8,
}

impl MacroEntry {
    pub fn from_template(name: &str) -> Self {
        let (a, m, k) = MACRO_TEMPLATES.get(name).copied()
            .unwrap_or((FirmwareAction::DisableButton, MOD_NONE, 0x00));
        Self { action: a as u8, modifier: m, key_code: k }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MacrosConfig {
    /// 8 entries: [left, right, middle, forward, backward, dpi, scroll_up, scroll_down]
    pub buttons: [MacroEntry; 8],
}

impl Default for MacrosConfig {
    fn default() -> Self {
        Self {
            buttons: [
                MacroEntry::from_template("global-left-click"),
                MacroEntry::from_template("global-right-click"),
                MacroEntry::from_template("global-middle"),
                MacroEntry::from_template("global-forward"),
                MacroEntry::from_template("global-backward"),
                MacroEntry::from_template("global-dpi-cycle"),
                MacroEntry::from_template("global-scroll-up"),
                MacroEntry::from_template("global-scroll-down"),
            ],
        }
    }
}

pub fn build_macros(cfg: &MacrosConfig) -> Vec<u8> {
    let mut buf = [0u8; 59];
    buf[0] = 0x08; buf[1] = 0x3b; buf[2] = 0x01;

    // Initialize all 18 button slots (3 bytes each) to [0x01, 0x00, 0x00]
    for i in 0..18usize {
        buf[3 + i * 3] = 0x01;
    }
    // Internal defaults: DPI cycle slot 6, scroll slots 17-18
    buf[18] = 0x0d;
    buf[51] = 0x09;
    buf[54] = 0x0a;

    for (btn_idx, &(_, offset)) in BUTTON_OFFSETS.iter().enumerate() {
        if let Some(entry) = cfg.buttons.get(btn_idx) {
            buf[offset]     = entry.action;
            buf[offset + 1] = entry.modifier;
            buf[offset + 2] = entry.key_code;
        }
    }

    // Checksum: (sum of bytes[2..57]) - 1) & 0xFF
    let sum: u32 = buf[2..58].iter().map(|&b| b as u32).sum();
    buf[58] = ((sum.wrapping_sub(1)) & 0xff) as u8;

    buf.to_vec()
}

pub const MACROS_CONTROL_PARAMS: (u8, u8, u16, u16) = (0x21, 0x09, 0x0308, 2);
