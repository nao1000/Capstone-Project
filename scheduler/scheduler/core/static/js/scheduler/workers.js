const scheduleShiftCache = {};

// Note: We need 'async' here so we can fetch and filter the shifts!
async function loadWorker(workerId, teamId, name, element) {
  console.log(localSchedule)
  activeRoleId = null;
  document.querySelectorAll('.filter-options .btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.worker-item').forEach(item => item.classList.remove('active'));
  
  if (element) element.classList.add('active');
  document.getElementById('viewingWorkerLabel').textContent = `${name} - Availability`;

  // Clear grid immediately
  buildSingleWorkerGrid(name);
  renderWorkerObstructions(workerId);

  const dayMap = { sun: '0', mon: '1', tue: '2', wed: '3', thu: '4', fri: '5', sat: '6' };

  try {
    // ==========================================
    // 1. PULL AVAILABILITY LOCALLY (Zero Delay)
    // ==========================================
    const workersList = typeof window.WORKERS === 'string' ? JSON.parse(window.WORKERS) : window.WORKERS;
    const workerLocalData = workersList.find(w => String(w.id) === String(workerId));

    if (!workerLocalData) {
        console.error("Worker not found in local data");
        return;
    }
    console.log(window.WORKERS)
    const availData = workerLocalData.availabilityData || [];
    const prefData = workerLocalData.preferredData || [];
    const roleData = workerLocalData.rolePreferences || [];

    renderWorkerPanel(workerId, roleData);

    // ==========================================
    // 2. Setup Document Fragments for instant rendering
    // ==========================================
    const fragments = { '0': document.createDocumentFragment(), '1': document.createDocumentFragment(), '2': document.createDocumentFragment(), '3': document.createDocumentFragment(), '4': document.createDocumentFragment(), '5': document.createDocumentFragment(), '6': document.createDocumentFragment() };

    // ==========================================
    // 3. Render Availability 
    // ==========================================
    availData.forEach(range => {
      const dayIndex = dayMap[range.day];
      if (!fragments[dayIndex]) return;

      const startOffset = range.start_min - START_HOUR * 60;
      const top = (startOffset / 15) * SLOT_HEIGHT;
      const height = ((range.end_min - range.start_min) / 15) * SLOT_HEIGHT;

      const block = document.createElement('div');
      block.className = 'event-block avail-block';
      block.style.top = `${top}px`;
      block.style.height = `${height}px`;
// This will check eventName, then event_name, then name. 
      // It will also calculate the time string automatically!

      block.innerHTML = `
        <div class="event-content">
          <div class="event-title">${range.eventName || range.event_name || range.name || ''}</div>
          <div class="event-building">${range.building || range.location || ''}</div>
          <div class="event-time">${range.label || `${formatMin(range.start_min)} - ${formatMin(range.end_min)}`}</div>
        </div>`
      fragments[dayIndex].appendChild(block);
    });

    // ==========================================
    // 4. Render Preferences
    // ==========================================
    prefData.forEach(preferred => {
      const dayIndex = dayMap[preferred.day];
      if (!fragments[dayIndex]) return;

      const startOffset = preferred.start_min - START_HOUR * 60;
      const top = (startOffset / 15) * SLOT_HEIGHT;
      const height = ((preferred.end_min - preferred.start_min) / 15) * SLOT_HEIGHT;

      const block = document.createElement('div');
      block.className = 'event-block prefer-block';
      block.style.top = `${top}px`;
      block.style.height = `${height}px`;
      fragments[dayIndex].appendChild(block);
    });

    // ==========================================
    // 5. Attach to DOM instantly
    // ==========================================
    Object.keys(fragments).forEach(dayIndex => {
        const dayCol = document.querySelector(`#mainGrid .day-col[data-day="${dayIndex}"]`);
        if (dayCol && fragments[dayIndex].children.length > 0) {
            dayCol.appendChild(fragments[dayIndex]);
        }
    });

    // ==========================================
    // 6. HANDLE SHIFTS (Filtered to ONLY this worker)
    // ==========================================
    if (typeof activeScheduleId !== 'undefined' && activeScheduleId) {
        let shiftData;
        
        // Check if we already downloaded this schedule's shifts
        if (scheduleShiftCache[activeScheduleId]) {
            shiftData = scheduleShiftCache[activeScheduleId];
        } else {
            // If not, download them and save to cache
            const shiftRes = await fetch(`/api/team/${teamId}/schedules/${activeScheduleId}/shifts/`);
            shiftData = await shiftRes.json();
            scheduleShiftCache[activeScheduleId] = shiftData;
        }

        const rooms = typeof window.ROOMS === 'string' ? JSON.parse(window.ROOMS) : window.ROOMS;

        // FILTER: Only grab the shifts belonging to the clicked worker!
        const workerShifts = shiftData.shifts
            .filter(s => String(s.user_id) === String(workerId))
            .map(shift => {
                const room = rooms.find(r => String(r.id) === String(shift.room_id));
                return {
                    ...shift,
                    user_name: name,
                    room_name: room ? room.name : '',
                    isSaved: true
                };
            });

        // Render ONLY this worker's shifts
        console.log("empty", workerShifts)
        renderShiftsToGrid(workerShifts, false);
    }

  } catch (error) {
    console.error('Error loading worker locally:', error);
  }
}

