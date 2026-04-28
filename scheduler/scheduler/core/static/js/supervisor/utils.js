/** @file General util functions for the supervisor module */
/** @module Supervisor */

// Converts a pixel offset from the top of the grid to a 12-hour time string
/**
 * Converts a vertical pixel offset from the schedule grid into a formatted 
 * 12-hour time string (e.g., "9:15AM"). Relies on the global `START_HOUR` 
 * and `PIXELS_PER_HOUR` constants.
 *
 * @param {number} pixels - The vertical distance in pixels from the top of the grid.
 * @returns {string} The formatted 12-hour time string with AM/PM suffix.
 */
function formatTime (pixels) {
  const totalMinutes = (pixels / PIXELS_PER_HOUR) * 60
  let hours = START_HOUR + Math.floor(totalMinutes / 60)
  let mins = Math.floor(totalMinutes % 60)

  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12 || 12
  mins = mins < 10 ? '0' + mins : mins

  return `${hours}:${mins}${ampm}`
}

// Converts total minutes from midnight to a 12-hour time string (e.g. 540 → "9:00AM")
/**
 * Converts a specific time represented in total minutes from midnight 
 * into a formatted 12-hour time string.
 *
 * @param {number} totalMinutes - The time represented as total minutes elapsed since midnight.
 * @returns {string} The formatted 12-hour time string with AM/PM suffix.
 */
function formatMin (totalMinutes) {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  const suffix = h >= 12 ? 'PM' : 'AM'
  const displayH = h > 12 ? h - 12 : h === 0 || h === 12 ? 12 : h
  const displayM = m < 10 ? '0' + m : m
  return `${displayH}:${displayM}${suffix}`
}

// Parses "10:00 AM" or "10:00" format to total minutes from midnight
/**
 * Parses a basic time string and converts it into total minutes from midnight.
 * Note: `parseInt` automatically ignores non-numeric characters like " AM", 
 * but this simple implementation does not convert PM hours automatically unless 
 * provided in 24-hour format (e.g., "14:00").
 *
 * @param {string} timeStr - The time string to parse (e.g., "10:00" or "10:00 AM").
 * @returns {number} The calculated total minutes from midnight.
 */
function timeToMin (timeStr) {
  const cleaned = timeStr.trim()
  const parts = cleaned.split(':')
  const h = parseInt(parts[0])
  const m = parseInt(parts[1]) // parseInt ignores " AM" suffix automatically
  return h * 60 + m
}

/**
 * Retrieves the value of a specific browser cookie by its name. 
 * Commonly used to extract the `csrftoken` for secure API requests in Django.
 *
 * @param {string} name - The exact string name of the cookie to retrieve.
 * @returns {string|null} The decoded value of the requested cookie, or null if it doesn't exist.
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