// WORKERS

/** @file Handles worker loading, panel rendering, role assignment, and shift saving. */

/**
 * Cache of shift data keyed by schedule ID to avoid redundant fetches.
 * @type {Object.<string, Object>}
 */
const scheduleShiftCache = {};

/**
 * Loads a worker's availability, preferences, and shifts into the main grid.
 * Reads availability and preference data locally for instant rendering, then
 * fetches shifts from the API (with caching) filtered to only this worker.
 * Sets `activeWorkerId`, `activeWorkerRoleId`, and resets `activeRoleId` to null.
 *
 * @async
 * @param {string|number} workerId - The ID of the worker to load.
 * @param {string|number} teamId - The team ID used to construct the shifts API URL.
 * @param {string} name - The worker's display name, shown in the grid header label.
 * @param {HTMLElement|null} element - The sidebar `.worker-item` element to mark active, or null if called via deep link.
 * @requires buildSingleWorkerGrid
 * @requires renderWorkerObstructions
 * @requires renderWorkerPanel
 * @requires renderShiftsToGrid
 * @requires formatMin
 * @requires window.WORKERS
 * @requires window.ROOMS
 * @requires window.SLOT_HEIGHT
 * @requires window.START_HOUR
 */
async function loadWorker(workerId, teamId, name, element) {
  activeWorkerId = workerId
  activeWorkerRoleId = window.WORKERS.find(w => String(w.id) === String(workerId))?.role_id;
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
      block.innerHTML = "<div>Preferred Working Hours</div>"
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
        renderShiftsToGrid(workerShifts, false);
        console.log(localSchedule)
        console.log("here", localSchedule.getForWorker(activeWorkerId, activeWorkerRoleId))
        renderShiftsToGrid(localSchedule.getForWorker(activeWorkerId, activeWorkerRoleId), true)
    }

  } catch (error) {
    console.error('Error loading worker locally:', error);
  }
}

/**
 * Filters the visible worker list in the sidebar by name.
 * Reads the current value of the `#workerSearch` input and hides any
 * `.worker-item` elements whose name does not match.
 */
function filterWorkers () {
  const input = document.getElementById('workerSearch').value.toLowerCase()
  document.querySelectorAll('.worker-item').forEach(item => {
    const name = item.querySelector('span').textContent.toLowerCase()
    item.style.display = name.includes(input) ? 'flex' : 'none'
  })
}

/**
 * Opens the worker edit modal and populates it with the worker's current role and section.
 * Builds the role `<select>` from `window.ROLES` and pre-selects the worker's existing role.
 * If the worker already has a role assigned, also triggers the section dropdown to populate.
 * Sets `editingWorkerId` to the provided workerId for use by save handlers.
 *
 * @param {string|number} workerId - The ID of the worker being edited.
 * @param {string} workerName - The worker's display name, shown as the modal heading.
 * @requires onWorkerEditRoleChange
 * @requires window.ROLES
 * @requires window.WORKERS
 */
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

/**
 * Handles role `<select>` changes inside the worker edit modal.
 * Populates or hides the section dropdown based on whether the selected role has sections.
 *
 * @param {HTMLSelectElement} select - The role select element that triggered the change.
 * @param {string|null} [preselectSectionName=null] - A section name to pre-select, used when
 *   opening the modal for a worker who already has a section assigned.
 * @requires window.ROLES
 */
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

/**
 * Closes the worker edit modal and resets `editingWorkerId` to null.
 */
function closeWorkerEditModal () {
  document.getElementById('workerEditModal').classList.remove('show')
  editingWorkerId = null
}

/**
 * Persists the role and section selected in the worker edit modal via the API.
 * Reads `editingWorkerId` to identify the target worker. On success, updates
 * `window.WORKERS` in memory to reflect the new assignment and closes the modal.
 *
 * @async
 * @requires closeWorkerEditModal
 * @requires window.TEAM_ID
 * @requires window.WORKERS
 */
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
// =============================================================================

