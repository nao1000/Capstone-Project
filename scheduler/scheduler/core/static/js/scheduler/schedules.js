/** @file Handles API interactions and UI state for creating, loading, saving, and exporting schedules. */
/** @module Scheduler */

/**
 * Initializes the schedules dropdown by fetching team schedules from the server.
 * Automatically selects the active schedule if one exists and populates the dropdown.
 *
 * @async
 * @returns {Promise<void>} 
 */
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
  // const workerId = sessionStorage.getItem('loadWorkerId')
  // const workerName = sessionStorage.getItem('loadWorkerName')
  // if (workerId && activeScheduleId) {
  //   sessionStorage.removeItem('loadWorkerId')
  //   sessionStorage.removeItem('loadWorkerName')

  //   const element = document.querySelector(
  //     `.worker-item[data-worker-id="${workerId}"]`
  //   )
  //   loadWorker(workerId, window.TEAM_ID, workerName, element)
  // }
  // // if (activeScheduleId) {
  // //   await loadScheduleShifts()  // wait for shifts before returning
  // // }
}

/** * Opens the modal for creating a new schedule and focuses the input field. 
 */
function openCreateScheduleModal () {
  document.getElementById('createScheduleModal').classList.add('show')
  document.getElementById('newScheduleName').value = ''
  document.getElementById('newScheduleName').focus()
}

/** * Closes the schedule creation modal. 
 */
function closeCreateScheduleModal () {
  document.getElementById('createScheduleModal').classList.remove('show')
}

/**
 * Creates a new schedule via API POST request using the name from the modal input.
 * Updates the UI to select the newly created schedule and clears the interactive grid.
 *
 * @async
 * @returns {Promise<void>} 
 */
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

/**
 * Loads shifts for the currently selected schedule from the API.
 * Optionally filters by the active role, enriches shift data with worker and room names,
 * caches the data locally by role ID, and renders the shifts to the interactive grid.
 *
 * @async
 * @returns {Promise<void>} 
 */
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

    const workers =
      typeof window.WORKERS === 'string'
        ? JSON.parse(window.WORKERS)
        : window.WORKERS
    const rooms =
      typeof window.ROOMS === 'string' ? JSON.parse(window.ROOMS) : window.ROOMS

    const enrichedShifts = data.shifts.map(shift => {
      const worker = workers.find(w => w.id == shift.user_id)
      const room = rooms.find(r => r.id == shift.room_id)
      return {
        ...shift,
        user_name: worker ? worker.name : shift.user_name || 'Unknown',
        room_name: room ? room.name : shift.room_name || '',
        isSaved: true
      }
    })

    const byRole = {}
    enrichedShifts.forEach(s => {
      const rid = s.role_id || 0
      if (!byRole[rid]) byRole[rid] = []
      byRole[rid].push(s)
    })
    Object.entries(byRole).forEach(([rid, shifts]) => {
      localSchedule.save(rid, shifts)
    })

    renderShiftsToGrid(enrichedShifts, false)
  } catch (err) {
    console.error('Error loading shifts:', err)
  }
}

/**
 * Sets the currently selected schedule as the active/published schedule for the team.
 * Updates the dropdown UI to visually indicate the active status with a checkmark.
 *
 * @async
 * @returns {Promise<void>} 
 */
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

/**
 * Saves the current shift configurations to the server.
 * Prompts the user to save either all roles or just the currently filtered role.
 * Merges local unsaved shifts with previously cached shifts and alerts the user of any conflicts.
 * Allows multiple shifts to exist in the same time slot as long as they belong to different workers.
 *
 * @async
 * @returns {Promise<void>}
 */
