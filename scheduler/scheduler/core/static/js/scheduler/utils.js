function formatTime(topPx) {
  const totalMinutes = (topPx / SLOT_HEIGHT) * 15 + START_HOUR * 60
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  const suffix = h >= 12 ? 'PM' : 'AM'
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${displayH}:${m.toString().padStart(2, '0')} ${suffix}`
}

function formatMin(totalMinutes) {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  const suffix = h >= 12 ? 'PM' : 'AM'
  const displayH = h > 12 ? h - 12 : h === 0 || h === 12 ? 12 : h
  const displayM = m < 10 ? '0' + m : m
  return `${displayH}:${displayM} ${suffix}`
}

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