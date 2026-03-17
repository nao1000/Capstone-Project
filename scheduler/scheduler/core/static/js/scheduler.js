const START_HOUR = 8 // 8:00 AM
const END_HOUR = 18 // 6:00 PM
const SLOT_HEIGHT = 15 // Matches --slot-height in CSS

let isDragging = false
let startTop = 0
let activeEvent = null
let activeCol = null
let currentStartMin = 0
let currentEndMin = 0

// Local schedule store - persists across filter switches
const localSchedule = {
  shifts: {}, // keyed by `${roleId}-${dayIndex}-${top}` for uniqueness

  save (roleId, shifts) {
    // Clear existing shifts for this role
    Object.keys(this.shifts).forEach(key => {
      if (key.startsWith(`${roleId}-`)) delete this.shifts[key]
    })
    // Store new ones
    shifts.forEach(s => {
      const key = `${roleId}-${s.day}-${s.start_min}`
      this.shifts[key] = s
    })
  },

  getForRole (roleId) {
    return Object.values(this.shifts).filter(s => s.role_id === roleId)
  },

  getAll () {
    return Object.values(this.shifts)
  },

  clear (roleId = null) {
    if (roleId) {
      Object.keys(this.shifts).forEach(key => {
        if (key.startsWith(`${roleId}-`)) delete this.shifts[key]
      })
    } else {
      this.shifts = {}
    }
  }
}

const csrfToken = document
  .querySelector('meta[name="csrf-token"]')
  .getAttribute('content')

document.addEventListener('DOMContentLoaded', () => {
  drawTimeLabels('viewTimeCol')
  drawTimeLabels('interactiveTimeCol')
  setupDragListeners()
  setupSyncHover()
  console.log(window.TEAM_ID)
  initFilters()
  initSchedules()
  setupHeaderSync()
})

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

function buildSingleWorkerGrid (workerName) {
  const header = document.getElementById('viewGridHeader')
  const grid = document.getElementById('viewGrid')

  header.innerHTML =
    '<div class="header-cell time-header" style="width:60px;">Time</div>'
  grid.innerHTML = ''
  grid.className = 'single-worker' // or grid.classList.add('single-worker')
  const timeCol = document.createElement('div')
  timeCol.className = 'time-col'
  timeCol.id = 'viewTimeCol'
  timeCol.style.cssText = 'width:60px; flex-shrink:0;'
  grid.appendChild(timeCol)
  drawTimeLabels('viewTimeCol')

  DAY_NAMES.forEach((day, i) => {
    const headerCell = document.createElement('div')
    headerCell.className = 'header-cell'
    headerCell.style.cssText = 'width:120px; flex-shrink:0;'
    headerCell.textContent = day
    header.appendChild(headerCell)

    const col = document.createElement('div')
    col.className = 'day-col'
    col.dataset.day = i
    col.style.cssText = 'width:120px; flex-shrink:0;'
    grid.appendChild(col)
  })
}

function buildRoleGrid (workers) {
  const header = document.getElementById('viewGridHeader')
  const grid = document.getElementById('viewGrid')
  const colWidth = Math.floor(getInteractiveColWidth())

  header.innerHTML =
    '<div class="header-cell time-header" style="width:60px;">Time</div>'
  grid.innerHTML = ''
  grid.className = '' // resets to default
  const timeCol = document.createElement('div')
  timeCol.className = 'time-col'
  timeCol.id = 'viewTimeCol'
  timeCol.style.cssText = 'width:60px; flex-shrink:0;'
  grid.appendChild(timeCol)
  drawTimeLabels('viewTimeCol')

  DAY_NAMES.forEach((dayName, dayIndex) => {
    const groupWidth = workers.length * colWidth

    // Header group
    const headerGroup = document.createElement('div')
    headerGroup.style.cssText = `display:flex; flex-direction:column; border-right:2px solid #c0c0c0; flex-shrink:0; width:${groupWidth}px;`

    const dayLabel = document.createElement('div')
    dayLabel.style.cssText =
      'text-align:center; font-weight:700; font-size:13px; text-transform:uppercase; color:#555; border-bottom:1px solid #e0e0e0; padding:4px 0; width:100%;'
    dayLabel.textContent = dayName

    const workerLabels = document.createElement('div')
    workerLabels.style.display = 'flex'

    workers.forEach(w => {
      const wLabel = document.createElement('div')
      wLabel.style.cssText = `width:${colWidth}px; flex-shrink:0; font-size:10px; font-weight:600; text-align:center; color:#777; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; border-right:1px solid #e0e0e0; padding:2px 4px;`
      // In loadRoleView, when building worker labels
      wLabel.textContent = w.section ? `${w.name} (${w.section})` : w.name
      workerLabels.appendChild(wLabel)
    })

    headerGroup.appendChild(dayLabel)
    headerGroup.appendChild(workerLabels)
    header.appendChild(headerGroup)

    // Grid columns for this day
    workers.forEach(w => {
      const workerCol = document.createElement('div')
      workerCol.className = 'worker-sub-col day-col'
      workerCol.dataset.day = dayIndex
      workerCol.dataset.workerId = w.id
      workerCol.style.cssText = `width:${colWidth}px; flex-shrink:0; position:relative; border-right:1px solid #e0e0e0;`
      grid.appendChild(workerCol)
    })

    // Day separator
    const separator = document.createElement('div')
    separator.style.cssText = 'width:2px; flex-shrink:0; background:#c0c0c0;'
    grid.appendChild(separator)
  })
}

