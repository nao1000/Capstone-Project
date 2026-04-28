// State variables and constants for the scheduler
/** @module Scheduler */

/**
 * The earliest hour displayed on the schedule grid (8 = 8:00 AM).
 *
 * @constant {number}
 */
const START_HOUR = 8

/**
 * The latest hour displayed on the schedule grid (22 = 10:00 PM).
 *
 * @constant {number}
 */
const END_HOUR = 22

/**
 * The visual height in pixels corresponding to a single 15-minute time slot on the grid.
 *
 * @constant {number}
 */
const SLOT_HEIGHT = 15

/**
 * Formatted abbreviations for the days of the week, used for UI display.
 *
 * @constant {Array<string>}
 */
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * Lowercase identifiers for the days of the week, used for data mapping and API payloads.
 *
 * @constant {Array<string>}
 */
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

/**
 * Flag indicating whether the user is currently clicking and dragging on the grid 
 * to create or resize a shift block.
 *
 * @type {boolean}
 */
let isDragging = false

/**
 * The starting vertical pixel offset (Y-coordinate relative to the day column) 
 * when a user begins dragging to create a shift.
 *
 * @type {number}
 */
let startTop = 0

/**
 * A reference to the HTML DOM element representing the shift block currently 
 * being drawn, dragged, or edited.
 *
 * @type {HTMLElement|null}
 */
let activeEvent = null

/**
 * A reference to the HTML DOM element of the specific day column where the 
 * user is currently interacting or dragging.
 *
 * @type {HTMLElement|null}
 */
let activeCol = null

/**
 * The calculated start time of the `activeEvent` being edited, represented in total minutes from midnight.
 *
 * @type {number}
 */
let currentStartMin = 0

/**
 * The calculated end time of the `activeEvent` being edited, represented in total minutes from midnight.
 *
 * @type {number}
 */
let currentEndMin = 0

/**
 * The unique identifier of the role currently selected in the global filter view.
 *
 * @type {string|number|null}
 */
let activeRoleId = null

/**
 * The unique identifier of the specific schedule currently loaded from the database.
 *
 * @type {string|number|null}
 */
let activeScheduleId = null

/**
 * The unique identifier of a worker being explicitly edited (e.g., inside the shift modal).
 *
 * @type {string|number|null}
 */
let editingWorkerId = null

/**
 * The unique identifier of a role that is temporarily being previewed by the user.
 *
 * @type {string|number|null}
 */
let previewedRole = null

/**
 * The unique identifier of the worker whose specific schedule or row is currently in focus.
 *
 * @type {string|number|null}
 */
let activeWorkerId = null 

/**
 * The role ID associated with the `activeWorkerId`.
 *
 * @type {string|number|null}
 */
let activeWorkerRoleId = null