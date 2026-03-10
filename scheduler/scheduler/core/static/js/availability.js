

// Debugging: This will prove what ID Django is actually sending
console.log('DJANGO SENT ID:', window.TEAM_ID)

window.START_HOUR = 8
window.END_HOUR = 22
window.SLOT_HEIGHT = 25

// 3. Load Saved Data
// const dataElement = document.getElementById('availability-data')
// if (dataElement) {
//   window.SAVED_AVAILABILITY = JSON.parse(dataElement.textContent)
// }

// STATE
let isDragging = false
let startY = 0
let startTop = 0
let activeEvent = null
let activeCol = null
let currentStartMin = 0
let currentEndMin = 0
// NEW STATE VARIABLES
let selectedEvent = null
let clipboardData = null
let hoveredCol = null
let hoverY = 0

// DRAGGING EXISTING EVENTS
let isDraggingEvent = false
let draggedEvent = null
let eventStartTop = 0
let dragStartY = 0

// Resizing Variables
let isResizing = false
let resizeDirection = null // Will be 'top' or 'bottom'
let resizingEvent = null
let resizeOriginalTop = 0
let resizeOriginalHeight = 0
let resizeStartY = 0

document.addEventListener('DOMContentLoaded', () => {
  initLayout()
  setupDragListeners()
  addSavedEventsToGrid()
  window.addEventListener('resize', initLayout)
})
// --- COPY, PASTE, & EDIT TRACKING ---

// 2. Select & Edit Listeners
document.addEventListener('DOMContentLoaded', () => {
  const gridBody = document.getElementById('gridBody')

  // Single click to Select
  document.addEventListener('click', e => {
    // Ignore the delete button or clicks inside the modal
    if (e.target.closest('.delete-x') || e.target.closest('.modal-box')) return

    const eventBlock = e.target.closest('.event-block')

    // Scenario A: We clicked the event that is ALREADY selected -> Turn it off
    if (selectedEvent && selectedEvent === eventBlock) {
      selectedEvent.classList.remove('selected')
      selectedEvent = null
      return // Stop here!
    }

    // Scenario B: We clicked something else -> Turn off the previously selected event
    if (selectedEvent) {
      selectedEvent.classList.remove('selected')
      selectedEvent = null
    }

    // Scenario C: We clicked a NEW event -> Turn it on
    if (eventBlock && !eventBlock.classList.contains('temp')) {
      selectedEvent = eventBlock
      selectedEvent.classList.add('selected')
    }
  })

  // Double click to Edit
  gridBody.addEventListener('dblclick', e => {
    const eventBlock = e.target.closest('.event-block')
    if (eventBlock && !eventBlock.classList.contains('temp')) {
      openEditModal(eventBlock)
    }
  })
})

// 3. Keyboard Shortcuts (Ctrl+C / Ctrl+V)
document.addEventListener('keydown', e => {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const modifier = isMac ? e.metaKey : e.ctrlKey

  // COPY
  if (modifier && e.key.toLowerCase() === 'c') {
    if (selectedEvent) {
      clipboardData = {
        name: selectedEvent.querySelector('.event-title').textContent,
        loc: selectedEvent.querySelector('.event-loc')
          ? selectedEvent.querySelector('.event-loc').textContent
          : '',
        heightPx: parseFloat(selectedEvent.style.height)
      }
      // Brief visual flash to confirm copy
      selectedEvent.style.opacity = '0.5'
      setTimeout(() => (selectedEvent.style.opacity = '1'), 150)
    }
  }

  // PASTE
  if (modifier && e.key.toLowerCase() === 'v') {
    // Only paste if we have data, are hovering over a day, and the modal is closed
    if (
      clipboardData &&
      hoveredCol &&
      !document.getElementById('eventModal').classList.contains('show')
    ) {
      // Snap the pasted event to the grid based on mouse position
      const topPx = Math.floor(hoverY / window.SLOT_HEIGHT) * window.SLOT_HEIGHT

      // Calculate Times
      const startSlotIndex = Math.round(topPx / window.SLOT_HEIGHT)
      const slotsCount = Math.round(clipboardData.heightPx / window.SLOT_HEIGHT)
      const startMin = startSlotIndex * 15 + window.START_HOUR * 60
      const endMin = startMin + slotsCount * 15
      const timeString = `${formatMin(startMin)} - ${formatMin(endMin)}`

      // Build Element
      // Build Element
      const newEvent = document.createElement('div')
      newEvent.className = 'event-block'
      newEvent.style.top = `${topPx}px`
      newEvent.style.height = `${clipboardData.heightPx}px`

      let html = `
                <div class="resize-handle top"></div>
                <div class="delete-x" onclick="removeEventBlock(event, this)">×</div>
                <div class="event-content">
                    <div class="event-title">${clipboardData.name}</div>
                    <div class="event-time">${timeString}</div>`
      if (clipboardData.loc) {
        html += `<div class="event-loc">${clipboardData.loc}</div>`
      }
      html += `</div>
                <div class="resize-handle bottom"></div>`

      newEvent.innerHTML = html
      hoveredCol.appendChild(newEvent)
    }
  }
})

