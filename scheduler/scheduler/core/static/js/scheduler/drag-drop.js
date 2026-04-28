/** @file Event listeners and constraints for drag-and-drop shift creation on the schedule grid. */
/** @module Scheduler */

/**
 * Initializes mouse event listeners (mousedown, mousemove, mouseup) to enable
 * click-and-drag creation of new shift blocks directly on the schedule grid.
 * Handles snapping to time slots, dynamic height adjustment during the drag,
 * and invoking the event creation modal upon completion.
 * Reads and writes `isDragging`, `activeCol`, `activeEvent`, `startTop`, and `activeRoleId`.
 *
 * @requires getMaxHeightBeforeObstruction
 * @requires openModal
 * @requires window.SLOT_HEIGHT
 * @requires window.START_HOUR
 * @requires window.DAY_KEYS
 */
function setupDragListeners () {
  const mainGrid = document.getElementById('mainGrid')

  mainGrid.addEventListener('mousedown', e => {
    const col = e.target.closest('.day-col')
    if (!col || e.target.closest('.event-block')) return

    isDragging = true
    activeCol = col

    const rect = col.getBoundingClientRect()
    const relativeY = e.clientY - rect.top

    startTop = Math.floor(relativeY / SLOT_HEIGHT) * SLOT_HEIGHT

    activeEvent = document.createElement('div')
    activeEvent.className = 'event-block shift-block temp'
    activeEvent.style.top = `${startTop}px`
    activeEvent.style.height = `${SLOT_HEIGHT}px`
    activeEvent.innerHTML = `<div class="event-content"><div class="event-title">New Shift</div></div>`

    col.appendChild(activeEvent)
  })

  document.addEventListener('mousemove', e => {
    if (!isDragging || !activeEvent || !activeCol) return

    const rect = activeCol.getBoundingClientRect()
    const currentRelativeY = e.clientY - rect.top

    let newHeight =
      Math.floor(currentRelativeY / SLOT_HEIGHT) * SLOT_HEIGHT -
      startTop +
      SLOT_HEIGHT
    if (newHeight < SLOT_HEIGHT) newHeight = SLOT_HEIGHT

    if (activeRoleId) {
      const maxHeight = getMaxHeightBeforeObstruction(
        activeCol,
        startTop,
        newHeight
      )
      newHeight = maxHeight
    }
    activeEvent.style.height = `${newHeight}px`
  })

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false

      const finalHeight = parseInt(activeEvent.style.height, 10)
      const dayIndex = activeCol.dataset.day
      const dayKey = DAY_KEYS[parseInt(dayIndex)]

      const startMin = (startTop / SLOT_HEIGHT) * 15 + START_HOUR * 60
      const endMin = startMin + (finalHeight / SLOT_HEIGHT) * 15

      const newShift = {
        day: dayKey,
        start_min: startMin,
        end_min: endMin,
        role_id: activeRoleId || null
      }

      openModal(newShift) // localSchedule.saveOne happens inside modal on confirm
    }
  })
}

/**
 * Calculates the maximum allowable pixel height for a dragged event block to
 * prevent it from visually and logically overlapping with hard schedule obstructions.
 *
 * @param {HTMLElement} col - The day column DOM element where the drag is occurring.
 * @param {number} startTopPx - The top Y offset (in pixels) where the event block starts.
 * @param {number} desiredHeight - The requested height (in pixels) based on current mouse coordinates.
 * @returns {number} The permitted height in pixels. If an obstruction is in the path, returns
 *   the height exactly up to the obstruction (minimum 1 slot). Otherwise returns `desiredHeight`.
 */
function getMaxHeightBeforeObstruction (col, startTopPx, desiredHeight) {
  const dayIndex = col.dataset.day
  const dayKey = DAY_KEYS[parseInt(dayIndex)]

  const obstructions =
    typeof window.OBSTRUCTIONS === 'string'
      ? JSON.parse(window.OBSTRUCTIONS)
      : window.OBSTRUCTIONS

  const eventStartMin = (startTopPx / SLOT_HEIGHT) * 15 + START_HOUR * 60
  const eventEndMin = eventStartMin + (desiredHeight / SLOT_HEIGHT) * 15

  const blocking = obstructions.filter(
    o =>
      o.role_id === activeRoleId &&
      o.days.includes(dayKey) &&
      o.start_min >= eventStartMin &&
      o.start_min < eventEndMin
  )

  if (blocking.length === 0) return desiredHeight

  const nearestStart = Math.min(...blocking.map(o => o.start_min))
  const maxHeight = ((nearestStart - eventStartMin) / 15) * SLOT_HEIGHT
  return Math.max(maxHeight, SLOT_HEIGHT)
}