/** @file Manages the grid interaction modes (busy vs. preferred) and grid-wide actions like clearing. */
/** @module Availability */

/**
 * Switches the active drawing mode for the grid. Updates the UI buttons
 * to show which mode is active and changes the instructional hint text in the toolbar.
 * Sets `currentGridMode` to the provided mode string.
 *
 * @param {string} mode - The mode to activate (typically `'busy'` or `'preferred'`).
 */
function setGridMode (mode) {
  currentGridMode = mode
  document.getElementById('btnBusy').classList.toggle('active', mode === 'busy')
  document.getElementById('btnPreferred').classList.toggle('active', mode === 'preferred')

  const hint = document.getElementById('toolbarHint')
  if (hint) {
    hint.textContent =
      mode === 'preferred'
        ? 'Drag to mark times you want to work • Click × to remove'
        : 'Click & Drag to add • Double-click to Edit • Ctrl+C/V to Copy/Paste'
  }
}

/**
 * Instantly commits a newly drawn "preferred" time block to the grid.
 * Bypasses the edit modal used for busy shifts and automatically injects the calculated time range.
 * Resets `activeEvent` to null after the block is finalized.
 *
 * @requires window.SLOT_HEIGHT
 * @requires window.START_HOUR
 * @requires formatMin
 */
function finalizePreferredEvent () {
  if (!activeEvent) return

  const topPx = parseFloat(activeEvent.style.top)
  const heightPx = parseFloat(activeEvent.style.height)
  const startSlotIndex = Math.round(topPx / window.SLOT_HEIGHT)
  const slotsCount = Math.round(heightPx / window.SLOT_HEIGHT)
  const startMin = startSlotIndex * 15 + window.START_HOUR * 60
  const endMin = startMin + slotsCount * 15
  const timeString = `${formatMin(startMin)} - ${formatMin(endMin)}`

  activeEvent.classList.remove('temp')
  activeEvent.innerHTML = `
    <div class="delete-x" onclick="removeEventBlock(event, this)">×</div>
    <div class="event-content">
      <div class="event-title">Preferred</div>
      <div class="event-time">${timeString}</div>
    </div>`

  activeEvent = null
}

/**
 * Prompts the user for confirmation and clears all saved events (both busy and preferred)
 * from the grid's DOM.
 */
function clearLocalGrid () {
  if (!confirm('Clear all shifts from the grid?')) return
  document.querySelectorAll('.event-block:not(.temp)').forEach(el => el.remove())
}