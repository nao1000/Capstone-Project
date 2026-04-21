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

async function saveAllPreferences () {
  if (!activeScheduleId) {
    alert('Please select or create a schedule first.')
    return
  }

  // 1. Determine our save mode (All Roles vs. Single Role)
  let saveAll = false

  if (activeRoleId) {
    // If they have a role selected, ask them what they want to do
    saveAll = confirm(
      'Would you like to save shifts for ALL roles?\n\n' +
        '• Click OK to save ALL generated shifts across all roles.\n' +
        '• Click Cancel to save ONLY the current role filter.'
    )
  } else {
    // If no role is selected, assume they want to save everything
    saveAll = true
  }

  snapshotCurrentGrid()

  try {
    let totalSaved = 0
    let allConflicts = []

    if (!saveAll) {
      // --- SAVE SINGLE ROLE ---
      const shifts = localSchedule.getForRole(activeRoleId) || []
      const data = await saveRoleShifts(activeRoleId, shifts)

      totalSaved = data.saved || 0
      if (data.conflicts) allConflicts.push(...data.conflicts)
    } else {
      // --- SAVE ALL ROLES ---
      const allShifts = localSchedule.getAll() // Returns a flat array of everything

      // Group the flat array into buckets by role_id
      const shiftsByRole = {}
      allShifts.forEach(shift => {
        const rId = shift.role_id
        if (!shiftsByRole[rId]) shiftsByRole[rId] = []
        shiftsByRole[rId].push(shift)
      })

      // Map over every grouped bucket and create a save request for each
      const promises = Object.entries(shiftsByRole).map(
        async ([rId, shifts]) => {
          const data = await saveRoleShifts(rId, shifts)
          totalSaved += data.saved || 0
          if (data.conflicts && data.conflicts.length > 0) {
            allConflicts.push(...data.conflicts)
          }
        }
      )

      // Wait for all the individual role saves to finish simultaneously!
      await Promise.all(promises)
    }

    // 2. Report the results
    if (allConflicts.length > 0) {
      const messages = allConflicts.map(c => `⚠️ ${c.message}`).join('\n')
      alert(
        `Saved ${totalSaved} total shifts, but with conflicts:\n\n${messages}`
      )
    } else {
      alert(`✓ Successfully saved ${totalSaved} shifts!`)
    }

    // 3. Visually update the blocks on the screen
    document
      .querySelectorAll('#interactiveGrid .shift-block.local')
      .forEach(block => {
        block.classList.remove('local')
        block.classList.add('saved')
      })
  } catch (err) {
    console.error('Error saving shifts:', err)
    alert('An error occurred while saving. Check the console.')
  }
}

// Helper function remains exactly the same as before
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

function exportSchedule () {
  if (!activeScheduleId) {
    alert('Please select a schedule to export.')
    return
  }

  const url = `/api/team/${window.TEAM_ID}/schedules/${activeScheduleId}/export/`
  window.open(url, '_blank')
}
