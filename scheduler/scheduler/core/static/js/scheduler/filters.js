function initFilters () {
  const selectMenu = document.getElementById('courseFilterSelect')
  if (!selectMenu) return // Safety check

  const roles =
    typeof window.ROLES === 'string' ? JSON.parse(window.ROLES) : window.ROLES
  // 1. Populate the dropdown menu
  roles.forEach(role => {
    const option = document.createElement('option')
    option.value = role.id
    option.textContent = role.name
    selectMenu.appendChild(option)
  })

  // 2. Handle what happens when the user picks a role
  selectMenu.onchange = async e => {
    const selectedValue = e.target.value
    document.getElementById('for-worker').style.display = 'none'
    document.getElementById('for-filter').style.display = 'flex'
    // Save current work before switching views
    snapshotCurrentGrid()

    // Clean up active UI states
    document
      .querySelectorAll('.worker-item')
      .forEach(item => item.classList.remove('active'))
    const workerLabel = document.getElementById('viewingWorkerLabel')
    if (workerLabel) workerLabel.textContent = 'Role View'

    // If they selected "All Roles..." (the default empty option)
    if (!selectedValue) {
      activeRoleId = null
      clearObstructionBlocks()
      clearInteractiveGrid(false)
      if (typeof activeScheduleId !== 'undefined' && activeScheduleId)
        loadScheduleShifts()
      return
    }

    // Find the actual role object from our list
    const role = roles.find(r => String(r.id) === String(selectedValue))
    if (!role) return

    // Set active state and clear grid for the new role
    activeRoleId = role.id
    clearObstructionBlocks()
    clearInteractiveGrid(false)

    // Load data just like the old button click
    const localShifts = localSchedule.getForRole(role.id)
    if (localShifts.length > 0) {
      await loadRoleView(role.id, window.TEAM_ID)
      renderShiftsToGrid(localShifts, true)
    } else {
      await loadRoleView(role.id, window.TEAM_ID)
      if (typeof loadScheduleShifts === 'function') await loadScheduleShifts()
    }
  }
}

function snapshotCurrentGrid () {
  if (!activeRoleId) return

  const shifts = []

  document
    .querySelectorAll('#mainGrid .shift-block:not(.temp)')
    .forEach(block => {
      const col = block.parentElement
      const dayIndex = parseInt(col.dataset.day)
      const topPx = parseFloat(block.style.top)
      const heightPx = parseFloat(block.style.height)
      let startMin, endMin
      if (block.dataset.startMin && block.dataset.endMin) {
        startMin = parseInt(block.dataset.startMin)
        endMin = parseInt(block.dataset.endMin)
      } else {
        startMin = Math.round(topPx / SLOT_HEIGHT) * 15 + START_HOUR * 60
        endMin = startMin + Math.round(heightPx / SLOT_HEIGHT) * 15
      }

      const finalWorkerId = col.dataset.workerId || block.dataset.workerId

      shifts.push({
        user_id: finalWorkerId,
        user_name: block.querySelector('.event-title').textContent,
        role_id: activeRoleId,
        room_id: block.dataset.roomId || null,
        room_name: block.querySelector('.event-loc')?.textContent || null,
        day: DAY_KEYS[dayIndex],
        start_min: startMin,
        end_min: endMin,
        isSaved: block.classList.contains('saved')
      })
    })

  localSchedule.save(activeRoleId, shifts)
}

async function loadRoleView (roleId, teamId) {
  const response = await fetch(`/api/team/${teamId}/roles/${roleId}`)
  const data = await response.json()
  const workers = window.WORKERS.filter(
    w => String(w.role_id) === String(roleId)
  )

  buildRoleGrid(workers)

  const obstructions =
    typeof window.OBSTRUCTIONS === 'string'
      ? JSON.parse(window.OBSTRUCTIONS)
      : window.OBSTRUCTIONS

  workers.forEach(worker => {
    DAY_KEYS.forEach((dayKey, dayIndex) => {
      const workerCol = document.querySelector(
        `.worker-sub-col[data-day="${dayIndex}"][data-worker-id="${worker.id}"]`
      )
      if (!workerCol) return
      console.log('WOEKR', worker)
      const busy = worker.availabilityData.filter(
        a => a.day.toLowerCase() === dayKey
      )
      busy.forEach(range => {
        const startOffset = range.start_min - START_HOUR * 60
        const top = (startOffset / 15) * SLOT_HEIGHT
        const height = ((range.end_min - range.start_min) / 15) * SLOT_HEIGHT

        const block = document.createElement('div')
        block.className = 'event-block avail-block'
        block.style.top = `${top}px`
        block.style.height = `${height}px`
        block.innerHTML = `
        <div class="event-content">
          <div class="event-title">${
            range.eventName || range.event_name || range.name || ''
          }</div>
          <div class="event-building">${
            range.building || range.location || ''
          }</div>
          <div class="event-time">${
            range.label ||
            `${formatMin(range.start_min)} - ${formatMin(range.end_min)}`
          }</div>
        </div>`
        workerCol.appendChild(block)
      })
      const scheduled = worker.shifts.filter(
        a => a.day.toLowerCase() === dayKey
      )
      renderShiftsToGrid(scheduled)
      
      obstructions.forEach(o => {
        if (o.role_id !== parseInt(roleId)) return
        if (!o.days.includes(dayKey)) return

        const workerData = (
          typeof window.WORKERS === 'string'
            ? JSON.parse(window.WORKERS)
            : window.WORKERS
        ).find(w => w.id === String(worker.id))

        if (!o.days.includes(dayKey)) return
        if (o.section && workerData?.section !== o.section) return

        workerCol.appendChild(createObstructionBlock(o))
      })
    })
  })
}
