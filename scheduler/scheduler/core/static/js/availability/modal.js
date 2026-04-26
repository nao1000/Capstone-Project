// MODAL

function openModal(shift = null) {
  // store it so the confirm handler can access it
  window.pendingShift = shift

  const modal = document.getElementById('eventModal')
  modal.classList.add('show')

  document.getElementById('modalEventName').value = ''
  document.getElementById('modalLocation').value = ''
  document.getElementById('modalEventName').focus()

  const topPx = parseFloat(activeEvent.style.top)
  const heightPx = parseFloat(activeEvent.style.height)

  const startSlotIndex = Math.round(topPx / SLOT_HEIGHT)
  const slotsCount = Math.round(heightPx / SLOT_HEIGHT)

  currentStartMin = startSlotIndex * 15 + window.START_HOUR * 60
  currentEndMin = currentStartMin + slotsCount * 15

  document.getElementById('modalTimeDisplay').textContent =
    `${formatMin(currentStartMin)} - ${formatMin(currentEndMin)} (${slotsCount * 15} mins)`
}

function openEditModal (block) {
  // Re-use activeEvent so saveEvent() handles the overwrite automatically
  activeEvent = block

  const modal = document.getElementById('eventModal')
  modal.classList.add('show')

  const title = block.querySelector('.event-title').textContent
  const locNode = block.querySelector('.event-loc')
  const loc = locNode ? locNode.textContent : ''

  document.getElementById('modalEventName').value = title
  document.getElementById('modalLocation').value = loc

  const topPx = parseFloat(block.style.top)
  const heightPx = parseFloat(block.style.height)
  const startSlotIndex = Math.round(topPx / window.SLOT_HEIGHT)
  const slotsCount = Math.round(heightPx / window.SLOT_HEIGHT)

  currentStartMin = startSlotIndex * 15 + window.START_HOUR * 60
  currentEndMin = currentStartMin + slotsCount * 15

  document.getElementById('modalTimeDisplay').textContent =
    `${formatMin(currentStartMin)} - ${formatMin(currentEndMin)} (${slotsCount * 15} mins)`
}

function closeModal () {
  document.getElementById('eventModal').classList.remove('show')
  if (activeEvent && activeEvent.classList.contains('temp')) {
    activeEvent.remove()
  }
  activeEvent = null
}

function saveEvent () {
  const name = document.getElementById('modalEventName').value || 'Shift'
  const location = document.getElementById('modalLocation').value
  const timeString = `${formatMin(currentStartMin)} - ${formatMin(currentEndMin)}`

  const heightPx = parseFloat(activeEvent.style.height)
  const isSmall = heightPx < SLOT_HEIGHT * 2.5

  if (activeEvent) {
    activeEvent.classList.remove('temp')

    let html = `
      <div class="delete-x" onclick="removeEventBlock(event, this)">×</div>
      <div class="event-content">
        <div class="event-title">${name}</div>
        <div class="event-time">${timeString}</div>`

    if (!isSmall && location) {
      html += `<div class="event-loc">${location}</div>`
    }

    html += `</div>`
    activeEvent.innerHTML = html
  }

  document.getElementById('eventModal').classList.remove('show')
  activeEvent = null
}