function filterWorkers () {
  const input = document.getElementById('workerSearch').value.toLowerCase()
  document.querySelectorAll('.worker-item').forEach(item => {
    const name = item.querySelector('span').textContent.toLowerCase()
    item.style.display = name.includes(input) ? 'flex' : 'none'
  })
}

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
      const workers =
        typeof window.WORKERS === 'string'
          ? JSON.parse(window.WORKERS)
          : window.WORKERS
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

// =============================================================================
// WORKER PANEL — preferred role buttons + role assignment
// Add this to workers.js (or a new worker-panel.js loaded after workers.js)
// =============================================================================

// Tracks which preferred role the supervisor is currently previewing
let previewedRole = null // { role_id, role_name, section_id, section_name, obstructions }
let activeWorkerId = null // set when loadWorker() is called

// -----------------------------------------------------------------------------
// Called by loadWorker() after fetching availability data.
// Populates the preferred role buttons in the worker panel.
// -----------------------------------------------------------------------------
function renderWorkerPanel (workerId, preferredRoles) {
  activeWorkerId = workerId
  previewedRole = null
  console.log(preferredRoles)

  // Reset assign button
  const assignBtn = document.getElementById('assignRoleBtn')
  assignBtn.disabled = true
  assignBtn.style.opacity = '0.5'
  document.getElementById('for-filter').style.display = 'none'
  document.getElementById('for-worker').style.display = 'flex'

  const container = document.getElementById('preferredRoleButtons')
  container.innerHTML = ''
  if (!preferredRoles || preferredRoles.length === 0) {
    container.innerHTML =
      '<p style="font-size:11px; color:#bbb;">No preferences set.</p>'
    return
  }
  console.log("HERE",preferredRoles)
  preferredRoles.forEach(pRole => {
    const label = pRole.section_name
      ? `#${pRole.rank} ${pRole.role_name} — ${pRole.section_name}`
      : `#${pRole.rank} ${pRole.role_name}`

    const btn = document.createElement('button')
    btn.className = 'btn btn-clear'
    btn.style.cssText =
      'width: 100%; text-align: left; font-size: 12px; padding: 8px 10px;'
    btn.textContent = label
    btn.dataset.roleId = pRole.role_id
    btn.onclick = () => previewPreferredRole(pRole, btn)

    container.appendChild(btn)
  })
}

// -----------------------------------------------------------------------------
// Highlights the selected role button, draws its obstructions on the grid,
// and enables the Assign button.
// -----------------------------------------------------------------------------
function previewPreferredRole (p, clickedBtn) {
  // Highlight the active button
  console.log("obs", window.OBSTRUCTIONS)
  console.log("p", p)
  const obstructions = window.OBSTRUCTIONS.filter(o => {
    const matchesSection = o.section ? o.section == p.section_name : true
    const matchesRole = o.role_id ? o.role_id == p?.role_id : true
    return matchesSection && matchesRole
  })

  document.querySelectorAll('#preferredRoleButtons .btn').forEach(b => {
    b.style.background = ''
    b.style.color = ''
    b.style.fontWeight = ''
  })
  clickedBtn.style.background = '#e8f0f7'
  clickedBtn.style.fontWeight = '700'

  // Draw obstructions for this specific role using the embedded data
  // (avoids depending on window.OBSTRUCTIONS which filters by assigned role)
  clearObstructionBlocks()
  console.log("here", obstructions)
  renderObstructionsForRole(obstructions || [])

  // Track selection and enable assign
  previewedRole = p
  const assignBtn = document.getElementById('assignRoleBtn')
  assignBtn.disabled = false
  assignBtn.style.opacity = '1'

  const label = p.section_name
    ? `${p.role_name} — ${p.section_name}`
    : p.role_name
  document.getElementById('previewingRoleLabel').textContent = label
  document.getElementById('workerRoleAssignInfo').style.display = 'block'
}