/**
 * Populates the worker panel with preferred role buttons and the full role list.
 * Called by `loadWorker()` after availability data has been resolved.
 * Resets `previewedRole` to null and disables the Assign button until a new selection is made.
 *
 * @param {string|number} workerId - The ID of the currently loaded worker.
 * @param {Array<Object>} preferredRoles - The worker's ranked role preferences.
 * @param {string} preferredRoles[].role_name - Display name of the preferred role.
 * @param {string|null} preferredRoles[].section_name - Display name of the section, if any.
 * @param {number} preferredRoles[].rank - The worker's preference rank for this role.
 * @param {number} preferredRoles[].role_id - The role's ID.
 * @requires previewPreferredRole
 * @requires window.ROLES
 */
function renderWorkerPanel (workerId, preferredRoles) {
  previewedRole = null

  const assignBtn = document.getElementById('assignRoleBtn')
  assignBtn.disabled = true
  assignBtn.style.opacity = '0.5'
  document.getElementById('for-filter').style.display = 'none'
  document.getElementById('for-worker').style.display = 'flex'

  const container = document.getElementById('preferredRoleButtons')
  container.innerHTML = ''

  // --- Preferred roles ---
  if (!preferredRoles || preferredRoles.length === 0) {
    container.innerHTML = '<p style="font-size:11px; color:#bbb;">No preferences set.</p>'
  } else {
    preferredRoles.forEach(pRole => {
      const label = pRole.section_name
        ? `#${pRole.rank} ${pRole.role_name} — ${pRole.section_name}`
        : `#${pRole.rank} ${pRole.role_name}`

      const btn = document.createElement('button')
      btn.className = 'btn btn-clear'
      btn.style.cssText = 'width:100%; text-align:left; font-size:12px; padding:8px 10px;'
      btn.textContent = label
      btn.dataset.roleId = pRole.role_id
      btn.onclick = () => previewPreferredRole(pRole, btn)
      container.appendChild(btn)
    })
  }

  // --- Divider ---
  const divider = document.createElement('div')
  divider.style.cssText = 'margin: 10px 0 6px; font-size:10px; text-transform:uppercase; letter-spacing:0.08em; opacity:0.4; font-weight:600;'
  divider.textContent = 'All Roles'
  container.appendChild(divider)

  // --- All roles + sections ---
  const roles = typeof window.ROLES === 'string' ? JSON.parse(window.ROLES) : window.ROLES

  roles.forEach(role => {
    if (role.sections && role.sections.length > 0) {
      // Show each section as its own button
      role.sections.forEach(section => {
        const btn = document.createElement('button')
        btn.className = 'btn btn-clear'
        btn.style.cssText = 'width:100%; text-align:left; font-size:12px; padding:8px 10px; opacity:0.75;'
        btn.textContent = `${role.name} — ${section.name}`
        btn.dataset.roleId = role.id
        btn.onclick = () => previewPreferredRole({
          role_id: role.id,
          role_name: role.name,
          section_id: section.id,
          section_name: section.name,
          rank: null
        }, btn)
        container.appendChild(btn)
      })
    } else {
      // No sections — show role alone
      const btn = document.createElement('button')
      btn.className = 'btn btn-clear'
      btn.style.cssText = 'width:100%; text-align:left; font-size:12px; padding:8px 10px; opacity:0.75;'
      btn.textContent = role.name
      btn.dataset.roleId = role.id
      btn.onclick = () => previewPreferredRole({
        role_id: role.id,
        role_name: role.name,
        section_id: null,
        section_name: null,
        rank: null
      }, btn)
      container.appendChild(btn)
    }
  })
}

/**
 * Highlights the selected role button in the worker panel, draws its obstruction
 * blocks on the main grid, and enables the Assign Role button.
 * Filters `window.OBSTRUCTIONS` to only those matching the role and section of
 * the previewed preference object. Sets `previewedRole` to `p` for use by `assignPreviewedRole`.
 *
 * @param {Object} p - The role preference object being previewed.
 * @param {number} p.role_id - The role's ID used to match obstructions.
 * @param {string} p.role_name - The role's display name.
 * @param {string|null} p.section_name - The section's display name, or null if no section.
 * @param {number|null} p.section_id - The section's ID, or null if no section.
 * @param {number|null} p.rank - The worker's preference rank, or null for non-preferred entries.
 * @param {HTMLButtonElement} clickedBtn - The button element that was clicked, used for highlight styling.
 * @requires clearObstructionBlocks
 * @requires renderObstructionsForRole
 * @requires window.OBSTRUCTIONS
 */
