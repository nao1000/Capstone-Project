/** @file Functions for managing the event creation/editing modal, room availability checks, and event block removal on the schedule grid. */
/** @module Scheduler */

/**
 * Opens the event modal and populates its form fields based on the currently active grid context.
 * Computes the time slot duration based on the clicked/dragged element's height and position,
 * filters the worker dropdown based on the active role, and pre-selects known attributes.
 *
 * @requires window.WORKERS
 * @requires window.ROLES
 * @requires window.ROOMS
 * @requires annotateRoomDropdown
 */
function openModal () {
  const modal = document.getElementById('eventModal')
  modal.classList.add('show')
  const workers =
    typeof window.WORKERS === 'string'
      ? JSON.parse(window.WORKERS)
      : window.WORKERS
  const roles =
    typeof window.ROLES === 'string' ? JSON.parse(window.ROLES) : window.ROLES
  const rooms =
    typeof window.ROOMS === 'string' ? JSON.parse(window.ROOMS) : window.ROOMS

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

  const workerId =
    activeEvent.dataset.userId ?? activeEvent.dataset.workerId ?? activeWorkerId
  const roleId = activeRoleId ?? activeWorkerRoleId

  if (workerId) {
    workerSelect.value = workerId
    workerSelect.disabled = true
  }

  const roleSelect = document.getElementById('modalRoleSelect')
  roleSelect.innerHTML = ''

  if (roleId) {
    const activeRole = roles.find(r => r.id === roleId)
    if (activeRole) {
      roleSelect.appendChild(
        new Option(activeRole.name, activeRole.id, true, true)
      )
    }
    roleSelect.disabled = true
  } else {
    roleSelect.disabled = false
    roleSelect.innerHTML = '<option value="">Select a role...</option>'
    roles.forEach(r => roleSelect.appendChild(new Option(r.name, r.id)))
  }

  const roomSelect = document.getElementById('modalRoomSelect')
  roomSelect.innerHTML = '<option value="">Select a room...</option>'
  rooms.forEach(r => {
    roomSelect.appendChild(new Option(r.name, r.id))
  })

  const clickedRoomId = activeEvent.dataset.roomId
  if (clickedRoomId) {
    roomSelect.value = clickedRoomId
  }

  document.getElementById('modalTimeDisplay').textContent = ''

  if (activeEvent.dataset.startMin && activeEvent.dataset.endMin) {
    currentStartMin = parseInt(activeEvent.dataset.startMin)
    currentEndMin = parseInt(activeEvent.dataset.endMin)
  } else {
    const topPx = parseFloat(activeEvent.style.top)
    const heightPx = parseFloat(activeEvent.style.height)
    const startSlotIndex = Math.round(topPx / SLOT_HEIGHT)
    const rawSlots = Math.round(heightPx / SLOT_HEIGHT)

    currentStartMin = startSlotIndex * 15 + START_HOUR * 60
    currentEndMin = currentStartMin + rawSlots * 15
  }

  const slotsCount = Math.round((currentEndMin - currentStartMin) / 15)
  document.getElementById('modalTimeDisplay').textContent = `${formatMin(
    currentStartMin
  )} - ${formatMin(currentEndMin)} (${slotsCount * 15} mins)`

  const dayIndex = parseInt(activeCol.dataset.day)
  annotateRoomDropdown(dayIndex, clickedRoomId)
}

/**
 * Closes the event creation/editing modal.
 * Also performs cleanup by removing the active event block from the DOM 
 * if it was a temporary, un-saved block (indicated by the 'temp' class).
 */
function closeModal () {
  document.getElementById('eventModal').classList.remove('show')
  if (activeEvent && activeEvent.classList.contains('temp')) {
    activeEvent.remove()
  }
  activeEvent = null
}

/**
 * Checks server and local state for room availability and existing bookings to annotate the room dropdown.
 * Disables options if a room is closed/unavailable, or if its capacity is already filled 
 * by overlapping shifts. Updates the dropdown option text to indicate remaining capacity or conflicts.
 *
 * @async
 * @param {number} dayIndex - The zero-based index of the day corresponding to the shift (0 = Sun).
 * @param {string|number|null} [preselectedRoomId=null] - The ID of a room that should be selected by default, if any.
 * @returns {Promise<void>} Resolves when room data is fetched and the dropdown is fully populated and annotated.
 */
