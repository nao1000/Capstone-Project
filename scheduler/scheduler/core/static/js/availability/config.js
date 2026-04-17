// STATE

// --- New Event Creation ---
let isDragging = false
let startY = 0
let startTop = 0
let activeEvent = null
let activeCol = null
let currentStartMin = 0
let currentEndMin = 0

// --- Selection & Clipboard ---
let selectedEvent = null
let clipboardData = null
let hoveredCol = null
let hoverY = 0

// --- Drag to Move Existing Events ---
let isDraggingEvent = false
let draggedEvent = null
let eventStartTop = 0
let dragStartY = 0

// --- Resize ---
let isResizing = false
let resizeDirection = null // 'top' or 'bottom'
let resizingEvent = null
let resizeOriginalTop = 0
let resizeOriginalHeight = 0
let resizeStartY = 0

// --- Grid Mode ---
let currentGridMode = 'busy'
let gridMode = 'busy'

// --- Role/Section Ranking ---
// Each entry: { key, roleId, sectionId: string|null }
let selectedRanking = []