async function loadRoleView (roleId, teamId) {
  const response = await fetch(`/api/team/${teamId}/roles/${roleId}`)
  const data = await response.json()
  const workers = data.workers

  buildRoleGrid(workers)

  const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  const obstructions =
    typeof window.OBSTRUCTIONS === 'string'
      ? JSON.parse(window.OBSTRUCTIONS)
      : window.OBSTRUCTIONS

  workers.forEach(worker => {
    dayKeys.forEach((dayKey, dayIndex) => {
      const workerCol = document.querySelector(
        `.worker-sub-col[data-day="${dayIndex}"][data-worker-id="${worker.id}"]`
      )
      if (!workerCol) return

      // Draw availability
      const shifts = worker.availability.filter(
        a => a.day.toLowerCase() === dayKey
      )
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

      // Draw obstructions relevant to this worker
      obstructions.forEach(o => {
        console.log(
          'o.role_id:',
          o.role_id,
          typeof o.role_id,
          '| roleId:',
          roleId,
          typeof roleId
        )
        if (o.role_id !== parseInt(roleId)) return
        console.log('o.days:', o.days, '| dayKey:', dayKey)
        if (!o.days.includes(dayKey)) return

        // Match section: null section = applies to all, specific section_id = only that worker

        const workerData = (
          typeof window.WORKERS === 'string'
            ? JSON.parse(window.WORKERS)
            : window.WORKERS
        ).find(w => w.id === String(worker.id))
        // null obstruction section = applies to all workers in role
        // specific section = only workers whose section name matches
        if (!o.days.includes(dayKey)) return
        console.log(
          'o.section:',
          o.section,
          '| workerData?.section:',
          workerData?.section
        )
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

let activeRoleId = null

function initFilters () {
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
      // Snapshot current grid before switching
      snapshotCurrentGrid()

      if (activeRoleId === role.id) {
        activeRoleId = null
        btn.classList.remove('active')
        clearObstructionBlocks()
        clearInteractiveGrid(false)
        if (activeScheduleId) loadScheduleShifts()
      } else {
        activeRoleId = role.id
        document
          .querySelectorAll('.filter-options .btn')
          .forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
        clearObstructionBlocks()
        clearInteractiveGrid(false)

        // Load from local store first, fall back to DB
        const localShifts = localSchedule.getForRole(role.id)
        if (localShifts.length > 0) {
          renderShiftsToGrid(localShifts, true)
          await Promise.all([
            loadRoleView(role.id, window.TEAM_ID),
            loadObstructions(role.id)
          ])
        } else {
          await Promise.all([
            loadRoleView(role.id, window.TEAM_ID),
            loadObstructions(role.id),
            loadScheduleShifts()
          ])
        }
      }
    }
    container.appendChild(btn)
  })
}

function snapshotCurrentGrid () {
  if (!activeRoleId) return

  const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  const shifts = []

  document
    .querySelectorAll('#interactiveGrid .shift-block:not(.temp)')
    .forEach(block => {
      const dayIndex = parseInt(block.parentElement.dataset.day)
      const topPx = parseFloat(block.style.top)
      const heightPx = parseFloat(block.style.height)

      const startMin = Math.round(topPx / SLOT_HEIGHT) * 15 + START_HOUR * 60
      const endMin = startMin + Math.round(heightPx / SLOT_HEIGHT) * 15

      shifts.push({
        user_id: block.dataset.workerId,
        user_name: block.querySelector('.event-title').textContent,
        role_id: activeRoleId,
        room_id: block.dataset.roomId || null,
        room_name: block.querySelector('.event-loc')?.textContent || null,
        day: dayNames[dayIndex],
        start_min: startMin,
        end_min: endMin,
        isSaved: block.classList.contains('saved') // track saved state
      })
    })

  localSchedule.save(activeRoleId, shifts)
}

function loadObstructions (roleId) {
  const obstructions =
    typeof window.OBSTRUCTIONS === 'string'
      ? JSON.parse(window.OBSTRUCTIONS)
      : window.OBSTRUCTIONS

  // Get the current worker's section from WORKERS
  const workers =
    typeof window.WORKERS === 'string'
      ? JSON.parse(window.WORKERS)
      : window.WORKERS

  const dayMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }

  obstructions
    .filter(o => o.role_id === roleId)
    .forEach(o => {
      o.days.forEach(day => {
        const dayIndex = dayMap[day]
        const col = document.querySelector(
          `#interactiveGrid .day-col[data-day="${dayIndex}"]`
        )
        if (!col) return

        const startOffset = o.start_min - START_HOUR * 60
        const top = (startOffset / 15) * SLOT_HEIGHT
        const durationMin = o.end_min - o.start_min
        const ceiledDuration = Math.ceil(durationMin / 15) * 15 // round up to next 15
        const height = (ceiledDuration / 15) * SLOT_HEIGHT

        const block = document.createElement('div')
        block.className = 'event-block obstruction-block'
        block.style.top = `${top}px`
        block.style.height = `${height}px`
        block.innerHTML = `
    <div class="event-content">
        <div class="event-title">${o.name}</div>
        <div class="event-time">${formatMin(o.start_min)} - ${formatMin(
          o.end_min
        )}</div>
    </div>`
        col.appendChild(block)
      })
    })
}

function clearObstructionBlocks () {
  document.querySelectorAll('.obstruction-block').forEach(b => b.remove())
}
/* --- TIME LABELS --- */
function drawTimeLabels (containerId) {
  const timeCol = document.getElementById(containerId)
  const totalHours = END_HOUR - START_HOUR

  for (let h = START_HOUR; h <= END_HOUR; h++) {
    if (h === END_HOUR) continue // Skip bottom edge label

    const label = document.createElement('div')
    label.className = 'time-label'

    const suffix = h >= 12 ? 'PM' : 'AM'
    const displayH = h > 12 ? h - 12 : h === 0 || h === 12 ? 12 : h
    label.textContent = `${displayH} ${suffix}`

    const percentTop = ((h - START_HOUR) / totalHours) * 100
    label.style.top = `${percentTop}%`
    timeCol.appendChild(label)
  }
}

/* --- DRAG & DROP LOGIC (Interactive Grid Only) --- */
function setupDragListeners () {
  // ONLY select day columns inside the interactive grid
  const interactiveCols = document.querySelectorAll('#interactiveGrid .day-col')

  interactiveCols.forEach(col => {
    col.addEventListener('mousedown', e => {
      if (e.target.closest('.event-block')) return

      isDragging = true
      activeCol = col

      const rect = col.getBoundingClientRect()
      const relativeY = e.clientY - rect.top

      // Snap to grid (15 mins = 20px)
      startTop = Math.floor(relativeY / SLOT_HEIGHT) * SLOT_HEIGHT

      activeEvent = document.createElement('div')
      activeEvent.className = 'event-block shift-block temp'
      activeEvent.style.top = `${startTop}px`
      activeEvent.style.height = `${SLOT_HEIGHT}px`
      activeEvent.innerHTML = `<div class="event-content"><div class="event-title">New Shift</div></div>`

      col.appendChild(activeEvent)
    })
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
      const maxHeight = getMaxHeightBeforeObstruction(
        activeCol,
        startTop,
        newHeight
      )
      newHeight = maxHeight
    }
    activeEvent.style.height = `${newHeight}px`
  })

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false
      openModal()
    }
  })
}

