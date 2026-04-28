/** @file Manages the grid layout, dynamic scaling, and time axis rendering. */
/** @module Availability */

/**
 * Initializes the grid layout by calculating the slot dimensions and drawing the time axis.
 * Should be called on load or when the window resizes to keep things perfectly fit.
 */
function initLayout () {
  fitGridToContainer()
  drawTimeLabels()
}

/**
 * Dynamically calculates the height of a single 15-minute slot so the entire grid 
 * fits perfectly inside the available space of the scroll container without scrolling.
 * Updates the global SLOT_HEIGHT variable and the matching CSS variable used for drawing grid lines.
 * * @global {number} SLOT_HEIGHT - Updated here to be used globally by event dragging/resizing logic.
 * @requires window.START_HOUR
 * @requires window.END_HOUR
 */
function fitGridToContainer () {
  const container = document.getElementById('scrollContainer')
  const availableHeight = container.clientHeight

  const totalHours = window.END_HOUR - window.START_HOUR
  const totalSlots = totalHours * 4 // 15-min slots

  // Note: Depending on your setup, you might want window.SLOT_HEIGHT here!
  SLOT_HEIGHT = availableHeight / totalSlots

  // Sync CSS variable used for background grid lines
  document.documentElement.style.setProperty('--slot-height', `${SLOT_HEIGHT}px`)
}

/**
 * Renders the hour labels (e.g., 9 AM, 12 PM) along the left-hand time column.
 * Positions them using absolute percentage heights to ensure they perfectly align 
 * with the dynamically scaled grid slots.
 * * @requires window.START_HOUR
 * @requires window.END_HOUR
 */
function drawTimeLabels () {
  const timeCol = document.getElementById('timeColumn')
  timeCol.innerHTML = ''

  const totalHours = window.END_HOUR - window.START_HOUR

  for (let h = window.START_HOUR; h <= window.END_HOUR; h++) {
    if (h === window.END_HOUR) continue // Skip bottom-edge label

    const label = document.createElement('div')
    label.className = 'time-label'

    const suffix = h >= 12 ? 'PM' : 'AM'
    const displayH = h > 12 ? h - 12 : h === 0 || h === 12 || h === 24 ? 12 : h
    label.textContent = `${displayH} ${suffix}`

    const percentTop = ((h - window.START_HOUR) / totalHours) * 100
    label.style.top = `${percentTop}%`

    timeCol.appendChild(label)
  }
}