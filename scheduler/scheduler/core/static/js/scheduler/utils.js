/** @file Helper functions for time formatting, cookie retrieval, and rendering specialized grid blocks. */
/** @module Scheduler */

/**
 * Calculates and formats a time string based on a block's vertical pixel position.
 * Useful for determining grid times dynamically during dragging or resizing.
 *
 * @param {number} topPx - The vertical pixel offset from the top of the grid.
 * @returns {string} Formatted 12-hour time string (e.g., "1:15 PM").
 * @requires START_HOUR
 * @requires SLOT_HEIGHT
 */
function formatTime(topPx) {
  const totalMinutes = (topPx / SLOT_HEIGHT) * 15 + START_HOUR * 60
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  const suffix = h >= 12 ? 'PM' : 'AM'
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${displayH}:${m.toString().padStart(2, '0')} ${suffix}`
}

/**
 * Converts a raw number of total minutes into a formatted 12-hour time string.
 *
 * @param {number} totalMinutes - Total minutes (usually since midnight).
 * @returns {string} Formatted 12-hour time string (e.g., "02:30 PM").
 */
function formatMin(totalMinutes) {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  const suffix = h >= 12 ? 'PM' : 'AM'
  const displayH = h > 12 ? h - 12 : h === 0 || h === 12 ? 12 : h
  const displayM = m < 10 ? '0' + m : m
  return `${displayH}:${displayM} ${suffix}`
}

/**
 * Retrieves the value of a specific cookie. Commonly used to grab the CSRF token for API calls.
 *
 * @param {string} name - The name of the cookie to find.
 * @returns {string|null} The decoded cookie value, or null if it doesn't exist.
 */
function getCookie(name) {
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
 * Injects a hardcoded 9 AM to 12 PM availability block into Monday's column.
 * Typically used for testing or setting up initial dummy data on the grid.
 *
 * @requires START_HOUR
 * @requires SLOT_HEIGHT
 */
function mockLoadAvailability() {
  const dayCol = document.querySelector('#mainGrid .day-col[data-day="1"]')
  const startMins = 9 * 60 - START_HOUR * 60
  const endMins = 12 * 60 - START_HOUR * 60

  const topPx = (startMins / 15) * SLOT_HEIGHT
  const heightPx = ((endMins - startMins) / 15) * SLOT_HEIGHT

  const block = document.createElement('div')
  block.className = 'event-block avail-block'
  block.style.top = `${topPx}px`
  block.style.height = `${heightPx}px`
  block.innerHTML = `
    <div class="event-content">
      <div class="event-title">Available</div>
      <div class="event-time">9:00 AM - 12:00 PM</div>
    </div>`
  dayCol.appendChild(block)
}

/**
 * Generates an HTML element representing an uneditable "obstruction" (e.g., an existing shift or hard conflict).
 * Calculates height and position based on the obstruction's start and end times in minutes.
 *
 * @param {Object} obs - The obstruction data object.
 * @param {number} obs.start_min - Start time in total minutes.
 * @param {number} obs.end_min - End time in total minutes.
 * @param {string} [obs.name] - The title of the obstruction (defaults to 'Unavailable').
 * @param {string} [obs.location] - Optional location string.
 * @returns {HTMLElement} The constructed DOM element ready to be appended to a grid column.
 * @requires START_HOUR
 * @requires SLOT_HEIGHT
 */
function createObstructionBlock (obs) {
  const startOffset = obs.start_min - START_HOUR * 60
  const top = (startOffset / 15) * SLOT_HEIGHT
  const height = ((obs.end_min - obs.start_min) / 15) * SLOT_HEIGHT

  const block = document.createElement('div')
  block.className = 'obstruction-block'
  block.style.top = `${top}px`
  block.style.height = `${height}px`
  block.innerHTML = `<div style="padding:4px; font-size:11px; font-weight:bold;">${obs.name || 'Unavailable'}<br>${obs.location || ''}</div>`
  return block
}