function getMaxHeightBeforeObstruction (col, startTopPx, desiredHeight) {
  const dayIndex = col.dataset.day
  const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  const dayKey = dayNames[parseInt(dayIndex)]

  const obstructions =
    typeof window.OBSTRUCTIONS === 'string'
      ? JSON.parse(window.OBSTRUCTIONS)
      : window.OBSTRUCTIONS

  const eventStartMin = (startTopPx / SLOT_HEIGHT) * 15 + START_HOUR * 60
  const eventEndMin = eventStartMin + (desiredHeight / SLOT_HEIGHT) * 15

  // Find obstructions for active role on this day that we are about to enter
  const blocking = obstructions.filter(
    o =>
      o.role_id === activeRoleId &&
      o.days.includes(dayKey) &&
      o.start_min >= eventStartMin && // obstruction starts after our block starts
      o.start_min < eventEndMin // and we are dragging into it
  )

  if (blocking.length === 0) return desiredHeight

  // Find the nearest obstruction start
  const nearestStart = Math.min(...blocking.map(o => o.start_min))

  // Convert back to pixels
  const maxHeight = ((nearestStart - eventStartMin) / 15) * SLOT_HEIGHT
  return Math.max(maxHeight, SLOT_HEIGHT) // always at least one slot tall
}
/* --- MODAL LOGIC --- */
function openModal () {
  const modal = document.getElementById('eventModal')
  modal.classList.add('show')
  console.log(window.ROOMS)
  const workers =
    typeof window.WORKERS === 'string'
      ? JSON.parse(window.WORKERS)
      : window.WORKERS
  const roles =
    typeof window.ROLES === 'string' ? JSON.parse(window.ROLES) : window.ROLES
  const rooms =
    typeof window.ROOMS === 'string' ? JSON.parse(window.ROOMS) : window.ROOMS

  // --- WORKER DROPDOWN ---
  const workerSelect = document.getElementById('modalWorkerSelect')
  workerSelect.innerHTML = '<option value="">Select a worker...</option>'
  const filteredWorkers = activeRoleId
    ? workers.filter(w => w.role_id === activeRoleId)
    : workers
  filteredWorkers.forEach(w => {
    const option = document.createElement('option')
    option.value = w.id
    option.textContent = w.name
    workerSelect.appendChild(option)
  })

  // --- ROLE DROPDOWN ---
  const roleSelect = document.getElementById('modalRoleSelect')
  roleSelect.innerHTML = ''
  if (activeRoleId) {
    // Lock to active filter role
    const activeRole = roles.find(r => r.id === activeRoleId)
    if (activeRole) {
      roleSelect.appendChild(
        new Option(activeRole.name, activeRole.id, true, true)
      )
    }
    roleSelect.disabled = true
  } else {
    roleSelect.disabled = false
    roleSelect.innerHTML = '<option value="">Select a role...</option>'
    roles.forEach(r => {
      roleSelect.appendChild(new Option(r.name, r.id))
    })
  }

  // --- ROOM DROPDOWN ---
  const roomSelect = document.getElementById('modalRoomSelect')
  roomSelect.innerHTML = '<option value="">Select a room...</option>'
  console.log(rooms)
  rooms.forEach(r => {
    roomSelect.appendChild(new Option(r.name, r.id))
  })

  document.getElementById('modalTimeDisplay').textContent = ''

  const topPx = parseFloat(activeEvent.style.top)
  const heightPx = parseFloat(activeEvent.style.height)
  const startSlotIndex = Math.round(topPx / SLOT_HEIGHT)
  const slotsCount = Math.round(heightPx / SLOT_HEIGHT)

  currentStartMin = startSlotIndex * 15 + START_HOUR * 60
  currentEndMin = currentStartMin + slotsCount * 15

  document.getElementById('modalTimeDisplay').textContent = `${formatMin(
    currentStartMin
  )} - ${formatMin(currentEndMin)} (${slotsCount * 15} mins)`
  const dayIndex = parseInt(activeCol.dataset.day)
  annotateRoomDropdown(dayIndex)
}

