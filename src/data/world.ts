/** World-scale constants. Changing these invalidates saves and all gen tests. */

export const DEFAULT_WORLD_SEED = 'VETHMOOR-1';

export const CHUNK_SIZE = 128; // meters
export const WORLD_CHUNKS = 96; // chunks per side
export const WORLD_SIZE = CHUNK_SIZE * WORLD_CHUNKS; // 12288 m

export const SEA_LEVEL = 0;

/** Collision/height grid resolution inside a chunk (2 m). */
export const GRID_STEP = 2;
export const GRID_VERTS = CHUNK_SIZE / GRID_STEP + 1; // 65 per side (core)

export const VOLCANO_X = WORLD_SIZE / 2;
export const VOLCANO_Z = WORLD_SIZE / 2;
export const VOLCANO_RADIUS = 3400; // influence radius for volcanism field
export const VOLCANO_HEIGHT = 640;

/** Streaming. */
export const LOAD_RADIUS = 5; // chunks (Chebyshev)
export const UNLOAD_RADIUS = 6.5;
export const LOD_BY_RING = [0, 0, 1, 2, 2, 3] as const; // index = ring, value = LOD
export const LOD_STEP = [2, 4, 8, 16] as const; // meters between verts per LOD
export const SKIRT_DROP = 1.5;

/** Time: 30 game-seconds per real second → 48-minute day. */
export const TIMESCALE = 30;
export const DAWN_HOUR = 6;
export const DUSK_HOUR = 20;
export const NEW_GAME_HOUR = 17.4;
export const NEW_GAME_DAY = 1;

/** Player capsule. */
export const PLAYER_RADIUS = 0.4;
export const PLAYER_HEIGHT = 1.7;
export const EYE_HEIGHT = 1.6;
export const STEP_UP = 0.45;
export const GRAVITY = 20;
export const JUMP_V0 = 6.5;
export const TERMINAL_V = 40;
export const SWIM_DEPTH = 1.25; // feet below sea level → swim mode

export const CAMERA_FAR = 1200;
