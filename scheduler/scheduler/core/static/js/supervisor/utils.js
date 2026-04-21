// UTILS

// Converts a pixel offset from the top of the grid to a 12-hour time string
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
function formatMin (totalMinutes) {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  const suffix = h >= 12 ? 'PM' : 'AM'
  const displayH = h > 12 ? h - 12 : h === 0 || h === 12 ? 12 : h
  const displayM = m < 10 ? '0' + m : m
  return `${displayH}:${displayM}${suffix}`
}

// Parses "10:00 AM" or "10:00" format to total minutes from midnight
function timeToMin (timeStr) {
  const cleaned = timeStr.trim()
  const parts = cleaned.split(':')
  const h = parseInt(parts[0])
  const m = parseInt(parts[1]) // parseInt ignores " AM" suffix automatically
  return h * 60 + m
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