function closeModal () {
  document.getElementById('eventModal').classList.remove('show')
  if (activeEvent && activeEvent.classList.contains('temp')) {
    activeEvent.remove()
  }
  activeEvent = null
}

async function annotateRoomDropdown (dayIndex) {
  if (!activeScheduleId) return

  const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  const day = dayNames[dayIndex]

  const [bookingsRes, availRes] = await Promise.all([
    fetch(
      `/api/team/${window.TEAM_ID}/schedules/${activeScheduleId}/room-bookings/?day=${day}`
    ),
    fetch(`/api/team/${window.TEAM_ID}/room-availability/?day=${day}`)
  ])

  const bookingsData = await bookingsRes.json()
  const availData = await availRes.json()

  console.log('bookings:', bookingsData)
  console.log('availability:', availData)
  const bookings = bookingsData.bookings
  const roomAvailability = availData.availability

  // Merge local shifts into bookings
  const allLocalShifts = localSchedule.getAll().filter(s => s.day === day)
  allLocalShifts.forEach(s => {
    if (!s.room_id) return
    const roomId = s.room_id
    if (!bookings[roomId]) {
      // Find capacity from ROOMS
      const rooms =
        typeof window.ROOMS === 'string'
          ? JSON.parse(window.ROOMS)
          : window.ROOMS
      const room = rooms.find(r => r.id === roomId)
      bookings[roomId] = {
        capacity: room ? room.capacity : 1,
        shifts: []
      }
    }
    // Only add if not already in DB bookings (avoid double counting saved shifts)
    const alreadyExists = bookings[roomId].shifts.some(
      existing =>
        existing.user_name === s.user_name &&
        existing.start_min === s.start_min &&
        existing.end_min === s.end_min
    )
    if (!alreadyExists) {
      bookings[roomId].shifts.push({
        user_name: s.user_name,
        start_min: s.start_min,
        end_min: s.end_min,
        day: s.day
      })
    }
  })

  // Rest of the dropdown building stays the same
  const roomSelect = document.getElementById('modalRoomSelect')
  const rooms =
    typeof window.ROOMS === 'string' ? JSON.parse(window.ROOMS) : window.ROOMS
  const currentValue = roomSelect.value
  roomSelect.innerHTML = '<option value="">Select a room...</option>'
  console.log(
    'room ids:',
    rooms.map(r => r.id)
  )
  console.log('availability keys:', Object.keys(roomAvailability))
  rooms.forEach(r => {
    const option = document.createElement('option')
    option.value = r.id
    console.log('looking up room id:', r.id)
    console.log('availability keys:', Object.keys(roomAvailability))
    console.log('direct lookup:', roomAvailability[r.id])
    console.log('r.id type:', typeof r.id, JSON.stringify(r.id))
    console.log(
      'first avail key type:',
      typeof Object.keys(roomAvailability)[0],
      JSON.stringify(Object.keys(roomAvailability)[0])
    )
    const availSlots = roomAvailability[r.id] || []
    const isAvailable = availSlots.some(
      slot => currentStartMin >= slot.start_min && currentEndMin <= slot.end_min
    )

    console.log('currentStartMin:', currentStartMin)
    console.log('slot.start_min:', availSlots[0]?.start_min)

    if (!isAvailable) {
      option.textContent = `${r.name} (Not available)`
      option.disabled = true
      option.style.color = '#999'
    } else {
      const booking = bookings[r.id]
      if (booking) {
        const overlapping = booking.shifts.filter(
          s => currentStartMin < s.end_min && currentEndMin > s.start_min
        )
        if (overlapping.length >= booking.capacity) {
          const names = overlapping.map(s => s.user_name).join(', ')
          option.textContent = `${r.name} (Full — ${names})`
          option.disabled = true
          option.style.color = '#999'
        } else if (overlapping.length > 0) {
          const names = overlapping.map(s => s.user_name).join(', ')
          option.textContent = `${r.name} (${overlapping.length}/${booking.capacity} — ${names})`
        } else {
          option.textContent = r.name
        }
      } else {
        option.textContent = r.name
      }
    }

    if (r.id === currentValue) option.selected = true
    roomSelect.appendChild(option)
  })
}