// --- DRAG TO MOVE EXISTING EVENTS ---

document.addEventListener('DOMContentLoaded', () => {
  const gridBody = document.getElementById('gridBody')

  // 1. Grab the event
  // 1. Grab the event (UPDATED)
  gridBody.addEventListener(
    'mousedown',
    e => {
      if (e.target.closest('.delete-x')) return // Ignore delete button

      const eventBlock = e.target.closest('.event-block')
      if (eventBlock && !eventBlock.classList.contains('temp')) {
        // --- THE FIX ---
        isDragging = false // Force "Create Mode" off immediately
        e.stopPropagation() // Hide the click from the background column
        // ---------------

        isDraggingEvent = true
        draggedEvent = eventBlock

        // Record starting positions
        dragStartY = e.clientY
        eventStartTop = parseFloat(eventBlock.style.top) || 0

        // Visual feedback
        draggedEvent.style.opacity = '0.7'
        draggedEvent.style.cursor = 'grabbing'
        draggedEvent.classList.add('selected')

        e.preventDefault()
      }
    },
    true
  ) // <-- 'true' intercepts the click before the column sees it
})

// 2. Move the event
// 2. Move the event OR Draw a new event
// document.addEventListener('mousemove', (e) => {

//     // SCENARIO A: We are dragging an EXISTING event
//     if (isDraggingEvent && draggedEvent) {
//         const deltaY = e.clientY - dragStartY;
//         let newTop = eventStartTop + deltaY;

//         // Snap to grid (15 min intervals)
//         newTop = Math.round(newTop / window.SLOT_HEIGHT) * window.SLOT_HEIGHT;

//         // Prevent dragging above the top of the calendar
//         if (newTop < 0) newTop = 0;

//         draggedEvent.style.top = `${newTop}px`;

//         // Move to a new day column if hovering over one
//         if (hoveredCol && hoveredCol !== draggedEvent.parentElement) {
//             hoveredCol.appendChild(draggedEvent);
//         }
//     }

//     // SCENARIO B: We are drawing a NEW event (from scratch)
//     if (isDragging && activeEvent && activeCol) {
//         // 1. Get current mouse position relative to the column
//         const rect = activeCol.getBoundingClientRect();
//         let currentY = e.clientY - rect.top;

//         // Constrain dragging so it doesn't break out of the calendar top/bottom
//         currentY = Math.max(0, Math.min(currentY, rect.height));

//         // 2. Calculate which 15-min slots we started in, and which one we are currently in
//         const startSlot = Math.floor(startY / window.SLOT_HEIGHT);
//         const currentSlot = Math.floor(currentY / window.SLOT_HEIGHT);

//         // 3. The 'top' is ALWAYS whichever slot is higher up the page (the smaller number)
//         const topSlot = Math.min(startSlot, currentSlot);

//         // 4. The 'bottom' is ALWAYS whichever slot is further down the page (the larger number)
//         const bottomSlot = Math.max(startSlot, currentSlot);

//         // 5. Calculate the final pixels
//         const newTop = topSlot * window.SLOT_HEIGHT;
//         const newHeight = ((bottomSlot - topSlot) + 1) * window.SLOT_HEIGHT;

//         // 6. Apply to the event block!
//         activeEvent.style.top = `${newTop}px`;
//         activeEvent.style.height = `${newHeight}px`;
//     }
// });
// 3. Drop the event (UNIFIED MOUSEUP)
document.addEventListener('mouseup', () => {
  // Scenario 1: We were dragging an EXISTING event
  if (isDraggingEvent && draggedEvent) {
    draggedEvent.style.opacity = ''
    draggedEvent.style.cursor = 'grab'

    updateEventTimeText(draggedEvent)

    isDraggingEvent = false
    draggedEvent = null

    return // <-- Prevents the New Shift modal
  }

  // Scenario 2: We were drawing a NEW event
  if (isDragging) {
    isDragging = false
    openModal()
  }
})

