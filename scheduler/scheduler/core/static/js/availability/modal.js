/** @file Handles the UI and logic for the event creation and editing modal. */
/** @module Availability */

/**
 * Opens the modal to create a new event.
 * Calculates the initial time range based on the top/height of the currently active grid block.
 * Sets `currentStartMin` and `currentEndMin` from the active block's position.
 * Stores `shift` on `window.pendingShift` for access by confirm handlers.
 *
 * @param {Object|null} [shift=null] - Optional shift data to store globally for confirm handlers.
 * @requires window.SLOT_HEIGHT
 * @requires window.START_HOUR
 * @requires formatMin
 */
function openModal(shift = null) {
  // store it so the confirm handler can access it
  window.pendingShift = shift

  const modal = document.getElementById('eventModal')
  modal.classList.add('show')

  document.getElementById('modalEventName').value = ''
  document.getElementById('modalLocation').value = ''
  document.getElementById('modalEventName').focus()

  const topPx = parseFloat(activeEvent.style.top)
  const heightPx = parseFloat(activeEvent.style.height)

  const startSlotIndex = Math.round(topPx / window.SLOT_HEIGHT)
  const slotsCount = Math.round(heightPx / window.SLOT_HEIGHT)

  currentStartMin = startSlotIndex * 15 + window.START_HOUR * 60
  currentEndMin = currentStartMin + slotsCount * 15

  document.getElementById('modalTimeDisplay').textContent =
    `${formatMin(currentStartMin)} - ${formatMin(currentEndMin)} (${slotsCount * 15} mins)`
}

/**
 * Opens the modal to edit an existing event block.
 * Populates the modal inputs with the text currently inside the block.
 * Sets `activeEvent` to the passed block so `saveEvent` can overwrite it.
 *
 * @param {HTMLElement} block - The existing event block to be edited.
 * @requires window.SLOT_HEIGHT
 * @requires window.START_HOUR
 * @requires formatMin
 */
function openEditModal (block) {
  // Re-use activeEvent so saveEvent() handles the overwrite automatically
  activeEvent = block

  const modal = document.getElementById('eventModal')
  modal.classList.add('show')

  const title = block.querySelector('.event-title').textContent
  const locNode = block.querySelector('.event-loc')
  const loc = locNode ? locNode.textContent : ''

  document.getElementById('modalEventName').value = title
  document.getElementById('modalLocation').value = loc

  const topPx = parseFloat(block.style.top)
  const heightPx = parseFloat(block.style.height)
  const startSlotIndex = Math.round(topPx / window.SLOT_HEIGHT)
  const slotsCount = Math.round(heightPx / window.SLOT_HEIGHT)

  currentStartMin = startSlotIndex * 15 + window.START_HOUR * 60
  currentEndMin = currentStartMin + slotsCount * 15

  document.getElementById('modalTimeDisplay').textContent =
    `${formatMin(currentStartMin)} - ${formatMin(currentEndMin)} (${slotsCount * 15} mins)`
}

/**
 * Closes the modal without saving.
 * If the active event was just a temporary block (a new creation that was cancelled),
 * it removes the block from the grid entirely. Resets `activeEvent` to null.
 */
function closeModal () {
  document.getElementById('eventModal').classList.remove('show')
  if (activeEvent && activeEvent.classList.contains('temp')) {
    activeEvent.remove()
  }
  activeEvent = null
}

/**
 * Commits the data from the modal inputs into the active event block's HTML.
 * Removes the `temp` class to lock the block onto the grid. Resets `activeEvent` to null.
 * Automatically hides the location line if the block is too short (under 2.5 slots) to prevent overflow.
 *
 * @requires window.SLOT_HEIGHT
 * @requires formatMin
 */
function saveEvent () {
  const name = document.getElementById('modalEventName').value || 'Shift'
  const location = document.getElementById('modalLocation').value
  const timeString = `${formatMin(currentStartMin)} - ${formatMin(currentEndMin)}`

  const heightPx = parseFloat(activeEvent.style.height)
  const isSmall = heightPx < window.SLOT_HEIGHT * 2.5

  if (activeEvent) {
    activeEvent.classList.remove('temp')

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