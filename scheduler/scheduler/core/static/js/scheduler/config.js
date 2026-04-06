// State variables and constants for the scheduler

const START_HOUR = 8
const END_HOUR = 18
const SLOT_HEIGHT = 15

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

let isDragging = false
let startTop = 0
let activeEvent = null
let activeCol = null
let currentStartMin = 0
let currentEndMin = 0

let activeRoleId = null
let activeScheduleId = null
let editingWorkerId = null
