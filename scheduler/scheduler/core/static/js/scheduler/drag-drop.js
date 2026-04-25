function setupDragListeners() {
  const mainGrid = document.getElementById('mainGrid')

  mainGrid.addEventListener('mousedown', e => {
    const col = e.target.closest('.day-col')
    if (!col || e.target.closest('.event-block')) return

    isDragging = true
    activeCol = col

    const rect = col.getBoundingClientRect()
    const relativeY = e.clientY - rect.top

    startTop = Math.floor(relativeY / SLOT_HEIGHT) * SLOT_HEIGHT

    activeEvent = document.createElement('div')
    activeEvent.className = 'event-block shift-block temp'
    activeEvent.style.top = `${startTop}px`
    activeEvent.style.height = `${SLOT_HEIGHT}px`
    activeEvent.innerHTML = `<div class="event-content"><div class="event-title">New Shift</div></div>`

    col.appendChild(activeEvent)
  })

  document.addEventListener('mousemove', e => {
    if (!isDragging || !activeEvent || !activeCol) return

    const rect = activeCol.getBoundingClientRect()
    const currentRelativeY = e.clientY - rect.top

    let newHeight =
      Math.floor(currentRelativeY / SLOT_HEIGHT) * SLOT_HEIGHT -
      startTop +
      SLOT_HEIGHT
    if (newHeight < SLOT_HEIGHT) newHeight = SLOT_HEIGHT

    if (activeRoleId) {
      const maxHeight = getMaxHeightBeforeObstruction(activeCol, startTop, newHeight)
      newHeight = maxHeight
    }
    activeEvent.style.height = `${newHeight}px`
  })

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false
      
      const finalHeight = parseInt(activeEvent.style.height, 10)
      const dayIndex = activeCol.dataset.day
      const dayKey = DAY_KEYS[parseInt(dayIndex)]

      const startMin = (startTop / SLOT_HEIGHT) * 15 + START_HOUR * 60
      const endMin = startMin + (finalHeight / SLOT_HEIGHT) * 15

      const newShift = {
        day: dayKey,
        start_min: startMin,
        end_min: endMin,
        role_id: activeRoleId || null
      }

      if (!window.localSchedule) {
        window.localSchedule = []
      }
      window.localSchedule.push(newShift)

      openModal(newShift, activeEvent)
    }
  })
}

function getMaxHeightBeforeObstruction(col, startTopPx, desiredHeight) {
  const dayIndex = col.dataset.day
  const dayKey = DAY_KEYS[parseInt(dayIndex)]

  const obstructions =
    typeof window.OBSTRUCTIONS === 'string'
      ? JSON.parse(window.OBSTRUCTIONS)
      : window.OBSTRUCTIONS

  const eventStartMin = (startTopPx / SLOT_HEIGHT) * 15 + START_HOUR * 60
  const eventEndMin = eventStartMin + (desiredHeight / SLOT_HEIGHT) * 15

  const blocking = obstructions.filter(
    o =>
      o.role_id === activeRoleId &&
      o.days.includes(dayKey) &&
      o.start_min >= eventStartMin &&
      o.start_min < eventEndMin
  )

  if (blocking.length === 0) return desiredHeight

  const nearestStart = Math.min(...blocking.map(o => o.start_min))
  const maxHeight = ((nearestStart - eventStartMin) / 15) * SLOT_HEIGHT
  return Math.max(maxHeight, SLOT_HEIGHT)
}