// --- HELPER: UPDATE TIME TEXT AFTER DRAG ---
function updateEventTimeText (block) {
  const topPx = parseFloat(block.style.top)
  const heightPx = parseFloat(block.style.height)

  const startSlotIndex = Math.round(topPx / window.SLOT_HEIGHT)
  const slotsCount = Math.round(heightPx / window.SLOT_HEIGHT)

  const startMin = startSlotIndex * 15 + window.START_HOUR * 60
  const endMin = startMin + slotsCount * 15

  const timeDiv = block.querySelector('.event-time')
  if (timeDiv) {
    timeDiv.textContent = `${formatMin(startMin)} - ${formatMin(endMin)}`
  }
}

// 4. Function to open the Edit Modal
function openEditModal (block) {
  // Re-use activeEvent so your existing saveEvent() handles the overwrite automatically
  activeEvent = block

  const modal = document.getElementById('eventModal')
  modal.classList.add('show')

  // Extract existing text
  const title = block.querySelector('.event-title').textContent
  const locNode = block.querySelector('.event-loc')
  const loc = locNode ? locNode.textContent : ''

  // Populate Inputs
  document.getElementById('modalEventName').value = title
  document.getElementById('modalLocation').value = loc

  // Calculate & Display Times
  const topPx = parseFloat(block.style.top)
  const heightPx = parseFloat(block.style.height)
  const startSlotIndex = Math.round(topPx / window.SLOT_HEIGHT)
  const slotsCount = Math.round(heightPx / window.SLOT_HEIGHT)

  currentStartMin = startSlotIndex * 15 + window.START_HOUR * 60
  currentEndMin = currentStartMin + slotsCount * 15

  document.getElementById('modalTimeDisplay').textContent = `${formatMin(
    currentStartMin
  )} - ${formatMin(currentEndMin)} (${slotsCount * 15} mins)`
}