async function saveAllPreferences () {
  if (!activeScheduleId) {
    alert('Please select or create a schedule first.')
    return
  }

  let saveAll = false
  if (activeRoleId) {
    saveAll = confirm(
      'Would you like to save shifts for ALL roles?\n\n' +
        '• Click OK to save ALL generated shifts across all roles.\n' +
        '• Click Cancel to save ONLY the current role filter.'
    )
  } else {
    saveAll = true
  }

  snapshotCurrentGrid()

  const cachedShifts = scheduleShiftCache[activeScheduleId]?.shifts || []

  // FIX 1: Include the user_name in the unique key so different people 
  // at the exact same time don't overwrite each other.
  function mergeSavedAndLocal (saved, local) {
    const map = {}
    saved.forEach(s => { map[`${s.day}-${s.start_min}-${s.user_name}`] = s })
    local.forEach(s => { map[`${s.day}-${s.start_min}-${s.user_name}`] = s })
    return Object.values(map)
  }

  const btn = document.getElementById('saveAllBtn')
  btn.disabled = true
  btn.textContent = 'Saving...'

  try {
    let totalSaved = 0
    let allConflicts = []

    if (!saveAll) {
      // --- SAVE SINGLE ROLE ---
      const localShifts = localSchedule.getForRole(activeRoleId) || []
      const savedShifts = cachedShifts.filter(s => String(s.role_id) === String(activeRoleId))
      const merged = mergeSavedAndLocal(savedShifts, localShifts)

      const data = await saveRoleShifts(activeRoleId, merged)
      totalSaved = data.saved || 0
      if (data.conflicts) allConflicts.push(...data.conflicts)
    } else {
      // --- SAVE ALL ROLES ---
      const allLocalShifts = localSchedule.getAll()

      // Build role buckets starting from cached (already saved) shifts
      const shiftsByRole = {}
      cachedShifts.forEach(shift => {
        const rId = String(shift.role_id)
        if (!shiftsByRole[rId]) shiftsByRole[rId] = []
        shiftsByRole[rId].push(shift)
      })

      // Merge local shifts in on top
      allLocalShifts.forEach(shift => {
        const rId = String(shift.role_id)
        if (!shiftsByRole[rId]) shiftsByRole[rId] = []
        
        // FIX 2: Only overwrite if it's the exact same day, time, AND user.
        // This allows overlapping shifts for different users to coexist.
        shiftsByRole[rId] = shiftsByRole[rId].filter(
          s => !(s.day === shift.day && s.start_min === shift.start_min && s.user_name === shift.user_name)
        )
        shiftsByRole[rId].push(shift)
      })

      const promises = Object.entries(shiftsByRole).map(
        async ([rId, shifts]) => {
          const data = await saveRoleShifts(rId, shifts)
          totalSaved += data.saved || 0
          if (data.conflicts && data.conflicts.length > 0) {
            allConflicts.push(...data.conflicts)
          }
        }
      )

      await Promise.all(promises)
    }

    if (allConflicts.length > 0) {
      const messages = allConflicts.map(c => `⚠️ ${c.message}`).join('\n')
      alert(`Saved ${totalSaved} total shifts, but with conflicts:\n\n${messages}`)
    } else {
      alert(`✓ Successfully saved ${totalSaved} shifts!`)
    }

    document
      .querySelectorAll('#mainGrid .shift-block.local')
      .forEach(block => {
        block.classList.remove('local')
        block.classList.add('saved')
      })
  } catch (err) {
    console.error('Error saving shifts:', err)
    alert('An error occurred while saving. Check the console.')
  } finally {
    btn.disabled = false
    btn.textContent = 'Save Schedule'
  }
}

/**
 * Toggles the disabled state and text of the save button to indicate network activity.
 *
 * @param {boolean} isSaving - True if a save operation is currently in progress.
 */
function setSavingState(isSaving) {
  const btn = document.getElementById('saveAllBtn') 
  btn.disabled = isSaving
  btn.textContent = isSaving ? 'Saving...' : 'Save Schedule'
}

/**
 * Helper function to save a specific list of shifts for a given role via the API.
 *
 * @async
 * @param {string|number} roleId - The ID of the role being saved.
 * @param {Array<Object>} shifts - The array of shift data objects to be saved.
 * @returns {Promise<Object>} The parsed JSON response detailing the save count and any conflicts.
 * @throws {Error} Throws if the network request fails or returns an error status.
 */
async function saveRoleShifts (roleId, shifts) {
  const res = await fetch(
    `/api/team/${window.TEAM_ID}/schedules/save-shifts/`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken':
          typeof csrfToken !== 'undefined' ? csrfToken : getCookie('csrftoken')
      },
      body: JSON.stringify({
        schedule_id: activeScheduleId,
        role_id: roleId,
        shifts: shifts || []
      })
    }
  )

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}))
    throw new Error(errData.error || `Failed to save role ${roleId}`)
  }

  return await res.json()
}

/** * Exports the currently active schedule by opening the corresponding export endpoint in a new tab. 
 */
function exportSchedule () {
  if (!activeScheduleId) {
    alert('Please select a schedule to export.')
    return
  }

  const url = `/api/team/${window.TEAM_ID}/schedules/${activeScheduleId}/export/`
  window.open(url, '_blank')
}