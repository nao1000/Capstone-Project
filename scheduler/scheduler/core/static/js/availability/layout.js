// LAYOUT

function initLayout () {
  fitGridToContainer()
  drawTimeLabels()
}

// Calculate slot height to perfectly fill the scroll container
function fitGridToContainer () {
  const container = document.getElementById('scrollContainer')
  const availableHeight = container.clientHeight

  const totalHours = window.END_HOUR - window.START_HOUR
  const totalSlots = totalHours * 4 // 15-min slots

  SLOT_HEIGHT = availableHeight / totalSlots

  // Sync CSS variable used for background grid lines
  document.documentElement.style.setProperty('--slot-height', `${SLOT_HEIGHT}px`)
}

// Render hour labels along the left time column
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