async function saveAllPreferences () {
  console.log(window.TEAM_ID)
  const events = document.querySelectorAll('.event-block:not(.temp)')
  const eventData = []
  events.forEach(ev => {
    const day = ev.parentElement.dataset.day
    const topPx = parseFloat(ev.style.top)
    const heightPx = parseFloat(ev.style.height)

    const startSlotIndex = Math.round(topPx / window.SLOT_HEIGHT)
    const slotsCount = Math.round(heightPx / window.SLOT_HEIGHT)

    const startMin = startSlotIndex * 15 + window.START_HOUR * 60
    const endMin = startMin + slotsCount * 15

    eventData.push({
      name: ev.querySelector('.event-title').textContent,
      location: ev.querySelector('.event-loc')
        ? ev.querySelector('.event-loc').textContent
        : '',
      day: parseInt(day),
      start_min: startMin,
      end_min: endMin
    })
  })

  try {
    const response = await fetch(
      `/api/team/${window.TEAM_ID}/save-availability/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify({ events: eventData })
      }
    )
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    // SHOW THE POPUP ON SUCCESS
    document.getElementById('savePopupModal').classList.add('show')
  } catch (error) {
    console.error('Error saving events:', error)
    alert('There was an error saving the schedule. Please try again.')
  }
}

// Function to close the success popup
function closeSavePopup () {
  document.getElementById('savePopupModal').classList.remove('show')
}

function getCookie (name) {
  let cookieValue = null
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';')
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim()
      if (cookie.substring(0, name.length + 1) === name + '=') {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1))
        break
      }
    }
  }
  return cookieValue
}

function initLayout () {
  fitGridToContainer()
  drawTimeLabels()
}

function addSavedEventsToGrid () {
  if (!window.SAVED_AVAILABILITY) return

  // 1. Map string days (from DB) to integer indices (for HTML)
  const dayStringToInt = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6
  }

  window.SAVED_AVAILABILITY.forEach(item => {
    // 2. Find the correct column
    const dayKey = (item.day || '').toLowerCase()
    const dayIndex = dayStringToInt[dayKey]

    if (dayIndex === undefined) return // Skip invalid days
    const dayCol = document.querySelector(`.day-col[data-day="${dayIndex}"]`)
    if (!dayCol) return

    // 3. Calculate Time (This defines topPx and heightPx)
    const startParts = item.start.split(':')
    const endParts = item.end.split(':')

    // Convert "09:30" or "19:45" to total minutes from midnight
    const startMin = parseInt(startParts[0]) * 60 + parseInt(startParts[1])
    const endMin = parseInt(endParts[0]) * 60 + parseInt(endParts[1])

    // Adjust relative to the start of the calendar (e.g. 8:00 AM)
    const totalStartMin = startMin - START_HOUR * 60
    const totalEndMin = endMin - START_HOUR * 60

    if (totalStartMin < 0) return // Skip events before start time

    // Calculate Pixel Position
    const topPx = (totalStartMin / 15) * SLOT_HEIGHT
    const heightPx = ((totalEndMin - totalStartMin) / 15) * SLOT_HEIGHT

    // 4. Create the Element
    const eventBlock = document.createElement('div')
    eventBlock.className = 'event-block'
    eventBlock.style.top = `${topPx}px`
    eventBlock.style.height = `${heightPx}px`

    const loc = item.building || item.location || ''

    // 5. Set HTML (Including the Delete 'X' button)
    // 🔥 THE FIX IS HERE: We swapped ${item.start} for ${formatMin(startMin)}
    eventBlock.innerHTML = `
            <div class="delete-x" onclick="removeEventBlock(event, this)">×</div>
            <div class="event-content">
                <div class="event-title">${item.name || 'Busy'}</div>
                <div class="event-time">${formatMin(startMin)} - ${formatMin(
      endMin
    )}</div>
                ${loc ? `<div class="event-loc">${loc}</div>` : ''}
            </div>`

    dayCol.appendChild(eventBlock)
  })
}
// 1. CALCULATE PERFECT FIT
function fitGridToContainer () {
  const container = document.getElementById('scrollContainer')
  const availableHeight = container.clientHeight

  const totalHours = END_HOUR - START_HOUR
  const totalSlots = totalHours * 4 // 15 min slots

  // Calculate height per slot
  SLOT_HEIGHT = availableHeight / totalSlots

  // Set CSS variable for background lines
  document.documentElement.style.setProperty(
    '--slot-height',
    `${SLOT_HEIGHT}px`
  )
}

function removeEventBlock (e, xButton) {
  // 1. Stop the click from passing through to the event block
  // (This prevents the Modal from opening when you just want to delete)
  e.stopPropagation()

  // 2. Optional: Confirm dialog
  if (!confirm('Remove this shift?')) return

  // 3. Find the parent event-block and remove it
  const block = xButton.closest('.event-block')
  if (block) {
    block.remove()
  }
}

// 2. DRAW TIME LABELS
function drawTimeLabels () {
  const timeCol = document.getElementById('timeColumn')
  timeCol.innerHTML = '' // Clear

  const totalHours = END_HOUR - START_HOUR

  for (let h = START_HOUR; h <= END_HOUR; h++) {
    // Don't draw the very last label at the bottom edge if it looks messy
    if (h === END_HOUR) continue

    const label = document.createElement('div')
    label.className = 'time-label'

    const suffix = h >= 12 ? 'PM' : 'AM'
    const displayH = h > 12 ? h - 12 : h === 0 || h === 12 || h === 24 ? 12 : h
    label.textContent = `${displayH} ${suffix}`

    // Position based on percentage
    const percentTop = ((h - START_HOUR) / totalHours) * 100
    label.style.top = `${percentTop}%`

    timeCol.appendChild(label)
  }
}

// 3. DRAG & DROP LOGIC
function setupDragListeners () {
  const dayCols = document.querySelectorAll('.day-col')

  // 1. MOUSEDOWN (Keep exactly as you have it)
  dayCols.forEach(col => {
    col.addEventListener('mousedown', e => {
      if (e.target.closest('.event-block')) return // Ignore clicks on events

      isDragging = true
      activeCol = e.target.closest('.day-col')

      const rect = activeCol.getBoundingClientRect()
      startY = e.clientY - rect.top // <-- This is perfect
      const relativeY = e.clientY - rect.top

      // Snap to grid
      startTop = Math.floor(relativeY / SLOT_HEIGHT) * SLOT_HEIGHT

      // Visual feedback
      activeEvent = document.createElement('div')
      activeEvent.className = 'event-block temp'
      activeEvent.style.top = `${startTop}px`
      activeEvent.style.height = `${SLOT_HEIGHT}px`
      activeEvent.innerHTML = `<div class="event-content"><div class="event-title">New Shift</div></div>`

      col.appendChild(activeEvent)
    })
  })

  // 👇 2. MOUSEMOVE (REPLACE YOUR OLD ONE WITH THIS) 👇
  // 👑 THE MASTER MOUSEMOVE LISTENER 👑
  document.addEventListener('mousemove', e => {
    // --- JOB 1: Track hovering for pasting ---
    const col = e.target.closest('.day-col')
    if (col) {
      hoveredCol = col
      const rect = col.getBoundingClientRect()
      hoverY = e.clientY - rect.top
    } else {
      hoveredCol = null
    }

    // --- JOB 2: Dragging an EXISTING event ---
    if (isDraggingEvent && draggedEvent) {
      const deltaY = e.clientY - dragStartY
      let newTop = eventStartTop + deltaY

      // Snap to grid (15 min intervals)
      newTop = Math.round(newTop / window.SLOT_HEIGHT) * window.SLOT_HEIGHT

      // Prevent dragging above the top of the calendar
      if (newTop < 0) newTop = 0

      draggedEvent.style.top = `${newTop}px`

      // Move to a new day column if hovering over one
      if (hoveredCol && hoveredCol !== draggedEvent.parentElement) {
        hoveredCol.appendChild(draggedEvent)
      }
    }

    // --- JOB 3: Drawing a NEW event (Up & Down!) ---
    if (isDragging && activeEvent && activeCol) {
      const rect = activeCol.getBoundingClientRect()
      let currentY = e.clientY - rect.top

      // Constrain dragging so it doesn't break out of the calendar
      currentY = Math.max(0, Math.min(currentY, rect.height))

      // Figure out grid slots
      const startSlot = Math.floor(startY / window.SLOT_HEIGHT)
      const currentSlot = Math.floor(currentY / window.SLOT_HEIGHT)

      // Math.min/max automatically handles dragging UP or DOWN
      const topSlot = Math.min(startSlot, currentSlot)
      const bottomSlot = Math.max(startSlot, currentSlot)

      // Apply the math to the visual block
      const newTop = topSlot * window.SLOT_HEIGHT
      const newHeight = (bottomSlot - topSlot + 1) * window.SLOT_HEIGHT

      activeEvent.style.top = `${newTop}px`
      activeEvent.style.height = `${newHeight}px`
    }
  })
}

// 4. MODAL & SAVE LOGIC
function openModal () {
  const modal = document.getElementById('eventModal')
  modal.classList.add('show')

  document.getElementById('modalEventName').value = ''
  document.getElementById('modalLocation').value = ''
  document.getElementById('modalEventName').focus()

  // Calculate Times for Display
  const topPx = parseFloat(activeEvent.style.top)
  const heightPx = parseFloat(activeEvent.style.height)

  const startSlotIndex = Math.round(topPx / SLOT_HEIGHT)
  const slotsCount = Math.round(heightPx / SLOT_HEIGHT)

  currentStartMin = startSlotIndex * 15 + START_HOUR * 60
  currentEndMin = currentStartMin + slotsCount * 15

  document.getElementById('modalTimeDisplay').textContent = `${formatMin(
    currentStartMin
  )} - ${formatMin(currentEndMin)} (${slotsCount * 15} mins)`
}

function closeModal () {
  document.getElementById('eventModal').classList.remove('show')
  if (activeEvent && activeEvent.classList.contains('temp')) {
    activeEvent.remove()
  }
  activeEvent = null
}

function saveEvent () {
  // ... existing variable definitions ...
  const name = document.getElementById('modalEventName').value || 'Shift'
  const location = document.getElementById('modalLocation').value
  const timeString = `${formatMin(currentStartMin)} - ${formatMin(
    currentEndMin
  )}`

  // ... size calculations ...
  const heightPx = parseFloat(activeEvent.style.height)
  const isSmall = heightPx < SLOT_HEIGHT * 2.5

  if (activeEvent) {
    activeEvent.classList.remove('temp')

    // UPDATED HTML STRING BELOW:
    let html = `
            <div class="delete-x" onclick="removeEventBlock(event, this)">×</div>
            <div class="event-content">
                <div class="event-title">${name}</div>
                <div class="event-time">${timeString}</div>`

    if (!isSmall && location) {
      html += `<div class="event-loc">${location}</div>`
    }

    html += `</div>`
    activeEvent.innerHTML = html
  }

  document.getElementById('eventModal').classList.remove('show')
  activeEvent = null
}

function formatMin (totalMinutes) {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  const suffix = h >= 12 ? 'PM' : 'AM'
  const displayH = h > 12 ? h - 12 : h === 0 || h === 12 || h === 24 ? 12 : h
  const displayM = m < 10 ? '0' + m : m
  return `${displayH}:${displayM} ${suffix}`
}