function saveEvent () {
  const workerSelect = document.getElementById('modalWorkerSelect')
  const roleSelect = document.getElementById('modalRoleSelect')
  const roomSelect = document.getElementById('modalRoomSelect')

  const name = workerSelect.options[workerSelect.selectedIndex]?.text || 'Shift'
  const workerId = workerSelect.value
  const roleId = roleSelect.value
  const roomId = roomSelect.value
  const roomName = roomSelect.options[roomSelect.selectedIndex]?.text || ''

  if (!workerId) {
    alert('Please select a worker.')
    return
  }

  const timeString = `${formatMin(currentStartMin)} - ${formatMin(
    currentEndMin
  )}`
  const heightPx = parseFloat(activeEvent.style.height)
  const isSmall = heightPx < SLOT_HEIGHT * 2.5

  if (activeEvent) {
    activeEvent.classList.remove('temp')
    activeEvent.classList.add('local') // add this
    activeEvent.dataset.workerId = workerId
    activeEvent.dataset.roleId = roleId
    activeEvent.dataset.roomId = roomId

    let html = `
            <div class="delete-x" onclick="removeEventBlock(event, this)">×</div>
            <div class="event-content">
                <div class="event-title">${name}</div>
                <div class="event-time">${timeString}</div>`

    if (!isSmall && roomName) html += `<div class="event-loc">${roomName}</div>`
    html += `</div>`

    activeEvent.innerHTML = html
  }

  document.getElementById('eventModal').classList.remove('show')
  activeEvent = null
}

function removeEventBlock (e, xButton) {
  e.stopPropagation() // Don't trigger drag
  if (confirm('Remove this shift?')) {
    xButton.closest('.event-block').remove()
  }
}

function clearInteractiveGrid (withConfirm = true) {
  if (withConfirm && !confirm('Clear all assigned shifts?')) return
  document
    .querySelectorAll('#interactiveGrid .shift-block')
    .forEach(el => el.remove())
}

let activeScheduleId = null

// Called on page load
async function initSchedules () {
  const res = await fetch(`/api/team/${window.TEAM_ID}/schedules/`)
  const data = await res.json()

  const select = document.getElementById('scheduleSelect')
  select.innerHTML = '<option value="">Select schedule...</option>'

  data.schedules.forEach(s => {
    const option = document.createElement('option')
    option.value = s.id
    option.textContent = s.is_active ? `${s.name} ✓` : s.name
    if (s.is_active) {
      option.selected = true
      activeScheduleId = s.id
    }
    select.appendChild(option)
  })

  // Auto load active schedule if one exists
  if (activeScheduleId) {
    loadScheduleShifts()
  }
}