async function annotateRoomDropdown (dayIndex, preselectedRoomId = null) {
  const day = DAY_KEYS[dayIndex]

  let bookings = {}
  let roomAvailability = {}

  if (activeScheduleId) {
    const [bookingsRes, availRes] = await Promise.all([
      fetch(
        `/api/team/${window.TEAM_ID}/schedules/${activeScheduleId}/room-bookings/?day=${day}`
      ),
      fetch(`/api/team/${window.TEAM_ID}/room-availability/?day=${day}`)
    ])
    const bookingsData = await bookingsRes.json()
    const availData = await availRes.json()
    bookings = bookingsData.bookings || {}
    roomAvailability = availData.availability || {}
  } else {
    try {
      const availRes = await fetch(
        `/api/team/${window.TEAM_ID}/room-availability/?day=${day}`
      )
      const availData = await availRes.json()
      roomAvailability = availData.availability || {}
    } catch (_) {}
  }

  const allLocalShifts = localSchedule.getAll().filter(s => s.day === day)
  allLocalShifts.forEach(s => {
    if (!s.room_id) return
    const roomId = s.room_id
    if (!bookings[roomId]) {
      const rooms =
        typeof window.ROOMS === 'string'
          ? JSON.parse(window.ROOMS)
          : window.ROOMS
      const room = rooms.find(r => r.id == roomId)
      bookings[roomId] = {
        capacity: room ? room.capacity : 1,
        shifts: []
      }
    }
    const alreadyExists = bookings[roomId].shifts.some(
      existing =>
        existing.user_name === s.user_name &&
        Number(existing.start_min) === Number(s.start_min) &&
        Number(existing.end_min) === Number(s.end_min)
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

  const roomSelect = document.getElementById('modalRoomSelect')
  const rooms =
    typeof window.ROOMS === 'string' ? JSON.parse(window.ROOMS) : window.ROOMS

  const currentValue = preselectedRoomId || roomSelect.value
  roomSelect.innerHTML = '<option value="">Select a room...</option>'

  const workerSelect = document.getElementById('modalWorkerSelect')
  const editingWorkerName =
    workerSelect.options[workerSelect.selectedIndex]?.text

  rooms.forEach(r => {
    const option = document.createElement('option')
    option.value = r.id

    const availSlots = roomAvailability[r.id] || []
    const isAvailable = availSlots.some(
      slot =>
        currentStartMin >= Number(slot.start_min) &&
        currentEndMin <= Number(slot.end_min)
    )

    if (!isAvailable) {
      option.textContent = `${r.name} (Not available)`
      option.disabled = true
      option.style.color = '#999'
    } else {
      const booking = bookings[r.id]
      if (booking) {
        const overlapping = booking.shifts.filter(s => {
          const sStart = Number(s.start_min)
          const sEnd = Number(s.end_min)
          const isSameDay = !s.day || s.day === day
          const overlapsTime = currentStartMin < sEnd && currentEndMin > sStart
          const isNotCurrentWorker = s.user_name !== editingWorkerName
          return isSameDay && overlapsTime && isNotCurrentWorker
        })

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

    if (r.id == currentValue) {
      option.selected = true
      option.disabled = false
      option.style.color = ''
    }

    roomSelect.appendChild(option)
  })
}

/**
 * Commits the configurations selected in the modal to the active grid event block.
 * Replaces the temporary styling with an unsaved local state, updates the block's text 
 * with the assigned user/time/room, repositions it in the DOM if the worker changed, 
 * and caches the new shift data to local storage.
 */
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
    activeEvent.classList.add('local')
    activeEvent.dataset.workerId = workerId
    activeEvent.dataset.roleId = roleId
    activeEvent.dataset.roomId = roomId

    if (activeCol && activeCol.classList.contains('worker-sub-col')) {
      const dayIndex = activeCol.dataset.day
      const targetCol = document.querySelector(
        `#mainGrid .worker-sub-col[data-day="${dayIndex}"][data-worker-id="${workerId}"]`
      )
      if (targetCol && activeEvent.parentElement !== targetCol) {
        targetCol.appendChild(activeEvent)
      }
    }

    let html = `
      <div class="delete-x" onclick="removeEventBlock(event, this)">×</div>
      <div class="event-content">
          <div class="event-title">${name}</div>
          <div class="event-time">${timeString}</div>`

    if (!isSmall && roomName) html += `<div class="event-loc">${roomName}</div>`
    html += `</div>`

    activeEvent.innerHTML = html
    localSchedule.saveOne({
      day: DAY_KEYS[parseInt(activeCol.dataset.day)],
      start_min: currentStartMin,
      end_min: currentEndMin,
      user_id: workerId,
      role_id: roleId,
      room_id: roomId,
      user_name: name,
      room_name: roomName,
      isSaved: false
    })
  }

  document.getElementById('eventModal').classList.remove('show')
  activeEvent = null
}

/**
 * Handles the removal of a specific event block from the grid when its 'x' button is clicked.
 * Intercepts the click event to prevent grid slot selection, prompts the user for confirmation,
 * and completely removes the block from the DOM upon approval.
 *
 * @param {Event} e - The DOM click event triggered by the user.
 * @param {HTMLElement} xButton - The specific 'delete-x' button element that was clicked.
 */
function removeEventBlock (e, xButton) {
  e.stopPropagation()
  if (confirm('Remove this shift?')) {
    xButton.closest('.event-block').remove()
  }
}