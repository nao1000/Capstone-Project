// UTILS

function formatMin (totalMinutes) {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  const suffix = h >= 12 ? 'PM' : 'AM'
  const displayH = h > 12 ? h - 12 : h === 0 || h === 12 || h === 24 ? 12 : h
  const displayM = m < 10 ? '0' + m : m
  return `${displayH}:${displayM} ${suffix}`
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