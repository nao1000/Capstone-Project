// CONFIG
/** @file Global state for supervisor related files */
/** @module Supervisor */

/**
 * The starting hour for the schedule grid display (e.g., 8 represents 8:00 AM).
 *
 * @type {number}
 */
const START_HOUR = 8        // 8 AM

/**
 * The ending hour for the schedule grid display (e.g., 19 represents 7:00 PM).
 *
 * @type {number}
 */
const END_HOUR = 19         // 7 PM

/**
 * The total number of hours displayed on the schedule grid.
 *
 * @type {number}
 */
const HOURS_TOTAL = END_HOUR - START_HOUR

/**
 * The height in pixels representing a single 15-minute time slot on the grid.
 *
 * @type {number}
 */
const SLOT_HEIGHT = 10      // 10px = 15 mins

/**
 * The height in pixels representing a full hour on the grid.
 * Matches 4 * SLOT_HEIGHT.
 *
 * @type {number}
 */
const PIXELS_PER_HOUR = 40  // 40px = 1 hour

/**
 * The Cross-Site Request Forgery (CSRF) token retrieved from the document's meta tags.
 * Required for authenticating secure API requests back to the Django server.
 *
 * @type {string|null}
 */
const csrfToken = document
  .querySelector('meta[name="csrf-token"]')
  .getAttribute('content')

// Pull room data from hidden HTML elements rendered by Django

/**
 * A NodeList of DOM elements containing hidden room data attributes rendered by the backend.
 *
 * @type {NodeListOf<HTMLElement>}
 */
const roomElements = document.querySelectorAll('.room-info')

/**
 * An array of parsed room objects extracted from the DOM elements.
 * Each object tracks the room's ID, name, and its scheduled bookings/availability.
 *
 * @type {Array<{id: string, name: string, schedule: Array<Object>}>}
 */
let roomData = Array.from(roomElements).map(el => ({
  id: el.dataset.id,
  name: el.dataset.name,
  schedule: [] // { day: 0, top: 0, height: 60 }
}))

/**
 * Standardized keys representing the days of the week.
 *
 * @type {Array<string>}
 */
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

/**
 * Standardized display labels for the days of the week.
 *
 * @type {Array<string>}
 */
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']