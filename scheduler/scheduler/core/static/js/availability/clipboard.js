/** @file Enables copying and pasting of blocks placed on Availability Grid */
/** @module Availability */

/**
 * Sets up global click listeners to handle the selection and deselection 
 * of event blocks on the grid.
 * * @description Manages the {@link selectedEvent} global state. Includes logic 
 * to ignore clicks on UI controls like delete buttons or modals.
 */
function setupSelectionListeners () {
  document.addEventListener('click', e => {
    if (e.target.closest('.delete-x') || e.target.closest('.modal-box')) return

    const eventBlock = e.target.closest('.event-block')

    // Already selected — deselect
    if (selectedEvent && selectedEvent === eventBlock) {
      selectedEvent.classList.remove('selected')
      selectedEvent = null
      return
    }

    // Deselect previous
    if (selectedEvent) {
      selectedEvent.classList.remove('selected')
      selectedEvent = null
    }

    // Select new event
    if (eventBlock && !eventBlock.classList.contains('temp')) {
      selectedEvent = eventBlock
      selectedEvent.classList.add('selected')
    }
  })
}

/**
 * Initializes double-click functionality on the grid body.
 * * @description When an event block is double-clicked, it triggers the 
 * `openEditModal` function.
 */
function setupDoubleClickEdit () {
  const gridBody = document.getElementById('gridBody')

  gridBody.addEventListener('dblclick', e => {
    const eventBlock = e.target.closest('.event-block')
    if (eventBlock && !eventBlock.classList.contains('temp')) {
      openEditModal(eventBlock)
    }
  })
}

/**
 * Sets up keyboard listeners for Copy (Ctrl/Cmd + C) and Paste (Ctrl/Cmd + V).
 * * @description 
 * - **Copy**: Populates {@link clipboardData} with the title, location, and height.
 * - **Paste**: Uses {@link hoveredCol} and {@link hoverY} to calculate the 
 * nearest grid snap point (15-minute increments) and injects a new block.
 * * @requires window.SLOT_HEIGHT
 * @requires window.START_HOUR
 */
function setupKeyboardShortcuts () {
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
      if (
        clipboardData &&
        hoveredCol &&
        !document.getElementById('eventModal').classList.contains('show')
      ) {
        const topPx = Math.floor(hoverY / window.SLOT_HEIGHT) * window.SLOT_HEIGHT

        const startSlotIndex = Math.round(topPx / window.SLOT_HEIGHT)
        const slotsCount = Math.round(clipboardData.heightPx / window.SLOT_HEIGHT)
        const startMin = startSlotIndex * 15 + window.START_HOUR * 60
        const endMin = startMin + slotsCount * 15
        const timeString = `${formatMin(startMin)} - ${formatMin(endMin)}`

        const newEvent = document.createElement('div')
        newEvent.className = 'event-block'
        newEvent.dataset.mode = currentGridMode
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
}