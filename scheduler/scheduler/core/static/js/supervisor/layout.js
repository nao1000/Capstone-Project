// LAYOUT

// Builds the time-label column and sizes all day columns to match the grid height
function setupRoomGrid () {
  const timeCol = document.getElementById('roomTimeCol')
  timeCol.innerHTML = ''

  const halfBlockOffset = (0.5 * PIXELS_PER_HOUR) / 2

  for (let i = 0; i < HOURS_TOTAL; i += 0.5) {
    const label = document.createElement('div')
    label.className = 'time-label'

    const topPosition = i * PIXELS_PER_HOUR + halfBlockOffset / 2
    label.style.top = `${topPosition}px`

    const totalHours = START_HOUR + i
    const hour = Math.floor(totalHours)
    const minutes = (totalHours % 1) * 60

    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    const displayMinutes = minutes === 0 ? '00' : '30'

    label.textContent = `${displayHour}:${displayMinutes}${ampm}`
    timeCol.appendChild(label)
  }

  // Stretch the grid container and all columns to the total calendar height
  const totalHeight = HOURS_TOTAL * PIXELS_PER_HOUR
  document.getElementById('roomTimeCol').style.height = `${totalHeight}px`
  document.querySelector('.grid-lines').style.height = `${totalHeight}px`
  document.querySelectorAll('.day-col').forEach(c => (c.style.height = `${totalHeight}px`))
}