// -----------------------------------------------------------------------------
// Renders obstruction blocks from the pRole's embedded obstruction list.
// Uses the same DOM approach as renderWorkerObstructions but takes the data
// directly rather than filtering window.OBSTRUCTIONS.
// -----------------------------------------------------------------------------
function renderObstructionsForRole (obstructions) {
  const dayMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }

  obstructions.forEach(obs => {
    obs.days.forEach(day => {
      const dayIndex = dayMap[day]
      const col = document.querySelector(
        `#mainGrid .day-col[data-day="${dayIndex}"]:not(.worker-sub-col)`
      )
      if (!col) return

      const startOffset = obs.start_min - START_HOUR * 60
      const top = (startOffset / 15) * SLOT_HEIGHT
      const height = ((obs.end_min - obs.start_min) / 15) * SLOT_HEIGHT

      const block = document.createElement('div')
      block.className = 'obstruction-block'
      block.style.top = `${top}px`
      block.style.height = `${height}px`
      block.innerHTML = `
        <div style="padding:4px; font-size:11px; color:#555; font-weight:bold;">
          ${obs.name}
        </div>`
      col.appendChild(block)
    })
  })
}

// -----------------------------------------------------------------------------
// Assigns the previewed role+section to the worker via the existing API.
// Updates window.WORKERS in memory so the sidebar reflects the change.
// -----------------------------------------------------------------------------
async function assignPreviewedRole () {
  if (!previewedRole || !activeWorkerId) return

  const label = previewedRole.section_name
    ? `${previewedRole.role_name} — ${previewedRole.section_name}`
    : previewedRole.role_name

  if (!confirm(`Assign "${label}" to this worker?`)) return

  try {
    const res = await fetch(
      `/api/team/${window.TEAM_ID}/members/save-assignments/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify({
          assignments: [
            {
              user_id: activeWorkerId,
              role_id: previewedRole.role_id,
              section_id: previewedRole.section_id || null
            }
          ]
        })
      }
    )

    if (!res.ok) {
      alert('Failed to save assignment.')
      return
    }

    // Update window.WORKERS in memory so other parts of the UI stay in sync
    const workers =
      typeof window.WORKERS === 'string'
        ? JSON.parse(window.WORKERS)
        : window.WORKERS
    const worker = workers.find(w => String(w.id) === String(activeWorkerId))
    if (worker) {
      worker.role_id = previewedRole.role_id
      worker.section = previewedRole.section_name || null
      window.WORKERS = workers
    }

    // Re-render obstructions now that the assignment is official
    clearObstructionBlocks()
    renderObstructionsForRole(previewedRole.obstructions || [])

    const assignBtn = document.getElementById('assignRoleBtn')
    assignBtn.textContent = '✓ Assigned'
    setTimeout(() => {
      assignBtn.textContent = 'Assign Role'
    }, 2000)
  } catch (err) {
    console.error(err)
    alert('An error occurred.')
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search)
  const workerId = params.get('worker_id')

  if (workerId) {
    // Increase delay to 800ms to ensure Sidebar and window.WORKERS are ready
    setTimeout(() => {
      const workersData =
        typeof window.WORKERS === 'string'
          ? JSON.parse(window.WORKERS)
          : window.WORKERS
      const worker = workersData.find(w => String(w.id) === String(workerId))

      if (worker) {
        // Try to find the sidebar element, but it's okay if we don't
        const element = document.querySelector(
          `.worker-item[data-id="${workerId}"]`
        )

        console.log('Deep link: Loading grid for', worker.name)

        // Call the loader. We pass 'element' which might be null,
        // but our fix in Step 1 prevents the crash.
        loadWorker(worker.id, window.TEAM_ID, worker.name, element)

        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      } else {
        console.error(
          'Deep link: Worker ID',
          workerId,
          'not found in window.WORKERS'
        )
      }
    }, 800)
  }
})
