function renderShiftsToGrid(shifts, isLocal = false) {
  const dayMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }

  shifts.forEach(s => {
    const dayIndex = typeof s.day === 'string' ? dayMap[s.day] : s.day

    let col = document.querySelector(
      `#mainGrid .worker-sub-col[data-day="${dayIndex}"][data-worker-id="${s.user_id}"]`
    )

    if (!col) {
      col = document.querySelector(
        `#mainGrid .day-col[data-day="${dayIndex}"]:not(.worker-sub-col)`
      )
    }

    if (!col) return

    const startOffset = s.start_min - START_HOUR * 60
    const top = (startOffset / 15) * SLOT_HEIGHT
    const height = ((s.end_min - s.start_min) / 15) * SLOT_HEIGHT

    const colorClass = !isLocal || s.isSaved ? 'saved' : 'local'

    const block = document.createElement('div')
    block.className = `event-block shift-block ${colorClass}`
    block.style.top = `${top}px`
    block.style.height = `${height}px`
    block.dataset.workerId = s.user_id
    block.dataset.roleId = s.role_id
    block.dataset.roomId = s.room_id || ''
    block.dataset.shiftId = s.id || ''
    block.dataset.startMin = s.start_min
    block.dataset.endMin = s.end_min

    block.innerHTML = `
      <div class="delete-x" onclick="removeEventBlock(event, this)">×</div>
      <div class="event-content">
        <div class="event-title">${s.user_name}</div>
        <div class="event-time">${formatMin(s.start_min)} - ${formatMin(s.end_min)}</div>
        ${s.room_name ? `<div class="event-loc">${s.room_name}</div>` : ''}
      </div>`

    col.appendChild(block)
  })
}

function renderWorkerObstructions(workerId) {
  document.querySelectorAll('#mainGrid .obstruction-block').forEach(el => el.remove())

  const worker = window.WORKERS.find(w => w.id == workerId)
  const section = worker.section
  const workerObs = window.OBSTRUCTIONS.filter(o => {
    const matchesSection = o.section ? o.section == section : true
    const matchesRole = o.role_id ? o.role_id == worker?.role_id : true
    return matchesSection && matchesRole
  })

  const dayMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }

  workerObs.forEach(obs => {
    for (let day of obs.days) {
      const dayIndex = dayMap[day]
      const col = document.querySelector(
        `#mainGrid .day-col[data-day="${dayIndex}"]:not(.worker-sub-col)`
      )

      if (!col) continue

      const startOffset = obs.start_min - START_HOUR * 60
      const top = (startOffset / 15) * SLOT_HEIGHT
      const height = ((obs.end_min - obs.start_min) / 15) * SLOT_HEIGHT

      const block = document.createElement('div')
      block.className = 'obstruction-block'
      block.style.top = `${top}px`
      block.style.height = `${height}px`

      const reason = obs.name || obs.type || 'Unavailable'
      block.innerHTML = `<div style="padding: 4px; font-size: 11px; font-weight: bold;">${reason}</div>`

      col.appendChild(block)
    }
  })
}

function clearInteractiveGrid(withConfirm = true) {
  if (withConfirm && !confirm('Clear all assigned shifts?')) return
  document.querySelectorAll('#mainGrid .shift-block').forEach(el => el.remove())
}

function clearObstructionBlocks() {
  document.querySelectorAll('.obstruction-block').forEach(b => b.remove())
}

function scrollToDay(dayIndex) {
  const targetCol = document.querySelector(`#mainGrid .day-col[data-day="${dayIndex}"]`)
  if (!targetCol) return

  const scrollArea = targetCol.closest('.scroll-area')
  if (!scrollArea) return

  targetCol.style.backgroundColor = 'rgba(115, 147, 179, 0.2)'
  setTimeout(() => (targetCol.style.backgroundColor = ''), 1000)

  scrollArea.scrollTo({
    left: targetCol.offsetLeft - 60,
    behavior: 'smooth'
  })
}
