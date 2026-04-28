/** @file Functions handling the rendering, clearing, and server-synchronization of shifts and obstructions on the schedule grid. */
/** @module Scheduler */

/**
 * Renders an array of shift objects onto the main schedule grid as HTML blocks.
 * Calculates their vertical position and height based on start and end times, 
 * and styles them differently if they are saved on the server versus newly drawn locally.
 *
 * @param {Array<Object>} shifts - Array of shift data objects to render.
 * @param {string|number} shifts[].day - The day of the week (e.g., 'mon' or 1).
 * @param {number} shifts[].user_id - The ID of the worker assigned to the shift.
 * @param {number} shifts[].start_min - Start time in total minutes.
 * @param {number} shifts[].end_min - End time in total minutes.
 * @param {boolean} shifts[].isSaved - Indicates if the shift is synced with the server.
 * @param {boolean} [isLocal=false] - (Unused in current implementation) Flag indicating if the render originates from a local action.
 */
function renderShiftsToGrid (shifts, isLocal = false) {
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

    const colorClass = s.isSaved ? 'saved' : 'local'

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
        <div class="event-time">${formatMin(s.start_min)} - ${formatMin(
      s.end_min
    )}</div>
        ${s.room_name ? `<div class="event-loc">${s.room_name}</div>` : ''}
      </div>`

    col.appendChild(block)
  })
}

/**
 * Clears existing obstructions, then filters and renders hard constraints/obstructions 
 * tailored specifically for a given worker based on their section and role mapping.
 *
 * @param {string|number} workerId - The unique ID of the worker whose obstructions should be rendered.
 * @requires window.WORKERS
 * @requires window.OBSTRUCTIONS
 */
function renderWorkerObstructions (workerId) {
  document
    .querySelectorAll('#mainGrid .obstruction-block')
    .forEach(el => el.remove())

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

      col.appendChild(createObstructionBlock(obs))
    }
  })
}

/**
 * Removes all visible shift blocks from the grid DOM.
 * By default, prompts the user to confirm the action before executing.
 *
 * @param {boolean} [withConfirm=true] - If true, triggers a browser `confirm` dialog before clearing.
 */
function clearInteractiveGrid (withConfirm = true) {
  if (withConfirm && !confirm('Clear all assigned shifts?')) return
  document.querySelectorAll('#mainGrid .shift-block').forEach(el => el.remove())
}

/**
 * Deletes all shifts associated with the currently active schedule from the backend.
 * Demands a strict text confirmation ('CLEAR'), clears the UI, resets local caching, 
 * and pulls a fresh state from the server to ensure synchronization.
 *
 * @async
 * @param {boolean} [withConfirm=true] - If true, requires the user to type "CLEAR" into a prompt dialog.
 * @returns {Promise<void>}
 */
async function deleteShifts (withConfirm = true) {
  if (
    withConfirm &&
    prompt('Type CLEAR to confirm shift deletion:') !== 'CLEAR'
  )
    return

  const btn = document.querySelector('[onclick="deleteShifts()"]')
  if (btn) {
    btn.disabled = true
    btn.textContent = 'Clearing...'
  }

  try {
    const response = await fetch(
      `/api/team/${window.TEAM_ID}/schedule/${activeScheduleId}/shifts/delete/`,
      {
        method: 'POST',
        headers: { 'X-CSRFToken': csrfToken }
      }
    )

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      alert(`Failed to delete shifts: ${err.error || response.status}`)
      return
    }

    // Only clear UI after server confirms success
    document
      .querySelectorAll('#mainGrid .shift-block')
      .forEach(el => el.remove())
    localSchedule.clear()

    // Bust the cache so a reload doesn't repopulate from stale data
    if (activeScheduleId) {
      delete scheduleShiftCache[activeScheduleId]
    }

    // Re-fetch fresh shift data to confirm server state matches UI
    const fresh = await fetch(
      `/api/team/${window.TEAM_ID}/schedules/${activeScheduleId}/shifts/`
    )
    if (fresh.ok) {
      const data = await fresh.json()
      scheduleShiftCache[activeScheduleId] = data
      if (data.shifts && data.shifts.length > 0) {
        console.warn('Server still returned shifts after delete:', data.shifts)
        alert('Some shifts may not have been deleted. Please try again.')
      }
    }
  } catch (error) {
    console.error(error)
    alert('An error occurred.')
  } finally {
    if (btn) {
      btn.disabled = false
      btn.textContent = 'Clear Grid'
    }
  }
}

/**
 * Removes all obstruction (unavailable/hard conflict) blocks from the DOM.
 */
function clearObstructionBlocks () {
  document.querySelectorAll('.obstruction-block').forEach(b => b.remove())
}

/**
 * Smoothly scrolls the main grid horizontally to bring a specific day column into view.
 * Briefly flashes the column's background to highlight it for the user.
 *
 * @param {number|string} dayIndex - The zero-based index of the day to scroll to (0 = Sun, 6 = Sat).
 */
function scrollToDay (dayIndex) {
  const targetCol = document.querySelector(
    `#mainGrid .day-col[data-day="${dayIndex}"]`
  )
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

