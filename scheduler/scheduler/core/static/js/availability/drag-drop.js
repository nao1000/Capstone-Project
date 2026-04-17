// DRAG & DROP

function setupDragListeners () {
  const dayCols = document.querySelectorAll('.day-col')

  // --- 1. MOUSEDOWN on a day column: Start drawing a new event ---
  dayCols.forEach(col => {
    col.addEventListener('mousedown', e => {
      if (e.target.closest('.event-block')) return // Ignore clicks on existing events

      isDragging = true
      activeCol = e.target.closest('.day-col')

      const rect = activeCol.getBoundingClientRect()
      startY = e.clientY - rect.top
      const relativeY = e.clientY - rect.top

      // Snap to grid
      startTop = Math.floor(relativeY / SLOT_HEIGHT) * SLOT_HEIGHT

      // Temporary visual block
      activeEvent = document.createElement('div')
      activeEvent.className = 'event-block temp'
      activeEvent.dataset.mode = currentGridMode
      activeEvent.style.top = `${startTop}px`
      activeEvent.style.height = `${SLOT_HEIGHT}px`
      activeEvent.innerHTML = `<div class="event-content"><div class="event-title">New Shift</div></div>`

      col.appendChild(activeEvent)
    })
  })

  // --- 2. MOUSEDOWN on an existing event: Start dragging it ---
  const gridBody = document.getElementById('gridBody')

  gridBody.addEventListener(
    'mousedown',
    e => {
      if (e.target.closest('.delete-x')) return

      const eventBlock = e.target.closest('.event-block')
      if (eventBlock && !eventBlock.classList.contains('temp')) {
        isDragging = false // Cancel "create mode"
        e.stopPropagation()

        isDraggingEvent = true
        draggedEvent = eventBlock
        dragStartY = e.clientY
        eventStartTop = parseFloat(eventBlock.style.top) || 0

        draggedEvent.style.opacity = '0.7'
        draggedEvent.style.cursor = 'grabbing'
        draggedEvent.classList.add('selected')

        e.preventDefault()
      }
    },
    true // Capture phase — intercepts before the column sees it
  )

  // --- 3. MOUSEMOVE: Master listener for hover tracking, drag-move, and draw ---
  document.addEventListener('mousemove', e => {
    // Job 1: Track which column the mouse is hovering over (for paste)
    const col = e.target.closest('.day-col')
    if (col) {
      hoveredCol = col
      const rect = col.getBoundingClientRect()
      hoverY = e.clientY - rect.top
    } else {
      hoveredCol = null
    }

    // Job 2: Move an existing event to a new position / column
    if (isDraggingEvent && draggedEvent) {
      const deltaY = e.clientY - dragStartY
      let newTop = eventStartTop + deltaY

      newTop = Math.round(newTop / window.SLOT_HEIGHT) * window.SLOT_HEIGHT
      if (newTop < 0) newTop = 0

      draggedEvent.style.top = `${newTop}px`

      if (hoveredCol && hoveredCol !== draggedEvent.parentElement) {
        hoveredCol.appendChild(draggedEvent)
      }
    }

    // Job 3: Resize a new event block being drawn (supports drag up or down)
    if (isDragging && activeEvent && activeCol) {
      const rect = activeCol.getBoundingClientRect()
      let currentY = e.clientY - rect.top

      currentY = Math.max(0, Math.min(currentY, rect.height))

      const startSlot = Math.floor(startY / window.SLOT_HEIGHT)
      const currentSlot = Math.floor(currentY / window.SLOT_HEIGHT)

      const topSlot = Math.min(startSlot, currentSlot)
      const bottomSlot = Math.max(startSlot, currentSlot)

      const newTop = topSlot * window.SLOT_HEIGHT
      const newHeight = (bottomSlot - topSlot + 1) * window.SLOT_HEIGHT

      activeEvent.style.top = `${newTop}px`
      activeEvent.style.height = `${newHeight}px`
    }
  })

  // --- 4. MOUSEUP: Finalize whichever drag operation was in progress ---
  document.addEventListener('mouseup', () => {
    // Scenario A: Finished moving an existing event
    if (isDraggingEvent && draggedEvent) {
      draggedEvent.style.opacity = ''
      draggedEvent.style.cursor = 'grab'
      updateEventTimeText(draggedEvent)

      isDraggingEvent = false
      draggedEvent = null
      return // Prevent new-shift modal from opening
    }

    // Scenario B: Finished drawing a new event
    if (isDragging) {
      isDragging = false
      if (currentGridMode === 'preferred') {
        finalizePreferredEvent()
      } else {
        openModal()
      }
    }
  })
}