// EVENTS

// Render server-saved availability blocks onto the grid on page load
function addSavedEventsToGrid () {
  if (!window.SAVED_AVAILABILITY) return

  const dayStringToInt = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6
  }

  window.SAVED_AVAILABILITY.forEach(item => {
    const dayKey = (item.day || '').toLowerCase()
    const dayIndex = dayStringToInt[dayKey]

    if (dayIndex === undefined) return
    const dayCol = document.querySelector(`.day-col[data-day="${dayIndex}"]`)
    if (!dayCol) return

    const startParts = item.start.split(':')
    const endParts = item.end.split(':')

    const startMin = parseInt(startParts[0]) * 60 + parseInt(startParts[1])
    const endMin = parseInt(endParts[0]) * 60 + parseInt(endParts[1])

    const totalStartMin = startMin - window.START_HOUR * 60
    const totalEndMin = endMin - window.START_HOUR * 60

    if (totalStartMin < 0) return // Skip events before calendar start

    const topPx = (totalStartMin / 15) * SLOT_HEIGHT
    const heightPx = ((totalEndMin - totalStartMin) / 15) * SLOT_HEIGHT

    const eventBlock = document.createElement('div')
    eventBlock.className = 'event-block'
    eventBlock.dataset.mode = 'busy'
    eventBlock.style.top = `${topPx}px`
    eventBlock.style.height = `${heightPx}px`

    const loc = item.building || item.location || ''

    eventBlock.innerHTML = `
      <div class="delete-x" onclick="removeEventBlock(event, this)">×</div>
      <div class="event-content">
        <div class="event-title">${item.name || 'Busy'}</div>
        <div class="event-time">${formatMin(startMin)} - ${formatMin(endMin)}</div>
        ${loc ? `<div class="event-loc">${loc}</div>` : ''}
      </div>`

    dayCol.appendChild(eventBlock)
  })
  console.log(window.SAVED_PREF)

  window.SAVED_PREF.forEach(item => {
  const dayKey = (item.day || '').toLowerCase()
  const dayIndex = dayStringToInt[dayKey]

  if (dayIndex === undefined) return
  const dayCol = document.querySelector(`.day-col[data-day="${dayIndex}"]`)
  if (!dayCol) return

  const startParts = item.start.split(':')
  const endParts = item.end.split(':')

  const startMin = parseInt(startParts[0]) * 60 + parseInt(startParts[1])
  const endMin = parseInt(endParts[0]) * 60 + parseInt(endParts[1])

  const totalStartMin = startMin - window.START_HOUR * 60
  const totalEndMin = endMin - window.START_HOUR * 60

  if (totalStartMin < 0) return

  const topPx = (totalStartMin / 15) * SLOT_HEIGHT
  const heightPx = ((totalEndMin - totalStartMin) / 15) * SLOT_HEIGHT

  const eventBlock = document.createElement('div')
  eventBlock.className = 'event-block'
  eventBlock.dataset.mode = 'preferred'
  eventBlock.style.top = `${topPx}px`
  eventBlock.style.height = `${heightPx}px`
  eventBlock.innerHTML = `
    <div class="delete-x" onclick="removeEventBlock(event, this)">×</div>
    <div class="event-content">
      <div class="event-title">Preferred</div>
      <div class="event-time">${formatMin(startMin)} - ${formatMin(endMin)}</div>
    </div>`

  dayCol.appendChild(eventBlock)
})
}

function removeEventBlock (e, xButton) {
  e.stopPropagation() // Prevent modal from opening on delete

  if (!confirm('Remove this shift?')) return

  const block = xButton.closest('.event-block')
  if (block) {
    block.remove()
  }
}