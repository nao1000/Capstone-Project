/** @file General utility functions for formatting time, managing cookies, and updating grid events. */
/** @module Availability */

/**
 * Converts a total number of minutes into a formatted 12-hour time string (e.g., "1:30 PM").
 *
 * @param {number} totalMinutes - The total minutes (usually since midnight) to convert.
 * @returns {string} The formatted time string.
 */
function formatMin (totalMinutes) {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  const suffix = h >= 12 ? 'PM' : 'AM'
  const displayH = h > 12 ? h - 12 : h === 0 || h === 12 || h === 24 ? 12 : h
  const displayM = m < 10 ? '0' + m : m
  return `${displayH}:${displayM} ${suffix}`
}

/**
 * Retrieves the value of a specific cookie by its name.
 *
 * @param {string} name - The name of the cookie to find.
 * @returns {string|null} The decoded cookie value, or null if not found.
 */
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

/**
 * Recalculates and updates the displayed time range text for a given event block.
 * Computes the time based on the element's CSS top and height properties.
 *
 * @param {HTMLElement} block - The event block element to update.
 * @requires window.SLOT_HEIGHT - Pixel height of a single 15-minute slot.
 * @requires window.START_HOUR - The starting hour of the grid.
 */
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