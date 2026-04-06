async function loadWorker(workerId, teamId, name, element) {
  activeRoleId = null
  document.querySelectorAll('.filter-options .btn').forEach(btn => btn.classList.remove('active'))
  document.querySelectorAll('.worker-item').forEach(item => item.classList.remove('active'))
  element.classList.add('active')
  document.getElementById('viewingWorkerLabel').textContent = `${name} - Availability`

  buildSingleWorkerGrid(name)
  renderWorkerObstructions(workerId)

  const dayMap = { sun: '0', mon: '1', tue: '2', wed: '3', thu: '4', fri: '5', sat: '6' }

  try {
    const response = await fetch(`/api/team/${teamId}/get-availability/${workerId}/`)
    if (!response.ok) throw new Error('Failed to fetch worker availability')
    const data = await response.json()

    data.availabilityData.forEach(range => {
      const dayIndex = dayMap[range.day]
      const dayCol = document.querySelector(`#mainGrid .day-col[data-day="${dayIndex}"]`)
      if (!dayCol) return

      const startOffset = range.start_min - START_HOUR * 60
      const top = (startOffset / 15) * SLOT_HEIGHT
      const height = ((range.end_min - range.start_min) / 15) * SLOT_HEIGHT

      const block = document.createElement('div')
      block.className = 'event-block avail-block'
      block.style.top = `${top}px`
      block.style.height = `${height}px`
      block.innerHTML = `
        <div class="event-content">
          <div class="event-title">${range.eventName}</div>
          <div class="event-building">${range.building}</div>
          <div class="event-time">${range.label}</div>
        </div>`
      dayCol.appendChild(block)
    })

    if (activeScheduleId) {
      const shiftRes = await fetch(
        `/api/team/${teamId}/schedules/${activeScheduleId}/shifts/`
      )
      const shiftData = await shiftRes.json()

      const rooms =
        typeof window.ROOMS === 'string' ? JSON.parse(window.ROOMS) : window.ROOMS

      const workerShifts = shiftData.shifts
        .filter(s => s.user_id == workerId)
        .map(shift => {
          const room = rooms.find(r => r.id == shift.room_id)
          return {
            ...shift,
            user_name: name,
            room_name: room ? room.name : '',
            isSaved: true
          }
        })

      renderShiftsToGrid(workerShifts, false)
    }
  } catch (error) {
    console.error('Error loading worker:', error)
  }
}

function filterWorkers() {
  const input = document.getElementById('workerSearch').value.toLowerCase()
  document.querySelectorAll('.worker-item').forEach(item => {
    const name = item.querySelector('span').textContent.toLowerCase()
    item.style.display = name.includes(input) ? 'flex' : 'none'
  })
}

function openWorkerEditModal(workerId, workerName) {
  editingWorkerId = workerId
  document.getElementById('workerEditName').textContent = workerName
  document.getElementById('workerEditModal').classList.add('show')

  const roles =
    typeof window.ROLES === 'string' ? JSON.parse(window.ROLES) : window.ROLES
  const workers =
    typeof window.WORKERS === 'string' ? JSON.parse(window.WORKERS) : window.WORKERS
  const worker = workers.find(w => w.id === workerId)

  const roleSelect = document.getElementById('workerEditRole')
  roleSelect.innerHTML = '<option value="">No Role</option>'
  roles.forEach(r => {
    const opt = new Option(r.name, r.id)
    if (worker?.role_id === r.id) opt.selected = true
    roleSelect.appendChild(opt)
  })

  if (worker?.role_id) {
    onWorkerEditRoleChange(roleSelect, worker.section)
  } else {
    document.getElementById('workerEditSectionGroup').style.display = 'none'
  }
}

function onWorkerEditRoleChange(select, preselectSectionName = null) {
  const roleId = parseInt(select.value)
  const roles =
    typeof window.ROLES === 'string' ? JSON.parse(window.ROLES) : window.ROLES
  const role = roles.find(r => r.id === roleId)

  const sectionGroup = document.getElementById('workerEditSectionGroup')
  const sectionSelect = document.getElementById('workerEditSection')

  if (!role || !role.sections || role.sections.length === 0) {
    sectionGroup.style.display = 'none'
    return
  }

  sectionSelect.innerHTML = '<option value="">No Section</option>'
  role.sections.forEach(s => {
    const opt = new Option(s.name, s.id)
    if (preselectSectionName && s.name === preselectSectionName) opt.selected = true
    sectionSelect.appendChild(opt)
  })
  sectionGroup.style.display = 'block'
}

function closeWorkerEditModal() {
  document.getElementById('workerEditModal').classList.remove('show')
  editingWorkerId = null
}

async function saveWorkerAssignment() {
  const roleId = document.getElementById('workerEditRole').value || null
  const sectionId = document.getElementById('workerEditSection').value || null

  try {
    const res = await fetch(`/api/team/${window.TEAM_ID}/members/save-assignments/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken
      },
      body: JSON.stringify({
        assignments: [
          {
            user_id: editingWorkerId,
            role_id: roleId,
            section_id: sectionId
          }
        ]
      })
    })

    if (res.ok) {
      const workers =
        typeof window.WORKERS === 'string' ? JSON.parse(window.WORKERS) : window.WORKERS
      const worker = workers.find(w => w.id === editingWorkerId)
      if (worker) {
        worker.role_id = roleId ? parseInt(roleId) : null
        const sectionSelect = document.getElementById('workerEditSection')
        worker.section = sectionId
          ? sectionSelect.options[sectionSelect.selectedIndex].text
          : null
        window.WORKERS = workers
      }
      closeWorkerEditModal()
      alert('✓ Assignment saved.')
    } else {
      alert('Failed to save.')
    }
  } catch (err) {
    console.error(err)
    alert('An error occurred.')
  }
}
