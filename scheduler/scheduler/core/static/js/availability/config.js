/** @file Global state variables tracking interactions, drag-and-drop mechanics, and user preferences on the availability grid. */
/** @module Availability */

// --- New Event Creation ---

/**
 * Indicates if a new event block is currently being drawn.
 * @type {boolean}
 */
let isDragging = false

/**
 * The initial Y-coordinate (relative to the column) where the mouse was clicked to start drawing.
 * @type {number}
 */
let startY = 0

/**
 * The snapped top pixel position of the new event block.
 * @type {number}
 */
let startTop = 0

/**
 * The temporary event DOM element being created or edited.
 * @type {HTMLElement|null}
 */
let activeEvent = null

/**
 * The specific day column DOM element where the new event is being drawn.
 * @type {HTMLElement|null}
 */
let activeCol = null

/**
 * The calculated start time of the active event in minutes since the grid's start hour.
 * @type {number}
 */
let currentStartMin = 0

/**
 * The calculated end time of the active event in minutes since the grid's start hour.
 * @type {number}
 */
let currentEndMin = 0


// --- Selection & Clipboard ---

/**
 * The event block currently selected by the user for copy/paste or deletion.
 * @type {HTMLElement|null}
 */
let selectedEvent = null

/**
 * Temporarily stores event data (name, location, height) during a copy operation.
 * @type {Object|null}
 */
let clipboardData = null

/**
 * The day column currently under the user's cursor (used for pasting or dragging between days).
 * @type {HTMLElement|null}
 */
let hoveredCol = null

/**
 * The vertical pixel position of the cursor within the currently hovered column.
 * @type {number}
 */
let hoverY = 0


// --- Drag to Move Existing Events ---

/**
 * True when an existing event block is being moved to a new time or day.
 * @type {boolean}
 */
let isDraggingEvent = false

/**
 * The existing event block DOM element currently being dragged.
 * @type {HTMLElement|null}
 */
let draggedEvent = null

/**
 * The original top pixel position of the event before the drag started.
 * @type {number}
 */
let eventStartTop = 0

/**
 * The initial client Y-coordinate where the user clicked to start dragging the event.
 * @type {number}
 */
let dragStartY = 0


// --- Resize ---

/**
 * True when an event block is currently being resized using its top or bottom handles.
 * @type {boolean}
 */
let isResizing = false

/**
 * Specifies which handle is being dragged during a resize operation.
 * @type {('top'|'bottom'|null)}
 */
let resizeDirection = null

/**
 * The event block DOM element currently being resized.
 * @type {HTMLElement|null}
 */
let resizingEvent = null

/**
 * The original top pixel position of the event before resizing started.
 * @type {number}
 */
let resizeOriginalTop = 0

/**
 * The original pixel height of the event before resizing started.
 * @type {number}
 */
let resizeOriginalHeight = 0

/**
 * The initial client Y-coordinate where the resize drag began.
 * @type {number}
 */
let resizeStartY = 0


// --- Grid Mode ---

/**
 * Tracks the active drawing mode for the grid (e.g., 'busy' or 'preferred').
 * @type {string}
 */
let currentGridMode = 'busy'

/**
 * Secondary or fallback tracker for the current grid mode.
 * @type {string}
 */
let gridMode = 'busy'


// --- Role/Section Ranking ---

/**
 * An ordered array tracking the user's selected role and section priorities.
 * Each entry tracks a specific hierarchy choice.
 * @type {Array<{key: string, roleId: string, sectionId: string|null}>}
 */
let selectedRanking = []