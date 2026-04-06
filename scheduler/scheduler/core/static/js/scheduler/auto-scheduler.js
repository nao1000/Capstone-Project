async function runAutoScheduler () {
  // 1. Allow massive runs by removing the strict role requirement
  const roleId = typeof activeRoleId !== 'undefined' ? activeRoleId : null;

  const btn = document.getElementById('autoScheduleBtn')
  if (btn) {
    btn.dataset.originalText = btn.innerText
    btn.innerText = '⏳ Calculating...'
    btn.disabled = true
  }

  try {
    const res = await fetch(`/api/team/${window.TEAM_ID}/auto-schedule/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCookie('csrftoken')
      },
      body: JSON.stringify({ role_id: roleId }) // Sends null if no role selected (Massive Run)
    })

    const data = await res.json()

    if (!res.ok) throw new Error(data.error || 'Failed to generate schedule')

    if (data.shifts.length === 0) {
      alert("The algorithm couldn't find any valid slots! Check constraints.")
      return
    }

    // Enrich with names
    const workers = typeof window.WORKERS === 'string' ? JSON.parse(window.WORKERS) : window.WORKERS
    const rooms = typeof window.ROOMS === 'string' ? JSON.parse(window.ROOMS) : window.ROOMS

    const enrichedShifts = data.shifts.map(shift => {
      const worker = workers.find(w => w.id == shift.user_id)
      const room = rooms.find(r => r.id == shift.room_id)
      return {
        ...shift,
        user_name: worker ? worker.name : 'Unknown Worker',
        room_name: room ? room.name : '',
        isSaved: false 
      }
    })

    // --- THE FIX: The Mailroom Sorting ---
    // Group the 174 shifts into their respective roles
    const shiftsByRole = {};
    enrichedShifts.forEach(shift => {
        if (!shiftsByRole[shift.role_id]) {
            shiftsByRole[shift.role_id] = [];
        }
        shiftsByRole[shift.role_id].push(shift);
    });

    // Save each bucket to local memory so they are there when you switch tabs!
    for (const [rId, shifts] of Object.entries(shiftsByRole)) {
        localSchedule.save(rId, shifts);
    }

    clearInteractiveGrid(false) 
    
    // ONLY draw the shifts that belong to the role you are currently looking at
    if (activeRoleId) {
        const shiftsToRender = shiftsByRole[activeRoleId] || [];
        renderShiftsToGrid(shiftsToRender, true);
    }

    alert(`✨ Success! ${enrichedShifts.length} total shifts generated. Click your role filters to review them, then click Save!`)
    
  } catch (err) {
    console.error(err)
    alert('Error running auto-scheduler: ' + err.message)
  } finally {
    if (btn) {
      btn.innerText = btn.dataset.originalText
      btn.disabled = false
    }
  }
}