export const START_HOUR = 8;
export const END_HOUR = 19;
export const HOURS_TOTAL = END_HOUR - START_HOUR;
export const SLOT_HEIGHT = 10;
export const PIXELS_PER_HOUR = 40;

export const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

// Mutable shared state
export let roomData = [];
export const setRoomData = (data) => { roomData = data; };