function initFilters() {
  const container = document.querySelector('.filter-options')
  const roles =
    typeof window.ROLES === 'string' ? JSON.parse(window.ROLES) : window.ROLES

  roles.forEach(role => {
    const btn = document.createElement('button')
    btn.className = 'btn btn-clear'
    btn.style.margin = '5px'
    btn.textContent = role.name
    btn.dataset.roleId = role.id

    btn.onclick = async () => {
      snapshotCurrentGrid()

      document.querySelectorAll('.worker-item').forEach(item => item.classList.remove('active'))
      const workerLabel = document.getElementById('viewingWorkerLabel')
      if (workerLabel) workerLabel.textContent = 'Role View'

      if (activeRoleId === role.id) {
        activeRoleId = null
        btn.classList.remove('active')
        clearObstructionBlocks()
        clearInteractiveGrid(false)
        if (activeScheduleId) loadScheduleShifts()
      } else {
        activeRoleId = role.id
        document.querySelectorAll('.filter-options .btn').forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
        clearObstructionBlocks()
        clearInteractiveGrid(false)

        const localShifts = localSchedule.getForRole(role.id)
        if (localShifts.length > 0) {
          await loadRoleView(role.id, window.TEAM_ID)
          renderShiftsToGrid(localShifts, true)
        } else {
          await loadRoleView(role.id, window.TEAM_ID)
          await loadScheduleShifts()
        }
      }
    }
    container.appendChild(btn)
  })
}

function snapshotCurrentGrid() {
  if (!activeRoleId) return

  const shifts = []

  document.querySelectorAll('#mainGrid .shift-block:not(.temp)').forEach(block => {
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

async function loadRoleView(roleId, teamId) {
  const response = await fetch(`/api/team/${teamId}/roles/${roleId}`)
  const data = await response.json()
  const workers = data.workers

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

      const shifts = worker.availability.filter(a => a.day.toLowerCase() === dayKey)
      shifts.forEach(range => {
        const startOffset = range.start_min - START_HOUR * 60
        const top = (startOffset / 15) * SLOT_HEIGHT
        const height = ((range.end_min - range.start_min) / 15) * SLOT_HEIGHT

        const block = document.createElement('div')
        block.className = 'event-block avail-block'
        block.style.top = `${top}px`
        block.style.height = `${height}px`
        block.innerHTML = `<div class="event-title" style="font-size:9px;">${worker.name}</div>`
        workerCol.appendChild(block)
      })

      obstructions.forEach(o => {
        if (o.role_id !== parseInt(roleId)) return
        if (!o.days.includes(dayKey)) return

        const workerData = (
          typeof window.WORKERS === 'string' ? JSON.parse(window.WORKERS) : window.WORKERS
        ).find(w => w.id === String(worker.id))

        if (!o.days.includes(dayKey)) return
        if (o.section && workerData?.section !== o.section) return

        const startOffset = o.start_min - START_HOUR * 60
        const top = (startOffset / 15) * SLOT_HEIGHT
        const height = ((o.end_min - o.start_min) / 15) * SLOT_HEIGHT

        const block = document.createElement('div')
        block.className = 'event-block obstruction-block'
        block.style.top = `${top}px`
        block.style.height = `${height}px`
        block.innerHTML = `
          <div class="event-content">
            <div class="event-title" style="font-size:9px;">${o.name}</div>
          </div>`
        workerCol.appendChild(block)
      })
    })
  })
}