function previewPreferredRole (p, clickedBtn) {
  // Highlight the active button
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

/**
 * Renders obstruction blocks for a given list of obstructions directly onto the main grid.
 * Uses the same DOM approach as `renderWorkerObstructions` but accepts the data directly
 * rather than filtering from `window.OBSTRUCTIONS`, making it safe to call during a preview.
 *
 * @param {Array<Object>} obstructions - The obstruction records to render.
 * @param {string} obstructions[].name - The label displayed inside the obstruction block.
 * @param {string[]} obstructions[].days - Array of day abbreviations (e.g. `['mon', 'wed']`).
 * @param {number} obstructions[].start_min - Start time in minutes from midnight.
 * @param {number} obstructions[].end_min - End time in minutes from midnight.
 * @requires window.SLOT_HEIGHT
 * @requires window.START_HOUR
 */
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

/**
 * Assigns the currently previewed role and section to the active worker via the API.
 * Reads `previewedRole` and `activeWorkerId` to determine what to assign and to whom.
 * Prompts the user for confirmation before submitting. On success, updates
 * `window.WORKERS` in memory and re-renders the obstruction blocks for the new assignment.
 *
 * @async
 * @requires clearObstructionBlocks
 * @requires renderObstructionsForRole
 * @requires window.TEAM_ID
 * @requires window.WORKERS
 */
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

/**
 * DOMContentLoaded handler for deep-link support.
 * Reads a `worker_id` query parameter from the URL and, if present, waits 800ms
 * for the sidebar and `window.WORKERS` to be ready before automatically calling
 * `loadWorker` and scrolling the matching sidebar item into view.
 *
 * @listens document#DOMContentLoaded
 * @requires loadWorker
 * @requires window.WORKERS
 * @requires window.TEAM_ID
 */
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

/**
 * Saves all shifts for the currently active worker to the server.
 * Reads `activeScheduleId` and `activeWorkerId` to scope the operation.
 * Merges cached (server-side) shifts with local (unsaved) shifts, with local
 * winning on any slot conflict. Groups the merged set by role and calls
 * `saveRoleShifts` for each group in parallel. On success, promotes all local
 * shift blocks on the grid from `.local` to `.saved`.
 *
 * @async
 * @requires saveRoleShifts
 * @requires localSchedule
 */
async function saveWorkerShifts () {
  if (!activeScheduleId) {
    alert('Please select or create a schedule first.')
    return
  }
  if (!activeWorkerId) return

  const btn = document.getElementById('saveWorkerShiftsBtn')
  btn.disabled = true
  btn.textContent = 'Saving...'

  try {
    const cachedShifts = (scheduleShiftCache[activeScheduleId]?.shifts || [])
      .filter(s => String(s.user_id) === String(activeWorkerId))

    const localShifts = localSchedule.getForWorker(activeWorkerId)

    // Merge — local wins on same slot
    const map = {}
    cachedShifts.forEach(s => { map[`${s.day}-${s.start_min}`] = s })
    localShifts.forEach(s => { map[`${s.day}-${s.start_min}`] = s })
    const merged = Object.values(map)

    // Group by role since saveRoleShifts expects a role bucket
    const byRole = {}
    merged.forEach(s => {
      const rId = s.role_id
      if (!byRole[rId]) byRole[rId] = []
      byRole[rId].push(s)
    })

    let totalSaved = 0
    await Promise.all(
      Object.entries(byRole).map(async ([rId, shifts]) => {
        const data = await saveRoleShifts(rId, shifts)
        totalSaved += data.saved || 0
      })
    )

    document.querySelectorAll('#mainGrid .shift-block.local').forEach(block => {
      block.classList.remove('local')
      block.classList.add('saved')
    })

    btn.textContent = `✓ Saved ${totalSaved} shifts`
    setTimeout(() => { btn.textContent = 'Save Shifts' }, 2500)
  } catch (err) {
    console.error(err)
    btn.textContent = 'Error — try again'
    setTimeout(() => { btn.textContent = 'Save Shifts' }, 2500)
  } finally {
    btn.disabled = false
  }
}