/**
 * Bootstraps and renders the "Master View" which displays all workers grouped by roles/sections.
 * Fetches required schedule data, builds the complex sub-column grid structure, and plots 
 * worker availabilities, preferences, obstructions, and merged shift data (local + saved).
 *
 * @async
 * @returns {Promise<void>}
 */
async function loadMasterView () {
  document
    .querySelectorAll('.worker-item')
    .forEach(el => el.classList.remove('active'))
  document.getElementById('viewingWorkerLabel').textContent =
    'Master Schedule View'
  document.getElementById('for-worker').style.display = 'none'
  document.getElementById('for-filter').style.display = 'flex'

  const workers =
    typeof window.WORKERS === 'string'
      ? JSON.parse(window.WORKERS)
      : window.WORKERS

  const roles =
    typeof window.ROLES === 'string' ? JSON.parse(window.ROLES) : window.ROLES

  // Build a role order map so we can sort by role position
  const roleOrder = {}
  roles.forEach((r, i) => {
    roleOrder[r.id] = i
  })

  const sortedWorkers = [...workers].sort((a, b) => {
    // 1. Group by role name first
    const roleA = roles.find(r => r.id === a.role_id)?.name || ''
    const roleB = roles.find(r => r.id === b.role_id)?.name || ''
    if (roleA !== roleB) return roleA.localeCompare(roleB)

    // 2. Then by section within that role
    const sectionA = a.section || ''
    const sectionB = b.section || ''
    if (sectionA !== sectionB) return sectionA.localeCompare(sectionB)

    // 3. Then by name within that section
    return (a.name || '').localeCompare(b.name || '')
  })

  buildRoleGrid(sortedWorkers)

  const dayMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }
  const obstructions =
    typeof window.OBSTRUCTIONS === 'string'
      ? JSON.parse(window.OBSTRUCTIONS)
      : window.OBSTRUCTIONS

  sortedWorkers.forEach(worker => {
    DAY_KEYS.forEach((dayKey, dayIndex) => {
      const workerCol = document.querySelector(
        `.worker-sub-col[data-day="${dayIndex}"][data-worker-id="${worker.id}"]`
      )
      if (!workerCol) return

      // --- Availability ---
      const availData = worker.availabilityData || []
      availData
        .filter(a => a.day === dayKey)
        .forEach(range => {
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

      // --- Preferred times ---
      const prefData = worker.preferredData || []
      prefData
        .filter(p => p.day === dayKey)
        .forEach(pref => {
          const startOffset = pref.start_min - START_HOUR * 60
          const top = (startOffset / 15) * SLOT_HEIGHT
          const height = ((pref.end_min - pref.start_min) / 15) * SLOT_HEIGHT

          const block = document.createElement('div')
          block.className = 'event-block prefer-block'
          block.innerHTML = "<div>Preferred Working Hours</div>"
          block.style.top = `${top}px`
          block.style.height = `${height}px`
          workerCol.appendChild(block)
        })

      // --- Obstructions ---
      obstructions.forEach(o => {
        if (o.role_id && o.role_id !== worker.role_id) return
        if (o.section && o.section !== worker.section) return
        if (!o.days.includes(dayKey)) return
        workerCol.appendChild(createObstructionBlock(o))
      })
    })
  })

  if (localSchedule.length > 0) {
    localSchedule.forEach(shifts => {})
  }
  // --- Shifts ---
  if (activeScheduleId) {
    let shiftData = scheduleShiftCache[activeScheduleId]
    if (!shiftData) {
      const res = await fetch(
        `/api/team/${window.TEAM_ID}/schedules/${activeScheduleId}/shifts/`
      )
      shiftData = await res.json()
      scheduleShiftCache[activeScheduleId] = shiftData
    }

    const rooms =
      typeof window.ROOMS === 'string' ? JSON.parse(window.ROOMS) : window.ROOMS

    const savedShifts = shiftData.shifts.map(s => {
      const worker = sortedWorkers.find(w => String(w.id) === String(s.user_id))
      const room = rooms.find(r => String(r.id) === String(s.room_id))
      return {
        ...s,
        user_name: worker ? worker.name : s.user_name || 'Unknown',
        room_name: room ? room.name : '',
        isSaved: true
      }
    })

    // Merge in any local unsaved shifts
    const localShifts = localSchedule.getAll().map(s => {
      const worker = sortedWorkers.find(w => String(w.id) === String(s.user_id))
      const room = rooms.find(r => String(r.id) === String(s.room_id))
      return {
        ...s,
        user_name: worker ? worker.name : s.user_name || 'Unknown',
        room_name: room ? room.name : '',
        isSaved: false
      }
    })

    // Deduplicate — if a shift exists in both, prefer the saved version
    const savedIds = new Set(savedShifts.map(s => s.id).filter(Boolean))
    const uniqueLocalShifts = localShifts.filter(
      s => !s.id || !savedIds.has(s.id)
    )

    renderShiftsToGrid([...savedShifts, ...uniqueLocalShifts], false)
  }
}