// app.js — Nibras Educational Complex SMS frontend (vanilla JS, no build step, fully offline)

const state = { user: null, perms: {}, cache: {} };

// ---------- API helper ----------
async function api(pathAndQuery, options = {}) {
  const res = await fetch('/api' + pathAndQuery, {
    method: options.method || 'GET',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
function can(module, action) {
  const p = state.perms[module];
  if (!p) return false;
  return !!p['can_' + action];
}

// ---------- Branding (school logo/name/motto shown pre- and post-login) ----------
// A handful of preset color themes for the sidebar — chosen from Settings, applied by
// overriding just the CSS variables that already drive the sidebar's look (its translucent
// fill and its gold accent/active-highlight), so every other style stays untouched.
// Color schemes for the printed Student ID Card — separate from the app's own Menu/Page
// themes, since a school might want its ID cards to always look a specific way regardless of
// which theme staff have chosen to browse the system in.
const ID_CARD_THEMES = {
  'navy-gold': { label: 'Navy & Gold', band: '#0f2a4a', accent: '#c8973a' },
  'maroon-cream': { label: 'Maroon & Cream', band: '#6b1f2a', accent: '#e8c477' },
  'forest-white': { label: 'Forest & White', band: '#1a4d2e', accent: '#ffffff' },
  'royal-blue': { label: 'Royal Blue', band: '#1a3d8f', accent: '#f4c430' },
  'burgundy-gold': { label: 'Burgundy & Gold', band: '#5c1f3b', accent: '#d4af37' },
  'charcoal-teal': { label: 'Charcoal & Teal', band: '#26292b', accent: '#3fc1c9' },
};
// A small colored stripe on the card indicating the student's level group (Nursery through
// JHS) — a common real ID-card convention that lets staff tell a student's age group apart at
// a glance, distinct from (and layered on top of) the school's own overall color theme above.
const LEVEL_STRIPE_COLORS = {
  'Nursery': '#e07a9e', 'KG': '#e07a9e',
  'Lower Primary': '#4c9bd6', 'Primary': '#4c9bd6',
  'Upper Primary': '#3fae6b',
  'JHS': '#c8973a',
  'Other': '#8a8f98',
};

const NAV_THEMES = {
  'navy-gold': { label: 'Navy & Gold', fill: 'rgba(10,26,48,0.66)', accent: '#c8973a', accentLight: '#e8c477', swatch: ['#0f2a4a', '#c8973a'] },
  'emerald-cream': { label: 'Emerald & Cream', fill: 'rgba(6,54,44,0.7)', accent: '#2e9e6d', accentLight: '#7fd9b0', swatch: ['#06362c', '#2e9e6d'] },
  'royal-purple': { label: 'Royal Purple', fill: 'rgba(45,20,64,0.7)', accent: '#9b59b6', accentLight: '#d2b4de', swatch: ['#2d1440', '#9b59b6'] },
  'crimson-charcoal': { label: 'Crimson & Charcoal', fill: 'rgba(40,15,15,0.72)', accent: '#c0392b', accentLight: '#ec9c92', swatch: ['#281010', '#c0392b'] },
  'ocean-blue': { label: 'Ocean Blue', fill: 'rgba(10,40,64,0.68)', accent: '#2980b9', accentLight: '#85c1e9', swatch: ['#0a2840', '#2980b9'] },
  'slate-silver': { label: 'Slate & Silver', fill: 'rgba(30,38,48,0.7)', accent: '#95a5a6', accentLight: '#d5dbdb', swatch: ['#1e2630', '#95a5a6'] },
  'forest-gold': { label: 'Forest & Gold', fill: 'rgba(12,38,20,0.7)', accent: '#d4a017', accentLight: '#f0d386', swatch: ['#0c2614', '#d4a017'] },
  'wine-blush': { label: 'Wine & Blush', fill: 'rgba(48,12,26,0.7)', accent: '#c2447a', accentLight: '#f0a8c4', swatch: ['#300c1a', '#c2447a'] },
  'teal-amber': { label: 'Teal & Amber', fill: 'rgba(8,46,48,0.7)', accent: '#e0a020', accentLight: '#f4cd7e', swatch: ['#082e30', '#e0a020'] },
  'indigo-lavender': { label: 'Indigo & Lavender', fill: 'rgba(24,20,64,0.7)', accent: '#8e7cc3', accentLight: '#d4c9ec', swatch: ['#181440', '#8e7cc3'] },
  'coral-cream': { label: 'Coral & Cream', fill: 'rgba(50,24,20,0.7)', accent: '#e67e5a', accentLight: '#f6c8b4', swatch: ['#321814', '#e67e5a'] },
  'graphite-lime': { label: 'Graphite & Lime', fill: 'rgba(28,28,28,0.72)', accent: '#a4d65e', accentLight: '#d8f0af', swatch: ['#1c1c1c', '#a4d65e'] },
  'plum-peach': { label: 'Plum & Peach', fill: 'rgba(42,16,42,0.7)', accent: '#e8a87c', accentLight: '#f6d5bc', swatch: ['#2a102a', '#e8a87c'] },
  'navy-mint': { label: 'Navy & Mint', fill: 'rgba(10,30,46,0.7)', accent: '#5fc9a8', accentLight: '#b0e8d5', swatch: ['#0a1e2e', '#5fc9a8'] },
  'burgundy-rosegold': { label: 'Burgundy & Rose Gold', fill: 'rgba(46,14,20,0.72)', accent: '#c98a7a', accentLight: '#eec7bc', swatch: ['#2e0e14', '#c98a7a'] },
  'steel-sky': { label: 'Steel & Sky', fill: 'rgba(24,34,44,0.7)', accent: '#5aa9e6', accentLight: '#b8dcf7', swatch: ['#182230', '#5aa9e6'] },
  'olive-sand': { label: 'Olive & Sand', fill: 'rgba(34,36,16,0.7)', accent: '#c9b568', accentLight: '#ecdfb0', swatch: ['#222410', '#c9b568'] },
  'charcoal-copper': { label: 'Charcoal & Copper', fill: 'rgba(26,26,26,0.72)', accent: '#c87f4a', accentLight: '#eab98e', swatch: ['#1a1a1a', '#c87f4a'] },
  'sapphire-silver': { label: 'Sapphire & Silver', fill: 'rgba(10,20,56,0.7)', accent: '#7fa8d9', accentLight: '#c8dcf0', swatch: ['#0a1438', '#7fa8d9'] },
  'terracotta-cream': { label: 'Terracotta & Cream', fill: 'rgba(52,26,16,0.7)', accent: '#d68a5c', accentLight: '#f0c8a8', swatch: ['#341a10', '#d68a5c'] },
  'midnight-turquoise': { label: 'Midnight & Turquoise', fill: 'rgba(8,24,32,0.72)', accent: '#3fc1c9', accentLight: '#a0e8ec', swatch: ['#081820', '#3fc1c9'] },
  'espresso-caramel': { label: 'Espresso & Caramel', fill: 'rgba(36,24,16,0.72)', accent: '#c99456', accentLight: '#e8c896', swatch: ['#241810', '#c99456'] },
  'violet-pink': { label: 'Violet & Pink', fill: 'rgba(36,12,48,0.7)', accent: '#d874b0', accentLight: '#f0b8d8', swatch: ['#240c30', '#d874b0'] },
  'pine-gold': { label: 'Pine & Gold', fill: 'rgba(10,32,24,0.7)', accent: '#d4b03c', accentLight: '#eddb96', swatch: ['#0a2018', '#d4b03c'] },
  'ruby-blush': { label: 'Ruby & Blush', fill: 'rgba(48,10,18,0.72)', accent: '#e05a72', accentLight: '#f4b0bc', swatch: ['#300a12', '#e05a72'] },
};
// Lightens a hex color by mixing it toward white — used to auto-derive a "light" accent shade
// and readable border/text colors from whatever single color the user picks in the custom
// color picker, so they only ever have to choose one color, not four.
function lightenHex(hex, amount) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) + (255 - ((n >> 16) & 255)) * amount));
  const g = Math.min(255, Math.round(((n >> 8) & 255) + (255 - ((n >> 8) & 255)) * amount));
  const b = Math.min(255, Math.round((n & 255) + (255 - (n & 255)) * amount));
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}
function darkenHex(hex, amount) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.round(((n >> 16) & 255) * (1 - amount)));
  const g = Math.max(0, Math.round(((n >> 8) & 255) * (1 - amount)));
  const b = Math.max(0, Math.round((n & 255) * (1 - amount)));
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}
function hexToRgba(hex, alpha) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
function applyNavTheme(themeKey, customColor) {
  if (themeKey === 'custom' && customColor) {
    const root = document.documentElement.style;
    root.setProperty('--sidebar-fill', hexToRgba(darkenHex(customColor, 0.5), 0.68));
    root.setProperty('--gold', customColor);
    root.setProperty('--gold-light', lightenHex(customColor, 0.5));
    return;
  }
  const theme = NAV_THEMES[themeKey] || NAV_THEMES['navy-gold'];
  const root = document.documentElement.style;
  root.setProperty('--sidebar-fill', theme.fill);
  root.setProperty('--gold', theme.accent);
  root.setProperty('--gold-light', theme.accentLight);
}

// Five additional whole-page themes — distinct from the sidebar-only NAV_THEMES above. These
// affect the main content area's background, card surfaces, and text color everywhere.
const PAGE_THEMES = {
  default: { label: 'Classic Light', bg: '#eef2f8', card: '#ffffff', text: '#1c2530', border: '#e3e7ee', swatch: ['#eef2f8', '#ffffff'] },
  midnight: { label: 'Midnight Dark', bg: '#161b26', card: '#222836', text: '#e7ebf2', border: '#333c4d', swatch: ['#161b26', '#222836'] },
  'soft-sand': { label: 'Soft Sand', bg: '#f6f0e4', card: '#fffdf8', text: '#3a3226', border: '#e5dcc8', swatch: ['#f6f0e4', '#fffdf8'] },
  'cool-mint': { label: 'Cool Mint', bg: '#ecf7f2', card: '#ffffff', text: '#1c352c', border: '#cfe9dd', swatch: ['#ecf7f2', '#ffffff'] },
  'rose-blush': { label: 'Rose Blush', bg: '#fbedf0', card: '#ffffff', text: '#3a1c26', border: '#f2d4dc', swatch: ['#fbedf0', '#ffffff'] },
  'lavender-mist': { label: 'Lavender Mist', bg: '#f2eefa', card: '#ffffff', text: '#2c2440', border: '#ded4f0', swatch: ['#f2eefa', '#ffffff'] },
  'peach-sorbet': { label: 'Peach Sorbet', bg: '#fdf0e6', card: '#ffffff', text: '#402c1c', border: '#f4d8bc', swatch: ['#fdf0e6', '#ffffff'] },
  'sage-green': { label: 'Sage Green', bg: '#eef2ea', card: '#ffffff', text: '#28321f', border: '#d8e2cd', swatch: ['#eef2ea', '#ffffff'] },
  'butter-cream': { label: 'Butter Cream', bg: '#fdf8e6', card: '#ffffff', text: '#3a3420', border: '#f0e6bc', swatch: ['#fdf8e6', '#ffffff'] },
  'sky-blue': { label: 'Sky Blue', bg: '#e8f4fb', card: '#ffffff', text: '#1c3040', border: '#c8e4f4', swatch: ['#e8f4fb', '#ffffff'] },
  'blush-pink': { label: 'Blush Pink', bg: '#fdeef2', card: '#ffffff', text: '#3a1c28', border: '#f4d0dc', swatch: ['#fdeef2', '#ffffff'] },
  'warm-gray': { label: 'Warm Gray', bg: '#f2efec', card: '#ffffff', text: '#2c2824', border: '#ddd6cc', swatch: ['#f2efec', '#ffffff'] },
  seafoam: { label: 'Seafoam', bg: '#e8f6f2', card: '#ffffff', text: '#1c3830', border: '#c4ecdf', swatch: ['#e8f6f2', '#ffffff'] },
  champagne: { label: 'Champagne', bg: '#f8f1e2', card: '#fffdf8', text: '#3c3320', border: '#ecdfc0', swatch: ['#f8f1e2', '#fffdf8'] },
  'powder-blue': { label: 'Powder Blue', bg: '#eaf1f8', card: '#ffffff', text: '#20303f', border: '#cfe0ee', swatch: ['#eaf1f8', '#ffffff'] },
  apricot: { label: 'Apricot', bg: '#fdece0', card: '#ffffff', text: '#402a1a', border: '#f4cba8', swatch: ['#fdece0', '#ffffff'] },
  lilac: { label: 'Lilac', bg: '#f4edf9', card: '#ffffff', text: '#33223f', border: '#e4d0f0', swatch: ['#f4edf9', '#ffffff'] },
  'mint-cream': { label: 'Mint Cream', bg: '#eef9f3', card: '#ffffff', text: '#1e3a28', border: '#cceddb', swatch: ['#eef9f3', '#ffffff'] },
  'dusty-rose': { label: 'Dusty Rose', bg: '#f6e9ea', card: '#ffffff', text: '#3a2224', border: '#e8c8ca', swatch: ['#f6e9ea', '#ffffff'] },
  'pale-gold': { label: 'Pale Gold', bg: '#faf3e0', card: '#fffdf8', text: '#3c3016', border: '#eddfb0', swatch: ['#faf3e0', '#fffdf8'] },
  'ice-blue': { label: 'Ice Blue', bg: '#e6f2fa', card: '#ffffff', text: '#1c2e3e', border: '#c0dcf0', swatch: ['#e6f2fa', '#ffffff'] },
  'cream-beige': { label: 'Cream Beige', bg: '#f6f0e2', card: '#fffdf8', text: '#382e1e', border: '#e6d8ba', swatch: ['#f6f0e2', '#fffdf8'] },
  'soft-coral': { label: 'Soft Coral', bg: '#fdece8', card: '#ffffff', text: '#3e241e', border: '#f4c4b8', swatch: ['#fdece8', '#ffffff'] },
  pistachio: { label: 'Pistachio', bg: '#eef6e6', card: '#ffffff', text: '#26361c', border: '#d4e8bc', swatch: ['#eef6e6', '#ffffff'] },
  periwinkle: { label: 'Periwinkle', bg: '#eaeefa', card: '#ffffff', text: '#1e2440', border: '#ccd6f0', swatch: ['#eaeefa', '#ffffff'] },
};
function applyPageTheme(themeKey, customColor) {
  if (themeKey === 'custom' && customColor) {
    const root = document.documentElement.style;
    root.setProperty('--bg', lightenHex(customColor, 0.88));
    root.setProperty('--card', '#ffffff');
    root.setProperty('--text', darkenHex(customColor, 0.65));
    root.setProperty('--border', lightenHex(customColor, 0.7));
    return;
  }
  const theme = PAGE_THEMES[themeKey] || PAGE_THEMES['default'];
  const root = document.documentElement.style;
  root.setProperty('--bg', theme.bg);
  root.setProperty('--card', theme.card);
  root.setProperty('--text', theme.text);
  root.setProperty('--border', theme.border);
}

// Sample 3D-look custom cursors — a small SVG "arrow with drop shadow and highlight" baked into
// a data-URI, applied as the page cursor when selected. Built from a shared shape so each sample
// is just a different two-color gradient rather than repeating the whole SVG each time.
function build3dCursorUrl(highlightColor, baseColor, outlineColor) {
  const svg = "<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2228%22 height=%2228%22 viewBox=%220 0 28 28%22>" +
    "<defs><linearGradient id=%22g%22 x1=%220%22 y1=%220%22 x2=%221%22 y2=%221%22>" +
    `<stop offset=%220%22 stop-color=%22${highlightColor}%22/><stop offset=%221%22 stop-color=%22${baseColor}%22/></linearGradient></defs>` +
    `<path d=%22M4 2 L4 22 L9.5 17.5 L13 25 L16.5 23.5 L13 16 L20 16 Z%22 fill=%22url(%23g)%22 stroke=%22${outlineColor}%22 stroke-width=%221.4%22 stroke-linejoin=%22round%22/>` +
    "</svg>";
  return `url('data:image/svg+xml;utf8,${svg}') 4 2, auto`;
}
const CURSOR_STYLES = {
  default: { label: 'Default' }, // browser's normal arrow — no custom cursor applied
  '3d': { label: '3D Gold', url: build3dCursorUrl('%23ffffff', '%23c8973a', '%230f2a4a') },
  '3d-navy': { label: '3D Navy', url: build3dCursorUrl('%23a8c8ec', '%230f2a4a', '%23081830') },
  '3d-emerald': { label: '3D Emerald', url: build3dCursorUrl('%23a0e8c4', '%232e9e6d', '%230a3a26') },
  '3d-ruby': { label: '3D Ruby', url: build3dCursorUrl('%23f4a8b4', '%23c0392b', '%23400e10') },
  '3d-violet': { label: '3D Violet', url: build3dCursorUrl('%23d8bcf0', '%239b59b6', '%232c1440') },
};
function applyCursorStyle(style) {
  const entry = CURSOR_STYLES[style];
  document.body.style.cursor = entry && entry.url ? entry.url : '';
}

function applyNavFontSize(size) {
  const sizes = { small: '12px', medium: '13.5px', large: '15.5px' };
  document.documentElement.style.setProperty('--nav-font-size', sizes[size] || sizes.medium);
}

const APP_FONT_FAMILIES = {
  default: { label: 'Default (System)', css: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  serif: { label: 'Serif (Traditional)', css: 'Georgia, "Times New Roman", serif' },
  rounded: { label: 'Rounded (Friendly)', css: '"Trebuchet MS", Verdana, sans-serif' },
  mono: { label: 'Monospace (Technical)', css: '"Courier New", Consolas, monospace' },
  classic: { label: 'Classic (Clean Sans)', css: 'Verdana, Tahoma, sans-serif' },
};
function applyFontFamily(key) {
  const entry = APP_FONT_FAMILIES[key] || APP_FONT_FAMILIES.default;
  document.documentElement.style.setProperty('--app-font-family', entry.css);
}

// Scales the WHOLE interface (not just the sidebar menu) up or down. Most of this app's CSS
// uses fixed pixel sizes rather than rem units, so a root font-size change alone wouldn't
// reach most text — CSS zoom scales everything (text, spacing, icons) uniformly and is well
// supported in Chromium/Edge, which is what this Windows deployment runs on.
function applyUiFontScale(scale) {
  const zoomLevels = { small: '90%', medium: '100%', large: '115%', xlarge: '130%' };
  const app = document.getElementById('app');
  const loginScreen = document.getElementById('login-screen');
  const zoomValue = zoomLevels[scale] || zoomLevels.medium;
  if (app) app.style.zoom = zoomValue;
  if (loginScreen) loginScreen.style.zoom = zoomValue;
}

// Arabic display fonts installed under /assets/fonts (see arabic-fonts.css for the @font-face
// rules) — selectable for the Arabic Terminal Report print.
const ARABIC_FONTS = {
  default: { label: 'Default (Traditional Arabic)', family: 'Traditional Arabic' },
  zawiya: { label: 'Arabic Zawiya', family: 'Arabic Zawiya' },
  khalid: { label: 'Khalid', family: 'Khalid' },
  miqdad: { label: 'Miqdad', family: 'Miqdad' },
  keswah: { label: 'Keswah', family: 'Keswah' },
  ruhia: { label: 'Ruhia Arabic', family: 'Ruhia Arabic' },
  tafkir: { label: 'Tafkir Arabic', family: 'Tafkir Arabic' },
  naveid: { label: 'Naveid Arabic', family: 'Naveid Arabic' },
};

// Builds the @font-face CSS for every uploaded custom font, so any uploaded .ttf/.otf actually
// renders wherever it's selected — both live in the app (this injects into the current
// document) and reused as-is by the Arabic report print functions, which need the exact same
// rules in their own separate print window's document.
let customFontFaceCss = null;
async function getCustomFontFaceCss() {
  if (customFontFaceCss !== null) return customFontFaceCss;
  try {
    const fonts = await api('/custom-fonts');
    customFontFaceCss = fonts.map(f => `@font-face{font-family:'${f.family_name}';src:url('/uploads/${encodeURIComponent(f.filename)}');}`).join('\n');
  } catch (e) { customFontFaceCss = ''; }
  return customFontFaceCss;
}
async function injectCustomFontFaces() {
  const css = await getCustomFontFaceCss();
  if (!css) return;
  let styleEl = document.getElementById('custom-fonts-style');
  if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = 'custom-fonts-style'; document.head.appendChild(styleEl); }
  styleEl.textContent = css;
}

async function applyBranding() {
  try {
    const s = await api('/public-settings');
    const logoUrl = s.logo_photo ? `/uploads/${encodeURIComponent(s.logo_photo)}` : '/assets/logo.png';
    const name = s.school_name || 'Nibras Educational Complex';
    const motto = s.motto ? `"${s.motto}"` : '"Knowledge is Light"';
    document.title = `${name} — School Management System`;
    ['login-crest', 'sidebar-crest'].forEach(id => { const el2 = document.getElementById(id); if (el2) el2.src = logoUrl; });
    const loginScreenEl = document.getElementById('login-screen');
    if (loginScreenEl) {
      if (s.login_background) {
        loginScreenEl.style.backgroundImage = `linear-gradient(rgba(10,26,48,.55), rgba(10,26,48,.55)), url('/uploads/${encodeURIComponent(s.login_background)}')`;
        loginScreenEl.style.backgroundSize = 'cover';
        loginScreenEl.style.backgroundPosition = 'center';
      } else {
        loginScreenEl.style.backgroundImage = '';
      }
    }
    const loginName = document.getElementById('login-school-name'); if (loginName) loginName.textContent = name;
    const loginMotto = document.getElementById('login-motto'); if (loginMotto) loginMotto.textContent = motto;
    const sidebarName = document.getElementById('sidebar-school-name'); if (sidebarName) sidebarName.textContent = name;
    const sidebarMotto = document.getElementById('sidebar-motto'); if (sidebarMotto) sidebarMotto.textContent = motto;
    applyNavTheme(s.nav_theme, s.custom_accent_color);
    applyPageTheme(s.page_theme, s.custom_bg_color);
    applyCursorStyle(s.cursor_style);
    applyNavFontSize(s.nav_font_size);
    applyFontFamily(s.app_font_family);
    applyUiFontScale(s.ui_font_scale);
  } catch (e) { /* branding is cosmetic — never block the app if this fails */ }
}

// Applies the current language to the static bits of the page shell (login form, logout button).
// Sidebar nav is retranslated separately by buildNav() since it's rebuilt on every login.
function applyTranslations() {
  setCurrentLanguage(getCurrentLanguage()); // re-applies dir=rtl/ltr in case this runs after a reload
  const map = {
    'login-username-label': 'login_username', 'login-password-label': 'login_password',
    'login-submit-btn': 'login_signin', 'logout-btn': 'logout',
  };
  for (const [id, key] of Object.entries(map)) {
    const el2 = document.getElementById(id);
    if (el2) el2.textContent = t(key);
  }
}

// Lives in the topbar (not on any one page), so switching language works the same way no
// matter which page a person is currently looking at.
function setupTopbarLanguageSwitcher() {
  const sel = document.getElementById('topbar-language-switcher');
  if (!sel) return;
  const currentLang = getCurrentLanguage();
  sel.innerHTML = Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => `<option value="${code}" ${code === currentLang ? 'selected' : ''}>${name}</option>`).join('');
  sel.addEventListener('change', (e) => {
    setCurrentLanguage(e.target.value);
    applyTranslations();
    buildNav();
    route(); // re-render whatever page is currently open, in the newly chosen language
  });
}

// Lives in the topbar so it's reachable from every single page, including every role's own
// dashboard — searches Students/Teachers/Non-teaching Staff at once by name, DOB, phone, or ID.
// A single bell in the topbar covering three kinds of activity a person might want to know
// about at a glance — unread Messages, new Announcements, and new Discussion Forum posts —
// each already scoped server-side to what that account can actually see, so the bell never
// promises a click-through it can't deliver.
let notifBellPollTimer = null;
// A staff member's name is clickable everywhere it appears (the Staff list, and the Dashboard's
// staff breakdown) — opens a slide-in panel from the right with their profile and a way to
// message them, without leaving whatever page you were on. One delegated listener handles this
// regardless of which page the link was rendered on.
document.addEventListener('click', (e) => {
  const trigger = e.target.closest('.staff-profile-trigger');
  if (!trigger) return;
  e.preventDefault();
  openStaffProfilePanel(Number(trigger.dataset.id));
});
// A subject can genuinely have more than one teacher (several Maths teachers across different
// classes, for instance) — this opens a small modal to add/remove them, viewed from the
// Subject's own row rather than only from each individual teacher's profile page.
document.addEventListener('click', (e) => {
  const trigger = e.target.closest('.manage-subject-teachers-btn');
  if (!trigger) return;
  openSubjectTeacherAssignModal(Number(trigger.dataset.id), trigger.dataset.name);
});
// Clicking a class's name opens its full detail view — student roll (alphabetical), the Class
// Teacher, and the class's own timetable — rather than jumping straight to the filtered
// student list, which is still reachable from inside this popup for anyone who wants it.
document.addEventListener('click', (e) => {
  const trigger = e.target.closest('.class-details-trigger');
  if (!trigger) return;
  e.preventDefault();
  openClassDetailsModal(Number(trigger.dataset.id));
});
async function openClassDetailsModal(classId) {
  const modal = el(`<div class="modal-backdrop"><div class="modal" style="width:640px">
    <div id="class-details-body"><div class="empty-state">Loading…</div></div>
    <div class="modal-actions"><button type="button" class="btn secondary" id="cd-close">Close</button></div>
  </div></div>`);
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  modal.querySelector('#cd-close').addEventListener('click', () => modal.remove());
  const [details, timetable] = await Promise.all([
    api(`/classes/${classId}/details`),
    api(`/timetable?class_id=${classId}`),
  ]);
  const cls = details.class;
  const weekdays = Object.keys(timetable.periods_by_weekday || {});
  const maxPeriods = Math.max(0, ...weekdays.map(w => timetable.periods_by_weekday[w] || 0));
  const entryAt = (weekday, period) => timetable.entries.find(e => e.weekday === weekday && e.period_number === period);
  const body = modal.querySelector('#class-details-body');
  body.innerHTML = `
    <div class="page-header" style="margin-bottom:6px"><h2 style="margin:0">${escapeHtml(cls.name)}</h2>
      <button type="button" class="btn gold" id="cd-print-btn">🖶 Print (A4)</button></div>
    <div class="stat-grid" style="margin-bottom:16px">
      <div class="stat-card accent"><div><div class="num">${details.student_count}</div><div class="label">Students</div></div></div>
      <div class="stat-card accent"><div><div class="num" style="font-size:16px">${escapeHtml(cls.class_teacher_name || '—')}</div><div class="label">Class Teacher</div></div></div>
      <div class="stat-card accent"><div><div class="num">${escapeHtml(cls.level || '—')}</div><div class="label">Level</div></div></div>
    </div>
    <h3 style="color:var(--navy)">Students (Alphabetical)</h3>
    <div class="table-wrap" style="max-height:220px;overflow-y:auto">
      <table><thead><tr><th>#</th><th>Student ID</th><th>Name</th><th>Status</th></tr></thead>
      <tbody>${details.students.map((s, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(s.student_id)}</td><td><a href="#" class="class-name-link cd-student-link" data-id="${s.id}">${escapeHtml(s.first_name)} ${escapeHtml(s.middle_name || '')} ${escapeHtml(s.last_name)}</a></td><td>${statusBadge(s.status)}</td></tr>`).join('') || '<tr><td colspan=4 class="muted">No students in this class yet.</td></tr>'}</tbody></table>
    </div>
    <div class="modal-actions" style="justify-content:flex-start">
      <a class="btn secondary" style="text-decoration:none" href="/api/students/export-csv?class_id=${classId}" id="cd-export-csv-btn">⬇ Export Student List (CSV)</a>
    </div>
    <h3 style="color:var(--navy);margin-top:16px">Class Timetable</h3>
    <div class="table-wrap">
      <table><thead><tr><th>Period</th>${weekdays.map(w => `<th>${escapeHtml(w)}</th>`).join('')}</tr></thead>
      <tbody>${Array.from({ length: maxPeriods }, (_, i) => i + 1).map(p => `<tr><td>${p}</td>${weekdays.map(w => { const e = entryAt(w, p); return `<td>${e ? `${escapeHtml(e.subject_name || '—')}<br><span class="small-text">${escapeHtml(e.teacher_name || 'No teacher assigned')}</span>` : ''}</td>`; }).join('')}</tr>`).join('') || `<tr><td colspan=${weekdays.length + 1} class="muted">No timetable set up for this class yet.</td></tr>`}</tbody></table>
    </div>
    <p class="small-text no-print" style="margin-top:10px"><a href="#" id="cd-view-students-link">View this class's full student records →</a></p>
    <div class="no-print" style="margin-top:16px">
      <h3 style="color:var(--navy)">📎 Shared Files</h3>
      <p class="small-text">Files a teacher has shared with this whole class — handouts, worksheets, reading lists.</p>
      ${(state.user.role === 'Teacher' || can('classes', 'edit')) ? `
      <div class="toolbar">
        <input type="file" id="cd-share-file-input">
        <input type="text" id="cd-share-description-input" placeholder="What is this? (e.g. Week 3 Worksheet)" style="min-width:200px">
        <button class="btn gold" id="cd-share-file-btn">⬆ Share with Class</button>
      </div>` : ''}
      <div id="cd-shared-files-list" style="margin-top:10px"><div class="empty-state">Loading…</div></div>
    </div>`;
  body.querySelector('#cd-view-students-link').addEventListener('click', (e) => { e.preventDefault(); modal.remove(); location.hash = `#students/${classId}`; });
  async function loadSharedFiles() {
    const files = await api(`/classes/${classId}/shared-files`).catch(() => []);
    // If the modal was closed before this resolved, don't bother touching its (now detached)
    // content — consistent with the same guard added to the page-level load functions after a
    // similar issue surfaced there during a fast-navigation regression sweep.
    const listEl = body.querySelector('#cd-shared-files-list');
    if (!listEl) return;
    listEl.innerHTML = files.length ? `<div class="table-wrap"><table><thead><tr><th>File</th><th>Description</th><th>Shared By</th><th>Date</th><th></th></tr></thead>
      <tbody>${files.map(f => `<tr><td><a href="/uploads/${encodeURIComponent(f.filename)}" target="_blank">${escapeHtml(f.original_name || f.filename)}</a></td><td>${escapeHtml(f.description || '—')}</td><td>${escapeHtml(f.shared_by_name || '—')}</td><td>${escapeHtml(f.shared_at)}</td>
        <td>${(state.user.role === 'Teacher' || can('classes', 'edit')) ? `<button type="button" class="cd-delete-shared-file-btn" data-id="${f.id}">Delete</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`
      : '<div class="empty-state">No files shared with this class yet.</div>';
    body.querySelectorAll('.cd-delete-shared-file-btn').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Remove this shared file?')) return;
      try { await api(`/class-shared-files/${btn.dataset.id}`, { method: 'DELETE' }); loadSharedFiles(); }
      catch (e) { alert(e.message); }
    }));
  }
  body.querySelector('#cd-share-file-btn')?.addEventListener('click', async () => {
    const file = body.querySelector('#cd-share-file-input').files[0];
    if (!file) return alert('Choose a file first.');
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await api(`/classes/${classId}/shared-files`, { method: 'POST', body: { file_data: reader.result, original_name: file.name, description: body.querySelector('#cd-share-description-input').value } });
        loadSharedFiles();
        body.querySelector('#cd-share-file-input').value = '';
        body.querySelector('#cd-share-description-input').value = '';
      } catch (e) { alert(e.message); }
    };
    reader.readAsDataURL(file);
  });
  loadSharedFiles();
  body.querySelectorAll('.cd-student-link').forEach(link => link.addEventListener('click', (e) => {
    e.preventDefault();
    modal.remove();
    location.hash = `#student/${link.dataset.id}`;
  }));
  body.querySelector('#cd-print-btn').addEventListener('click', () => {
    // Cloning the actual DOM and removing non-printable elements by class/id is far more
    // reliable than string-matching the HTML with regexes, which silently stops working the
    // moment a new button or link is added anywhere in this modal (as happened here once
    // already, when the CSV export link was added after this regex was first written).
    const printClone = body.cloneNode(true);
    printClone.querySelectorAll('#cd-print-btn, .modal-actions, .no-print').forEach(el2 => el2.remove());
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>${escapeHtml(cls.name)}</title><link rel="stylesheet" href="/style.css"></head>
      <body style="padding:16mm">${printClone.innerHTML}<script>window.print()<\/script></body></html>`);
    win.document.close();
  });
}
async function openSubjectTeacherAssignModal(subjectId, subjectName) {
  const modal = el(`<div class="modal-backdrop"><div class="modal" style="width:420px">
    <h3>👥 Teachers — ${escapeHtml(subjectName)}</h3>
    <div id="subject-teachers-body"><div class="empty-state">Loading…</div></div>
    <div class="modal-actions"><button type="button" class="btn secondary" id="st-close">Close</button></div>
  </div></div>`);
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  modal.querySelector('#st-close').addEventListener('click', () => modal.remove());
  async function refresh() {
    const [assigned, allTeachers] = await Promise.all([
      api(`/subjects/${subjectId}/teachers`),
      api('/teachers?pageSize=500'),
    ]);
    const body = modal.querySelector('#subject-teachers-body');
    const editable = can('subjects', 'edit');
    body.innerHTML = `
      <div class="chip-row">${assigned.map(t => `<span class="chip">${escapeHtml(t.full_name)}${editable ? ` <button type="button" class="chip-remove remove-subject-teacher-btn" data-id="${t.id}">✕</button>` : ''}</span>`).join('') || '<span class="muted">No teachers assigned yet.</span>'}</div>
      ${editable ? `<div class="toolbar" style="margin-top:12px">
        <select id="add-subject-teacher-select"><option value="">Add a teacher…</option>${allTeachers.rows.filter(t => !assigned.some(a => a.id === t.id)).map(t => `<option value="${t.id}">${escapeHtml(t.full_name)}</option>`).join('')}</select>
        <button type="button" class="btn secondary" id="add-subject-teacher-btn">Add</button>
      </div>` : ''}`;
    body.querySelector('#add-subject-teacher-btn')?.addEventListener('click', async () => {
      const select = body.querySelector('#add-subject-teacher-select');
      if (!select.value) return;
      await api(`/subjects/${subjectId}/teachers`, { method: 'POST', body: { teacher_id: Number(select.value) } });
      refresh();
    });
    body.querySelectorAll('.remove-subject-teacher-btn').forEach(btn => btn.addEventListener('click', async () => {
      await api(`/subjects/${subjectId}/teachers/${btn.dataset.id}`, { method: 'DELETE' });
      refresh();
    }));
  }
  refresh();
}
async function openStaffProfilePanel(staffId) {
  const panel = document.getElementById('staff-profile-panel');
  const backdrop = document.getElementById('staff-profile-backdrop');
  panel.innerHTML = '<div class="empty-state">Loading…</div>';
  panel.classList.add('open');
  backdrop.classList.add('open');
  const [staffRow, linkedUser] = await Promise.all([
    api(`/staff/${staffId}`),
    api(`/staff/${staffId}/linked-user`).catch(() => null),
  ]);
  const photoUrl = staffRow.photo ? `/uploads/${encodeURIComponent(staffRow.photo)}` : null;
  panel.innerHTML = `
    <button type="button" class="close-panel-btn" id="staff-panel-close">✕</button>
    ${photoUrl ? `<img src="${photoUrl}" class="staff-profile-panel-photo" alt="">` : `<div class="staff-profile-panel-photo-placeholder">👤</div>`}
    <div class="staff-profile-panel-name">${escapeHtml(staffRow.full_name)}</div>
    <div class="staff-profile-panel-meta">${escapeHtml(staffRow.position || 'Non-teaching Staff')}</div>
    <div class="staff-profile-panel-row"><span>Staff ID</span><span>${escapeHtml(staffRow.staff_id || '—')}</span></div>
    <div class="staff-profile-panel-row"><span>Status</span><span>${escapeHtml(staffRow.employment_status || '—')}</span></div>
    <div class="staff-profile-panel-row"><span>Phone</span><span>${escapeHtml(staffRow.phone || '—')}</span></div>
    <div class="staff-profile-panel-row"><span>Email</span><span>${escapeHtml(staffRow.email || '—')}</span></div>
    <div class="staff-profile-panel-row"><span>Address</span><span>${escapeHtml(staffRow.address || '—')}</span></div>
    <div style="margin-top:20px">
      ${linkedUser
        ? `<button type="button" class="btn gold" id="staff-panel-message-btn" style="width:100%">✉️ Send Message</button>`
        : can('staff', 'edit') ? `<button type="button" class="btn secondary" id="staff-panel-login-btn" style="width:100%">Create a login so they can be messaged</button>` : `<p class="small-text" style="text-align:center">This staff member has no login yet.</p>`}
    </div>`;
  document.getElementById('staff-panel-close').addEventListener('click', closeStaffProfilePanel);
  document.getElementById('staff-panel-message-btn')?.addEventListener('click', () => {
    closeStaffProfilePanel();
    location.hash = `#messages/${linkedUser.id}`;
  });
  document.getElementById('staff-panel-login-btn')?.addEventListener('click', () => {
    closeStaffProfilePanel();
    openStaffLoginModal(staffRow);
  });
}
function closeStaffProfilePanel() {
  document.getElementById('staff-profile-panel').classList.remove('open');
  document.getElementById('staff-profile-backdrop').classList.remove('open');
}
document.getElementById('staff-profile-backdrop').addEventListener('click', closeStaffProfilePanel);

function setupNotificationBell() {
  const btn = document.getElementById('notif-bell-btn');
  const badge = document.getElementById('notif-bell-badge');
  const dropdown = document.getElementById('notif-bell-dropdown');
  if (!btn || !dropdown) return;

  async function refresh() {
    try {
      const summary = await api('/notifications-summary');
      if (summary.total > 0) { badge.textContent = summary.total > 99 ? '99+' : summary.total; badge.classList.remove('hidden'); }
      else { badge.classList.add('hidden'); }
      const items = [
        { key: 'messages', label: 'New Messages', count: summary.messages, hash: '#messages', icon: '✉️' },
        { key: 'announcements', label: 'New Announcements', count: summary.announcements, hash: '#announcements', icon: '📣' },
        { key: 'forum', label: 'New Forum Activity', count: summary.forum, hash: '#forum', icon: '💬' },
      ].filter(i => i.count > 0);
      dropdown.innerHTML = items.length
        ? items.map(i => `<div class="notif-bell-item" data-hash="${i.hash}">${i.icon} ${escapeHtml(i.label)} <span class="notif-count">${i.count}</span></div>`).join('')
        : `<div class="notif-bell-empty">You're all caught up 🎉</div>`;
      dropdown.querySelectorAll('.notif-bell-item').forEach(el => el.addEventListener('click', () => {
        location.hash = el.dataset.hash;
        dropdown.classList.add('hidden');
      }));
    } catch (e) { /* a missed poll tick isn't worth bothering the user about */ }
  }
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const opening = dropdown.classList.contains('hidden');
    dropdown.classList.toggle('hidden');
    if (opening) {
      // Mark as seen in the background so the NEXT poll reflects it, but don't immediately
      // re-fetch and re-render — that would wipe out the very items just shown before the
      // user has had a chance to read them.
      api('/notifications-mark-seen', { method: 'POST' }).catch(() => {});
    }
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.notif-bell-wrap')) dropdown.classList.add('hidden');
  });
  refresh();
  if (notifBellPollTimer) clearInterval(notifBellPollTimer);
  notifBellPollTimer = setInterval(refresh, 30000);
}

function setupGlobalSearch() {
  const input = document.getElementById('global-search-input');
  const panel = document.getElementById('global-search-results');
  if (!input || !panel) return;
  let debounceTimer = null;

  function renderResults(data) {
    const groups = [
      { key: 'students', label: 'Students', icon: 'total_students', go: (r) => `#student/${r.id}`, sub: (r) => [r.student_id, r.dob, r.emergency_contact_phone].filter(Boolean).join(' · ') },
      { key: 'teachers', label: 'Teachers', icon: 'teacher', go: () => '#teachers', sub: (r) => [r.staff_id, r.dob, r.phone].filter(Boolean).join(' · ') },
      { key: 'staff', label: 'Non-teaching Staff', icon: 'staff', go: () => '#staff', sub: (r) => [r.staff_id, r.phone].filter(Boolean).join(' · ') },
    ];
    const total = groups.reduce((s, g) => s + (data[g.key] || []).length, 0);
    if (!total) { panel.innerHTML = '<div class="gsr-empty">No matches found.</div>'; return; }
    panel.innerHTML = groups.map(g => {
      const rows = data[g.key] || [];
      if (!rows.length) return '';
      return `<div class="gsr-group-title">${escapeHtml(g.label)}</div>` + rows.map(r => `
        <div class="gsr-item" data-go="${g.go(r)}">
          <img src="/assets/icons/${g.icon}.png" alt="" style="width:22px;height:22px;object-fit:contain;flex-shrink:0">
          <div><div>${escapeHtml(r.full_name || `${r.first_name} ${r.last_name}`)}</div><div class="gsr-sub">${escapeHtml(g.sub(r))}</div></div>
        </div>`).join('');
    }).join('');
    panel.querySelectorAll('.gsr-item').forEach(item => item.addEventListener('click', () => {
      location.hash = item.dataset.go;
      panel.classList.remove('open');
      input.value = '';
    }));
  }

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const q = input.value.trim();
    if (q.length < 2) { panel.classList.remove('open'); return; }
    debounceTimer = setTimeout(async () => {
      try {
        const data = await api(`/global-search?q=${encodeURIComponent(q)}`);
        renderResults(data);
        panel.classList.add('open');
      } catch (e) { /* a failed search shouldn't be disruptive — just leave the panel closed */ }
    }, 300);
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.topbar-search')) panel.classList.remove('open');
  });
}

// ---------- Auth ----------
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';
  try {
    await api('/login', { method: 'POST', body: { username, password } });
    await boot();
  } catch (err) { errEl.textContent = err.message; }
});
document.getElementById('logout-btn').addEventListener('click', async () => {
  await api('/logout', { method: 'POST' });
  location.hash = ''; // don't carry the previous user's page into whoever logs in next
  location.reload();
});
document.getElementById('hamburger-btn').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-backdrop').classList.toggle('open');
});
document.getElementById('sidebar-backdrop').addEventListener('click', () => {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-backdrop').classList.remove('open');
});

// Desktop "hide the menu" toggle — for anyone who wants the full screen width for data entry
// or a wide table. Persisted, so it stays hidden across page loads until deliberately shown
// again, and works independently from the mobile hamburger overlay above.
if (localStorage.getItem('nibras_sidebar_hidden') === '1') document.body.classList.add('sidebar-hidden');
document.getElementById('sidebar-collapse-btn').addEventListener('click', () => {
  const nowHidden = document.body.classList.toggle('sidebar-hidden');
  localStorage.setItem('nibras_sidebar_hidden', nowHidden ? '1' : '0');
});

// Signs the user out automatically after 5 minutes with no mouse/keyboard/touch activity —
// resets on any interaction, so it only fires when the screen is genuinely left unattended.
const IDLE_LOGOUT_MS = 5 * 60 * 1000;
let idleLogoutTimer = null;
function setupIdleAutoLogout() {
  const resetIdleTimer = () => {
    if (idleLogoutTimer) clearTimeout(idleLogoutTimer);
    idleLogoutTimer = setTimeout(async () => {
      try { await api('/logout', { method: 'POST' }); } catch (e) { /* log out locally regardless */ }
      sessionStorage.setItem('nibras_idle_logout', '1');
      location.hash = '';
      location.reload();
    }, IDLE_LOGOUT_MS);
  };
  ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'].forEach(evt => {
    document.addEventListener(evt, resetIdleTimer, { passive: true });
  });
  resetIdleTimer();
}

// Screen Lock — a quick PIN-based lock for stepping away for a moment, distinct from the
// 5-minute automatic sign-out above: locking keeps the session alive underneath, so unlocking
// only needs the short PIN, not the full account password and a fresh login.
function updateLockButtonVisibility() {
  const btn = document.getElementById('screen-lock-btn');
  if (!btn) return;
  const isAdmin = state.user && state.user.role === 'Super Administrator';
  btn.classList.toggle('hidden', !(window.lockFeatureEnabled && isAdmin));
}
function showScreenLockOverlay() {
  sessionStorage.setItem('nibras_screen_locked', '1');
  document.getElementById('screen-lock-overlay').classList.remove('hidden');
  document.getElementById('screen-lock-error').textContent = '';
  const input = document.getElementById('screen-lock-pin-input');
  input.value = '';
  setTimeout(() => input.focus(), 50);
}
async function setupScreenLock() {
  try {
    const status = await api('/lock-status');
    window.lockFeatureEnabled = status.enabled;
  } catch (e) { window.lockFeatureEnabled = false; }
  updateLockButtonVisibility();
  // A refresh (or the browser being reopened) should NOT bypass an active lock — check the
  // flag immediately, before the person can see or interact with anything underneath.
  if (window.lockFeatureEnabled && sessionStorage.getItem('nibras_screen_locked') === '1') {
    showScreenLockOverlay();
  }
  document.getElementById('screen-lock-btn').addEventListener('click', showScreenLockOverlay);
  const attemptUnlock = async () => {
    const pin = document.getElementById('screen-lock-pin-input').value.trim();
    const errEl = document.getElementById('screen-lock-error');
    if (!pin) return;
    try {
      await api('/verify-lock-pin', { method: 'POST', body: { pin } });
      sessionStorage.removeItem('nibras_screen_locked');
      document.getElementById('screen-lock-overlay').classList.add('hidden');
    } catch (e) { errEl.textContent = e.message; }
  };
  document.getElementById('screen-lock-unlock-btn').addEventListener('click', attemptUnlock);
  document.getElementById('screen-lock-pin-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') attemptUnlock(); });
}

async function boot() {
  // Check the system-wide lock BEFORE anything else — a locked system shows a token entry
  // screen instead of the normal login form, and nothing else runs until it's cleared.
  try {
    const lockStatus = await api('/system-lock-status');
    if (lockStatus.locked) { showLockScreen(lockStatus.message); return; }
  } catch (e) { /* if the status check itself fails, don't block the app over it */ }

  applyBranding();
  applyTranslations();
  try {
    const me = await api('/me');
    state.user = me;
    state.perms = {};
    me.permissions.forEach(p => state.perms[p.module] = p);
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('tb-user').textContent = `${me.full_name} (${me.role})`;
    const tbPhoto = document.getElementById('tb-user-photo');
    if (me.photo) { tbPhoto.src = `/uploads/${encodeURIComponent(me.photo)}`; tbPhoto.classList.remove('hidden'); }
    else { tbPhoto.classList.add('hidden'); }
    setupTopbarLanguageSwitcher();
    setupGlobalSearch();
    setupNotificationBell();
    buildNav();
    setupIdleAutoLogout();
    setupScreenLock();
    injectCustomFontFaces();
    window.addEventListener('hashchange', route);
    if (!location.hash) location.hash = '#dashboard';
    route();
  } catch (e) {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
    if (sessionStorage.getItem('nibras_idle_logout')) {
      sessionStorage.removeItem('nibras_idle_logout');
      const errEl = document.getElementById('login-error');
      if (errEl) errEl.textContent = 'You were signed out after 5 minutes of inactivity. Please log in again.';
    }
  }
}

// Replaces the whole page with a token-entry screen — no login form, no nav, nothing else
// clickable — until the correct unlock token is submitted.
function showLockScreen(message) {
  document.body.innerHTML = `<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;
      background:linear-gradient(135deg,#0a1d33,#0f2a4a);font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;padding:20px;">
    <div style="background:#fff;border-radius:16px;padding:40px 32px;width:380px;max-width:92vw;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.3)">
      <div style="font-size:40px;margin-bottom:10px">🔒</div>
      <h2 style="color:#0f2a4a;margin:0 0 8px">System Locked</h2>
      <p style="color:#6b7684;font-size:14px;margin:0 0 20px">${escapeHtml(message || 'This system\'s access period has ended.')}</p>
      <form id="unlock-form">
        <input type="text" id="unlock-token-input" placeholder="Enter unlock token" autocomplete="off"
          style="width:100%;box-sizing:border-box;padding:12px;font-size:15px;text-align:center;letter-spacing:1px;
          border:1px solid #d5dae1;border-radius:8px;margin-bottom:12px;text-transform:uppercase">
        <button type="submit" style="width:100%;background:#0f2a4a;color:#fff;border:none;padding:12px;
          border-radius:8px;font-weight:700;font-size:15px;cursor:pointer">Unlock</button>
      </form>
      <div id="unlock-error" style="color:#c1372b;font-size:13px;margin-top:12px"></div>
    </div>
  </div>`;
  document.getElementById('unlock-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = document.getElementById('unlock-token-input').value.trim();
    const errEl = document.getElementById('unlock-error');
    try {
      await api('/system-unlock', { method: 'POST', body: { token } });
      location.reload();
    } catch (err) { errEl.textContent = err.message; }
  });
}

// ---------- Nav ----------
const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', module: 'dashboard' }, // ungrouped — always pinned at top
  { key: 'students', label: 'Students', module: 'students', group: 'Students' },
  { key: 'admissions', label: 'New Admissions', module: 'students', group: 'Students' },
  { key: 'school-selection', label: 'SHS School Selection', module: 'students', group: 'Students' },
  { key: 'alumni', label: 'Alumni & Status', module: 'students', group: 'Students' },
  { key: 'idcards', label: 'Student ID Cards', module: 'students', group: 'Students' },
  { key: 'promote-students', label: 'Promote Students', module: 'students', group: 'Students' },
  { key: 'parents', label: 'Parents & Guardians', module: 'parents', group: 'Parents' },
  { key: 'parent-contacts', label: 'Parent Contact List', module: 'parents', group: 'Parents' },
  { key: 'teachers', label: 'Teachers', module: 'teachers', group: 'Staff' },
  { key: 'staff', label: 'Non-teaching Staff', module: 'staff', group: 'Staff' },
  { key: 'staff-checkin', label: 'Staff Check-in', module: 'staff', group: 'Staff' },
  { key: 'assignments', label: 'Assignments & Quizzes', module: 'assignments', group: 'Academics' },
  { key: 'class-groups', label: 'Class Groups', module: 'class_groups', group: 'Academics' },
  { key: 'classes', label: 'Classes', module: 'classes', group: 'Academics' },
  { key: 'subjects', label: 'Subjects', module: 'subjects', group: 'Academics' },
  { key: 'class-list', label: 'Class List', module: 'classes', group: 'Academics' },
  { key: 'timetable', label: 'Timetable', module: 'classes', group: 'Academics' },
  { key: 'exam-schedule', label: 'Exam Schedule', module: 'exam_schedule', group: 'Academics' },
  { key: 'live-class-rooms', label: 'Live Class Rooms', module: 'live_class_rooms', group: 'Communication' },
  { key: 'academics', label: 'Academic Years & Terms', module: 'academic_sessions', group: 'Academics' },
  { key: 'attendance', label: 'Attendance', module: 'attendance', group: 'Academics' },
  { key: 'results', label: 'Results', module: 'results', group: 'Academics' },
  { key: 'class-termly-report', label: 'Class Termly Report', module: 'results', group: 'Academics' },
  { key: 'arabic-report', label: 'Arabic Terminal Report', module: 'results', group: 'Academics' },
  { key: 'performance', label: 'Performance Report', module: 'results', group: 'Academics' },
  { key: 'fees', label: 'Fees', module: 'fees', group: 'Finance' },
  { key: 'receipts', label: 'Receipts', module: 'fees', group: 'Finance' },
  { key: 'momo-transactions', label: 'MTN MoMo Transactions', module: 'fees', group: 'Finance' },
  { key: 'income-expenditure', label: 'Income & Expenditure', module: 'fees', group: 'Finance' },
  { key: 'bus', label: 'School Bus', module: 'bus', group: 'Services' },
  { key: 'canteen', label: 'Canteen', module: 'canteen', group: 'Finance' },
  { key: 'announcements', label: 'Announcements', module: 'announcements', group: 'Communication' },
  { key: 'forum', label: 'Discussion Forum', module: 'forum', group: 'Communication' },
  { key: 'messages', label: 'Messages', module: 'messages', group: 'Communication' },
  { key: 'users', label: 'Users & Roles', module: 'users', group: 'Administration' },
  { key: 'audit', label: 'Audit Logs', module: 'audit_logs', group: 'Administration' },
  { key: 'backup', label: 'Backup & Restore', module: 'backup', group: 'Administration' },
  { key: 'settings', label: 'Settings', module: 'settings', group: 'Administration' },
];
const NAV_GROUP_ORDER = ['Students', 'Parents', 'Staff', 'Academics', 'Finance', 'Services', 'Communication', 'Administration'];
// A distinct accent color per group, so the sidebar reads as organized sections at a glance
// rather than one long uniform list. Deliberately avoids gold, since that's reserved for the
// active-page highlight.
const NAV_GROUP_COLORS = {
  Students: '#5dade2', Parents: '#58d68d', Staff: '#bb8fce', Academics: '#f5b041',
  Finance: '#52be80', Services: '#f1948a', Communication: '#5499c7', Administration: '#aab7b8',
};

// ---------- Language / translation ----------
// Covers navigation, the Dashboard, and login/logout — the highest-visibility text in the app.
// NOTE: this is intentionally not a full translation of every screen (results entry, forms,
// report cards, etc. remain English) — that is a much larger job than can be done reliably
// without native-speaker review, and is flagged as a follow-up item rather than shipped half-done.
const SUPPORTED_LANGUAGES = { en: 'English', ar: 'العربية', fr: 'Français', zh: '中文', de: 'Deutsch', es: 'Español' };
const TRANSLATIONS = {
  en: { dashboard: 'Dashboard', 'class-list': 'Class List', students: 'Students', admissions: 'New Admissions', alumni: 'Alumni & Status', idcards: 'Student ID Cards', 'promote-students': 'Promote Students', parents: 'Parents & Guardians', 'parent-contacts': 'Parent Contact List', teachers: 'Teachers', staff: 'Non-teaching Staff', classes: 'Classes', subjects: 'Subjects', timetable: 'Timetable', 'exam-schedule': 'Exam Schedule', 'live-class-rooms': 'Live Class Rooms', academics: 'Academic Years & Terms', attendance: 'Attendance', results: 'Results', performance: 'Performance Report', fees: 'Fees', 'receipts': 'Receipts', 'momo-transactions': 'MTN MoMo Transactions', 'income-expenditure': 'Income & Expenditure', bus: 'School Bus', canteen: 'Canteen', announcements: 'Announcements', forum: 'Discussion Forum', messages: 'Messages', 'staff-checkin': 'Staff Check-in', 'assignments': 'Assignments & Quizzes', 'class-groups': 'Class Groups', 'school-selection': 'SHS School Selection', 'arabic-report': 'Arabic Terminal Report', 'class-termly-report': 'Class Termly Report', users: 'Users & Roles', audit: 'Audit Logs', backup: 'Backup & Restore', settings: 'Settings',
    dash_suffix: 'Dashboard', customize: 'Customize', students_by_class: 'Students by Class', col_class: 'Class', col_students: 'Students', login_username: 'Username', login_password: 'Password', login_signin: 'Sign In', logout: 'Logout',
    stat_students: 'Total Students', stat_male: 'Male', stat_female: 'Female', stat_orphan: 'Orphan Students', stat_teachers: 'Teachers', stat_staff: 'Non-teaching Staff', stat_parents: 'Parents/Guardians', stat_present: 'Present Today', stat_absent: 'Absent Today', stat_bus: 'Bus Users', stat_canteen: 'Canteen Users', stat_feesPaid: 'Fees Collected', stat_feesOutstanding: 'Fees Outstanding', language: 'Language' },
  ar: { dashboard: 'لوحة التحكم', students: 'الطلاب', admissions: 'القبول الجديد', alumni: 'الخريجون والحالة', idcards: 'بطاقات هوية الطلاب', parents: 'أولياء الأمور', 'parent-contacts': 'قائمة اتصال أولياء الأمور', teachers: 'المعلمون', staff: 'الموظفون غير التدريسيين', classes: 'الفصول', subjects: 'المواد', timetable: 'الجدول الزمني', academics: 'السنوات والفصول الدراسية', attendance: 'الحضور', results: 'النتائج', performance: 'تقرير الأداء', fees: 'الرسوم', bus: 'حافلة المدرسة', canteen: 'المقصف', announcements: 'الإعلانات', users: 'المستخدمون والأدوار', audit: 'سجلات التدقيق', backup: 'النسخ الاحتياطي والاستعادة', settings: 'الإعدادات',
    dash_suffix: 'لوحة التحكم', customize: 'تخصيص', students_by_class: 'الطلاب حسب الفصل', col_class: 'الفصل', col_students: 'الطلاب', login_username: 'اسم المستخدم', login_password: 'كلمة المرور', login_signin: 'تسجيل الدخول', logout: 'تسجيل الخروج',
    stat_students: 'إجمالي الطلاب', stat_male: 'ذكور', stat_female: 'إناث', stat_orphan: 'الأيتام', stat_teachers: 'المعلمون', stat_staff: 'الموظفون', stat_parents: 'أولياء الأمور', stat_present: 'الحضور اليوم', stat_absent: 'الغياب اليوم', stat_bus: 'مستخدمو الحافلة', stat_canteen: 'مستخدمو المقصف', stat_feesPaid: 'الرسوم المحصلة', stat_feesOutstanding: 'الرسوم المتبقية', language: 'اللغة' },
  fr: { dashboard: 'Tableau de bord', students: 'Élèves', admissions: 'Nouvelles admissions', alumni: 'Anciens élèves et statut', idcards: "Cartes d'identité", parents: 'Parents et tuteurs', 'parent-contacts': 'Liste de contacts des parents', teachers: 'Enseignants', staff: 'Personnel non enseignant', classes: 'Classes', subjects: 'Matières', timetable: "Emploi du temps", academics: 'Années et trimestres', attendance: 'Présence', results: 'Résultats', performance: 'Rapport de performance', fees: 'Frais scolaires', bus: 'Bus scolaire', canteen: 'Cantine', announcements: 'Annonces', users: 'Utilisateurs et rôles', audit: "Journaux d'audit", backup: 'Sauvegarde et restauration', settings: 'Paramètres',
    dash_suffix: 'Tableau de bord', customize: 'Personnaliser', students_by_class: 'Élèves par classe', col_class: 'Classe', col_students: 'Élèves', login_username: "Nom d'utilisateur", login_password: 'Mot de passe', login_signin: 'Se connecter', logout: 'Déconnexion',
    stat_students: "Total des élèves", stat_male: 'Garçons', stat_female: 'Filles', stat_orphan: 'Orphelins', stat_teachers: 'Enseignants', stat_staff: 'Personnel', stat_parents: 'Parents/Tuteurs', stat_present: "Présents aujourd'hui", stat_absent: "Absents aujourd'hui", stat_bus: 'Élèves du bus', stat_canteen: 'Élèves de la cantine', stat_feesPaid: 'Frais collectés', stat_feesOutstanding: 'Frais impayés', language: 'Langue' },
  zh: { dashboard: '仪表盘', students: '学生', admissions: '新生入学', alumni: '校友与状态', idcards: '学生证', parents: '家长与监护人', 'parent-contacts': '家长联系名单', teachers: '教师', staff: '非教学人员', classes: '班级', subjects: '科目', timetable: '课程表', academics: '学年与学期', attendance: '考勤', results: '成绩', performance: '成绩排名报告', fees: '学费', bus: '校车', canteen: '食堂', announcements: '公告', users: '用户与角色', audit: '审计日志', backup: '备份与恢复', settings: '设置',
    dash_suffix: '仪表盘', customize: '自定义', students_by_class: '按班级统计学生', col_class: '班级', col_students: '学生人数', login_username: '用户名', login_password: '密码', login_signin: '登录', logout: '退出登录',
    stat_students: '学生总数', stat_male: '男生', stat_female: '女生', stat_orphan: '孤儿学生', stat_teachers: '教师', stat_staff: '非教学人员', stat_parents: '家长/监护人', stat_present: '今日出勤', stat_absent: '今日缺勤', stat_bus: '校车使用人数', stat_canteen: '食堂使用人数', stat_feesPaid: '已收学费', stat_feesOutstanding: '欠缴学费', language: '语言' },
  de: { dashboard: 'Dashboard', students: 'Schüler', admissions: 'Neuaufnahmen', alumni: 'Ehemalige & Status', idcards: 'Schülerausweise', parents: 'Eltern & Erziehungsberechtigte', 'parent-contacts': 'Elternkontaktliste', teachers: 'Lehrer', staff: 'Nicht-lehrendes Personal', classes: 'Klassen', subjects: 'Fächer', timetable: 'Stundenplan', academics: 'Schuljahre & Trimester', attendance: 'Anwesenheit', results: 'Ergebnisse', performance: 'Leistungsbericht', fees: 'Schulgebühren', bus: 'Schulbus', canteen: 'Kantine', announcements: 'Ankündigungen', users: 'Benutzer & Rollen', audit: 'Prüfprotokolle', backup: 'Sicherung & Wiederherstellung', settings: 'Einstellungen',
    dash_suffix: 'Dashboard', customize: 'Anpassen', students_by_class: 'Schüler nach Klasse', col_class: 'Klasse', col_students: 'Schüler', login_username: 'Benutzername', login_password: 'Passwort', login_signin: 'Anmelden', logout: 'Abmelden',
    stat_students: 'Schüler insgesamt', stat_male: 'Jungen', stat_female: 'Mädchen', stat_orphan: 'Waisenkinder', stat_teachers: 'Lehrer', stat_staff: 'Personal', stat_parents: 'Eltern/Erziehungsberechtigte', stat_present: 'Heute anwesend', stat_absent: 'Heute abwesend', stat_bus: 'Busnutzer', stat_canteen: 'Kantinennutzer', stat_feesPaid: 'Eingenommene Gebühren', stat_feesOutstanding: 'Ausstehende Gebühren', language: 'Sprache' },
  es: { dashboard: 'Panel de control', students: 'Estudiantes', admissions: 'Nuevas admisiones', alumni: 'Exalumnos y estado', idcards: 'Carnés de estudiante', parents: 'Padres y tutores', 'parent-contacts': 'Lista de contactos de padres', teachers: 'Profesores', staff: 'Personal no docente', classes: 'Clases', subjects: 'Asignaturas', timetable: 'Horario', academics: 'Años y trimestres', attendance: 'Asistencia', results: 'Resultados', performance: 'Informe de rendimiento', fees: 'Cuotas escolares', bus: 'Autobús escolar', canteen: 'Cantina', announcements: 'Anuncios', users: 'Usuarios y roles', audit: 'Registros de auditoría', backup: 'Copia de seguridad y restauración', settings: 'Configuración',
    dash_suffix: 'Panel de control', customize: 'Personalizar', students_by_class: 'Estudiantes por clase', col_class: 'Clase', col_students: 'Estudiantes', login_username: 'Usuario', login_password: 'Contraseña', login_signin: 'Iniciar sesión', logout: 'Cerrar sesión',
    stat_students: 'Total de estudiantes', stat_male: 'Niños', stat_female: 'Niñas', stat_orphan: 'Estudiantes huérfanos', stat_teachers: 'Profesores', stat_staff: 'Personal', stat_parents: 'Padres/Tutores', stat_present: 'Presentes hoy', stat_absent: 'Ausentes hoy', stat_bus: 'Usuarios del autobús', stat_canteen: 'Usuarios de la cantina', stat_feesPaid: 'Cuotas cobradas', stat_feesOutstanding: 'Cuotas pendientes', language: 'Idioma' },
};
function getCurrentLanguage() { return localStorage.getItem('nibras_language') || 'en'; }
function setCurrentLanguage(code) {
  localStorage.setItem('nibras_language', code);
  document.documentElement.dir = code === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = code;
}
function t(key) { const lang = getCurrentLanguage(); return (TRANSLATIONS[lang] && TRANSLATIONS[lang][key]) || TRANSLATIONS.en[key] || key; }

// Maps nav item keys (and group names) to their extracted icon image file, where a matching
// icon exists — items without an obvious match just show their label, no icon.
const NAV_ICON_FILES = {
  students: 'total_students', admissions: 'admissions', 'school-selection': 'school_selection',
  alumni: 'alumni', idcards: 'idcards', 'promote-students': 'alumni', parents: 'parents', 'parent-contacts': 'parents',
  teachers: 'teacher', staff: 'staff', 'staff-checkin': 'present',
  assignments: 'assignments', 'class-groups': 'class_groups', classes: 'classes', subjects: 'subjects',
  timetable: 'timetable', 'exam-schedule': 'quiz', 'live-class-rooms': 'staff_group', academics: 'academic_year', attendance: 'attendance', results: 'results',
  'class-termly-report': 'audit', performance: 'performance', fees: 'fees', receipts: 'fees_paid', 'momo-transactions': 'fees_paid', 'income-expenditure': 'fees_outstanding', canteen: 'canteen', bus: 'school_bus',
  announcements: 'announcements', forum: 'forum', users: 'users', audit: 'audit',
  backup: 'backup', settings: 'settings', 'arabic-report': 'results', 'my-results': 'results',
  'my-group-tasks': 'class_groups', dashboard: 'total_students', messages: 'users',
};
const NAV_GROUP_ICON_FILES = {
  Students: 'total_students', Parents: 'parents', Staff: 'staff_group', Academics: 'academics',
  Finance: 'finance', Services: 'services', Communication: 'communication', Administration: 'administration',
};
function navIconHtml(file) { return file ? `<img src="/assets/icons/${file}.png" alt="" class="nav-item-icon">` : ''; }

function buildNav() {
  const nav = document.getElementById('nav');
  nav.innerHTML = '';
  // Students get a short, purpose-built menu instead of the full admin sidebar — the server already
  // blocks them from every admin endpoint, but showing dead-end links would just be confusing.
  if (state.user && state.user.role === 'Student') {
    [['dashboard', 'Dashboard'], ['my-results', 'My Report Card'], ['fees', 'My Fees'], ['announcements', 'Announcements'], ['assignments', 'Assignments & Quizzes'], ['my-group-tasks', 'My Group Tasks'], ['exam-schedule', 'Exam Schedule'], ['live-class-rooms', 'Live Class Rooms'], ['school-selection', 'SHS School Selection'], ['forum', t('forum') || 'Forum'], ['messages', 'Messages']].forEach(([key, label]) => {
      const a = document.createElement('a');
      a.className = 'nav-item'; a.href = '#' + key; a.dataset.key = key;
      a.innerHTML = `${navIconHtml(NAV_ICON_FILES[key])}<span>${escapeHtml(label)}</span>`;
      nav.appendChild(a);
    });
    nav.querySelectorAll('.nav-item').forEach((el, i) => { el.style.animationDelay = `${Math.min(i * 18, 400)}ms`; });
    return;
  }
  // Dashboard is pinned above the groups, ungrouped.
  const dashItem = NAV_ITEMS.find(i => i.key === 'dashboard');
  if (dashItem && can(dashItem.module, 'view')) {
    const a = document.createElement('a');
    a.className = 'nav-item'; a.href = '#dashboard'; a.dataset.key = 'dashboard';
    a.innerHTML = `${navIconHtml(NAV_ICON_FILES.dashboard)}<span>${escapeHtml(t('dashboard'))}</span>`;
    nav.appendChild(a);
  }
  // Class List is also pinned, ungrouped, right under Dashboard — a prominent, one-click
  // overview of every class, distinct from the full Classes management page buried in Academics.
  const classListItem = NAV_ITEMS.find(i => i.key === 'class-list');
  if (classListItem && can(classListItem.module, 'view')) {
    const a = document.createElement('a');
    a.className = 'nav-item'; a.href = '#class-list'; a.dataset.key = 'class-list';
    a.innerHTML = `${navIconHtml(NAV_ICON_FILES.classes || 'classes')}<span>${escapeHtml(t('class-list'))}</span>`;
    nav.appendChild(a);
  }
  // "Search" is also pinned, ungrouped — clicking it focuses the same search box that's
  // always sitting in the top bar, so there's a menu entry point too, not just the box itself.
  const searchNavItem = document.createElement('a');
  searchNavItem.className = 'nav-item'; searchNavItem.href = '#'; searchNavItem.dataset.key = 'search';
  searchNavItem.innerHTML = `<img src="/assets/icons/school_selection.png" alt="" class="nav-item-icon"><span>Search</span>`;
  searchNavItem.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('global-search-input')?.focus();
  });
  nav.appendChild(searchNavItem);
  const collapsedGroups = JSON.parse(localStorage.getItem('nibras_collapsed_nav_groups') || '[]');
  NAV_GROUP_ORDER.forEach(groupName => {
    const itemsInGroup = NAV_ITEMS.filter(i => i.group === groupName && can(i.module, 'view'));
    if (!itemsInGroup.length) return; // hide empty groups entirely (e.g. a role with no access to anything in it)
    const isCollapsed = collapsedGroups.includes(groupName);
    const groupColor = NAV_GROUP_COLORS[groupName];
    const groupHeader = document.createElement('button');
    groupHeader.type = 'button';
    groupHeader.className = 'nav-group-header';
    groupHeader.style.color = groupColor;
    groupHeader.innerHTML = `${navIconHtml(NAV_GROUP_ICON_FILES[groupName])}<span>${escapeHtml(groupName)}</span><span class="nav-group-arrow ${isCollapsed ? '' : 'expanded'}">▸</span>`;
    nav.appendChild(groupHeader);
    const groupBody = document.createElement('div');
    groupBody.className = 'nav-group-body' + (isCollapsed ? ' collapsed' : '');
    groupBody.style.setProperty('--group-color', groupColor);
    itemsInGroup.forEach(item => {
      const a = document.createElement('a');
      a.className = 'nav-item nav-item-sub';
      a.href = '#' + item.key;
      a.dataset.key = item.key;
      a.innerHTML = `${navIconHtml(NAV_ICON_FILES[item.key])}<span>${escapeHtml(t(item.key))}</span>`;
      groupBody.appendChild(a);
    });
    nav.appendChild(groupBody);
    groupHeader.addEventListener('click', () => {
      const nowCollapsed = groupBody.classList.toggle('collapsed');
      groupHeader.querySelector('.nav-group-arrow').classList.toggle('expanded', !nowCollapsed);
      let stored = JSON.parse(localStorage.getItem('nibras_collapsed_nav_groups') || '[]');
      stored = nowCollapsed ? [...new Set([...stored, groupName])] : stored.filter(g => g !== groupName);
      localStorage.setItem('nibras_collapsed_nav_groups', JSON.stringify(stored));
    });
  });
  // A subtle cascading entrance for the whole menu — only ever runs when the nav is rebuilt
  // (login, language switch, theme change), never on ordinary page-to-page navigation, so it
  // reads as a nice "the menu comes alive" moment rather than a distracting repeat.
  nav.querySelectorAll('.nav-item, .nav-group-header').forEach((el, i) => {
    el.style.animationDelay = `${Math.min(i * 18, 400)}ms`;
  });
}

function setActiveNav(key) {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.key === key));
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-backdrop').classList.remove('open');
}

// ---------- Router ----------
const routes = {
  dashboard: renderDashboard,
  'class-list': renderClassList,
  students: (classId) => renderResourceList(RESOURCE_CONFIGS.students, classId ? `&class_id=${classId}` : ''),
  admissions: renderAdmissionsReport,
  alumni: renderAlumniPage,
  idcards: renderIdCards,
  parents: () => renderResourceList(RESOURCE_CONFIGS.parents),
  parent: (parentId) => renderParentProfile(parentId),
  'parent-contacts': renderParentContacts,
  teachers: () => renderResourceList(RESOURCE_CONFIGS.teachers),
  teacher: (teacherId) => renderTeacherProfile(teacherId),
  staff: () => renderResourceList(RESOURCE_CONFIGS.staff),
  classes: () => renderResourceList(RESOURCE_CONFIGS.classes),
  subjects: () => renderResourceList(RESOURCE_CONFIGS.subjects),
  academics: renderAcademics,
  attendance: renderAttendance,
  results: renderResults,
  performance: renderPerformanceReport,
  timetable: renderTimetable,
  'exam-schedule': renderExamSchedule,
  'live-class-rooms': renderLiveClassRooms,
  'my-results': renderMyResults,
  messages: renderMessages,
  forum: renderForum,
  'staff-checkin': renderStaffCheckin,
  assignments: renderAssignments,
  'class-groups': renderClassGroups,
  'school-selection': renderSchoolSelection,
  'school-database': renderSchoolDatabase,
  'arabic-report': renderArabicReport,
  'promote-students': renderPromoteStudents,
  'class-termly-report': renderClassTermlyReport,
  'my-group-tasks': renderMyGroupTasks,
  fees: renderFees,
  'momo-transactions': renderMomoTransactions,
  receipts: renderReceipts,
  'income-expenditure': renderIncomeExpenditure,
  bus: () => renderResourceList(RESOURCE_CONFIGS.bus),
  canteen: renderCanteen,
  announcements: () => renderResourceList(RESOURCE_CONFIGS.announcements),
  users: renderUsers,
  audit: renderAudit,
  backup: renderBackup,
  settings: renderSettings,
  student: renderStudentProfile,
};

function route() {
  const hash = location.hash.replace('#', '') || 'dashboard';
  const [key, param] = hash.split('/');
  setActiveNav(key);
  const fn = routes[key];
  const content = document.getElementById('content');
  // A subtle fade on every page change — re-triggering a CSS animation by removing then
  // re-adding its class (browsers won't replay an animation just because the class was
  // already there), so pages don't just abruptly swap in.
  content.classList.remove('content-fade-in');
  void content.offsetWidth; // force reflow so the browser notices the class was removed
  content.classList.add('content-fade-in');
  if (key !== 'dashboard') content.style.backgroundImage = ''; // background is dashboard-only
  if (!fn) { content.innerHTML = '<div class="empty-state">Page not found.</div>'; return; }
  // A page can throw a permission error if the hash is stale (e.g. a bookmark, or the previous
  // user's last page surviving a logout) or access was revoked mid-session — send them somewhere
  // safe instead of leaving a broken half-rendered page on screen.
  try {
    const result = fn(param);
    if (result && typeof result.catch === 'function') {
      result.catch(err => {
        content.innerHTML = `<div class="empty-state">${escapeHtml(err.message || "You don't have access to that page.")}</div>`;
        if (key !== 'dashboard') { location.hash = '#dashboard'; }
      });
    }
  } catch (err) {
    content.innerHTML = `<div class="empty-state">${escapeHtml(err.message || "You don't have access to that page.")}</div>`;
    if (key !== 'dashboard') { location.hash = '#dashboard'; }
  }
}

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstChild;
}
function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- Dashboard ----------
// Small inline icon set for the dashboard stat cards — no external icon library needed (offline-safe).
// Where each dashboard stat card navigates to when clicked, so the dashboard doubles as a
// jumping-off point rather than a dead-end summary.
const DASHBOARD_CARD_LINKS = {
  students: 'students', male: 'students', female: 'students', orphan: 'students',
  teachers: 'teachers', staff: 'staff', parents: 'parents',
  present: 'attendance', absent: 'attendance', bus: 'bus', canteen: 'canteen',
  feesPaid: 'fees', feesOutstanding: 'fees',
};
// Maps each dashboard stat-card key to its extracted icon image file.
const DASHBOARD_ICON_FILES = {
  students: 'total_students', male: 'male', female: 'female', orphan: 'orphan',
  teachers: 'teacher', staff: 'staff', parents: 'parents',
  present: 'present', absent: 'absent', bus: 'bus', canteen: 'canteen_users',
  feesPaid: 'fees_paid', feesOutstanding: 'fees_outstanding', subjects: 'subjects', classes: 'classes',
};
// Grouped by what the metric actually means, not just alternating colors arbitrarily — people
// counts read as blue/purple, attendance as green/red (present/absent), money as green/red
// (collected/outstanding), and services as teal/orange, so the dashboard grid reads at a
// glance instead of every card looking identical.
function dashboardCardColorClass(icon) {
  const map = {
    students: 'stat-card-blue', male: 'stat-card-blue', female: 'stat-card-blue', orphan: 'stat-card-purple',
    teachers: 'stat-card-purple', staff: 'stat-card-purple', parents: 'stat-card-purple',
    present: 'stat-card-green', absent: 'stat-card-red',
    bus: 'stat-card-teal', canteen: 'stat-card-orange',
    feesPaid: 'stat-card-green', feesOutstanding: 'stat-card-red',
    subjects: 'stat-card-teal', classes: 'stat-card-teal',
  };
  return map[icon] || '';
}
function dashboardIconHtml(key) {
  const file = DASHBOARD_ICON_FILES[key];
  return file ? `<img src="/assets/icons/${file}.png" alt="" class="stat-icon-img">` : '';
}

const DASHBOARD_CARD_KEYS = ['students', 'male', 'female', 'orphan', 'teachers', 'staff', 'parents', 'present', 'absent', 'bus', 'canteen', 'feesPaid', 'feesOutstanding', 'subjects', 'classes'];

// Sensible starting point per role — each person still gets a "Customize" button to make it
// truly their own, but nobody starts from a school-wide admin view that's mostly irrelevant to them.
const ROLE_DEFAULT_DASHBOARD_CARDS = {
  'Teacher': ['students', 'present', 'absent', 'orphan'],
  'Arabic Head Teacher': ['teachers', 'students', 'present', 'absent'],
  'Student': ['present', 'absent'],
  'Parent/Guardian': ['present', 'absent', 'feesOutstanding'],
  'Non-teaching Staff': ['students', 'teachers', 'present', 'absent'],
  'Accountant/Bursar': ['feesPaid', 'feesOutstanding', 'canteen', 'students'],
  'Canteen Collector': ['canteen', 'students'],
};
function defaultCardsForRole(roleName) {
  return ROLE_DEFAULT_DASHBOARD_CARDS[roleName] || DASHBOARD_CARD_KEYS.slice(); // Headteacher/Admin/others: full view
}

let cachedDashboardPrefs = null; // avoid refetching on every render within the same session
async function getDashboardCardPrefs() {
  if (cachedDashboardPrefs) return cachedDashboardPrefs;
  try {
    const res = await api('/my-dashboard-prefs');
    if (Array.isArray(res.cards) && res.cards.length) {
      cachedDashboardPrefs = res.cards.filter(k => DASHBOARD_CARD_KEYS.includes(k));
      return cachedDashboardPrefs;
    }
  } catch (e) { /* fall through to role default */ }
  cachedDashboardPrefs = defaultCardsForRole(state.user?.role);
  return cachedDashboardPrefs;
}
async function setDashboardCardPrefs(keys) {
  cachedDashboardPrefs = keys;
  try { await api('/my-dashboard-prefs', { method: 'PUT', body: { cards: keys } }); }
  catch (e) { /* saved in memory for this session even if the write fails */ }
}

let dashboardClockInterval = null;

// A teacher's "My Classes" section on their Dashboard — quick links into the pages they'd
// actually use for their own class(es), plus an at-a-glance average performance figure.
async function renderTeacherMyClasses(termId) {
  const card = document.getElementById('teacher-my-classes-card');
  if (!card) return;
  card.innerHTML = '<div class="card"><div class="empty-state">Loading your classes…</div></div>';
  const [classes, groupsAll] = await Promise.all([api('/classes?pageSize=50'), api('/class_groups?pageSize=200').catch(() => ({ rows: [] }))]);
  if (!classes.rows.length) {
    card.innerHTML = `<div class="card"><h3 style="margin-top:0;color:var(--navy)">My Classes</h3><p class="muted">You are not currently assigned as class teacher for any class. Ask an admin to assign you under Classes.</p></div>`;
    return;
  }
  const rows = await Promise.all(classes.rows.map(async (c) => {
    const students = await api(`/students?class_id=${c.id}&pageSize=500`).catch(() => ({ rows: [] }));
    const perf = termId ? await api(`/performance-report?class_id=${c.id}&term_id=${termId}`).catch(() => ({ rows: [] })) : { rows: [] };
    const scored = (perf.rows || []).filter(r => r.average != null);
    const avg = scored.length ? Math.round(scored.reduce((s, r) => s + r.average, 0) / scored.length) : null;
    const groupCount = (groupsAll.rows || []).filter(g => g.class_id === c.id).length;
    return { cls: c, studentCount: students.rows.length, avg, groupCount };
  }));
  card.innerHTML = `<div class="card">
    <h3 style="margin-top:0;color:var(--navy)">My Classes</h3>
    <div class="table-wrap"><table><thead><tr><th>Class</th><th>Students</th><th>Groups</th><th>Class Average</th><th></th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td><b>${escapeHtml(r.cls.name)}</b></td>
        <td>${r.studentCount}</td>
        <td>${r.groupCount}</td>
        <td>${r.avg != null ? r.avg : '<span class="muted">No results yet</span>'}</td>
        <td>
          <button class="btn secondary my-class-results-btn" data-class="${r.cls.id}" style="padding:5px 10px;font-size:12px">Enter Results</button>
          <button class="btn secondary my-class-students-btn" data-class="${r.cls.id}" style="padding:5px 10px;font-size:12px">View Students</button>
          <button class="btn secondary my-class-groups-btn" data-class="${r.cls.id}" style="padding:5px 10px;font-size:12px">Groups</button>
          <button class="btn secondary my-class-assignments-btn" data-class="${r.cls.id}" style="padding:5px 10px;font-size:12px">Assignments &amp; Quiz</button>
          <button class="btn secondary my-class-announce-btn" data-class="${r.cls.id}" style="padding:5px 10px;font-size:12px">Post Announcement</button>
        </td>
      </tr>`).join('')}</tbody></table></div>
  </div>`;
  card.querySelectorAll('.my-class-results-btn').forEach(btn => btn.addEventListener('click', () => { location.hash = '#results'; }));
  card.querySelectorAll('.my-class-students-btn').forEach(btn => btn.addEventListener('click', () => { location.hash = '#students'; }));
  card.querySelectorAll('.my-class-groups-btn').forEach(btn => btn.addEventListener('click', () => { location.hash = '#class-groups'; }));
  card.querySelectorAll('.my-class-assignments-btn').forEach(btn => btn.addEventListener('click', () => { location.hash = '#assignments'; }));
  card.querySelectorAll('.my-class-announce-btn').forEach(btn => btn.addEventListener('click', () => { location.hash = '#announcements'; }));
}

// A focused, minimal dashboard for Students — their photo/profile, a way to check results and
// fees, and one-tap access to what they'd actually use day-to-day (a live class if one's on,
// the forum, messages, and their tasks) — rather than the admin-style stat-card grid, which is
// mostly meaningless to a student.
// Shared rendering for every role's portal dashboard (Student/Teacher/Parent/Non-teaching
// Staff) — profile block plus a grid of clickable cards. Which cards actually appear is
// decided by each role's own function below, filtered against what an admin has allowed for
// that role (Settings → Dashboard Widgets).
function renderPortalDashboardShell(greeting, photoUrl, name, meta, cards) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="page-header"><h2>Welcome, ${escapeHtml(greeting)}!</h2></div>
    <div class="student-dash-profile">
      ${photoUrl ? `<img src="${photoUrl}" class="student-dash-photo" alt="">` : `<div class="student-dash-photo student-dash-photo-placeholder">👤</div>`}
      <div>
        <div class="student-dash-name">${escapeHtml(name)}</div>
        <div class="student-dash-meta">${escapeHtml(meta)}</div>
      </div>
    </div>
    <div class="student-dash-grid">
      ${cards.map(c => `<div class="student-dash-card ${c.live ? 'student-dash-card-live' : ''}" data-goto="${c.hash}">
        <div class="student-dash-card-icon">${c.icon}</div>
        <div class="student-dash-card-title">${c.title}</div>
        <div class="student-dash-card-sub">${escapeHtml(c.sub)}</div>
      </div>`).join('') || '<div class="empty-state">Nothing to show — an admin can turn widgets on for you in Settings → Dashboard Widgets.</div>'}
    </div>`;
  content.querySelectorAll('.student-dash-card').forEach(el => {
    el.addEventListener('click', () => { location.hash = el.dataset.goto; });
  });
}

async function getMyDashboardWidgets() {
  try { return await api('/my-dashboard-widgets'); } catch (e) { return {}; }
}
// Absence of a key defaults to visible — a role that hasn't been configured yet (or a widget
// added after the last configuration pass) shows up rather than silently disappearing.
// A dashboard card only ever shows if BOTH the admin has left it enabled for this role AND the
// role genuinely has permission for the feature it links to — an admin toggling a widget on
// for a role that structurally can't use that feature (e.g. it was never granted Forum access)
// should never produce a card that looks clickable but 403s the moment someone taps it.
// "tasks" is deliberately left unmapped here — it points at a different page per role (a
// Student's own self-scoped task list, a Teacher's Class Groups management page, a Staff
// member's check-in status), so one blanket permission check would be wrong for at least one
// of them; each of those destination pages already enforces its own access correctly.
const DASHBOARD_WIDGET_MODULE = {
  results: 'results', fees: 'fees', 'live-class': 'live_class_rooms',
  announcements: 'announcements', forum: 'forum', messages: 'messages',
  attendance: 'attendance', 'exam-schedule': 'exam_schedule', 'class-list': 'classes', assignments: 'assignments',
};
function widgetVisible(map, key) {
  if (map[key] === false) return false;
  const module = DASHBOARD_WIDGET_MODULE[key];
  if (module && !can(module, 'view')) return false;
  return true;
}

async function renderStudentDashboard() {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="empty-state">Loading…</div>';
  if (!state.user.linked_student_id) {
    content.innerHTML = `<div class="page-header"><h2>Dashboard</h2></div><div class="empty-state">Your account isn't linked to a student record yet — ask an admin to fix this.</div>`;
    return;
  }
  const [student, tasksData, liveRoom, widgets] = await Promise.all([
    api(`/students/${state.user.linked_student_id}`),
    api('/my-group-tasks').catch(() => ({ group_tasks: [], individual_tasks: [] })),
    api('/live-rooms/active-for-my-class').catch(() => null),
    getMyDashboardWidgets(),
  ]);
  const photoUrl = student.photo ? `/uploads/${encodeURIComponent(student.photo)}` : null;
  const totalDue = (student.fees || []).reduce((s, f) => s + (f.amount_due || 0), 0);
  const totalPaid = (student.fees || []).reduce((s, f) => s + (f.amount_paid || 0), 0);
  const balance = totalDue - totalPaid;
  const openTasks = [...(tasksData.individual_tasks || []).filter(t => t.status !== 'Done'), ...(tasksData.group_tasks || [])];

  const cards = [];
  if (widgetVisible(widgets, 'results')) cards.push({ icon: '📊', title: 'My Results', sub: 'View your latest report card', hash: '#my-results' });
  if (widgetVisible(widgets, 'fees')) cards.push({ icon: '💳', title: balance > 0 ? `GHS ${balance.toLocaleString()} Due` : 'Fees Up to Date', sub: balance > 0 ? 'Outstanding balance' : 'No outstanding balance', hash: '#fees' });
  if (widgetVisible(widgets, 'attendance')) cards.push({ icon: '🗓️', title: 'Attendance', sub: 'Your attendance record', hash: '#attendance' });
  if (widgetVisible(widgets, 'exam-schedule')) cards.push({ icon: '📝', title: 'Exam Schedule', sub: 'Upcoming exams', hash: '#exam-schedule' });
  if (widgetVisible(widgets, 'live-class')) cards.push({ icon: liveRoom ? '🔴' : '📹', title: liveRoom ? 'Join Live Class' : 'No Live Class', sub: liveRoom ? (liveRoom.teacher_name || '') : 'Nothing live right now', hash: '#live-class-rooms', live: !!liveRoom });
  if (widgetVisible(widgets, 'announcements')) cards.push({ icon: '📢', title: 'Announcements', sub: 'Latest school updates', hash: '#announcements' });
  if (widgetVisible(widgets, 'forum')) cards.push({ icon: '💬', title: 'Discussion Forum', sub: 'Join the conversation', hash: '#forum' });
  if (widgetVisible(widgets, 'messages')) cards.push({ icon: '✉️', title: 'Messages', sub: 'Chat with classmates & teacher', hash: '#messages' });
  if (widgetVisible(widgets, 'tasks')) cards.push({ icon: '✅', title: `${openTasks.length} Task${openTasks.length === 1 ? '' : 's'}`, sub: openTasks.length ? 'Tasks waiting for you' : 'All caught up', hash: '#my-group-tasks' });

  renderPortalDashboardShell(student.first_name, photoUrl, `${student.first_name} ${student.last_name}`, `${student.student_id} · ${student.class_name || 'No class assigned'}`, cards);
}

// The same focused, professional layout for Teachers — their profile, their classes (standing
// in for "Results," since a teacher's own report card isn't meaningful), a way to start/join a
// live class, and one-tap access to the forum, messages, and tasks they've set.
async function renderTeacherDashboard() {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="empty-state">Loading…</div>';
  const [me, classesData, liveRoomsData, widgets] = await Promise.all([
    api('/me'),
    api('/classes?pageSize=200').catch(() => ({ rows: [] })),
    api('/live_class_rooms?status=active').catch(() => ({ rows: [] })),
    getMyDashboardWidgets(),
  ]);
  const photoUrl = me.photo ? `/uploads/${encodeURIComponent(me.photo)}` : null;
  const myClasses = classesData.rows || [];
  const hasLiveRoom = (liveRoomsData.rows || []).length > 0;

  const cards = [];
  if (widgetVisible(widgets, 'results')) cards.push({ icon: '📊', title: 'My Classes', sub: `${myClasses.length} class${myClasses.length === 1 ? '' : 'es'} · Enter results`, hash: '#results' });
  if (widgetVisible(widgets, 'class-list')) cards.push({ icon: '🏫', title: 'My Class', sub: 'Students, timetable & shared files', hash: '#class-list' });
  if (widgetVisible(widgets, 'assignments')) cards.push({ icon: '📝', title: 'Assignments & Quizzes', sub: 'Grade submissions', hash: '#assignments' });
  if (widgetVisible(widgets, 'attendance')) cards.push({ icon: '🗓️', title: 'Attendance', sub: 'Mark today\'s attendance', hash: '#attendance' });
  if (widgetVisible(widgets, 'exam-schedule')) cards.push({ icon: '📅', title: 'Exam Schedule', sub: 'Upcoming exams', hash: '#exam-schedule' });
  if (widgetVisible(widgets, 'live-class')) cards.push({ icon: hasLiveRoom ? '🔴' : '📹', title: hasLiveRoom ? 'Resume Live Class' : 'Start Live Class', sub: hasLiveRoom ? 'You have a class in progress' : 'Broadcast to your class', hash: '#live-class-rooms', live: hasLiveRoom });
  if (widgetVisible(widgets, 'announcements')) cards.push({ icon: '📢', title: 'Announcements', sub: 'Post an update', hash: '#announcements' });
  if (widgetVisible(widgets, 'forum')) cards.push({ icon: '💬', title: 'Discussion Forum', sub: 'Join the conversation', hash: '#forum' });
  if (widgetVisible(widgets, 'messages')) cards.push({ icon: '✉️', title: 'Messages', sub: 'Chat with students & colleagues', hash: '#messages' });
  if (widgetVisible(widgets, 'tasks')) cards.push({ icon: '✅', title: 'Class Groups & Tasks', sub: 'Manage group and individual tasks', hash: '#class-groups' });

  renderPortalDashboardShell(me.full_name, photoUrl, me.full_name, me.role, cards);
}

// Parent/Guardian dashboard — a similarly focused view for keeping tabs on their child: results,
// outstanding fees, announcements, and the forum, rather than the admin-style dashboard.
async function renderParentDashboard() {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="empty-state">Loading…</div>';
  const [me, widgets] = await Promise.all([api('/me'), getMyDashboardWidgets()]);
  const photoUrl = me.photo ? `/uploads/${encodeURIComponent(me.photo)}` : null;

  const cards = [];
  if (widgetVisible(widgets, 'results')) cards.push({ icon: '📊', title: "My Child's Results", sub: 'View report cards', hash: '#my-results' });
  if (widgetVisible(widgets, 'fees')) cards.push({ icon: '💳', title: 'Fees', sub: 'Check outstanding balance', hash: '#fees' });
  if (widgetVisible(widgets, 'live-class')) cards.push({ icon: '📹', title: 'Live Class Rooms', sub: "See if your child's class is live", hash: '#live-class-rooms' });
  if (widgetVisible(widgets, 'announcements')) cards.push({ icon: '📢', title: 'Announcements', sub: 'Latest school updates', hash: '#announcements' });
  if (widgetVisible(widgets, 'forum')) cards.push({ icon: '💬', title: 'Discussion Forum', sub: 'Join the conversation', hash: '#forum' });
  if (widgetVisible(widgets, 'messages')) cards.push({ icon: '✉️', title: 'Messages', sub: 'Contact the school', hash: '#messages' });

  renderPortalDashboardShell(me.full_name, photoUrl, me.full_name, me.role, cards);
}

// Non-teaching Staff dashboard — announcements, forum, and any tasks assigned to them, kept to
// exactly what's relevant rather than the full admin-style view.
async function renderNonStaffDashboard() {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="empty-state">Loading…</div>';
  const [me, widgets] = await Promise.all([api('/me'), getMyDashboardWidgets()]);
  const photoUrl = me.photo ? `/uploads/${encodeURIComponent(me.photo)}` : null;

  const cards = [];
  if (widgetVisible(widgets, 'announcements')) cards.push({ icon: '📢', title: 'Announcements', sub: 'Latest school updates', hash: '#announcements' });
  if (widgetVisible(widgets, 'forum')) cards.push({ icon: '💬', title: 'Discussion Forum', sub: 'Join the conversation', hash: '#forum' });
  if (widgetVisible(widgets, 'messages')) cards.push({ icon: '✉️', title: 'Messages', sub: 'Chat with colleagues', hash: '#messages' });
  // No "My Tasks" card here — there's no individual/group task feature built for Non-teaching
  // Staff yet (unlike Students), so a card promising one would just be a dead end.

  renderPortalDashboardShell(me.full_name, photoUrl, me.full_name, me.role, cards);
}

// A simple, prominent overview of every class — separate from the full Classes management page
// (which handles add/edit/delete) — one click away from the same rich detail popup (teacher,
// alphabetical roster, timetable, print) that clicking a class name opens everywhere else.
async function renderClassList() {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="empty-state">Loading…</div>';
  const rows = await api('/classes-summary');
  // Groups by level so a big school's class list reads as a structure (early years through
  // JHS) rather than one long undifferentiated grid. Falls back to "Other" for a class with no
  // level set yet, and folds the older generic "Primary" value (from before Lower/Upper Primary
  // were split out as distinct options) into Lower Primary rather than losing it in "Other".
  const GROUPS = ['Nursery', 'Lower Primary', 'Upper Primary', 'JHS', 'Other'];
  // The exact `level` value to save when a class is dropped into each group — "Other" has no
  // single correct value to assign (it's a catch-all for "not set"), so it's a valid group to
  // display but not a valid drag target; dragging always assigns one of the four real levels.
  const LEVEL_FOR_GROUP = { 'Nursery': 'Nursery', 'Lower Primary': 'Lower Primary', 'Upper Primary': 'Upper Primary', 'JHS': 'JHS' };
  const groupOf = level => {
    if (!level) return 'Other';
    if (level === 'Nursery' || level === 'KG') return 'Nursery';
    if (level === 'Primary' || level === 'Lower Primary') return 'Lower Primary';
    if (level === 'Upper Primary') return 'Upper Primary';
    if (level === 'JHS') return 'JHS';
    return 'Other';
  };
  const grouped = {};
  GROUPS.forEach(g => grouped[g] = []);
  rows.forEach(c => grouped[groupOf(c.level)].push(c));
  const canDrag = can('classes', 'edit') && state.user.role !== 'Teacher'; // reorganizing level groups is an admin-level curriculum decision, same tier as adding/removing subjects

  const cardHtml = c => `
    <div class="stat-card accent stat-card-teal clickable-stat class-list-card" data-id="${c.id}" ${canDrag ? 'draggable="true"' : ''}>
      <div class="stat-icon">📖</div>
      <div>
        <div class="num" style="font-size:18px">${escapeHtml(c.name)}</div>
        <div class="label">${c.student_count} student${c.student_count === 1 ? '' : 's'} · ${escapeHtml(c.class_teacher_name || 'No class teacher set')}</div>
      </div>
    </div>`;
  const sectionHtml = group => {
    if (!grouped[group].length && (!canDrag || group === 'Other')) return ''; // nothing to show and nothing to drop here
    return `
    <div class="class-list-group class-list-dropzone" data-group="${escapeHtml(group)}">
      <h3 class="class-list-group-title">${escapeHtml(group)} <span class="small-text">(${grouped[group].length})</span></h3>
      <div class="stat-grid">${grouped[group].map(cardHtml).join('') || '<p class="small-text muted">Drag a class here</p>'}</div>
    </div>`;
  };

  content.innerHTML = `
    <div class="page-header"><h2>📚 Class List</h2></div>
    <p class="small-text">${state.user.role === 'Teacher' ? 'Your class, at a glance' : 'Every class in the school, grouped by level'} — click a class name for its full details: students, class teacher, and timetable.
      ${canDrag ? ' Drag a class card into a different group to move it there.' : ''}</p>
    ${rows.length ? GROUPS.map(sectionHtml).join('') : '<div class="empty-state">No classes yet — add one under Academics → Classes.</div>'}`;
  content.querySelectorAll('.class-list-card').forEach(card => card.addEventListener('click', () => openClassDetailsModal(Number(card.dataset.id))));

  if (!canDrag) return;
  let draggedId = null;
  content.querySelectorAll('.class-list-card[draggable]').forEach(card => {
    card.addEventListener('dragstart', (e) => { draggedId = Number(card.dataset.id); e.dataTransfer.effectAllowed = 'move'; card.classList.add('dragging'); });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
  });
  content.querySelectorAll('.class-list-dropzone').forEach(zone => {
    const targetLevel = LEVEL_FOR_GROUP[zone.dataset.group];
    if (!targetLevel) return; // "Other" isn't a valid drop target — nothing to assign
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drop-hover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drop-hover'));
    zone.addEventListener('drop', async (e) => {
      e.preventDefault();
      zone.classList.remove('drop-hover');
      if (draggedId == null) return;
      try {
        await api(`/classes/${draggedId}`, { method: 'PUT', body: { level: targetLevel } });
        renderClassList();
      } catch (err) { alert(err.message); }
    });
  });
}

async function renderDashboard() {
  const content = document.getElementById('content');
  if (state.user.role === 'Student') return renderStudentDashboard();
  if (state.user.role === 'Teacher') return renderTeacherDashboard();
  if (state.user.role === 'Parent/Guardian') return renderParentDashboard();
  if (state.user.role === 'Non-teaching Staff') return renderNonStaffDashboard();
  content.innerHTML = '<div class="empty-state">Loading dashboard…</div>';
  const d = await api('/dashboard');
  document.getElementById('tb-year').textContent = d.current_academic_year || '—';
  document.getElementById('tb-term').textContent = d.current_term || '—';
  const allCards = {
    students: ['students', t('stat_students'), d.total_students], male: ['male', t('stat_male'), d.male_students], female: ['female', t('stat_female'), d.female_students],
    orphan: ['orphan', t('stat_orphan'), d.orphan_students], teachers: ['teachers', t('stat_teachers'), d.total_teachers], staff: ['staff', t('stat_staff'), d.total_staff],
    parents: ['parents', t('stat_parents'), d.total_parents], present: ['present', t('stat_present'), d.present_today], absent: ['absent', t('stat_absent'), d.absent_today],
    bus: ['bus', t('stat_bus'), d.bus_users], canteen: ['canteen', t('stat_canteen'), d.canteen_users],
    feesPaid: ['feesPaid', t('stat_feesPaid'), 'GHS ' + d.total_fees_paid.toLocaleString()],
    feesOutstanding: ['feesOutstanding', t('stat_feesOutstanding'), 'GHS ' + d.total_fees_outstanding.toLocaleString()],
    subjects: ['subjects', 'Total Subjects', d.total_subjects], classes: ['classes', 'Total Classes', d.total_classes],
  };
  const visibleKeys = await getDashboardCardPrefs();
  const cards = visibleKeys.map(k => allCards[k]).filter(Boolean);
  const bgUrl = d.dashboard_background_photo ? `/uploads/${encodeURIComponent(d.dashboard_background_photo)}` : null;
  const contentEl = document.getElementById('content');
  contentEl.style.backgroundImage = bgUrl ? `linear-gradient(rgba(244,246,249,.88),rgba(244,246,249,.88)), url('${bgUrl}')` : '';
  contentEl.style.backgroundSize = 'cover';
  contentEl.style.backgroundPosition = 'center';
  const currentLang = getCurrentLanguage();
  content.innerHTML = `
    <div class="page-header">
      <h2>${escapeHtml(d.school_name)} — ${t('dash_suffix')}</h2>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <div id="dashboard-clock" class="dashboard-clock"></div>
        <button class="btn secondary" id="customize-dashboard-btn">⚙ ${t('customize')}</button>
      </div>
    </div>
    <div class="stat-grid">${cards.map(([icon, label, num]) => `<div class="stat-card accent ${dashboardCardColorClass(icon)} clickable-stat" data-goto="${DASHBOARD_CARD_LINKS[icon] || ''}"><div class="stat-icon">${dashboardIconHtml(icon)}</div><div><div class="num">${num}</div><div class="label">${label}</div></div></div>`).join('') || '<div class="empty-state">No cards selected — click Customize to add some.</div>'}</div>
    <div class="card">
      <div class="page-header" style="margin-bottom:10px">
        <h3 style="margin:0;color:var(--navy)">${t('students_by_class')}</h3>
        <select id="dash-directory-select">
          <option value="students">${t('students_by_class')}</option>
          <option value="teachers">Teachers</option>
          <option value="staff">Non-teaching Staff</option>
        </select>
      </div>
      <div id="dash-directory-body">
        <div class="table-wrap"><table><thead><tr><th>${t('col_class')}</th><th>${t('col_students')}</th></tr></thead><tbody>
          ${d.students_by_class.map(r => `<tr class="${r.class_id ? 'clickable-row' : ''}" ${r.class_id ? `data-class-id="${r.class_id}"` : ''}><td>${escapeHtml(r.class_name || '(Unassigned)')}</td><td>${r.count}</td></tr>`).join('') || '<tr><td colspan=2 class="muted">No classes yet</td></tr>'}
        </tbody></table></div>
      </div>
    </div>
    ${state.user.role === 'Teacher' ? '<div id="teacher-my-classes-card"></div>' : ''}`;

  // Swaps the dashboard's directory card between Students-by-Class, Teachers, and Non-teaching
  // Staff — one dropdown instead of three separate always-visible tables competing for space.
  document.getElementById('dash-directory-select')?.addEventListener('change', async (e) => {
    const body = document.getElementById('dash-directory-body');
    const mode = e.target.value;
    if (mode === 'students') {
      body.innerHTML = `<div class="table-wrap"><table><thead><tr><th>${t('col_class')}</th><th>${t('col_students')}</th></tr></thead><tbody>
        ${d.students_by_class.map(r => `<tr class="${r.class_id ? 'clickable-row' : ''}" ${r.class_id ? `data-class-id="${r.class_id}"` : ''}><td>${escapeHtml(r.class_name || '(Unassigned)')}</td><td>${r.count}</td></tr>`).join('') || '<tr><td colspan=2 class="muted">No classes yet</td></tr>'}
      </tbody></table></div>`;
      body.querySelectorAll('tr[data-class-id]').forEach(row => row.addEventListener('click', () => { location.hash = `#students/${row.dataset.classId}`; }));
      return;
    }
    body.innerHTML = '<div class="empty-state">Loading…</div>';
    if (mode === 'teachers') {
      const teachers = (await api('/teachers?pageSize=500')).rows;
      body.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Qualification</th><th>Phone</th></tr></thead><tbody>
        ${teachers.map(t2 => `<tr><td><a href="#teacher/${t2.id}" class="class-name-link">${escapeHtml(t2.full_name)}</a></td><td>${escapeHtml(t2.qualification || '—')}</td><td>${escapeHtml(t2.phone || '—')}</td></tr>`).join('') || '<tr><td colspan=3 class="muted">No teachers yet</td></tr>'}
      </tbody></table></div>`;
    } else if (mode === 'staff') {
      const staffRows = (await api('/staff?pageSize=500')).rows;
      body.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Position</th><th>Status</th></tr></thead><tbody>
        ${staffRows.map(s => `<tr><td><a href="#" class="class-name-link staff-profile-trigger" data-id="${s.id}">${escapeHtml(s.full_name)}</a></td><td>${escapeHtml(s.position || '—')}</td><td>${statusBadge(s.employment_status)}</td></tr>`).join('') || '<tr><td colspan=3 class="muted">No staff yet</td></tr>'}
      </tbody></table></div>`;
    }
  });

  document.querySelectorAll('tr[data-class-id]').forEach(row => {
    row.addEventListener('click', () => { location.hash = `#students/${row.dataset.classId}`; });
  });

  if (state.user.role === 'Teacher') renderTeacherMyClasses(d.current_term_id);

  // Live system date/time, updated every second.
  if (dashboardClockInterval) clearInterval(dashboardClockInterval);
  const updateClock = () => {
    const el2 = document.getElementById('dashboard-clock');
    if (!el2) { clearInterval(dashboardClockInterval); return; }
    const now = new Date();
    el2.textContent = now.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) + ' · ' + now.toLocaleTimeString();
  };
  updateClock();
  dashboardClockInterval = setInterval(updateClock, 1000);

  document.getElementById('customize-dashboard-btn').addEventListener('click', () => openDashboardCustomizeModal(visibleKeys, allCards));
  document.querySelectorAll('.clickable-stat').forEach(card => {
    if (!card.dataset.goto) return;
    card.addEventListener('click', () => { location.hash = '#' + card.dataset.goto; });
  });
}

function openDashboardCustomizeModal(visibleKeys, allCards) {
  const labels = { students: 'Total Students', male: 'Male', female: 'Female', orphan: 'Orphan Students', teachers: 'Teachers', staff: 'Non-teaching Staff', parents: 'Parents/Guardians', present: 'Present Today', absent: 'Absent Today', bus: 'Bus Users', canteen: 'Canteen Users', feesPaid: 'Fees Collected', feesOutstanding: 'Fees Outstanding', subjects: 'Total Subjects', classes: 'Total Classes' };
  const modal = el(`<div class="modal-backdrop"><div class="modal" style="width:420px">
    <h3>Customize Dashboard</h3>
    <p class="small-text">Choose which cards to show. This is remembered on this computer only.</p>
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:10px">
      ${DASHBOARD_CARD_KEYS.map(k => `<label style="display:flex;align-items:center;gap:8px;font-size:13.5px">
        <input type="checkbox" data-card-key="${k}" ${visibleKeys.includes(k) ? 'checked' : ''}> ${labels[k]}
      </label>`).join('')}
    </div>
    <div class="modal-actions">
      <button type="button" class="btn secondary" id="cancel-customize">Cancel</button>
      <button type="button" class="btn gold" id="save-customize">Save</button>
    </div>
  </div></div>`);
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  modal.querySelector('#cancel-customize').addEventListener('click', () => modal.remove());
  modal.querySelector('#save-customize').addEventListener('click', async () => {
    const chosen = [...modal.querySelectorAll('input[data-card-key]:checked')].map(cb => cb.dataset.cardKey);
    await setDashboardCardPrefs(chosen);
    modal.remove();
    renderDashboard();
  });
}

// ---------- Generic Resource CRUD ----------
// Ordered exactly as requested — from highest academic qualification down to entry-level certificates.
const TEACHER_QUALIFICATIONS = [
  'PhD (Doctor of Philosophy)', 'MPhil (Master of Philosophy)', 'MEd (Master of Education)',
  'MSc (Master of Science)', 'MA (Master of Arts)', 'MBA (Master of Business Administration)',
  "Master's Degree – Other",
  'BEd (Bachelor of Education)', 'BSc (Bachelor of Science)', 'BA (Bachelor of Arts)',
  'BBA (Bachelor of Business Administration)', "Bachelor's Degree – Other",
  'Diploma in Education', 'Diploma – Other', 'HND (Higher National Diploma)',
  "Teacher's Certificate / Certificate in Education", 'TVET / Vocational Certificate',
  'Professional Certificate', 'SHS Certificate / WASSCE', 'SSS Certificate',
  'JHS Certificate / BECE', 'Vocational / Technical Certificate', 'Other Qualification',
];

const RESOURCE_CONFIGS = {
  students: {
    resource: 'students', module: 'students', title: 'Students', searchable: true,
    columns: [
      { key: 'photo', label: '', render: r => photoThumb(r.photo) },
      { key: 'student_id', label: 'Student ID' },
      { key: 'full', label: 'Name', render: r => `${r.first_name} ${r.last_name}` },
      { key: 'gender', label: 'Gender' },
      { key: 'boarding_status', label: 'Day/Boarder' },
      { key: 'status', label: 'Status', render: r => statusBadge(r.status) },
      { key: 'orphan_status', label: 'Orphan' },
    ],
    linkTo: r => `#student/${r.id}`,
    printFilters: [
      { key: 'class_id', label: 'Class', async: 'classes' },
      { key: 'status', label: 'Status', options: ['Active', 'Inactive', 'Graduated', 'Alumni', 'Transferred', 'Withdrawn', 'Stopped'] },
      { key: 'gender', label: 'Gender', options: ['Male', 'Female'] },
      { key: 'orphan_status', label: 'Orphan Status', options: ['Non-Orphan', 'Orphan'] },
      { key: 'boarding_status', label: 'Day / Boarder', options: ['Day', 'Boarder'] },
      { key: 'uses_bus', label: 'Uses School Bus', options: [['1', 'Yes'], ['0', 'No']] },
      { key: 'pays_canteen', label: 'Pays Canteen', options: [['1', 'Yes'], ['0', 'No']] },
    ],
    printColumns: [
      { label: 'Student ID', get: (r, ctx) => r.student_id },
      { label: 'Name', get: (r, ctx) => `${r.first_name} ${r.last_name}` },
      { label: 'Gender', get: (r, ctx) => r.gender },
      { label: 'Class', get: (r, ctx) => (ctx.classesById[r.class_id] || '—') },
      { label: 'Day/Boarder', get: (r, ctx) => r.boarding_status },
      { label: 'Status', get: (r, ctx) => r.status },
      { label: 'Orphan', get: (r, ctx) => r.orphan_status },
    ],
    autoIdInfo: existing => existing
      ? `Student ID: <b>${escapeHtml(existing.student_id)}</b> &nbsp;·&nbsp; Admission No: <b>${escapeHtml(existing.admission_number)}</b> <span class="small-text">(permanent, assigned automatically)</span>`
      : `Student ID and Admission Number will be generated automatically in the format <b>NIB/${new Date().getFullYear()}/001</b> when you save.`,
    fields: [
      { key: 'photo', label: 'Passport Picture', type: 'photo' },
      { key: 'first_name', label: 'First Name', required: true },
      { key: 'middle_name', label: 'Middle Name' },
      { key: 'last_name', label: 'Last Name', required: true },
      { key: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female'] },
      { key: 'dob', label: 'Date of Birth', type: 'date' },
      { key: 'nationality', label: 'Nationality' },
      { key: 'blood_group', label: 'Blood Group', type: 'select', options: ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },
      { key: 'admission_date', label: 'Admission Date', type: 'date' },
      { key: 'class_id', label: 'Class', type: 'asyncselect', resource: 'classes', labelKey: 'name' },
      { key: 'boarding_status', label: 'Day / Boarder', type: 'select', options: ['Day', 'Boarder'], default: 'Day' },
      { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive', 'Graduated', 'Alumni', 'Transferred', 'Withdrawn', 'Stopped'], default: 'Active' },
      { key: 'orphan_status', label: 'Orphan Status', type: 'select', options: ['Non-Orphan', 'Orphan'], default: 'Non-Orphan' },
      { key: 'scholarship_status', label: 'Scholarship Status', type: 'select', options: ['None', 'Full Scholarship', 'Partial Scholarship', 'Bursary', 'Sponsored'], default: 'None' },
      { key: 'sponsor_name', label: 'Sponsor Name', full: true, showIf: (v) => v.orphan_status === 'Orphan' && v.scholarship_status && v.scholarship_status !== 'None' },
      { key: 'sponsor_organization', label: 'Sponsor Organization', showIf: (v) => v.orphan_status === 'Orphan' && v.scholarship_status && v.scholarship_status !== 'None' },
      { key: 'sponsor_contact', label: 'Sponsor Contact', showIf: (v) => v.orphan_status === 'Orphan' && v.scholarship_status && v.scholarship_status !== 'None' },
      { key: 'uses_bus', label: 'Uses School Bus', type: 'checkbox' },
      { key: 'pays_canteen', label: 'Pays Canteen', type: 'checkbox' },
      { key: 'emergency_contact_name', label: 'Emergency Contact Name' },
      { key: 'emergency_contact_phone', label: 'Emergency Contact Phone' },
      { key: 'allergies', label: 'Allergies / Medical Notes', type: 'textarea', full: true },
      { key: 'parents', label: 'Parent / Guardian Information', type: 'parent_picker' },
    ],
  },
  parents: {
    resource: 'parents_guardians', module: 'parents', title: 'Parents & Guardians', searchable: true,
    columns: [
      { key: 'full_name', label: 'Name', render: r => `<a href="#parent/${r.id}" class="class-name-link">${escapeHtml(r.full_name)}</a>` }, { key: 'relationship', label: 'Relationship' },
      { key: 'phone', label: 'Phone' },
      { key: 'pta_member', label: 'PTA', render: r => r.pta_member ? '<span class="badge green">Yes</span>' : '<span class="badge gray">No</span>' },
      { key: 'status', label: 'Status', render: r => statusBadge(r.status) },
    ],
    printFilters: [
      { key: 'relationship', label: 'Relationship', options: ['Father', 'Mother', 'Guardian', 'Other'] },
      { key: 'status', label: 'Status', options: ['Alive', 'Deceased', 'Unknown'] },
      { key: 'pta_member', label: 'PTA Member', options: [['1', 'Yes'], ['0', 'No']] },
    ],
    printColumns: [
      { label: 'Name', get: r => r.full_name }, { label: 'Relationship', get: r => r.relationship },
      { label: 'Phone', get: r => r.phone }, { label: 'PTA Member', get: r => r.pta_member ? 'Yes' : 'No' },
      { label: 'Status', get: r => r.status },
    ],
    fields: [
      { key: 'full_name', label: 'Full Name', required: true },
      { key: 'relationship', label: 'Relationship', type: 'select', options: ['Father', 'Mother', 'Guardian', 'Other'], required: true },
      { key: 'status', label: 'Status (Alive/Deceased)', type: 'select', options: ['Alive', 'Deceased', 'Unknown'], default: 'Alive' },
      { key: 'phone', label: 'Phone' }, { key: 'alt_phone', label: 'Alternative Phone' },
      { key: 'email', label: 'Email' }, { key: 'occupation', label: 'Occupation' },
      { key: 'pta_member', label: 'Member of the PTA (Parent-Teacher Association)', type: 'checkbox' },
      { key: 'address', label: 'Address', full: true },
    ],
  },
  teachers: {
    resource: 'teachers', module: 'teachers', title: 'Teachers', searchable: true,
    columns: [
      { key: 'photo', label: '', render: r => photoThumb(r.photo) },
      { key: 'staff_id', label: 'Staff ID' }, { key: 'full_name', label: 'Name', render: r => `<a href="#teacher/${r.id}" class="class-name-link">${escapeHtml(r.full_name)}</a>` },
      { key: 'qualification', label: 'Qualification' },
      { key: 'department', label: 'Department' },
      { key: 'teaching_language', label: 'Teaches In', render: r => r.teaching_language || 'English' },
      { key: 'status', label: 'Status', render: r => statusBadge(r.status) },
    ],
    autoIdInfo: existing => existing
      ? `Staff ID: <b>${escapeHtml(existing.staff_id)}</b> <span class="small-text">(permanent, assigned automatically)</span>`
      : `Staff ID will be generated automatically in the format <b>ST/${new Date().getFullYear()}/001</b> when you save.`,
    printFilters: [
      { key: 'status', label: 'Status', options: ['Active', 'On Leave', 'Suspended', 'Resigned', 'Retired'] },
      { key: 'qualification', label: 'Qualification', options: TEACHER_QUALIFICATIONS },
      { key: 'department', label: 'Department', dynamic: true },
      { key: 'teaching_language', label: 'Teaches In', options: ['English', 'Arabic', 'Both'] },
    ],
    printColumns: [
      { label: 'Staff ID', get: r => r.staff_id }, { label: 'Name', get: r => r.full_name },
      { label: 'Qualification', get: r => r.qualification }, { label: 'Department', get: r => r.department },
      { label: 'Teaches In', get: r => r.teaching_language }, { label: 'Status', get: r => r.status },
    ],
    fields: [
      { key: 'photo', label: 'Passport Picture', type: 'photo' },
      { key: 'full_name', label: 'Full Name', required: true },
      { key: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female'] },
      { key: 'phone', label: 'Phone' }, { key: 'email', label: 'Email' },
      { key: 'qualification', label: 'Qualification', type: 'select', options: TEACHER_QUALIFICATIONS },
      { key: 'specialization', label: 'Specialization' },
      { key: 'employment_date', label: 'Employment Date', type: 'date' },
      { key: 'department', label: 'Department' },
      { key: 'teacher_level', label: 'Level', type: 'select', options: ['Nursery', 'Primary', 'JHS', 'SHS'] },
      { key: 'teaching_language', label: 'Teaches In', type: 'select', options: ['English', 'Arabic', 'Both'], default: 'English' },
      { key: 'status', label: 'Status', type: 'select', options: ['Active', 'On Leave', 'Suspended', 'Resigned', 'Retired'], default: 'Active' },
      { key: 'salary', label: 'Monthly Salary (GHS)', type: 'number' },
    ],
  },
  staff: {
    resource: 'staff', module: 'staff', title: 'Non-teaching Staff', searchable: true,
    columns: [
      { key: 'photo', label: '', render: r => photoThumb(r.photo) },
      { key: 'staff_id', label: 'Staff ID' }, { key: 'full_name', label: 'Name', render: r => `<a href="#" class="class-name-link staff-profile-trigger" data-id="${r.id}">${escapeHtml(r.full_name)}</a>` }, { key: 'position', label: 'Position' },
      { key: 'employment_status', label: 'Status', render: r => statusBadge(r.employment_status) },
    ],
    autoIdInfo: existing => existing
      ? `Staff ID: <b>${escapeHtml(existing.staff_id)}</b> <span class="small-text">(permanent, assigned automatically)</span>`
      : `Staff ID will be generated automatically in the format <b>ST/${new Date().getFullYear()}/001</b> when you save.`,
    printFilters: [
      { key: 'employment_status', label: 'Status', options: ['Active', 'On Leave', 'Suspended', 'Resigned', 'Retired'] },
      { key: 'position', label: 'Position', options: ['Administrator', 'Accountant', 'Secretary', 'Cleaner', 'Security', 'Driver', 'Cook', 'Librarian', 'ICT Staff', 'Canteen Staff', 'Other'] },
      { key: 'department', label: 'Department', dynamic: true },
    ],
    printColumns: [
      { label: 'Staff ID', get: r => r.staff_id }, { label: 'Name', get: r => r.full_name },
      { label: 'Position', get: r => r.position }, { label: 'Department', get: r => r.department },
      { label: 'Status', get: r => r.employment_status },
    ],
    fields: [
      { key: 'photo', label: 'Passport Picture', type: 'photo' },
      { key: 'full_name', label: 'Full Name', required: true },
      { key: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female'] },
      { key: 'position', label: 'Position', type: 'select', options: ['Administrator', 'Accountant', 'Secretary', 'Cleaner', 'Security', 'Driver', 'Cook', 'Librarian', 'ICT Staff', 'Canteen Staff', 'Other'] },
      { key: 'phone', label: 'Phone' }, { key: 'address', label: 'Address' },
      { key: 'employment_date', label: 'Employment Date', type: 'date' },
      { key: 'employment_status', label: 'Status', type: 'select', options: ['Active', 'On Leave', 'Suspended', 'Resigned', 'Retired'], default: 'Active' },
      { key: 'emergency_contact', label: 'Emergency Contact' },
      { key: 'salary', label: 'Monthly Salary (GHS)', type: 'number' },
    ],
  },
  classes: {
    resource: 'classes', module: 'classes', title: 'Classes', singular: 'Class',
    columns: [{ key: 'name', label: 'Class Name', render: r => `<a href="#" class="class-name-link class-details-trigger" data-id="${r.id}">${escapeHtml(r.name)}</a>` }, { key: 'code', label: 'Code' }, { key: 'level', label: 'Level' }, { key: 'class_teacher_id', label: 'Class Teacher', render: r => r.class_teacher_name || '—' }],
    fields: [
      { key: 'name', label: 'Class Name', required: true }, { key: 'code', label: 'Class Code' },
      { key: 'level', label: 'Level', type: 'select', options: ['Nursery', 'KG', 'Lower Primary', 'Upper Primary', 'JHS', 'Other'] },
      { key: 'class_teacher_id', label: 'Class Teacher', type: 'asyncselect', resource: 'teachers', labelKey: 'full_name' },
    ],
  },
  subjects: {
    resource: 'subjects', module: 'subjects', title: 'Subjects',
    columns: [{ key: 'name', label: 'Subject Name' }, { key: 'code', label: 'Code' }, { key: 'department', label: 'Department' },
      { key: 'teachers', label: 'Teachers', render: r => `<button type="button" class="btn secondary manage-subject-teachers-btn" data-id="${r.id}" data-name="${escapeHtml(r.name)}" style="padding:4px 10px;font-size:12px">👥 Manage</button>` }],
    fields: [
      { key: 'name', label: 'Subject Name', required: true }, { key: 'code', label: 'Code' },
      { key: 'department', label: 'Department' }, { key: 'description', label: 'Description', type: 'textarea', full: true },
    ],
  },
  bus: {
    resource: 'buses', module: 'bus', title: 'School Buses', singular: 'School Bus',
    columns: [{ key: 'bus_number', label: 'Bus Number' }, { key: 'driver_name', label: 'Driver' }, { key: 'route', label: 'Route' }, { key: 'status', label: 'Status', render: r => statusBadge(r.status) }],
    fields: [
      { key: 'bus_number', label: 'Bus Number', required: true }, { key: 'registration_number', label: 'Registration Number' },
      { key: 'driver_name', label: 'Driver Name' }, { key: 'route', label: 'Route' }, { key: 'capacity', label: 'Capacity', type: 'number' },
      { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Maintenance', 'Inactive'], default: 'Active' },
    ],
  },
  announcements: {
    resource: 'announcements', module: 'announcements', title: 'Announcements',
    columns: [
      { key: 'title', label: 'Title', render: r => `${escapeHtml(r.title)} ${r.attachment ? '📎' : ''}` }, { key: 'audience', label: 'Audience' }, { key: 'posted_at', label: 'Posted' },
      { key: 'attachment_col', label: 'Attachment', render: r => r.attachment ? `<div class="attachment-thumb">${attachmentHtml(r.attachment, r.attachment_name)}</div>` : '—' },
      { key: 'share', label: 'Share', render: r => `<button class="share-btn" data-id="${r.id}" title="Share to social media">🔗 Share</button>` },
    ],
    fields: [
      { key: 'title', label: 'Title', required: true },
      { key: 'audience', label: 'Audience', type: 'select', options: ['All', 'Teachers', 'Staff', 'Parents', 'Students'], default: 'All' },
      { key: 'body', label: 'Message', type: 'textarea', full: true, required: true },
      { key: 'attachment', label: 'Attach a File or Photo', type: 'attachment', full: true },
    ],
  },
};

// Opens a small share panel for one announcement — WhatsApp, X/Twitter, Facebook, and copy-to-clipboard.
// These only work once the device actually has internet access (this system itself stays fully offline).
// Lets a teacher or admin set up (or reset) a student's own login, right from the Students list —
// deliberately scoped to just this one student and always the Student role (see server-side note).
function openStudentLoginModal(student, onDone) {
  const modal = el(`<div class="modal-backdrop"><div class="modal" style="width:380px">
    <h3>Student Login — ${escapeHtml(student.first_name)} ${escapeHtml(student.last_name)}</h3>
    <div id="sl-status" class="notice" style="display:none"></div>
    <form id="student-login-form">
      <label>Username</label><input type="text" name="username" placeholder="e.g. ${escapeHtml((student.first_name + '.' + student.last_name).toLowerCase().replace(/\s+/g, ''))}" required>
      <label>Password <span class="small-text">(leave blank to keep their current password if one is already set)</span></label>
      <input type="password" name="password" placeholder="At least 4 characters" autocomplete="new-password">
      <div class="modal-actions"><button type="button" class="btn secondary" id="sl-cancel">Cancel</button><button type="submit" class="btn gold">Save</button></div>
    </form>
  </div></div>`);
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  modal.querySelector('#sl-cancel').addEventListener('click', () => modal.remove());
  modal.querySelector('#student-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const result = await api(`/students/${student.id}/create-login`, { method: 'POST', body: { username: fd.get('username'), password: fd.get('password') || undefined } });
      const status = modal.querySelector('#sl-status');
      status.style.display = 'block';
      status.textContent = result.created ? `Login created — username: ${result.username}` : result.updated ? `Password updated for username: ${result.username}` : `This student already has a login (username: ${result.username}). Enter a new password above to reset it.`;
      if (result.created || result.updated) setTimeout(() => { modal.remove(); if (onDone) onDone(); }, 1800);
    } catch (err) { alert(err.message); }
  });
}

// Same as openTeacherLoginModal, but for a Parent/Guardian — links the account via
// linked_parent_id, so once logged in they can check their own ward's results, fees, etc.
function openParentLoginModal(parent) {
  const modal = el(`<div class="modal-backdrop"><div class="modal" style="width:380px">
    <h3>Parent/Guardian Login — ${escapeHtml(parent.full_name)}</h3>
    <div id="pl-status" class="notice" style="display:none"></div>
    <form id="parent-login-form">
      <label>Username</label><input type="text" name="username" placeholder="e.g. ${escapeHtml(parent.full_name.toLowerCase().replace(/\s+/g, '.'))}" required>
      <label>Password <span class="small-text">(leave blank to keep their current password if one is already set)</span></label>
      <input type="password" name="password" placeholder="At least 4 characters" autocomplete="new-password">
      <div class="modal-actions"><button type="button" class="btn secondary" id="pl-cancel">Cancel</button><button type="submit" class="btn gold">Save</button></div>
    </form>
  </div></div>`);
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  modal.querySelector('#pl-cancel').addEventListener('click', () => modal.remove());
  modal.querySelector('#parent-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const result = await api(`/parents_guardians/${parent.id}/create-login`, { method: 'POST', body: { username: fd.get('username'), password: fd.get('password') || undefined } });
      const status = modal.querySelector('#pl-status');
      status.style.display = 'block';
      status.textContent = result.created ? `Login created — username: ${result.username}` : result.updated ? `Password updated for username: ${result.username}` : `This parent already has a login (username: ${result.username}). Enter a new password above to reset it.`;
      if (result.created || result.updated) setTimeout(() => modal.remove(), 1800);
    } catch (err) { alert(err.message); }
  });
}

// Same again, for Non-teaching Staff.
// Generates a one-time invite link a prospective teacher can be sent (WhatsApp, email, SMS —
// however the school normally reaches people) to fill in their own details and set their own
// login, rather than an admin doing it for them — the same fields as "Add Teacher," just filled
// in by the teacher themselves.
async function openTeacherInviteModal() {
  const modal = el(`<div class="modal-backdrop"><div class="modal" style="width:440px">
    <h3>✉️ Invite a Teacher</h3>
    <p class="small-text">Generates a link valid for 7 days. Send it to the teacher any way you normally would
      (WhatsApp, email, SMS) — opening it lets them fill in their own details and set their own login.</p>
    <div id="invite-link-output"></div>
    <div class="modal-actions"><button type="button" class="btn secondary" id="ti-close">Close</button></div>
  </div></div>`);
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  modal.querySelector('#ti-close').addEventListener('click', () => modal.remove());
  const output = modal.querySelector('#invite-link-output');
  output.innerHTML = '<div class="empty-state">Generating…</div>';
  try {
    const result = await api('/teacher-invites', { method: 'POST' });
    output.innerHTML = `
      <label>Registration Link</label>
      <input type="text" id="invite-link-input" value="${escapeHtml(result.register_url)}" readonly>
      <button type="button" class="btn gold" id="invite-copy-btn" style="margin-top:8px">📋 Copy Link</button>
      <p class="small-text" style="margin-top:8px">Expires ${escapeHtml(new Date(result.expires_at).toLocaleDateString())}.</p>`;
    output.querySelector('#invite-copy-btn').addEventListener('click', async () => {
      const input = output.querySelector('#invite-link-input');
      input.select();
      try { await navigator.clipboard.writeText(result.register_url); output.querySelector('#invite-copy-btn').textContent = '✓ Copied'; }
      catch (e) { document.execCommand('copy'); }
    });
  } catch (e) { output.innerHTML = `<div class="empty-state">${escapeHtml(e.message)}</div>`; }
}

function openStaffLoginModal(staffRow) {
  const modal = el(`<div class="modal-backdrop"><div class="modal" style="width:380px">
    <h3>Staff Login — ${escapeHtml(staffRow.full_name)}</h3>
    <div id="sl-status" class="notice" style="display:none"></div>
    <form id="staff-login-form">
      <label>Username</label><input type="text" name="username" placeholder="e.g. ${escapeHtml(staffRow.full_name.toLowerCase().replace(/\s+/g, '.'))}" required>
      <label>Password <span class="small-text">(leave blank to keep their current password if one is already set)</span></label>
      <input type="password" name="password" placeholder="At least 4 characters" autocomplete="new-password">
      <div class="modal-actions"><button type="button" class="btn secondary" id="sl-cancel">Cancel</button><button type="submit" class="btn gold">Save</button></div>
    </form>
  </div></div>`);
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  modal.querySelector('#sl-cancel').addEventListener('click', () => modal.remove());
  modal.querySelector('#staff-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const result = await api(`/staff/${staffRow.id}/create-login`, { method: 'POST', body: { username: fd.get('username'), password: fd.get('password') || undefined } });
      const status = modal.querySelector('#sl-status');
      status.style.display = 'block';
      status.textContent = result.created ? `Login created — username: ${result.username}` : result.updated ? `Password updated for username: ${result.username}` : `This staff member already has a login (username: ${result.username}). Enter a new password above to reset it.`;
      if (result.created || result.updated) setTimeout(() => modal.remove(), 1800);
    } catch (err) { alert(err.message); }
  });
}

// Same as openStudentLoginModal, but for teachers — links the account via linked_teacher_id.
function openTeacherLoginModal(teacher) {
  const modal = el(`<div class="modal-backdrop"><div class="modal" style="width:380px">
    <h3>Teacher Login — ${escapeHtml(teacher.full_name)}</h3>
    <div id="tl-status" class="notice" style="display:none"></div>
    <form id="teacher-login-form">
      <label>Username</label><input type="text" name="username" placeholder="e.g. ${escapeHtml(teacher.full_name.toLowerCase().replace(/\s+/g, '.'))}" required>
      <label>Password <span class="small-text">(leave blank to keep their current password if one is already set)</span></label>
      <input type="password" name="password" placeholder="At least 4 characters" autocomplete="new-password">
      <div class="modal-actions"><button type="button" class="btn secondary" id="tl-cancel">Cancel</button><button type="submit" class="btn gold">Save</button></div>
    </form>
  </div></div>`);
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  modal.querySelector('#tl-cancel').addEventListener('click', () => modal.remove());
  modal.querySelector('#teacher-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const result = await api(`/teachers/${teacher.id}/create-login`, { method: 'POST', body: { username: fd.get('username'), password: fd.get('password') || undefined } });
      const status = modal.querySelector('#tl-status');
      status.style.display = 'block';
      status.textContent = result.created ? `Login created — username: ${result.username}` : result.updated ? `Password updated for username: ${result.username}` : `This teacher already has a login (username: ${result.username}). Enter a new password above to reset it.`;
      if (result.created || result.updated) setTimeout(() => modal.remove(), 1800);
    } catch (err) { alert(err.message); }
  });
}

// Assigns a task/duty to ONE specific student — for when a teacher wants to give an individual
// student something to do without setting up a whole Class Group for just one person.
function openAssignTaskModal(student) {
  const modal = el(`<div class="modal-backdrop"><div class="modal" style="width:420px">
    <h3>Assign Task — ${escapeHtml(student.first_name)} ${escapeHtml(student.last_name)}</h3>
    <form id="assign-task-form">
      <label>Task Title *</label><input type="text" name="title" required>
      <label>Description</label><textarea name="description" rows="3"></textarea>
      <div class="form-grid">
        <div><label>Frequency</label><select name="frequency"><option>One-time</option><option>Daily</option><option>Weekly</option><option>Monthly</option></select></div>
        <div><label>Due Date</label><input type="date" name="due_date"></div>
      </div>
      <div class="modal-actions"><button type="button" class="btn secondary" id="at-cancel">Cancel</button><button type="submit" class="btn gold">Assign</button></div>
    </form>
  </div></div>`);
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  modal.querySelector('#at-cancel').addEventListener('click', () => modal.remove());
  modal.querySelector('#assign-task-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api('/student_tasks', { method: 'POST', body: { student_id: student.id, title: fd.get('title'), description: fd.get('description'), frequency: fd.get('frequency'), due_date: fd.get('due_date') || null } });
      modal.remove();
      alert(`Task assigned to ${student.first_name} ${student.last_name}.`);
    } catch (err) { alert(err.message); }
  });
}

// Manages a class's subject teachers — a many-to-many list distinct from the single "class
// teacher" (homeroom) already on the class record. A teacher can be a subject teacher for
// several classes; a class can have several subject teachers.
async function openSubjectTeachersModal(cls) {
  const modal = el(`<div class="modal-backdrop"><div class="modal" style="width:440px">
    <h3>Subject Teachers — ${escapeHtml(cls.name)}</h3>
    <p class="small-text">Distinct from the Class Teacher set on the class's Edit form — a subject teacher just teaches one or more subjects in this class.</p>
    <div id="st-current" class="empty-state">Loading…</div>
    <div class="toolbar" style="margin-top:12px"><select id="st-add-select"><option value="">Add a teacher…</option></select><button class="btn secondary" id="st-add-btn">Add</button></div>
    <div class="modal-actions"><button type="button" class="btn secondary" id="st-close">Close</button></div>
  </div></div>`);
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  modal.querySelector('#st-close').addEventListener('click', () => modal.remove());

  const allTeachers = (await api('/teachers?pageSize=500')).rows;
  const select = modal.querySelector('#st-add-select');
  select.innerHTML += allTeachers.map(t => `<option value="${t.id}">${escapeHtml(t.full_name)}</option>`).join('');

  async function refresh() {
    const current = await api(`/classes/${cls.id}/subject-teachers`);
    modal.querySelector('#st-current').outerHTML = `<div id="st-current">${current.length ? current.map(t => `
      <div class="attachment-pending" style="justify-content:space-between"><span>${escapeHtml(t.full_name)}</span><button type="button" class="st-remove-btn" data-tid="${t.id}">✕</button></div>
    `).join('') : '<p class="muted">No subject teachers assigned yet.</p>'}</div>`;
    modal.querySelectorAll('.st-remove-btn').forEach(btn => btn.addEventListener('click', async () => {
      await api(`/classes/${cls.id}/subject-teachers/${btn.dataset.tid}`, { method: 'DELETE' });
      refresh();
    }));
  }
  await refresh();

  modal.querySelector('#st-add-btn').addEventListener('click', async () => {
    if (!select.value) return;
    await api(`/classes/${cls.id}/subject-teachers`, { method: 'POST', body: { teacher_id: Number(select.value) } });
    select.value = '';
    refresh();
  });
}

function openCameraCaptureModal(onCapture) {
  const modal = el(`<div class="modal-backdrop"><div class="modal" style="width:420px;text-align:center">
    <h3>Take a Photo</h3>
    <div id="camera-status" class="small-text" style="margin-bottom:8px">Starting camera…</div>
    <video id="camera-video" autoplay playsinline style="width:100%;border-radius:10px;background:#000;display:none"></video>
    <canvas id="camera-canvas" style="display:none"></canvas>
    <div class="modal-actions" style="justify-content:center;margin-top:14px">
      <button type="button" class="btn secondary" id="camera-cancel">Cancel</button>
      <button type="button" class="btn gold" id="camera-shoot" disabled>📷 Capture</button>
    </div>
  </div></div>`);
  document.body.appendChild(modal);
  let stream = null;
  function stopStream() { if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; } }
  function closeModal() { stopStream(); modal.remove(); }
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  modal.querySelector('#camera-cancel').addEventListener('click', closeModal);

  const video = modal.querySelector('#camera-video');
  const statusEl = modal.querySelector('#camera-status');
  const shootBtn = modal.querySelector('#camera-shoot');

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    statusEl.textContent = "This browser doesn't support camera access — use the file upload option instead.";
    return;
  }
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
    .then(s => {
      stream = s;
      video.srcObject = s;
      video.style.display = 'block';
      statusEl.textContent = 'Position the face in frame, then capture.';
      shootBtn.disabled = false;
    })
    .catch(err => {
      statusEl.textContent = `Couldn't access the camera (${err.name === 'NotAllowedError' ? 'permission denied' : err.message}). Use the file upload option instead.`;
    });

  shootBtn.addEventListener('click', () => {
    const canvas = modal.querySelector('#camera-canvas');
    const targetW = 400, targetH = 480;
    canvas.width = targetW; canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    // Crop the live video to the target aspect ratio (cover-fit) before drawing, so captured
    // photos come out framed the same passport-style way as resized file uploads.
    const vw = video.videoWidth, vh = video.videoHeight;
    const targetRatio = targetW / targetH, srcRatio = vw / vh;
    let sx, sy, sw, sh;
    if (srcRatio > targetRatio) { sh = vh; sw = vh * targetRatio; sx = (vw - sw) / 2; sy = 0; }
    else { sw = vw; sh = vw / targetRatio; sx = 0; sy = (vh - sh) / 2; }
    ctx.translate(targetW, 0); ctx.scale(-1, 1); // mirror, so the capture matches what the user saw in preview
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, targetW, targetH);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    onCapture(dataUrl);
    closeModal();
  });
}

function openShareModal(title, body) {
  const text = `${title}\n\n${body}`;
  const encoded = encodeURIComponent(text);
  const modal = el(`<div class="modal-backdrop"><div class="modal" style="width:360px">
    <h3>Share Announcement</h3>
    <p class="small-text">Requires an internet connection. Opens the app or website to let you post it from there.</p>
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:14px">
      <a class="btn secondary" href="https://wa.me/?text=${encoded}" target="_blank" rel="noopener">💬 Share to WhatsApp</a>
      <a class="btn secondary" href="https://twitter.com/intent/tweet?text=${encoded}" target="_blank" rel="noopener">🐦 Share to X (Twitter)</a>
      <a class="btn secondary" href="https://www.facebook.com/sharer/sharer.php?u=&quote=${encoded}" target="_blank" rel="noopener">📘 Share to Facebook</a>
      <button class="btn secondary" id="copy-share-text">📋 Copy Text</button>
    </div>
    <div class="modal-actions"><button type="button" class="btn secondary" id="close-share-modal">Close</button></div>
  </div></div>`);
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  modal.querySelector('#close-share-modal').addEventListener('click', () => modal.remove());
  modal.querySelector('#copy-share-text').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(text); alert('Copied to clipboard.'); }
    catch (e) { alert('Could not copy automatically — please select and copy the text manually.'); }
  });
}

function statusBadge(status) {
  const cls = ['Active', 'Alive', 'Present'].includes(status) ? 'green'
    : ['Inactive', 'Deceased', 'Absent', 'Suspended', 'Withdrawn'].includes(status) ? 'red'
    : ['Late', 'On Leave', 'Excused'].includes(status) ? 'amber' : 'gray';
  return `<span class="badge ${cls}">${escapeHtml(status || '—')}</span>`;
}
function photoThumb(filename) {
  return filename
    ? `<img src="/uploads/${encodeURIComponent(filename)}" class="thumb" alt="">`
    : `<div class="thumb placeholder">${silhouetteSvg()}</div>`;
}
function silhouetteSvg() {
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>`;
}

// Full-page detail view for one student — reached by clicking their name/View in the Students
// list. Shows their whole profile, sponsor info if relevant, linked parent(s), and (for staff
// viewing it — never for the student themselves) their login username and account status.

// A clear, professional summary after a Class List CSV import — shown as a proper modal (not a
// text line that gets wiped out the instant the list underneath refreshes), listing anything
// that needs the admin's attention by row number so a spreadsheet mistake is actually fixable.
// Opens the Class List CSV import/export flow as a popup — a modal rather than a permanent
// on-page card, since bulk name import is an occasional admin task, not a daily one.
function openCsvImportModal(cfg, extraQuery) {
  const modal = el(`<div class="modal-backdrop"><div class="modal" style="width:560px">
    <h3 style="margin-top:0;color:var(--navy)">📋 Class List — Excel/CSV</h3>
    <p class="small-text">Download a class's current student names to edit and re-upload, or start from a blank
      template to add brand-new students. Either way: leave <b>Student ID</b> blank for a new student, or fill it in
      to update an existing one's name. Edit in Excel or Google Sheets, then save/export as <b>.csv</b> before
      uploading it back here.</p>
    <div id="csv-modal-body"><div class="empty-state">Loading classes…</div></div>
    <div class="modal-actions"><button type="button" class="btn secondary" id="csv-modal-close">Close</button></div>
  </div></div>`);
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  modal.querySelector('#csv-modal-close').addEventListener('click', () => modal.remove());
  (async () => {
    const classes = await api('/classes?pageSize=200');
    const body = modal.querySelector('#csv-modal-body');
    body.innerHTML = `
      <div class="csv-steps">
        <div class="csv-step-card">
          <div class="csv-step-badge">1</div>
          <div class="csv-step-title">Choose a Class</div>
          <select id="csv-class"><option value="">Select a class…</option>${classes.rows.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select>
        </div>
        <div class="csv-step-arrow">→</div>
        <div class="csv-step-card">
          <div class="csv-step-badge">2</div>
          <div class="csv-step-title">Download</div>
          <button class="btn secondary" id="csv-export-btn" style="width:100%">⬇ Current Names</button>
          <a class="btn secondary" style="text-decoration:none;display:block;text-align:center;margin-top:8px" href="/api/students/csv-template" id="csv-template-btn">⬇ Blank Template</a>
        </div>
        <div class="csv-step-arrow">→</div>
        <div class="csv-step-card">
          <div class="csv-step-badge">3</div>
          <div class="csv-step-title">Upload &amp; Import</div>
          <label class="csv-dropzone" id="csv-dropzone" for="csv-import-input">
            <span id="csv-dropzone-text">📄 Click to choose a .csv file</span>
          </label>
          <input type="file" id="csv-import-input" accept=".csv" style="display:none">
          <button class="btn gold" id="csv-import-btn" style="width:100%;margin-top:8px">⬆ Upload &amp; Import</button>
        </div>
      </div>`;
    body.querySelector('#csv-import-input').addEventListener('change', (e) => {
      const f = e.target.files[0];
      body.querySelector('#csv-dropzone-text').textContent = f ? `✓ ${f.name}` : '📄 Click to choose a .csv file';
      body.querySelector('#csv-dropzone').classList.toggle('has-file', !!f);
    });
    body.querySelector('#csv-export-btn').addEventListener('click', () => {
      const classId = body.querySelector('#csv-class').value;
      if (!classId) return alert('Select a class first.');
      window.open(`/api/students/export-csv?class_id=${classId}`, '_blank');
    });
    body.querySelector('#csv-import-btn').addEventListener('click', async () => {
      const classId = body.querySelector('#csv-class').value;
      const file = body.querySelector('#csv-import-input').files[0];
      if (!classId) return alert('Select a class first.');
      if (!file) return alert('Choose a CSV file to upload.');
      const btn = body.querySelector('#csv-import-btn');
      btn.disabled = true; btn.textContent = 'Uploading…';
      // Excel on Windows very commonly saves "CSV" as Windows-1252 (aka "ANSI"), not UTF-8,
      // unless the person specifically picks "CSV UTF-8" from the Save As dropdown — which
      // most people never do. Reading it as plain UTF-8 (file.text()'s default) silently
      // corrupts any accented name into replacement characters. Detect this instead: try a
      // strict UTF-8 decode first, and only fall back to Windows-1252 if that actually fails.
      const bytes = new Uint8Array(await file.arrayBuffer());
      let csvText;
      try { csvText = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
      catch (e) { csvText = new TextDecoder('windows-1252').decode(bytes); }
      try {
        const result = await api('/students/import-csv', { method: 'POST', body: { class_id: Number(classId), csv_text: csvText } });
        modal.remove();
        showCsvImportSummary(result);
        renderResourceList(cfg, extraQuery);
      } catch (e) {
        alert(e.message);
        btn.disabled = false; btn.textContent = '⬆ Upload & Import';
      }
    });
  })();
}

function showCsvImportSummary(result) {
  const hasIssues = result.issues && result.issues.length > 0;
  const modal = el(`<div class="modal-backdrop"><div class="modal" style="width:480px">
    <h3>${hasIssues ? '⚠️' : '✅'} Import Complete</h3>
    <div class="csv-summary-stats">
      <div class="csv-summary-stat"><b>${result.created}</b><span>Added</span></div>
      <div class="csv-summary-stat"><b>${result.updated}</b><span>Updated</span></div>
      <div class="csv-summary-stat ${result.skipped ? 'warn' : ''}"><b>${result.skipped}</b><span>Skipped</span></div>
    </div>
    ${hasIssues ? `
      <p class="small-text" style="margin-top:14px"><b>Rows that need a look:</b></p>
      <div class="csv-issues-list">${result.issues.map(iss => `<div class="csv-issue-row">Row ${iss.row}: ${escapeHtml(iss.reason)}</div>`).join('')}</div>
    ` : `<p class="small-text" style="margin-top:14px">Everything imported cleanly — no issues found.</p>`}
    <div class="modal-actions"><button type="button" class="btn gold" id="csv-summary-close">Done</button></div>
  </div></div>`);
  document.body.appendChild(modal);
  modal.querySelector('#csv-summary-close').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

async function renderResourceList(cfg, extraQuery = '') {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="empty-state">Loading…</div>';
  const activeFilters = {};
  const data = await api(`/${cfg.resource}?pageSize=200${extraQuery}`);
  const rows = data.rows;
  content.innerHTML = '';
  const header = el(`<div class="page-header"><h2>${cfg.title}</h2>
    <div style="display:flex;gap:8px">
    ${cfg.printFilters ? `<button class="btn secondary" id="print-list-btn">🖶 Print List</button>` : ''}
    ${cfg.resource === 'teachers' && can('teachers', 'add') ? `<button class="btn secondary" id="invite-teacher-btn">✉️ Invite a Teacher</button>` : ''}
    ${can(cfg.module, 'add') ? `<button class="btn gold" id="add-btn">+ Add ${cfg.singular || cfg.title.replace(/s$/, '')}</button>` : ''}
    </div></div>`);
  content.appendChild(header);
  header.querySelector('#invite-teacher-btn')?.addEventListener('click', openTeacherInviteModal);
  if (cfg.searchable) {
    const toolbar = el(`<div class="toolbar"><input type="search" id="search-box" placeholder="Search ${cfg.title.toLowerCase()}…"></div>`);
    content.appendChild(toolbar);
    toolbar.querySelector('#search-box').addEventListener('input', debounce(async (e) => {
      const d = await api(`/${cfg.resource}?q=${encodeURIComponent(e.target.value)}&pageSize=200${extraQuery}${filterQueryString()}`);
      renderTableBody(d.rows);
    }, 300));
  }
  // Excel-compatible CSV export/import of a class's student names (Students page only) — a
  // button that opens a popup, rather than a big always-visible card eating into the page,
  // since this is an occasional bulk-admin task, not something used on every visit.
  if (cfg.resource === 'students') {
    const csvBtnRow = el(`<div style="margin-bottom:16px"><button class="btn secondary" id="open-csv-import-btn">📋 Class List — Excel/CSV Import</button></div>`);
    content.appendChild(csvBtnRow);
    csvBtnRow.querySelector('#open-csv-import-btn').addEventListener('click', () => openCsvImportModal(cfg, extraQuery));
  }
  // Filter dropdowns (used for narrowing the on-screen list AND for the printable list).
  let filtersToolbar = null;
  if (cfg.printFilters) {
    filtersToolbar = el(`<div class="toolbar" id="filters-toolbar"></div>`);
    content.appendChild(filtersToolbar);
    for (const f of cfg.printFilters) {
      if (f.async) {
        const opts = (await api(`/${f.async}?pageSize=200`)).rows;
        filtersToolbar.appendChild(el(`<select data-filter-key="${f.key}"><option value="">${f.label}: All</option>${opts.map(o => `<option value="${o.id}">${escapeHtml(o.name)}</option>`).join('')}</select>`));
      } else if (f.dynamic) {
        // Builds its options from whatever values already exist in this list, rather than a fixed list —
        // useful for free-text fields like "Department" where every school uses different names.
        const values = [...new Set(rows.map(r => r[f.key]).filter(Boolean))].sort();
        filtersToolbar.appendChild(el(`<select data-filter-key="${f.key}"><option value="">${f.label}: All</option>${values.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('')}</select>`));
      } else if (f.options) {
        const optHtml = f.options.map(o => Array.isArray(o) ? `<option value="${o[0]}">${o[1]}</option>` : `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join('');
        filtersToolbar.appendChild(el(`<select data-filter-key="${f.key}"><option value="">${f.label}: All</option>${optHtml}</select>`));
      } else {
        filtersToolbar.appendChild(el(`<input type="text" data-filter-key="${f.key}" placeholder="${f.label}">`));
      }
    }
    filtersToolbar.appendChild(el(`<button class="btn secondary" id="apply-filters-btn">Apply Filters</button>`));
    filtersToolbar.appendChild(el(`<button class="btn secondary" id="clear-filters-btn">Clear</button>`));
  }
  const tableWrap = el('<div class="table-wrap"></div>');
  content.appendChild(tableWrap);
  renderTableBody(rows);

  function filterQueryString() {
    return Object.entries(activeFilters).filter(([, v]) => v).map(([k, v]) => `&${k}=${encodeURIComponent(v)}`).join('');
  }
  async function applyFilters() {
    filtersToolbar.querySelectorAll('[data-filter-key]').forEach(el2 => { activeFilters[el2.dataset.filterKey] = el2.value; });
    const d = await api(`/${cfg.resource}?pageSize=500${extraQuery}${filterQueryString()}`);
    renderTableBody(d.rows);
  }
  filtersToolbar?.querySelector('#apply-filters-btn').addEventListener('click', applyFilters);
  filtersToolbar?.querySelector('#clear-filters-btn').addEventListener('click', () => {
    filtersToolbar.querySelectorAll('[data-filter-key]').forEach(el2 => { el2.value = ''; activeFilters[el2.dataset.filterKey] = ''; });
    renderTableBody(rows);
  });
  header.querySelector('#print-list-btn')?.addEventListener('click', async () => {
    const d = await api(`/${cfg.resource}?pageSize=1000${extraQuery}${filterQueryString()}`);
    await printResourceList(cfg, d.rows, activeFilters);
  });

  function renderTableBody(rows) {
    if (!rows.length) { tableWrap.innerHTML = '<div class="empty-state">No records yet.</div>'; return; }
    tableWrap.innerHTML = `<table><thead><tr>${cfg.columns.map(c => `<th>${c.label}</th>`).join('')}<th></th></tr></thead>
      <tbody>${rows.map(r => `<tr data-id="${r.id}">
        ${cfg.columns.map(c => `<td>${cfg.linkTo ? '' : ''}${c.render ? c.render(r) : escapeHtml(r[c.key])}</td>`).join('')}
        <td class="row-actions">
          ${cfg.linkTo ? `<button class="view-btn">View</button>` : ''}
          ${can(cfg.module, 'edit') ? `<button class="edit-btn">Edit</button>` : ''}
          ${cfg.resource === 'students' ? `<button class="login-btn">Login</button>` : ''}
          ${cfg.resource === 'students' && can('class_groups', 'add') ? `<button class="assign-task-btn">Assign Task</button>` : ''}
          ${cfg.resource === 'teachers' && can('teachers', 'edit') ? `<button class="teacher-login-btn">Login</button>` : ''}
          ${cfg.resource === 'staff' && can('staff', 'edit') ? `<button class="staff-login-btn">Login</button>` : ''}
          ${cfg.resource === 'parents_guardians' && can('parents', 'edit') ? `<button class="parent-login-btn">Login</button>` : ''}
          ${cfg.resource === 'classes' && can('classes', 'view') ? `<button class="subject-teachers-btn">Subject Teachers</button>` : ''}
          ${can(cfg.module, 'delete') ? `<button class="del-btn">Delete</button>` : ''}
        </td></tr>`).join('')}</tbody></table>`;
    tableWrap.querySelectorAll('tr[data-id]').forEach(tr => {
      const id = Number(tr.dataset.id);
      const row = rows.find(r => r.id === id);
      tr.querySelector('.view-btn')?.addEventListener('click', () => location.hash = cfg.linkTo(row));
      tr.querySelector('.edit-btn')?.addEventListener('click', () => openForm(cfg, row));
      tr.querySelector('.login-btn')?.addEventListener('click', () => openStudentLoginModal(row));
      tr.querySelector('.assign-task-btn')?.addEventListener('click', () => openAssignTaskModal(row));
      tr.querySelector('.teacher-login-btn')?.addEventListener('click', () => openTeacherLoginModal(row));
      tr.querySelector('.staff-login-btn')?.addEventListener('click', () => openStaffLoginModal(row));
      tr.querySelector('.parent-login-btn')?.addEventListener('click', () => openParentLoginModal(row));
      tr.querySelector('.subject-teachers-btn')?.addEventListener('click', () => openSubjectTeachersModal(row));
      tr.querySelector('.del-btn')?.addEventListener('click', async () => {
        if (!confirm('Delete this record? This cannot be undone.')) return;
        await api(`/${cfg.resource}/${id}`, { method: 'DELETE' });
        renderResourceList(cfg, extraQuery);
      });
      tr.querySelector('.share-btn')?.addEventListener('click', () => openShareModal(row.title, row.body));
    });
  }
  header.querySelector('#add-btn')?.addEventListener('click', () => openForm(cfg, null));
}

// Renders a clean, branded, printable list for any resource that defines printColumns —
// used by the Students/Parents/Teachers/Staff "Print List" buttons.
async function printResourceList(cfg, rows, filters) {
  const [settings, classes] = await Promise.all([api('/settings'), api('/classes?pageSize=200')]);
  const classesById = {}; classes.rows.forEach(c => classesById[c.id] = c.name);
  const ctx = { classesById };
  const logoUrl = settings.logo_photo ? `/uploads/${encodeURIComponent(settings.logo_photo)}` : '/assets/logo.png';
  const activeFilterText = Object.entries(filters || {}).filter(([, v]) => v).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join(', ') || 'None';
  const content = document.getElementById('content');
  const wrap = el(`<div>
    <div class="report-card">
      <div class="rc-header">
        <img class="rc-logo" src="${logoUrl}" alt="School logo">
        <div class="rc-header-text">
          <h1>${escapeHtml(settings.school_name || 'Nibras Educational Complex')}</h1>
          <p class="rc-motto">"${escapeHtml(settings.motto || 'Knowledge is Light')}"</p>
        </div>
      </div>
      <div class="rc-title-band">${cfg.title.toUpperCase()} LIST</div>
      <p class="small-text" style="margin-top:10px">Filters applied: ${escapeHtml(activeFilterText)} &nbsp;·&nbsp; ${rows.length} record(s) &nbsp;·&nbsp; Generated ${new Date().toLocaleDateString()}</p>
      <table class="rc-table" style="margin-top:10px"><thead><tr>${cfg.printColumns.map(c => `<th>${c.label}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr>${cfg.printColumns.map(c => `<td class="rc-subject">${escapeHtml(c.get(r, ctx))}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${cfg.printColumns.length}" class="muted" style="text-align:center;padding:20px">No matching records.</td></tr>`}</tbody>
      </table>
    </div>
    <div class="no-print" style="margin-top:14px">
      <button class="btn secondary" id="back-to-list-btn">&larr; Back</button>
      <button class="btn gold" onclick="window.print()">Print</button>
    </div>
  </div>`);
  content.innerHTML = '';
  content.appendChild(wrap);
  wrap.querySelector('#back-to-list-btn').addEventListener('click', () => renderResourceList(cfg));
}

function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

async function openForm(cfg, existing) {
  const isEdit = !!existing;
  const asyncOptionsCache = {};
  for (const f of cfg.fields) {
    if (f.type === 'asyncselect') {
      const d = await api(`/${f.resource}?pageSize=500`);
      asyncOptionsCache[f.key] = d.rows;
    }
  }
  // Parent picker needs the full parent list (to search/link existing ones) and, when editing,
  // the student's currently-linked parents (which the table row itself doesn't include).
  let allParents = null, linkedParents = [];
  const hasParentPicker = cfg.fields.some(f => f.type === 'parent_picker');
  if (hasParentPicker) {
    allParents = (await api('/parents_guardians?pageSize=1000')).rows;
    if (isEdit) {
      const full = await api(`/students/${existing.id}`);
      linkedParents = full.parents || [];
    }
  }
  let pendingPhotoDataUrl = null; // set only if the user picks a new photo
  const fieldHtml = cfg.fields.map(f => {
    const val = existing ? existing[f.key] : (f.default ?? '');
    if (f.type === 'select') {
      return `<div class="${f.full ? 'full' : ''}"><label>${f.label}${f.required ? ' *' : ''}</label>
        <select name="${f.key}">${f.options.map(o => `<option value="${o}" ${val === o ? 'selected' : ''}>${o}</option>`).join('')}</select></div>`;
    }
    if (f.type === 'asyncselect') {
      const opts = asyncOptionsCache[f.key];
      return `<div class="${f.full ? 'full' : ''}"><label>${f.label}</label>
        <select name="${f.key}"><option value="">— None —</option>${opts.map(o => `<option value="${o.id}" ${val == o.id ? 'selected' : ''}>${escapeHtml(o[f.labelKey])}</option>`).join('')}</select></div>`;
    }
    if (f.type === 'textarea') {
      return `<div class="${f.full ? 'full' : ''}"><label>${f.label}${f.required ? ' *' : ''}</label><textarea name="${f.key}" rows="3">${escapeHtml(val)}</textarea></div>`;
    }
    if (f.type === 'checkbox') {
      return `<div class="checkbox-row full"><input type="checkbox" name="${f.key}" ${val ? 'checked' : ''}><label style="margin:0">${f.label}</label></div>`;
    }
    if (f.type === 'photo') {
      const existingUrl = existing && existing.photo ? `/uploads/${encodeURIComponent(existing.photo)}` : '';
      return `<div class="full photo-field">
        <label>${f.label}</label>
        <div class="photo-upload-row">
          <div class="photo-preview-box" id="photo-preview-${f.key}">${existingUrl ? `<img src="${existingUrl}" alt="">` : silhouetteSvg()}</div>
          <div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
              <input type="file" accept="image/*" class="photo-input" data-key="${f.key}">
              <button type="button" class="btn secondary camera-capture-btn" data-key="${f.key}" style="padding:7px 12px;font-size:12.5px">📷 Take Photo</button>
            </div>
            <p class="small-text" style="margin:6px 0 0">JPG, PNG or WEBP, or use a webcam. Will be resized automatically — a clear, front-facing photo works best.</p>
          </div>
        </div>
      </div>`;
    }
    if (f.type === 'attachment') {
      const existingName = existing && existing.attachment_name ? existing.attachment_name : (existing && existing.attachment ? existing.attachment : '');
      return `<div class="full">
        <label>${f.label}</label>
        <div class="toolbar">
          <input type="file" class="attachment-input" data-key="${f.key}">
          <button type="button" class="btn secondary attachment-camera-btn" data-key="${f.key}" style="padding:7px 12px;font-size:12.5px">📷 Take Photo</button>
        </div>
        <div id="attachment-preview-${f.key}" class="small-text" style="margin-top:6px">${existingName ? `Current: ${escapeHtml(existingName)}` : ''}</div>
      </div>`;
    }
    if (f.type === 'parent_picker') {
      return `<div class="full parent-picker" id="parent-picker-block">
        <label>${f.label}</label>
        <div id="linked-parents-list" class="linked-parents-list"></div>
        <div class="toolbar" style="margin:8px 0 4px">
          <input type="text" id="parent-search-input" placeholder="Search existing parents by name or phone…" style="max-width:280px">
          <button type="button" class="btn secondary" id="add-new-parent-toggle" style="padding:7px 12px;font-size:12.5px">+ Add New Parent</button>
        </div>
        <div id="parent-search-results" class="parent-search-results"></div>
        <div id="new-parent-fields" class="hidden card" style="padding:14px;margin-top:8px">
          <div class="form-grid">
            <div><label>Full Name</label><input type="text" id="np-full-name"></div>
            <div><label>Relationship</label>
              <select id="np-relationship"><option>Father</option><option>Mother</option><option>Guardian</option><option>Other</option></select></div>
            <div><label>Phone</label><input type="text" id="np-phone"></div>
            <div><label>Email</label><input type="email" id="np-email"></div>
          </div>
          <div class="checkbox-row"><input type="checkbox" id="np-pta"><label style="margin:0">Member of the PTA</label></div>
          <div class="modal-actions" style="justify-content:flex-start;margin-top:10px">
            <button type="button" class="btn gold" id="confirm-add-new-parent" style="padding:7px 14px;font-size:12.5px">Add This Parent</button>
          </div>
        </div>
      </div>`;
    }
    return `<div class="${f.full ? 'full' : ''}"><label>${f.label}${f.required ? ' *' : ''}</label>
      <input type="${f.type || 'text'}" name="${f.key}" value="${escapeHtml(val)}"></div>`;
  }).map((html, i) => {
    const f = cfg.fields[i];
    // Fields with showIf are wrapped so their visibility can be toggled live as other fields
    // change (e.g. sponsor details only make sense once a student is marked an orphan AND on
    // some form of scholarship) — the wrapper itself carries the grid span so layout still works.
    return f.showIf ? `<div class="conditional-field ${f.full ? 'full' : ''}" data-key="${f.key}">${html}</div>` : html;
  }).join('');
  const idInfoHtml = cfg.autoIdInfo ? `<div class="notice" id="auto-id-notice">${cfg.autoIdInfo(existing)}</div>` : '';
  const modal = el(`<div class="modal-backdrop"><div class="modal">
    <h3>${isEdit ? 'Edit' : 'Add'} ${cfg.singular || cfg.title.replace(/s$/, '')}</h3>
    ${idInfoHtml}
    <form id="resource-form"><div class="form-grid">${fieldHtml}</div>
      <div class="modal-actions"><button type="button" class="btn secondary" id="cancel-btn">Cancel</button>
        <button type="submit" class="btn gold">Save</button></div></form>
  </div></div>`);
  // The notice above is built from whatever prefix was set the last time this JS file loaded its
  // defaults; refresh it with the school's actual current ID-format settings before showing the modal.
  if (cfg.autoIdInfo && !existing) {
    api('/settings').then(s => {
      const noticeEl = document.getElementById('auto-id-notice');
      if (!noticeEl) return;
      const year = new Date().getFullYear();
      const digits = s.id_seq_digits || 3;
      const example = String(1).padStart(digits, '0');
      if (cfg.resource === 'students') {
        noticeEl.innerHTML = `Student ID and Admission Number will be generated automatically in the format <b>${escapeHtml(s.student_id_prefix || 'NIB')}/${year}/${example}</b> when you save.`;
      } else {
        noticeEl.innerHTML = `Staff ID will be generated automatically in the format <b>${escapeHtml(s.staff_id_prefix || 'ST')}/${year}/${example}</b> when you save.`;
      }
    }).catch(() => {});
  }
  document.body.appendChild(modal);
  modal.querySelector('#cancel-btn').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  // ---- Conditional fields (e.g. sponsor details only shown once relevant) ----
  const conditionalFields = cfg.fields.filter(f => f.showIf);
  if (conditionalFields.length) {
    const formEl = modal.querySelector('#resource-form');
    const updateConditionalFields = () => {
      const values = {};
      cfg.fields.forEach(f => {
        const input = formEl.querySelector(`[name="${f.key}"]`);
        if (!input) return;
        values[f.key] = f.type === 'checkbox' ? input.checked : input.value;
      });
      conditionalFields.forEach(f => {
        const wrapper = formEl.querySelector(`.conditional-field[data-key="${f.key}"]`);
        if (wrapper) wrapper.style.display = f.showIf(values) ? '' : 'none';
      });
    };
    formEl.addEventListener('change', updateConditionalFields);
    formEl.addEventListener('input', updateConditionalFields);
    updateConditionalFields();
  }

  // ---- Parent picker interactivity ----
  let linkedParentIds = linkedParents.map(p => p.id);
  const pendingNewParents = []; // parents to be created at save time: { full_name, relationship, phone, email, pta_member }
  const parentById = {}; if (allParents) allParents.forEach(p => parentById[p.id] = p);

  function renderLinkedParentsList() {
    const list = document.getElementById('linked-parents-list');
    if (!list) return;
    const existingChips = linkedParentIds.map(id => {
      const p = parentById[id];
      return `<div class="linked-parent-chip" data-kind="existing" data-id="${id}">
        <span>${escapeHtml(p ? p.full_name : 'Parent #' + id)}${p ? ` <span class="small-text">(${escapeHtml(p.relationship)}${p.phone ? ' · ' + escapeHtml(p.phone) : ''})</span>` : ''}</span>
        <button type="button" class="chip-remove" data-kind="existing" data-id="${id}">×</button></div>`;
    }).join('');
    const newChips = pendingNewParents.map((p, idx) => `<div class="linked-parent-chip linked-parent-chip-new" data-kind="new" data-idx="${idx}">
        <span>${escapeHtml(p.full_name)} <span class="small-text">(${escapeHtml(p.relationship)}${p.phone ? ' · ' + escapeHtml(p.phone) : ''}) — new</span></span>
        <button type="button" class="chip-remove" data-kind="new" data-idx="${idx}">×</button></div>`).join('');
    list.innerHTML = existingChips + newChips || '<p class="small-text muted">No parents/guardians linked yet.</p>';
    list.querySelectorAll('.chip-remove').forEach(btn => btn.addEventListener('click', () => {
      if (btn.dataset.kind === 'existing') linkedParentIds = linkedParentIds.filter(id => id !== Number(btn.dataset.id));
      else pendingNewParents.splice(Number(btn.dataset.idx), 1);
      renderLinkedParentsList();
    }));
  }

  if (hasParentPicker) {
    renderLinkedParentsList();
    const searchInput = document.getElementById('parent-search-input');
    const resultsBox = document.getElementById('parent-search-results');
    searchInput.addEventListener('input', debounce(() => {
      const q = searchInput.value.trim().toLowerCase();
      if (!q) { resultsBox.innerHTML = ''; return; }
      const matches = allParents.filter(p => !linkedParentIds.includes(p.id) &&
        (`${p.full_name} ${p.phone || ''}`.toLowerCase().includes(q))).slice(0, 8);
      resultsBox.innerHTML = matches.map(p => `<div class="parent-search-result" data-id="${p.id}">
        ${escapeHtml(p.full_name)} <span class="small-text">(${escapeHtml(p.relationship)}${p.phone ? ' · ' + escapeHtml(p.phone) : ''})</span></div>`).join('')
        || '<p class="small-text muted">No matching parent found — use "+ Add New Parent" below.</p>';
      resultsBox.querySelectorAll('.parent-search-result').forEach(row => row.addEventListener('click', () => {
        linkedParentIds.push(Number(row.dataset.id));
        searchInput.value = ''; resultsBox.innerHTML = '';
        renderLinkedParentsList();
      }));
    }, 200));
    document.getElementById('add-new-parent-toggle').addEventListener('click', () => {
      document.getElementById('new-parent-fields').classList.toggle('hidden');
    });
    document.getElementById('confirm-add-new-parent').addEventListener('click', () => {
      const fullName = document.getElementById('np-full-name').value.trim();
      if (!fullName) return alert('Enter the parent/guardian\'s full name.');
      pendingNewParents.push({
        full_name: fullName,
        relationship: document.getElementById('np-relationship').value,
        phone: document.getElementById('np-phone').value.trim() || null,
        email: document.getElementById('np-email').value.trim() || null,
        pta_member: document.getElementById('np-pta').checked ? 1 : 0,
      });
      ['np-full-name', 'np-phone', 'np-email'].forEach(id => document.getElementById(id).value = '');
      document.getElementById('np-pta').checked = false;
      document.getElementById('new-parent-fields').classList.add('hidden');
      renderLinkedParentsList();
    });
  }

  // Wire up photo inputs: read file, downscale to a passport-style size, preview, and hold the data URL for submit.
  const photoDataUrls = {};
  modal.querySelectorAll('.photo-input').forEach(input => {
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        const dataUrl = await resizeImageToDataUrl(file, 400, 480);
        photoDataUrls[input.dataset.key] = dataUrl;
        const box = document.getElementById('photo-preview-' + input.dataset.key);
        box.innerHTML = `<img src="${dataUrl}" alt="">`;
      } catch (e) { alert('Could not read that image. Please try a different file.'); }
    });
  });
  modal.querySelectorAll('.camera-capture-btn').forEach(btn => {
    btn.addEventListener('click', () => openCameraCaptureModal(async (dataUrl) => {
      photoDataUrls[btn.dataset.key] = dataUrl;
      document.getElementById('photo-preview-' + btn.dataset.key).innerHTML = `<img src="${dataUrl}" alt="">`;
    }));
  });

  // Wire up general attachments (any file type, or a camera capture) — used by Announcements.
  const attachmentData = {}; // { key: { dataUrl, name } }
  modal.querySelectorAll('.attachment-input').forEach(input => {
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        const dataUrl = await fileToDataUrl(file);
        attachmentData[input.dataset.key] = { dataUrl, name: file.name };
        document.getElementById('attachment-preview-' + input.dataset.key).textContent = `📎 ${file.name}`;
      } catch (e) { alert('Could not read that file.'); }
    });
  });
  modal.querySelectorAll('.attachment-camera-btn').forEach(btn => {
    btn.addEventListener('click', () => openCameraCaptureModal((dataUrl) => {
      attachmentData[btn.dataset.key] = { dataUrl, name: 'photo.jpg' };
      document.getElementById('attachment-preview-' + btn.dataset.key).textContent = '📷 Photo captured';
    }));
  });

  modal.querySelector('#resource-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = {};
    cfg.fields.forEach(f => {
      if (f.type === 'photo' || f.type === 'parent_picker' || f.type === 'attachment') {
        if (f.type === 'photo' && photoDataUrls[f.key]) body.photo_data = photoDataUrls[f.key]; // only send if a new photo was chosen
        if (f.type === 'attachment' && attachmentData[f.key]) { body.attachment_data = attachmentData[f.key].dataUrl; body.attachment_name = attachmentData[f.key].name; }
      } else if (f.type === 'checkbox') { body[f.key] = fd.get(f.key) ? 1 : 0; }
      else { const v = fd.get(f.key); body[f.key] = v === '' ? null : v; }
    });
    try {
      if (hasParentPicker) {
        // Create any brand-new parents first, then attach everyone's id (existing + newly created) to the student.
        for (const draft of pendingNewParents) {
          const created = await api('/parents_guardians', { method: 'POST', body: draft });
          linkedParentIds.push(created.id);
        }
        body._parent_ids = linkedParentIds;
      }
      let saved;
      if (isEdit) saved = await api(`/${cfg.resource}/${existing.id}`, { method: 'PUT', body });
      else saved = await api(`/${cfg.resource}`, { method: 'POST', body });
      modal.remove();
      if (!isEdit && saved.student_id) {
        // Show the new student's barcode right away, rather than just a plain text alert —
        // "as soon as a student is added" was the specific ask, so this is the moment for it.
        const barcodeModal = el(`<div class="modal-backdrop"><div class="modal" style="width:340px;text-align:center">
          <h3>Student Added</h3>
          <p><b>Student ID:</b> ${escapeHtml(saved.student_id)}</p>
          <div style="margin:14px auto;max-width:240px">${renderBarcodeSvg(saved.student_id, { moduleWidth: 2, barHeight: 46 })}</div>
          <button type="button" class="btn gold" id="barcode-modal-close">Done</button>
        </div></div>`);
        document.body.appendChild(barcodeModal);
        barcodeModal.addEventListener('click', e => { if (e.target === barcodeModal) barcodeModal.remove(); });
        barcodeModal.querySelector('#barcode-modal-close').addEventListener('click', () => barcodeModal.remove());
      } else if (!isEdit && saved.staff_id) {
        alert(`Saved. Staff ID: ${saved.staff_id}`);
      }
      route();
    } catch (err) { alert(err.message); }
  });
}

// Reads any file (not just images) as a base64 data URL, for attachments that might be a PDF
// or Word document rather than a photo — no resizing/compression, just a straight read.
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}
const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp)$/i;
function attachmentHtml(filename, originalName) {
  if (!filename) return '';
  const url = `/uploads/${encodeURIComponent(filename)}`;
  const label = originalName || filename;
  if (IMAGE_EXT_RE.test(filename)) {
    return `<div class="forum-attachment"><a href="${url}" target="_blank"><img src="${url}" alt="${escapeHtml(label)}"></a></div>`;
  }
  return `<div class="forum-attachment"><a href="${url}" target="_blank" class="attachment-link">📎 ${escapeHtml(label)}</a></div>`;
}

// Resizes/crops an uploaded image client-side (so uploads stay small) and returns a JPEG data URL.
function resizeImageToDataUrl(file, maxW, maxH) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        const scale = Math.min(maxW / width, maxH / height, 1);
        width = Math.round(width * scale); height = Math.round(height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// ---------- Student profile ----------
async function renderStudentProfile(id) {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="empty-state">Loading…</div>';
  const s = await api(`/students/${id}`);
  content.innerHTML = `
    <div class="page-header">
      <div style="display:flex;align-items:center;gap:14px">
        <div class="profile-photo">${s.photo ? `<img src="/uploads/${encodeURIComponent(s.photo)}" alt="">` : silhouetteSvg()}</div>
        <h2 style="margin:0">${escapeHtml(s.first_name)} ${escapeHtml(s.last_name)} <span class="small-text">(${escapeHtml(s.student_id)})</span></h2>
      </div>
      <a href="#students" class="btn secondary">&larr; Back to Students</a>
    </div>
    <div class="tabs">
      <div class="tab active" data-tab="info">Info</div>
      <div class="tab" data-tab="parents">Parents/Guardians</div>
      <div class="tab" data-tab="attendance">Attendance</div>
      <div class="tab" data-tab="results">Results</div>
      <div class="tab" data-tab="fees">Fees</div>
      <div class="tab" data-tab="welfare">Welfare</div>
      <div class="tab" data-tab="documents">Documents</div>
      ${can('students', 'view') ? `<div class="tab" data-tab="login">Login</div>` : ''}
    </div>
    <div id="tab-content"></div>`;
  const tabContent = document.getElementById('tab-content');
  function showTab(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    if (tab === 'info') {
      tabContent.innerHTML = `<div class="card">
        <p><b>Gender:</b> ${escapeHtml(s.gender)} &nbsp; <b>DOB:</b> ${escapeHtml(s.dob)} &nbsp; <b>Status:</b> ${statusBadge(s.status)}</p>
        <p><b>Admission No:</b> ${escapeHtml(s.admission_number)} &nbsp; <b>Admission Date:</b> ${escapeHtml(s.admission_date)}</p>
        <p><b>Nationality:</b> ${escapeHtml(s.nationality)} &nbsp; <b>Class ID:</b> ${escapeHtml(s.class_id)}</p>
        <p><b>Emergency Contact:</b> ${escapeHtml(s.emergency_contact_name)} — ${escapeHtml(s.emergency_contact_phone)}</p>
        <div style="margin-top:14px"><b>Student ID Barcode:</b><div style="margin-top:6px;max-width:220px">${renderBarcodeSvg(s.student_id, { moduleWidth: 2, barHeight: 40 })}</div></div>
      </div>`;
    } else if (tab === 'parents') {
      tabContent.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Relationship</th><th>Status</th><th>Phone</th></tr></thead>
        <tbody>${(s.parents || []).map(p => `<tr><td>${escapeHtml(p.full_name)}</td><td>${escapeHtml(p.relationship)}</td><td>${statusBadge(p.status)}</td><td>${escapeHtml(p.phone)}</td></tr>`).join('') || '<tr><td colspan=4 class="muted">No linked parents/guardians</td></tr>'}</tbody></table></div>`;
    } else if (tab === 'attendance') {
      tabContent.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Status</th><th>Remarks</th></tr></thead>
        <tbody>${(s.attendance || []).map(a => `<tr><td>${a.date}</td><td>${statusBadge(a.status)}</td><td>${escapeHtml(a.remarks)}</td></tr>`).join('') || '<tr><td colspan=3 class="muted">No attendance records</td></tr>'}</tbody></table></div>`;
    } else if (tab === 'results') {
      tabContent.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Subject</th><th>CA Total (/60)</th><th>CA 50%</th><th>Exam (/100)</th><th>Exam 50%</th><th>Final (/100)</th><th>Grade</th><th>Description</th></tr></thead>
        <tbody>${(s.results || []).map(r => `<tr><td>${escapeHtml(r.subject_name)}</td><td>${r.ca_total != null ? Math.round(r.ca_total) : '—'}</td><td>${r.ca_scaled != null ? Math.round(r.ca_scaled) : '—'}</td><td>${r.exam_score ?? '—'}</td><td>${r.exam_scaled != null ? Math.round(r.exam_scaled) : '—'}</td><td><b>${r.final_score != null ? Math.round(r.final_score) : '—'}</b></td><td>${escapeHtml(r.grade)}</td><td>${escapeHtml(r.teacher_comment)}</td></tr>`).join('') || '<tr><td colspan=8 class="muted">No results recorded</td></tr>'}</tbody></table></div>`;
    } else if (tab === 'fees') {
      tabContent.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Fee Type</th><th>Amount Due</th></tr></thead>
        <tbody>${(s.fees || []).map(f => `<tr><td>${escapeHtml(f.fee_type_name)}</td><td>GHS ${f.amount_due}</td></tr>`).join('') || '<tr><td colspan=2 class="muted">No fees assigned</td></tr>'}</tbody></table></div>`;
    } else if (tab === 'welfare') {
      tabContent.innerHTML = `<div class="card">
        <p><b>Orphan Status:</b> ${escapeHtml(s.orphan_status)}</p>
        <p><b>Uses Bus:</b> ${s.uses_bus ? 'Yes' : 'No'} &nbsp; <b>Pays Canteen:</b> ${s.pays_canteen ? 'Yes' : 'No'}</p>
        <p><b>Allergies / Medical:</b> ${escapeHtml(s.allergies) || '—'}</p>
        <p><b>Special Needs:</b> ${escapeHtml(s.special_needs) || '—'}</p>
        <p class="small-text">Sensitive welfare data — visible only to authorized roles.</p>
      </div>`;
    } else if (tab === 'documents') {
      renderDocumentsTab();
    } else if (tab === 'login') {
      renderLoginTab();
    }
  }
  async function renderDocumentsTab() {
    const editable = can('students', 'edit');
    tabContent.innerHTML = `<div class="card">
      ${editable ? `
      <div class="toolbar">
        <input type="file" id="doc-upload-input">
        <input type="text" id="doc-description-input" placeholder="What is this file? (e.g. Birth Certificate)" style="min-width:220px">
        <button class="btn gold" id="doc-upload-btn">⬆ Upload</button>
      </div>
      <p class="small-text" style="margin-top:6px">Any file type, up to 8MB — birth certificate, medical note, transfer letter, etc.</p>` : ''}
      <div id="doc-list" style="margin-top:14px"><div class="empty-state">Loading…</div></div>
    </div>`;
    async function loadDocs() {
      const docs = await api(`/students/${id}/documents`);
      const listEl = document.getElementById('doc-list');
      if (!listEl) return; // already navigated away by the time this resolved
      listEl.innerHTML = docs.length ? `<div class="table-wrap"><table><thead><tr><th>File</th><th>Description</th><th>Uploaded</th><th></th></tr></thead>
        <tbody>${docs.map(d => `<tr><td><a href="/uploads/${encodeURIComponent(d.filename)}" target="_blank">${escapeHtml(d.original_name || d.filename)}</a></td><td>${escapeHtml(d.description || '—')}</td><td>${escapeHtml(d.uploaded_at)}</td>
          <td>${editable ? `<button type="button" class="doc-delete-btn" data-id="${d.id}">Delete</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`
        : '<div class="empty-state">No documents uploaded yet.</div>';
      document.querySelectorAll('.doc-delete-btn').forEach(btn => btn.addEventListener('click', async () => {
        if (!confirm('Delete this document?')) return;
        await api(`/student-documents/${btn.dataset.id}`, { method: 'DELETE' });
        loadDocs();
      }));
    }
    document.getElementById('doc-upload-btn')?.addEventListener('click', async () => {
      const file = document.getElementById('doc-upload-input').files[0];
      if (!file) return alert('Choose a file first.');
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          await api(`/students/${id}/documents`, { method: 'POST', body: { file_data: reader.result, original_name: file.name, description: document.getElementById('doc-description-input').value } });
          loadDocs();
          document.getElementById('doc-upload-input').value = '';
          document.getElementById('doc-description-input').value = '';
        } catch (e) { alert(e.message); }
      };
      reader.readAsDataURL(file);
    });
    loadDocs();
  }
  function renderLoginTab() {
    tabContent.innerHTML = `<div class="card" id="login-tab-inner">
      ${s.login
        ? `<p><b>Username:</b> ${escapeHtml(s.login.username)} &nbsp; <span class="badge ${s.login.status === 'Active' ? 'green' : 'gray'}">${escapeHtml(s.login.status)}</span></p>
           ${can('students', 'edit') ? `<button class="btn secondary" id="sp-reset-login-btn">Reset Password</button>` : ''}`
        : `<p class="muted">This student does not have a login account yet.</p>
           ${can('students', 'edit') ? `<button class="btn gold" id="sp-create-login-btn">Create Login</button>` : ''}`}
    </div>`;
    document.getElementById('sp-create-login-btn')?.addEventListener('click', () => openStudentLoginModal(s, refreshLoginAfterModal));
    document.getElementById('sp-reset-login-btn')?.addEventListener('click', () => openStudentLoginModal(s, refreshLoginAfterModal));
  }
  async function refreshLoginAfterModal() {
    const fresh = await api(`/students/${id}`);
    s.login = fresh.login;
    renderLoginTab();
  }
  content.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => showTab(t.dataset.tab)));
  showTab('info');
}

// ---------- Academics (years/terms) ----------
async function renderAcademics() {
  const content = document.getElementById('content');
  const years = (await api('/academic_years?pageSize=100')).rows;
  const settings = await api('/settings');
  const totalSubjects = (await api('/subjects?pageSize=500')).total;
  content.innerHTML = `<div class="page-header"><h2>Academic Years & Terms</h2>
    ${can('academic_sessions', 'add') ? `<button class="btn gold" id="add-year">+ Add Academic Year</button>` : ''}</div>
    <div class="card">
      <h3 style="margin-top:0;color:var(--navy)">Overall Pass Mark Calculator</h3>
      <p class="small-text">Overall Pass Mark = Total Subjects × Pass Mark Per Subject. Use this to work out a term's
        Overall Pass Mark below when using a sum-of-subjects threshold rather than a straight percentage — then apply
        the result to whichever term you want.</p>
      <div class="form-grid">
        <div><label>Total Subjects (from Subjects list)</label><input type="number" id="opm-subject-count" value="${totalSubjects}" min="0"></div>
        <div><label>Pass Mark Per Subject</label><input type="number" id="opm-per-subject" value="50" min="0"></div>
      </div>
      <p style="margin-top:10px"><b>Overall Pass Mark:</b> <span id="opm-result" style="font-size:18px;color:var(--navy);font-weight:800">${totalSubjects * 50}</span></p>
      <button type="button" class="btn secondary" id="opm-clear-btn" style="margin-top:8px">Clear</button>
    </div>
    <div id="years-list"></div>`;
  const recalc = () => {
    const subj = Number(document.getElementById('opm-subject-count').value) || 0;
    const perSubj = Number(document.getElementById('opm-per-subject').value) || 0;
    document.getElementById('opm-result').textContent = subj * perSubj;
  };
  document.getElementById('opm-subject-count').addEventListener('input', recalc);
  document.getElementById('opm-per-subject').addEventListener('input', recalc);
  document.getElementById('opm-clear-btn').addEventListener('click', () => {
    document.getElementById('opm-subject-count').value = totalSubjects;
    document.getElementById('opm-per-subject').value = 50;
    recalc();
  });
  const list = document.getElementById('years-list');
  for (const y of years) {
    const terms = (await api(`/terms?academic_year_id=${y.id}`)).rows;
    const card = el(`<div class="card">
      <h3 style="margin-top:0;color:var(--navy)">${escapeHtml(y.name)} ${y.id === settings.current_academic_year_id ? '<span class="badge green">Current</span>' : ''}</h3>
      <div class="table-wrap"><table><thead><tr><th>Term</th><th>Start</th><th>End</th><th>Overall Pass Mark</th><th></th></tr></thead>
      <tbody>${terms.map(t => `<tr data-term-id="${t.id}"><td>${escapeHtml(t.name)} ${t.id === settings.current_term_id ? '<span class="badge green">Current</span>' : ''}</td><td>${escapeHtml(t.start_date)}</td><td>${escapeHtml(t.end_date)}</td>
        <td>${can('academic_sessions', 'edit') ? `<input type="number" class="pass-mark-input" min="0" value="${t.pass_mark ?? ''}" placeholder="e.g. 50" style="width:80px"> <button type="button" class="use-calc-btn" data-term="${t.id}" title="Fill in the Overall Pass Mark computed above" style="padding:4px 8px;font-size:11.5px">Use Calculator ↑</button>` : (t.pass_mark != null ? t.pass_mark : '—')}</td>
        <td>${can('academic_sessions', 'edit') ? `<button class="save-pass-mark" data-term="${t.id}">Save</button> <button class="set-current" data-year="${y.id}" data-term="${t.id}">Set Current</button>` : ''}</td></tr>`).join('') || '<tr><td colspan=5 class="muted">No terms</td></tr>'}</tbody></table></div>
    </div>`);
    list.appendChild(card);
    card.querySelectorAll('.set-current').forEach(btn => btn.addEventListener('click', async () => {
      await api('/settings', { method: 'PUT', body: { current_academic_year_id: Number(btn.dataset.year), current_term_id: Number(btn.dataset.term) } });
      renderAcademics();
    }));
    card.querySelectorAll('.use-calc-btn').forEach(btn => btn.addEventListener('click', () => {
      const row = btn.closest('tr');
      row.querySelector('.pass-mark-input').value = document.getElementById('opm-result').textContent;
    }));
    card.querySelectorAll('.save-pass-mark').forEach(btn => btn.addEventListener('click', async () => {
      const row = btn.closest('tr');
      const val = row.querySelector('.pass-mark-input').value;
      await api(`/terms/${btn.dataset.term}`, { method: 'PUT', body: { pass_mark: val === '' ? null : Number(val) } });
      alert('Saved.');
    }));
  }
  document.getElementById('add-year')?.addEventListener('click', async () => {
    const name = prompt('Academic Year name (e.g. 2027/2028):');
    if (!name) return;
    const start = prompt('Start date (YYYY-MM-DD):', '');
    const end = prompt('End date (YYYY-MM-DD):', '');
    const y = await api('/academic_years', { method: 'POST', body: { name, start_date: start, end_date: end } });
    for (const tname of ['Term 1', 'Term 2', 'Term 3']) {
      await api('/terms', { method: 'POST', body: { academic_year_id: y.id, name: tname } });
    }
    renderAcademics();
  });
}

// ---------- Attendance ----------
async function renderAttendance() {
  const content = document.getElementById('content');
  const classes = (await api('/classes?pageSize=200')).rows;
  content.innerHTML = `<div class="page-header"><h2>Attendance</h2></div>
    <div class="toolbar">
      <select id="att-class"><option value="">Select class…</option>${classes.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select>
      <input type="date" id="att-date" value="${new Date().toISOString().slice(0, 10)}">
      <button class="btn secondary" id="att-load">Load Students</button>
    </div>
    <div id="att-table"></div>`;
  document.getElementById('att-load').addEventListener('click', loadAttendance);
  async function loadAttendance() {
    const classId = document.getElementById('att-class').value;
    const date = document.getElementById('att-date').value;
    if (!classId) return alert('Please select a class.');
    const students = (await api(`/students?class_id=${classId}&pageSize=500`)).rows;
    const existing = (await api(`/attendance?class_id=${classId}&date=${date}`));
    const existingMap = {}; existing.forEach(a => existingMap[a.student_id] = a.status);
    const wrap = document.getElementById('att-table');
    if (!can('attendance', 'add')) {
      wrap.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Student</th><th>Status</th></tr></thead><tbody>
        ${students.map(s => `<tr><td>${escapeHtml(s.first_name)} ${escapeHtml(s.last_name)}</td><td>${statusBadge(existingMap[s.id] || '—')}</td></tr>`).join('')}
      </tbody></table></div>`;
      return;
    }
    wrap.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Student</th><th>Status</th></tr></thead><tbody>
      ${students.map(s => `<tr data-sid="${s.id}"><td>${escapeHtml(s.first_name)} ${escapeHtml(s.last_name)}</td><td>
        <select class="att-status">
          ${['Present', 'Absent', 'Late', 'Excused'].map(op => `<option value="${op}" ${(existingMap[s.id] || 'Present') === op ? 'selected' : ''}>${op}</option>`).join('')}
        </select></td></tr>`).join('')}
    </tbody></table></div>
    <div style="margin-top:14px"><button class="btn gold" id="save-att">Save Attendance</button></div>`;
    document.getElementById('save-att').addEventListener('click', async () => {
      const records = [...wrap.querySelectorAll('tr[data-sid]')].map(tr => ({
        student_id: Number(tr.dataset.sid), status: tr.querySelector('.att-status').value,
      }));
      await api('/attendance/bulk', { method: 'POST', body: { date, class_id: Number(classId), records } });
      alert('Attendance saved.');
    });
  }
}

// ---------- Results (Continuous Assessment: Class Exercise/Test/Group/Project /15 each -> 50%, Exam /100 -> 50%) ----
function computeCAPreview(ce, ct, gw, pw, exam) {
  const clamp = (v, max) => { const n = Number(v); if (isNaN(n) || n < 0) return 0; return n > max ? max : n; };
  ce = clamp(ce, 15); ct = clamp(ct, 15); gw = clamp(gw, 15); pw = clamp(pw, 15); exam = clamp(exam, 100);
  const ca_total = ce + ct + gw + pw;
  const ca_scaled = (ca_total / 60) * 50;
  const exam_scaled = (exam / 100) * 50;
  const final_score = ca_scaled + exam_scaled;
  return { ca_total, ca_scaled, exam_scaled, final_score };
}

async function renderResults() {
  const content = document.getElementById('content');
  // A Parent has no business on the admin's bulk results-entry page (and no permission for the
  // Classes/Subjects data it needs) — send them to the simple report-card view meant for them.
  if (state.user && state.user.role === 'Parent/Guardian') return renderMyResults();
  const [classes, subjects, terms, grading] = await Promise.all([
    api('/classes?pageSize=200'), api('/subjects?pageSize=200'), api('/terms?pageSize=200'), api('/grading_system?pageSize=50'),
  ]);
  content.innerHTML = `<div class="page-header"><h2>Continuous Assessment & Results</h2></div>
    <div class="notice">
      <b>Scoring structure:</b> Class Exercise (/15) + Class Test (/15) + Group Work (/15) + Project Work (/15)
      = CA Total (/60), scaled to <b>50%</b>. Exam (/100), scaled to <b>50%</b>. Final Score (/100) = CA(50%) + Exam(50%).
    </div>
    <div class="toolbar">
      <select id="res-class"><option value="">Class…</option>${classes.rows.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select>
      <select id="res-subject"><option value="">Subject…</option>${subjects.rows.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}</select>
      <select id="res-term"><option value="">Term…</option>${terms.rows.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('')}</select>
      <button class="btn secondary" id="res-load">Load Students</button>
    </div>
    <div class="notice" style="margin-top:10px">
      <b>📊 Prefer a spreadsheet?</b> Download a template below, fill it in Excel — or upload it to Google Sheets
      yourself to enter it there or share it with someone else — then save/export as CSV and upload it back.
      This system can't keep a live connection to an actual Google Sheet since it runs fully offline, but this
      achieves the same practical result.
      <div class="toolbar" style="margin-top:8px">
        <button class="btn secondary" id="res-download-template-btn">⬇ Download Template</button>
        <label class="csv-dropzone" id="res-import-dropzone" for="res-import-input" style="display:inline-flex;width:auto;padding:8px 16px">
          <span id="res-import-dropzone-text">📄 Click to choose a filled-in CSV</span>
        </label>
        <input type="file" id="res-import-input" accept=".csv" style="display:none">
        <button class="btn gold" id="res-import-btn">⬆ Upload &amp; Import</button>
      </div>
    </div>
    <div id="res-table"></div>

    <div class="card" style="margin-top:20px">
      <h3 style="margin-top:0;color:var(--navy)">Print One Student's Report Card</h3>
      <div class="toolbar">
        <input type="text" id="rc-student-id" placeholder="Student ID (e.g. NIB/2026/001)" style="max-width:220px">
        <select id="rc-term">${terms.rows.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('')}</select>
        <button class="btn secondary" id="rc-load">Generate</button>
      </div>
      <div id="rc-output"></div>
    </div>

    <div class="card" style="margin-top:20px">
      <h3 style="margin-top:0;color:var(--navy)">Print an Entire Class's Report Cards</h3>
      <p class="small-text">Generates a full, individual report card sheet for every active student in the class, one after another — ready to print and cut/hand out separately.</p>
      <div class="toolbar">
        <select id="bulk-rc-class"><option value="">Class…</option>${classes.rows.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select>
        <select id="bulk-rc-term"><option value="">Term…</option>${terms.rows.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('')}</select>
        <button class="btn secondary" id="bulk-rc-load">Generate All</button>
      </div>
      <div id="bulk-rc-output"></div>
    </div>

    <div class="card" style="margin-top:20px">
      <div class="page-header" style="margin-bottom:10px"><h3 style="margin:0;color:var(--navy)">Grading System (BECE-style, 1 = highest, 9 = lowest)</h3>
        <button class="btn secondary" id="add-grade-btn" style="padding:6px 12px;font-size:12.5px">+ Add Grade Band</button></div>
      <p class="small-text">These boundaries are used everywhere a grade is calculated — report cards, the performance report, and student profiles. Edit them here to match your school's own circular; they don't have to match the example shown.</p>
      <div class="table-wrap"><table><thead><tr><th>Grade</th><th>Min %</th><th>Max %</th><th>Description</th><th></th></tr></thead>
      <tbody>${grading.rows.sort((a, b) => b.min_score - a.min_score).map(g => `<tr data-id="${g.id}">
        <td><b class="rc-grade-${escapeHtml(g.grade)}">${escapeHtml(g.grade)}</b></td><td>${g.min_score}</td><td>${g.max_score}</td><td>${escapeHtml(g.description)}</td>
        <td class="row-actions"><button class="edit-grade-btn">Edit</button><button class="del-grade-btn">Delete</button></td>
      </tr>`).join('') || '<tr><td colspan=5 class="muted">No grade bands defined</td></tr>'}</tbody></table></div>
    </div>`;

  setupGradingPanel();

  document.getElementById('res-download-template-btn').addEventListener('click', () => {
    const classId = document.getElementById('res-class').value;
    const subjectId = document.getElementById('res-subject').value;
    const termId = document.getElementById('res-term').value;
    if (!classId || !subjectId || !termId) return alert('Select a class, subject and term first.');
    window.open(`/api/continuous-assessment/template?class_id=${classId}&subject_id=${subjectId}&term_id=${termId}`, '_blank');
  });
  document.getElementById('res-import-input').addEventListener('change', (e) => {
    const f = e.target.files[0];
    document.getElementById('res-import-dropzone-text').textContent = f ? `✓ ${f.name}` : '📄 Click to choose a filled-in CSV';
    document.getElementById('res-import-dropzone').classList.toggle('has-file', !!f);
  });
  document.getElementById('res-import-btn').addEventListener('click', async () => {
    const classId = document.getElementById('res-class').value;
    const subjectId = document.getElementById('res-subject').value;
    const termId = document.getElementById('res-term').value;
    const file = document.getElementById('res-import-input').files[0];
    if (!classId || !subjectId || !termId) return alert('Select a class, subject and term first.');
    if (!file) return alert('Choose a CSV file to upload.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    let csvText;
    try { csvText = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch (e) { csvText = new TextDecoder('windows-1252').decode(bytes); }
    try {
      const result = await api('/continuous-assessment/import', { method: 'POST', body: { class_id: Number(classId), subject_id: Number(subjectId), term_id: Number(termId), csv_text: csvText } });
      let msg = `Imported scores for ${result.updated} student(s).`;
      if (result.skipped) msg += ` ${result.skipped} row(s) skipped — ` + result.issues.map(i => `Row ${i.row}: ${i.reason}`).join('; ');
      alert(msg);
      document.getElementById('res-load').click();
    } catch (e) { alert(e.message); }
  });
  document.getElementById('res-load').addEventListener('click', async () => {
    const classId = document.getElementById('res-class').value;
    const subjectId = document.getElementById('res-subject').value;
    const termId = document.getElementById('res-term').value;
    if (!classId || !subjectId || !termId) return alert('Select a class, subject and term first.');
    const students = (await api(`/students?class_id=${classId}&pageSize=500`)).rows;
    const existing = await api(`/continuous-assessment?class_id=${classId}&subject_id=${subjectId}&term_id=${termId}`);
    const existingMap = {}; existing.forEach(r => existingMap[r.student_id] = r);
    const wrap = document.getElementById('res-table');
    const canEdit = can('results', 'add');
    wrap.innerHTML = `<div class="table-wrap"><table><thead><tr>
        <th>Student</th><th>Class Ex. (/15)</th><th>Class Test (/15)</th><th>Group Work (/15)</th><th>Project (/15)</th>
        <th>Exam (/100)</th><th>CA 50%</th><th>Exam 50%</th><th>Final (/100)</th><th>Description</th><th></th></tr></thead><tbody>
      ${students.map(s => {
        const ex = existingMap[s.id] || {};
        return `<tr data-sid="${s.id}">
          <td>${escapeHtml(s.first_name)} ${escapeHtml(s.last_name)}</td>
          <td><input type="number" min="0" max="15" class="ca-ce" value="${ex.class_exercise ?? ''}" style="width:70px"></td>
          <td><input type="number" min="0" max="15" class="ca-ct" value="${ex.class_test ?? ''}" style="width:70px"></td>
          <td><input type="number" min="0" max="15" class="ca-gw" value="${ex.group_work ?? ''}" style="width:70px"></td>
          <td><input type="number" min="0" max="15" class="ca-pw" value="${ex.project_work ?? ''}" style="width:70px"></td>
          <td><input type="number" min="0" max="100" class="ca-exam" value="${ex.exam_score ?? ''}" style="width:80px"></td>
          <td class="ca-scaled-out">${ex.ca_scaled ? Math.round(ex.ca_scaled) : '0'}</td>
          <td class="exam-scaled-out">${ex.exam_scaled ? Math.round(ex.exam_scaled) : '0'}</td>
          <td class="final-out"><b>${ex.final_score ? Math.round(ex.final_score) : '0'}</b></td>
          <td><input type="text" class="ca-comment" value="${escapeHtml(ex.teacher_comment || '')}" style="width:120px" placeholder="Description…"></td>
          <td><button type="button" class="print-one-result-btn" data-sid="${s.id}">🖶 Print</button></td>
        </tr>`;
      }).join('')}
    </tbody></table></div>
    <div style="margin-top:14px">${canEdit ? `<button class="btn gold" id="save-res">Save Continuous Assessment</button> <button class="btn secondary" id="clear-res-btn">Clear</button>` : ''} <button class="btn secondary" id="print-sba-btn">🖶 Print SBA Record Sheet</button></div>`;

    wrap.querySelectorAll('.print-one-result-btn').forEach(btn => btn.addEventListener('click', async () => {
      const sid = Number(btn.dataset.sid);
      const student = students.find(s => s.id === sid);
      const tr = btn.closest('tr');
      const ce = Number(tr.querySelector('.ca-ce').value) || 0, ct = Number(tr.querySelector('.ca-ct').value) || 0;
      const gw = Number(tr.querySelector('.ca-gw').value) || 0, pw = Number(tr.querySelector('.ca-pw').value) || 0;
      const exam = Number(tr.querySelector('.ca-exam').value) || 0;
      const comment = tr.querySelector('.ca-comment').value;
      const c = computeCAPreview(ce, ct, gw, pw, exam);
      const [settings, cfg, className, subjectName, termName] = await Promise.all([
        api('/public-settings').catch(() => ({})),
        api('/ca-config'),
        Promise.resolve(classes.rows.find(cl => cl.id === Number(document.getElementById('res-class').value))?.name || ''),
        Promise.resolve(subjects.rows.find(sub => sub.id === Number(document.getElementById('res-subject').value))?.name || ''),
        Promise.resolve(terms.rows.find(t => t.id === Number(document.getElementById('res-term').value))?.name || ''),
      ]);
      printIndividualCAResult({ name: `${student.first_name} ${student.last_name}`, studentId: student.student_id, ce, ct, gw, pw, exam, final: c.final_score, comment },
        className, subjectName, termName, settings.school_name, cfg);
    }));

    // live preview as marks are typed
    wrap.querySelectorAll('tr[data-sid]').forEach(tr => {
      const recompute = () => {
        const ce = tr.querySelector('.ca-ce').value, ct = tr.querySelector('.ca-ct').value;
        const gw = tr.querySelector('.ca-gw').value, pw = tr.querySelector('.ca-pw').value;
        const exam = tr.querySelector('.ca-exam').value;
        const c = computeCAPreview(ce, ct, gw, pw, exam);
        tr.querySelector('.ca-scaled-out').textContent = Math.round(c.ca_scaled);
        tr.querySelector('.exam-scaled-out').textContent = Math.round(c.exam_scaled);
        tr.querySelector('.final-out').innerHTML = `<b>${Math.round(c.final_score)}</b>`;
      };
      tr.querySelectorAll('input[type=number]').forEach(inp => inp.addEventListener('input', recompute));
    });

    document.getElementById('save-res')?.addEventListener('click', async () => {
      const records = [...wrap.querySelectorAll('tr[data-sid]')].map(tr => ({
        student_id: Number(tr.dataset.sid),
        class_exercise: tr.querySelector('.ca-ce').value || 0,
        class_test: tr.querySelector('.ca-ct').value || 0,
        group_work: tr.querySelector('.ca-gw').value || 0,
        project_work: tr.querySelector('.ca-pw').value || 0,
        exam_score: tr.querySelector('.ca-exam').value || 0,
        teacher_comment: tr.querySelector('.ca-comment').value,
      }));
      try {
        await api('/continuous-assessment/bulk', { method: 'POST', body: { subject_id: Number(subjectId), class_id: Number(classId), term_id: Number(termId), records } });
        alert('Continuous assessment saved.');
      } catch (e) { alert(e.message); }
    });
    document.getElementById('clear-res-btn')?.addEventListener('click', () => {
      if (!confirm('Clear all the score fields on screen? This only resets what\'s currently typed here — nothing already saved is deleted until you click Save.')) return;
      wrap.querySelectorAll('tr[data-sid] input[type=number], tr[data-sid] input[type=text]').forEach(inp => { inp.value = ''; inp.dispatchEvent(new Event('input')); });
    });
    document.getElementById('print-sba-btn').addEventListener('click', async () => {
      const [settings, cfg, className, subjectName, termName] = await Promise.all([
        api('/public-settings').catch(() => ({})),
        api('/ca-config'),
        Promise.resolve(classes.rows.find(c => c.id === Number(classId))?.name || ''),
        Promise.resolve(subjects.rows.find(s => s.id === Number(subjectId))?.name || ''),
        Promise.resolve(terms.rows.find(t => t.id === Number(termId))?.name || ''),
      ]);
      // Read straight from the on-screen inputs (not the data fetched when the page first
      // loaded) so the sheet always reflects whatever is currently on screen, saved or not.
      const sbaRows = [...wrap.querySelectorAll('tr[data-sid]')].map(tr => {
        const sid = Number(tr.dataset.sid);
        const student = students.find(s => s.id === sid);
        const ce = Number(tr.querySelector('.ca-ce').value) || 0, ct = Number(tr.querySelector('.ca-ct').value) || 0;
        const gw = Number(tr.querySelector('.ca-gw').value) || 0, pw = Number(tr.querySelector('.ca-pw').value) || 0;
        const exam = Number(tr.querySelector('.ca-exam').value) || 0;
        const c = computeCAPreview(ce, ct, gw, pw, exam);
        return { name: `${student.first_name} ${student.last_name}`, studentId: student.student_id, ce, ct, gw, pw, exam, final: c.final_score };
      });
      printSbaRecordSheet(sbaRows, className, subjectName, termName, settings.school_name, cfg);
    });
  });

  document.getElementById('rc-load').addEventListener('click', async () => {
    const studentId = document.getElementById('rc-student-id').value;
    const termId = document.getElementById('rc-term').value;
    if (!studentId) return alert('Enter the student ID.');
    try {
      const [rc, grading] = await Promise.all([
        api(`/report-card?student_id=${studentId}&term_id=${termId}`),
        api('/grading_system?pageSize=50'),
      ]);
      renderProfessionalReportCard(rc, grading.rows, termId);
    } catch (e) { alert(e.message); }
  });
}

function renderProfessionalReportCard(rc, gradingRows, termId) {
  document.getElementById('rc-output').innerHTML = buildReportCardHtml(rc, gradingRows) +
    `<div class="no-print" style="margin-top:14px">
      <button class="btn gold" id="rc-print-btn">Print Report Card</button>
      <a class="btn secondary" href="/api/report-card/export-word?student_id=${encodeURIComponent(rc.student.id)}&term_id=${encodeURIComponent(termId)}" id="rc-download-word">⬇ Download as Word</a>
      <a class="btn secondary" href="/api/report-card/export-pdf?student_id=${encodeURIComponent(rc.student.id)}&term_id=${encodeURIComponent(termId)}" id="rc-download-pdf">⬇ Download as PDF</a>
    </div>`;
  // Printing in a dedicated blank window — rather than calling window.print() on the current
  // page — guarantees nothing else on this fairly busy admin page (the CA-entry tools, the
  // bulk-print section, the grading-system table) can ever leak onto the printed page, no
  // matter what gets added here in the future. Found this leaking onto a real printed page
  // during testing: a "one student's report card" print was overflowing onto a second sheet
  // because the whole Results page — not just the report card — was printing.
  document.getElementById('rc-print-btn').addEventListener('click', () => {
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>Report Card</title><link rel="stylesheet" href="/style.css"></head>
      <body style="padding:0"><div class="report-card">${buildReportCardHtml(rc, gradingRows)}</div><script>window.print()<\/script></body></html>`);
    win.document.close();
  });
}

// Builds the report card markup for one student. Shared by the single-student print flow
// and the whole-class batch print flow below, so both always look identical.
// ---------- Student self-service: "My Report Card" ----------
// ---------- Direct Messages (private, one-to-one — separate from the public Discussion Forum) ----------
async function renderMessages(preselectContactId) {
  preselectContactId = preselectContactId ? Number(preselectContactId) : null;
  const content = document.getElementById('content');
  content.innerHTML = '<div class="empty-state">Loading…</div>';
  const contacts = await api('/messages/contacts');
  content.innerHTML = `
    <div class="page-header"><h2>Messages</h2></div>
    <div class="notice">Private messages to your ${state.user.role === 'Student' ? 'classmates and class teacher' : 'students and fellow teachers'} — separate from the public Discussion Forum.</div>
    <div class="messages-layout">
      <div class="messages-contacts">
        ${contacts.length ? contacts.map(c => `<div class="messages-contact" data-id="${c.id}"><b>${escapeHtml(c.full_name)}</b><span class="small-text">${escapeHtml(c.role)}</span></div>`).join('') : '<div class="empty-state">No contacts available yet.</div>'}
      </div>
      <div class="messages-thread">
        <button type="button" class="btn secondary messages-back-btn" id="messages-back-btn">← Contacts</button>
        <div id="messages-thread-body"><div class="empty-state">Select someone from the list to start chatting.</div></div>
        <div class="messages-compose" id="messages-compose" style="display:none">
          <input type="text" id="messages-input" placeholder="Type a message…" autocomplete="off">
          <button class="btn gold" id="messages-send-btn">Send</button>
        </div>
      </div>
    </div>`;

  let activeContactId = null;
  async function loadThread(contactId, contactName) {
    activeContactId = contactId;
    document.querySelectorAll('.messages-contact').forEach(el => el.classList.toggle('active', Number(el.dataset.id) === contactId));
    document.querySelector('.messages-layout').classList.add('thread-open'); // on mobile, swap to a full-width thread view
    const thread = await api(`/messages?with=${contactId}`);
    const body = document.getElementById('messages-thread-body');
    body.innerHTML = `<h4 style="margin:0 0 10px;color:var(--navy)">${escapeHtml(contactName)}</h4>` +
      (thread.map(m => `<div class="msg-bubble ${m.sender_id === state.user.id ? 'mine' : 'theirs'}">${escapeHtml(m.body)}<span class="msg-time">${escapeHtml((m.created_at || '').slice(0, 16).replace('T', ' '))}</span></div>`).join('') || '<p class="muted">No messages yet — say hello!</p>');
    body.scrollTop = body.scrollHeight;
    document.getElementById('messages-compose').style.display = 'flex';
  }
  document.getElementById('messages-back-btn').addEventListener('click', () => {
    document.querySelector('.messages-layout').classList.remove('thread-open');
  });
  content.querySelectorAll('.messages-contact').forEach(el => el.addEventListener('click', () => {
    loadThread(Number(el.dataset.id), el.querySelector('b').textContent);
  }));
  document.getElementById('messages-send-btn').addEventListener('click', async () => {
    const input = document.getElementById('messages-input');
    if (!input.value.trim() || !activeContactId) return;
    try {
      await api('/messages', { method: 'POST', body: { recipient_id: activeContactId, body: input.value.trim() } });
      input.value = '';
      const contactName = document.querySelector(`.messages-contact[data-id="${activeContactId}"] b`).textContent;
      loadThread(activeContactId, contactName);
    } catch (e) { alert(e.message); }
  });
  document.getElementById('messages-input')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('messages-send-btn').click(); });

  // Arriving here from a specific person's profile (e.g. the Staff panel's "Send Message")
  // pre-opens that thread — if they're not in the normal contacts list (which is scoped to
  // classmates/colleagues), still attempt to open the conversation directly rather than
  // silently do nothing, since the send endpoint itself may be less restrictive.
  if (preselectContactId) {
    const existingContact = contacts.find(c => c.id === preselectContactId);
    if (existingContact) {
      document.querySelector(`.messages-contact[data-id="${preselectContactId}"]`)?.click();
    } else {
      loadThread(preselectContactId, 'Conversation');
    }
  }
}

async function renderMyResults() {
  const content = document.getElementById('content');
  const isParent = state.user && state.user.role === 'Parent/Guardian';
  let studentId = state.user && state.user.linked_student_id;
  let wardPicker = '';
  if (isParent) {
    const myWards = (await api('/students?pageSize=50')).rows;
    if (!myWards.length) {
      content.innerHTML = `<div class="empty-state">Your account isn't linked to a ward yet. Ask the school office to link it.</div>`;
      return;
    }
    studentId = myWards[0].id;
    if (myWards.length > 1) {
      wardPicker = `<select id="my-rc-ward" style="margin-right:8px">${myWards.map(w => `<option value="${w.id}">${escapeHtml(w.first_name)} ${escapeHtml(w.last_name)}</option>`).join('')}</select>`;
    }
  } else if (!studentId) {
    content.innerHTML = `<div class="empty-state">Your account isn't linked to a student record yet. Ask the school office to link it under Users & Roles.</div>`;
    return;
  }
  content.innerHTML = '<div class="empty-state">Loading…</div>';
  const terms = await api('/terms?pageSize=200');
  content.innerHTML = `<div class="page-header"><h2>${isParent ? "Your Ward's Report Card" : 'My Report Card'}</h2></div>
    <div class="toolbar">
      ${wardPicker}
      <select id="my-rc-term">${terms.rows.map(t2 => `<option value="${t2.id}">${escapeHtml(t2.name)}</option>`).join('')}</select>
      <button class="btn secondary" id="my-rc-load">View</button>
    </div>
    <div id="my-rc-output"></div>`;
  async function load() {
    const termId = document.getElementById('my-rc-term').value;
    const sid = document.getElementById('my-rc-ward')?.value || studentId;
    try {
      const [rc, grading] = await Promise.all([
        api(`/report-card?student_id=${sid}&term_id=${termId}`),
        api('/grading_system?pageSize=50'),
      ]);
      document.getElementById('my-rc-output').innerHTML = buildReportCardHtml(rc, grading.rows) +
        `<div class="no-print" style="margin-top:14px"><button class="btn gold" id="my-rc-print-btn">Print</button></div>`;
      document.getElementById('my-rc-print-btn').addEventListener('click', () => {
        const win = window.open('', '_blank');
        win.document.write(`<!DOCTYPE html><html><head><title>Report Card</title><link rel="stylesheet" href="/style.css"></head>
          <body style="padding:0"><div class="report-card">${buildReportCardHtml(rc, grading.rows)}</div><script>window.print()<\/script></body></html>`);
        win.document.close();
      });
    } catch (e) { document.getElementById('my-rc-output').innerHTML = `<div class="empty-state">${escapeHtml(e.message)}</div>`; }
  }
  document.getElementById('my-rc-load').addEventListener('click', load);
  document.getElementById('my-rc-ward')?.addEventListener('change', load);
  load();
}

// A sensible auto-remark when a teacher hasn't typed one in for a subject — so the Remarks
// column on a printed report card is never just blank for most students.
function remarkForGrade(grade) {
  const g = String(grade || '').trim();
  const remarks = {
    '1': 'Excellent', '2': 'Very Good', '3': 'Good', '4': 'Credit', '5': 'Credit',
    '6': 'Credit', '7': 'Pass', '8': 'Pass', '9': 'Needs Improvement',
    A: 'Excellent', B: 'Very Good', C: 'Good', D: 'Credit', E: 'Pass', F: 'Needs Improvement',
  };
  return remarks[g] || '';
}

function buildReportCardHtml(rc, gradingRows) {
  const s = rc.student;
  const photoHtml = s.photo ? `<img src="/uploads/${encodeURIComponent(s.photo)}" alt="">` : silhouetteSvg();
  const rankText = rc.class_rank ? `${ordinal(rc.class_rank)} out of ${rc.class_size}` : '—';
  const attendancePct = rc.attendance.total ? Math.round((rc.attendance.present / rc.attendance.total) * 100) : null;
  const schoolLogoUrl = rc.school.logo_photo ? `/uploads/${encodeURIComponent(rc.school.logo_photo)}` : '/assets/logo.png';
  const headerAlign = rc.school.report_header_align || 'center';
  const headerJustify = headerAlign === 'left' ? 'flex-start' : headerAlign === 'right' ? 'flex-end' : 'center';

  return `
    <div class="report-card">
      <div class="rc-header" style="justify-content:${headerJustify};text-align:${headerAlign};${headerAlign === 'right' ? 'flex-direction:row-reverse;' : ''}">
        <img class="rc-logo" src="${schoolLogoUrl}" alt="School logo">
        <div class="rc-header-text">
          <h1>${escapeHtml(rc.school.school_name || 'Nibras Educational Complex')}</h1>
          <p class="rc-motto">"${escapeHtml(rc.school.motto || 'Knowledge is Light')}"</p>
          <p class="rc-contact">${[rc.school.address, rc.school.phone, rc.school.email].filter(Boolean).map(escapeHtml).join(' &nbsp;·&nbsp; ')}</p>
          ${rc.school.report_header_extra ? `<p class="rc-contact">${escapeHtml(rc.school.report_header_extra)}</p>` : ''}
        </div>
      </div>
      <div class="rc-title-band">TERMINAL REPORT CARD &nbsp;·&nbsp; ${escapeHtml(rc.academic_year)} &nbsp;·&nbsp; ${escapeHtml(rc.term)}</div>

      <div class="rc-student-box">
        <div class="rc-photo">${photoHtml}</div>
        <div class="rc-student-grid">
          <div><span class="rc-label">Name</span><span class="rc-value">${escapeHtml(s.first_name)} ${escapeHtml(s.middle_name || '')} ${escapeHtml(s.last_name)}</span></div>
          <div><span class="rc-label">Student ID</span><span class="rc-value">${escapeHtml(s.student_id)}</span></div>
          <div><span class="rc-label">Class</span><span class="rc-value">${escapeHtml(rc.class_name) || '—'}</span></div>
          <div><span class="rc-label">Gender</span><span class="rc-value">${escapeHtml(s.gender) || '—'}</span></div>
          <div><span class="rc-label">Date of Birth</span><span class="rc-value">${escapeHtml(s.dob) || '—'}</span></div>
          <div><span class="rc-label">Attendance</span><span class="rc-value">${rc.attendance.total ? `${rc.attendance.present}/${rc.attendance.total} days (${attendancePct}%)` : '—'}</span></div>
        </div>
      </div>

      <table class="rc-table">
        <thead><tr>
          <th>Subject</th><th>CA Total<br><span>/60</span></th><th>CA<br><span>50%</span></th>
          <th>Exam<br><span>/100</span></th><th>Exam<br><span>50%</span></th><th>Final<br><span>/100</span></th>
          <th>Grade</th><th>Remarks</th>
        </tr></thead>
        <tbody>
          ${rc.results.map(r => `<tr>
            <td class="rc-subject">${escapeHtml(r.subject_name)}</td>
            <td>${r.ca_total}</td><td>${r.ca_scaled}</td><td>${r.exam_score}</td><td>${r.exam_scaled}</td>
            <td class="rc-final">${r.final_score}</td>
            <td class="rc-grade rc-grade-${escapeHtml(r.grade)}">${escapeHtml(r.grade)}</td>
            <td class="rc-remarks">${escapeHtml(r.teacher_comment || remarkForGrade(r.grade))}</td>
          </tr>`).join('') || `<tr><td colspan="8" class="muted" style="text-align:center;padding:20px">No results recorded for this term yet.</td></tr>`}
        </tbody>
      </table>

      <div class="rc-summary">
        <div class="rc-summary-item"><span>Subjects Offered</span><b>${rc.results.length}</b></div>
        <div class="rc-summary-item"><span>Average Score</span><b>${rc.average}</b></div>
        <div class="rc-summary-item"><span>Overall Grade</span><b>${escapeHtml(rc.overall_grade)}</b></div>
        <div class="rc-summary-item"><span>Class Position</span><b>${rankText}</b></div>
        ${rc.pass_mark != null ? `<div class="rc-summary-item"><span>Pass Mark</span><b>${rc.pass_mark}</b></div>
        <div class="rc-summary-item"><span>Result</span><b class="${rc.overall_result === 'Pass' ? 'rc-result-pass' : 'rc-result-fail'}">${escapeHtml(rc.overall_result || '—')}</b></div>` : ''}
      </div>

      <div class="rc-remarks">
        <div><label>Class Teacher's Remark</label><textarea rows="2" placeholder="Write a remark before printing…"></textarea></div>
        <div><label>Head Teacher's Remark</label><textarea rows="2" placeholder="Write a remark before printing…"></textarea></div>
      </div>

      <div class="rc-grading-key">
        <span class="rc-key-title">Grading Key:</span>
        ${gradingRows.sort((a, b) => b.min_score - a.min_score).map(g => `<span class="rc-key-item"><b>${escapeHtml(g.grade)}</b> ${g.min_score}–${g.max_score} (${escapeHtml(g.description)})</span>`).join('')}
      </div>

      <div class="rc-signatures">
        <div class="rc-sig"><div class="rc-sig-line"></div>Class Teacher's Signature</div>
        <div class="rc-sig"><div class="rc-sig-line"></div>Head Teacher's Signature</div>
        <div class="rc-sig"><div class="rc-sig-line"></div>Parent/Guardian's Signature</div>
      </div>
      <p class="rc-printed-date no-print small-text">Generated ${new Date().toLocaleDateString()}</p>
    </div>`;
}
function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// A class-wide, printable School-Based Assessment (SBA) record sheet — the paper format GES
// circulars typically ask for: one row per student, one column per SBA component, ready to
// file or submit. The components and their weighting come straight from the school's own CA
// settings (Settings → Continuous Assessment), so this always matches whatever's configured
// there rather than a hard-coded GES split.
// Prints the class-wide SBA (School-Based Assessment) record sheet, in the GES-standard shape —
// one row per student, one column per SBA component — using whatever component names, maximum
// marks, and exam weighting are currently configured in Settings > Continuous Assessment Style,
// so a school using different GES component names sees their own terms reflected here too.
// Prints ONE student's Continuous Assessment result, spaced out to comfortably fill a single
// A4 sheet — for handing to one parent/student individually, rather than the dense whole-class
// SBA record sheet above.
function printIndividualCAResult(r, className, subjectName, termName, schoolName, cfg) {
  cfg = cfg || { c1: { name: 'Class Exercise', max: 15 }, c2: { name: 'Class Test', max: 15 }, c3: { name: 'Group Work', max: 15 }, c4: { name: 'Project Work', max: 15 }, examMax: 100, caWeight: 50, examWeight: 50 };
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>Result — ${escapeHtml(r.name)}</title><link rel="stylesheet" href="/style.css">
    <style>
      @page{size:A4;margin:20mm;}
      .icr-wrap{max-width:170mm;margin:40px auto;}
      .icr-header{text-align:center;margin-bottom:30px;}
      .icr-header h1{color:var(--navy);margin:0 0 6px;font-size:22px;}
      .icr-header p{color:var(--muted);margin:0;font-size:13px;}
      .icr-info{display:grid;grid-template-columns:1fr 1fr;gap:10px 24px;font-size:14px;margin-bottom:26px;padding:16px 20px;background:#f4f6f9;border-radius:10px;}
      .icr-table{width:100%;border-collapse:collapse;font-size:14px;}
      .icr-table th,.icr-table td{border:1px solid var(--border);padding:12px 14px;text-align:center;}
      .icr-table th{background:var(--navy);color:#fff;}
      .icr-final-row td{background:#fbf1dc;font-weight:800;font-size:16px;}
      .icr-comment{margin-top:24px;font-size:13.5px;padding:14px 18px;background:#f4f6f9;border-radius:10px;}
      .icr-signature{margin-top:60px;display:flex;justify-content:space-between;font-size:13px;}
      .icr-signature div{width:40%;text-align:center;border-top:1px solid #333;padding-top:6px;}
    </style></head><body>
    <div class="icr-wrap">
      <div class="icr-header"><h1>${escapeHtml(schoolName || 'Nibras Educational Complex')}</h1><p>Continuous Assessment Result</p></div>
      <div class="icr-info">
        <span><b>Student:</b> ${escapeHtml(r.name)}</span><span><b>Student ID:</b> ${escapeHtml(r.studentId)}</span>
        <span><b>Class:</b> ${escapeHtml(className)}</span><span><b>Subject:</b> ${escapeHtml(subjectName)}</span>
        <span><b>Term:</b> ${escapeHtml(termName)}</span><span><b>SBA / Exam weighting:</b> ${cfg.caWeight}% / ${cfg.examWeight}%</span>
      </div>
      <table class="icr-table">
        <thead><tr><th>Component</th><th>Score</th><th>Maximum</th></tr></thead>
        <tbody>
          <tr><td>${escapeHtml(cfg.c1.name)}</td><td>${r.ce}</td><td>${cfg.c1.max}</td></tr>
          <tr><td>${escapeHtml(cfg.c2.name)}</td><td>${r.ct}</td><td>${cfg.c2.max}</td></tr>
          <tr><td>${escapeHtml(cfg.c3.name)}</td><td>${r.gw}</td><td>${cfg.c3.max}</td></tr>
          <tr><td>${escapeHtml(cfg.c4.name)}</td><td>${r.pw}</td><td>${cfg.c4.max}</td></tr>
          <tr><td>Examination</td><td>${r.exam}</td><td>${cfg.examMax}</td></tr>
          <tr class="icr-final-row"><td>Final Score</td><td colspan="2">${Math.round(r.final)} / 100</td></tr>
        </tbody>
      </table>
      ${r.comment ? `<div class="icr-comment"><b>Teacher's Comment:</b> ${escapeHtml(r.comment)}</div>` : ''}
      <div class="icr-signature">
        <div>Subject Teacher's Signature</div>
        <div>Date</div>
      </div>
    </div>
    <script>window.print()<\/script></body></html>`);
  win.document.close();
}

function printSbaRecordSheet(rows, className, subjectName, termName, schoolName, cfg) {
  cfg = cfg || { c1: { name: 'Class Exercise', max: 15 }, c2: { name: 'Class Test', max: 15 }, c3: { name: 'Group Work', max: 15 }, c4: { name: 'Project Work', max: 15 }, examMax: 100, caWeight: 50, examWeight: 50 };
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>SBA Record Sheet</title><link rel="stylesheet" href="/style.css"></head>
    <body style="padding:24px"><div class="report-card">
      <div class="rc-title-band">SCHOOL-BASED ASSESSMENT (SBA) RECORD SHEET</div>
      <p style="margin-top:12px"><b>${escapeHtml(schoolName || 'Nibras Educational Complex')}</b></p>
      <p><b>Class:</b> ${escapeHtml(className)} &nbsp;&nbsp; <b>Subject:</b> ${escapeHtml(subjectName)} &nbsp;&nbsp; <b>Term:</b> ${escapeHtml(termName)}</p>
      <p class="small-text">SBA components weighted at ${cfg.caWeight}% &nbsp;·&nbsp; Exam weighted at ${cfg.examWeight}%</p>
      <table class="rc-table" style="margin-top:14px"><thead><tr>
        <th>#</th><th style="text-align:left">Student Name</th><th style="text-align:left">Student ID</th>
        <th>${escapeHtml(cfg.c1.name)}<br><span>/${cfg.c1.max}</span></th><th>${escapeHtml(cfg.c2.name)}<br><span>/${cfg.c2.max}</span></th>
        <th>${escapeHtml(cfg.c3.name)}<br><span>/${cfg.c3.max}</span></th><th>${escapeHtml(cfg.c4.name)}<br><span>/${cfg.c4.max}</span></th>
        <th>Exam<br><span>/${cfg.examMax}</span></th><th>Final<br><span>/100</span></th></tr></thead>
      <tbody>${rows.map((r, i) => `<tr><td>${i + 1}</td><td class="rc-subject">${escapeHtml(r.name)}</td><td>${escapeHtml(r.studentId)}</td>
        <td>${r.ce}</td><td>${r.ct}</td><td>${r.gw}</td><td>${r.pw}</td><td>${r.exam}</td><td class="rc-final">${Math.round(r.final)}</td></tr>`).join('') || '<tr><td colspan=9 class="muted" style="text-align:center">No students</td></tr>'}</tbody></table>
      <div class="rc-signatures" style="margin-top:30px">
        <div class="rc-sig"><div class="rc-sig-line"></div>Subject Teacher's Signature</div>
        <div class="rc-sig"><div class="rc-sig-line"></div>Head Teacher's Signature</div>
      </div>
    </div><script>window.print()<\/script></body></html>`);
  win.document.close();
}

// ---------- Batch: print every student in a class as individual report card sheets ----------
async function generateClassReportCards() {
  const classId = document.getElementById('bulk-rc-class').value;
  const termId = document.getElementById('bulk-rc-term').value;
  if (!classId || !termId) return alert('Select a class and a term first.');
  const out = document.getElementById('bulk-rc-output');
  out.innerHTML = '<div class="empty-state">Generating report cards, please wait…</div>';
  try {
    const [students, grading] = await Promise.all([
      api(`/students?class_id=${classId}&status=Active&pageSize=1000`),
      api('/grading_system?pageSize=50'),
    ]);
    if (!students.rows.length) { out.innerHTML = '<div class="empty-state">No active students in this class.</div>'; return; }
    const cards = [];
    for (const student of students.rows) {
      const rc = await api(`/report-card?student_id=${student.id}&term_id=${termId}`);
      cards.push(buildReportCardHtml(rc, grading.rows));
    }
    out.innerHTML = `<div id="bulk-report-sheets">${cards.map(c => `<div class="rc-sheet">${c}</div>`).join('')}</div>
      <div class="no-print" style="margin-top:14px">
        <button class="btn gold" onclick="window.print()">Print All ${cards.length} Report Cards</button>
        <span class="small-text">&nbsp; Each student's report card prints on its own page.</span>
      </div>`;
  } catch (e) { out.innerHTML = `<div class="empty-state">${escapeHtml(e.message)}</div>`; }
}

// ---------- Grading System management (add/edit/delete BECE-style grade bands) ----------
function setupGradingPanel() {
  document.getElementById('bulk-rc-load')?.addEventListener('click', generateClassReportCards);

  document.getElementById('add-grade-btn')?.addEventListener('click', () => openGradeForm(null));
  document.querySelectorAll('.edit-grade-btn').forEach(btn => btn.addEventListener('click', (e) => {
    const tr = e.target.closest('tr');
    openGradeForm({ id: tr.dataset.id, cells: [...tr.querySelectorAll('td')].map(td => td.textContent.trim()) });
  }));
  document.querySelectorAll('.del-grade-btn').forEach(btn => btn.addEventListener('click', async (e) => {
    if (!confirm('Delete this grade band?')) return;
    const id = e.target.closest('tr').dataset.id;
    await api(`/grading_system/${id}`, { method: 'DELETE' });
    renderResults();
  }));
}

function openGradeForm(existing) {
  const modal = el(`<div class="modal-backdrop"><div class="modal" style="width:420px">
    <h3>${existing ? 'Edit' : 'Add'} Grade Band</h3>
    <form id="grade-form">
      <label>Grade Label (e.g. 1, 2, 3…)</label><input name="grade" required value="${existing ? escapeHtml(existing.cells[0]) : ''}">
      <label>Minimum %</label><input name="min_score" type="number" step="0.01" required value="${existing ? existing.cells[1] : ''}">
      <label>Maximum %</label><input name="max_score" type="number" step="0.01" required value="${existing ? existing.cells[2] : ''}">
      <label>Description</label><input name="description" value="${existing ? escapeHtml(existing.cells[3]) : ''}">
      <div class="modal-actions"><button type="button" class="btn secondary" id="cancel-grade">Cancel</button><button type="submit" class="btn gold">Save</button></div>
    </form>
  </div></div>`);
  document.body.appendChild(modal);
  modal.querySelector('#cancel-grade').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  modal.querySelector('#grade-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = { grade: fd.get('grade'), min_score: Number(fd.get('min_score')), max_score: Number(fd.get('max_score')), description: fd.get('description') };
    try {
      if (existing) await api(`/grading_system/${existing.id}`, { method: 'PUT', body });
      else await api('/grading_system', { method: 'POST', body });
      modal.remove();
      renderResults();
    } catch (err) { alert(err.message); }
  });
}

// ---------- Performance Report (whole-school / whole-class ranking) ----------
// Builds a hand-drawn SVG line chart comparing one student's average score across every term
// in the academic year — no charting library, in keeping with this project's zero-dependency
// build, in the same spirit as its from-scratch QR encoder and PDF writer.
function buildTermTrendChart(data) {
  const points = data.points || [];
  const scored = points.filter(p => p.average != null);
  if (!scored.length) {
    return `<div class="empty-state">No results recorded for ${escapeHtml(data.student.name)} in any term yet.</div>`;
  }
  const W = 640, H = 280, padL = 50, padR = 30, padT = 24, padB = 44;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const stepX = points.length > 1 ? plotW / (points.length - 1) : 0;
  const yFor = (score) => padT + plotH - (score / 100) * plotH;
  const xFor = (i) => padL + i * stepX;

  const gridLines = [0, 25, 50, 75, 100].map(v => `
    <line x1="${padL}" y1="${yFor(v)}" x2="${W - padR}" y2="${yFor(v)}" stroke="#e3e7ee" stroke-width="1"/>
    <text x="${padL - 8}" y="${yFor(v) + 4}" font-size="11" fill="#5f6b7a" text-anchor="end">${v}</text>`).join('');

  const linePath = points.map((p, i) => p.average != null ? `${i === 0 || points[i - 1].average == null ? 'M' : 'L'} ${xFor(i)} ${yFor(p.average)}` : '').filter(Boolean).join(' ');

  const dots = points.map((p, i) => p.average != null ? `
    <circle cx="${xFor(i)}" cy="${yFor(p.average)}" r="5" fill="#c8973a" stroke="#0f2a4a" stroke-width="1.5"/>
    <text x="${xFor(i)}" y="${yFor(p.average) - 12}" font-size="12" font-weight="700" fill="#0f2a4a" text-anchor="middle">${p.average}</text>` : '').join('');

  const xLabels = points.map((p, i) => `<text x="${xFor(i)}" y="${H - padB + 22}" font-size="12" fill="#1c2530" text-anchor="middle">${escapeHtml(p.term_name)}</text>`).join('');

  const trendNote = (() => {
    if (scored.length < 2) return '';
    const first = scored[0].average, last = scored[scored.length - 1].average;
    if (last > first) return `<span class="rc-result-pass">▲ Improved by ${last - first} points from ${escapeHtml(scored[0].term_name)} to ${escapeHtml(scored[scored.length - 1].term_name)}</span>`;
    if (last < first) return `<span class="rc-result-fail">▼ Dropped by ${first - last} points from ${escapeHtml(scored[0].term_name)} to ${escapeHtml(scored[scored.length - 1].term_name)}</span>`;
    return `<span class="muted">No change from ${escapeHtml(scored[0].term_name)} to ${escapeHtml(scored[scored.length - 1].term_name)}</span>`;
  })();

  return `
    <p style="margin-top:12px"><b>${escapeHtml(data.student.name)}</b> (${escapeHtml(data.student.student_id)}) — ${trendNote}</p>
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:680px;height:auto;background:#fff;border-radius:10px;border:1px solid var(--border)">
      ${gridLines}
      <path d="${linePath}" fill="none" stroke="#0f2a4a" stroke-width="2.5"/>
      ${dots}
      ${xLabels}
    </svg>
    <div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>Term</th><th>Average</th><th>Subjects Recorded</th></tr></thead>
      <tbody>${points.map(p => `<tr><td>${escapeHtml(p.term_name)}</td><td>${p.average ?? '<span class="muted">No results</span>'}</td><td>${p.subjects_count}</td></tr>`).join('')}</tbody></table></div>`;
}

async function renderPerformanceReport() {
  const content = document.getElementById('content');
  const [classes, terms] = await Promise.all([api('/classes?pageSize=200'), api('/terms?pageSize=200')]);
  content.innerHTML = `<div class="page-header"><h2>Performance Report</h2></div>
    <div class="notice">Ranks every active student by their average Final Score across all subjects recorded for the selected term. Leave class as "All Classes" for a whole-school ranking, or pick one class to rank within it.</div>
    <div class="toolbar">
      <select id="perf-class"><option value="">All Classes</option>${classes.rows.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select>
      <select id="perf-term"><option value="">Term…</option>${terms.rows.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('')}</select>
      <button class="btn secondary" id="perf-load">Generate Ranking</button>
    </div>
    <div id="perf-output"></div>

    <div class="card">
      <h3 style="margin-top:0;color:var(--navy)">Student Analysis — Term-over-Term Comparison</h3>
      <p class="small-text">Compares one student's average score across every term in the academic year, from Term 1 through Term 3.</p>
      <div class="toolbar">
        <input type="text" id="trend-student-id" placeholder="Student ID (e.g. NIB/2026/001)" style="max-width:220px">
        <button class="btn secondary" id="trend-load">Compare</button>
      </div>
      <div id="trend-output"></div>
    </div>`;

  document.getElementById('trend-load').addEventListener('click', async () => {
    const studentId = document.getElementById('trend-student-id').value.trim();
    if (!studentId) return alert('Enter a Student ID.');
    const out = document.getElementById('trend-output');
    out.innerHTML = '<div class="empty-state">Loading…</div>';
    try {
      const data = await api(`/performance-report/student-trend?student_id=${encodeURIComponent(studentId)}`);
      out.innerHTML = buildTermTrendChart(data);
    } catch (e) { out.innerHTML = `<div class="empty-state">${escapeHtml(e.message)}</div>`; }
  });

  document.getElementById('perf-load').addEventListener('click', async () => {
    const classId = document.getElementById('perf-class').value;
    const termId = document.getElementById('perf-term').value;
    if (!termId) return alert('Select a term.');
    const out = document.getElementById('perf-output');
    out.innerHTML = '<div class="empty-state">Loading…</div>';
    try {
      const data = await api(`/performance-report?term_id=${termId}${classId ? '&class_id=' + classId : ''}`);
      const logoUrl = data.school.logo_photo ? `/uploads/${encodeURIComponent(data.school.logo_photo)}` : '/assets/logo.png';
      out.innerHTML = `
        <div class="report-card" id="performance-print">
          <div class="rc-header">
            <img class="rc-logo" src="${logoUrl}" alt="School logo">
            <div class="rc-header-text">
              <h1>${escapeHtml(data.school.school_name || 'Nibras Educational Complex')}</h1>
              <p class="rc-motto">"${escapeHtml(data.school.motto || 'Knowledge is Light')}"</p>
            </div>
          </div>
          <div class="rc-title-band">PERFORMANCE RANKING &nbsp;·&nbsp; ${escapeHtml(data.class_name)} &nbsp;·&nbsp; ${escapeHtml(data.academic_year)} ${escapeHtml(data.term)}</div>
          <table class="rc-table" style="margin-top:18px">
            <thead><tr><th>Position</th><th style="text-align:left">Student</th><th style="text-align:left">Student ID</th><th style="text-align:left">Class</th><th>Subjects</th><th>Average</th><th>Grade</th></tr></thead>
            <tbody>${data.rows.map(r => `<tr>
              <td class="rc-final">${ordinal(r.position)}</td>
              <td class="rc-subject">${escapeHtml(r.name)}</td>
              <td>${escapeHtml(r.student_id)}</td>
              <td>${escapeHtml(r.class_name)}</td>
              <td>${r.subjects_count}</td>
              <td class="rc-final">${r.average}</td>
              <td class="rc-grade rc-grade-${escapeHtml(r.grade)}">${escapeHtml(r.grade)}</td>
            </tr>`).join('') || `<tr><td colspan="7" class="muted" style="text-align:center;padding:20px">No results recorded for this selection yet.</td></tr>`}
            </tbody>
          </table>
          <p class="small-text no-print" style="margin-top:14px">Generated ${new Date().toLocaleDateString()} &nbsp;·&nbsp; ${data.rows.length} student(s) ranked</p>
        </div>
        <div class="no-print" style="margin-top:14px"><button class="btn gold" onclick="window.print()">Print Full List</button></div>`;
    } catch (e) { out.innerHTML = `<div class="empty-state">${escapeHtml(e.message)}</div>`; }
  });
}

// ---------- Timetable ----------
const WEEKDAY_OPTIONS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Counts how many periods per week each subject occupies on a class's timetable — a quick way
// to sanity-check the schedule (e.g. "Maths only has 2 periods this week, is that right?").
function buildSubjectsPerWeekSummary(entries) {
  const counts = {};
  entries.forEach(e => { if (e.subject_name) counts[e.subject_name] = (counts[e.subject_name] || 0) + 1; });
  const subjectNames = Object.keys(counts).sort();
  if (!subjectNames.length) return '';
  return `<div class="card" style="margin-top:14px">
    <h3 style="margin-top:0;color:var(--navy)">Subjects Per Week</h3>
    <div class="table-wrap"><table><thead><tr><th>Subject</th><th>Periods / Week</th></tr></thead>
      <tbody>${subjectNames.map(name => `<tr><td>${escapeHtml(name)}</td><td>${counts[name]}</td></tr>`).join('')}</tbody></table></div>
  </div>`;
}

// Exam Schedule — date/time/venue per subject per class, distinct from the day-to-day class
// Timetable. Students and Parents get a read-only view (server-scoped to their own class);
// Teachers and admins get the full add/edit/delete toolset.
// ---------- Live Class Rooms (WebRTC, peer-to-peer, HTTP-polling signaling) ----------
// A free public STUN server — just a URL, no account or dependency — lets two browsers on
// different networks discover how to reach each other. On a school LAN this often isn't even
// needed, but it's cheap insurance for anyone joining from home. No TURN server is configured
// (that would need a real paid/hosted service), so a connection can fail if both sides are
// behind especially strict firewalls/NAT — acceptable for a school's own network, which is the
// primary use case here.
const LIVE_CLASS_ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
const liveClassState = {
  roomId: null, localStream: null, peerConnections: {}, lastSignalId: 0,
  pollTimer: null, participantsTimer: null, knownParticipantIds: new Set(),
};
window.liveClassState = liveClassState; // exposed for diagnostics/testing

function stopLiveClassPolling() {
  if (liveClassState.pollTimer) clearInterval(liveClassState.pollTimer);
  if (liveClassState.participantsTimer) clearInterval(liveClassState.participantsTimer);
  liveClassState.pollTimer = null; liveClassState.participantsTimer = null;
}
function teardownLiveClass() {
  stopLiveClassPolling();
  Object.values(liveClassState.peerConnections).forEach(pc => pc.close());
  liveClassState.peerConnections = {};
  liveClassState.knownParticipantIds = new Set();
  if (liveClassState.localStream) { liveClassState.localStream.getTracks().forEach(t => t.stop()); liveClassState.localStream = null; }
  liveClassState.roomId = null; liveClassState.lastSignalId = 0;
}

async function renderLiveClassRooms() {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="empty-state">Loading…</div>';
  if (state.user.role === 'Teacher') return renderTeacherLiveClass();
  if (state.user.role === 'Student') return renderStudentLiveClass();
  content.innerHTML = `<div class="page-header"><h2>Live Class Rooms</h2></div><div class="empty-state">Live classes are hosted by teachers and joined by students in that class.</div>`;
}

async function renderTeacherLiveClass() {
  const content = document.getElementById('content');
  const myRooms = (await api('/live_class_rooms?status=active')).rows;
  const activeRoom = myRooms[0];
  if (activeRoom) return renderTeacherActiveRoom(activeRoom);

  const [classesRes, subjectsRes] = await Promise.all([api('/classes?pageSize=200'), api('/subjects?pageSize=200')]);
  content.innerHTML = `<div class="page-header"><h2>📹 Live Class Rooms</h2></div>
    <div class="card">
      <h3 style="margin-top:0;color:var(--navy)">Start a Live Class</h3>
      <p class="small-text">Your camera streams directly to each student's browser who joins — no separate app, they just open Live Class Rooms in their own portal.</p>
      <div class="form-grid">
        <div><label>Class *</label><select id="live-class-select">${classesRes.rows.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select></div>
        <div><label>Subject</label><select id="live-subject-select"><option value="">— None —</option>${subjectsRes.rows.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}</select></div>
      </div>
      <label>Session Title</label><input type="text" id="live-title-input" value="Live Class" placeholder="e.g. Term 2 Maths Revision">
      <button type="button" class="btn gold" id="start-live-class-btn" style="margin-top:12px">🔴 Start Live Class</button>
      <p class="small-text" id="live-start-error" style="color:var(--red);margin-top:8px"></p>
    </div>`;
  document.getElementById('start-live-class-btn').addEventListener('click', async () => {
    const classId = document.getElementById('live-class-select').value;
    const subjectId = document.getElementById('live-subject-select').value;
    const title = document.getElementById('live-title-input').value || 'Live Class';
    const errEl = document.getElementById('live-start-error');
    errEl.textContent = '';
    try {
      liveClassState.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch (e) {
      errEl.textContent = 'Could not access your camera/microphone: ' + e.message + '. Check browser permissions.';
      return;
    }
    try {
      const room = await api('/live_class_rooms', { method: 'POST', body: { class_id: Number(classId), subject_id: subjectId ? Number(subjectId) : null, title } });
      liveClassState.roomId = room.id;
      renderTeacherActiveRoom({ id: room.id, class_id: Number(classId), title });
    } catch (e) {
      errEl.textContent = e.message;
      liveClassState.localStream.getTracks().forEach(t => t.stop());
    }
  });
}

async function renderTeacherActiveRoom(room) {
  const content = document.getElementById('content');
  liveClassState.roomId = room.id;
  content.innerHTML = `<div class="page-header"><h2>📹 ${escapeHtml(room.title || 'Live Class')}</h2>
    <button type="button" class="btn secondary" id="end-live-class-btn" style="border-color:var(--red);color:var(--red)">⏹ End Class</button></div>
    <div class="card">
      <video id="live-local-video" autoplay playsinline muted style="width:100%;max-width:480px;border-radius:10px;background:#000"></video>
      <p class="small-text" style="margin-top:8px">This is what students see and hear. Students currently in this class:</p>
      <div id="live-participants-list" class="table-wrap"><div class="empty-state">Waiting for students to join…</div></div>
    </div>`;
  const videoEl = document.getElementById('live-local-video');
  if (!liveClassState.localStream) {
    try { liveClassState.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); }
    catch (e) { alert('Could not access camera/microphone: ' + e.message); return; }
  }
  videoEl.srcObject = liveClassState.localStream;

  document.getElementById('end-live-class-btn').addEventListener('click', async () => {
    if (!confirm('End this live class for everyone?')) return;
    await api(`/live-rooms/${room.id}/end`, { method: 'POST' });
    teardownLiveClass();
    renderLiveClassRooms();
  });

  // Every 2s: check for newly-joined students and open a peer connection to each one we
  // haven't already connected to.
  liveClassState.participantsTimer = setInterval(async () => {
    try {
      const participants = await api(`/live-rooms/${room.id}/participants`);
      renderParticipantsList(participants);
      for (const p of participants) {
        if (!liveClassState.knownParticipantIds.has(p.user_id)) {
          liveClassState.knownParticipantIds.add(p.user_id);
          teacherConnectToStudent(room.id, p.user_id);
        }
      }
    } catch (e) { /* a missed poll tick isn't fatal — just try again next time */ }
  }, 2000);
  // Every 2s: check for signaling replies (answers, ICE candidates) from any connected student.
  liveClassState.pollTimer = setInterval(() => pollLiveClassSignals(room.id), 2000);
}

function renderParticipantsList(participants) {
  const el2 = document.getElementById('live-participants-list');
  if (!el2) return;
  if (!participants.length) { el2.innerHTML = '<div class="empty-state">Waiting for students to join…</div>'; return; }
  el2.innerHTML = `<table><thead><tr><th>Student</th><th>Joined</th></tr></thead><tbody>
    ${participants.map(p => `<tr><td>${escapeHtml(p.display_name)}</td><td>${escapeHtml(p.joined_at)}</td></tr>`).join('')}
  </tbody></table>`;
}

// Teacher's side of connecting to one student: create the peer connection, attach the local
// camera/mic tracks, and send an SDP "offer" — the technical description of what we want to
// stream — addressed to that student's user id.
async function teacherConnectToStudent(roomId, studentUserId) {
  const pc = new RTCPeerConnection({ iceServers: LIVE_CLASS_ICE_SERVERS });
  liveClassState.peerConnections[studentUserId] = pc;
  liveClassState.localStream.getTracks().forEach(track => pc.addTrack(track, liveClassState.localStream));
  pc.onicecandidate = (e) => {
    if (e.candidate) api(`/live-rooms/${roomId}/signal`, { method: 'POST', body: { to_user_id: studentUserId, signal_type: 'ice-candidate', payload: e.candidate } }).catch(() => {});
  };
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await api(`/live-rooms/${roomId}/signal`, { method: 'POST', body: { to_user_id: studentUserId, signal_type: 'offer', payload: offer } });
}

async function pollLiveClassSignals(roomId) {
  try {
    const signals = await api(`/live-rooms/${roomId}/signals?since=${liveClassState.lastSignalId}`);
    for (const sig of signals) {
      liveClassState.lastSignalId = Math.max(liveClassState.lastSignalId, sig.id);
      const pc = liveClassState.peerConnections[sig.from_user_id];
      if (!pc) continue;
      if (sig.signal_type === 'answer') await pc.setRemoteDescription(new RTCSessionDescription(sig.payload));
      else if (sig.signal_type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(sig.payload));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await api(`/live-rooms/${roomId}/signal`, { method: 'POST', body: { to_user_id: sig.from_user_id, signal_type: 'answer', payload: answer } });
      } else if (sig.signal_type === 'ice-candidate') {
        try { await pc.addIceCandidate(new RTCIceCandidate(sig.payload)); } catch (e) { /* a stray/late candidate isn't fatal */ }
      }
    }
  } catch (e) { /* a missed poll tick isn't fatal — just try again next time */ }
}

async function renderStudentLiveClass() {
  const content = document.getElementById('content');
  const room = await api('/live-rooms/active-for-my-class');
  if (!room) {
    content.innerHTML = `<div class="page-header"><h2>📹 Live Class Rooms</h2></div>
      <div class="empty-state">No live class right now. When your teacher starts one, it'll appear here — check back, or refresh this page.</div>`;
    return;
  }
  content.innerHTML = `<div class="page-header"><h2>📹 ${escapeHtml(room.title || 'Live Class')}</h2></div>
    <div class="notice">🔴 Live now — hosted by ${escapeHtml(room.teacher_name || 'your teacher')}${room.subject_name ? ' · ' + escapeHtml(room.subject_name) : ''}</div>
    <div class="card" id="live-join-card">
      <button type="button" class="btn gold" id="join-live-class-btn">▶ Join Live Class</button>
    </div>`;
  document.getElementById('join-live-class-btn').addEventListener('click', async () => {
    const card = document.getElementById('live-join-card');
    card.innerHTML = '<div class="empty-state">Connecting…</div>';
    try {
      await api(`/live-rooms/${room.id}/join`, { method: 'POST' });
      liveClassState.roomId = room.id;
      card.innerHTML = `<video id="live-remote-video" autoplay playsinline style="width:100%;max-width:640px;border-radius:10px;background:#000"></video>
        <p class="small-text" id="live-connect-status" style="margin-top:8px">Waiting for the teacher's video to connect…</p>
        <button type="button" class="btn secondary" id="leave-live-class-btn" style="margin-top:8px">Leave Class</button>`;
      document.getElementById('leave-live-class-btn').addEventListener('click', async () => {
        await api(`/live-rooms/${room.id}/leave`, { method: 'POST' }).catch(() => {});
        teardownLiveClass();
        renderStudentLiveClass();
      });
      studentConnectToTeacher(room.id, room.teacher_user_id);
    } catch (e) {
      card.innerHTML = `<div class="empty-state">${escapeHtml(e.message)}</div>`;
    }
  });
}

// Student's side: a receive-only peer connection (we never send our own camera — this is a
// teacher-broadcasts model, not a two-way video call), waiting for the teacher's offer to
// arrive via the signal poll below, then answering it.
async function studentConnectToTeacher(roomId, teacherUserId) {
  const pc = new RTCPeerConnection({ iceServers: LIVE_CLASS_ICE_SERVERS });
  liveClassState.peerConnections[teacherUserId] = pc;
  pc.ontrack = (e) => {
    const videoEl = document.getElementById('live-remote-video');
    if (videoEl && videoEl.srcObject !== e.streams[0]) {
      videoEl.srcObject = e.streams[0];
      const statusEl = document.getElementById('live-connect-status');
      if (statusEl) statusEl.textContent = '✓ Connected';
    }
  };
  pc.onicecandidate = (e) => {
    if (e.candidate) api(`/live-rooms/${roomId}/signal`, { method: 'POST', body: { to_user_id: teacherUserId, signal_type: 'ice-candidate', payload: e.candidate } }).catch(() => {});
  };
  liveClassState.pollTimer = setInterval(() => pollLiveClassSignals(roomId), 2000);
}

async function renderExamSchedule() {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="empty-state">Loading…</div>';
  const isStudentOrParent = state.user.role === 'Student' || state.user.role === 'Parent/Guardian';
  // A Student/Parent has no permission on Classes/Subjects at all (and doesn't need it — they
  // get no filters and no add/edit UI), so skip those two calls entirely for them rather than
  // let a 403 on either one silently fail the whole page load.
  const [classes, subjects, terms] = isStudentOrParent
    ? [{ rows: [] }, { rows: [] }, { rows: [] }]
    : await Promise.all([api('/classes?pageSize=200'), api('/subjects?pageSize=200'), api('/terms?pageSize=200')]);
  content.innerHTML = `
    <div class="page-header"><h2>Exam Schedule</h2>
      <div style="display:flex;gap:8px">
        <button class="btn secondary" id="print-exam-btn">🖶 Print Schedule</button>
        ${can('exam_schedule', 'add') ? `<button class="btn gold" id="add-exam-btn">+ Add Exam</button>` : ''}
      </div></div>
    ${!isStudentOrParent ? `<div class="toolbar">
      <select id="exam-class-filter"><option value="">All Classes</option>${classes.rows.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select>
      <select id="exam-term-filter"><option value="">All Terms</option>${terms.rows.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('')}</select>
      <button class="btn secondary" id="exam-filter-btn">Filter</button>
    </div>` : ''}
    <div id="exam-list"></div>`;

  let lastLoadedRows = [];
  async function loadList() {
    const classId = document.getElementById('exam-class-filter')?.value;
    const termId = document.getElementById('exam-term-filter')?.value;
    let query = '';
    if (classId) query += `&class_id=${classId}`;
    if (termId) query += `&term_id=${termId}`;
    const rows = (await api(`/exam_schedule?pageSize=500${query}`)).rows;
    lastLoadedRows = rows;
    const listEl = document.getElementById('exam-list');
    listEl.innerHTML = `<div class="table-wrap"><table><thead><tr>
        <th>Date</th><th>Time</th><th>Subject</th><th>Class</th><th>Term</th><th>Venue</th><th>Notes</th>${!isStudentOrParent ? '<th></th>' : ''}
      </tr></thead><tbody>
      ${rows.map(r => `<tr data-id="${r.id}">
        <td>${escapeHtml(r.exam_date)}</td>
        <td>${r.start_time ? escapeHtml(r.start_time) + (r.end_time ? ' – ' + escapeHtml(r.end_time) : '') : '—'}</td>
        <td>${escapeHtml(r.subject_name)}</td><td>${escapeHtml(r.class_name)}</td><td>${escapeHtml(r.term_name || '—')}</td>
        <td>${escapeHtml(r.venue || '—')}</td><td class="small-text">${escapeHtml(r.notes || '')}</td>
        ${!isStudentOrParent ? `<td>${can('exam_schedule', 'edit') ? `<button class="edit-exam-btn">Edit</button>` : ''}${can('exam_schedule', 'delete') ? `<button class="del-exam-btn">Delete</button>` : ''}</td>` : ''}
      </tr>`).join('') || `<tr><td colspan="${isStudentOrParent ? 7 : 8}" class="muted">No exams scheduled${classId || termId ? ' for this filter' : ' yet'}.</td></tr>`}
      </tbody></table></div>`;
    listEl.querySelectorAll('.edit-exam-btn').forEach(btn => btn.addEventListener('click', () => {
      const id = Number(btn.closest('tr').dataset.id);
      openExamScheduleForm(classes.rows, subjects.rows, terms.rows, rows.find(r => r.id === id), loadList);
    }));
    listEl.querySelectorAll('.del-exam-btn').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Delete this exam schedule entry?')) return;
      await api(`/exam_schedule/${btn.closest('tr').dataset.id}`, { method: 'DELETE' });
      loadList();
    }));
  }
  await loadList();
  document.getElementById('exam-filter-btn')?.addEventListener('click', loadList);
  document.getElementById('add-exam-btn')?.addEventListener('click', () => openExamScheduleForm(classes.rows, subjects.rows, terms.rows, null, loadList));
  document.getElementById('print-exam-btn').addEventListener('click', async () => {
    const settings = await api('/public-settings').catch(() => ({}));
    printExamSchedule(lastLoadedRows, settings.school_name);
  });
}

// Prints the currently-filtered exam schedule as a clean list — whatever filter (class/term)
// is active on screen is exactly what gets printed, since it prints the same rows shown.
function printExamSchedule(rows, schoolName) {
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>Exam Schedule</title><link rel="stylesheet" href="/style.css"></head>
    <body style="padding:24px"><div class="report-card">
      <div class="rc-title-band">EXAM SCHEDULE</div>
      <p style="text-align:center;margin:10px 0">${escapeHtml(schoolName || 'Nibras Educational Complex')}</p>
      <table class="rc-table" style="margin-top:14px"><thead><tr>
        <th>Date</th><th>Time</th><th>Subject</th><th>Class</th><th>Term</th><th>Venue</th><th>Notes</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td>${escapeHtml(r.exam_date)}</td>
        <td>${r.start_time ? escapeHtml(r.start_time) + (r.end_time ? ' – ' + escapeHtml(r.end_time) : '') : '—'}</td>
        <td class="rc-subject">${escapeHtml(r.subject_name)}</td><td>${escapeHtml(r.class_name)}</td><td>${escapeHtml(r.term_name || '—')}</td>
        <td>${escapeHtml(r.venue || '—')}</td><td>${escapeHtml(r.notes || '')}</td>
      </tr>`).join('') || '<tr><td colspan=7 class="muted" style="text-align:center">No exams scheduled</td></tr>'}</tbody></table>
    </div><script>window.print()<\/script></body></html>`);
  win.document.close();
}

function openExamScheduleForm(classesRows, subjectsRows, termsRows, existing, onSaved) {
  const modal = el(`<div class="modal-backdrop"><div class="modal" style="width:440px">
    <h3>${existing ? 'Edit' : 'Add'} Exam Schedule Entry</h3>
    <form id="exam-form">
      <div class="form-grid">
        <div><label>Class *</label><select name="class_id" required>${classesRows.map(c => `<option value="${c.id}" ${existing?.class_id === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}</select></div>
        <div><label>Subject *</label><select name="subject_id" required>${subjectsRows.map(s => `<option value="${s.id}" ${existing?.subject_id === s.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('')}</select></div>
      </div>
      <div class="form-grid">
        <div><label>Term</label><select name="term_id"><option value="">— None —</option>${termsRows.map(t => `<option value="${t.id}" ${existing?.term_id === t.id ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('')}</select></div>
        <div><label>Exam Date *</label><input type="date" name="exam_date" required value="${existing?.exam_date || ''}"></div>
      </div>
      <div class="form-grid">
        <div><label>Start Time</label><input type="time" name="start_time" value="${existing?.start_time || ''}"></div>
        <div><label>End Time</label><input type="time" name="end_time" value="${existing?.end_time || ''}"></div>
      </div>
      <label>Venue</label><input type="text" name="venue" value="${escapeHtml(existing?.venue || '')}" placeholder="e.g. Main Hall">
      <label>Notes</label><textarea name="notes" rows="2">${escapeHtml(existing?.notes || '')}</textarea>
      <div class="modal-actions"><button type="button" class="btn secondary" id="exam-cancel">Cancel</button><button type="submit" class="btn gold">${existing ? 'Save' : 'Add'}</button></div>
    </form>
  </div></div>`);
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  modal.querySelector('#exam-cancel').addEventListener('click', () => modal.remove());
  modal.querySelector('#exam-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = { class_id: Number(fd.get('class_id')), subject_id: Number(fd.get('subject_id')), term_id: fd.get('term_id') || null,
      exam_date: fd.get('exam_date'), start_time: fd.get('start_time') || null, end_time: fd.get('end_time') || null,
      venue: fd.get('venue') || null, notes: fd.get('notes') || null };
    try {
      if (existing) await api(`/exam_schedule/${existing.id}`, { method: 'PUT', body });
      else await api('/exam_schedule', { method: 'POST', body });
      modal.remove();
      onSaved();
    } catch (err) { alert(err.message); }
  });
}

async function renderTimetable() {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="empty-state">Loading…</div>';
  const [classes, subjects, teachers, config] = await Promise.all([
    api('/classes?pageSize=200'), api('/subjects?pageSize=200'), api('/teachers?pageSize=200'), api('/timetable-config'),
  ]);
  const activeWeekdays = config.weekdays.split(',').map(s => s.trim()).filter(Boolean);
  let perDayOverrides = {};
  try { perDayOverrides = config.periods_per_day_json ? JSON.parse(config.periods_per_day_json) : {}; } catch (e) { perDayOverrides = {}; }

  content.innerHTML = `
    <div class="page-header"><h2>Timetable</h2></div>
    <div class="notice">Works for every class — including Nursery and K.G. — since a timetable belongs to whichever class you pick below.</div>

    <div class="card">
      <div class="page-header" style="margin-bottom:10px"><h3 style="margin:0;color:var(--navy)">Weekly Schedule Settings</h3>
        <button class="btn secondary" id="save-timetable-config" style="padding:6px 12px;font-size:12.5px">Save Settings</button></div>
      <form id="timetable-config-form">
        <div class="form-grid">
          <div><label>Default Periods per Day</label><input type="number" name="periods_per_day" min="1" max="12" value="${config.periods_per_day}"></div>
          <div><label>Period Length (minutes)</label><input type="number" name="period_length_minutes" min="10" max="120" value="${config.period_length_minutes}"></div>
          <div><label>School Start Time</label><input type="time" name="school_start_time" value="${config.school_start_time}"></div>
          <div><label>Closing Time</label><input type="time" name="closing_time" value="${config.closing_time}"></div>
          <div><label>Break Time</label><input type="time" name="break_time" value="${config.break_time || ''}"></div>
          <div><label>Break Duration (min)</label><input type="number" name="break_duration_minutes" value="${config.break_duration_minutes ?? ''}"></div>
          <div><label>Lunch Time</label><input type="time" name="lunch_time" value="${config.lunch_time || ''}"></div>
          <div><label>Lunch Duration (min)</label><input type="number" name="lunch_duration_minutes" value="${config.lunch_duration_minutes ?? ''}"></div>
          <div><label>Prayer Time</label><input type="time" name="prayer_time" value="${config.prayer_time || ''}"></div>
          <div><label>Prayer Duration (min)</label><input type="number" name="prayer_duration_minutes" value="${config.prayer_duration_minutes ?? ''}"></div>
        </div>
        <div class="full" style="margin-top:12px">
          <label>School Days</label>
          <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:4px">
            ${WEEKDAY_OPTIONS.map(w => `<label style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:400;color:var(--text)">
              <input type="checkbox" name="weekday" value="${w}" ${activeWeekdays.includes(w) ? 'checked' : ''} class="tt-weekday-check"> ${w}</label>`).join('')}
          </div>
        </div>
        <div class="full" style="margin-top:14px" id="per-day-periods-block">
          <label>Periods on Each Day <span class="small-text">(override the default above for specific days — e.g. a shorter Friday)</span></label>
          <div id="per-day-periods-inputs" style="display:flex;gap:14px;flex-wrap:wrap;margin-top:4px"></div>
        </div>
      </form>
    </div>

    <div class="card">
      <div class="toolbar" style="margin-bottom:0">
        <select id="tt-class"><option value="">Select a class…</option>${classes.rows.map(c => `<option value="${c.id}">${escapeHtml(c.name)}${c.level ? ' (' + escapeHtml(c.level) + ')' : ''}</option>`).join('')}</select>
        <button class="btn secondary" id="tt-load">Load Timetable</button>
        <button class="btn secondary" id="tt-auto">⚡ Auto-Generate</button>
        <button class="btn secondary" id="tt-reshuffle">🔀 Reshuffle</button>
        <button class="btn secondary" id="tt-clear">Clear Class Timetable</button>
        <button class="btn gold" id="tt-print">🖶 Print</button>
      </div>
      <div id="tt-grid" style="margin-top:16px"></div>
    </div>

    <div class="card">
      <h3 style="margin-top:0;color:var(--navy)">Print Multiple Timetables</h3>
      <p class="small-text">Pick any number of classes and print all of their timetables in one go — each on its own page.</p>
      <div class="toolbar" style="margin-bottom:10px">
        <button class="btn secondary" id="tt-select-all-classes" style="padding:6px 12px;font-size:12.5px">Select All</button>
        <button class="btn secondary" id="tt-select-none-classes" style="padding:6px 12px;font-size:12.5px">Select None</button>
        <button class="btn gold" id="tt-print-multi">🖶 Print Selected</button>
      </div>
      <div class="tt-multi-class-grid">
        ${classes.rows.map(c => `<label class="tt-multi-class-item"><input type="checkbox" class="tt-multi-class-check" value="${c.id}" data-name="${escapeHtml(c.name)}"> ${escapeHtml(c.name)}</label>`).join('') || '<span class="muted">No classes yet</span>'}
      </div>
    </div>

    <div class="card">
      <div class="page-header" style="margin-bottom:10px"><h3 style="margin:0;color:var(--navy)">Duty Roster</h3>
        <div style="display:flex;gap:8px">
          <button class="btn secondary" id="duty-print-btn" style="padding:6px 12px;font-size:12.5px">🖶 Print</button>
          <button class="btn gold" id="duty-add-btn" style="padding:6px 12px;font-size:12.5px">+ Add Duty</button>
        </div>
      </div>
      <p class="small-text">Which staff are on duty (gate, assembly, compound, etc.) on each school day — separate from the class timetable above.</p>
      <div id="duty-roster-table"></div>
    </div>`;

  // Render one number input per currently-checked weekday, prefilled from any saved override.
  function renderPerDayInputs() {
    const checkedDays = [...document.querySelectorAll('.tt-weekday-check:checked')].map(cb => cb.value);
    document.getElementById('per-day-periods-inputs').innerHTML = checkedDays.map(w => `
      <div style="min-width:120px"><label style="font-size:12px">${w}</label>
        <input type="number" min="1" max="12" class="per-day-input" data-weekday="${w}" value="${perDayOverrides[w] ?? config.periods_per_day}"></div>
    `).join('');
  }
  document.querySelectorAll('.tt-weekday-check').forEach(cb => cb.addEventListener('change', renderPerDayInputs));
  renderPerDayInputs();

  document.getElementById('save-timetable-config').addEventListener('click', async () => {
    const form = document.getElementById('timetable-config-form');
    const fd = new FormData(form);
    const weekdaysChosen = fd.getAll('weekday');
    if (!weekdaysChosen.length) return alert('Choose at least one school day.');
    const periodsJson = {};
    document.querySelectorAll('.per-day-input').forEach(inp => { periodsJson[inp.dataset.weekday] = Number(inp.value) || config.periods_per_day; });
    const body = {
      periods_per_day: Number(fd.get('periods_per_day')), period_length_minutes: Number(fd.get('period_length_minutes')),
      school_start_time: fd.get('school_start_time'), closing_time: fd.get('closing_time'),
      break_time: fd.get('break_time') || null, break_duration_minutes: fd.get('break_duration_minutes') ? Number(fd.get('break_duration_minutes')) : null,
      lunch_time: fd.get('lunch_time') || null, lunch_duration_minutes: fd.get('lunch_duration_minutes') ? Number(fd.get('lunch_duration_minutes')) : null,
      prayer_time: fd.get('prayer_time') || null, prayer_duration_minutes: fd.get('prayer_duration_minutes') ? Number(fd.get('prayer_duration_minutes')) : null,
      weekdays: weekdaysChosen.join(','),
      periods_per_day_json: JSON.stringify(periodsJson),
    };
    try { await api('/timetable-config', { method: 'PUT', body }); alert('Schedule settings saved.'); renderTimetable(); }
    catch (e) { alert(e.message); }
  });

  let currentClassId = null;
  const lastAutoGenSubjects = {}; // classId -> subject_ids used, so Reshuffle can reuse them without re-prompting

  async function loadGrid() {
    const classId = document.getElementById('tt-class').value;
    if (!classId) return alert('Select a class first.');
    currentClassId = classId;
    const data = await api(`/timetable?class_id=${classId}`);
    const weekdays = data.config.weekdays.split(',').map(s => s.trim()).filter(Boolean);
    const periodsByWeekday = data.periods_by_weekday || {};
    const maxPeriods = Math.max(1, ...Object.values(periodsByWeekday));
    const entryMap = {};
    data.entries.forEach(e => entryMap[`${e.weekday}|${e.period_number}`] = e);
    const grid = document.getElementById('tt-grid');
    let rows = '';
    for (let p = 1; p <= maxPeriods; p++) {
      rows += `<tr><td class="tt-period-label">Period ${p}</td>`;
      for (const w of weekdays) {
        const dayHasThisPeriod = p <= (periodsByWeekday[w] || 0);
        if (!dayHasThisPeriod) { rows += `<td class="tt-cell-none">—</td>`; continue; }
        const entry = entryMap[`${w}|${p}`];
        rows += `<td class="tt-cell" data-weekday="${w}" data-period="${p}">
          <div class="tt-cell-subject">${entry && entry.subject_name ? escapeHtml(entry.subject_name) : '<span class="muted">—</span>'}</div>
          <div class="tt-cell-teacher small-text">${entry && entry.teacher_name ? escapeHtml(entry.teacher_name) : ''}</div>
        </td>`;
      }
      rows += '</tr>';
    }
    grid.innerHTML = `
      <div class="notice" style="margin-bottom:12px">
        <b>${escapeHtml(data.class_name)}</b> &nbsp;·&nbsp; Day starts ${escapeHtml(data.config.school_start_time)}, closes ${escapeHtml(data.config.closing_time)}
        ${data.config.break_time ? ` &nbsp;·&nbsp; Break ${escapeHtml(data.config.break_time)} (${data.config.break_duration_minutes}min)` : ''}
        ${data.config.lunch_time ? ` &nbsp;·&nbsp; Lunch ${escapeHtml(data.config.lunch_time)} (${data.config.lunch_duration_minutes}min)` : ''}
        ${data.config.prayer_time ? ` &nbsp;·&nbsp; Prayer ${escapeHtml(data.config.prayer_time)} (${data.config.prayer_duration_minutes}min)` : ''}
        &nbsp;·&nbsp; Periods/day: ${weekdays.map(w => `${w.slice(0, 3)} ${periodsByWeekday[w]}`).join(', ')}
      </div>
      <div class="table-wrap"><table class="tt-table"><thead><tr><th></th>${weekdays.map(w => `<th>${w}</th>`).join('')}</tr></thead>
      <tbody>${rows}</tbody></table></div>
      <p class="small-text" style="margin-top:8px">Click any cell to set its subject and teacher.</p>
      ${buildSubjectsPerWeekSummary(data.entries)}`;
    grid.querySelectorAll('.tt-cell').forEach(cell => cell.addEventListener('click', () => openTimetableCellEditor(cell.dataset.weekday, Number(cell.dataset.period), currentClassId, subjects.rows, teachers.rows, loadGrid)));
  }

  document.getElementById('tt-load').addEventListener('click', loadGrid);
  document.getElementById('tt-auto').addEventListener('click', () => openAutoGenerateModal(subjects.rows, () => { if (currentClassId) loadGrid(); }, () => currentClassId || document.getElementById('tt-class').value, lastAutoGenSubjects));
  document.getElementById('tt-reshuffle').addEventListener('click', async () => {
    const classId = currentClassId || document.getElementById('tt-class').value;
    if (!classId) return alert('Select a class first.');
    const subjectIds = lastAutoGenSubjects[classId];
    if (!subjectIds) return alert('Run "Auto-Generate" at least once for this class first, so Reshuffle knows which subjects to rotate through.');
    if (!confirm('Reshuffle this class\'s entire timetable? Any manual edits you made will be cleared and it will be regenerated fresh.')) return;
    try {
      const result = await api('/timetable/auto-generate', { method: 'POST', body: { class_id: Number(classId), subject_ids: subjectIds, reshuffle: true } });
      let msg = `Reshuffled — filled ${result.filledCount} period(s).`;
      if (result.conflicts && result.conflicts.length) msg += `\n\nA few slots were left without a teacher to avoid double-booking one — assign these by hand:\n` + result.conflicts.join('\n');
      alert(msg);
      loadGrid();
    } catch (e) { alert(e.message); }
  });
  document.getElementById('tt-clear').addEventListener('click', async () => {
    const classId = document.getElementById('tt-class').value;
    if (!classId) return alert('Select a class first.');
    if (!confirm('Clear the entire timetable for this class? This cannot be undone.')) return;
    await api('/timetable/clear', { method: 'POST', body: { class_id: Number(classId) } });
    loadGrid();
  });
  document.getElementById('tt-print').addEventListener('click', async () => {
    const classId = document.getElementById('tt-class').value;
    if (!classId) return alert('Select and load a class timetable first.');
    const data = await api(`/timetable?class_id=${classId}`);
    printTimetable(data);
  });

  document.getElementById('tt-select-all-classes').addEventListener('click', () => {
    document.querySelectorAll('.tt-multi-class-check').forEach(cb => { cb.checked = true; });
  });
  document.getElementById('tt-select-none-classes').addEventListener('click', () => {
    document.querySelectorAll('.tt-multi-class-check').forEach(cb => { cb.checked = false; });
  });
  document.getElementById('tt-print-multi').addEventListener('click', async () => {
    const selected = [...document.querySelectorAll('.tt-multi-class-check:checked')].map(cb => cb.value);
    if (!selected.length) return alert('Select at least one class.');
    const dataList = [];
    for (const cid of selected) {
      dataList.push(await api(`/timetable?class_id=${cid}`));
    }
    printMultipleTimetables(dataList);
  });

  // ---- Duty Roster (part of the Timetable page) ----
  async function loadDutyRoster() {
    const rows = await api('/duty_roster?pageSize=200');
    const teacherById = {}; teachers.rows.forEach(t => teacherById[t.id] = t.full_name);
    const table = document.getElementById('duty-roster-table');
    if (!rows.rows.length) { table.innerHTML = '<div class="empty-state">No duty assignments yet.</div>'; return; }
    const byDay = {};
    rows.rows.forEach(r => { (byDay[r.weekday] = byDay[r.weekday] || []).push(r); });
    table.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Weekday</th><th>Duty</th><th>Teacher</th><th>Notes</th><th></th></tr></thead><tbody>
      ${WEEKDAY_OPTIONS.filter(w => byDay[w]).map(w => byDay[w].map((r, idx) => `<tr>
        ${idx === 0 ? `<td rowspan="${byDay[w].length}"><b>${w}</b></td>` : ''}
        <td>${escapeHtml(r.duty_name)}</td><td>${escapeHtml(teacherById[r.teacher_id] || '—')}</td><td class="small-text">${escapeHtml(r.notes || '')}</td>
        <td class="row-actions"><button class="duty-edit-btn" data-id="${r.id}">Edit</button><button class="duty-del-btn" data-id="${r.id}">Delete</button></td>
      </tr>`).join('')).join('')}
      </tbody></table></div>`;
    table.querySelectorAll('.duty-edit-btn').forEach(btn => btn.addEventListener('click', () => openDutyForm(rows.rows.find(r => r.id === Number(btn.dataset.id)), teachers.rows, loadDutyRoster)));
    table.querySelectorAll('.duty-del-btn').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Delete this duty assignment?')) return;
      await api(`/duty_roster/${btn.dataset.id}`, { method: 'DELETE' });
      loadDutyRoster();
    }));
  }
  document.getElementById('duty-add-btn').addEventListener('click', () => openDutyForm(null, teachers.rows, loadDutyRoster));
  document.getElementById('duty-print-btn').addEventListener('click', async () => {
    const rows = await api('/duty_roster?pageSize=200');
    printDutyRoster(rows.rows, teachers.rows);
  });
  loadDutyRoster();
}

function openDutyForm(existing, teacherRows, onSaved) {
  const modal = el(`<div class="modal-backdrop"><div class="modal" style="width:400px">
    <h3>${existing ? 'Edit' : 'Add'} Duty Assignment</h3>
    <form id="duty-form">
      <label>Weekday</label>
      <select name="weekday">${WEEKDAY_OPTIONS.map(w => `<option ${existing && existing.weekday === w ? 'selected' : ''}>${w}</option>`).join('')}</select>
      <label>Duty Name</label><input name="duty_name" value="${existing ? escapeHtml(existing.duty_name) : ''}" placeholder="e.g. Gate Duty, Assembly, Compound">
      <label>Teacher</label>
      <select name="teacher_id"><option value="">— None —</option>${teacherRows.map(t => `<option value="${t.id}" ${existing && existing.teacher_id === t.id ? 'selected' : ''}>${escapeHtml(t.full_name)}</option>`).join('')}</select>
      <label>Notes</label><textarea name="notes" rows="2">${existing ? escapeHtml(existing.notes || '') : ''}</textarea>
      <div class="modal-actions"><button type="button" class="btn secondary" id="duty-cancel">Cancel</button><button type="submit" class="btn gold">Save</button></div>
    </form>
  </div></div>`);
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  modal.querySelector('#duty-cancel').addEventListener('click', () => modal.remove());
  modal.querySelector('#duty-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = { weekday: fd.get('weekday'), duty_name: fd.get('duty_name') || 'General Duty', teacher_id: fd.get('teacher_id') ? Number(fd.get('teacher_id')) : null, notes: fd.get('notes') || null };
    try {
      if (existing) await api(`/duty_roster/${existing.id}`, { method: 'PUT', body });
      else await api('/duty_roster', { method: 'POST', body });
      modal.remove(); onSaved();
    } catch (err) { alert(err.message); }
  });
}

function printDutyRoster(rows, teacherRows) {
  const teacherById = {}; teacherRows.forEach(t => teacherById[t.id] = t.full_name);
  const byDay = {};
  rows.forEach(r => { (byDay[r.weekday] = byDay[r.weekday] || []).push(r); });
  const tableRows = WEEKDAY_OPTIONS.filter(w => byDay[w]).map(w => byDay[w].map((r, idx) => `<tr>
    ${idx === 0 ? `<td>${w}</td>` : '<td></td>'}<td>${escapeHtml(r.duty_name)}</td><td>${escapeHtml(teacherById[r.teacher_id] || '—')}</td><td>${escapeHtml(r.notes || '')}</td>
  </tr>`).join('')).join('');
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>Duty Roster</title><link rel="stylesheet" href="/style.css"></head><body style="padding:24px">
    <div class="report-card"><div class="rc-title-band">WEEKLY DUTY ROSTER</div>
    <table class="rc-table" style="margin-top:14px"><thead><tr><th>Weekday</th><th>Duty</th><th>Teacher</th><th>Notes</th></tr></thead><tbody>${tableRows || '<tr><td colspan=4>No duties assigned</td></tr>'}</tbody></table>
    </div><script>window.print()<\/script></body></html>`);
  win.document.close();
}

function openTimetableCellEditor(weekday, period, classId, subjectRows, teacherRows, onSaved) {
  const modal = el(`<div class="modal-backdrop"><div class="modal" style="width:380px">
    <h3>${weekday} — Period ${period}</h3>
    <form id="tt-cell-form">
      <label>Subject</label>
      <select name="subject_id"><option value="">— None —</option>${subjectRows.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}</select>
      <label>Teacher</label>
      <select name="teacher_id"><option value="">— None —</option>${teacherRows.map(t => `<option value="${t.id}">${escapeHtml(t.full_name)}</option>`).join('')}</select>
      <div class="modal-actions"><button type="button" class="btn secondary" id="tt-cell-cancel">Cancel</button><button type="submit" class="btn gold">Save</button></div>
    </form>
  </div></div>`);
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  modal.querySelector('#tt-cell-cancel').addEventListener('click', () => modal.remove());
  modal.querySelector('#tt-cell-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = { class_id: Number(classId), weekday, period_number: period, subject_id: fd.get('subject_id') ? Number(fd.get('subject_id')) : null, teacher_id: fd.get('teacher_id') ? Number(fd.get('teacher_id')) : null };
    const result = await api('/timetable/entry', { method: 'POST', body });
    modal.remove();
    if (result.conflict) alert('Saved, but heads up: ' + result.conflict);
    onSaved();
  });
}

function openAutoGenerateModal(subjectRows, onDone, getClassId, lastAutoGenSubjects) {
  const classId = getClassId();
  if (!classId) return alert('Select a class first.');
  const modal = el(`<div class="modal-backdrop"><div class="modal" style="width:420px">
    <h3>Auto-Generate Timetable</h3>
    <p class="small-text">Pick the subjects this class takes. Empty periods will be filled by rotating through them evenly — periods already set are left untouched. Where a subject has exactly one teacher assigned to it, that teacher is filled in automatically; if that would double-book them for another class at the same time, the slot is left without a teacher instead, so no clash is ever actually created.</p>
    <div style="max-height:240px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;margin:12px 0">
      ${subjectRows.map(s => `<label style="display:flex;align-items:center;gap:8px;font-size:13.5px"><input type="checkbox" value="${s.id}" class="ag-subject-check"> ${escapeHtml(s.name)}</label>`).join('') || '<p class="muted">No subjects yet — add some under Subjects first.</p>'}
    </div>
    <div class="modal-actions"><button type="button" class="btn secondary" id="ag-cancel">Cancel</button><button type="button" class="btn gold" id="ag-run">Generate</button></div>
  </div></div>`);
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  modal.querySelector('#ag-cancel').addEventListener('click', () => modal.remove());
  modal.querySelector('#ag-run').addEventListener('click', async () => {
    const subjectIds = [...modal.querySelectorAll('.ag-subject-check:checked')].map(cb => Number(cb.value));
    if (!subjectIds.length) return alert('Choose at least one subject.');
    try {
      const result = await api('/timetable/auto-generate', { method: 'POST', body: { class_id: Number(classId), subject_ids: subjectIds } });
      modal.remove();
      if (lastAutoGenSubjects) lastAutoGenSubjects[classId] = subjectIds; // so "Reshuffle" can reuse the same subject list later
      let msg = `Filled ${result.filledCount} empty period(s).`;
      if (result.conflicts && result.conflicts.length) msg += `\n\nA few slots were left without a teacher to avoid double-booking one — assign these by hand:\n` + result.conflicts.join('\n');
      alert(msg);
      onDone();
    } catch (e) { alert(e.message); }
  });
}

// Adds minutes to a "HH:MM" time string, returning a new "HH:MM".
function addMinutesToTime(hhmm, minutes) {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const nh = Math.floor((total % 1440) / 60), nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}
function formatTime12h(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

// Builds just the inner report-card markup for one class's timetable — shared by the
// single-class print and the "print multiple classes at once" flow below.
// Redesigned to match the school's own hand-made timetable style: days run down the left as
// rows, time-range periods run across the top as columns, and Break/Lunch/Prayer appear as
// their own vertically-merged columns (rotated label) spanning every day row, rather than as
// interruption rows — this is the actual layout difference from the previous version, not
// just a cosmetic tweak.
function buildTimetableBodyHtml(data) {
  const weekdays = data.config.weekdays.split(',').map(s => s.trim()).filter(Boolean);
  const periodsByWeekday = data.periods_by_weekday || {};
  const maxPeriods = Math.max(1, ...Object.values(periodsByWeekday));
  const entryMap = {};
  data.entries.forEach(e => entryMap[`${e.weekday}|${e.period_number}`] = e);

  // One "column" per period, each with its actual clock time-range — plus Break/Lunch/Prayer
  // inserted as their own columns at the point in the sequence their configured time falls,
  // exactly like the hand-made version does it (a dedicated column, not a note squeezed into
  // a period).
  const specialEvents = [
    data.config.break_time && { time: data.config.break_time, label: 'BREAK TIME', duration: data.config.break_duration_minutes },
    data.config.lunch_time && { time: data.config.lunch_time, label: 'LUNCH', duration: data.config.lunch_duration_minutes },
    data.config.prayer_time && { time: data.config.prayer_time, label: 'PRAYERS', duration: data.config.prayer_duration_minutes },
  ].filter(Boolean).sort((a, b) => a.time.localeCompare(b.time));

  const columns = []; // { type: 'period', num, start, end } | { type: 'special', label }
  let eventIdx = 0;
  for (let p = 1; p <= maxPeriods; p++) {
    const periodStart = addMinutesToTime(data.config.school_start_time, (p - 1) * data.config.period_length_minutes);
    while (eventIdx < specialEvents.length && specialEvents[eventIdx].time <= periodStart) {
      columns.push({ type: 'special', label: specialEvents[eventIdx].label, duration: specialEvents[eventIdx].duration });
      eventIdx++;
    }
    const periodEnd = addMinutesToTime(data.config.school_start_time, p * data.config.period_length_minutes);
    columns.push({ type: 'period', num: p, start: periodStart, end: periodEnd });
  }
  while (eventIdx < specialEvents.length) { columns.push({ type: 'special', label: specialEvents[eventIdx].label, duration: specialEvents[eventIdx].duration }); eventIdx++; }

  const headerCells = columns.map(c => c.type === 'special'
    ? `<th class="tt-special-col"><span class="tt-special-rotated">${escapeHtml(c.label)}</span></th>`
    : `<th>${formatTime12h(c.start)}<br><span class="small-text">${formatTime12h(c.end)}</span></th>`).join('');

  const bodyRows = weekdays.map(w => {
    const cells = columns.map(c => {
      if (c.type === 'special') return `<td class="tt-special-col"><span class="tt-special-rotated">${escapeHtml(c.label)}${c.duration ? ` (${c.duration}m)` : ''}</span></td>`;
      if (c.num > (periodsByWeekday[w] || 0)) return `<td>—</td>`;
      const entry = entryMap[`${w}|${c.num}`];
      return `<td>${entry && entry.subject_name ? escapeHtml(entry.subject_name) : '—'}${entry && entry.teacher_name ? `<br><span class="small-text">${escapeHtml(entry.teacher_name)}</span>` : ''}</td>`;
    }).join('');
    return `<tr><td class="tt-day-label">${escapeHtml(w.toUpperCase())}</td>${cells}</tr>`;
  }).join('');

  return `<div class="report-card">
      <div class="rc-title-band">${escapeHtml((data.school && data.school.school_name) || 'NIBRAS EDUCATIONAL COMPLEX').toUpperCase()}</div>
      <h2 class="tt-print-subtitle">STUDY TIME TABLE — ${escapeHtml(data.class_name).toUpperCase()}</h2>
      <p class="tt-print-year">${escapeHtml(data.academic_year || '')} ACADEMIC YEAR</p>
      <table class="tt-print-table"><thead><tr><th>DAY/TIME</th>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>
    </div>`;
}
const TIMETABLE_PRINT_STYLE = `
      @page{size:A4 landscape;margin:8mm;}
      .tt-print-subtitle{text-align:center;margin:10px 0 2px;color:var(--navy);font-size:15px;letter-spacing:.5px;}
      .tt-print-year{text-align:center;margin:0 0 10px;font-weight:700;color:var(--navy);font-size:12.5px;}
      .tt-print-table{width:100%;border-collapse:collapse;margin-top:4px;font-size:11px;border:2px solid var(--navy);table-layout:fixed;}
      .tt-print-table th,.tt-print-table td{border:2px solid var(--navy);padding:5px 4px;text-align:center;vertical-align:middle;}
      .tt-print-table th{background:var(--navy);color:#fff;font-size:10px;text-transform:uppercase;letter-spacing:.3px;}
      .tt-print-table th span{display:block;font-weight:400;font-size:8.5px;opacity:.85;}
      .tt-day-label{background:var(--navy);color:#fff;font-weight:800;font-size:10.5px;letter-spacing:.2px;width:54px;white-space:nowrap;}
      .tt-print-table tbody tr:nth-child(even) td:not(.tt-day-label):not(.tt-special-col){background:#f7f9fc;}
      .tt-special-col{background:#fbf1dc !important;width:22px;padding:3px 2px !important;}
      .tt-special-rotated{display:inline-block;writing-mode:vertical-rl;transform:rotate(180deg);font-weight:800;font-size:9px;letter-spacing:.3px;color:var(--navy);white-space:nowrap;}
      .tt-print-page{page-break-after:always;}
      .tt-print-page:last-child{page-break-after:auto;}`;

// Prints every group in a class along with its member list — for handing out during group
// activities or posting on a notice board.
function printClassGroups(className, groups, schoolName) {
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>Class Groups — ${escapeHtml(className)}</title>
    <link rel="stylesheet" href="/style.css">
    <style>
      .cg-print-group{border:2px solid var(--navy);border-radius:8px;padding:14px 18px;margin-bottom:16px;break-inside:avoid;}
      .cg-print-group h3{margin:0 0 8px;color:var(--navy);}
      .cg-print-group ol{margin:0;padding-left:20px;columns:2;font-size:13.5px;}
    </style></head><body style="padding:24px">
    <div class="report-card">
      <div class="rc-title-band">CLASS GROUPS &nbsp;·&nbsp; ${escapeHtml(className)}</div>
      <p style="text-align:center;margin:10px 0">${escapeHtml(schoolName || 'Nibras Educational Complex')}</p>
      ${groups.map(g => `<div class="cg-print-group"><h3>${escapeHtml(g.name)} <span class="small-text">(${g.members.length} student${g.members.length === 1 ? '' : 's'})</span></h3>
        <ol>${g.members.map(m => `<li>${escapeHtml(m.first_name)} ${escapeHtml(m.last_name)}</li>`).join('') || '<li class="muted">No members yet</li>'}</ol></div>`).join('')}
    </div>
    <script>window.print()<\/script></body></html>`);
  win.document.close();
}

function printTimetable(data) {
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>Timetable — ${escapeHtml(data.class_name)}</title>
    <link rel="stylesheet" href="/style.css">
    <style>${TIMETABLE_PRINT_STYLE}</style></head><body style="padding:24px">
    ${buildTimetableBodyHtml(data)}
    <script>window.print()<\/script></body></html>`);
  win.document.close();
}

// Prints any number of classes' timetables in one go, each on its own landscape A4 page.
function printMultipleTimetables(dataList) {
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>Timetables</title>
    <link rel="stylesheet" href="/style.css">
    <style>${TIMETABLE_PRINT_STYLE}</style></head><body style="padding:24px">
    ${dataList.map(data => `<div class="tt-print-page">${buildTimetableBodyHtml(data)}</div>`).join('')}
    <script>window.print()<\/script></body></html>`);
  win.document.close();
}


async function renderAdmissionsReport() {
  const content = document.getElementById('content');
  const terms = (await api('/terms?pageSize=200')).rows;
  content.innerHTML = `<div class="page-header"><h2>New Admissions & Enrolment</h2></div>
    <div class="notice">Filter new admissions by term, an exact date, a whole month, or a whole year.</div>
    <div class="toolbar">
      <select id="adm-filter-type">
        <option value="term">By Term</option>
        <option value="date">By Date</option>
        <option value="month">By Month</option>
        <option value="year">By Year</option>
      </select>
      <select id="adm-term">${terms.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('')}</select>
      <input type="date" id="adm-date" style="display:none">
      <input type="month" id="adm-month" style="display:none">
      <input type="number" id="adm-year" placeholder="e.g. 2026" min="2000" max="2100" style="display:none;max-width:120px">
      <button class="btn secondary" id="adm-load">Generate</button>
    </div>
    <div id="adm-output"></div>`;

  const filterInputs = { term: 'adm-term', date: 'adm-date', month: 'adm-month', year: 'adm-year' };
  document.getElementById('adm-filter-type').addEventListener('change', (e) => {
    Object.values(filterInputs).forEach(id => { document.getElementById(id).style.display = 'none'; });
    document.getElementById(filterInputs[e.target.value]).style.display = '';
  });

  document.getElementById('adm-load').addEventListener('click', async () => {
    const filterType = document.getElementById('adm-filter-type').value;
    const value = document.getElementById(filterInputs[filterType]).value;
    if (!value) return alert('Choose a ' + filterType + ' to filter by.');
    const queryKey = filterType === 'term' ? 'term_id' : filterType;
    const out = document.getElementById('adm-output');
    out.innerHTML = '<div class="empty-state">Loading…</div>';
    try {
      const data = await api(`/admissions-report?${queryKey}=${encodeURIComponent(value)}`);
      const logoUrl = data.school.logo_photo ? `/uploads/${encodeURIComponent(data.school.logo_photo)}` : '/assets/logo.png';
      out.innerHTML = `<div class="report-card">
        <div class="rc-header"><img class="rc-logo" src="${logoUrl}" alt="School logo">
          <div class="rc-header-text"><h1>${escapeHtml(data.school.school_name)}</h1><p class="rc-motto">"${escapeHtml(data.school.motto)}"</p></div></div>
        <div class="rc-title-band">NEW ADMISSIONS &amp; ENROLMENT &nbsp;·&nbsp; ${escapeHtml(data.term)}</div>
        <table class="rc-table" style="margin-top:12px"><thead><tr><th>Student ID</th><th style="text-align:left">Name</th><th style="text-align:left">Class</th><th>Gender</th><th>Admission Date</th></tr></thead>
        <tbody>${data.rows.map(s => `<tr><td>${escapeHtml(s.student_id)}</td><td class="rc-subject">${escapeHtml(s.first_name)} ${escapeHtml(s.last_name)}</td><td class="rc-subject">${escapeHtml(s.class_name)}</td><td>${escapeHtml(s.gender)}</td><td>${escapeHtml(s.admission_date)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted" style="text-align:center;padding:20px">No new admissions in this period.</td></tr>'}</tbody></table>
        <p class="small-text" style="margin-top:10px">${data.rows.length} new admission(s) &nbsp;·&nbsp; Generated ${new Date().toLocaleDateString()}</p>
      </div>
      <div class="no-print" style="margin-top:14px"><button class="btn gold" onclick="window.print()">Print</button></div>`;
    } catch (e) { out.innerHTML = `<div class="empty-state">${escapeHtml(e.message)}</div>`; }
  });
}

// ---------- Alumni & Status management ----------
async function renderAlumniPage() {
  const content = document.getElementById('content');
  const STATUSES = ['Active', 'Inactive', 'Graduated', 'Alumni', 'Transferred', 'Withdrawn', 'Stopped'];
  content.innerHTML = `<div class="page-header"><h2>Alumni & Student Status</h2></div>
    <div class="notice">Move students between statuses (e.g. mark a graduating class as "Alumni", or record a "Transferred"/"Withdrawn" student) and print a list for any status.</div>
    <div class="toolbar">
      <select id="alumni-status">${STATUSES.map(s => `<option value="${s}" ${s === 'Alumni' ? 'selected' : ''}>${s}</option>`).join('')}</select>
      <button class="btn secondary" id="alumni-load">Load</button>
      <button class="btn gold" id="alumni-print" style="margin-left:auto">Print This List</button>
    </div>
    <div id="alumni-output"></div>`;

  async function load() {
    const status = document.getElementById('alumni-status').value;
    const data = await api(`/students?status=${encodeURIComponent(status)}&pageSize=1000`);
    const out = document.getElementById('alumni-output');
    if (!data.rows.length) { out.innerHTML = '<div class="empty-state">No students currently have this status.</div>'; return; }
    out.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Student ID</th><th>Name</th><th>Gender</th><th></th></tr></thead>
      <tbody>${data.rows.map(s => `<tr data-id="${s.id}"><td>${escapeHtml(s.student_id)}</td><td>${escapeHtml(s.first_name)} ${escapeHtml(s.last_name)}</td><td>${escapeHtml(s.gender)}</td>
        <td class="row-actions"><select class="move-status">${STATUSES.map(s2 => `<option value="${s2}" ${s2 === status ? 'selected' : ''}>${s2}</option>`).join('')}</select>
        <button class="move-btn">Move</button></td></tr>`).join('')}</tbody></table></div>`;
    out.querySelectorAll('tr[data-id]').forEach(tr => {
      tr.querySelector('.move-btn').addEventListener('click', async () => {
        const newStatus = tr.querySelector('.move-status').value;
        await api(`/students/${tr.dataset.id}`, { method: 'PUT', body: { status: newStatus } });
        load();
      });
    });
  }
  document.getElementById('alumni-load').addEventListener('click', load);
  document.getElementById('alumni-print').addEventListener('click', async () => {
    const status = document.getElementById('alumni-status').value;
    const [data, settings] = await Promise.all([api(`/students?status=${encodeURIComponent(status)}&pageSize=1000`), api('/settings')]);
    const logoUrl = settings.logo_photo ? `/uploads/${encodeURIComponent(settings.logo_photo)}` : '/assets/logo.png';
    content.innerHTML = `<div class="report-card">
      <div class="rc-header"><img class="rc-logo" src="${logoUrl}" alt="School logo"><div class="rc-header-text"><h1>${escapeHtml(settings.school_name)}</h1><p class="rc-motto">"${escapeHtml(settings.motto)}"</p></div></div>
      <div class="rc-title-band">STUDENT LIST &mdash; ${status.toUpperCase()}</div>
      <table class="rc-table" style="margin-top:12px"><thead><tr><th>Student ID</th><th style="text-align:left">Name</th><th>Gender</th></tr></thead>
      <tbody>${data.rows.map(s => `<tr><td>${escapeHtml(s.student_id)}</td><td class="rc-subject">${escapeHtml(s.first_name)} ${escapeHtml(s.last_name)}</td><td>${escapeHtml(s.gender)}</td></tr>`).join('') || `<tr><td colspan="3" class="muted" style="text-align:center;padding:20px">No students.</td></tr>`}</tbody></table>
      <p class="small-text" style="margin-top:10px">${data.rows.length} student(s) &nbsp;·&nbsp; Generated ${new Date().toLocaleDateString()}</p>
    </div>
    <div class="no-print" style="margin-top:14px"><button class="btn secondary" id="back-btn">&larr; Back</button> <button class="btn gold" onclick="window.print()">Print</button></div>`;
    document.getElementById('back-btn').addEventListener('click', renderAlumniPage);
  });
  load();
}

// ---------- Parent Contact List ----------
// A parent's profile page — who they are, plus every student they're responsible for, each
// with a quick link into that student's own full profile.
async function renderParentProfile(parentId) {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="empty-state">Loading…</div>';
  const [parent, students] = await Promise.all([
    api(`/parents_guardians/${parentId}`),
    api(`/parents_guardians/${parentId}/students`),
  ]);
  content.innerHTML = `
    <div class="page-header"><h2>${escapeHtml(parent.full_name)}</h2><button class="btn secondary" id="back-to-parents">← Back to Parents & Guardians</button></div>
    <div class="card">
      <h3 style="margin-top:0;color:var(--navy)">Profile</h3>
      <div class="form-grid">
        <div><span class="rc-label">Relationship</span><div>${escapeHtml(parent.relationship || '—')}</div></div>
        <div><span class="rc-label">Status</span><div>${statusBadge(parent.status)}</div></div>
        <div><span class="rc-label">Phone</span><div>${escapeHtml(parent.phone || '—')}</div></div>
        <div><span class="rc-label">Alt. Phone</span><div>${escapeHtml(parent.alt_phone || '—')}</div></div>
        <div><span class="rc-label">Email</span><div>${escapeHtml(parent.email || '—')}</div></div>
        <div><span class="rc-label">Occupation</span><div>${escapeHtml(parent.occupation || '—')}</div></div>
        <div><span class="rc-label">PTA Member</span><div>${parent.pta_member ? 'Yes' : 'No'}</div></div>
        <div><span class="rc-label">Address</span><div>${escapeHtml(parent.address || '—')}</div></div>
      </div>
    </div>
    <div class="card">
      <h3 style="margin-top:0;color:var(--navy)">Students Assigned to ${escapeHtml(parent.full_name)}</h3>
      <div class="table-wrap"><table><thead><tr><th></th><th>Student ID</th><th>Name</th><th>Class</th><th>Status</th><th></th></tr></thead>
        <tbody>${students.map(s => `<tr><td>${photoThumb(s.photo)}</td><td>${escapeHtml(s.student_id)}</td><td>${escapeHtml(s.first_name)} ${escapeHtml(s.last_name)}</td><td>${escapeHtml(s.class_name || '—')}</td><td>${statusBadge(s.status)}</td>
          <td><button type="button" class="view-student-btn" data-id="${s.id}">View Profile</button></td></tr>`).join('') || '<tr><td colspan=6 class="muted">No students linked to this parent yet.</td></tr>'}</tbody></table></div>
    </div>`;
  document.getElementById('back-to-parents').addEventListener('click', () => { location.hash = '#parents'; });
  content.querySelectorAll('.view-student-btn').forEach(btn => btn.addEventListener('click', () => { location.hash = `#student/${btn.dataset.id}`; }));
}

// A teacher's profile page — who they are, plus every class they're connected to, whether as
// the Class Teacher (homeroom) or as a Subject Teacher.
async function renderTeacherProfile(teacherId) {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="empty-state">Loading…</div>';
  const [teacher, classes, mySubjects, allSubjects] = await Promise.all([
    api(`/teachers/${teacherId}`),
    api(`/teachers/${teacherId}/classes`),
    api(`/teachers/${teacherId}/subjects`),
    api('/subjects?pageSize=200'),
  ]);
  const photoUrl = teacher.photo ? `/uploads/${encodeURIComponent(teacher.photo)}` : null;
  const editable = can('teachers', 'edit');
  content.innerHTML = `
    <div class="page-header"><h2>${escapeHtml(teacher.full_name)}</h2><button class="btn secondary" id="back-to-teachers">← Back to Teachers</button></div>
    <div class="card">
      <h3 style="margin-top:0;color:var(--navy)">Profile</h3>
      <div style="display:flex;gap:16px;align-items:flex-start">
        ${photoUrl ? `<img src="${photoUrl}" style="width:80px;height:80px;border-radius:12px;object-fit:cover;border:2px solid var(--gold)">` : ''}
        <div class="form-grid" style="flex:1">
          <div><span class="rc-label">Staff ID</span><div>${escapeHtml(teacher.staff_id || '—')}</div></div>
          <div><span class="rc-label">Qualification</span><div>${escapeHtml(teacher.qualification || '—')}</div></div>
          <div><span class="rc-label">Phone</span><div>${escapeHtml(teacher.phone || '—')}</div></div>
          <div><span class="rc-label">Email</span><div>${escapeHtml(teacher.email || '—')}</div></div>
          <div><span class="rc-label">Teaches In</span><div>${escapeHtml(teacher.teaching_language || '—')}</div></div>
          <div><span class="rc-label">Level</span><div>${escapeHtml(teacher.teacher_level || '—')}</div></div>
        </div>
      </div>
    </div>
    <div class="card">
      <h3 style="margin-top:0;color:var(--navy)">Classes</h3>
      <p class="small-text">A teacher can be assigned as Class Teacher for one class (set from Classes → Edit) and/or Subject Teacher for any number of classes (managed from each class's "Subject Teachers" button).</p>
      <div class="table-wrap"><table><thead><tr><th>Class</th><th>Role</th><th>Students</th><th></th></tr></thead>
        <tbody>${classes.map(c => `<tr><td>${escapeHtml(c.name)}</td><td><span class="badge ${c.role_here === 'Class Teacher' ? 'green' : 'gray'}">${escapeHtml(c.role_here)}</span></td><td>${c.student_count}</td>
          <td><button type="button" class="view-class-students-btn" data-id="${c.id}">View Students</button></td></tr>`).join('') || '<tr><td colspan=4 class="muted">Not assigned to any class yet.</td></tr>'}</tbody></table></div>
    </div>
    <div class="card">
      <h3 style="margin-top:0;color:var(--navy)">Subjects Taught</h3>
      <p class="small-text">A teacher can teach any number of subjects. This also feeds the Timetable's auto-fill: if only one teacher is assigned to a subject, they're used automatically when generating a class schedule.</p>
      <div id="teacher-subjects-list" class="chip-row">${mySubjects.map(s => `<span class="chip">${escapeHtml(s.name)}${editable ? ` <button type="button" class="chip-remove remove-subject-btn" data-id="${s.id}">✕</button>` : ''}</span>`).join('') || '<span class="muted">No subjects assigned yet.</span>'}</div>
      ${editable ? `<div class="toolbar" style="margin-top:12px">
        <select id="add-subject-select"><option value="">Add a subject…</option>${allSubjects.rows.filter(s => !mySubjects.some(ms => ms.id === s.id)).map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}</select>
        <button type="button" class="btn secondary" id="add-subject-btn">Add</button>
      </div>` : ''}
    </div>`;
  document.getElementById('back-to-teachers').addEventListener('click', () => { location.hash = '#teachers'; });
  content.querySelectorAll('.view-class-students-btn').forEach(btn => btn.addEventListener('click', () => { location.hash = `#students/${btn.dataset.id}`; }));
  document.getElementById('add-subject-btn')?.addEventListener('click', async () => {
    const select = document.getElementById('add-subject-select');
    if (!select.value) return;
    await api(`/teachers/${teacherId}/subjects`, { method: 'POST', body: { subject_id: Number(select.value) } });
    renderTeacherProfile(teacherId);
  });
  content.querySelectorAll('.remove-subject-btn').forEach(btn => btn.addEventListener('click', async () => {
    await api(`/teachers/${teacherId}/subjects/${btn.dataset.id}`, { method: 'DELETE' });
    renderTeacherProfile(teacherId);
  }));
}

async function renderParentContacts() {
  const content = document.getElementById('content');
  content.innerHTML = `<div class="page-header"><h2>Parent Contact List</h2></div>
    <div class="toolbar">
      <select id="pc-pta"><option value="">All Parents</option><option value="1">PTA Members Only</option><option value="0">Non-PTA Members Only</option></select>
      <button class="btn secondary" id="pc-load">Load</button>
      <button class="btn gold" id="pc-print" style="margin-left:auto">Print</button>
    </div>
    <div id="pc-output"></div>`;
  async function load() {
    const pta = document.getElementById('pc-pta').value;
    const data = await api(`/parent-contacts${pta !== '' ? '?pta_member=' + pta : ''}`);
    document.getElementById('pc-output').innerHTML = `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Relationship</th><th>Phone</th><th>Alt. Phone</th><th>Linked Student(s)</th><th>PTA</th></tr></thead>
      <tbody>${data.rows.map(p => `<tr><td>${escapeHtml(p.full_name)}</td><td>${escapeHtml(p.relationship)}</td><td>${escapeHtml(p.phone)}</td><td>${escapeHtml(p.alt_phone)}</td>
        <td>${p.students.map(s => escapeHtml(`${s.first_name} ${s.last_name} (${s.student_id})`)).join(', ') || '—'}</td>
        <td>${p.pta_member ? 'Yes' : 'No'}</td></tr>`).join('') || '<tr><td colspan="6" class="muted" style="text-align:center;padding:20px">No parents found.</td></tr>'}</tbody></table></div>`;
  }
  document.getElementById('pc-load').addEventListener('click', load);
  document.getElementById('pc-print').addEventListener('click', async () => {
    const pta = document.getElementById('pc-pta').value;
    const data = await api(`/parent-contacts${pta !== '' ? '?pta_member=' + pta : ''}`);
    const logoUrl = data.school.logo_photo ? `/uploads/${encodeURIComponent(data.school.logo_photo)}` : '/assets/logo.png';
    content.innerHTML = `<div class="report-card">
      <div class="rc-header"><img class="rc-logo" src="${logoUrl}" alt="School logo"><div class="rc-header-text"><h1>${escapeHtml(data.school.school_name)}</h1><p class="rc-motto">"${escapeHtml(data.school.motto)}"</p></div></div>
      <div class="rc-title-band">PARENT &amp; GUARDIAN CONTACT LIST</div>
      <table class="rc-table" style="margin-top:12px"><thead><tr><th style="text-align:left">Name</th><th>Relationship</th><th>Phone</th><th style="text-align:left">Linked Student(s)</th></tr></thead>
      <tbody>${data.rows.map(p => `<tr><td class="rc-subject">${escapeHtml(p.full_name)}</td><td>${escapeHtml(p.relationship)}</td><td>${escapeHtml(p.phone)}</td><td class="small-text">${p.students.map(s => escapeHtml(`${s.first_name} ${s.last_name} (${s.student_id})`)).join(', ') || '—'}</td></tr>`).join('') || `<tr><td colspan="4" class="muted" style="text-align:center;padding:20px">No parents found.</td></tr>`}</tbody></table>
      <p class="small-text" style="margin-top:10px">${data.rows.length} contact(s) &nbsp;·&nbsp; Generated ${new Date().toLocaleDateString()}</p>
    </div>
    <div class="no-print" style="margin-top:14px"><button class="btn secondary" id="back-btn">&larr; Back</button> <button class="btn gold" onclick="window.print()">Print</button></div>`;
    document.getElementById('back-btn').addEventListener('click', renderParentContacts);
  });
  load();
}

// ---------- Student ID Cards ----------
async function renderIdCards() {
  const content = document.getElementById('content');
  const classes = (await api('/classes?pageSize=200')).rows;
  content.innerHTML = `<div class="page-header"><h2>Student ID Cards</h2></div>
    <div class="notice">Generates printable ID cards (credit-card sized) for an entire class — print on card stock or plain paper and laminate/cut individually.</div>
    <div class="toolbar">
      <select id="idc-class"><option value="">Class…</option>${classes.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select>
      <button class="btn secondary" id="idc-load">Generate Cards</button>
    </div>
    <div id="idc-output"></div>`;
  document.getElementById('idc-load').addEventListener('click', async () => {
    const classId = document.getElementById('idc-class').value;
    if (!classId) return alert('Select a class.');
    const out = document.getElementById('idc-output');
    out.innerHTML = '<div class="empty-state">Loading…</div>';
    const [students, settings, yearData] = await Promise.all([
      api(`/students?class_id=${classId}&status=Active&pageSize=500`), api('/settings'), api('/academic_years?pageSize=50'),
    ]);
    if (!students.rows.length) { out.innerHTML = '<div class="empty-state">No active students in this class.</div>'; return; }
    const logoUrl = settings.logo_photo ? `/uploads/${encodeURIComponent(settings.logo_photo)}` : '/assets/logo.png';
    const className = (classes.find(c => c.id == classId) || {}).name || '';
    const currentYear = (yearData.rows.find(y => y.id === settings.current_academic_year_id) || {}).name || new Date().getFullYear();
    const cardTheme = ID_CARD_THEMES[settings.id_card_color] || ID_CARD_THEMES['navy-gold'];
    const classLevel = (classes.find(c => c.id == classId) || {}).level;
    const levelGroup = !classLevel ? 'Other' : (classLevel === 'KG' ? 'Nursery' : classLevel === 'Primary' ? 'Lower Primary' : classLevel);
    const stripeColor = LEVEL_STRIPE_COLORS[levelGroup] || LEVEL_STRIPE_COLORS['Other'];
    const cardsHtml = students.rows.map(s => `
      <div class="id-card" style="--card-band:${cardTheme.band};--card-accent:${cardTheme.accent};--level-stripe:${stripeColor}">
        <div class="id-card-level-tab">${escapeHtml(levelGroup)}</div>
        <img class="id-card-watermark" src="${logoUrl}" alt="">
        <div class="id-card-header">
          <img class="id-card-logo" src="${logoUrl}" alt="">
          <div class="id-card-header-text"><b>${escapeHtml(settings.school_name)}</b><span>"${escapeHtml(settings.motto)}"</span></div>
        </div>
        <div class="id-card-band">STUDENT IDENTIFICATION</div>
        <div class="id-card-body">
          <div class="id-card-photo">${s.photo ? `<img src="/uploads/${encodeURIComponent(s.photo)}" alt="">` : silhouetteSvg()}</div>
          <div class="id-card-info">
            <div class="id-card-name">${escapeHtml(s.first_name)} ${escapeHtml(s.last_name)}</div>
            <div class="id-card-row"><span>Student ID</span><b>${escapeHtml(s.student_id)}</b></div>
            <div class="id-card-row"><span>Class</span><b>${escapeHtml(className)}</b></div>
            <div class="id-card-row"><span>Gender</span><b>${escapeHtml(s.gender) || '—'}</b></div>
            ${settings.id_card_show_dob && s.dob ? `<div class="id-card-row"><span>DOB</span><b>${escapeHtml(s.dob)}</b></div>` : ''}
            ${settings.id_card_show_blood_group ? `<div class="id-card-row"><span>Blood Group</span><b>${escapeHtml(s.blood_group) || '—'}</b></div>` : ''}
            ${settings.id_card_show_contact ? `<div class="id-card-row"><span>Emergency</span><b>${escapeHtml(s.emergency_contact_phone) || '—'}</b></div>` : ''}
            <div class="id-card-row"><span>Valid For</span><b>${escapeHtml(currentYear)}</b></div>
          </div>
        </div>
        <div class="id-card-barcode">${renderBarcodeSvg(s.student_id, { moduleWidth: 1.4, barHeight: 26, showText: true })}</div>
        <div class="id-card-footer">
          <div class="id-card-sig">Authorized Signature</div>
          <div class="id-card-contact">${escapeHtml(settings.phone || '')} ${settings.address ? '· ' + escapeHtml(settings.address) : ''}</div>
        </div>
      </div>`).join('');
    out.innerHTML = `<div id="id-card-sheet">${cardsHtml}</div>
      <div class="no-print" style="margin-top:14px"><button class="btn gold" id="idc-print-btn">Print All ${students.rows.length} ID Cards</button></div>`;
    // A dedicated print window, same reasoning as the report card fix — this page's own
    // "Generate Cards" toolbar and explanatory notice aren't marked no-print, so relying on
    // window.print() here on the live page would put them on the printed sheet too.
    document.getElementById('idc-print-btn').addEventListener('click', () => {
      const win = window.open('', '_blank');
      win.document.write(`<!DOCTYPE html><html><head><title>Student ID Cards</title><link rel="stylesheet" href="/style.css"></head>
        <body style="padding:10mm"><div id="id-card-sheet">${cardsHtml}</div><script>window.print()<\/script></body></html>`);
      win.document.close();
    });
  });
}

// ---------- Fees ----------
// Resolves a human-readable Student ID (e.g. "NIB/2026/001") to the internal numeric database id.
async function resolveStudentDbId(studentIdText) {
  const trimmed = (studentIdText || '').trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) return Number(trimmed); // already a raw numeric id
  const found = await api(`/students?q=${encodeURIComponent(trimmed)}&pageSize=20`);
  const match = found.rows.find(r => r.student_id === trimmed);
  return match ? match.id : null;
}

// Collects everything needed BEFORE the system ever contacts MTN: which fee, how much (capped
// at the outstanding balance), and the MoMo phone number to send the approval prompt to. Only
// once all of that is confirmed does the actual request-to-pay get triggered.
function openMomoPaymentModal(feeId, studentId, balance) {
  const modal = el(`<div class="modal-backdrop"><div class="modal" style="width:400px">
    <h3>📱 Pay with MTN MoMo</h3>
    <form id="momo-form">
      <label>Amount to Pay (GHS) *</label>
      <input type="number" name="amount" min="1" max="${balance}" step="0.01" value="${balance}" required>
      <p class="small-text">Outstanding balance: GHS ${balance}</p>
      <label>MTN Mobile Money Number *</label>
      <input type="tel" name="phone" placeholder="e.g. 0244123456" required pattern="[0-9+ ]{9,15}">
      <p class="small-text">A payment prompt will be sent to this number — approve it on your phone to complete payment.</p>
      <div class="modal-actions"><button type="button" class="btn secondary" id="momo-cancel">Cancel</button><button type="submit" class="btn gold">Request Payment</button></div>
    </form>
    <div id="momo-status" class="hidden"></div>
  </div></div>`);
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  modal.querySelector('#momo-cancel').addEventListener('click', () => modal.remove());
  modal.querySelector('#momo-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const amount = Number(fd.get('amount'));
    const phone = fd.get('phone');
    const form = modal.querySelector('#momo-form');
    const statusBox = modal.querySelector('#momo-status');
    try {
      const result = await api('/momo/request-payment', { method: 'POST', body: { fee_id: feeId, student_id: studentId, amount, phone } });
      form.classList.add('hidden');
      statusBox.classList.remove('hidden');
      statusBox.innerHTML = `<div class="notice">📲 Prompt sent to ${escapeHtml(phone)}. Approve it on your phone now.<br><br><span id="momo-poll-text">Waiting for approval…</span></div>
        <div class="modal-actions"><button type="button" class="btn secondary" id="momo-close">Close</button></div>`;
      statusBox.querySelector('#momo-close').addEventListener('click', () => { modal.remove(); renderFees(); });
      // Poll every 4 seconds for up to 2 minutes — MTN's own prompt/approval round-trip on the
      // customer's phone is what actually takes the time here, not this app.
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        try {
          const statusResult = await api(`/momo/status/${encodeURIComponent(result.reference_id)}`);
          if (statusResult.status === 'SUCCESSFUL') {
            clearInterval(poll);
            statusBox.querySelector('#momo-poll-text').innerHTML = '<b style="color:var(--green)">✓ Payment successful!</b>';
            setTimeout(() => { modal.remove(); renderFees(); }, 1800);
          } else if (statusResult.status === 'FAILED') {
            clearInterval(poll);
            statusBox.querySelector('#momo-poll-text').innerHTML = `<b style="color:var(--red)">✗ Payment failed${statusResult.failure_reason ? ': ' + escapeHtml(statusResult.failure_reason) : ''}.</b>`;
          } else if (attempts >= 30) {
            clearInterval(poll);
            statusBox.querySelector('#momo-poll-text').textContent = 'Still pending — you can close this and check back later; the payment will be recorded automatically once approved.';
          }
        } catch (err) { /* a transient poll failure isn't fatal — just try again next tick */ }
      }, 4000);
    } catch (err) {
      statusBox.classList.remove('hidden');
      statusBox.innerHTML = `<div class="notice" style="border-color:var(--red)">⚠ ${escapeHtml(err.message)}</div>
        <div class="modal-actions"><button type="button" class="btn secondary" id="momo-close-err">Close</button></div>`;
      statusBox.querySelector('#momo-close-err').addEventListener('click', () => modal.remove());
    }
  });
}

// A clear, at-a-glance history of every MTN MoMo payment attempt — including the ones still
// pending or that failed, not just the ones that succeeded and became a normal fee payment —
// so Finance staff can see exactly which student paid what, when, by phone number and status.
// Income & Expenditure — income is always computed live from real payment records (never
// stored separately, so it can't drift out of sync), expenditure is manually logged, and an
// admin can set a target for each period type to track progress against.
async function renderIncomeExpenditure() {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="empty-state">Loading…</div>';
  const editable = can('fees', 'edit');
  content.innerHTML = `<div class="page-header"><h2>💰 Income &amp; Expenditure</h2></div>
    <div class="toolbar">
      <select id="ie-period"><option value="weekly">This Week</option><option value="monthly">This Month</option><option value="termly">This Term</option></select>
      ${editable ? `<button class="btn secondary" id="ie-set-target-btn">🎯 Set Targets</button>` : ''}
      ${editable ? `<button class="btn gold" id="ie-add-expense-btn">+ Add Expense</button>` : ''}
      ${can('fees', 'delete') ? `<button class="btn secondary" id="ie-reset-btn" style="border-color:var(--red);color:var(--red)">Reset / Clear</button>` : ''}
    </div>
    <div id="ie-summary" class="stat-grid" style="margin-top:14px"></div>
    <div id="ie-progress" style="margin-top:10px"></div>
    <div id="ie-breakdown" style="margin-top:14px"></div>
    <div class="card" style="margin-top:16px">
      <div class="page-header" style="margin-bottom:8px"><h3 style="margin:0;color:var(--navy)">👛 Salaries</h3>
        <select id="ie-pay-period"></select></div>
      <p class="small-text">Paying a salary logs it as an expense here automatically — no separate step needed.</p>
      <div id="ie-salaries-list"></div>
    </div>
    <div class="card" style="margin-top:16px">
      <h3 style="margin-top:0;color:var(--navy)">Expenditure by Category</h3>
      <div id="ie-category-breakdown"></div>
    </div>
    <div class="card" style="margin-top:16px">
      <div class="page-header" style="margin-bottom:8px"><h3 style="margin:0;color:var(--navy)">Recent Expenses</h3></div>
      <div id="ie-expense-list"></div>
    </div>`;

  async function loadSummary() {
    const period = document.getElementById('ie-period').value;
    const summary = await api(`/income-summary?period=${period}`);
    // Guard every element the same way loadSalaries below does — if the person has already
    // navigated elsewhere by the time this resolves, none of these exist anymore.
    if (!document.getElementById('ie-summary')) return;
    const pct = summary.target > 0 ? Math.min(100, Math.round((summary.income / summary.target) * 100)) : null;
    document.getElementById('ie-summary').innerHTML = `
      <div class="stat-card accent"><div><div class="num">GHS ${summary.income.toLocaleString()}</div><div class="label">Income</div></div></div>
      <div class="stat-card accent"><div><div class="num">GHS ${summary.expenditure.toLocaleString()}</div><div class="label">Expenditure</div></div></div>
      <div class="stat-card accent"><div><div class="num" style="color:${summary.profit >= 0 ? 'var(--green)' : 'var(--red)'}">GHS ${summary.profit.toLocaleString()}</div><div class="label">Profit</div></div></div>
      <div class="stat-card accent"><div><div class="num">GHS ${summary.target.toLocaleString()}</div><div class="label">Target</div></div></div>`;
    document.getElementById('ie-progress').innerHTML = summary.target > 0 ? `
      <div style="background:#eef2f8;border-radius:20px;overflow:hidden;height:22px;position:relative">
        <div style="background:${pct >= 100 ? 'var(--green)' : 'var(--gold)'};height:100%;width:${pct}%;transition:width .3s"></div>
        <span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--navy)">${pct}% of target</span>
      </div>` : `<p class="small-text">No target set for this period yet.</p>`;
    const pc = summary.payerCounts || {};
    document.getElementById('ie-breakdown').innerHTML = `
      <div class="card">
        <h3 style="margin-top:0;color:var(--navy);font-size:14px">Where this period's income came from</h3>
        <div class="table-wrap"><table><thead><tr><th>Source</th><th>Students Involved</th><th>Amount</th></tr></thead><tbody>
          <tr><td>School Fees (incl. MTN MoMo)</td><td>${pc.feesPayers ?? '—'} of ${pc.totalActiveStudents ?? '—'} paid something</td><td>GHS ${(summary.feesIncome ?? 0).toLocaleString()}</td></tr>
          <tr><td>Canteen</td><td>${pc.canteenPayers ?? '—'} paid</td><td>GHS ${(summary.canteenIncome ?? 0).toLocaleString()}</td></tr>
          <tr><td>School Bus (usage, not necessarily a separate fee)</td><td>${pc.busUsers ?? '—'} of ${pc.totalActiveStudents ?? '—'} use the bus</td><td class="small-text">Billed via School Fees if the school charges for it</td></tr>
        </tbody></table></div>
      </div>`;
    document.getElementById('ie-category-breakdown').innerHTML = summary.expenditureByCategory.length
      ? `<div class="table-wrap"><table><thead><tr><th>Category</th><th>Total</th></tr></thead><tbody>${summary.expenditureByCategory.map(c => `<tr><td>${escapeHtml(c.category)}</td><td>GHS ${c.total.toLocaleString()}</td></tr>`).join('')}</tbody></table></div>`
      : '<div class="empty-state">No expenses recorded for this period yet.</div>';
  }
  async function loadSalaries() {
    const periodSelect = document.getElementById('ie-pay-period');
    if (!periodSelect.value) {
      // Default to the current month, plus the last 5, so an admin can also catch up on a
      // month they missed rather than only ever seeing "this month."
      const opts = [];
      const d = new Date();
      for (let i = 0; i < 6; i++) {
        const ym = new Date(d.getFullYear(), d.getMonth() - i, 1).toISOString().slice(0, 7);
        opts.push(`<option value="${ym}">${ym}</option>`);
      }
      periodSelect.innerHTML = opts.join('');
      periodSelect.addEventListener('change', loadSalaries);
    }
    const payPeriod = periodSelect.value;
    const status = await api(`/salaries-status?pay_period=${payPeriod}`);
    // If the person has already navigated to a different page by the time this resolves, the
    // element this was about to update no longer exists — this happened for real during a fast
    // page-to-page regression sweep, not just a hypothetical edge case.
    const listEl = document.getElementById('ie-salaries-list');
    if (!listEl) return;
    listEl.innerHTML = status.rows.length ? `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Role</th><th>Salary</th><th>Status</th><th></th></tr></thead>
      <tbody>${status.rows.map(r => `<tr><td>${escapeHtml(r.full_name)}</td><td>${r.person_type === 'teacher' ? 'Teacher' : 'Non-teaching Staff'}</td><td>GHS ${r.salary.toLocaleString()}</td>
        <td>${r.paid ? `<span class="badge green">Paid</span>` : `<span class="badge">Not Paid</span>`}</td>
        <td>${editable && !r.paid ? `<button type="button" class="ie-pay-salary-btn" data-type="${r.person_type}" data-id="${r.id}" data-amount="${r.salary}">Pay</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`
      : '<div class="empty-state">No one has a salary amount set yet — add one on a Teacher or Staff profile.</div>';
    document.querySelectorAll('.ie-pay-salary-btn').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm(`Mark this salary as paid for ${payPeriod}? This logs it as an expense.`)) return;
      try {
        await api('/pay-salary', { method: 'POST', body: { person_type: btn.dataset.type, person_id: Number(btn.dataset.id), amount: Number(btn.dataset.amount), pay_period: payPeriod } });
        loadSalaries(); loadSummary(); loadExpenseList();
      } catch (e) { alert(e.message); }
    }));
  }
  async function loadExpenseList() {
    const rows = await api('/expenditures?pageSize=50');
    const listEl = document.getElementById('ie-expense-list');
    if (!listEl) return;
    listEl.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th></th></tr></thead>
      <tbody>${rows.rows.map(e => `<tr><td>${escapeHtml(e.expense_date)}</td><td>${escapeHtml(e.category)}</td><td>${escapeHtml(e.description || '—')}</td><td>GHS ${e.amount.toLocaleString()}</td>
        <td>${editable ? `<button type="button" class="ie-delete-expense-btn" data-id="${e.id}">Delete</button>` : ''}</td></tr>`).join('') || '<tr><td colspan=5 class="muted">No expenses recorded yet.</td></tr>'}</tbody></table></div>`;
    document.querySelectorAll('.ie-delete-expense-btn').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Delete this expense record?')) return;
      await api(`/expenditures/${btn.dataset.id}`, { method: 'DELETE' });
      loadExpenseList(); loadSummary();
    }));
  }
  document.getElementById('ie-period').addEventListener('change', loadSummary);
  document.getElementById('ie-add-expense-btn')?.addEventListener('click', () => {
    const category = prompt('Expense category (e.g. Utilities, Salaries, Supplies):'); if (!category) return;
    const amount = prompt('Amount (GHS):'); if (!amount) return;
    const description = prompt('Description (optional):') || '';
    api('/expenditures', { method: 'POST', body: { category, amount: Number(amount), description } }).then(() => { loadExpenseList(); loadSummary(); });
  });
  document.getElementById('ie-set-target-btn')?.addEventListener('click', async () => {
    const targets = await api('/income-targets');
    const modal = el(`<div class="modal-backdrop"><div class="modal" style="width:400px">
      <h3>🎯 Set Income Targets</h3>
      <label>Weekly Target (GHS) <span class="small-text">(recurring, applies to every week)</span></label><input type="number" id="target-weekly" value="${targets.weekly || 0}">
      <label>Monthly Target (GHS)</label><input type="number" id="target-monthly" value="${targets.monthly || 0}">
      <label>Termly Target (GHS)</label><input type="number" id="target-termly" value="${targets.termly || 0}">
      <div class="modal-actions"><button type="button" class="btn secondary" id="target-cancel">Cancel</button><button type="button" class="btn gold" id="target-save">Save</button></div>
      <hr style="margin:16px 0;border-color:var(--border)">
      <h4 style="margin:0 0 4px;color:var(--navy)">Or set a target for one specific week</h4>
      <p class="small-text">Overrides the recurring weekly target above for just that one week — useful for a fundraising week or a school-fees deadline week.</p>
      <label>Week Starting (date)</label><input type="date" id="specific-week-date">
      <label>Week Number <span class="small-text">(optional — e.g. "3" for Week 3 of the term)</span></label><input type="number" id="specific-week-number" min="1">
      <label>Target (GHS)</label><input type="number" id="specific-week-amount">
      <button type="button" class="btn secondary" id="specific-week-save" style="margin-top:8px">Save This Week's Target</button>
      <p id="specific-week-status" class="small-text"></p>
    </div></div>`);
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    modal.querySelector('#target-cancel').addEventListener('click', () => modal.remove());
    modal.querySelector('#target-save').addEventListener('click', async () => {
      for (const period of ['weekly', 'monthly', 'termly']) {
        await api('/income-targets', { method: 'PUT', body: { period_type: period, target_amount: Number(modal.querySelector(`#target-${period}`).value) || 0 } });
      }
      modal.remove();
      loadSummary();
    });
    modal.querySelector('#specific-week-save').addEventListener('click', async () => {
      const weekDate = modal.querySelector('#specific-week-date').value;
      const weekNumber = modal.querySelector('#specific-week-number').value;
      const amount = modal.querySelector('#specific-week-amount').value;
      const status = modal.querySelector('#specific-week-status');
      if (!weekDate || !amount) { status.textContent = 'A start date and a target amount are required.'; status.style.color = 'var(--red)'; return; }
      try {
        await api('/weekly_targets', { method: 'POST', body: { week_start_date: weekDate, week_number: weekNumber ? Number(weekNumber) : null, target_amount: Number(amount) } });
        status.textContent = '✓ Saved.'; status.style.color = 'var(--green)';
        loadSummary();
      } catch (e) { status.textContent = e.message; status.style.color = 'var(--red)'; }
    });
  });
  document.getElementById('ie-reset-btn')?.addEventListener('click', async () => {
    if (!confirm('Reset Income, Expenditure, Profit, and Targets? This clears every logged expense and every target (weekly, monthly, and termly) — Profit is calculated from these, so it resets to zero too. Real fee/MoMo/canteen payment records are NOT affected — this cannot be undone.')) return;
    const result = await api('/income-expenditure/reset', { method: 'POST' });
    alert(`Cleared ${result.expenseCount} expense record(s) and all targets.`);
    loadSummary(); loadExpenseList(); loadSalaries();
  });
  loadSummary();
  loadExpenseList();
  loadSalaries();
}

// Receipts — a searchable history of every payment ever recorded, so a specific old receipt
// can be found and reprinted without already knowing which student or fee record it belongs
// to. Reuses the same printable receipt renderer that fires right after a live payment.
async function renderReceipts() {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="empty-state">Loading…</div>';
  content.innerHTML = `<div class="page-header"><h2>🧾 Receipts</h2></div>
    <div class="toolbar">
      <input type="text" id="rcpt-search" placeholder="Search: student name, Student ID, or receipt number…" style="min-width:260px">
      <select id="rcpt-method"><option value="">Any payment method</option><option value="Cash">Cash</option><option value="Bank Transfer">Bank Transfer</option><option value="MTN MoMo">MTN MoMo</option><option value="Cheque">Cheque</option></select>
      <input type="date" id="rcpt-from" title="From date">
      <input type="date" id="rcpt-to" title="To date">
      <button class="btn secondary" id="rcpt-filter-btn">Filter</button>
      <button class="btn secondary" id="rcpt-clear-btn">Clear</button>
    </div>
    <div id="rcpt-total" class="notice" style="margin-top:10px"></div>
    <div id="rcpt-list" style="margin-top:10px"></div>
    <div id="receipt-output"></div>`;

  async function load() {
    const params = new URLSearchParams();
    const search = document.getElementById('rcpt-search').value.trim();
    const method = document.getElementById('rcpt-method').value;
    const from = document.getElementById('rcpt-from').value;
    const to = document.getElementById('rcpt-to').value;
    if (search) params.set('search', search);
    if (method) params.set('method', method);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const data = await api(`/receipts?${params.toString()}`);
    // Same guard as the other pages that hit this exact race earlier — if the person has
    // already navigated elsewhere by the time this resolves, these elements are gone.
    const totalEl = document.getElementById('rcpt-total');
    if (!totalEl) return;
    totalEl.textContent = `All-time total collected: GHS ${data.total_all_time.toLocaleString()}${(search || method || from || to) ? ` — showing ${data.rows.length} filtered result(s)` : ` — showing the most recent ${data.rows.length}`}`;
    document.getElementById('rcpt-list').innerHTML = data.rows.length ? `<div class="table-wrap"><table><thead><tr><th>Receipt No.</th><th>Date</th><th>Student</th><th>Fee Type</th><th>Amount</th><th>Method</th><th></th></tr></thead>
      <tbody>${data.rows.map(r => `<tr><td>${escapeHtml(r.receipt_number || '—')}</td><td>${escapeHtml(r.payment_date)}</td><td>${escapeHtml(r.first_name)} ${escapeHtml(r.last_name)} (${escapeHtml(r.student_id)})</td><td>${escapeHtml(r.fee_type_name || '—')}</td><td>GHS ${r.amount_paid.toLocaleString()}</td><td>${escapeHtml(r.payment_method || '—')}</td>
        <td><button type="button" class="rcpt-print-btn" data-id="${r.id}">🖶 Print</button></td></tr>`).join('')}</tbody></table></div>`
      : '<div class="empty-state">No payments found.</div>';
    document.querySelectorAll('.rcpt-print-btn').forEach(btn => btn.addEventListener('click', async () => {
      const receipt = await api(`/receipt/${btn.dataset.id}`);
      renderProfessionalReceipt(receipt);
    }));
  }
  document.getElementById('rcpt-filter-btn').addEventListener('click', load);
  document.getElementById('rcpt-search').addEventListener('keydown', (e) => { if (e.key === 'Enter') load(); });
  document.getElementById('rcpt-clear-btn').addEventListener('click', () => {
    document.getElementById('rcpt-search').value = '';
    document.getElementById('rcpt-method').value = '';
    document.getElementById('rcpt-from').value = '';
    document.getElementById('rcpt-to').value = '';
    load();
  });
  load();
}

async function renderMomoTransactions() {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="empty-state">Loading…</div>';
  const rows = await api('/momo/transactions');
  const statusBadge = (s) => s === 'SUCCESSFUL' ? '<span class="badge green">Successful</span>' : s === 'FAILED' ? '<span class="badge red">Failed</span>' : '<span class="badge amber">Pending</span>';
  content.innerHTML = `<div class="page-header"><h2>📱 MTN MoMo Transactions</h2></div>
    <div class="notice">Every MoMo payment attempt — pending, successful, or failed — with the student and fee it was for.</div>
    <div class="table-wrap"><table><thead><tr><th>Date</th><th>Student</th><th>Student ID</th><th>Fee Type</th><th>Amount</th><th>Phone</th><th>Status</th><th>Reference</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td>${escapeHtml(r.created_at)}</td>
        <td>${escapeHtml(r.first_name)} ${escapeHtml(r.last_name)}</td>
        <td>${escapeHtml(r.student_number)}</td>
        <td>${escapeHtml(r.fee_type_name)}</td>
        <td>GHS ${r.amount}</td>
        <td>${escapeHtml(r.phone)}</td>
        <td>${statusBadge(r.status)}</td>
        <td class="small-text">${escapeHtml(r.reference_id)}</td>
      </tr>`).join('') || '<tr><td colspan=8 class="muted">No MTN MoMo payment attempts yet.</td></tr>'}</tbody></table></div>`;
}

async function renderFees() {
  const content = document.getElementById('content');
  // A student sees a simple read-only view of their own fee records — the rest of this
  // function is the full admin fee-management page, which needs permissions (like viewing
  // classes) that a Student account doesn't have and shouldn't need.
  if (state.user && state.user.role === 'Student') {
    if (!state.user.linked_student_id) {
      content.innerHTML = `<div class="page-header"><h2>My Fees</h2></div><div class="empty-state">Your account isn't linked to a student record yet — ask an admin to fix this.</div>`;
      return;
    }
    content.innerHTML = '<div class="empty-state">Loading…</div>';
    const student = await api(`/students/${state.user.linked_student_id}`);
    const rows = student.fees || [];
    const totalDue = rows.reduce((s, f) => s + (f.amount_due || 0), 0);
    const totalPaid = rows.reduce((s, f) => s + (f.amount_paid || 0), 0);
    content.innerHTML = `<div class="page-header"><h2>My Fees</h2></div>
      <div class="stat-grid">
        <div class="stat-card accent"><div><div class="num">GHS ${totalDue.toLocaleString()}</div><div class="label">Total Due</div></div></div>
        <div class="stat-card accent"><div><div class="num">GHS ${totalPaid.toLocaleString()}</div><div class="label">Total Paid</div></div></div>
        <div class="stat-card accent"><div><div class="num">GHS ${(totalDue - totalPaid).toLocaleString()}</div><div class="label">Balance</div></div></div>
      </div>
      <div class="card">
        <div class="table-wrap"><table><thead><tr><th>Fee Type</th><th>Term</th><th>Amount Due</th><th>Amount Paid</th><th>Balance</th><th></th></tr></thead>
        <tbody>${rows.map(f => { const bal = (f.amount_due || 0) - (f.amount_paid || 0); return `<tr data-fee-id="${f.id}"><td>${escapeHtml(f.fee_type_name)}</td><td>${escapeHtml(f.term_name || '—')}</td><td>GHS ${f.amount_due ?? 0}</td><td>GHS ${f.amount_paid ?? 0}</td><td>GHS ${bal}</td>
          <td>${bal > 0 && (can('fees', 'add') || state.user.role === 'Student') ? `<button type="button" class="btn secondary momo-pay-btn" data-fee-id="${f.id}" data-balance="${bal}" style="padding:5px 10px;font-size:12px">📱 Pay with MoMo</button>` : ''}</td></tr>`; }).join('') || '<tr><td colspan=6 class="muted">No fees on record yet.</td></tr>'}</tbody></table></div>
      </div>`;
    content.querySelectorAll('.momo-pay-btn').forEach(btn => btn.addEventListener('click', () => {
      openMomoPaymentModal(Number(btn.dataset.feeId), state.user.linked_student_id, Number(btn.dataset.balance));
    }));
    return;
  }
  // A Parent sees the same simple read-only view, but for their own linked ward(s) — with a
  // picker if they have more than one child at the school.
  if (state.user && state.user.role === 'Parent/Guardian') {
    content.innerHTML = '<div class="empty-state">Loading…</div>';
    const myWards = (await api('/students?pageSize=50')).rows;
    if (!myWards.length) {
      content.innerHTML = `<div class="page-header"><h2>Fees</h2></div><div class="empty-state">Your account isn't linked to a ward yet — ask the school office to fix this.</div>`;
      return;
    }
    async function loadWardFees(studentId) {
      const student = await api(`/students/${studentId}`);
      const rows = student.fees || [];
      const totalDue = rows.reduce((s, f) => s + (f.amount_due || 0), 0);
      const totalPaid = rows.reduce((s, f) => s + (f.amount_paid || 0), 0);
      content.innerHTML = `<div class="page-header"><h2>Fees</h2></div>
        ${myWards.length > 1 ? `<div class="toolbar"><select id="fees-ward-select">${myWards.map(w => `<option value="${w.id}" ${w.id === studentId ? 'selected' : ''}>${escapeHtml(w.first_name)} ${escapeHtml(w.last_name)}</option>`).join('')}</select></div>` : ''}
        <div class="stat-grid">
          <div class="stat-card accent"><div><div class="num">GHS ${totalDue.toLocaleString()}</div><div class="label">Total Due</div></div></div>
          <div class="stat-card accent"><div><div class="num">GHS ${totalPaid.toLocaleString()}</div><div class="label">Total Paid</div></div></div>
          <div class="stat-card accent"><div><div class="num">GHS ${(totalDue - totalPaid).toLocaleString()}</div><div class="label">Balance</div></div></div>
        </div>
        <div class="card">
          <div class="table-wrap"><table><thead><tr><th>Fee Type</th><th>Term</th><th>Amount Due</th><th>Amount Paid</th><th>Balance</th><th></th></tr></thead>
          <tbody>${rows.map(f => { const bal = (f.amount_due || 0) - (f.amount_paid || 0); return `<tr data-fee-id="${f.id}"><td>${escapeHtml(f.fee_type_name)}</td><td>${escapeHtml(f.term_name || '—')}</td><td>GHS ${f.amount_due ?? 0}</td><td>GHS ${f.amount_paid ?? 0}</td><td>GHS ${bal}</td>
            <td>${bal > 0 ? `<button type="button" class="btn secondary momo-pay-btn" data-fee-id="${f.id}" data-balance="${bal}" style="padding:5px 10px;font-size:12px">📱 Pay with MoMo</button>` : ''}</td></tr>`; }).join('') || '<tr><td colspan=6 class="muted">No fees on record yet.</td></tr>'}</tbody></table></div>
        </div>`;
      document.getElementById('fees-ward-select')?.addEventListener('change', (e) => loadWardFees(Number(e.target.value)));
      content.querySelectorAll('.momo-pay-btn').forEach(btn => btn.addEventListener('click', () => {
        openMomoPaymentModal(Number(btn.dataset.feeId), studentId, Number(btn.dataset.balance));
      }));
    }
    await loadWardFees(myWards[0].id);
    return;
  }
  const content2 = content; // keep the rest of this function's original body/variable name below untouched
  const [feeTypes, terms, classes] = await Promise.all([api('/fee_types?pageSize=100'), api('/terms?pageSize=200'), api('/classes?pageSize=200')]);
  content.innerHTML = `<div class="page-header"><h2>Fees</h2>
    <div style="display:flex;gap:8px">
    ${can('fees', 'delete') ? `<button class="btn secondary" id="reset-all-fees-btn" style="border-color:var(--red);color:var(--red)">⚠ Reset All Fees &amp; Clearance</button>` : ''}
    ${can('fees', 'add') ? `<button class="btn gold" id="add-feetype">+ Add Fee Type</button>` : ''}
    </div></div>
    <div class="card">
      <div class="page-header" style="margin-bottom:8px"><h3 style="margin:0;color:var(--navy)">Fee Types</h3>
        ${can('fees', 'delete') ? `<button class="btn secondary" id="clear-all-feetypes" style="border-color:var(--red);color:var(--red)">Clear All Fee Types</button>` : ''}</div>
      <div class="table-wrap"><table><thead><tr><th>Name</th><th>Category</th><th>Default Amount</th><th></th></tr></thead>
      <tbody>${feeTypes.rows.map(f => `<tr><td>${escapeHtml(f.name)}</td><td><span class="badge">${escapeHtml(f.category || 'General')}</span></td><td>GHS ${f.default_amount ?? 0}</td>
        <td class="row-actions">${can('fees', 'edit') ? `<button class="feetype-edit-btn" data-id="${f.id}" data-name="${escapeHtml(f.name)}" data-amount="${f.default_amount ?? 0}" data-category="${escapeHtml(f.category || 'General')}">Edit</button>` : ''}${can('fees', 'delete') ? `<button class="feetype-del-btn" data-id="${f.id}">Delete</button>` : ''}</td>
      </tr>`).join('') || '<tr><td colspan=4 class="muted">No fee types yet</td></tr>'}</tbody></table></div>
    </div>
    <div class="card">
      <h3 style="margin-top:0;color:var(--navy)">Fee Categories — Billed vs. Collected</h3>
      <div id="fee-category-summary"><div class="empty-state">Loading…</div></div>
    </div>
    <div class="card">
      <h3 style="margin-top:0;color:var(--navy)">Assign Fee to Student & Record Payment</h3>
      <div class="toolbar">
        <input type="text" id="fee-student-id" placeholder="Student ID (e.g. NIB/2026/001)" style="max-width:220px">
        <select id="fee-type">${feeTypes.rows.map(f => `<option value="${f.id}">${escapeHtml(f.name)}</option>`).join('')}</select>
        <select id="fee-term"><option value="">Which term is this for?</option>${terms.rows.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('')}</select>
        <input type="number" id="fee-amount-due" placeholder="Amount due">
        <button class="btn secondary" id="assign-fee">Assign</button>
      </div>
      <div class="toolbar">
        <input type="text" id="pay-fee-id" placeholder="Fee record id (from assign result)" style="max-width:170px">
        <input type="number" id="pay-amount" placeholder="Amount paid">
        <select id="pay-method"><option>Cash</option><option>Bank</option><option>Other</option></select>
        <button class="btn gold" id="record-payment">Record Payment</button>
      </div>
      <div id="fee-output" class="small-text"></div>
    </div>
    <div id="receipt-output"></div>

    <div class="card">
      <h3 style="margin-top:0;color:var(--navy)">Bulk Assign Fees</h3>
      <p class="small-text">Assign the same fee to many students at once — pick a class to load its students, choose who
        it applies to, then set the fee type, term, and amount.</p>
      <div class="toolbar">
        <select id="bulk-fee-class"><option value="">Select a class…</option>${classes.rows.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select>
        <button class="btn secondary" id="bulk-fee-load-students">Load Students</button>
      </div>
      <div id="bulk-fee-student-list"></div>
      <div class="form-grid" style="margin-top:12px">
        <div><label>Fee Type</label><select id="bulk-fee-type">${feeTypes.rows.map(f => `<option value="${f.id}">${escapeHtml(f.name)}</option>`).join('')}</select></div>
        <div><label>Term</label><select id="bulk-fee-term"><option value="">Which term is this for?</option>${terms.rows.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('')}</select></div>
        <div><label>Amount Due (each)</label><input type="number" id="bulk-fee-amount" placeholder="e.g. 500"></div>
      </div>
      <button class="btn gold" id="bulk-fee-assign-btn" style="margin-top:12px">Assign to Selected Students</button>
      <p id="bulk-fee-status" class="small-text"></p>
    </div>

    <div class="card">
      <h3 style="margin-top:0;color:var(--navy)">Fees Report — Who's Paid, Who Hasn't</h3>
      <div class="toolbar">
        <select id="fr-term"><option value="">All Terms</option>${terms.rows.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('')}</select>
        <select id="fr-class"><option value="">All Classes</option>${classes.rows.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select>
        <select id="fr-status"><option value="all">Any Status</option><option value="paid">Fully Paid</option><option value="partial">Partially Paid</option><option value="unpaid">Unpaid (Balance Owing)</option></select>
        <button class="btn secondary" id="fr-load">Generate</button>
        <button class="btn gold" id="fr-print" style="margin-left:auto">Print</button>
      </div>
      <div id="fr-output"></div>
    </div>`;
  const FEE_CATEGORIES = ['Academic', 'Transport', 'Feeding', 'Boarding', 'Extra-curricular', 'Examination', 'General'];
  (async () => {
    const categoryRows = await api('/fees-by-category').catch(() => []);
    const el2 = document.getElementById('fee-category-summary');
    if (!el2) return; // guard against the same kind of race other pages hit — navigated away before this resolved
    el2.innerHTML = categoryRows.length ? `<div class="table-wrap"><table><thead><tr><th>Category</th><th>Billed</th><th>Collected</th><th>Outstanding</th></tr></thead>
      <tbody>${categoryRows.map(c => `<tr><td>${escapeHtml(c.category)}</td><td>GHS ${c.billed.toLocaleString()}</td><td>GHS ${c.collected.toLocaleString()}</td><td>GHS ${(c.billed - c.collected).toLocaleString()}</td></tr>`).join('')}</tbody></table></div>`
      : '<div class="empty-state">No fee types with billed amounts yet.</div>';
  })();
  function openFeeTypeModal(existing) {
    const modal = el(`<div class="modal-backdrop"><div class="modal" style="width:360px">
      <h3>${existing ? 'Edit' : 'Add'} Fee Type</h3>
      <label>Name</label><input type="text" id="ft-name" value="${existing ? escapeHtml(existing.name) : ''}" required>
      <label>Category</label><select id="ft-category">${FEE_CATEGORIES.map(c => `<option value="${c}" ${existing && existing.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
      <label>Default Amount (GHS)</label><input type="number" id="ft-amount" value="${existing ? existing.amount : '0'}">
      <div class="modal-actions"><button type="button" class="btn secondary" id="ft-cancel">Cancel</button><button type="button" class="btn gold" id="ft-save">Save</button></div>
    </div></div>`);
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    modal.querySelector('#ft-cancel').addEventListener('click', () => modal.remove());
    modal.querySelector('#ft-save').addEventListener('click', async () => {
      const name = modal.querySelector('#ft-name').value.trim();
      if (!name) return alert('Enter a name.');
      const body = { name, category: modal.querySelector('#ft-category').value, default_amount: Number(modal.querySelector('#ft-amount').value) || 0 };
      if (existing) await api(`/fee_types/${existing.id}`, { method: 'PUT', body });
      else await api('/fee_types', { method: 'POST', body });
      modal.remove();
      renderFees();
    });
  }
  document.getElementById('add-feetype')?.addEventListener('click', () => openFeeTypeModal(null));
  document.querySelectorAll('.feetype-edit-btn').forEach(btn => btn.addEventListener('click', () => openFeeTypeModal({ id: btn.dataset.id, name: btn.dataset.name, amount: btn.dataset.amount, category: btn.dataset.category })));
  document.querySelectorAll('.feetype-del-btn').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('Delete this fee type?')) return;
    try { await api(`/fee_types/${btn.dataset.id}`, { method: 'DELETE' }); renderFees(); }
    catch (e) { alert(e.message); }
  }));
  document.getElementById('clear-all-feetypes')?.addEventListener('click', async () => {
    if (!confirm('Clear ALL fee types? This only works if none are currently in use by a fee record — this cannot be undone.')) return;
    try {
      const result = await api('/fee_types/clear-all', { method: 'POST' });
      alert(`Cleared ${result.cleared} fee type(s).`);
      renderFees();
    } catch (e) { alert(e.message); }
  });
  document.getElementById('reset-all-fees-btn')?.addEventListener('click', async () => {
    const modal = el(`<div class="modal-backdrop"><div class="modal" style="width:440px">
      <h3 style="color:var(--red)">⚠ Reset ALL Fees &amp; Clearance</h3>
      <p>This permanently deletes <b>every</b> student's fee assignments and payment history —
        including receipts and MTN MoMo transaction records — for the entire school. This is
        much bigger than clearing Fee Types: it wipes actual financial records. There is no undo.</p>
      <p>Type <b>RESET FEES</b> below to confirm.</p>
      <input type="text" id="reset-fees-confirm-input" placeholder="Type RESET FEES" autocomplete="off">
      <div class="modal-actions"><button type="button" class="btn secondary" id="rf-cancel">Cancel</button><button type="button" class="btn danger" id="rf-confirm" disabled>Reset Everything</button></div>
    </div></div>`);
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    modal.querySelector('#rf-cancel').addEventListener('click', () => modal.remove());
    const input = modal.querySelector('#reset-fees-confirm-input');
    const confirmBtn = modal.querySelector('#rf-confirm');
    input.addEventListener('input', () => { confirmBtn.disabled = input.value.trim() !== 'RESET FEES'; });
    confirmBtn.addEventListener('click', async () => {
      try {
        const result = await api('/fees/reset-all', { method: 'POST' });
        modal.remove();
        alert(`Cleared ${result.feeCount} fee record(s) and ${result.paymentCount} payment record(s).`);
        renderFees();
      } catch (e) { alert(e.message); }
    });
  });
  document.getElementById('assign-fee').addEventListener('click', async () => {
    const studentIdText = document.getElementById('fee-student-id').value;
    const feeTypeId = document.getElementById('fee-type').value;
    const termId = document.getElementById('fee-term').value;
    const amount = document.getElementById('fee-amount-due').value;
    if (!studentIdText || !amount) return alert('Enter a Student ID and amount.');
    const dbId = await resolveStudentDbId(studentIdText);
    if (!dbId) return alert(`No student found with ID "${studentIdText}". Check it and try again.`);
    const f = await api('/fees', { method: 'POST', body: { student_id: dbId, fee_type_id: Number(feeTypeId), term_id: termId ? Number(termId) : null, amount_due: Number(amount) } });
    document.getElementById('fee-output').textContent = `Fee record created — Fee ID: ${f.id}. Use this ID to record a payment below.`;
  });
  document.getElementById('record-payment').addEventListener('click', async () => {
    const feeId = document.getElementById('pay-fee-id').value;
    const amount = document.getElementById('pay-amount').value;
    const method = document.getElementById('pay-method').value;
    if (!feeId || !amount) return alert('Enter fee id and amount.');
    const p = await api('/fee-payments', { method: 'POST', body: { fee_id: Number(feeId), amount_paid: Number(amount), payment_method: method } });
    document.getElementById('fee-output').textContent = `Payment recorded — Receipt: ${p.receipt_number}`;
    const receipt = await api(`/receipt/${p.id}`);
    renderProfessionalReceipt(receipt);
  });

  document.getElementById('bulk-fee-load-students').addEventListener('click', async () => {
    const classId = document.getElementById('bulk-fee-class').value;
    const listBox = document.getElementById('bulk-fee-student-list');
    if (!classId) { listBox.innerHTML = ''; return alert('Select a class first.'); }
    const studentsRes = await api(`/students?class_id=${classId}&pageSize=200`);
    const rows = studentsRes.rows;
    listBox.innerHTML = rows.length ? `
      <div class="toolbar" style="margin-top:10px"><label style="display:flex;align-items:center;gap:6px;font-weight:400"><input type="checkbox" id="bulk-fee-select-all" checked> Select All (${rows.length})</label></div>
      <div class="table-wrap" style="max-height:280px;overflow-y:auto"><table><thead><tr><th></th><th>Student ID</th><th>Name</th></tr></thead>
        <tbody>${rows.map(s => `<tr><td><input type="checkbox" class="bulk-fee-student-cb" value="${s.id}" checked></td><td>${escapeHtml(s.student_id)}</td><td>${escapeHtml(s.first_name)} ${escapeHtml(s.last_name)}</td></tr>`).join('')}</tbody></table></div>`
      : '<div class="empty-state">No students in this class.</div>';
    document.getElementById('bulk-fee-select-all')?.addEventListener('change', (e) => {
      listBox.querySelectorAll('.bulk-fee-student-cb').forEach(cb => { cb.checked = e.target.checked; });
    });
  });
  document.getElementById('bulk-fee-assign-btn').addEventListener('click', async () => {
    const selected = [...document.querySelectorAll('.bulk-fee-student-cb:checked')].map(cb => Number(cb.value));
    const feeTypeId = document.getElementById('bulk-fee-type').value;
    const termId = document.getElementById('bulk-fee-term').value;
    const amount = document.getElementById('bulk-fee-amount').value;
    const status = document.getElementById('bulk-fee-status');
    if (!selected.length) return alert('Load a class and select at least one student first.');
    if (!amount) return alert('Enter an amount.');
    try {
      const result = await api('/fees/bulk-assign', { method: 'POST', body: {
        student_ids: selected, fee_type_id: Number(feeTypeId), term_id: termId ? Number(termId) : null, amount_due: Number(amount),
      } });
      status.textContent = `✓ Fee assigned to ${result.created} student${result.created === 1 ? '' : 's'}.`;
      status.style.color = 'var(--green)';
    } catch (e) { status.textContent = e.message; status.style.color = 'var(--red)'; }
  });

  async function loadFeesReport() {
    const termId = document.getElementById('fr-term').value;
    const classId = document.getElementById('fr-class').value;
    const status = document.getElementById('fr-status').value;
    const q = [termId && `term_id=${termId}`, classId && `class_id=${classId}`, `status=${status}`].filter(Boolean).join('&');
    const data = await api(`/fees-report?${q}`);
    document.getElementById('fr-output').innerHTML = `<div class="table-wrap"><table><thead><tr>
      <th>Student</th><th>Fee Type</th><th>Amount Due</th><th>Amount Paid</th><th>Balance</th><th>Status</th></tr></thead>
      <tbody>${data.rows.map(r => `<tr><td>${escapeHtml(r.first_name)} ${escapeHtml(r.last_name)} (${escapeHtml(r.sid)})</td><td>${escapeHtml(r.fee_type_name)}</td>
        <td>GHS ${r.amount_due.toLocaleString()}</td><td>GHS ${r.amount_paid.toLocaleString()}</td><td>GHS ${r.balance.toLocaleString()}</td>
        <td>${r.pay_status === 'paid' ? '<span class="badge green">Paid</span>' : r.pay_status === 'partial' ? '<span class="badge amber">Partial</span>' : '<span class="badge red">Unpaid</span>'}</td></tr>`).join('') || '<tr><td colspan="6" class="muted" style="text-align:center;padding:16px">No matching fee records.</td></tr>'}</tbody></table></div>`;
  }
  document.getElementById('fr-load').addEventListener('click', loadFeesReport);
  document.getElementById('fr-print').addEventListener('click', async () => {
    const termId = document.getElementById('fr-term').value;
    const classId = document.getElementById('fr-class').value;
    const status = document.getElementById('fr-status').value;
    const q = [termId && `term_id=${termId}`, classId && `class_id=${classId}`, `status=${status}`].filter(Boolean).join('&');
    const data = await api(`/fees-report?${q}`);
    const logoUrl = data.school.logo_photo ? `/uploads/${encodeURIComponent(data.school.logo_photo)}` : '/assets/logo.png';
    const totalDue = data.rows.reduce((s, r) => s + r.amount_due, 0), totalPaid = data.rows.reduce((s, r) => s + r.amount_paid, 0);
    content.innerHTML = `<div class="report-card">
      <div class="rc-header"><img class="rc-logo" src="${logoUrl}" alt="School logo"><div class="rc-header-text"><h1>${escapeHtml(data.school.school_name)}</h1><p class="rc-motto">"${escapeHtml(data.school.motto)}"</p></div></div>
      <div class="rc-title-band">FEES REPORT &nbsp;·&nbsp; ${escapeHtml(data.term)}</div>
      <table class="rc-table" style="margin-top:12px"><thead><tr><th style="text-align:left">Student</th><th style="text-align:left">Fee Type</th><th>Due</th><th>Paid</th><th>Balance</th></tr></thead>
      <tbody>${data.rows.map(r => `<tr><td class="rc-subject">${escapeHtml(r.first_name)} ${escapeHtml(r.last_name)}</td><td class="rc-subject">${escapeHtml(r.fee_type_name)}</td><td>${r.amount_due}</td><td>${r.amount_paid}</td><td>${r.balance}</td></tr>`).join('') || `<tr><td colspan="5" class="muted" style="text-align:center;padding:20px">No matching records.</td></tr>`}</tbody></table>
      <div class="rc-summary"><div class="rc-summary-item"><span>Total Due</span><b>GHS ${totalDue.toLocaleString()}</b></div><div class="rc-summary-item"><span>Total Paid</span><b>GHS ${totalPaid.toLocaleString()}</b></div><div class="rc-summary-item"><span>Balance</span><b>GHS ${(totalDue - totalPaid).toLocaleString()}</b></div></div>
    </div>
    <div class="no-print" style="margin-top:14px"><button class="btn secondary" id="back-btn">&larr; Back</button> <button class="btn gold" onclick="window.print()">Print</button></div>`;
    document.getElementById('back-btn').addEventListener('click', renderFees);
  });
}

function renderProfessionalReceipt(r) {
  const outputEl = document.getElementById('receipt-output');
  if (!outputEl) { console.error('renderProfessionalReceipt: no #receipt-output element on this page.'); return; }
  const logoUrl = r.school.logo_photo ? `/uploads/${encodeURIComponent(r.school.logo_photo)}` : '/assets/logo.png';
  const paidDate = r.payment.payment_date ? new Date(r.payment.payment_date).toLocaleDateString() : new Date().toLocaleDateString();
  outputEl.innerHTML = `
    <div class="receipt-card" id="receipt-print">
      <div class="rc-header">
        <img class="rc-logo" src="${logoUrl}" alt="School logo">
        <div class="rc-header-text">
          <h1>${escapeHtml(r.school.school_name || 'Nibras Educational Complex')}</h1>
          <p class="rc-motto">"${escapeHtml(r.school.motto || 'Knowledge is Light')}"</p>
          <p class="rc-contact">${[r.school.address, r.school.phone, r.school.email].filter(Boolean).map(escapeHtml).join(' &nbsp;·&nbsp; ')}</p>
        </div>
      </div>
      <div class="rc-title-band">OFFICIAL PAYMENT RECEIPT</div>
      <div class="receipt-meta">
        <div><span class="rc-label">Receipt No.</span><span class="rc-value">${escapeHtml(r.payment.receipt_number)}</span></div>
        <div><span class="rc-label">Date</span><span class="rc-value">${paidDate}</span></div>
        <div><span class="rc-label">Academic Year / Term</span><span class="rc-value">${escapeHtml(r.academic_year)} ${escapeHtml(r.term)}</span></div>
      </div>
      <div class="receipt-meta">
        <div><span class="rc-label">Received From</span><span class="rc-value">${escapeHtml(r.student.first_name)} ${escapeHtml(r.student.last_name)}</span></div>
        <div><span class="rc-label">Student ID</span><span class="rc-value">${escapeHtml(r.student.student_id)}</span></div>
        <div><span class="rc-label">Payment Method</span><span class="rc-value">${escapeHtml(r.payment.payment_method)}</span></div>
      </div>
      <table class="rc-table" style="margin-top:18px">
        <thead><tr><th style="text-align:left">Description</th><th>Amount Due</th><th>Amount Paid</th><th>Balance</th></tr></thead>
        <tbody><tr>
          <td class="rc-subject">${escapeHtml(r.fee_type_name)}</td>
          <td>GHS ${Number(r.amount_due).toFixed(2)}</td>
          <td class="rc-final">GHS ${Number(r.payment.amount_paid).toFixed(2)}</td>
          <td>GHS ${Number(r.balance).toFixed(2)}</td>
        </tr></tbody>
      </table>
      <div class="rc-signatures" style="margin-top:40px">
        <div class="rc-sig"><div class="rc-sig-line"></div>Received By ${r.recorded_by ? '(' + escapeHtml(r.recorded_by) + ')' : ''}</div>
        <div class="rc-sig"><div class="rc-sig-line"></div>Official Stamp</div>
      </div>
      <p class="small-text no-print" style="margin-top:16px">This receipt confirms payment recorded in the Nibras school system on ${paidDate}.</p>
    </div>
    <div class="no-print" style="margin-top:14px"><button class="btn gold" onclick="window.print()">Print Receipt</button></div>`;
}

// ---------- Canteen ----------
async function renderCanteen() {
  const content = document.getElementById('content');
  const [classes, config] = await Promise.all([api('/classes?pageSize=200'), api('/canteen-config')]);
  content.innerHTML = `
    <div class="page-header"><h2>Canteen</h2></div>
    <div class="notice">Track which students paid for canteen each day — the same way Attendance works. Only students marked "Pays Canteen" on their profile show up here.</div>
    ${can('canteen', 'edit') ? `
    <div class="card">
      <h3 style="margin-top:0;color:var(--navy)">Canteen Settings</h3>
      <div class="form-grid">
        <div><label>Standard Daily Amount (GHS)</label><input type="number" id="ct-daily-amount" min="0" step="0.5" value="${config.daily_amount}"></div>
        <div class="full">
          <label>Canteen Days</label>
          <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:4px">
            ${WEEKDAY_OPTIONS.map(w => `<label style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:400;color:var(--text)">
              <input type="checkbox" class="ct-weekday" value="${w}" ${config.weekdays.split(',').includes(w) ? 'checked' : ''}> ${w}</label>`).join('')}
          </div>
        </div>
      </div>
      <button class="btn secondary" id="save-canteen-config" style="margin-top:10px">Save Settings</button>
    </div>` : ''}
    <div class="card">
      <h3 style="margin-top:0;color:var(--navy)">Mark Today's Payments</h3>
      <div class="toolbar">
        <select id="ct-class"><option value="">Select class…</option>${classes.rows.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select>
        <input type="date" id="ct-date" value="${new Date().toISOString().slice(0, 10)}">
        <button class="btn secondary" id="ct-load">Load Students</button>
      </div>
      <div id="ct-table"></div>
    </div>
    <div class="card">
      <h3 style="margin-top:0;color:var(--navy)">Payment History</h3>
      <div class="toolbar">
        <input type="text" id="ct-history-student-id" placeholder="Student ID (e.g. NIB/2026/001) — leave blank for a whole class">
        <select id="ct-history-class"><option value="">Whole class…</option>${classes.rows.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select>
        <input type="date" id="ct-history-from"> <span class="small-text">to</span> <input type="date" id="ct-history-to">
        <button class="btn secondary" id="ct-history-load">Load History</button>
      </div>
      <div id="ct-history-output"></div>
    </div>`;

  document.getElementById('save-canteen-config')?.addEventListener('click', async () => {
    const weekdaysChosen = [...document.querySelectorAll('.ct-weekday:checked')].map(cb => cb.value);
    if (!weekdaysChosen.length) return alert('Choose at least one canteen day.');
    await api('/canteen-config', { method: 'PUT', body: { daily_amount: Number(document.getElementById('ct-daily-amount').value), weekdays: weekdaysChosen.join(',') } });
    alert('Saved.');
  });

  document.getElementById('ct-load').addEventListener('click', async () => {
    const classId = document.getElementById('ct-class').value;
    const date = document.getElementById('ct-date').value;
    if (!classId) return alert('Please select a class.');
    const students = (await api(`/students?class_id=${classId}&pays_canteen=1&pageSize=500`)).rows;
    const existing = await api(`/canteen-payments?class_id=${classId}&date=${date}`);
    const existingMap = {}; existing.forEach(c => existingMap[c.student_id] = c);
    const wrap = document.getElementById('ct-table');
    if (!students.length) { wrap.innerHTML = '<div class="empty-state">No canteen-paying students in this class.</div>'; return; }
    if (!can('canteen', 'add')) {
      wrap.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Student</th><th>Status</th></tr></thead><tbody>
        ${students.map(s => `<tr><td>${escapeHtml(s.first_name)} ${escapeHtml(s.last_name)}</td><td>${statusBadge((existingMap[s.id] || {}).status || '—')}</td></tr>`).join('')}
      </tbody></table></div>`;
      return;
    }
    wrap.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Student</th><th>Status</th><th>Amount (GHS)</th></tr></thead><tbody>
      ${students.map(s => { const ex = existingMap[s.id]; return `<tr data-sid="${s.id}"><td>${escapeHtml(s.first_name)} ${escapeHtml(s.last_name)}</td><td>
        <select class="ct-status">
          <option value="Paid" ${(!ex || ex.status === 'Paid') ? 'selected' : ''}>Paid</option>
          <option value="Not Paid" ${ex && ex.status === 'Not Paid' ? 'selected' : ''}>Not Paid</option>
        </select></td><td><input type="number" class="ct-amount" min="0" step="0.5" value="${ex ? (ex.amount ?? config.daily_amount) : config.daily_amount}" style="width:90px"></td></tr>`; }).join('')}
    </tbody></table></div>
    <div style="margin-top:14px"><button class="btn gold" id="save-ct">Save Canteen Payments</button></div>`;
    document.getElementById('save-ct').addEventListener('click', async () => {
      const records = [...wrap.querySelectorAll('tr[data-sid]')].map(tr => ({
        student_id: Number(tr.dataset.sid), status: tr.querySelector('.ct-status').value, amount: Number(tr.querySelector('.ct-amount').value) || 0,
      }));
      await api('/canteen-payments/bulk', { method: 'POST', body: { date, class_id: Number(classId), records } });
      alert('Canteen payments saved.');
    });
  });

  document.getElementById('ct-history-load').addEventListener('click', async () => {
    const idText = document.getElementById('ct-history-student-id').value.trim();
    const classId = document.getElementById('ct-history-class').value;
    const from = document.getElementById('ct-history-from').value;
    const to = document.getElementById('ct-history-to').value;
    const params = new URLSearchParams();
    if (from) params.set('from', from); if (to) params.set('to', to);
    let rows = [];
    if (idText) {
      const students = await api(`/students?q=${encodeURIComponent(idText)}&pageSize=5`);
      const student = students.rows.find(s => s.student_id === idText) || students.rows[0];
      if (!student) return alert('Student not found.');
      params.set('student_id', student.id);
      rows = await api(`/canteen-payments?${params.toString()}`);
    } else if (classId) {
      params.set('class_id', classId);
      rows = await api(`/canteen-payments?${params.toString()}`);
    } else {
      return alert('Enter a Student ID or choose a class.');
    }
    const totalPaid = rows.filter(r => r.status === 'Paid').reduce((sum, r) => sum + (r.amount || 0), 0);
    const paidDays = rows.filter(r => r.status === 'Paid').length;
    const notPaidDays = rows.filter(r => r.status === 'Not Paid').length;
    document.getElementById('ct-history-output').innerHTML = `
      <div class="table-wrap" style="margin-top:10px"><table><thead><tr><th>Date</th><th>Student</th><th>Status</th><th>Amount</th></tr></thead>
        <tbody>${rows.map(r => `<tr><td>${r.date}</td><td>${escapeHtml(r.first_name)} ${escapeHtml(r.last_name)}</td><td>${statusBadge(r.status)}</td><td>${r.amount != null ? 'GHS ' + r.amount.toLocaleString() : '—'}</td></tr>`).join('') || '<tr><td colspan=4 class="muted">No records for this range</td></tr>'}</tbody></table></div>
      <p class="small-text" style="margin-top:10px"><b>Paid days:</b> ${paidDays} &nbsp;·&nbsp; <b>Not-paid days:</b> ${notPaidDays} &nbsp;·&nbsp; <b>Total collected:</b> GHS ${totalPaid.toLocaleString()}</p>`;
  });
}

// ---------- Users & Roles ----------
async function openUserForm(existing, roles) {
  const isEdit = !!existing;
  let photoDataUrl = null;
  const existingUrl = existing && existing.photo ? `/uploads/${encodeURIComponent(existing.photo)}` : '';
  const classes = (await api('/classes?pageSize=200')).rows;
  const modal = el(`<div class="modal-backdrop"><div class="modal">
    <h3>${isEdit ? 'Edit' : 'Add'} User</h3>
    <form id="user-form"><div class="form-grid">
      <div class="full photo-field">
        <label>Photo</label>
        <div class="photo-upload-row">
          <div class="photo-preview-box" id="user-photo-preview">${existingUrl ? `<img src="${existingUrl}" alt="">` : silhouetteSvg()}</div>
          <div><input type="file" accept="image/*" id="user-photo-input"></div>
        </div>
      </div>
      <div><label>Username *</label><input name="username" value="${escapeHtml(existing?.username || '')}" ${isEdit ? 'readonly' : ''} required></div>
      <div><label>Full Name *</label><input name="full_name" value="${escapeHtml(existing?.full_name || '')}" required></div>
      <div><label>Role *</label><select name="role_id" id="user-role-select">${roles.map(r => `<option value="${r.id}" ${existing && existing.role === r.name ? 'selected' : ''}>${escapeHtml(r.name)}</option>`).join('')}</select></div>
      <div><label>${isEdit ? 'New Password (leave blank to keep current)' : 'Temporary Password *'}</label><input type="password" name="password" ${isEdit ? '' : 'required'}></div>
      <div class="full hidden" id="linked-student-row">
        <label>Linked Student ID <span class="small-text">(required for the Student role — this is who they'll be able to log in as)</span></label>
        <input type="text" name="linked_student_id_text" placeholder="e.g. NIB/2026/001" value="${existing && existing.linked_student_display ? escapeHtml(existing.linked_student_display) : ''}">
      </div>
      <div class="full hidden" id="assigned-class-row">
        <label>Assigned Class <span class="small-text">(required for Canteen Collector — they'll only ever mark payments for this one class)</span></label>
        <select name="assigned_class_id">${classes.map(c => `<option value="${c.id}" ${existing && existing.assigned_class_id === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}</select>
      </div>
      <div class="full hidden" id="assigned-level-row">
        <label>Assigned Level <span class="small-text">(required for Arabic Head Teacher — they'll only see Arabic-teaching staff at this level)</span></label>
        <select name="assigned_level">${['Nursery', 'Primary', 'JHS', 'SHS'].map(l => `<option value="${l}" ${existing && existing.assigned_level === l ? 'selected' : ''}>${l}</option>`).join('')}</select>
      </div>
    </div>
    <div class="modal-actions"><button type="button" class="btn secondary" id="cancel-btn">Cancel</button><button type="submit" class="btn gold">Save</button></div></form>
  </div></div>`);
  document.body.appendChild(modal);
  modal.querySelector('#cancel-btn').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  // Show the role-specific field only when the matching role is actually selected.
  function toggleConditionalRows() {
    const roleId = Number(document.getElementById('user-role-select').value);
    const role = roles.find(r => r.id === roleId);
    document.getElementById('linked-student-row').classList.toggle('hidden', !(role && role.name === 'Student'));
    document.getElementById('assigned-class-row').classList.toggle('hidden', !(role && role.name === 'Canteen Collector'));
    document.getElementById('assigned-level-row').classList.toggle('hidden', !(role && role.name === 'Arabic Head Teacher'));
  }
  document.getElementById('user-role-select').addEventListener('change', toggleConditionalRows);
  toggleConditionalRows();
  modal.querySelector('#user-photo-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      photoDataUrl = await resizeImageToDataUrl(file, 400, 480);
      document.getElementById('user-photo-preview').innerHTML = `<img src="${photoDataUrl}" alt="">`;
    } catch (err) { alert('Could not read that image. Please try a different file.'); }
  });
  modal.querySelector('#user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = { full_name: fd.get('full_name'), role_id: Number(fd.get('role_id')) };
    if (!isEdit) { body.username = fd.get('username'); body.password = fd.get('password'); }
    if (isEdit && fd.get('password')) body.password = fd.get('password');
    if (photoDataUrl) body.photo_data = photoDataUrl;
    const selectedRole = roles.find(r => r.id === body.role_id);
    if (selectedRole && selectedRole.name === 'Student') {
      const studentIdText = fd.get('linked_student_id_text');
      if (!studentIdText) { alert('Enter the Student ID this account belongs to.'); return; }
      const dbId = await resolveStudentDbId(studentIdText);
      if (!dbId) { alert(`No student found with ID "${studentIdText}".`); return; }
      body.linked_student_id = dbId;
    }
    if (selectedRole && selectedRole.name === 'Canteen Collector') {
      if (!fd.get('assigned_class_id')) { alert('Choose which class this collector is assigned to.'); return; }
      body.assigned_class_id = Number(fd.get('assigned_class_id'));
    }
    if (selectedRole && selectedRole.name === 'Arabic Head Teacher') {
      if (!fd.get('assigned_level')) { alert('Choose which level this Arabic Head Teacher supervises.'); return; }
      body.assigned_level = fd.get('assigned_level');
    }
    try {
      if (isEdit) await api(`/users/${existing.id}`, { method: 'PUT', body });
      else await api('/users', { method: 'POST', body });
      modal.remove();
      renderUsers();
    } catch (err) { alert(err.message); }
  });
}

async function renderUsers() {
  const content = document.getElementById('content');
  const [users, roles] = await Promise.all([api('/users'), api('/roles')]);
  // Group user accounts by role category rather than one long undifferentiated list — makes it
  // much easier to find, say, "which students have logins" without scrolling past every teacher.
  const categoryOf = (roleName) => {
    if (roleName === 'Student') return 'Students';
    if (roleName === 'Teacher' || roleName === 'Arabic Head Teacher') return 'Teachers';
    if (roleName === 'Non-teaching Staff' || roleName === 'Canteen Collector') return 'Non-teaching Staff';
    return 'Other (Admin, Accountant, Parent, etc.)';
  };
  const categories = ['Students', 'Teachers', 'Non-teaching Staff', 'Other (Admin, Accountant, Parent, etc.)'];
  const grouped = {}; categories.forEach(c => grouped[c] = []);
  users.forEach(u => grouped[categoryOf(u.role)].push(u));

  function usersTableHtml(list) {
    return `<div class="table-wrap"><table><thead><tr><th></th><th>Username</th><th>Full Name</th><th>Role</th><th>Status</th><th></th></tr></thead>
    <tbody>${list.map(u => `<tr data-id="${u.id}"><td>${photoThumb(u.photo)}</td><td>${escapeHtml(u.username)}</td><td>${escapeHtml(u.full_name)}</td><td>${escapeHtml(u.role)}</td><td>${statusBadge(u.status)}</td>
      <td class="row-actions">${can('users', 'edit') ? `<button class="edit-user">Edit</button><button class="toggle-user">${u.status === 'Active' ? 'Suspend' : 'Activate'}</button>` : ''}</td></tr>`).join('') || `<tr><td colspan=6 class="muted">No accounts in this category yet.</td></tr>`}</tbody></table></div>`;
  }

  content.innerHTML = `<div class="page-header"><h2>Users & Roles</h2>
    ${can('users', 'add') ? `<button class="btn gold" id="add-user">+ Add User</button>` : ''}</div>
    <div class="tabs">
      ${categories.map((c, i) => `<div class="tab ${i === 0 ? 'active' : ''}" data-cat="${escapeHtml(c)}">${escapeHtml(c)} <span class="small-text">(${grouped[c].length})</span></div>`).join('')}
    </div>
    <div id="users-tab-content">${usersTableHtml(grouped[categories[0]])}</div>
    <div class="card" style="margin-top:20px">
      <h3 style="margin-top:0;color:var(--navy)">Role Permissions</h3>
      <div class="toolbar"><select id="role-select">${roles.map(r => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('')}</select></div>
      <div id="perm-table"></div>
    </div>
    <div class="card" style="margin-top:20px">
      <div class="page-header" style="margin-bottom:0"><h3 style="margin:0;color:var(--navy)">Portal Dashboard Widgets</h3>
        <button type="button" class="btn secondary" id="open-widget-config-btn">⚙ Configure</button></div>
      <p class="small-text" style="margin-top:8px">Controls which cards show up on the simplified "portal" dashboard that Teachers, Students,
        Parents/Guardians, and Non-teaching Staff land on when they log in — separate from the admin-style Dashboard.</p>
    </div>`;

  function wireRowActions() {
    document.querySelectorAll('.toggle-user').forEach(btn => btn.addEventListener('click', async (e) => {
      const id = e.target.closest('tr').dataset.id;
      const u = users.find(x => x.id == id);
      await api(`/users/${id}`, { method: 'PUT', body: { status: u.status === 'Active' ? 'Suspended' : 'Active' } });
      renderUsers();
    }));
    document.querySelectorAll('.edit-user').forEach(btn => btn.addEventListener('click', (e) => {
      const id = e.target.closest('tr').dataset.id;
      openUserForm(users.find(x => x.id == id), roles);
    }));
  }
  wireRowActions();
  document.querySelectorAll('#content > .tabs .tab').forEach(tabEl => tabEl.addEventListener('click', () => {
    document.querySelectorAll('#content > .tabs .tab').forEach(t => t.classList.toggle('active', t === tabEl));
    document.getElementById('users-tab-content').innerHTML = usersTableHtml(grouped[tabEl.dataset.cat]);
    wireRowActions();
  }));
  document.getElementById('add-user')?.addEventListener('click', () => openUserForm(null, roles));

  const MODULES = ['dashboard','students','parents','teachers','staff','classes','subjects','academic_sessions','attendance','results','fees','bus','canteen','announcements','forum','messages','assignments','class_groups','exam_schedule','live_class_rooms','users','settings','audit_logs','backup'];
  const MODULE_LABELS = {
    dashboard: 'Dashboard', students: 'Students (incl. Admissions, Alumni, ID Cards, Promote Students)', parents: 'Parents & Guardians (incl. Contact List)',
    teachers: 'Teachers (incl. Teacher logins)', staff: 'Non-teaching Staff (incl. Staff Check-in, Daily Check-in List)', classes: 'Classes (incl. Timetable, Duty Roster)',
    subjects: 'Subjects', academic_sessions: 'Academic Years & Terms (incl. Pass Mark)', attendance: 'Attendance', results: 'Results (incl. Performance Report, Arabic Terminal Report, Class Termly Report)',
    fees: 'Fees', bus: 'School Bus', canteen: 'Canteen (incl. Canteen Collector monitoring)', announcements: 'Announcements (incl. file/photo attachments)', forum: 'Discussion Forum (incl. file/photo attachments)',
    messages: 'Private Messages (student ↔ classmate/teacher)',
    assignments: 'Assignments & Quizzes', class_groups: 'Class Groups', exam_schedule: 'Exam Schedule', live_class_rooms: 'Live Class Rooms', users: 'Users & Roles', settings: 'Settings (incl. Menu Theme, Report Heading)',
    audit_logs: 'Audit Logs', backup: 'Backup & Restore',
  };
  async function loadPermTable() {
    const roleId = document.getElementById('role-select').value;
    const perms = await api(`/role-permissions?role_id=${roleId}`);
    const permMap = {}; perms.forEach(p => permMap[p.module] = p);
    document.getElementById('perm-table').innerHTML = `<div class="table-wrap"><table class="perm-table"><thead><tr><th>Module</th><th>View</th><th>Add</th><th>Edit</th><th>Delete</th><th>Export</th></tr></thead>
      <tbody>${MODULES.map(m => {
        const p = permMap[m] || {};
        return `<tr data-module="${m}">
          <td>${MODULE_LABELS[m] || m.replace(/_/g,' ')}</td>
          ${['can_view','can_add','can_edit','can_delete','can_export'].map(k => `<td><input type="checkbox" data-key="${k}" ${p[k] ? 'checked' : ''} ${can('users','edit') ? '' : 'disabled'}></td>`).join('')}
        </tr>`;
      }).join('')}</tbody></table></div>
      ${can('users', 'edit') ? `<div style="margin-top:12px"><button class="btn gold" id="save-perms">Save Permissions</button></div>` : ''}`;
    document.getElementById('save-perms')?.addEventListener('click', async () => {
      const rows = document.querySelectorAll('#perm-table tr[data-module]');
      for (const row of rows) {
        const module = row.dataset.module;
        const body = { role_id: Number(roleId), module };
        row.querySelectorAll('input[type=checkbox]').forEach(cb => body[cb.dataset.key] = cb.checked);
        await api('/role-permissions', { method: 'PUT', body });
      }
      alert('Permissions updated. Users may need to log in again to see sidebar changes.');
      buildNav();
    });
  }
  document.getElementById('role-select').addEventListener('change', loadPermTable);
  loadPermTable();

  document.getElementById('open-widget-config-btn')?.addEventListener('click', () => openWidgetConfigModal(roles));
}

// A popup for choosing which cards appear on the simplified portal dashboard for each
// non-admin role — pulled out of the Users & Roles page into its own modal (rather than a
// permanently-open card) and laid out as a proper toggle-able grid, matching the icons the
// actual dashboard cards use, instead of a plain checkbox list.
function openWidgetConfigModal(roles) {
  const WIDGET_DEFS = [
    ['results', '📊', 'Results / My Classes'], ['fees', '💳', 'Fees'], ['live-class', '📹', 'Live Class Rooms'],
    ['announcements', '📢', 'Announcements'], ['forum', '💬', 'Discussion Forum'], ['messages', '✉️', 'Messages'], ['tasks', '✅', 'Tasks'],
    ['attendance', '🗓️', 'Attendance'], ['exam-schedule', '📝', 'Exam Schedule'], ['class-list', '🏫', 'My Class'], ['assignments', '📚', 'Assignments & Quizzes'],
  ];
  const portalRoles = roles.filter(r => ['Teacher', 'Student', 'Parent/Guardian', 'Non-teaching Staff'].includes(r.name));
  const modal = el(`<div class="modal-backdrop"><div class="modal" style="width:520px">
    <h3 style="margin-top:0;color:var(--navy)">⚙ Portal Dashboard Widgets</h3>
    <p class="small-text">A widget is shown by default until switched off here.</p>
    <div class="toolbar"><select id="widget-role-select">${portalRoles.map(r => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('')}</select></div>
    <div id="widget-checkboxes" style="margin-top:14px"></div>
    <div class="modal-actions"><button type="button" class="btn secondary" id="widget-modal-close">Close</button><button type="button" class="btn gold" id="save-widget-config">Save</button></div>
  </div></div>`);
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  modal.querySelector('#widget-modal-close').addEventListener('click', () => modal.remove());
  async function loadWidgetConfig() {
    const roleId = modal.querySelector('#widget-role-select').value;
    const map = await api(`/role-dashboard-widgets?role_id=${roleId}`);
    modal.querySelector('#widget-checkboxes').innerHTML = `<div class="widget-toggle-grid">${WIDGET_DEFS.map(([key, icon, label]) => `
      <label class="widget-toggle-card ${map[key] !== false ? 'on' : ''}">
        <input type="checkbox" data-widget-key="${key}" ${map[key] !== false ? 'checked' : ''} style="display:none">
        <span class="widget-toggle-icon">${icon}</span>
        <span class="widget-toggle-label">${escapeHtml(label)}</span>
      </label>`).join('')}</div>`;
    modal.querySelectorAll('.widget-toggle-card').forEach(card => card.addEventListener('click', () => {
      const cb = card.querySelector('input');
      cb.checked = !cb.checked;
      card.classList.toggle('on', cb.checked);
    }));
  }
  modal.querySelector('#widget-role-select').addEventListener('change', loadWidgetConfig);
  modal.querySelector('#save-widget-config').addEventListener('click', async () => {
    const roleId = Number(modal.querySelector('#widget-role-select').value);
    const widgets = {};
    modal.querySelectorAll('#widget-checkboxes input[type=checkbox]').forEach(cb => { widgets[cb.dataset.widgetKey] = cb.checked; });
    await api('/role-dashboard-widgets', { method: 'PUT', body: { role_id: roleId, widgets } });
    alert('Dashboard widgets saved.');
  });
  loadWidgetConfig();
}

// ---------- Audit log ----------
async function renderAudit() {
  const content = document.getElementById('content');
  const logs = await api('/audit-logs');
  content.innerHTML = `<div class="page-header"><h2>Audit Logs</h2>
    ${can('audit_logs', 'delete') ? `<button class="btn danger" id="clear-audit-btn">🗑 Clear Audit Logs</button>` : ''}</div>
    <div class="table-wrap"><table><thead><tr><th>When</th><th>User</th><th>Action</th><th>Module</th><th>Details</th></tr></thead>
    <tbody>${logs.map(l => `<tr><td>${l.created_at}</td><td>${escapeHtml(l.username)}</td><td>${escapeHtml(l.action)}</td><td>${escapeHtml(l.module)}</td><td class="small-text">${escapeHtml(l.details)}</td></tr>`).join('') || '<tr><td colspan=5 class="muted">No entries yet</td></tr>'}</tbody></table></div>`;
  document.getElementById('clear-audit-btn')?.addEventListener('click', async () => {
    if (!confirm('Permanently clear ALL audit log entries? This cannot be undone, and clearing the logs will itself be recorded as the very next entry.')) return;
    await api('/audit-logs', { method: 'DELETE' });
    renderAudit();
  });
}

// ---------- Backup / Restore ----------
async function renderBackup() {
  const content = document.getElementById('content');
  const [backups, location] = await Promise.all([api('/backup'), api('/backup-location')]);
  content.innerHTML = `<div class="page-header"><h2>Backup & Restore</h2>
    ${can('backup', 'add') ? `<button class="btn gold" id="create-backup">Create Backup Now</button>` : ''}</div>
    <div class="card">
      <h3 style="margin-top:0;color:var(--navy)">Backup Location</h3>
      <p class="small-text">Where backup files are actually saved on this computer. By default this is a
        <code>backups</code> folder next to the app — you can point it somewhere else instead (a USB drive, an
        external disk, a shared network folder) the first time you set this system up, or any time after.</p>
      <div class="notice" style="font-family:monospace;font-size:13px">${escapeHtml(location.effectivePath)}</div>
      ${location.customConfigured && !location.customCurrentlyWorking ? `<p class="small-text" style="color:var(--red)">⚠ Your custom folder (${escapeHtml(location.customPath)}) is currently unavailable (unplugged, or the path no longer exists) — backups are falling back to the default location above until it's reachable again.</p>` : ''}
      ${can('backup', 'edit') ? `
      <div class="toolbar" style="margin-top:10px">
        <input type="text" id="backup-folder-input" value="${escapeHtml(location.customPath || '')}" placeholder="e.g. D:\\SchoolBackups or leave blank for the default" style="min-width:320px">
        <button class="btn secondary" id="save-backup-folder">Save Location</button>
        ${location.customConfigured ? `<button class="btn secondary" id="reset-backup-folder">Use Default</button>` : ''}
      </div>
      <p class="small-text" id="backup-folder-status"></p>` : ''}
    </div>
    <div class="card">
      <p class="muted">Download a copy regularly and store it on a USB drive or another computer for safety.</p>
    </div>
    <div class="table-wrap"><table><thead><tr><th>Backup File</th><th>Created</th><th></th></tr></thead>
    <tbody>${backups.map(b => `<tr><td>${escapeHtml(b.filename)}</td><td>${b.created_at}</td><td class="row-actions">
      <a class="btn secondary" style="text-decoration:none;display:inline-block" href="/api/backup/download/${encodeURIComponent(b.filename)}">Download</a>
      ${can('backup','add') ? `<button class="restore-btn" data-file="${escapeHtml(b.filename)}">Restore</button>` : ''}
    </td></tr>`).join('') || '<tr><td colspan=3 class="muted">No backups yet</td></tr>'}</tbody></table></div>
    ${can('backup', 'add') ? `
    <div class="card" style="margin-top:18px">
      <h3 style="margin-top:0;color:var(--navy)">Restore from an Uploaded File</h3>
      <p class="small-text">Use this if you have a backup file (<code>.zip</code>, or an older <code>.db</code> file from before backups included images) from a USB drive, another computer, or an email attachment — not one already listed above.</p>
      <div class="toolbar">
        <input type="file" id="restore-upload-input" accept=".zip,.db">
        <button class="btn danger" id="restore-upload-btn">Upload &amp; Restore</button>
      </div>
    </div>` : ''}`;
  document.getElementById('create-backup')?.addEventListener('click', async () => {
    const r = await api('/backup', { method: 'POST' });
    alert('Backup created: ' + r.filename);
    renderBackup();
  });
  document.getElementById('save-backup-folder')?.addEventListener('click', async () => {
    const val = document.getElementById('backup-folder-input').value.trim();
    const status = document.getElementById('backup-folder-status');
    try {
      await api('/settings', { method: 'PUT', body: { custom_backup_folder: val || null } });
      status.style.color = 'var(--green)'; status.textContent = '✓ Saved.';
      renderBackup();
    } catch (e) { status.style.color = 'var(--red)'; status.textContent = e.message; }
  });
  document.getElementById('reset-backup-folder')?.addEventListener('click', async () => {
    await api('/settings', { method: 'PUT', body: { custom_backup_folder: null } });
    renderBackup();
  });
  content.querySelectorAll('.restore-btn').forEach(btn => btn.addEventListener('click', async () => {
    const filename = btn.dataset.file;
    const warn = await api('/restore-warning');
    if (!confirm(warn.warning + '\n\nRestore "' + filename + '" now?')) return;
    try {
      const r = await api('/restore', { method: 'POST', body: { filename, confirm: true } });
      alert(r.message + '\n\nPlease restart the school system now (close and reopen "Start Nibras School System").');
    } catch (e) { alert(e.message); }
  }));
  document.getElementById('restore-upload-btn')?.addEventListener('click', async () => {
    const file = document.getElementById('restore-upload-input').files[0];
    if (!file) return alert('Choose a backup (.zip or .db) file first.');
    const warn = await api('/restore-warning');
    if (!confirm(warn.warning + '\n\nRestore from the uploaded file "' + file.name + '" now?')) return;
    try {
      const fileData = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const r = await api('/restore-upload', { method: 'POST', body: { file_data: fileData, confirm: true } });
      alert(r.message + '\n\nPlease restart the school system now (close and reopen "Start Nibras School System").');
    } catch (e) { alert(e.message); }
  });
}

// ---------- Settings ----------
// ---------- Settings (School Dashboard) ----------
async function renderSettings() {
  const content = document.getElementById('content');
  const s = await api('/settings');
  const editable = can('settings', 'edit');
  const logoUrl = s.logo_photo ? `/uploads/${encodeURIComponent(s.logo_photo)}` : '/assets/logo.png';
  const lockConfig = editable ? await api('/system-lock-config').catch(() => ({ expiry_date: null })) : { expiry_date: null };
  const momoConfigured = !!(s.momo_subscription_key && s.momo_api_user && s.momo_api_key);
  const customFonts = await api('/custom-fonts').catch(() => []);

  content.innerHTML = `<div class="page-header"><h2>School Dashboard &amp; Settings</h2></div>

    <div class="card">
      <h3 class="section-title">School Identity</h3>
      <p class="small-text">This appears on the login screen, the sidebar, every report card, and fee receipts.</p>
      <form id="identity-form">
        <div class="photo-upload-row" style="margin-bottom:16px">
          <div class="photo-preview-box" id="logo-preview"><img src="${logoUrl}" alt=""></div>
          <div>
            <label>School Logo</label>
            <input type="file" accept="image/*" id="logo-input">
            <p class="small-text" style="margin:6px 0 0">Shown as a circular crest throughout the system.</p>
          </div>
        </div>
        <div class="form-grid">
          <div><label>School Name</label><input name="school_name" value="${escapeHtml(s.school_name)}" required></div>
          <div><label>Motto</label><input name="motto" value="${escapeHtml(s.motto)}"></div>
          <div><label>Address</label><input name="address" value="${escapeHtml(s.address)}"></div>
          <div><label>Location / Region</label><input name="location" value="${escapeHtml(s.location)}" placeholder="e.g. Kumasi, Ashanti"></div>
          <div><label>Contact Number</label><input name="phone" value="${escapeHtml(s.phone)}"></div>
          <div><label>Email Address</label><input name="email" type="email" value="${escapeHtml(s.email)}"></div>
        </div>
        <h4 style="margin:16px 0 6px;color:var(--navy);font-size:14px">Report Card Heading</h4>
        <p class="small-text" style="margin-bottom:10px">Controls how the school logo, name, and motto are laid out at the top of report cards — including the Arabic Terminal Report.</p>
        <div class="form-grid">
          <div><label>Heading Alignment</label>
            <select name="report_header_align">
              <option value="left" ${s.report_header_align === 'left' ? 'selected' : ''}>Left</option>
              <option value="center" ${!s.report_header_align || s.report_header_align === 'center' ? 'selected' : ''}>Center</option>
              <option value="right" ${s.report_header_align === 'right' ? 'selected' : ''}>Right</option>
            </select>
          </div>
          <div class="full"><label>Additional Header Information</label>
            <textarea name="report_header_extra" rows="2" placeholder="e.g. GES School Code, P.O. Box, accreditation number — shown under the motto">${escapeHtml(s.report_header_extra || '')}</textarea>
          </div>
        </div>
        ${editable ? `<div class="modal-actions" style="justify-content:flex-start"><button type="submit" class="btn gold">Save School Identity</button></div>` : ''}
      </form>
    </div>

    <div class="card">
      <h3 class="section-title">Menu Theme</h3>
      <p class="small-text">Choose a color theme for the sidebar menu — applies everywhere, for everyone, immediately.</p>
      <div class="theme-dropdown-row">
        <select id="nav-theme-select" ${!editable ? 'disabled' : ''}>
          ${Object.entries(NAV_THEMES).map(([key, theme]) => `<option value="${key}" ${s.nav_theme === key || (!s.nav_theme && key === 'navy-gold') ? 'selected' : ''}>${escapeHtml(theme.label)}</option>`).join('')}
          <option value="custom" ${s.nav_theme === 'custom' ? 'selected' : ''}>Custom Color (set below)</option>
        </select>
        <span class="theme-dropdown-preview" id="nav-theme-preview"></span>
      </div>
    </div>

    <div class="card">
      <h3 class="section-title">Page Theme</h3>
      <p class="small-text">Additional color themes for the whole page — background, cards, and text — on top of the Menu Theme above.</p>
      <div class="theme-dropdown-row">
        <select id="page-theme-select" ${!editable ? 'disabled' : ''}>
          ${Object.entries(PAGE_THEMES).map(([key, theme]) => `<option value="${key}" ${s.page_theme === key || (!s.page_theme && key === 'default') ? 'selected' : ''}>${escapeHtml(theme.label)}</option>`).join('')}
          <option value="custom" ${s.page_theme === 'custom' ? 'selected' : ''}>Custom Color (set below)</option>
        </select>
        <span class="theme-dropdown-preview" id="page-theme-preview" style="border:1px solid #ccc"></span>
      </div>
    </div>

    <div class="card">
      <h3 class="section-title">Custom Color Palette</h3>
      <p class="small-text">Not loving any of the preset themes above? Pick any color you like — one for the menu, one for
        the page — and the system works out matching lighter/darker shades automatically.</p>
      <div class="form-grid">
        <div><label>Custom Menu Color</label>
          <div class="toolbar"><input type="color" id="custom-nav-color" value="${s.custom_accent_color || '#c8973a'}" ${!editable ? 'disabled' : ''}>
            <button type="button" class="btn secondary" id="apply-custom-nav" ${!editable ? 'disabled' : ''} style="padding:6px 12px;font-size:12.5px">Use This Color</button></div>
        </div>
        <div><label>Custom Page Color</label>
          <div class="toolbar"><input type="color" id="custom-page-color" value="${s.custom_bg_color || '#2980b9'}" ${!editable ? 'disabled' : ''}>
            <button type="button" class="btn secondary" id="apply-custom-page" ${!editable ? 'disabled' : ''} style="padding:6px 12px;font-size:12.5px">Use This Color</button></div>
        </div>
      </div>
      ${s.nav_theme === 'custom' || s.page_theme === 'custom' ? `<p class="small-text" style="margin-top:8px">Currently active: ${s.nav_theme === 'custom' ? 'custom menu color' : ''}${s.nav_theme === 'custom' && s.page_theme === 'custom' ? ' and ' : ''}${s.page_theme === 'custom' ? 'custom page color' : ''}.</p>` : ''}
    </div>

    <div class="card">
      <h3 class="section-title">Student ID Card Customization</h3>
      <p class="small-text">Choose a color scheme and which optional fields print on every Student ID Card.</p>
      <div class="theme-swatch-row" id="idcard-theme-row">
        ${Object.entries(ID_CARD_THEMES).map(([key, theme]) => `
          <button type="button" class="theme-swatch idcard-theme-swatch ${(s.id_card_color || 'navy-gold') === key ? 'selected' : ''}" data-idcard-theme="${key}" ${!editable ? 'disabled' : ''}>
            <span class="theme-swatch-preview" style="background:linear-gradient(135deg, ${theme.band}, ${theme.accent})"></span>
            <span class="theme-swatch-label">${escapeHtml(theme.label)}</span>
          </button>`).join('')}
      </div>
      <div class="form-grid" style="margin-top:14px">
        <label style="display:flex;align-items:center;gap:8px;font-weight:400"><input type="checkbox" id="idcard-show-dob" ${s.id_card_show_dob ? 'checked' : ''} ${!editable ? 'disabled' : ''}> Show Date of Birth</label>
        <label style="display:flex;align-items:center;gap:8px;font-weight:400"><input type="checkbox" id="idcard-show-blood" ${s.id_card_show_blood_group ? 'checked' : ''} ${!editable ? 'disabled' : ''}> Show Blood Group</label>
        <label style="display:flex;align-items:center;gap:8px;font-weight:400"><input type="checkbox" id="idcard-show-contact" ${s.id_card_show_contact ? 'checked' : ''} ${!editable ? 'disabled' : ''}> Show Emergency Contact</label>
      </div>
      ${editable ? `<button type="button" class="btn gold" id="save-idcard-settings" style="margin-top:14px">Save ID Card Settings</button>` : ''}
    </div>

    <div class="card">
      <h3 class="section-title">Menu Size &amp; Cursor</h3>
      <div class="form-grid">
        <div><label>Menu Text Size</label>
          <select id="nav-font-size-select" ${!editable ? 'disabled' : ''}>
            <option value="small" ${s.nav_font_size === 'small' ? 'selected' : ''}>Small</option>
            <option value="medium" ${!s.nav_font_size || s.nav_font_size === 'medium' ? 'selected' : ''}>Medium</option>
            <option value="large" ${s.nav_font_size === 'large' ? 'selected' : ''}>Large</option>
          </select>
        </div>
        <div><label>Interface Text Size <span class="small-text">(whole app, not just the menu)</span></label>
          <select id="ui-font-scale-select" ${!editable ? 'disabled' : ''}>
            <option value="small" ${s.ui_font_scale === 'small' ? 'selected' : ''}>Small</option>
            <option value="medium" ${!s.ui_font_scale || s.ui_font_scale === 'medium' ? 'selected' : ''}>Medium</option>
            <option value="large" ${s.ui_font_scale === 'large' ? 'selected' : ''}>Large</option>
            <option value="xlarge" ${s.ui_font_scale === 'xlarge' ? 'selected' : ''}>Extra Large</option>
          </select>
        </div>
        <div><label>Mouse Cursor</label>
          <select id="cursor-style-select" ${!editable ? 'disabled' : ''}>
            ${Object.entries(CURSOR_STYLES).map(([key, c]) => `<option value="${key}" ${(s.cursor_style || 'default') === key ? 'selected' : ''}>${escapeHtml(c.label)}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>

    <div class="card">
      <h3 class="section-title">Arabic Report Font</h3>
      <p class="small-text">Choose which installed Arabic font the Arabic Terminal Report prints in.</p>
      <select id="arabic-font-select" ${!editable ? 'disabled' : ''} style="font-size:20px;padding:10px;height:auto">
        ${Object.entries(ARABIC_FONTS).map(([key, f]) => `<option value="${key}" style="font-family:'${f.family}'" ${(!s.arabic_report_font || s.arabic_report_font === 'default') && key === 'default' ? 'selected' : ''} ${s.arabic_report_font === key ? 'selected' : ''}>${escapeHtml(f.label)} — نموذج الخط</option>`).join('')}
        ${customFonts.map(f => `<option value="${escapeHtml(f.font_key)}" style="font-family:'${escapeHtml(f.family_name)}'" ${s.arabic_report_font === f.font_key ? 'selected' : ''}>${escapeHtml(f.display_name)} (uploaded) — نموذج الخط</option>`).join('')}
      </select>
      <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border)">
        <h4 style="margin:0 0 6px;color:var(--navy)">Custom Fonts</h4>
        <p class="small-text">Upload the school's own font (.ttf or .otf) — it becomes selectable above, alongside the
          built-in ones. Uploading is an admin-level change, the same as anything else on this page.</p>
        ${editable ? `
        <div class="toolbar">
          <input type="text" id="custom-font-name" placeholder="Name for this font (e.g. Al-Qalam Bold)" style="min-width:220px">
          <input type="file" id="custom-font-file" accept=".ttf,.otf">
          <button type="button" class="btn secondary" id="custom-font-upload-btn">⬆ Upload</button>
        </div>` : ''}
        <div id="custom-fonts-list" style="margin-top:10px">
          ${customFonts.length ? `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Preview</th><th></th></tr></thead>
            <tbody>${customFonts.map(f => `<tr><td>${escapeHtml(f.display_name)}</td><td style="font-family:'${escapeHtml(f.family_name)}';font-size:18px">نموذج الخط</td>
              <td>${editable ? `<button type="button" class="custom-font-del-btn" data-id="${f.id}">Delete</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`
            : '<p class="small-text">No custom fonts uploaded yet.</p>'}
        </div>
      </div>
    </div>

    <div class="card">
      <h3 class="section-title">Dashboard Background</h3>
      <p class="small-text">An optional background image shown behind the Dashboard page. Keep it subtle — busy images make the stat cards harder to read.</p>
      <div class="photo-upload-row" style="margin-bottom:16px">
        <div class="photo-preview-box" id="dashboard-bg-preview" style="width:160px;height:96px">${s.dashboard_background_photo ? `<img src="/uploads/${encodeURIComponent(s.dashboard_background_photo)}" alt="">` : '<span class="small-text">No image set</span>'}</div>
        <div>
          <input type="file" accept="image/*" id="dashboard-bg-input">
          <div style="margin-top:8px">${editable ? `<button type="button" class="btn secondary" id="remove-dashboard-bg-btn" style="padding:6px 12px;font-size:12.5px">Remove Background</button>` : ''}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <h3 class="section-title">Login Page Background</h3>
      <p class="small-text">An optional full-screen background image shown behind the login form — a school photo, campus shot, or a simple pattern. A dark tint is applied automatically so the login card stays easy to read.</p>
      <div class="photo-upload-row" style="margin-bottom:16px">
        <div class="photo-preview-box" id="login-bg-preview" style="width:160px;height:96px">${s.login_background ? `<img src="/uploads/${encodeURIComponent(s.login_background)}" alt="">` : '<span class="small-text">No image set</span>'}</div>
        <div>
          <input type="file" accept="image/*" id="login-bg-input">
          <div style="margin-top:8px">${editable ? `<button type="button" class="btn secondary" id="remove-login-bg-btn" style="padding:6px 12px;font-size:12.5px">Remove Background</button>` : ''}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <h3 class="section-title">Student &amp; Staff ID Format</h3>
      <p class="small-text">IDs are generated automatically when a record is added — choose the style here.</p>
      <form id="idformat-form">
        <div class="form-grid">
          <div><label>Student ID Prefix</label><input name="student_id_prefix" id="sid-prefix" value="${escapeHtml(s.student_id_prefix || 'NIB')}" required></div>
          <div><label>Staff ID Prefix</label><input name="staff_id_prefix" id="stid-prefix" value="${escapeHtml(s.staff_id_prefix || 'ST')}" required></div>
          <div><label>Sequence Digits</label>
            <select name="id_seq_digits" id="seq-digits">
              ${[2, 3, 4, 5].map(d => `<option value="${d}" ${Number(s.id_seq_digits || 3) === d ? 'selected' : ''}>${d} digits</option>`).join('')}
            </select>
          </div>
        </div>
        <p class="notice" id="id-preview" style="margin-top:14px"></p>
        ${editable ? `<div class="modal-actions" style="justify-content:flex-start"><button type="submit" class="btn gold">Save ID Format</button></div>` : ''}
      </form>
    </div>

    <div class="card">
      <h3 class="section-title">Continuous Assessment Style</h3>
      <p class="small-text">Rename the four CA components, set their maximum marks, the exam's maximum mark, and how much each half (CA vs Exam) counts toward the final grade. The two weights must add up to 100%.</p>
      <form id="castyle-form">
        <div class="form-grid">
          <div><label>Component 1 Name</label><input name="ca_c1_name" value="${escapeHtml(s.ca_c1_name || 'Class Exercise')}"></div>
          <div><label>Component 1 Max</label><input name="ca_c1_max" type="number" min="1" value="${s.ca_c1_max ?? 15}"></div>
          <div><label>Component 2 Name</label><input name="ca_c2_name" value="${escapeHtml(s.ca_c2_name || 'Class Test')}"></div>
          <div><label>Component 2 Max</label><input name="ca_c2_max" type="number" min="1" value="${s.ca_c2_max ?? 15}"></div>
          <div><label>Component 3 Name</label><input name="ca_c3_name" value="${escapeHtml(s.ca_c3_name || 'Group Work')}"></div>
          <div><label>Component 3 Max</label><input name="ca_c3_max" type="number" min="1" value="${s.ca_c3_max ?? 15}"></div>
          <div><label>Component 4 Name</label><input name="ca_c4_name" value="${escapeHtml(s.ca_c4_name || 'Project Work')}"></div>
          <div><label>Component 4 Max</label><input name="ca_c4_max" type="number" min="1" value="${s.ca_c4_max ?? 15}"></div>
          <div><label>Exam Max Score</label><input name="exam_max" type="number" min="1" value="${s.exam_max ?? 100}"></div>
          <div></div>
          <div><label>CA Weight (%)</label><input name="ca_weight_percent" id="ca-weight" type="number" min="0" max="100" value="${s.ca_weight_percent ?? 50}"></div>
          <div><label>Exam Weight (%)</label><input name="exam_weight_percent" id="exam-weight" type="number" min="0" max="100" value="${s.exam_weight_percent ?? 50}"></div>
        </div>
        <p class="small-text" id="weight-check" style="margin-top:10px"></p>
        ${editable ? `<div class="modal-actions" style="justify-content:flex-start"><button type="submit" class="btn gold">Save CA Style</button></div>` : ''}
      </form>
    </div>

    <div class="card">
      <h3 class="section-title">MTN Mobile Money (Collections API)</h3>
      <p class="small-text">Lets parents/students pay fees directly by MTN MoMo — a payment prompt is sent straight to
        their phone to approve. Needs a real MTN MoMo Collections API account (from
        <a href="https://momodeveloper.mtn.com" target="_blank" rel="noopener">momodeveloper.mtn.com</a>) — nothing
        will actually process until real credentials are entered here.</p>
      <div class="form-grid">
        <div><label>Subscription Key</label><input type="password" id="momo-sub-key" value="${escapeHtml(s.momo_subscription_key || '')}" ${!editable ? 'disabled' : ''}></div>
        <div><label>API User ID</label><input type="text" id="momo-api-user" value="${escapeHtml(s.momo_api_user || '')}" ${!editable ? 'disabled' : ''}></div>
        <div><label>API Key</label><input type="password" id="momo-api-key" value="${escapeHtml(s.momo_api_key || '')}" ${!editable ? 'disabled' : ''}></div>
        <div><label>Environment</label>
          <select id="momo-environment" ${!editable ? 'disabled' : ''}>
            <option value="sandbox" ${(s.momo_target_environment || 'sandbox') === 'sandbox' ? 'selected' : ''}>Sandbox (testing)</option>
            <option value="mtnghana" ${s.momo_target_environment === 'mtnghana' ? 'selected' : ''}>Live (Ghana)</option>
          </select>
        </div>
      </div>
      <p class="small-text" style="margin-top:6px">Base URL: <code>${escapeHtml(s.momo_base_url || 'https://sandbox.momodeveloper.mtn.com')}</code> — switches automatically between MTN's sandbox and live API hosts based on the environment above when you save.</p>
      ${editable ? `<button type="button" class="btn gold" id="save-momo-settings" style="margin-top:10px">Save MTN MoMo Settings</button>` : ''}
      ${momoConfigured ? `<p class="small-text" style="margin-top:8px;color:var(--green)">✓ Credentials are entered — payments can be attempted.</p>` : `<p class="small-text" style="margin-top:8px;color:var(--red)">⚠ Not yet configured — the "Pay with MoMo" option on Fees won't work until this is filled in.</p>`}
    </div>

    <div class="card">
      <h3 class="section-title">Automatic Weekly Backup Email</h3>
      <p class="small-text">Sends the database backup by email every Friday, automatically, whenever this computer is running with internet access at the time. You can also send one immediately at any time with the button below.</p>
      <form id="backupmail-form">
        <div class="form-grid">
          <div class="full"><label>Backup Recipient Email</label><input name="backup_email" type="email" value="${escapeHtml(s.backup_email)}" placeholder="e.g. admin@nibras.edu.gh"></div>
          <div><label>SMTP Host</label><input name="smtp_host" value="${escapeHtml(s.smtp_host)}" placeholder="e.g. smtp.gmail.com"></div>
          <div><label>SMTP Port</label><input name="smtp_port" type="number" value="${s.smtp_port ?? 587}"></div>
          <div><label>SMTP Username</label><input name="smtp_username" value="${escapeHtml(s.smtp_username)}"></div>
          <div><label>SMTP Password</label><input name="smtp_password" type="password" value="${escapeHtml(s.smtp_password)}" placeholder="${s.smtp_password ? '(unchanged)' : ''}"></div>
          <div class="checkbox-row" style="margin-top:0"><input type="checkbox" name="smtp_secure" id="smtp-secure" ${s.smtp_secure ? 'checked' : ''}><label style="margin:0">Use TLS on connect (port 465 style, instead of STARTTLS on 587)</label></div>
          <div class="checkbox-row" style="margin-top:0"><input type="checkbox" name="auto_backup_email_enabled" id="auto-backup-enabled" ${s.auto_backup_email_enabled ? 'checked' : ''}><label style="margin:0">Automatically email a backup every Friday</label></div>
        </div>
        <p class="small-text" style="margin-top:10px">Last automatic/manual send: ${escapeHtml(s.last_auto_backup_sent_date) || 'never'} — ${escapeHtml(s.last_auto_backup_status) || 'no attempt yet'}</p>
        <div class="modal-actions" style="justify-content:flex-start;gap:10px">
          ${editable ? `<button type="submit" class="btn gold">Save Email Settings</button>` : ''}
          ${editable ? `<button type="button" class="btn secondary" id="send-backup-now">Send Backup Now</button>` : ''}
        </div>
      </form>
    </div>

    ${editable ? `<div class="card">
      <h3 class="section-title">System Access Lock</h3>
      <p class="small-text">Set a date after which the whole system — for every user, including admins — locks until the
        correct unlock token is entered. Useful for enforcing a renewal or review cycle. <b>Write the token down somewhere
        safe when you generate it — it's shown only once.</b></p>
      <div class="form-grid">
        <div><label>Expiry Date</label><input type="date" id="lock-expiry-date" value="${lockConfig.expiry_date || ''}"></div>
        <div><label>Status</label><div style="padding-top:10px;font-weight:700;color:${lockConfig.expiry_date ? 'var(--red)' : 'var(--green)'}">${lockConfig.expiry_date ? `Locks on ${lockConfig.expiry_date}` : 'No expiry set — always accessible'}</div></div>
      </div>
      <div class="modal-actions" style="justify-content:flex-start;gap:10px">
        <button type="button" class="btn gold" id="save-lock-expiry">Save Expiry Date</button>
        <button type="button" class="btn secondary" id="clear-lock-expiry">Clear Expiry (never lock)</button>
        <button type="button" class="btn secondary" id="generate-lock-token">Generate New Unlock Token</button>
      </div>
      <div id="lock-token-display" class="notice hidden" style="margin-top:12px"></div>
    </div>

    <div class="card">
      <h3 class="section-title">🔒 Screen Lock</h3>
      <p class="small-text">Lets the Administrator lock the screen with a quick PIN when stepping away — the session
        stays logged in underneath, so unlocking only needs the PIN, not the full password. Separate from the
        5-minute automatic sign-out, which fully logs out.</p>
      <label style="display:flex;align-items:center;gap:8px;font-weight:400"><input type="checkbox" id="lock-enabled-cb" ${s.lock_enabled ? 'checked' : ''}> Enable Screen Lock</label>
      <div class="form-grid" style="margin-top:10px">
        <div><label>Set/Change PIN <span class="small-text">(4-8 digits)</span></label><input type="password" id="lock-pin-input" inputmode="numeric" maxlength="8" placeholder="${s.lock_pin_hash ? '•••• already set' : 'e.g. 2468'}"></div>
      </div>
      <button type="button" class="btn gold" id="save-lock-settings" style="margin-top:10px">Save</button>
      <p id="lock-settings-status" class="small-text"></p>
    </div>

    <div class="card">
      <h3 class="section-title">Connect a Phone or Another Computer</h3>
      <p class="small-text">This school system runs on this one computer, but anyone on the <b>same Wi-Fi/network</b> —
        a phone, tablet, or another computer — can open it too. Scan the QR code below with a phone camera, or open one
        of the addresses shown, to connect from another device.</p>
      <div id="network-connect-info"><div class="empty-state">Loading…</div></div>
      ${editable ? `
      <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">
        <label>Custom Connection Address <span class="small-text">(optional — for advanced setups like router port-forwarding, where the addresses above aren't the right one to share)</span></label>
        <input type="text" id="custom-connect-url" value="${escapeHtml(s.custom_connect_url || '')}" placeholder="e.g. http://192.168.1.50:3000">
        <button type="button" class="btn secondary" id="save-custom-connect-url" style="margin-top:8px">Save</button>
      </div>` : ''}
    </div>

    <div class="card" style="border:2px solid var(--red)">
      <h3 class="section-title" style="color:var(--red)">⚠ Danger Zone — Reset System</h3>
      <p class="small-text">Permanently deletes <b>every</b> student, teacher, staff, parent, result, fee, message, and
        every other record in the system — everything except your own login and the school identity settings above.
        There is no undo. Only ever do this to start completely fresh (e.g. moving from a test run into real use).
        A backup is downloaded automatically first, just in case.</p>
      <button type="button" class="btn secondary" id="open-reset-modal" style="border-color:var(--red);color:var(--red)">Reset &amp; Clear All Data…</button>
    </div>` : ''}`;

  // Groups the settings page's many cards into tabs by topic — done by reading each card's own
  // heading after render, rather than restructuring the (very large) template above, so this
  // stays safe to maintain even as more settings cards get added over time.
  (function setupSettingsTabs() {
    const CATEGORY_BY_HEADING = {
      'School Identity': 'General', 'Student & Staff ID Format': 'General',
      'Menu Theme': 'Appearance', 'Page Theme': 'Appearance', 'Custom Color Palette': 'Appearance',
      'Student ID Card Customization': 'Appearance', 'Menu Size & Cursor': 'Appearance',
      'Arabic Report Font': 'Appearance', 'Dashboard Background': 'Appearance',
      'Continuous Assessment Style': 'Academic',
      'MTN Mobile Money (Collections API)': 'Payments',
      'Automatic Weekly Backup Email': 'System & Security', 'System Access Lock': 'System & Security', '🔒 Screen Lock': 'System & Security',
      'Connect a Phone or Another Computer': 'System & Security',
      '⚠ Danger Zone — Reset System': 'System & Security',
    };
    const TAB_ORDER = ['General', 'Appearance', 'Academic', 'Payments', 'System & Security'];
    const cards = [...document.querySelectorAll('#content > .card')];
    cards.forEach(card => {
      const heading = card.querySelector('.section-title');
      card.dataset.settingsTab = heading ? (CATEGORY_BY_HEADING[heading.textContent.trim()] || 'General') : 'General';
    });
    const tabsBar = document.createElement('div');
    tabsBar.className = 'tabs settings-tabs';
    tabsBar.innerHTML = TAB_ORDER.map((tab, i) => `<div class="tab ${i === 0 ? 'active' : ''}" data-settings-tab="${escapeHtml(tab)}">${escapeHtml(tab)}</div>`).join('');
    const firstCard = document.querySelector('#content > .card');
    if (firstCard) firstCard.parentNode.insertBefore(tabsBar, firstCard);
    function showTab(tab) {
      cards.forEach(card => { card.style.display = card.dataset.settingsTab === tab ? '' : 'none'; });
    }
    tabsBar.querySelectorAll('.tab').forEach(tabEl => tabEl.addEventListener('click', () => {
      tabsBar.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === tabEl));
      showTab(tabEl.dataset.settingsTab);
    }));
    showTab(TAB_ORDER[0]);
  })();

  // Loads the LAN connection info and draws a real, scannable QR code (from this app's own
  // from-scratch QR encoder — no external service or library) for whichever address a phone
  // should actually use: the admin's custom override if one is set, otherwise the first
  // detected LAN address.
  (async function loadNetworkInfo() {
    const box = document.getElementById('network-connect-info');
    if (!box) return;
    try {
      const info = await api('/network-info');
      const primaryUrl = info.customUrl || (info.httpsUrls && info.httpsUrls[0]) || info.urls[0];
      if (!primaryUrl) {
        box.innerHTML = `<div class="notice">No network connection detected on this computer yet — connect it to Wi-Fi or Ethernet, then reopen Settings.</div>`;
        return;
      }
      const isHttps = primaryUrl.startsWith('https://');
      box.innerHTML = `
        <div style="display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap">
          <canvas id="connect-qr-canvas" style="border:1px solid var(--border);border-radius:8px"></canvas>
          <div style="flex:1;min-width:220px">
            <p class="small-text" style="margin-top:0">Address to open on the other device:</p>
            <div class="notice" style="font-family:monospace;font-size:14px;font-weight:700">${escapeHtml(primaryUrl)}</div>
            ${isHttps ? `<p class="small-text">This is the secure address — needed for camera features (like kiosk check-in). The
              browser will show a one-time "not private" warning since this is this school's own certificate, not one from a
              public certificate authority — tap Advanced / Proceed once per device, that's expected.</p>` : ''}
            ${!info.customUrl ? `<p class="small-text">Without camera features, the plain address also works: ${info.urls.map(escapeHtml).join(', ')}</p>` : ''}
          </div>
        </div>`;
      renderQRToCanvas(document.getElementById('connect-qr-canvas'), primaryUrl, 'M', 6, 3);
    } catch (e) { box.innerHTML = `<div class="empty-state">Could not load network info.</div>`; }
  })();
  document.getElementById('save-custom-connect-url')?.addEventListener('click', async () => {
    const val = document.getElementById('custom-connect-url').value.trim();
    try {
      await api('/settings', { method: 'PUT', body: { custom_connect_url: val || null } });
      renderSettings();
    } catch (err) { alert(err.message); }
  });

  // Live ID-format preview
  function updateIdPreview() {
    const sp = document.getElementById('sid-prefix').value || 'NIB';
    const tp = document.getElementById('stid-prefix').value || 'ST';
    const digits = Number(document.getElementById('seq-digits').value);
    const year = new Date().getFullYear();
    const example = String(1).padStart(digits, '0');
    document.getElementById('id-preview').innerHTML = `Example Student ID: <b>${escapeHtml(sp)}/${year}/${example}</b> &nbsp;·&nbsp; Example Staff ID: <b>${escapeHtml(tp)}/${year}/${example}</b>`;
  }
  ['sid-prefix', 'stid-prefix', 'seq-digits'].forEach(id => document.getElementById(id).addEventListener('input', updateIdPreview));
  updateIdPreview();

  // Live weight-sum check
  function updateWeightCheck() {
    const ca = Number(document.getElementById('ca-weight').value) || 0;
    const exam = Number(document.getElementById('exam-weight').value) || 0;
    const el2 = document.getElementById('weight-check');
    if (ca + exam === 100) { el2.textContent = `✓ ${ca}% + ${exam}% = 100%`; el2.style.color = 'var(--green)'; }
    else { el2.textContent = `⚠ ${ca}% + ${exam}% = ${ca + exam}% — these must add up to 100% to save.`; el2.style.color = 'var(--red)'; }
  }
  document.getElementById('ca-weight').addEventListener('input', updateWeightCheck);
  document.getElementById('exam-weight').addEventListener('input', updateWeightCheck);
  updateWeightCheck();

  // Logo upload preview
  let logoDataUrl = null;
  document.getElementById('logo-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      logoDataUrl = await resizeImageToDataUrl(file, 500, 500);
      document.getElementById('logo-preview').innerHTML = `<img src="${logoDataUrl}" alt="">`;
    } catch (err) { alert('Could not read that image.'); }
  });

  // Dashboard background upload (uploads immediately, unlike the other settings forms — simpler UX for a single image)
  document.getElementById('dashboard-bg-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageToDataUrl(file, 1600, 900);
      await api('/settings', { method: 'PUT', body: { dashboard_background_photo_data: dataUrl } });
      renderSettings();
    } catch (err) { alert(err.message || 'Could not read that image.'); }
  });
  document.getElementById('remove-dashboard-bg-btn')?.addEventListener('click', async () => {
    await api('/settings', { method: 'PUT', body: { remove_dashboard_background: true } });
    renderSettings();
  });
  document.getElementById('login-bg-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageToDataUrl(file, 1920, 1080);
      await api('/settings', { method: 'PUT', body: { login_background_data: dataUrl } });
      renderSettings();
      applyBranding();
    } catch (err) { alert(err.message || 'Could not read that image.'); }
  });
  document.getElementById('remove-login-bg-btn')?.addEventListener('click', async () => {
    await api('/settings', { method: 'PUT', body: { remove_login_background: true } });
    renderSettings();
    applyBranding();
  });

  if (editable) {
    document.getElementById('identity-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const body = Object.fromEntries(fd.entries());
      if (logoDataUrl) body.logo_photo_data = logoDataUrl;
      try {
        await api('/settings', { method: 'PUT', body });
        alert('School identity saved.');
        applyBranding();
      } catch (err) { alert(err.message); }
    });
    function updateNavThemePreview() {
      const key = document.getElementById('nav-theme-select').value;
      if (key === 'custom') {
        const c = s.custom_accent_color || '#c8973a';
        document.getElementById('nav-theme-preview').style.background = `linear-gradient(135deg, ${c}, ${c})`;
        return;
      }
      const theme = NAV_THEMES[key];
      if (theme) document.getElementById('nav-theme-preview').style.background = `linear-gradient(135deg, ${theme.swatch[0]}, ${theme.swatch[1]})`;
    }
    function updatePageThemePreview() {
      const key = document.getElementById('page-theme-select').value;
      if (key === 'custom') {
        const c = s.custom_bg_color || '#2980b9';
        document.getElementById('page-theme-preview').style.background = `linear-gradient(135deg, ${c}, ${c})`;
        return;
      }
      const theme = PAGE_THEMES[key];
      if (theme) document.getElementById('page-theme-preview').style.background = `linear-gradient(135deg, ${theme.swatch[0]}, ${theme.swatch[1]})`;
    }
    updateNavThemePreview();
    updatePageThemePreview();
    document.getElementById('nav-theme-select')?.addEventListener('change', async (e) => {
      const themeKey = e.target.value;
      applyNavTheme(themeKey); // instant visual feedback, before the save even completes
      updateNavThemePreview();
      try { await api('/settings', { method: 'PUT', body: { nav_theme: themeKey } }); }
      catch (err) { alert(err.message); }
    });
    document.getElementById('page-theme-select')?.addEventListener('change', async (e) => {
      const themeKey = e.target.value;
      applyPageTheme(themeKey);
      updatePageThemePreview();
      try { await api('/settings', { method: 'PUT', body: { page_theme: themeKey } }); }
      catch (err) { alert(err.message); }
    });
    document.getElementById('apply-custom-nav')?.addEventListener('click', async () => {
      const color = document.getElementById('custom-nav-color').value;
      applyNavTheme('custom', color);
      document.getElementById('nav-theme-select').value = 'custom';
      s.custom_accent_color = color;
      updateNavThemePreview();
      try { await api('/settings', { method: 'PUT', body: { nav_theme: 'custom', custom_accent_color: color } }); }
      catch (err) { alert(err.message); }
    });
    document.getElementById('apply-custom-page')?.addEventListener('click', async () => {
      const color = document.getElementById('custom-page-color').value;
      applyPageTheme('custom', color);
      document.getElementById('page-theme-select').value = 'custom';
      s.custom_bg_color = color;
      updatePageThemePreview();
      try { await api('/settings', { method: 'PUT', body: { page_theme: 'custom', custom_bg_color: color } }); }
      catch (err) { alert(err.message); }
    });
    document.querySelectorAll('.idcard-theme-swatch').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        document.querySelectorAll('.idcard-theme-swatch').forEach(b => b.classList.toggle('selected', b === btn));
      });
    });
    document.getElementById('save-idcard-settings')?.addEventListener('click', async () => {
      const selected = document.querySelector('.idcard-theme-swatch.selected');
      try {
        await api('/settings', { method: 'PUT', body: {
          id_card_color: selected ? selected.dataset.idcardTheme : 'navy-gold',
          id_card_show_dob: document.getElementById('idcard-show-dob').checked ? 1 : 0,
          id_card_show_blood_group: document.getElementById('idcard-show-blood').checked ? 1 : 0,
          id_card_show_contact: document.getElementById('idcard-show-contact').checked ? 1 : 0,
        } });
        alert('ID Card settings saved. New cards you generate will use these settings.');
      } catch (err) { alert(err.message); }
    });
    document.getElementById('save-momo-settings')?.addEventListener('click', async () => {
      const env = document.getElementById('momo-environment').value;
      // MTN's sandbox and live Collections API sit behind different hosts entirely.
      const baseUrl = env === 'mtnghana' ? 'https://proxy.momoapi.mtn.com' : 'https://sandbox.momodeveloper.mtn.com';
      try {
        await api('/settings', { method: 'PUT', body: {
          momo_subscription_key: document.getElementById('momo-sub-key').value,
          momo_api_user: document.getElementById('momo-api-user').value,
          momo_api_key: document.getElementById('momo-api-key').value,
          momo_target_environment: env,
          momo_base_url: baseUrl,
        } });
        alert('MTN MoMo settings saved.');
        renderSettings();
      } catch (err) { alert(err.message); }
    });
    document.getElementById('nav-font-size-select')?.addEventListener('change', async (e) => {
      applyNavFontSize(e.target.value);
      try { await api('/settings', { method: 'PUT', body: { nav_font_size: e.target.value } }); }
      catch (err) { alert(err.message); }
    });
    document.getElementById('ui-font-scale-select')?.addEventListener('change', async (e) => {
      applyUiFontScale(e.target.value);
      try { await api('/settings', { method: 'PUT', body: { ui_font_scale: e.target.value } }); }
      catch (err) { alert(err.message); }
    });
    document.getElementById('cursor-style-select')?.addEventListener('change', async (e) => {
      applyCursorStyle(e.target.value);
      try { await api('/settings', { method: 'PUT', body: { cursor_style: e.target.value } }); }
      catch (err) { alert(err.message); }
    });
    document.getElementById('arabic-font-select')?.addEventListener('change', async (e) => {
      try { await api('/settings', { method: 'PUT', body: { arabic_report_font: e.target.value } }); }
      catch (err) { alert(err.message); }
    });
    document.getElementById('custom-font-upload-btn')?.addEventListener('click', async () => {
      const name = document.getElementById('custom-font-name').value.trim();
      const file = document.getElementById('custom-font-file').files[0];
      if (!name) return alert('Give the font a name.');
      if (!file) return alert('Choose a .ttf or .otf file.');
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          await api('/custom-fonts', { method: 'POST', body: { display_name: name, original_name: file.name, font_data: reader.result } });
          customFontFaceCss = null; // force a re-fetch so the newly uploaded font is actually usable right away
          renderSettings();
        } catch (err) { alert(err.message); }
      };
      reader.readAsDataURL(file);
    });
    document.querySelectorAll('.custom-font-del-btn').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Delete this font? Any report currently set to use it will fall back to the default.')) return;
      try { await api(`/custom-fonts/${btn.dataset.id}`, { method: 'DELETE' }); customFontFaceCss = null; renderSettings(); }
      catch (err) { alert(err.message); }
    }));
    document.getElementById('idformat-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const body = Object.fromEntries(fd.entries());
      try { await api('/settings', { method: 'PUT', body }); alert('ID format saved. This applies to newly created records.'); }
      catch (err) { alert(err.message); }
    });
    document.getElementById('castyle-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const body = Object.fromEntries(fd.entries());
      try { await api('/settings', { method: 'PUT', body }); alert('Continuous Assessment style saved.'); }
      catch (err) { alert(err.message); }
    });
    document.getElementById('backupmail-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const body = Object.fromEntries(fd.entries());
      body.smtp_secure = fd.get('smtp_secure') ? 1 : 0;
      body.auto_backup_email_enabled = fd.get('auto_backup_email_enabled') ? 1 : 0;
      if (!body.smtp_password) delete body.smtp_password; // keep existing password if left blank
      try { await api('/settings', { method: 'PUT', body }); alert('Backup email settings saved.'); renderSettings(); }
      catch (err) { alert(err.message); }
    });
    document.getElementById('send-backup-now').addEventListener('click', async (e) => {
      const btn = e.target; const original = btn.textContent;
      btn.textContent = 'Sending…'; btn.disabled = true;
      try {
        const r = await api('/backup/email', { method: 'POST' });
        alert(`Backup emailed to ${r.sent_to}.`);
        renderSettings();
      } catch (err) { alert('Could not send: ' + err.message); btn.textContent = original; btn.disabled = false; }
    });
    document.getElementById('save-lock-expiry').addEventListener('click', async () => {
      const date = document.getElementById('lock-expiry-date').value;
      if (!date) return alert('Choose a date first (or use "Clear Expiry" to remove one).');
      if (!confirm(`Lock the ENTIRE system for every user (including admins) starting ${date}, until someone enters the current unlock token? Make sure you have that token saved.`)) return;
      await api('/system-lock-config', { method: 'PUT', body: { expiry_date: date } });
      alert('Expiry date saved.');
      renderSettings();
    });
    document.getElementById('clear-lock-expiry').addEventListener('click', async () => {
      await api('/system-lock-config', { method: 'PUT', body: { expiry_date: null } });
      renderSettings();
    });
    document.getElementById('generate-lock-token').addEventListener('click', async () => {
      if (!confirm('Generate a new unlock token? Any previously generated token will stop working.')) return;
      const result = await api('/system-lock-generate-token', { method: 'POST' });
      const box = document.getElementById('lock-token-display');
      box.classList.remove('hidden');
      box.innerHTML = `<b>New unlock token:</b> <span style="font-size:18px;letter-spacing:2px;font-weight:800;color:var(--navy)">${escapeHtml(result.token)}</span>
        <br><span class="small-text">Write this down now — it will not be shown again. You'll need it to unlock the system after the expiry date passes.</span>`;
    });
    document.getElementById('save-lock-settings').addEventListener('click', async () => {
      const enabled = document.getElementById('lock-enabled-cb').checked;
      const pin = document.getElementById('lock-pin-input').value.trim();
      const status = document.getElementById('lock-settings-status');
      if (enabled && !s.lock_pin_hash && !pin) { status.style.color = 'var(--red)'; status.textContent = 'Set a PIN before enabling — there is nothing to unlock with yet.'; return; }
      try {
        const body = { lock_enabled: enabled ? 1 : 0 };
        if (pin) body.lock_pin = pin;
        await api('/settings', { method: 'PUT', body });
        status.style.color = 'var(--green)'; status.textContent = '✓ Saved.';
        window.lockFeatureEnabled = enabled; // let the topbar Lock button show/hide without a full page reload
        updateLockButtonVisibility();
      } catch (e) { status.style.color = 'var(--red)'; status.textContent = e.message; }
    });
    document.getElementById('open-reset-modal')?.addEventListener('click', () => {
      const modal = el(`<div class="modal-backdrop"><div class="modal" style="width:440px">
        <h3 style="color:var(--red)">⚠ Reset & Clear All Data</h3>
        <p>This deletes every student, teacher, staff, parent, result, fee, message, announcement, and every other
          record — permanently, with no undo. A backup downloads automatically first.</p>
        <p>Type <b>RESET</b> below to confirm.</p>
        <input type="text" id="reset-confirm-input" placeholder="Type RESET" autocomplete="off">
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="reset-cancel">Cancel</button>
          <button type="button" class="btn secondary" id="reset-confirm-btn" style="border-color:var(--red);color:var(--red)" disabled>Reset Everything</button>
        </div>
      </div></div>`);
      document.body.appendChild(modal);
      modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
      modal.querySelector('#reset-cancel').addEventListener('click', () => modal.remove());
      const input = modal.querySelector('#reset-confirm-input');
      const confirmBtn = modal.querySelector('#reset-confirm-btn');
      input.addEventListener('input', () => { confirmBtn.disabled = input.value.trim() !== 'RESET'; });
      confirmBtn.addEventListener('click', async () => {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Backing up, then resetting…';
        try {
          // Create and download a safety backup first — same mechanism as the manual
          // "Send Backup Now" flow — before touching anything.
          const backup = await api('/backup', { method: 'POST' });
          window.open(`/api/backup/download/${encodeURIComponent(backup.filename)}`, '_blank');
          await new Promise(r => setTimeout(r, 1500)); // give the download a moment to actually start
          await api('/system-reset', { method: 'POST' });
          alert('System has been reset. You will now be logged out.');
          await api('/logout', { method: 'POST' });
          location.hash = '';
          location.reload();
        } catch (err) {
          alert(err.message);
          confirmBtn.disabled = false;
          confirmBtn.textContent = 'Reset Everything';
        }
      });
    });
  }
}

// ---------- Discussion Forum ----------
const FORUM_EMOJIS = ['😀','😂','😍','👍','👏','🙏','🎉','❤️','😮','😢','🤔','👋','✅','⭐','📚','✏️','🏆','💡','😊','🙌'];

async function renderForum() {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="empty-state">Loading…</div>';
  const topics = await api('/forum/topics');

  // Notification area: flag anything with activity since the last time this browser opened the forum.
  const lastSeen = localStorage.getItem('nibras_forum_last_seen') || '1970-01-01';
  const newTopics = topics.filter(tpc => (tpc.last_activity || tpc.created_at) > lastSeen);

  content.innerHTML = `
    <div class="page-header"><h2>💬 Discussion Forum</h2>
      ${can('forum', 'add') ? `<button class="btn gold" id="new-topic-btn">+ New Topic</button>` : ''}</div>
    ${newTopics.length ? `<div class="notice forum-notification">🔔 <b>${newTopics.length}</b> topic${newTopics.length > 1 ? 's have' : ' has'} new activity since your last visit: ${newTopics.map(t2 => escapeHtml(t2.title)).join(', ')}</div>` : ''}
    <div class="forum-audience-widget">
      <button type="button" class="forum-audience-chip active" data-aud="__all__">🌐 All</button>
      <button type="button" class="forum-audience-chip" data-aud="Teacher">🍎 Teachers</button>
      <button type="button" class="forum-audience-chip" data-aud="Student">🎓 Students</button>
      <button type="button" class="forum-audience-chip" data-aud="Parent">👪 Parents/Guardians</button>
      <button type="button" class="forum-audience-chip" data-aud="Non-teaching Staff">🧰 Non-teaching Staff</button>
    </div>
    <div id="forum-topic-list" class="forum-topic-list"></div>`;
  localStorage.setItem('nibras_forum_last_seen', new Date().toISOString());

  function renderTopicList(filterAudience) {
    const listEl = document.getElementById('forum-topic-list');
    const filtered = filterAudience ? topics.filter(t2 => t2.audience === filterAudience || t2.audience === 'All') : topics;
    if (!filtered.length) {
      listEl.innerHTML = `<div class="empty-state">No topics here yet${filterAudience ? ' for this group' : ' — start the first one! 🎉'}</div>`;
      return;
    }
    listEl.innerHTML = filtered.map(tpc => `<div class="forum-topic-row" data-id="${tpc.id}">
      <div class="forum-topic-main">
        <div class="forum-topic-title">${escapeHtml(tpc.title)} ${newTopics.some(n => n.id === tpc.id) ? '<span class="badge green">New</span>' : ''} ${tpc.audience && tpc.audience !== 'All' ? `<span class="badge gray">${escapeHtml(tpc.audience)}</span>` : ''}</div>
        <div class="small-text">${tpc.class_name ? `📘 ${escapeHtml(tpc.class_name)} &nbsp;` : ''}${tpc.subject_name ? `📖 ${escapeHtml(tpc.subject_name)} &nbsp;` : ''}by ${escapeHtml(tpc.created_by_name || 'Unknown')}</div>
      </div>
      <div class="forum-topic-meta">
        <span>💬 ${tpc.message_count}</span>
        ${can('forum', 'delete') ? `<button class="chip-remove forum-delete-topic" data-id="${tpc.id}" title="Delete topic">×</button>` : ''}
      </div>
    </div>`).join('');
    listEl.querySelectorAll('.forum-topic-row').forEach(row => row.addEventListener('click', (e) => {
      if (e.target.classList.contains('forum-delete-topic')) return;
      openForumTopic(Number(row.dataset.id));
    }));
    listEl.querySelectorAll('.forum-delete-topic').forEach(btn => btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Delete this whole topic and all its messages?')) return;
      await api(`/forum/topics/${btn.dataset.id}`, { method: 'DELETE' });
      renderForum();
    }));
  }
  renderTopicList(null);
  document.querySelectorAll('.forum-audience-chip').forEach(chip => chip.addEventListener('click', () => {
    document.querySelectorAll('.forum-audience-chip').forEach(c => c.classList.toggle('active', c === chip));
    renderTopicList(chip.dataset.aud === '__all__' ? null : chip.dataset.aud);
  }));

  document.getElementById('new-topic-btn')?.addEventListener('click', async () => {
    const [classes, subjects] = await Promise.all([api('/classes?pageSize=200'), api('/subjects?pageSize=200')]);
    const modal = el(`<div class="modal-backdrop"><div class="modal">
      <h3>Start a New Topic</h3>
      <form id="new-topic-form">
        <label>Title *</label><input name="title" required placeholder="What's this about?">
        <div class="form-grid">
          <div><label>Class (optional)</label><select name="class_id"><option value="">— None —</option>${classes.rows.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select></div>
          <div><label>Subject (optional)</label><select name="subject_id"><option value="">— None —</option>${subjects.rows.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}</select></div>
        </div>
        <label>Who is this discussion for?</label>
        <select name="audience">
          <option value="All">Everyone</option>
          <option value="Teacher">Teachers</option>
          <option value="Student">Students</option>
          <option value="Parent">Parents/Guardians</option>
          <option value="Non-teaching Staff">Non-teaching Staff</option>
        </select>
        <label>Your first message *</label><textarea name="first_message" rows="3" required placeholder="Say something to get the discussion going…"></textarea>
        <div class="modal-actions"><button type="button" class="btn secondary" id="cancel-topic">Cancel</button><button type="submit" class="btn gold">Post Topic</button></div>
      </form>
    </div></div>`);
    document.body.appendChild(modal);
    modal.querySelector('#cancel-topic').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    modal.querySelector('#new-topic-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const body = { title: fd.get('title'), class_id: fd.get('class_id') || null, subject_id: fd.get('subject_id') || null, first_message: fd.get('first_message'), audience: fd.get('audience') };
      try { const r = await api('/forum/topics', { method: 'POST', body }); modal.remove(); openForumTopic(r.id); }
      catch (err) { alert(err.message); }
    });
  });
}

async function openForumTopic(topicId) {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="empty-state">Loading…</div>';
  const data = await api(`/forum/topics/${topicId}/messages`);
  content.innerHTML = `
    <div class="page-header"><h2>💬 ${escapeHtml(data.topic.title)}</h2>
      <button class="btn secondary" id="back-to-forum">← All Topics</button></div>
    <div class="card forum-thread" id="forum-thread"></div>
    ${can('forum', 'add') ? `
    <div class="card">
      <textarea id="forum-message-input" rows="3" placeholder="Write a reply…"></textarea>
      <div class="forum-emoji-row">${FORUM_EMOJIS.map(em => `<button type="button" class="forum-emoji-btn">${em}</button>`).join('')}</div>
      <div class="toolbar" style="margin-top:8px">
        <button type="button" class="btn secondary" id="forum-camera-btn" style="padding:6px 12px;font-size:12.5px">📷 Take Photo</button>
        <input type="file" id="forum-file-input" style="max-width:220px">
      </div>
      <div id="forum-attachment-preview"></div>
      <div class="modal-actions" style="justify-content:flex-start"><button class="btn gold" id="forum-post-btn">Post Reply</button></div>
    </div>` : ''}`;
  document.getElementById('back-to-forum').addEventListener('click', renderForum);

  function renderThread(messages) {
    document.getElementById('forum-thread').innerHTML = messages.map(m => `
      <div class="forum-message">
        <div class="forum-message-header"><b>${escapeHtml(m.author_name || 'Unknown')}</b> <span class="badge gray">${escapeHtml(m.author_role || '')}</span> <span class="small-text">${m.created_at}</span></div>
        <div class="forum-message-body">${escapeHtml(m.body)}</div>
        ${attachmentHtml(m.attachment, m.attachment_name)}
      </div>`).join('') || '<p class="muted">No messages yet.</p>';
  }
  renderThread(data.messages);

  document.querySelectorAll('.forum-emoji-btn').forEach(btn => btn.addEventListener('click', () => {
    const input = document.getElementById('forum-message-input');
    input.value += btn.textContent;
    input.focus();
  }));

  let pendingAttachment = null; // { dataUrl, name }
  document.getElementById('forum-camera-btn')?.addEventListener('click', () => openCameraCaptureModal((dataUrl) => {
    pendingAttachment = { dataUrl, name: 'photo.jpg' };
    document.getElementById('forum-attachment-preview').innerHTML = `<div class="attachment-pending"><img src="${dataUrl}" alt=""> <span>Photo attached</span> <button type="button" id="forum-clear-attachment">✕</button></div>`;
    document.getElementById('forum-clear-attachment').addEventListener('click', () => { pendingAttachment = null; document.getElementById('forum-attachment-preview').innerHTML = ''; });
  }));
  document.getElementById('forum-file-input')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    pendingAttachment = { dataUrl, name: file.name };
    document.getElementById('forum-attachment-preview').innerHTML = `<div class="attachment-pending"><span>📎 ${escapeHtml(file.name)}</span> <button type="button" id="forum-clear-attachment">✕</button></div>`;
    document.getElementById('forum-clear-attachment').addEventListener('click', () => { pendingAttachment = null; e.target.value = ''; document.getElementById('forum-attachment-preview').innerHTML = ''; });
  });
  document.getElementById('forum-post-btn')?.addEventListener('click', async () => {
    const input = document.getElementById('forum-message-input');
    if (!input.value.trim() && !pendingAttachment) return;
    try {
      await api(`/forum/topics/${topicId}/messages`, { method: 'POST', body: { body: input.value.trim(), attachment_data: pendingAttachment?.dataUrl, attachment_name: pendingAttachment?.name } });
      input.value = '';
      pendingAttachment = null;
      document.getElementById('forum-attachment-preview').innerHTML = '';
      document.getElementById('forum-file-input').value = '';
      const fresh = await api(`/forum/topics/${topicId}/messages`);
      renderThread(fresh.messages);
    } catch (e) { alert(e.message); }
  });
}

// ---------- Staff Check-in / Check-out ----------
async function renderStaffCheckin() {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="empty-state">Loading…</div>';
  const [teachers, staff, config, netInfo] = await Promise.all([
    api('/teachers?pageSize=500'), api('/staff?pageSize=500'), api('/staff-checkin-config'), api('/network-info').catch(() => null),
  ]);
  // Deliberately NOT location.origin — if the admin is viewing this from the school office
  // computer itself, that's usually "http://localhost:3000", and "localhost" on a phone that
  // scans this QR code means the phone itself, not this computer, so the scan would silently
  // fail for everyone. Use the same real LAN address (or the admin's custom override) that the
  // Settings "Connect a Phone" QR code already uses, so both features actually work the same way.
  // Camera-based check-in needs HTTPS (see the note on getOrCreateTlsCert on the server side) —
  // so these QR codes specifically use the secure address, not the plain HTTP one the rest of
  // the app is fine using. Falls back to HTTP only if the HTTPS server couldn't start for some
  // reason, in which case check-in still works, just without the camera-based scan option.
  const kioskLinkUrl = (netInfo && (netInfo.customUrl || netInfo.httpsUrls?.[0] || netInfo.urls[0])) || location.origin;
  const kioskUrl = `${kioskLinkUrl}/kiosk.html`;
  content.innerHTML = `
    <div class="page-header"><h2>Staff Check-in / Check-out</h2></div>
    <div class="notice">
      Staff check in by <b>scanning their personal QR code with their phone's own camera app</b> (no login or extra app needed) —
      generate and print QR cards below. A shared <b>PIN kiosk</b> is also available for a tablet at the entrance:
      <br><a href="${kioskUrl}" target="_blank">${escapeHtml(kioskUrl)}</a>
      <br><span class="small-text">Facial recognition and fingerprint/biometric scanning are not included — those need dedicated hardware and vendor SDKs that an offline, dependency-free system like this can't provide. QR and PIN cover the same need without special equipment.</span>
    </div>

    <div class="card">
      <h3 style="margin-top:0;color:var(--navy)">📱 Scan to Open the Check-in Kiosk</h3>
      <p class="small-text">Print this and post it at the entrance — anyone can scan it with their own phone camera to
        open the check-in/check-out kiosk directly, no typing a web address needed. This opens the shared PIN/manual
        kiosk page; each staff member's own personal QR card below is still the fastest one-tap check-in for them
        specifically.</p>
      <div style="display:flex;align-items:center;gap:16px">
        <canvas id="kiosk-qr-canvas" style="border:1px solid var(--border);border-radius:8px"></canvas>
        <button type="button" class="btn secondary" id="print-kiosk-qr-btn">🖨 Print This Sign</button>
      </div>
    </div>

    <div class="card">
      <div class="page-header" style="margin-bottom:8px"><h3 style="margin:0;color:var(--navy)">Today's Check-in Summary</h3>
        <span class="small-text" id="checkin-summary-updated"></span></div>
      <div class="stat-grid" id="checkin-summary-cards"></div>
    </div>

    <div class="card">
      <div class="page-header" style="margin-bottom:10px"><h3 style="margin:0;color:var(--navy)">Daily Check-in / Check-out List</h3>
        <button class="btn secondary" id="print-daily-list-btn" style="padding:6px 12px;font-size:12.5px">🖶 Print</button></div>
      <div class="toolbar">
        <input type="date" id="daily-list-date" value="${new Date().toISOString().slice(0, 10)}">
        <button class="btn secondary" id="load-daily-list-btn">Load</button>
      </div>
      <div id="daily-list-output"></div>
    </div>

    <div class="card">
      <div class="page-header" style="margin-bottom:10px"><h3 style="margin:0;color:var(--navy)">Non-Staff Visitors Today</h3>
        <span class="small-text">Anyone checked in from the kiosk's "Non-Staff" tab — visiting parents, contractors, inspectors, etc.</span></div>
      <div id="visitor-list-output"></div>
    </div>

    <div class="card">
      <div class="page-header" style="margin-bottom:10px"><h3 style="margin:0;color:var(--navy)">Standard Work Hours</h3>
        <button class="btn secondary" id="save-checkin-config" style="padding:6px 12px;font-size:12.5px">Save</button></div>
      <div class="form-grid">
        <div><label>Standard Start Time</label><input type="time" id="cfg-start" value="${config.standard_start_time}"></div>
        <div><label>Standard End Time</label><input type="time" id="cfg-end" value="${config.standard_end_time}"></div>
      </div>
      <p class="small-text" style="margin-top:8px">Overtime is calculated as any time checked out after the Standard End Time.</p>
    </div>

    <div class="card">
      <h3 style="margin-top:0;color:var(--navy)">Generate Check-in QR Code / PIN</h3>
      <div class="toolbar">
        <select id="cred-person"><option value="">Select a teacher or staff member…</option>
          <optgroup label="Teachers">${teachers.rows.map(t => `<option value="teacher:${t.id}">${escapeHtml(t.full_name)} (${escapeHtml(t.staff_id || '')})</option>`).join('')}</optgroup>
          <optgroup label="Non-teaching Staff">${staff.rows.map(s => `<option value="staff:${s.id}">${escapeHtml(s.full_name)} (${escapeHtml(s.staff_id || '')})</option>`).join('')}</optgroup>
        </select>
        <button class="btn secondary" id="gen-cred-btn">Generate</button>
      </div>
      <div id="cred-output"></div>
    </div>

    <div class="card">
      <h3 style="margin-top:0;color:var(--navy)">Print QR Cards for a Whole List</h3>
      <div class="toolbar">
        <button class="btn secondary" id="print-all-teachers">🖶 Print All Teacher QR Cards</button>
        <button class="btn secondary" id="print-all-staff">🖶 Print All Staff QR Cards</button>
      </div>
    </div>

    <div class="card">
      <div class="page-header" style="margin-bottom:10px"><h3 style="margin:0;color:var(--navy)">Attendance Log & Overtime Summary</h3>
        <button class="btn gold" id="print-attendance-btn" style="padding:6px 12px;font-size:12.5px">🖶 Print</button></div>
      <div class="toolbar">
        <input type="date" id="att-from"> <span class="small-text">to</span> <input type="date" id="att-to">
        <button class="btn secondary" id="load-attendance-btn">Load</button>
      </div>
      <div id="attendance-output"></div>
    </div>`;

  async function loadCheckinSummary() {
    const s = await api('/checkin-summary');
    document.getElementById('checkin-summary-cards').innerHTML = `
      <div class="stat-card accent"><div class="stat-icon">${dashboardIconHtml('teachers')}</div><div><div class="num">${s.teachers.checked_in}</div><div class="label">Teachers Checked In</div></div></div>
      <div class="stat-card accent"><div class="stat-icon">${dashboardIconHtml('teachers')}</div><div><div class="num">${s.teachers.checked_out}</div><div class="label">Teachers Checked Out</div></div></div>
      <div class="stat-card accent"><div class="stat-icon">${dashboardIconHtml('staff')}</div><div><div class="num">${s.staff.checked_in}</div><div class="label">Staff Checked In</div></div></div>
      <div class="stat-card accent"><div class="stat-icon">${dashboardIconHtml('staff')}</div><div><div class="num">${s.staff.checked_out}</div><div class="label">Staff Checked Out</div></div></div>`;
    document.getElementById('checkin-summary-updated').textContent = 'Updated ' + new Date().toLocaleTimeString();
  }
  loadCheckinSummary();
  const checkinSummaryInterval = setInterval(() => { if (location.hash.replace('#', '') === 'staff-checkin') loadCheckinSummary(); else clearInterval(checkinSummaryInterval); }, 20000);

  renderQRToCanvas(document.getElementById('kiosk-qr-canvas'), kioskUrl, 'M', 6, 3);
  document.getElementById('print-kiosk-qr-btn').addEventListener('click', () => {
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>Scan to Check In</title><link rel="stylesheet" href="/style.css"><script src="/qrencode.js"><\/script></head>
      <body style="padding:40px;text-align:center;background:#fff">
        <h1 style="color:#0f2a4a">${escapeHtml(document.querySelector('.brand-name')?.textContent || 'Nibras Educational Complex')}</h1>
        <h2 style="color:#0f2a4a;margin-top:0">Scan to Check In / Check Out</h2>
        <canvas id="kiosk-print-qr" style="margin:30px auto;display:block"></canvas>
        <p style="font-size:16px;color:#555">Open your phone's camera and point it at this code.</p>
        <script>renderQRToCanvas(document.getElementById('kiosk-print-qr'), ${JSON.stringify(kioskUrl)}, 'M', 10, 3); window.print();<\/script>
      </body></html>`);
    win.document.close();
  });

  // Simple chronological "who's checked in/out today" list — distinct from the broader
  // Attendance Log below, which covers any date range for auditing/overtime purposes.
  async function loadDailyList() {
    const date = document.getElementById('daily-list-date').value;
    const data = await api(`/staff-attendance-report?from=${date}&to=${date}`);
    const sorted = [...data.rows].sort((a, b) => (a.check_in_time || '').localeCompare(b.check_in_time || ''));
    const out = document.getElementById('daily-list-output');
    out.innerHTML = `<div class="table-wrap"><table><thead><tr><th>#</th><th>Name</th><th>Type</th><th>Check-in</th><th>Check-out</th><th>Method</th></tr></thead>
      <tbody>${sorted.map((r, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(r.name)}</td><td>${r.person_type === 'teacher' ? 'Teacher' : 'Staff'}</td>
        <td>${escapeHtml(r.check_in_time) || '—'}</td><td>${escapeHtml(r.check_out_time) || '—'}</td><td>${escapeHtml(r.method)}</td></tr>`).join('') || '<tr><td colspan=6 class="muted">No one has checked in on this date yet</td></tr>'}</tbody></table></div>
      <p class="small-text" style="margin-top:8px">${sorted.length} check-in${sorted.length === 1 ? '' : 's'} on ${date}</p>`;
    out.dataset.cached = JSON.stringify({ date, rows: sorted });
  }
  loadDailyList();
  document.getElementById('load-daily-list-btn').addEventListener('click', loadDailyList);

  async function loadVisitorList() {
    const data = await api('/visitor-checkins');
    const out = document.getElementById('visitor-list-output');
    out.innerHTML = `<div class="table-wrap"><table><thead><tr><th>#</th><th>Name</th><th>Purpose</th><th>Check-in</th><th>Check-out</th></tr></thead>
      <tbody>${data.rows.map((r, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(r.full_name)}</td><td class="small-text">${escapeHtml(r.purpose || '—')}</td>
        <td>${escapeHtml(r.check_in_time) || '—'}</td><td>${escapeHtml(r.check_out_time) || (r.check_in_time ? '<span class="badge amber">Still on site</span>' : '—')}</td></tr>`).join('') || '<tr><td colspan=5 class="muted">No visitors checked in today</td></tr>'}</tbody></table></div>`;
  }
  loadVisitorList();
  document.getElementById('print-daily-list-btn').addEventListener('click', () => {
    const cached = document.getElementById('daily-list-output').dataset.cached;
    if (!cached) return alert('Load the list first.');
    const { date, rows } = JSON.parse(cached);
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>Daily Check-in List</title><link rel="stylesheet" href="/style.css"></head>
      <body style="padding:24px"><div class="report-card">
        <div class="rc-title-band">DAILY CHECK-IN / CHECK-OUT LIST — ${escapeHtml(date)}</div>
        <table class="rc-table" style="margin-top:14px"><thead><tr><th>#</th><th>Name</th><th>Type</th><th>Check-in</th><th>Check-out</th><th>Method</th></tr></thead>
        <tbody>${rows.map((r, i) => `<tr><td>${i + 1}</td><td class="rc-subject">${escapeHtml(r.name)}</td><td>${r.person_type}</td><td>${escapeHtml(r.check_in_time) || '—'}</td><td>${escapeHtml(r.check_out_time) || '—'}</td><td>${escapeHtml(r.method)}</td></tr>`).join('') || '<tr><td colspan=6>No records</td></tr>'}</tbody></table>
      </div><script>window.print()<\/script></body></html>`);
    win.document.close();
  });

  document.getElementById('save-checkin-config').addEventListener('click', async () => {
    await api('/staff-checkin-config', { method: 'PUT', body: { standard_start_time: document.getElementById('cfg-start').value, standard_end_time: document.getElementById('cfg-end').value } });
    alert('Saved.');
  });

  document.getElementById('gen-cred-btn').addEventListener('click', async () => {
    const val = document.getElementById('cred-person').value;
    if (!val) return alert('Select a person first.');
    const [personType, personId] = val.split(':');
    const cred = await api(`/checkin-credential?person_type=${personType}&person_id=${personId}`);
    const checkinUrl = `${kioskLinkUrl}/checkin/${cred.token}`;
    const out = document.getElementById('cred-output');
    out.innerHTML = `<div class="checkin-card" id="single-cred-card">
        <canvas id="cred-qr-canvas"></canvas>
        <div class="checkin-card-info">
          <div class="checkin-card-name">${escapeHtml(document.getElementById('cred-person').selectedOptions[0].textContent)}</div>
          <div class="small-text">Scan with phone camera to check in/out</div>
          <div class="checkin-pin">PIN: <b>${escapeHtml(cred.pin)}</b></div>
        </div>
      </div>
      <div class="no-print" style="margin-top:10px"><button class="btn secondary" id="print-single-cred">🖶 Print This Card</button></div>`;
    renderQRToCanvas(document.getElementById('cred-qr-canvas'), checkinUrl, 'M', 5, 3);
    document.getElementById('print-single-cred').addEventListener('click', () => window.print());
  });

  document.getElementById('print-all-teachers').addEventListener('click', () => printAllCheckinCards('teacher', teachers.rows, kioskLinkUrl));
  document.getElementById('print-all-staff').addEventListener('click', () => printAllCheckinCards('staff', staff.rows, kioskLinkUrl));

  document.getElementById('load-attendance-btn').addEventListener('click', async () => {
    const from = document.getElementById('att-from').value;
    const to = document.getElementById('att-to').value;
    const params = new URLSearchParams(); if (from) params.set('from', from); if (to) params.set('to', to);
    const data = await api(`/staff-attendance-report?${params.toString()}`);
    const out = document.getElementById('attendance-output');
    const photoThumb = (file) => file ? `<img src="/uploads/${encodeURIComponent(file)}" alt="" style="width:32px;height:38px;object-fit:cover;border-radius:4px;border:1px solid var(--border)">` : '—';
    out.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Name</th><th>Type</th><th>Check-in</th><th>In Photo</th><th>Check-out</th><th>Out Photo</th><th>Method</th><th>Overtime</th></tr></thead>
      <tbody>${data.rows.map(r => `<tr><td>${r.date}</td><td>${escapeHtml(r.name)}</td><td>${r.person_type === 'teacher' ? 'Teacher' : 'Staff'}</td>
        <td>${escapeHtml(r.check_in_time) || '—'}</td><td>${photoThumb(r.photo)}</td>
        <td>${escapeHtml(r.check_out_time) || '—'}</td><td>${photoThumb(r.checkout_photo)}</td>
        <td>${escapeHtml(r.method)}</td>
        <td>${r.overtime_minutes > 0 ? `<span class="badge red">${r.overtime_minutes} min</span>` : `<span class="badge green">On time</span>`}</td></tr>`).join('') || '<tr><td colspan=9 class="muted">No records for this range</td></tr>'}</tbody></table></div>
      <p class="small-text" style="margin-top:10px"><b>Total overtime:</b> ${data.total_overtime_minutes} minutes (${(data.total_overtime_minutes / 60).toFixed(1)} hours)</p>`;
    out.dataset.cached = JSON.stringify(data);
  });

  document.getElementById('print-attendance-btn').addEventListener('click', async () => {
    const out = document.getElementById('attendance-output');
    if (!out.dataset.cached) return alert('Load the report first.');
    const data = JSON.parse(out.dataset.cached);
    printAttendanceReport(data);
  });
}

function printAllCheckinCards(personType, people, kioskLinkUrl) {
  if (!people.length) return alert('No records to print.');
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>Check-in QR Cards</title><link rel="stylesheet" href="/style.css"></head>
    <body style="padding:20px"><div id="qr-sheet" style="display:flex;flex-wrap:wrap;gap:14px;"></div></body></html>`);
  win.document.close();
  const script = win.document.createElement('script');
  script.src = '/qrencode.js';
  script.onload = async () => {
    const sheet = win.document.getElementById('qr-sheet');
    for (const person of people) {
      const cred = await api(`/checkin-credential?person_type=${personType}&person_id=${person.id}`);
      const checkinUrl = `${kioskLinkUrl}/checkin/${cred.token}`;
      const cardDiv = win.document.createElement('div');
      cardDiv.className = 'checkin-card';
      cardDiv.innerHTML = `<canvas></canvas><div class="checkin-card-info">
        <div class="checkin-card-name">${escapeHtml(person.full_name)}</div>
        <div class="small-text">${escapeHtml(person.staff_id || '')}</div>
        <div class="checkin-pin">PIN: <b>${escapeHtml(cred.pin)}</b></div></div>`;
      sheet.appendChild(cardDiv);
      win.renderQRToCanvas(cardDiv.querySelector('canvas'), checkinUrl, 'M', 4, 3);
    }
    win.print();
  };
  win.document.head.appendChild(script);
}

function printAttendanceReport(data) {
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>Staff Attendance Report</title><link rel="stylesheet" href="/style.css"></head>
    <body style="padding:24px"><div class="report-card">
      <div class="rc-title-band">STAFF ATTENDANCE &amp; OVERTIME REPORT</div>
      <table class="rc-table" style="margin-top:14px"><thead><tr><th>Date</th><th>Name</th><th>Type</th><th>Check-in</th><th>Check-out</th><th>Overtime</th></tr></thead>
      <tbody>${data.rows.map(r => `<tr><td>${r.date}</td><td class="rc-subject">${escapeHtml(r.name)}</td><td>${r.person_type}</td><td>${escapeHtml(r.check_in_time) || '—'}</td><td>${escapeHtml(r.check_out_time) || '—'}</td><td style="color:${r.overtime_minutes > 0 ? '#c1372b' : '#1f8a54'};font-weight:700">${r.overtime_minutes > 0 ? r.overtime_minutes + ' min' : 'On time'}</td></tr>`).join('') || '<tr><td colspan=6>No records</td></tr>'}</tbody></table>
      <p style="margin-top:14px"><b>Total overtime:</b> ${data.total_overtime_minutes} minutes (${(data.total_overtime_minutes / 60).toFixed(1)} hours)</p>
    </div><script>window.print()<\/script></body></html>`);
  win.document.close();
}

// ---------- Assignments / Group Work / Quizzes / Examinations ----------
async function renderAssignments() {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="empty-state">Loading…</div>';
  const isStudent = state.user && state.user.role === 'Student';
  const list = await api('/assignments');

  if (isStudent) {
    content.innerHTML = `
      <div class="page-header"><h2>My Assignments &amp; Quizzes</h2></div>
      <div id="assignments-list" class="forum-topic-list">
        ${list.map(a => `<div class="forum-topic-row" data-id="${a.id}">
          <div class="forum-topic-main">
            <div class="forum-topic-title">${escapeHtml(a.title)} <span class="badge ${a.already_submitted ? 'green' : 'amber'}">${a.already_submitted ? 'Submitted' : 'Not yet submitted'}</span></div>
            <div class="small-text">${escapeHtml(a.type)} ${a.subject_name ? '· ' + escapeHtml(a.subject_name) : ''} ${a.due_date ? '· Due ' + escapeHtml(a.due_date) : ''}</div>
          </div>
          <div class="forum-topic-meta"><span>${a.question_count} question${a.question_count === 1 ? '' : 's'}</span></div>
        </div>`).join('') || '<div class="empty-state">No assignments yet.</div>'}
      </div>`;
    document.querySelectorAll('#assignments-list .forum-topic-row').forEach(row => row.addEventListener('click', () => openAssignmentForStudent(Number(row.dataset.id))));
    return;
  }

  // Teacher / admin view
  const [classes, subjects] = await Promise.all([api('/classes?pageSize=200'), api('/subjects?pageSize=200')]);
  content.innerHTML = `
    <div class="page-header"><h2>Assignments, Quizzes &amp; Examinations</h2>
      ${can('assignments', 'add') ? `<button class="btn gold" id="new-assignment-btn">+ New</button>` : ''}</div>
    <div class="table-wrap"><table><thead><tr><th>Title</th><th>Type</th><th>Class</th><th>Subject</th><th>Due</th><th>Questions</th><th>Submissions</th><th></th></tr></thead>
      <tbody>${list.map(a => `<tr>
        <td>${escapeHtml(a.title)}</td><td>${escapeHtml(a.type)}</td><td>${escapeHtml(a.class_name || '—')}</td><td>${escapeHtml(a.subject_name || '—')}</td>
        <td>${escapeHtml(a.due_date) || '—'}</td><td>${a.question_count}</td><td>${a.submission_count}</td>
        <td class="row-actions">
          <button class="view-subs-btn" data-id="${a.id}">Submissions</button>
          <a href="/api/assignments/${a.id}/export-word" class="btn-link">Word</a>
          ${can('assignments', 'delete') ? `<button class="del-assignment-btn" data-id="${a.id}">Delete</button>` : ''}
        </td>
      </tr>`).join('') || '<tr><td colspan=8 class="muted">No assignments yet</td></tr>'}</tbody></table></div>
    <div id="assignment-detail" style="margin-top:16px"></div>`;

  document.getElementById('new-assignment-btn')?.addEventListener('click', () => openNewAssignmentForm(classes.rows, subjects.rows));
  document.querySelectorAll('.view-subs-btn').forEach(btn => btn.addEventListener('click', () => loadSubmissions(Number(btn.dataset.id))));
  document.querySelectorAll('.del-assignment-btn').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('Delete this assignment and all student submissions? This cannot be undone.')) return;
    await api(`/assignments/${btn.dataset.id}`, { method: 'DELETE' });
    renderAssignments();
  }));
}

function openNewAssignmentForm(classRows, subjectRows) {
  const modal = el(`<div class="modal-backdrop"><div class="modal" style="width:640px;max-width:92vw">
    <h3>New Assignment / Quiz / Examination</h3>
    <form id="new-assignment-form">
      <div class="form-grid">
        <div><label>Title *</label><input name="title" required></div>
        <div><label>Type</label><select name="type"><option>Assignment</option><option>Homework</option><option>Group Work</option><option>Quiz</option><option>Examination</option></select></div>
        <div><label>Class</label><select name="class_id"><option value="">— None —</option>${classRows.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select></div>
        <div><label>Subject</label><select name="subject_id"><option value="">— None —</option>${subjectRows.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}</select></div>
        <div><label>Due Date</label><input type="date" name="due_date"></div>
      </div>
      <label>Instructions</label><textarea name="instructions" rows="2" placeholder="Optional instructions shown to students…"></textarea>
      <div class="full" style="margin-top:12px">
        <label>Questions</label>
        <div id="question-list"></div>
        <button type="button" class="btn secondary" id="add-question-btn" style="margin-top:8px">+ Add Question</button>
      </div>
      <div class="modal-actions"><button type="button" class="btn secondary" id="cancel-assignment">Cancel</button><button type="submit" class="btn gold">Create</button></div>
    </form>
  </div></div>`);
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  modal.querySelector('#cancel-assignment').addEventListener('click', () => modal.remove());

  let qCount = 0;
  function addQuestionRow() {
    qCount++;
    const qid = 'q' + qCount;
    const row = el(`<div class="card" style="padding:12px;margin-top:8px" data-qrow="${qid}">
      <div class="form-grid">
        <div class="full"><label>Question ${qCount}</label><textarea class="q-text" rows="2" required></textarea></div>
        <div><label>Type</label><select class="q-type"><option value="text">Written Answer</option><option value="mcq">Multiple Choice</option></select></div>
        <div><label>Marks</label><input type="number" class="q-marks" value="1" min="1"></div>
      </div>
      <div class="q-mcq-options hidden">
        <label>Options (one per line, correct answer first)</label>
        <textarea class="q-options" rows="3" placeholder="Correct option&#10;Wrong option&#10;Wrong option"></textarea>
      </div>
      <button type="button" class="btn secondary remove-q-btn" style="margin-top:6px;padding:5px 10px;font-size:12px">Remove</button>
    </div>`);
    document.getElementById('question-list').appendChild(row);
    row.querySelector('.q-type').addEventListener('change', (e) => row.querySelector('.q-mcq-options').classList.toggle('hidden', e.target.value !== 'mcq'));
    row.querySelector('.remove-q-btn').addEventListener('click', () => row.remove());
  }
  document.getElementById('add-question-btn').addEventListener('click', addQuestionRow);
  addQuestionRow();

  modal.querySelector('#new-assignment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const questions = [...document.querySelectorAll('[data-qrow]')].map(row => {
      const type = row.querySelector('.q-type').value;
      const q = { question_text: row.querySelector('.q-text').value, question_type: type, marks: Number(row.querySelector('.q-marks').value) || 1 };
      if (type === 'mcq') {
        const opts = row.querySelector('.q-options').value.split('\n').map(s => s.trim()).filter(Boolean);
        q.options = opts; q.correct_option = 0; // first line is always the correct one, by the instruction above
      }
      return q;
    });
    if (!questions.length) return alert('Add at least one question.');
    const body = {
      title: fd.get('title'), type: fd.get('type'), class_id: fd.get('class_id') || null, subject_id: fd.get('subject_id') || null,
      instructions: fd.get('instructions') || null, due_date: fd.get('due_date') || null, questions,
    };
    try { await api('/assignments', { method: 'POST', body }); modal.remove(); renderAssignments(); }
    catch (err) { alert(err.message); }
  });
}

async function loadSubmissions(assignmentId) {
  const detail = document.getElementById('assignment-detail');
  detail.innerHTML = '<div class="empty-state">Loading…</div>';
  const [full, submissions] = await Promise.all([api(`/assignments/${assignmentId}`), api(`/assignments/${assignmentId}/submissions`)]);
  const questionById = {}; full.questions.forEach(q => questionById[q.id] = q);
  const canGrade = can('assignments', 'edit');
  detail.innerHTML = `<div class="card">
    <h3 style="margin-top:0;color:var(--navy)">Submissions — ${escapeHtml(full.assignment.title)}</h3>
    ${submissions.map(s => {
      const totalMax = s.answers.reduce((sum, a) => sum + (questionById[a.question_id]?.marks || 0), 0);
      const totalAwarded = s.answers.reduce((sum, a) => sum + (a.marks_awarded != null ? Number(a.marks_awarded) : 0), 0);
      const allGraded = s.answers.every(a => a.marks_awarded != null);
      return `<div class="forum-message" data-submission-id="${s.id}">
      <div class="forum-message-header"><b>${escapeHtml(s.student_name)}</b> <span class="small-text">submitted ${s.submitted_at}</span>
        <span class="badge ${allGraded ? 'green' : 'amber'}" style="margin-left:8px">${allGraded ? `Graded: ${totalAwarded}/${totalMax}` : 'Not fully graded'}</span></span>
      </div>
      ${s.answers.map(a => {
        const q = questionById[a.question_id];
        return `<div class="submission-answer-row" style="margin:10px 0;padding:10px;background:#f4f6f9;border-radius:8px" data-answer-id="${a.id}">
          <b>${escapeHtml(q?.question_text || 'Question')}</b> <span class="small-text">(max ${q?.marks ?? '—'})</span>
          <div style="margin:6px 0">${escapeHtml(a.answer_text)}</div>
          ${canGrade ? `
            <div class="toolbar" style="margin-top:6px">
              <input type="number" class="grade-marks-input" min="0" max="${q?.marks ?? 100}" step="0.5" placeholder="Marks" value="${a.marks_awarded ?? ''}" style="width:90px">
              <input type="text" class="grade-feedback-input" placeholder="Feedback (optional)" value="${escapeHtml(a.teacher_feedback || '')}" style="flex:1">
              <button type="button" class="btn secondary save-grade-btn" style="padding:6px 12px;font-size:12.5px">Save</button>
            </div>` : (a.marks_awarded != null ? `<div class="small-text"><b>Marks:</b> ${a.marks_awarded}/${q?.marks ?? '—'}${a.teacher_feedback ? ` — ${escapeHtml(a.teacher_feedback)}` : ''}</div>` : '')}
        </div>`;
      }).join('')}
    </div>`;
    }).join('') || '<p class="muted">No submissions yet.</p>'}
  </div>`;
  detail.querySelectorAll('.save-grade-btn').forEach(btn => btn.addEventListener('click', async () => {
    const row = btn.closest('.submission-answer-row');
    const answerId = row.dataset.answerId;
    const marks = row.querySelector('.grade-marks-input').value;
    const feedback = row.querySelector('.grade-feedback-input').value;
    try {
      await api(`/assignment_answers/${answerId}/grade`, { method: 'POST', body: { marks_awarded: marks, teacher_feedback: feedback } });
      loadSubmissions(assignmentId);
    } catch (err) { alert(err.message); }
  }));
  detail.scrollIntoView({ behavior: 'smooth' });
}

async function openAssignmentForStudent(assignmentId) {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="empty-state">Loading…</div>';
  const data = await api(`/assignments/${assignmentId}`);
  const existingAnswers = {};
  const answerByQuestion = {};
  if (data.mySubmission) data.mySubmission.answers.forEach(a => { existingAnswers[a.question_id] = a.answer_text; answerByQuestion[a.question_id] = a; });
  const isGraded = data.mySubmission && data.mySubmission.answers.every(a => a.marks_awarded != null);
  content.innerHTML = `
    <div class="page-header"><h2>${escapeHtml(data.assignment.title)}</h2><button class="btn secondary" id="back-to-assignments">← Back</button></div>
    <div class="notice">${escapeHtml(data.assignment.type)} ${data.assignment.due_date ? '· Due ' + escapeHtml(data.assignment.due_date) : ''}
      ${data.assignment.instructions ? '<br>' + escapeHtml(data.assignment.instructions) : ''}
      ${data.mySubmission ? '<br><b>You already submitted this on ' + escapeHtml(data.mySubmission.submitted_at) + '. Submitting again will update your answers.</b>' : ''}
      ${isGraded ? `<br><b>✓ Graded — total score: ${data.mySubmission.answers.reduce((s, a) => s + Number(a.marks_awarded || 0), 0)}/${data.questions.reduce((s, q) => s + q.marks, 0)}</b>` : ''}</div>
    <form id="submit-assignment-form">
      ${data.questions.map((q, i) => { const a = answerByQuestion[q.id]; return `<div class="card">
        <b>${i + 1}. ${escapeHtml(q.question_text)}</b> <span class="small-text">(${q.marks} mark${q.marks == 1 ? '' : 's'})</span>
        ${q.question_type === 'mcq'
          ? q.options.map((opt, oi) => `<label style="display:block;margin-top:8px;font-weight:400"><input type="radio" name="q${q.id}" value="${oi}" ${existingAnswers[q.id] == oi ? 'checked' : ''}> ${escapeHtml(opt)}</label>`).join('')
          : `<textarea name="q${q.id}" rows="3" style="margin-top:8px">${escapeHtml(existingAnswers[q.id] || '')}</textarea>`}
        ${a && a.marks_awarded != null ? `<div class="notice" style="margin-top:8px"><b>Marks:</b> ${a.marks_awarded}/${q.marks}${a.teacher_feedback ? `<br><b>Feedback:</b> ${escapeHtml(a.teacher_feedback)}` : ''}</div>` : ''}
      </div>`; }).join('')}
      <button type="submit" class="btn gold">Submit Answers</button>
    </form>`;
  document.getElementById('back-to-assignments').addEventListener('click', renderAssignments);
  document.getElementById('submit-assignment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const answers = data.questions.map(q => ({ question_id: q.id, answer_text: new FormData(e.target).get(`q${q.id}`) || '' }));
    try { await api(`/assignments/${assignmentId}/submit`, { method: 'POST', body: { answers } }); alert('Submitted!'); renderAssignments(); }
    catch (err) { alert(err.message); }
  });
}

// ---------- Class Groups & recurring tasks ----------
async function renderClassGroups() {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="empty-state">Loading…</div>';
  const classes = await api('/classes?pageSize=200');
  content.innerHTML = `
    <div class="page-header"><h2>Class Groups</h2></div>
    <div class="notice">Split a class into named groups (e.g. "Group A", "Red Team") and assign tasks to a group on a daily, weekly, or monthly basis.</div>
    <div class="toolbar">
      <select id="cg-class"><option value="">Select a class…</option>${classes.rows.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select>
      <button class="btn secondary" id="cg-load">Load Groups</button>
      <button class="btn gold" id="cg-new-group">+ New Group</button>
      <button class="btn secondary" id="cg-print">🖶 Print Groups</button>
    </div>
    <div id="cg-groups-list" style="margin-top:16px"></div>`;

  async function loadGroups() {
    const classId = document.getElementById('cg-class').value;
    if (!classId) return alert('Select a class first.');
    const groups = await api(`/class_groups?class_id=${classId}`);
    const listEl = document.getElementById('cg-groups-list');
    listEl.innerHTML = groups.rows.map(g => `<div class="card" data-group-id="${g.id}">
      <div class="page-header" style="margin-bottom:10px"><h3 style="margin:0;color:var(--navy)">${escapeHtml(g.name)}</h3>
        <button class="btn secondary del-group-btn" data-id="${g.id}" style="padding:6px 12px;font-size:12.5px">Delete Group</button></div>
      <div class="cg-members" data-group-id="${g.id}"></div>
      <div class="cg-tasks" data-group-id="${g.id}" style="margin-top:14px"></div>
      <div class="cg-progress" data-group-id="${g.id}" style="margin-top:14px"></div>
    </div>`).join('') || '<div class="empty-state">No groups yet for this class.</div>';

    for (const g of groups.rows) await loadGroupDetail(g.id, classId);

    listEl.querySelectorAll('.del-group-btn').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Delete this group and its tasks?')) return;
      await api(`/class_groups/${btn.dataset.id}`, { method: 'DELETE' });
      loadGroups();
    }));
  }

  async function loadGroupDetail(groupId, classId) {
    const [members, allStudents, tasksData] = await Promise.all([
      api(`/class_groups/${groupId}/members`), api(`/students?class_id=${classId}&pageSize=200`), api(`/group_tasks?group_id=${groupId}`),
    ]);
    const memberIds = new Set(members.map(m => m.id));
    const memberBox = document.querySelector(`.cg-members[data-group-id="${groupId}"]`);
    memberBox.innerHTML = `<b>Members:</b> ${members.map(m => `<span class="linked-parent-chip" style="display:inline-flex;margin:3px 4px 0 0">${escapeHtml(m.first_name)} ${escapeHtml(m.last_name)}
        <button type="button" class="chip-remove remove-member-btn" data-group="${groupId}" data-student="${m.id}">×</button></span>`).join('') || '<span class="muted">None yet</span>'}
      <div class="toolbar" style="margin-top:8px">
        <select class="add-member-select" data-group="${groupId}"><option value="">Add student…</option>${allStudents.rows.filter(s => !memberIds.has(s.id)).map(s => `<option value="${s.id}">${escapeHtml(s.first_name)} ${escapeHtml(s.last_name)}</option>`).join('')}</select>
        <button type="button" class="btn secondary add-member-btn" data-group="${groupId}" style="padding:6px 12px;font-size:12.5px">Add</button>
      </div>`;
    const taskBox = document.querySelector(`.cg-tasks[data-group-id="${groupId}"]`);
    taskBox.innerHTML = `<b>Tasks:</b>
      <div class="table-wrap" style="margin-top:6px"><table><thead><tr><th>Task</th><th>Frequency</th><th></th></tr></thead><tbody>
        ${tasksData.rows.map(t => `<tr><td>${escapeHtml(t.title)}</td><td>${escapeHtml(t.frequency)}</td><td><button class="del-task-btn" data-id="${t.id}">Delete</button></td></tr>`).join('') || '<tr><td colspan=3 class="muted">No tasks yet</td></tr>'}
      </tbody></table></div>
      <div class="toolbar" style="margin-top:8px">
        <input type="text" class="new-task-title" data-group="${groupId}" placeholder="New task…" style="max-width:220px">
        <select class="new-task-freq" data-group="${groupId}"><option>Daily</option><option>Weekly</option><option>Monthly</option><option>One-time</option></select>
        <button type="button" class="btn secondary add-task-btn" data-group="${groupId}" style="padding:6px 12px;font-size:12.5px">Add Task</button>
      </div>`;

    memberBox.querySelectorAll('.remove-member-btn').forEach(btn => btn.addEventListener('click', async () => {
      await api(`/class_groups/${btn.dataset.group}/members/${btn.dataset.student}`, { method: 'DELETE' });
      loadGroupDetail(groupId, classId);
    }));
    memberBox.querySelector('.add-member-btn').addEventListener('click', async () => {
      const sel = memberBox.querySelector('.add-member-select');
      if (!sel.value) return;
      await api(`/class_groups/${groupId}/members`, { method: 'POST', body: { student_id: Number(sel.value) } });
      loadGroupDetail(groupId, classId);
    });
    taskBox.querySelectorAll('.del-task-btn').forEach(btn => btn.addEventListener('click', async () => {
      await api(`/group_tasks/${btn.dataset.id}`, { method: 'DELETE' });
      loadGroupDetail(groupId, classId);
    }));
    taskBox.querySelector('.add-task-btn').addEventListener('click', async () => {
      const titleInput = taskBox.querySelector('.new-task-title');
      const freqSelect = taskBox.querySelector('.new-task-freq');
      if (!titleInput.value.trim()) return;
      await api('/group_tasks', { method: 'POST', body: { group_id: groupId, title: titleInput.value.trim(), frequency: freqSelect.value } });
      loadGroupDetail(groupId, classId);
    });

    // Academic progress for this group's current members — each one's overall average this
    // term, plus a group-wide average, so a teacher can spot a group that's falling behind.
    const progressBox = document.querySelector(`.cg-progress[data-group-id="${groupId}"]`);
    if (members.length) {
      progressBox.innerHTML = '<b>Progress:</b> <span class="small-text">Loading…</span>';
      const dash = await api('/dashboard').catch(() => ({}));
      const termId = dash.current_term_id;
      if (!termId) {
        progressBox.innerHTML = '<b>Progress:</b> <span class="muted">No current term is set — see Settings.</span>';
      } else {
        const memberProgress = await Promise.all(members.map(async (m) => {
          const caRows = await api(`/continuous-assessment?student_id=${m.id}&term_id=${termId}`).catch(() => []);
          const avg = caRows.length ? Math.round(caRows.reduce((s, r) => s + r.final_score, 0) / caRows.length) : null;
          return { name: `${m.first_name} ${m.last_name}`, avg };
        }));
        const scored = memberProgress.filter(m => m.avg != null);
        const groupAvg = scored.length ? Math.round(scored.reduce((s, m) => s + m.avg, 0) / scored.length) : null;
        progressBox.innerHTML = `<b>Progress this term:</b> ${groupAvg != null ? `Group average <b>${groupAvg}</b>` : '<span class="muted">No results recorded yet</span>'}
          <div class="table-wrap" style="margin-top:6px"><table><thead><tr><th>Student</th><th>Average</th></tr></thead><tbody>
            ${memberProgress.map(m => `<tr><td>${escapeHtml(m.name)}</td><td>${m.avg != null ? m.avg : '<span class="muted">No results yet</span>'}</td></tr>`).join('')}
          </tbody></table></div>`;
      }
    } else {
      progressBox.innerHTML = '';
    }
  }

  document.getElementById('cg-load').addEventListener('click', loadGroups);
  document.getElementById('cg-print').addEventListener('click', async () => {
    const classId = document.getElementById('cg-class').value;
    if (!classId) return alert('Select a class first.');
    const className = classes.rows.find(c => c.id === Number(classId))?.name || '';
    const [groups, settings] = await Promise.all([api(`/class_groups?class_id=${classId}`), api('/public-settings').catch(() => ({}))]);
    if (!groups.rows.length) return alert('This class has no groups yet.');
    const groupsWithMembers = [];
    for (const g of groups.rows) {
      const members = await api(`/class_groups/${g.id}/members`);
      groupsWithMembers.push({ name: g.name, members });
    }
    printClassGroups(className, groupsWithMembers, settings.school_name);
  });
  document.getElementById('cg-new-group').addEventListener('click', async () => {
    const classId = document.getElementById('cg-class').value;
    if (!classId) return alert('Select a class first.');
    const name = prompt('Group name (e.g. "Group A"):');
    if (!name) return;
    await api('/class_groups', { method: 'POST', body: { class_id: Number(classId), name } });
    loadGroups();
  });
}

// ---------- Student self-service: "My Group Tasks" ----------
async function renderMyGroupTasks() {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="empty-state">Loading…</div>';
  const data = await api('/my-group-tasks');
  content.innerHTML = `
    <div class="page-header"><h2>My Tasks</h2></div>
    <div class="card">
      <h3 style="margin-top:0;color:var(--navy)">Individually Assigned to Me</h3>
      <div class="table-wrap"><table><thead><tr><th>Task</th><th>Frequency</th><th>Due</th><th>Status</th><th></th></tr></thead>
        <tbody>${data.individual_tasks.map(t => `<tr data-id="${t.id}"><td>${escapeHtml(t.title)}${t.description ? `<div class="small-text">${escapeHtml(t.description)}</div>` : ''}</td><td>${escapeHtml(t.frequency)}</td><td>${escapeHtml(t.due_date) || '—'}</td>
          <td><span class="badge ${t.status === 'Done' ? 'green' : 'amber'}">${escapeHtml(t.status)}</span></td>
          <td>${t.status !== 'Done' ? `<button class="task-done-btn">Mark Done</button>` : ''}</td></tr>`).join('') || '<tr><td colspan=5 class="muted">No individual tasks assigned yet.</td></tr>'}</tbody></table></div>
    </div>
    <div class="notice">Tasks assigned to any group you belong to.</div>
    <div class="table-wrap"><table><thead><tr><th>Task</th><th>Group</th><th>Frequency</th><th>Assigned</th></tr></thead>
      <tbody>${data.group_tasks.map(t => `<tr><td>${escapeHtml(t.title)}${t.description ? `<div class="small-text">${escapeHtml(t.description)}</div>` : ''}</td><td>${escapeHtml(t.group_name)}</td><td>${escapeHtml(t.frequency)}</td><td>${escapeHtml(t.created_at)}</td></tr>`).join('') || '<tr><td colspan=4 class="muted">No group tasks assigned yet.</td></tr>'}</tbody></table></div>`;
  content.querySelectorAll('.task-done-btn').forEach(btn => btn.addEventListener('click', async () => {
    const id = btn.closest('tr').dataset.id;
    await api(`/student_tasks/${id}/complete`, { method: 'POST' });
    renderMyGroupTasks();
  }));
}

// ---------- GES School Selection (SHS placement) form ----------
const PROGRAMME_OPTIONS = ['General Arts', 'General Science', 'Business', 'Visual Arts', 'Home Economics', 'Agricultural Science', 'Technical/Vocational'];

async function renderSchoolSelection() {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="empty-state">Loading…</div>';
  const isStudent = state.user && state.user.role === 'Student';
  const config = await api('/school-selection-config');

  if (isStudent) {
    content.innerHTML = `<div class="page-header"><h2>SHS School Selection</h2></div><div id="ss-form-area"></div>`;
    const sel = await api('/school-selections');
    const me = state.user.linked_student_id ? await api(`/students/${state.user.linked_student_id}`) : null;
    renderSchoolSelectionForm(document.getElementById('ss-form-area'), me, sel, config, false);
    return;
  }

  content.innerHTML = `
    <div class="page-header"><h2>SHS School Selection</h2>
      ${can('students', 'edit') ? `<button class="btn secondary" id="goto-school-db-btn">📚 School Database</button>` : ''}</div>
    <div class="notice">Ghana Education Service CSSPS placement form — candidates rank ${config.max_choices} schools in order of preference.
      Guideline: no more than ${config.max_category_a} school${config.max_category_a === 1 ? '' : 's'} from Category A, no more than ${config.max_category_b} from Category B.</div>
    ${can('students', 'edit') ? `
    <div class="card">
      <h3 style="margin-top:0;color:var(--navy)">Form Settings</h3>
      <div class="form-grid">
        <div><label>Number of Choices</label><input type="number" id="max-choices-input" min="1" max="15" value="${config.max_choices}"></div>
        <div><label>Max from Category A</label><input type="number" id="max-cat-a-input" min="0" value="${config.max_category_a}"></div>
        <div><label>Max from Category B</label><input type="number" id="max-cat-b-input" min="0" value="${config.max_category_b}"></div>
      </div>
      <button class="btn secondary" id="save-max-choices" style="margin-top:10px">Save Settings</button>
    </div>` : ''}
    <div class="card">
      <div class="toolbar">
        <input type="text" id="ss-student-id" placeholder="Student ID (e.g. NIB/2026/001)">
        <button class="btn secondary" id="ss-load-btn">Load Student</button>
        <select id="ss-export-class"><option value="">Export whole class…</option></select>
        <button class="btn secondary" id="ss-export-btn">⬇ Download All (Excel/CSV)</button>
      </div>
    </div>
    <div id="ss-form-area"></div>`;

  api('/classes?pageSize=200').then(classes => {
    document.getElementById('ss-export-class').innerHTML += classes.rows.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  });
  document.getElementById('goto-school-db-btn')?.addEventListener('click', () => location.hash = '#school-database');

  document.getElementById('save-max-choices')?.addEventListener('click', async () => {
    await api('/school-selection-config', { method: 'PUT', body: {
      max_choices: Number(document.getElementById('max-choices-input').value),
      max_category_a: Number(document.getElementById('max-cat-a-input').value),
      max_category_b: Number(document.getElementById('max-cat-b-input').value),
    } });
    alert('Saved. Reload a student to see the updated settings.');
  });
  document.getElementById('ss-export-btn').addEventListener('click', () => {
    const classId = document.getElementById('ss-export-class').value;
    window.open(`/api/school-selections/export-csv${classId ? '?class_id=' + classId : ''}`, '_blank');
  });
  document.getElementById('ss-load-btn').addEventListener('click', async () => {
    const idText = document.getElementById('ss-student-id').value.trim();
    if (!idText) return alert('Enter a Student ID.');
    try {
      const students = await api(`/students?q=${encodeURIComponent(idText)}&pageSize=5`);
      const student = students.rows.find(s => s.student_id === idText) || students.rows[0];
      if (!student) return alert('Student not found.');
      const freshConfig = await api('/school-selection-config');
      const sel = await api(`/school-selections?student_id=${student.id}`);
      renderSchoolSelectionForm(document.getElementById('ss-form-area'), student, sel, freshConfig, true);
    } catch (e) { alert(e.message); }
  });
}

function renderSchoolSelectionForm(container, student, existingSelection, config, showPrintExport) {
  const choices = (existingSelection && existingSelection.choices && existingSelection.choices.length ? existingSelection.choices : [])
    .concat(Array(Math.max(0, config.max_choices - (existingSelection?.choices?.length || 0))).fill({}));
  const selectedPrefs = new Set(existingSelection ? existingSelection.programme_preferences : []);
  const ordinal = (n) => ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th', '13th', '14th', '15th'][n] || `${n}th`;

  container.innerHTML = `
    <div class="card">
      <h3 style="margin-top:0;color:var(--navy)">Candidate Details</h3>
      <div class="form-grid">
        <div><label>Candidate's Name</label><input type="text" value="${student ? escapeHtml(student.first_name + ' ' + student.last_name) : ''}" disabled></div>
        <div><label>Index Number</label><input type="text" id="ss-index-number" value="${escapeHtml(existingSelection ? existingSelection.index_number || '' : '')}" placeholder="WAEC index number"></div>
        <div><label>Gender</label><input type="text" value="${student ? escapeHtml(student.gender || '') : ''}" disabled></div>
        <div><label>Residential Location</label><input type="text" id="ss-residential-location" value="${escapeHtml(existingSelection ? existingSelection.residential_location || '' : '')}" placeholder="Suburb / Town / Village"></div>
      </div>
    </div>
    <div class="card">
      <div class="page-header" style="margin-bottom:8px"><h3 style="margin:0;color:var(--navy)">School Selection</h3></div>
      <div id="ss-category-warning"></div>
      <div class="table-wrap"><table><thead><tr><th>Choice</th><th>School Code</th><th>School Name</th><th>Category</th><th>Programme Code</th><th>Programme</th><th>Day/Boarding</th><th></th></tr></thead>
        <tbody>${Array.from({ length: config.max_choices }, (_, i) => {
          const c = choices[i] || {};
          return `<tr data-i="${i}">
            <td><b>${ordinal(i + 1)}</b></td>
            <td><input type="text" class="ss-school-code" data-i="${i}" value="${escapeHtml(c.school_code || '')}" style="width:80px"></td>
            <td><input type="text" class="ss-school-name" data-i="${i}" value="${escapeHtml(c.school_name || '')}"></td>
            <td><input type="text" class="ss-category" data-i="${i}" value="${escapeHtml(c.category || '')}" style="width:56px"></td>
            <td><input type="text" class="ss-programme-code" data-i="${i}" value="${escapeHtml(c.programme_code || '')}" style="width:70px"></td>
            <td><input type="text" class="ss-programme-name" data-i="${i}" value="${escapeHtml(c.programme_name || '')}"></td>
            <td><select class="ss-day-boarding" data-i="${i}"><option value="">—</option><option ${c.day_boarding === 'Boarding' ? 'selected' : ''}>Boarding</option><option ${c.day_boarding === 'Day' ? 'selected' : ''}>Day</option></select></td>
            <td><button type="button" class="btn secondary ss-pick-btn" data-i="${i}" style="padding:5px 9px;font-size:12px">Find</button></td>
          </tr>`;
        }).join('')}</tbody></table></div>
    </div>
    <div class="card">
      <h3 style="margin-top:0;color:var(--navy)">Programme Preferences</h3>
      <div style="display:flex;flex-wrap:wrap;gap:14px">
        ${PROGRAMME_OPTIONS.map(p => `<label style="display:flex;align-items:center;gap:6px;font-weight:400;font-size:13.5px">
          <input type="checkbox" class="ss-pref" value="${escapeHtml(p)}" ${selectedPrefs.has(p) ? 'checked' : ''}> ${escapeHtml(p)}</label>`).join('')}
      </div>
      <div style="margin-top:10px"><label style="font-weight:400;font-size:13.5px"><input type="checkbox" id="ss-pref-other" ${existingSelection && existingSelection.other_programme ? 'checked' : ''}> Other:</label>
        <input type="text" id="ss-other-text" value="${escapeHtml(existingSelection ? existingSelection.other_programme || '' : '')}" style="max-width:260px;margin-left:8px"></div>
    </div>
    <div class="card">
      <h3 style="margin-top:0;color:var(--navy)">Parent / Guardian Information</h3>
      <div class="form-grid">
        <div><label>Parent/Guardian Name</label><input type="text" id="ss-parent-name" value="${escapeHtml(existingSelection ? existingSelection.parent_name || '' : '')}"></div>
        <div><label>Phone Number</label><input type="text" id="ss-parent-phone" value="${escapeHtml(existingSelection ? existingSelection.parent_phone || '' : '')}"></div>
      </div>
      <label style="display:flex;align-items:center;gap:8px;font-weight:400;margin-top:10px">
        <input type="checkbox" id="ss-signed-off" ${existingSelection && existingSelection.parent_signed_off ? 'checked' : ''}>
        Parent/Guardian has reviewed and approved this selection
      </label>
    </div>
    <div class="toolbar">
      <button class="btn gold" id="ss-save-btn">Save</button>
      ${showPrintExport ? `<button class="btn secondary" id="ss-print-btn">🖶 Print</button><button class="btn secondary" id="ss-download-btn">⬇ Download (Excel/CSV)</button>` : ''}
    </div>`;

  function checkCategoryLimits() {
    const cats = [...container.querySelectorAll('.ss-category')].map(inp => inp.value.trim().toUpperCase()).filter(Boolean);
    const countA = cats.filter(c => c === 'A').length;
    const countB = cats.filter(c => c === 'B').length;
    const warnEl = document.getElementById('ss-category-warning');
    const problems = [];
    if (countA > config.max_category_a) problems.push(`${countA} Category A schools selected — the guideline allows at most ${config.max_category_a}.`);
    if (countB > config.max_category_b) problems.push(`${countB} Category B schools selected — the guideline allows at most ${config.max_category_b}.`);
    const codes = [...container.querySelectorAll('.ss-school-code')].map(inp => inp.value.trim()).filter(Boolean);
    const dupes = codes.filter((c, i) => codes.indexOf(c) !== i);
    if (dupes.length) problems.push(`The same school code (${[...new Set(dupes)].join(', ')}) appears more than once — candidates must not repeat a school.`);
    warnEl.innerHTML = problems.length ? `<div class="notice" style="background:#fbe6e4;border-color:#f3c6c1">⚠️ ${problems.join('<br>')}</div>` : '';
  }
  container.querySelectorAll('.ss-category, .ss-school-code').forEach(inp => inp.addEventListener('input', checkCategoryLimits));
  checkCategoryLimits();

  container.querySelectorAll('.ss-pick-btn').forEach(btn => btn.addEventListener('click', () => openSchoolPickerModal((school) => {
    const i = btn.dataset.i;
    container.querySelector(`.ss-school-code[data-i="${i}"]`).value = school.school_code;
    container.querySelector(`.ss-school-name[data-i="${i}"]`).value = school.school_name;
    container.querySelector(`.ss-category[data-i="${i}"]`).value = school.category;
    checkCategoryLimits();
  })));

  function collectPayload() {
    const rows = Array.from({ length: config.max_choices }, (_, i) => ({
      school_code: container.querySelector(`.ss-school-code[data-i="${i}"]`).value,
      school_name: container.querySelector(`.ss-school-name[data-i="${i}"]`).value,
      category: container.querySelector(`.ss-category[data-i="${i}"]`).value,
      programme_code: container.querySelector(`.ss-programme-code[data-i="${i}"]`).value,
      programme_name: container.querySelector(`.ss-programme-name[data-i="${i}"]`).value,
      day_boarding: container.querySelector(`.ss-day-boarding[data-i="${i}"]`).value,
    })).filter(c => c.school_name || c.school_code || c.category || c.programme_name);
    const prefs = [...container.querySelectorAll('.ss-pref:checked')].map(cb => cb.value);
    const otherChecked = document.getElementById('ss-pref-other').checked;
    return {
      student_id: student ? student.id : undefined,
      choices: rows, programme_preferences: prefs,
      other_programme: otherChecked ? document.getElementById('ss-other-text').value : null,
      parent_name: document.getElementById('ss-parent-name').value,
      parent_phone: document.getElementById('ss-parent-phone').value,
      index_number: document.getElementById('ss-index-number').value,
      residential_location: document.getElementById('ss-residential-location').value,
      parent_signed_off: document.getElementById('ss-signed-off').checked,
    };
  }

  document.getElementById('ss-save-btn').addEventListener('click', async () => {
    try { await api('/school-selections', { method: 'POST', body: collectPayload() }); alert('Saved.'); }
    catch (e) { alert(e.message); }
  });
  document.getElementById('ss-print-btn')?.addEventListener('click', () => printSchoolSelection(student, collectPayload(), config));
  document.getElementById('ss-download-btn')?.addEventListener('click', () => {
    window.open(`/api/school-selections/export-csv`, '_blank');
  });
}

function openSchoolPickerModal(onPick) {
  const modal = el(`<div class="modal-backdrop"><div class="modal" style="width:520px">
    <h3>Find a School</h3>
    <input type="text" id="sp-search" placeholder="Search by name or code…" autofocus>
    <div id="sp-results" style="max-height:320px;overflow-y:auto;margin-top:10px"></div>
    <div class="modal-actions"><button type="button" class="btn secondary" id="sp-cancel">Close</button></div>
  </div></div>`);
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  modal.querySelector('#sp-cancel').addEventListener('click', () => modal.remove());
  const search = modal.querySelector('#sp-search');
  const results = modal.querySelector('#sp-results');
  async function runSearch() {
    const q = search.value.trim();
    const data = await api(`/ges_schools?q=${encodeURIComponent(q)}&pageSize=30`);
    results.innerHTML = data.rows.map(s => `<div class="parent-search-result" data-code="${s.school_code}">
      <b>${escapeHtml(s.school_name)}</b> <span class="small-text">(${escapeHtml(s.school_code)} · Category ${escapeHtml(s.category)} · ${escapeHtml(s.region || '')})</span></div>`).join('')
      || '<p class="muted small-text">No matching schools. Try the School Database page to add more.</p>';
    results.querySelectorAll('.parent-search-result').forEach(row => row.addEventListener('click', async () => {
      const school = data.rows.find(s => s.school_code === row.dataset.code);
      onPick(school);
      modal.remove();
    }));
  }
  search.addEventListener('input', debounce(runSearch, 250));
  runSearch();
}

function printSchoolSelection(student, data, config) {
  const win = window.open('', '_blank');
  const rows = data.choices.length ? data.choices : [];
  const ordinal = (n) => ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'][n] || `${n}th`;
  win.document.write(`<!DOCTYPE html><html><head><title>School Selection</title><link rel="stylesheet" href="/style.css"></head><body style="padding:24px">
    <div class="report-card">
      <div class="rc-title-band">CSSPS SCHOOL SELECTION FORM</div>
      <table style="width:100%;margin-top:12px;font-size:13px"><tr>
        <td><b>Candidate's Name:</b> ${student ? escapeHtml(student.first_name + ' ' + student.last_name) : '—'}</td>
        <td><b>Index Number:</b> ${escapeHtml(data.index_number || '—')}</td></tr>
      <tr><td><b>Gender:</b> ${student ? escapeHtml(student.gender || '—') : '—'}</td>
        <td><b>Residential Location:</b> ${escapeHtml(data.residential_location || '—')}</td></tr></table>
      <table class="rc-table" style="margin-top:14px"><thead><tr><th>Choice</th><th>Code</th><th>School Name</th><th>Category</th><th>Prog. Code</th><th>Programme</th><th>Day/Boarding</th></tr></thead>
      <tbody>${Array.from({ length: config.max_choices }, (_, i) => { const c = rows[i] || {}; return `<tr><td>${ordinal(i + 1)}</td><td>${escapeHtml(c.school_code || '')}</td><td>${escapeHtml(c.school_name || '')}</td><td>${escapeHtml(c.category || '')}</td><td>${escapeHtml(c.programme_code || '')}</td><td>${escapeHtml(c.programme_name || '')}</td><td>${escapeHtml(c.day_boarding || '')}</td></tr>`; }).join('')}</tbody></table>
      <p style="margin-top:14px"><b>Programme Preferences:</b> ${data.programme_preferences.map(escapeHtml).join(', ') || '—'}${data.other_programme ? ', Other: ' + escapeHtml(data.other_programme) : ''}</p>
      <div class="rc-signatures" style="margin-top:30px">
        <div>____________________<div class="small-text">Parent/Guardian Name: ${escapeHtml(data.parent_name || '')}</div></div>
        <div>____________________<div class="small-text">Parent/Guardian Signature &amp; Date</div></div>
        <div>____________________<div class="small-text">Headteacher's Stamp &amp; Signature</div></div>
      </div>
    </div><script>window.print()<\/script></body></html>`);
  win.document.close();
}

// ---------- GES School Database (admin/teacher managed reference list of schools) ----------
async function renderSchoolDatabase() {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="page-header"><h2>GES School Database</h2>
      <button class="btn secondary" id="back-to-selection">← Back to School Selection</button></div>
    <div class="notice">The reference list of schools candidates can pick from on the School Selection form.
      Ships with a small starter set — <b>bulk-import the full official register via CSV</b> below (GES republishes it every year), or add schools one at a time.</div>
    <div class="card">
      <div class="toolbar">
        <button class="btn secondary" id="sdb-export-btn">⬇ Download Current List (CSV)</button>
        <input type="file" id="sdb-import-input" accept=".csv">
        <button class="btn gold" id="sdb-import-btn">⬆ Import CSV</button>
      </div>
      <p class="small-text" style="margin-top:6px">CSV columns: School Code, School Name, Category, Region, District, Gender, Day/Boarding, Type, Programmes. Re-importing a code already in the list updates that school instead of duplicating it.</p>
      <p id="sdb-import-status" class="small-text"></p>
    </div>
    <div class="card">
      <h3 style="margin-top:0;color:var(--navy)">Add a School</h3>
      <form id="sdb-add-form" class="form-grid">
        <div><label>School Code *</label><input type="text" name="school_code" required></div>
        <div><label>School Name *</label><input type="text" name="school_name" required></div>
        <div><label>Category</label><select name="category"><option>A</option><option>B</option><option selected>C</option><option value="Pilot Private">Pilot Private</option><option>TVET</option></select></div>
        <div><label>Region</label><input type="text" name="region"></div>
        <div><label>District</label><input type="text" name="district"></div>
        <div><label>Gender</label><select name="gender"><option>Mixed</option><option>Boys</option><option>Girls</option></select></div>
        <div><label>Day/Boarding</label><input type="text" name="day_boarding" placeholder="e.g. Day/Boarding"></div>
        <div><label>Type</label><input type="text" name="sch_type" placeholder="SHS, SHTS, STEM, TVET"></div>
        <div class="full"><label>Programmes</label><input type="text" name="programmes" placeholder="e.g. General Arts, General Science"></div>
        <div class="full"><button type="submit" class="btn gold">Add School</button></div>
      </form>
    </div>
    <div class="card">
      <div class="toolbar"><input type="search" id="sdb-search" placeholder="Search schools…"></div>
      <div id="sdb-list" style="margin-top:10px"></div>
    </div>`;
  document.getElementById('back-to-selection').addEventListener('click', () => location.hash = '#school-selection');

  async function loadList(q) {
    const data = await api(`/ges_schools?pageSize=500${q ? '&q=' + encodeURIComponent(q) : ''}`);
    document.getElementById('sdb-list').innerHTML = `<div class="table-wrap"><table><thead><tr><th>Code</th><th>Name</th><th>Category</th><th>Region</th><th>Gender</th><th>Day/Boarding</th><th></th></tr></thead>
      <tbody>${data.rows.map(s => `<tr><td>${escapeHtml(s.school_code)}</td><td>${escapeHtml(s.school_name)}</td><td>${escapeHtml(s.category)}</td><td>${escapeHtml(s.region || '')}</td><td>${escapeHtml(s.gender || '')}</td><td>${escapeHtml(s.day_boarding || '')}</td>
        <td><button class="sdb-del-btn" data-id="${s.id}">Delete</button></td></tr>`).join('') || '<tr><td colspan=7 class="muted">No schools yet</td></tr>'}</tbody></table></div>
      <p class="small-text" style="margin-top:8px">${data.rows.length} school${data.rows.length === 1 ? '' : 's'}</p>`;
    document.querySelectorAll('.sdb-del-btn').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Remove this school from the database?')) return;
      await api(`/ges_schools/${btn.dataset.id}`, { method: 'DELETE' });
      loadList(document.getElementById('sdb-search').value);
    }));
  }
  document.getElementById('sdb-search').addEventListener('input', debounce(e => loadList(e.target.value), 250));
  loadList();

  document.getElementById('sdb-add-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    try { await api('/ges_schools', { method: 'POST', body }); e.target.reset(); loadList(); }
    catch (err) { alert(err.message); }
  });
  document.getElementById('sdb-export-btn').addEventListener('click', () => window.open('/api/ges_schools/export-csv', '_blank'));
  document.getElementById('sdb-import-btn').addEventListener('click', async () => {
    const file = document.getElementById('sdb-import-input').files[0];
    if (!file) return alert('Choose a CSV file first.');
    const csvText = await file.text();
    try {
      const result = await api('/ges_schools/import-csv', { method: 'POST', body: { csv_text: csvText } });
      document.getElementById('sdb-import-status').textContent = `Done: ${result.created} added/updated, ${result.skipped} skipped.`;
      loadList();
    } catch (err) { alert(err.message); }
  });
}

// ---------- Arabic Terminal Report (Islamic/Arabic curriculum) ----------
const ARABIC_CATEGORY_LABELS = { Religious: 'المواد الدينية', Arabic: 'المواد العربية', Social: 'المواد الاجتماعية', Foreign: 'مواد أخرى' };

// ---- Arabic numeral helpers (Arabic-Indic digits + cardinal number words) ----
function toArabicDigits(n) {
  const map = { '0': '٠', '1': '١', '2': '٢', '3': '٣', '4': '٤', '5': '٥', '6': '٦', '7': '٧', '8': '٨', '9': '٩' };
  return String(n).replace(/[0-9]/g, d => map[d]);
}
const AR_ONES = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
const AR_TEENS = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
const AR_TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const AR_HUNDREDS = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
function arThreeDigitsToWords(n) {
  const h = Math.floor(n / 100), rem = n % 100;
  const parts = [];
  if (h > 0) parts.push(AR_HUNDREDS[h]);
  if (rem > 0) {
    if (rem < 10) parts.push(AR_ONES[rem]);
    else if (rem < 20) parts.push(AR_TEENS[rem - 10]);
    else {
      const t = Math.floor(rem / 10), o = rem % 10;
      parts.push(o > 0 ? AR_ONES[o] + ' و' + AR_TENS[t] : AR_TENS[t]);
    }
  }
  return parts.join(' و');
}
function numberToArabicWords(n) {
  n = Math.round(n);
  if (n === 0) return 'صفر';
  if (n < 0) return 'سالب ' + numberToArabicWords(-n);
  const thousands = Math.floor(n / 1000), rest = n % 1000;
  const parts = [];
  if (thousands > 0) {
    if (thousands === 1) parts.push('ألف');
    else if (thousands === 2) parts.push('ألفان');
    else if (thousands <= 10) parts.push(arThreeDigitsToWords(thousands) + ' آلاف');
    else parts.push(arThreeDigitsToWords(thousands) + ' ألفاً');
  }
  if (rest > 0) parts.push(arThreeDigitsToWords(rest));
  return parts.join(' و');
}
const ARABIC_CATEGORY_ORDER = ['Religious', 'Arabic', 'Social', 'Foreign'];
// Sorts by category first (in a fixed, sensible order), then by display_order within that
// category — this guarantees subjects belonging to the same category always sit together on
// the printed report, even if a newly-added subject's display_order wasn't set carefully.
function sortArabicSubjects(rows) {
  return [...rows].sort((a, b) => {
    const catDiff = ARABIC_CATEGORY_ORDER.indexOf(a.category) - ARABIC_CATEGORY_ORDER.indexOf(b.category);
    return catDiff !== 0 ? catDiff : a.display_order - b.display_order;
  });
}

async function renderArabicReport() {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="empty-state">Loading…</div>';
  const [classes, terms, subjects, meInfo] = await Promise.all([
    api('/classes?pageSize=200'), api('/terms?pageSize=200'), api('/arabic_subjects?pageSize=100'), Promise.resolve(state.user),
  ]);
  const canManageSubjects = can('results', 'edit') && meInfo.role !== 'Teacher'; // subject list customization stays admin-level, like other curriculum setup

  content.innerHTML = `
    <div class="page-header"><h2>Arabic Terminal Report</h2></div>
    <div class="notice">Islamic/Arabic curriculum subjects — Qur'an, Tajweed, Fiqh, Nahw &amp; Sarf, and more. Only teachers marked as teaching in Arabic (Teachers page → "Teaches In") can enter these scores.</div>
    ${canManageSubjects ? `
    <div class="card">
      <div class="page-header" style="margin-bottom:10px"><h3 style="margin:0;color:var(--navy)">Subjects (fully customizable)</h3>
        <button class="btn secondary" id="ar-add-subject-btn" style="padding:6px 12px;font-size:12.5px">+ Add Subject</button></div>
      <div id="ar-subjects-list"></div>
    </div>` : ''}
    <div class="card">
      <h3 style="margin-top:0;color:var(--navy)">Enter Scores</h3>
      <div class="toolbar">
        <select id="ar-class"><option value="">Select class…</option>${classes.rows.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select>
        <select id="ar-term"><option value="">Select term…</option>${terms.rows.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('')}</select>
        <button class="btn secondary" id="ar-load-students">Load Students</button>
      </div>
      <div id="ar-students-list"></div>
    </div>`;

  function renderSubjectsList() {
    const wrap = document.getElementById('ar-subjects-list');
    if (!wrap) return;
    wrap.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Arabic Name</th><th>English Name</th><th>Category</th><th>Min Pass</th><th>Max Score</th><th></th></tr></thead>
      <tbody>${sortArabicSubjects(subjects.rows).map(s => `<tr data-id="${s.id}">
        <td dir="rtl">${escapeHtml(s.name_ar)}</td><td>${escapeHtml(s.name_en || '')}</td><td>${ARABIC_CATEGORY_LABELS[s.category] || s.category}</td>
        <td>${s.min_pass_score}</td><td>${s.max_score}</td>
        <td><button class="ar-edit-subject-btn">Edit</button> <button class="ar-del-subject-btn">Delete</button></td></tr>`).join('') || '<tr><td colspan=6 class="muted">No subjects yet</td></tr>'}</tbody></table></div>`;
    wrap.querySelectorAll('.ar-edit-subject-btn').forEach(btn => btn.addEventListener('click', () => {
      const id = Number(btn.closest('tr').dataset.id);
      openArabicSubjectForm(subjects.rows.find(s => s.id === id));
    }));
    wrap.querySelectorAll('.ar-del-subject-btn').forEach(btn => btn.addEventListener('click', async () => {
      const id = Number(btn.closest('tr').dataset.id);
      if (!confirm('Delete this subject? Existing scores for it will remain but the subject will disappear from new reports.')) return;
      await api(`/arabic_subjects/${id}`, { method: 'DELETE' });
      renderArabicReport();
    }));
  }
  renderSubjectsList();

  function openArabicSubjectForm(existing) {
    const modal = el(`<div class="modal-backdrop"><div class="modal" style="width:440px">
      <h3>${existing ? 'Edit' : 'Add'} Arabic Subject</h3>
      <form id="ar-subject-form">
        <label>Arabic Name *</label><input type="text" name="name_ar" dir="rtl" value="${escapeHtml(existing?.name_ar || '')}" required>
        <label>English Name</label><input type="text" name="name_en" value="${escapeHtml(existing?.name_en || '')}">
        <label>Category</label>
        <select name="category">${Object.entries(ARABIC_CATEGORY_LABELS).map(([k, v]) => `<option value="${k}" ${existing?.category === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
        <div class="form-grid" style="margin-top:8px">
          <div><label>Minimum Pass Score</label><input type="number" name="min_pass_score" value="${existing?.min_pass_score ?? 50}"></div>
          <div><label>Maximum Score</label><input type="number" name="max_score" value="${existing?.max_score ?? 100}"></div>
        </div>
        <label>Display Order</label><input type="number" name="display_order" value="${existing?.display_order ?? subjects.rows.length + 1}">
        <div class="modal-actions"><button type="button" class="btn secondary" id="ar-subj-cancel">Cancel</button><button type="submit" class="btn gold">Save</button></div>
      </form>
    </div></div>`);
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    modal.querySelector('#ar-subj-cancel').addEventListener('click', () => modal.remove());
    modal.querySelector('#ar-subject-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const body = Object.fromEntries(fd.entries());
      try {
        if (existing) await api(`/arabic_subjects/${existing.id}`, { method: 'PUT', body });
        else await api('/arabic_subjects', { method: 'POST', body });
        modal.remove();
        renderArabicReport();
      } catch (err) { alert(err.message); }
    });
  }
  document.getElementById('ar-add-subject-btn')?.addEventListener('click', () => openArabicSubjectForm(null));

  document.getElementById('ar-load-students').addEventListener('click', async () => {
    const classId = document.getElementById('ar-class').value;
    const termId = document.getElementById('ar-term').value;
    if (!classId || !termId) return alert('Select both a class and a term.');
    const students = (await api(`/students?class_id=${classId}&pageSize=500`)).rows;
    const wrap = document.getElementById('ar-students-list');
    wrap.innerHTML = `
      ${students.length ? `<div class="toolbar" style="margin-top:10px"><button class="btn gold" id="ar-print-all-btn">🖶 Print All (2 per A4 landscape sheet)</button></div>` : ''}
      <div class="table-wrap" style="margin-top:10px"><table><thead><tr><th>Student</th><th></th></tr></thead>
      <tbody>${students.map(s => `<tr data-sid="${s.id}"><td>${escapeHtml(s.first_name)} ${escapeHtml(s.last_name)}</td>
        <td><button class="ar-enter-scores-btn">Enter Scores</button> <button class="ar-print-btn">🖶 Print Report</button></td></tr>`).join('') || '<tr><td colspan=2 class="muted">No students in this class</td></tr>'}</tbody></table></div>`;
    wrap.querySelectorAll('.ar-enter-scores-btn').forEach(btn => btn.addEventListener('click', () => {
      const sid = Number(btn.closest('tr').dataset.sid);
      openArabicScoreEntry(students.find(s => s.id === sid), Number(termId), subjects.rows);
    }));
    wrap.querySelectorAll('.ar-print-btn').forEach(btn => btn.addEventListener('click', async () => {
      const sid = Number(btn.closest('tr').dataset.sid);
      const student = students.find(s => s.id === sid);
      const term = terms.rows.find(t => t.id === Number(termId));
      const [results, settings, ranking] = await Promise.all([
        api(`/arabic-results?student_id=${sid}&term_id=${termId}`),
        api('/public-settings').catch(() => ({})),
        api(`/arabic-class-ranking?class_id=${classId}&term_id=${termId}`),
      ]);
      const myRank = ranking.ranking.find(r => r.student_id === sid);
      const logoUrl = settings.logo_photo ? `/uploads/${encodeURIComponent(settings.logo_photo)}` : '/assets/logo.png';
      printArabicTerminalReport(student, term, subjects.rows, results, settings.school_name, logoUrl, myRank ? myRank.rank : null, ranking.total_students, settings.arabic_report_font);
    }));
    document.getElementById('ar-print-all-btn')?.addEventListener('click', async () => {
      const term = terms.rows.find(t => t.id === Number(termId));
      const [settings, ranking] = await Promise.all([
        api('/public-settings').catch(() => ({})),
        api(`/arabic-class-ranking?class_id=${classId}&term_id=${termId}`),
      ]);
      const logoUrl = settings.logo_photo ? `/uploads/${encodeURIComponent(settings.logo_photo)}` : '/assets/logo.png';
      const pairs = [];
      for (const s of students) {
        const results = await api(`/arabic-results?student_id=${s.id}&term_id=${termId}`);
        const myRank = ranking.ranking.find(r => r.student_id === s.id);
        pairs.push({ student: s, results, position: myRank ? myRank.rank : null });
      }
      printArabicTerminalReportsPaired(pairs, term, subjects.rows, settings.school_name, logoUrl, ranking.total_students, settings.arabic_report_font);
    });
  });
}

function openArabicScoreEntry(student, termId, subjectRows) {
  const modal = el(`<div class="modal-backdrop"><div class="modal" style="width:640px;max-width:94vw">
    <h3>Arabic Scores — ${escapeHtml(student.first_name)} ${escapeHtml(student.last_name)}</h3>
    <div id="ar-entry-status" class="notice" style="display:none"></div>
    <div id="ar-entry-loading" class="empty-state">Loading…</div>
    <div id="ar-entry-table" style="display:none">
      <div class="table-wrap"><table><thead><tr><th dir="rtl">المادة</th><th>Min</th><th>Max</th><th>Score</th><th>Notes</th></tr></thead>
        <tbody id="ar-entry-tbody"></tbody></table></div>
      <div class="modal-actions"><button type="button" class="btn secondary" id="ar-entry-cancel">Close</button><button type="button" class="btn secondary" id="ar-entry-clear">Clear</button><button type="button" class="btn gold" id="ar-entry-save">Save Scores</button></div>
    </div>
  </div></div>`);
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  modal.querySelector('#ar-entry-cancel').addEventListener('click', () => modal.remove());

  api(`/arabic-results?student_id=${student.id}&term_id=${termId}`).then(existingResults => {
    const existingMap = {}; existingResults.forEach(r => existingMap[r.arabic_subject_id] = r);
    const tbody = modal.querySelector('#ar-entry-tbody');
    tbody.innerHTML = sortArabicSubjects(subjectRows).map(s => {
      const ex = existingMap[s.id];
      return `<tr data-subject-id="${s.id}">
        <td dir="rtl">${escapeHtml(s.name_ar)}</td><td>${s.min_pass_score}</td><td>${s.max_score}</td>
        <td><input type="number" class="ar-score-input" min="0" max="${s.max_score}" value="${ex && ex.score_obtained != null ? ex.score_obtained : ''}" style="width:80px"></td>
        <td><input type="text" class="ar-remarks-input" value="${escapeHtml(ex?.remarks || '')}" style="width:140px"></td></tr>`;
    }).join('');
    modal.querySelector('#ar-entry-loading').style.display = 'none';
    modal.querySelector('#ar-entry-table').style.display = 'block';
  }).catch(err => {
    modal.querySelector('#ar-entry-loading').textContent = 'Could not load: ' + err.message;
  });

  modal.querySelector('#ar-entry-clear').addEventListener('click', () => {
    if (!confirm('Clear all score fields on screen? This only resets what\'s currently shown here — nothing already saved is deleted until you click Save Scores.')) return;
    modal.querySelectorAll('.ar-score-input, .ar-remarks-input').forEach(inp => { inp.value = ''; });
  });
  modal.querySelector('#ar-entry-save').addEventListener('click', async () => {
    const records = [...modal.querySelectorAll('#ar-entry-tbody tr')].map(tr => ({
      student_id: student.id,
      arabic_subject_id: Number(tr.dataset.subjectId),
      score_obtained: tr.querySelector('.ar-score-input').value === '' ? null : Number(tr.querySelector('.ar-score-input').value),
      remarks: tr.querySelector('.ar-remarks-input').value || null,
    }));
    try {
      await api('/arabic-results/bulk', { method: 'POST', body: { term_id: termId, records } });
      const status = modal.querySelector('#ar-entry-status');
      status.style.display = 'block';
      status.textContent = 'Saved.';
      setTimeout(() => modal.remove(), 1200);
    } catch (err) { alert(err.message); }
  });
}

// Arabic number-to-words (masculine form, used for "total marks in words") and Arabic-Indic
// digit conversion — both verified against hand-checked reference values before use here.
// Arabic ordinal words for "1st", "2nd" etc. in the class — covers a realistic class size range.
const AR_ORDINALS = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];
function arabicOrdinal(n) {
  if (n >= 1 && n <= 10) return AR_ORDINALS[n];
  return toArabicDigits(n); // beyond 10th, the numeral itself is the normal way to state it
}

// Builds the printable Arabic Terminal Report — right-to-left, A4-formatted, styled after the
// traditional Islamic/Arabic school "درجات الطالب" certificate, with the school's own logo,
// subjects grouped by category, the class position, and totals spelled out in Arabic words.
// Synchronous (all data passed in already-fetched) so window.open() fires immediately on the
// click, avoiding popup blockers that trip on an awaited call before opening a window.
// Maps an overall percentage to an Arabic grade descriptor — used on the Arabic Terminal
// Report's summary, since there's no equivalent to the English grading_system table for it.
function arabicGradeDescription(percentage) {
  if (percentage >= 90) return 'ممتاز';
  if (percentage >= 80) return 'جيد جداً';
  if (percentage >= 70) return 'جيد';
  if (percentage >= 60) return 'مقبول';
  if (percentage >= 50) return 'ضعيف';
  return 'راسب';
}

function buildArabicReportBodyHtml(student, term, subjectRows, results, schoolName, logoUrl, position, totalInClass) {
  const resultBySubject = {}; results.forEach(r => resultBySubject[r.arabic_subject_id] = r);
  const sorted = sortArabicSubjects(subjectRows);
  let totalScore = 0, totalMax = 0;
  sorted.forEach(s => {
    const r = resultBySubject[s.id];
    if (r && r.score_obtained != null) { totalScore += r.score_obtained; totalMax += s.max_score; }
  });
  const percentage = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;
  const totalWords = numberToArabicWords(totalScore);
  let rowsHtml = '', lastCategory = null, serial = 1;
  sorted.forEach(s => {
    if (s.category !== lastCategory) {
      rowsHtml += `<tr class="ar-category-row"><td colspan="6">${ARABIC_CATEGORY_LABELS[s.category] || s.category}</td></tr>`;
      lastCategory = s.category;
    }
    const r = resultBySubject[s.id];
    const scoreWords = r && r.score_obtained != null ? numberToArabicWords(r.score_obtained) : '';
    const noteText = [scoreWords, r?.remarks].filter(Boolean).join(' — ');
    rowsHtml += `<tr><td>${toArabicDigits(serial++)}</td><td class="subj-name">${escapeHtml(s.name_ar)}</td>
      <td>${toArabicDigits(s.min_pass_score)}</td><td>${toArabicDigits(s.max_score)}</td>
      <td>${r && r.score_obtained != null ? toArabicDigits(r.score_obtained) : '—'}</td><td class="subj-name" style="font-size:11px">${escapeHtml(noteText)}</td></tr>`;
  });
  rowsHtml += `<tr class="ar-total-row"><td colspan="4">المجموع الكلي</td><td>${toArabicDigits(totalScore)} / ${toArabicDigits(totalMax)}</td><td>${totalWords}</td></tr>`;

  return `<div class="ar-report">
      <div class="ar-header">
        ${logoUrl ? `<img class="ar-logo" src="${logoUrl}" alt="">` : ''}
        <div class="ar-header-text">
          <h1>${escapeHtml(schoolName || 'Nibras Educational Complex')}</h1>
          <h2>كشف درجات الطالب</h2>
          <p>Student's Terminal Report — Arabic &amp; Islamic Studies</p>
        </div>
        ${student.photo ? `<img class="ar-student-photo" src="/uploads/${encodeURIComponent(student.photo)}" alt="">` : '<div class="ar-student-photo-spacer"></div>'}
      </div>
      <div class="ar-info-grid">
        <span><b>اسم الطالب:</b> ${escapeHtml(student.first_name)} ${escapeHtml(student.last_name)}</span>
        <span><b>رقم الطالب:</b> ${escapeHtml(student.student_id)}</span>
        <span><b>الفصل الدراسي:</b> ${escapeHtml(term ? term.name : '—')}</span>
        <span><b>الجنسية:</b> ${escapeHtml(student.nationality || '—')}</span>
        <span><b>ترتيب الطالب في الفصل:</b> ${position ? `${arabicOrdinal(position)} (${toArabicDigits(position)})` : '—'}</span>
        <span><b>عدد طلاب الفصل:</b> ${totalInClass != null ? toArabicDigits(totalInClass) : '—'}</span>
      </div>
      <table class="ar-table">
        <thead><tr><th>التسلسل</th><th>المواد الدراسية</th><th>الدرجة الصغرى</th><th>الدرجة الكبرى</th><th>الدرجة المكتسبة</th><th>ملاحظات</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <div class="ar-footer">
        <p><b>مجموع الدرجة بالحروف:</b> ${totalWords} من ${numberToArabicWords(totalMax)}</p>
        <p><b>النسبة المئوية:</b> ${toArabicDigits(percentage)}% &nbsp;&nbsp; <b>التقدير العام:</b> ${arabicGradeDescription(percentage)}</p>
      </div>
      <div class="ar-signature">
        <div>مشرف القسم</div>
        <div>التاريخ</div>
      </div>
    </div>`;
}

function arabicReportStyle(fontFamily) {
  return `
      body{font-family:'${fontFamily}','Traditional Arabic','Segoe UI','Arial',sans-serif;padding:0;direction:rtl;background:#fff;}
      .ar-report{border:3px double #0f2a4a;padding:7mm 8mm;}
      .ar-header{display:flex;align-items:center;justify-content:space-between;gap:14px;border-bottom:2.5px solid #c8973a;padding-bottom:9px;margin-bottom:10px;}
      .ar-header .ar-header-text{flex:1;text-align:center;}
      .ar-header .ar-logo{width:70px;height:70px;object-fit:cover;border-radius:50%;border:2px solid #c8973a;flex-shrink:0;}
      .ar-header .ar-student-photo{width:56px;height:68px;object-fit:cover;border-radius:6px;border:2px solid #0f2a4a;flex-shrink:0;}
      .ar-header .ar-student-photo-spacer{width:70px;flex-shrink:0;}
      .ar-header-text h1{font-size:21px;color:#0f2a4a;margin:0 0 3px;font-weight:800;letter-spacing:.2px;}
      .ar-header-text h2{font-size:15px;color:#0f2a4a;margin:0 0 3px;font-weight:800;}
      .ar-header-text p{font-size:10.5px;color:#c8973a;font-style:italic;margin:0;}
      .ar-info-grid{display:grid;grid-template-columns:1fr 1fr;gap:3px 14px;font-size:11px;margin-bottom:8px;padding:7px 9px;background:#f4f6f9;border-radius:6px;border:1px solid #e3e8ef;}
      table.ar-table{width:100%;border-collapse:collapse;margin-top:8px;font-size:10.5px;}
      table.ar-table th, table.ar-table td{border:1px solid #0f2a4a;padding:3px 5px;text-align:center;}
      table.ar-table th{background:#0f2a4a;color:#fff;font-size:10px;}
      table.ar-table td.subj-name{text-align:right;}
      table.ar-table tbody tr:nth-child(even){background:#fafbfc;}
      tr.ar-category-row td{background:#eef1f6;font-weight:700;text-align:right;color:#0f2a4a;}
      tr.ar-total-row td{background:#fbf1dc;font-weight:800;border-top:2px solid #0f2a4a;}
      .ar-footer{margin-top:10px;font-size:11px;line-height:1.8;}
      .ar-footer b{color:#0f2a4a;}
      .ar-signature{margin-top:20px;display:flex;justify-content:space-between;font-size:10.5px;}
      .ar-signature div{width:45%;text-align:center;border-top:1px solid #333;padding-top:3px;}`;
}

// Synchronous (all data passed in already-fetched) so window.open() fires immediately on the
// click, avoiding popup blockers that trip on an awaited call before opening a window.
async function printArabicTerminalReport(student, term, subjectRows, results, schoolName, logoUrl, position, totalInClass, arabicFontKey) {
  const bodyHtml = buildArabicReportBodyHtml(student, term, subjectRows, results, schoolName, logoUrl, position, totalInClass);
  const fontFamily = await resolveArabicFontFamily(arabicFontKey);
  const customFontCss = await getCustomFontFaceCss();
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
    <title>كشف درجات الطالب</title><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/assets/fonts/arabic-fonts.css">
    <style>${customFontCss} @page{size:A4;margin:14mm;} .ar-report{max-width:190mm;margin:0 auto;}${arabicReportStyle(fontFamily)}</style></head><body>
    ${bodyHtml}
    <script>window.print()<\/script></body></html>`);
  win.document.close();
}
// Resolves an arabic_report_font value (from Settings) to the actual CSS font-family name to
// use — checking the built-in fonts first, then any uploaded custom font by its font_key. Falls
// back to the default rather than silently rendering in the wrong font if the key doesn't
// match anything (e.g. a custom font that was since deleted).
async function resolveArabicFontFamily(arabicFontKey) {
  if (ARABIC_FONTS[arabicFontKey]) return ARABIC_FONTS[arabicFontKey].family;
  try {
    const customFonts = await api('/custom-fonts');
    const match = customFonts.find(f => f.font_key === arabicFontKey);
    if (match) return match.family_name;
  } catch (e) { /* fall through to default below */ }
  return ARABIC_FONTS.default.family;
}

// Prints TWO students' Arabic Terminal Reports side by side on one landscape A4 sheet, each
// sized to roughly A5 — the practical way to print a whole class's reports without using a
// full A4 sheet per student. `pairs` is data already fetched for each student:
// [{ student, results, position }, ...] in the order they should appear, paired two-per-page.
async function printArabicTerminalReportsPaired(pairs, term, subjectRows, schoolName, logoUrl, totalInClass, arabicFontKey) {
  const win = window.open('', '_blank');
  const fontFamily = await resolveArabicFontFamily(arabicFontKey);
  const customFontCss = await getCustomFontFaceCss();
  const pages = [];
  for (let i = 0; i < pairs.length; i += 2) {
    const left = pairs[i];
    const right = pairs[i + 1];
    const leftHtml = buildArabicReportBodyHtml(left.student, term, subjectRows, left.results, schoolName, logoUrl, left.position, totalInClass);
    const rightHtml = right
      ? buildArabicReportBodyHtml(right.student, term, subjectRows, right.results, schoolName, logoUrl, right.position, totalInClass)
      : '<div></div>'; // odd student count — leave the second half blank rather than repeat
    pages.push(`<div class="ar-page"><div class="ar-half">${leftHtml}</div><div class="ar-half">${rightHtml}</div></div>`);
  }
  win.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
    <title>كشوف درجات الطلاب</title><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/assets/fonts/arabic-fonts.css">
    <style>
      ${customFontCss}
      @page{size:A4 landscape;margin:6mm;}
      .ar-page{display:flex;gap:6mm;page-break-after:always;}
      .ar-page:last-child{page-break-after:auto;}
      .ar-half{width:50%;}
      ${arabicReportStyle(fontFamily)}
    </style></head><body>
    ${pages.join('')}
    <script>window.print()<\/script></body></html>`);
  win.document.close();
}

// ---------- Class Termly Report (class teacher's narrative report for their class) ----------
async function renderClassTermlyReport() {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="empty-state">Loading…</div>';
  const [allClasses, terms] = await Promise.all([api('/classes?pageSize=200'), api('/terms?pageSize=200')]);
  const isTeacher = state.user.role === 'Teacher';
  // A teacher only ever sees the classes they're actually assigned as class teacher for — the
  // server enforces this too, but there's no point showing a dropdown full of dead-end options.
  const myClasses = isTeacher && state.user.linked_teacher_id
    ? allClasses.rows.filter(c => c.class_teacher_id === state.user.linked_teacher_id)
    : allClasses.rows;

  content.innerHTML = `
    <div class="page-header"><h2>Class Termly Report</h2></div>
    <div class="notice">${isTeacher ? "Write your own class's termly report — a narrative summary of the term (attendance, behaviour, academic progress, general remarks)." : 'Admins can view or write a termly report for any class.'}</div>
    ${isTeacher && myClasses.length === 0 ? '<div class="empty-state">You are not currently assigned as class teacher for any class.</div>' : `
    <div class="card">
      <div class="toolbar">
        <select id="ctr-class"><option value="">Select class…</option>${myClasses.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select>
        <select id="ctr-term"><option value="">Select term…</option>${terms.rows.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('')}</select>
        <button class="btn secondary" id="ctr-load">Load</button>
      </div>
      <div id="ctr-editor-area"></div>
    </div>`}`;

  document.getElementById('ctr-load')?.addEventListener('click', async () => {
    const classId = document.getElementById('ctr-class').value;
    const termId = document.getElementById('ctr-term').value;
    if (!classId || !termId) return alert('Select both a class and a term.');
    const existing = await api(`/class-termly-report?class_id=${classId}&term_id=${termId}`);
    const area = document.getElementById('ctr-editor-area');
    area.innerHTML = `
      <label style="margin-top:14px">Report</label>
      <textarea id="ctr-text" rows="12" placeholder="Write the termly report for this class…">${escapeHtml(existing ? existing.report_text || '' : '')}</textarea>
      ${existing ? `<p class="small-text" style="margin-top:6px">Last updated ${escapeHtml(existing.updated_at)}</p>` : ''}
      <div class="toolbar" style="margin-top:10px">
        <button class="btn gold" id="ctr-save">Save</button>
        <button class="btn secondary" id="ctr-print">🖶 Print</button>
      </div>`;
    document.getElementById('ctr-save').addEventListener('click', async () => {
      try {
        await api('/class-termly-report', { method: 'POST', body: { class_id: Number(classId), term_id: Number(termId), report_text: document.getElementById('ctr-text').value } });
        alert('Saved.');
      } catch (err) { alert(err.message); }
    });
    document.getElementById('ctr-print').addEventListener('click', async () => {
      const cls = myClasses.find(c => c.id === Number(classId)) || allClasses.rows.find(c => c.id === Number(classId));
      const term = terms.rows.find(t => t.id === Number(termId));
      const settings = await api('/public-settings').catch(() => ({}));
      // Show the class's actual assigned teacher on the report, not whoever happens to click Print
      // (which could be an admin printing on the teacher's behalf).
      let teacherName = '—';
      if (cls && cls.class_teacher_id) {
        try { teacherName = (await api(`/teachers/${cls.class_teacher_id}`)).full_name; } catch (e) { /* leave as — */ }
      }
      printClassTermlyReport(cls, term, document.getElementById('ctr-text').value, settings.school_name, teacherName);
    });
  });
}

function printClassTermlyReport(cls, term, reportText, schoolName, teacherName) {
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Class Termly Report</title><link rel="stylesheet" href="/style.css">
    <style>
      body{padding:24px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;}
      .ctr-report{max-width:720px;margin:0 auto;border:2px solid #0f2a4a;padding:24px;}
      .ctr-report h1{text-align:center;color:#0f2a4a;font-size:19px;margin:0 0 2px;}
      .ctr-report h2{text-align:center;color:#c8973a;font-size:14px;font-style:italic;margin:0 0 18px;}
      .ctr-info{display:flex;justify-content:space-between;font-size:13.5px;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #ddd;}
      .ctr-body{white-space:pre-wrap;font-size:14px;line-height:1.7;min-height:200px;}
      .ctr-signature{margin-top:50px;display:flex;justify-content:space-between;font-size:13px;}
      .ctr-signature div{width:45%;text-align:center;border-top:1px solid #333;padding-top:4px;}
    </style></head><body>
    <div class="ctr-report">
      <h1>${escapeHtml(schoolName || 'Nibras Educational Complex')}</h1>
      <h2>Class Termly Report</h2>
      <div class="ctr-info">
        <span><b>Class:</b> ${escapeHtml(cls ? cls.name : '—')}</span>
        <span><b>Term:</b> ${escapeHtml(term ? term.name : '—')}</span>
        <span><b>Class Teacher:</b> ${escapeHtml(teacherName || '—')}</span>
      </div>
      <div class="ctr-body">${escapeHtml(reportText || '')}</div>
      <div class="ctr-signature">
        <div>Class Teacher's Signature</div>
        <div>Date</div>
      </div>
    </div>
    <script>window.print()<\/script></body></html>`);
  win.document.close();
}

// ---------- Promote Students (end-of-year bulk class move) ----------
async function renderPromoteStudents() {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="empty-state">Loading…</div>';
  const classes = (await api('/classes?pageSize=200')).rows;
  content.innerHTML = `
    <div class="page-header"><h2>Promote Students</h2></div>
    <div class="notice">Move a whole class (or a chosen selection of students) up to the next class — typically done once, at the end of the third term.
      This only changes which class each student belongs to; it doesn't touch their results, attendance, or fee history.</div>
    <div class="card">
      <div class="toolbar">
        <select id="promote-from-class"><option value="">From class…</option>${classes.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select>
        <span class="small-text">→</span>
        <select id="promote-to-class"><option value="">To class…</option>${classes.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select>
        <button class="btn secondary" id="promote-load-btn">Load Students</button>
      </div>
      <div id="promote-students-list"></div>
    </div>`;

  document.getElementById('promote-load-btn').addEventListener('click', async () => {
    const fromId = document.getElementById('promote-from-class').value;
    if (!fromId) return alert('Choose the class to promote from.');
    const students = (await api(`/students?class_id=${fromId}&pageSize=500`)).rows;
    const wrap = document.getElementById('promote-students-list');
    wrap.innerHTML = `
      <div class="toolbar" style="margin-top:12px"><label style="font-weight:400;font-size:13px"><input type="checkbox" id="promote-select-all" checked> Select all</label></div>
      <div class="table-wrap"><table><thead><tr><th></th><th>Student ID</th><th>Name</th></tr></thead>
        <tbody>${students.map(s => `<tr><td><input type="checkbox" class="promote-check" data-sid="${s.id}" checked></td><td>${escapeHtml(s.student_id)}</td><td>${escapeHtml(s.first_name)} ${escapeHtml(s.last_name)}</td></tr>`).join('') || '<tr><td colspan=3 class="muted">No students in this class</td></tr>'}</tbody></table></div>
      ${students.length ? `<div class="toolbar" style="margin-top:14px"><button class="btn gold" id="promote-confirm-btn">Promote Selected Students</button></div>` : ''}`;
    document.getElementById('promote-select-all')?.addEventListener('change', (e) => {
      document.querySelectorAll('.promote-check').forEach(cb => { cb.checked = e.target.checked; });
    });
    document.getElementById('promote-confirm-btn')?.addEventListener('click', async () => {
      const toId = document.getElementById('promote-to-class').value;
      if (!toId) return alert('Choose the class to promote them into.');
      const selectedIds = [...document.querySelectorAll('.promote-check:checked')].map(cb => Number(cb.dataset.sid));
      if (!selectedIds.length) return alert('Select at least one student.');
      const toClassName = document.getElementById('promote-to-class').selectedOptions[0].textContent;
      if (!confirm(`Promote ${selectedIds.length} student(s) into "${toClassName}"? This can be undone later by editing each student's class individually, but there's no single "undo" button.`)) return;
      try {
        const result = await api('/students/promote', { method: 'POST', body: { student_ids: selectedIds, to_class_id: Number(toId) } });
        alert(`Promoted ${result.count} student(s) into ${toClassName}.`);
        document.getElementById('promote-load-btn').click();
      } catch (err) { alert(err.message); }
    });
  });
}

boot();