function openCreateScheduleModal () {
  document.getElementById('createScheduleModal').classList.add('show')
  document.getElementById('newScheduleName').value = ''
  document.getElementById('newScheduleName').focus()
}

function closeCreateScheduleModal () {
  document.getElementById('createScheduleModal').classList.remove('show')
}

async function createSchedule () {
  const name = document.getElementById('newScheduleName').value.trim()
  if (!name) {
    alert('Please enter a schedule name.')
    return
  }

  try {
    const res = await fetch(`/api/team/${window.TEAM_ID}/schedules/create/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken
      },
      body: JSON.stringify({ name })
    })

    const data = await res.json()

    if (!res.ok) {
      alert(data.error || 'Failed to create schedule.')
      return
    }

    // Add to dropdown and select it
    const select = document.getElementById('scheduleSelect')
    const option = document.createElement('option')
    option.value = data.id
    option.textContent = data.name
    option.selected = true
    select.appendChild(option)

    activeScheduleId = data.id
    clearInteractiveGrid(false)
    closeCreateScheduleModal()
  } catch (err) {
    console.error(err)
    alert('An error occurred.')
  }
}

async function loadScheduleShifts () {
  const select = document.getElementById('scheduleSelect')
  activeScheduleId = select.value
  if (!activeScheduleId) return

  clearInteractiveGrid(false)

  const roleParam = activeRoleId ? `?role_id=${activeRoleId}` : ''

  try {
    const res = await fetch(
      `/api/team/${window.TEAM_ID}/schedules/${activeScheduleId}/shifts/${roleParam}`
    )
    const data = await res.json()

    // Populate local store with DB data
    if (activeRoleId) {
      localSchedule.save(
        activeRoleId,
        data.shifts.map(s => ({
          ...s,
          user_name: s.user_name,
          room_name: s.room_name,
          isSaved: true
        }))
      )
    }

    renderShiftsToGrid(data.shifts, false)
  } catch (err) {
    console.error('Error loading shifts:', err)
  }
}

async function setActiveSchedule () {
  if (!activeScheduleId) {
    alert('Please select a schedule first.')
    return
  }

  try {
    const res = await fetch(
      `/api/team/${window.TEAM_ID}/schedules/set-active/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken
        },
        body: JSON.stringify({ schedule_id: activeScheduleId })
      }
    )

    if (res.ok) {
      // Update dropdown labels to show checkmark on active
      const select = document.getElementById('scheduleSelect')
      Array.from(select.options).forEach(opt => {
        opt.textContent = opt.textContent.replace(' ✓', '')
        if (parseInt(opt.value) === activeScheduleId) {
          opt.textContent += ' ✓'
        }
      })
      alert('Schedule set as active.')
    }
  } catch (err) {
    console.error(err)
  }
}

