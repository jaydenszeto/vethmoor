/**
 * Live gameplay configuration the simulation reads each tick. The UI writes
 * here via applySettings() (the settings panel's GameAPI path) so engine code
 * never imports the React store.
 */

export interface GameSettings {
  renderHeight: 270 | 360 | 450;
  mouseSens: number; // radians per px
  invertY: boolean;
  fogMult: number; // 0.5 .. 1.5
  volMaster: number;
  volMusic: number;
  volSfx: number;
  volAmbient: number;
}

export const DEFAULT_SETTINGS: GameSettings = {
  renderHeight: 360,
  mouseSens: 0.0023,
  invertY: false,
  fogMult: 1,
  volMaster: 0.8,
  volMusic: 0.55,
  volSfx: 0.9,
  volAmbient: 0.7,
};

export const config: GameSettings = { ...DEFAULT_SETTINGS };

const LS_KEY = 'vethmoor-settings';

export function applySettings(partial: Partial<GameSettings>): void {
  Object.assign(config, partial);
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(config));
  } catch {
    /* private mode etc. — settings just won't persist */
  }
}

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) Object.assign(config, JSON.parse(raw) as Partial<GameSettings>);
  } catch {
    /* corrupted settings → defaults */
  }
  return config;
}