async function saveAllPreferences () {
  if (!activeScheduleId) {
    alert('Please select or create a schedule first.')
    return
  }

  if (!activeRoleId) {
    alert('Please select a role filter before saving.')
    return
  }

  // Snapshot current grid first
  snapshotCurrentGrid()

  const shifts = localSchedule.getForRole(activeRoleId)

  try {
    const res = await fetch(
      `/api/team/${window.TEAM_ID}/schedules/save-shifts/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken
        },
        body: JSON.stringify({
          schedule_id: activeScheduleId,
          role_id: activeRoleId,
          shifts
        })
      }
    )

    const data = await res.json()

    if (data.conflicts && data.conflicts.length > 0) {
      const messages = data.conflicts.map(c => `⚠️ ${c.message}`).join('\n')
      alert(`Saved with conflicts:\n\n${messages}`)
    } else {
      alert(`✓ Saved ${data.saved} shifts successfully.`)
      // At the end of saveAllPreferences on success
      document
        .querySelectorAll('#interactiveGrid .shift-block.local')
        .forEach(block => {
          block.classList.remove('local')
          block.classList.add('saved')
        })
    }
  } catch (err) {
    console.error('Error saving shifts:', err)
    alert('An error occurred while saving.')
  }
}

function formatTime (topPx) {
  const totalMinutes = (topPx / SLOT_HEIGHT) * 15 + START_HOUR * 60
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  const suffix = h >= 12 ? 'PM' : 'AM'
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${displayH}:${m.toString().padStart(2, '0')} ${suffix}`
}

async function loadWorker (workerId, teamId, name, element) {
  document
    .querySelectorAll('.worker-item')
    .forEach(item => item.classList.remove('active'))
  element.classList.add('active')
  document.getElementById(
    'viewingWorkerLabel'
  ).textContent = `${name} - Availability`

  // Rebuild grid for single worker
  buildSingleWorkerGrid(name)

  const dayMap = {
    sun: '0',
    mon: '1',
    tue: '2',
    wed: '3',
    thu: '4',
    fri: '5',
    sat: '6'
  }

  try {
    const response = await fetch(
      `/api/team/${teamId}/get-availability/${workerId}/`
    )
    if (!response.ok) throw new Error('Failed to fetch worker availability')
    const data = await response.json()

    data.availabilityData.forEach(range => {
      const dayIndex = dayMap[range.day]
      const dayCol = document.querySelector(
        `#viewGrid .day-col[data-day="${dayIndex}"]`
      )
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
                    <div class="event-title">Available</div>
                    <div class="event-time">${range.label}</div>
                </div>`
      dayCol.appendChild(block)
    })
  } catch (error) {
    console.error('Error loading worker:', error)
  }
}

function filterWorkers () {
  const input = document.getElementById('workerSearch').value.toLowerCase()
  document.querySelectorAll('.worker-item').forEach(item => {
    const name = item.querySelector('span').textContent.toLowerCase()
    item.style.display = name.includes(input) ? 'flex' : 'none'
  })
}

function formatMin (totalMinutes) {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  const suffix = h >= 12 ? 'PM' : 'AM'
  const displayH = h > 12 ? h - 12 : h === 0 || h === 12 ? 12 : h
  const displayM = m < 10 ? '0' + m : m
  return `${displayH}:${displayM} ${suffix}`
}

/* --- MOCK DATA --- */
function mockLoadAvailability () {
  // Draw a fake availability block on Monday (data-day="1") from 9:00 AM to 12:00 PM
  const dayCol = document.querySelector('#viewGrid .day-col[data-day="1"]')
  const startMins = 9 * 60 - START_HOUR * 60 // 9AM relative to 8AM
  const endMins = 12 * 60 - START_HOUR * 60 // 12PM relative to 8AM

  const topPx = (startMins / 15) * SLOT_HEIGHT
  const heightPx = ((endMins - startMins) / 15) * SLOT_HEIGHT

  const block = document.createElement('div')
  block.className = 'event-block avail-block'
  block.style.top = `${topPx}px`
  block.style.height = `${heightPx}px`
  block.innerHTML = `
                <div class="event-content">
                    <div class="event-title">Available</div>
                    <div class="event-time">9:00 AM - 12:00 PM</div>
                </div>`
  dayCol.appendChild(block)
}
/* --- SYNCHRONIZED HOVER EFFECT --- */
function setupSyncHover () {
  const interactiveGrid = document.getElementById('interactiveGrid')
  const iHighlight = document.createElement('div')
  iHighlight.className = 'sync-highlight'

  // We'll create highlights dynamically for all view cols
  let activeViewHighlights = []

  interactiveGrid.addEventListener('mousemove', e => {
    const col = e.target.closest('#interactiveGrid .day-col')
    if (!col) {
      iHighlight.classList.remove('active')
      activeViewHighlights.forEach(h => h.classList.remove('active'))
      return
    }

    const rect = col.getBoundingClientRect()
    const snappedTop =
      Math.floor((e.clientY - rect.top) / SLOT_HEIGHT) * SLOT_HEIGHT

    // Interactive grid highlight
    col.appendChild(iHighlight)
    iHighlight.style.top = `${snappedTop}px`
    iHighlight.classList.add('active')

    // Clear previous view highlights
    activeViewHighlights.forEach(h => h.classList.remove('active'))
    activeViewHighlights = []

    // Highlight ALL sub-columns for this day in the view grid
    const dayIndex = col.dataset.day
    const viewCols = document.querySelectorAll(
      `#viewGrid .day-col[data-day="${dayIndex}"]`
    )

    viewCols.forEach(viewCol => {
      const h = document.createElement('div')
      h.className = 'sync-highlight active'
      h.style.top = `${snappedTop}px`
      viewCol.appendChild(h)
      activeViewHighlights.push(h)
    })
  })

  interactiveGrid.addEventListener('mouseleave', () => {
    iHighlight.classList.remove('active')
    activeViewHighlights.forEach(h => h.remove())
    activeViewHighlights = []
  })
}

document.addEventListener('DOMContentLoaded', () => {
  const interactiveGrid = document.getElementById('interactiveGrid')

  interactiveGrid.addEventListener('dblclick', e => {
    const block = e.target.closest('.shift-block')
    if (block && !block.classList.contains('temp')) {
      activeEvent = block
      openModal()

      // Pre-select existing values after modal opens
      document.getElementById('modalWorkerSelect').value =
        block.dataset.workerId
      document.getElementById('modalRoleSelect').value = block.dataset.roleId
      document.getElementById('modalRoomSelect').value = block.dataset.roomId
    }
  })
})

function renderShiftsToGrid (shifts, isLocal = false) {
  const dayMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }

  shifts.forEach(s => {
    const dayIndex = typeof s.day === 'string' ? dayMap[s.day] : s.day
    const col = document.querySelector(
      `#interactiveGrid .day-col[data-day="${dayIndex}"]`
    )
    if (!col) return

    const startOffset = s.start_min - START_HOUR * 60
    const top = (startOffset / 15) * SLOT_HEIGHT
    const height = ((s.end_min - s.start_min) / 15) * SLOT_HEIGHT

    // If isLocal is true but the shift itself was saved, honour the saved state
    const colorClass = !isLocal || s.isSaved ? 'saved' : 'local'

    const block = document.createElement('div')
    block.className = `event-block shift-block ${colorClass}`
    block.style.top = `${top}px`
    block.style.height = `${height}px`
    block.dataset.workerId = s.user_id
    block.dataset.roleId = s.role_id
    block.dataset.roomId = s.room_id || ''
    block.dataset.shiftId = s.id || ''

    block.innerHTML = `
      <div class="delete-x" onclick="removeEventBlock(event, this)">×</div>
      <div class="event-content">
        <div class="event-title">${s.user_name}</div>
        <div class="event-time">${formatMin(s.start_min)} - ${formatMin(
      s.end_min
    )}</div>
        ${s.room_name ? `<div class="event-loc">${s.room_name}</div>` : ''}
      </div>`

    col.appendChild(block)
  })
}

function scrollToDay (dayIndex) {
  // Find the first column for this day in the view grid
  const targetCol = document.querySelector(
    `#viewGrid .day-col[data-day="${dayIndex}"]`
  )
  if (!targetCol) return

  const scrollArea = targetCol.closest('.scroll-area')
  if (!scrollArea) return

  // Highlight briefly
  targetCol.style.backgroundColor = 'rgba(115, 147, 179, 0.2)'
  setTimeout(() => (targetCol.style.backgroundColor = ''), 1000)

  // Scroll to it
  scrollArea.scrollTo({
    left: targetCol.offsetLeft - 60, // account for time column
    behavior: 'smooth'
  })
}

function setupHeaderSync () {
  const viewScrollArea = document.getElementById('viewScrollArea')
  const viewHeader = document.getElementById('viewGridHeader')

  if (viewScrollArea && viewHeader) {
    viewScrollArea.addEventListener('scroll', () => {
      viewHeader.scrollLeft = viewScrollArea.scrollLeft
    })
  }
}

function getInteractiveColWidth () {
  const interactiveGrid = document.getElementById('interactiveGrid')
  const firstCol = interactiveGrid.querySelector('.day-col')
  if (!firstCol) return 120
  return firstCol.getBoundingClientRect().width
}

let editingWorkerId = null

function openWorkerEditModal (workerId, workerName) {
  editingWorkerId = workerId
  document.getElementById('workerEditName').textContent = workerName
  document.getElementById('workerEditModal').classList.add('show')

  const roles =
    typeof window.ROLES === 'string' ? JSON.parse(window.ROLES) : window.ROLES
  const workers =
    typeof window.WORKERS === 'string'
      ? JSON.parse(window.WORKERS)
      : window.WORKERS
  const worker = workers.find(w => w.id === workerId)

  // Populate role dropdown
  const roleSelect = document.getElementById('workerEditRole')
  roleSelect.innerHTML = '<option value="">No Role</option>'
  roles.forEach(r => {
    const opt = new Option(r.name, r.id)
    if (worker?.role_id === r.id) opt.selected = true
    roleSelect.appendChild(opt)
  })

  // Load sections for current role, passing section NAME for preselection
  if (worker?.role_id) {
    onWorkerEditRoleChange(roleSelect, worker.section)
  } else {
    document.getElementById('workerEditSectionGroup').style.display = 'none'
  }
}

function onWorkerEditRoleChange (select, preselectSectionName = null) {
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
    // Match by name since worker.section is a name string e.g. "001"
    if (preselectSectionName && s.name === preselectSectionName)
      opt.selected = true
    sectionSelect.appendChild(opt)
  })
  sectionGroup.style.display = 'block'
}

function closeWorkerEditModal () {
  document.getElementById('workerEditModal').classList.remove('show')
  editingWorkerId = null
}

async function saveWorkerAssignment () {
  const roleId = document.getElementById('workerEditRole').value || null
  const sectionId = document.getElementById('workerEditSection').value || null

  try {
    const res = await fetch(
      `/api/team/${window.TEAM_ID}/members/save-assignments/`,
      {
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
      }
    )

    if (res.ok) {
      // Update window.WORKERS in memory so filters reflect the change immediately
      const workers =
        typeof window.WORKERS === 'string'
          ? JSON.parse(window.WORKERS)
          : window.WORKERS
      const worker = workers.find(w => w.id === editingWorkerId)
      if (worker) {
        worker.role_id = roleId ? parseInt(roleId) : null
        // Store section as name string to match obstruction comparison
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
