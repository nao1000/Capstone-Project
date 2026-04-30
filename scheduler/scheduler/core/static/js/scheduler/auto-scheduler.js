// Dummy templates for now (We will eventually pass these from Django via window.TEMPLATES)
/** @module Scheduler */

/**
 * Pre-defined configuration templates for the auto-scheduler.
 * Each template contains specific constraints and rules to guide the shift generation algorithm.
 *
 * @constant
 * @type {Object.<string|number, { name: string, duration: number, interval: number, weeklyQuota: number, dailyMax: number, maxConcurrent: number }>}
 */
const SAVED_TEMPLATES = {
  1: {
    name: 'Standard SI',
    duration: 50,
    interval: 30,
    weeklyQuota: 3,
    dailyMax: 1,
    maxConcurrent: 1
  },
  2: {
    name: 'Drop-in Tutoring',
    duration: 60,
    interval: 60,
    weeklyQuota: 10,
    dailyMax: 3,
    maxConcurrent: 3
  }
}

// ---------------------------------------------------------
// MODAL UI CONTROLS
// ---------------------------------------------------------

/**
 * Opens the Auto-Schedule configuration modal by setting its display style to flex.
 */
function openAutoScheduleModal () {
  document.getElementById('autoScheduleConfigModal').style.display = 'flex'
}

/**
 * Closes the Auto-Schedule configuration modal and resets the state
 * of the "Save Template" form inputs to prevent accidental saves later.
 */
function closeAutoScheduleModal () {
  document.getElementById('autoScheduleConfigModal').style.display = 'none'

  // Reset the "Save Template" form inputs
  document.getElementById('saveAsTemplateCheck').checked = false
  document.getElementById('newTemplateNameDiv').style.display = 'none'
  document.getElementById('newTemplateName').value = ''
}

/**
 * Toggles the visibility of the new template name input field.
 *
 * @param {HTMLInputElement} checkbox - The DOM element of the checkbox determining visibility.
 */
function toggleTemplateNameInput (checkbox) {
  const div = document.getElementById('newTemplateNameDiv')
  div.style.display = checkbox.checked ? 'block' : 'none'
}

// ---------------------------------------------------------
// TEMPLATE HANDLING
// ---------------------------------------------------------

/**
 * Loads a specific configuration template into the modal's input fields.
 * If no valid template ID is provided (e.g., "Custom" is selected), it does nothing.
 *
 * @param {string|number} templateId - The unique identifier of the template to load from `SAVED_TEMPLATES`.
 */
function loadTemplate (templateId) {
  if (!templateId || !SAVED_TEMPLATES[templateId]) {
    // "Custom Configuration" selected, do nothing and let them edit
    return
  }

  const tpl = SAVED_TEMPLATES[templateId]
  document.getElementById('configDuration').value = tpl.duration
  document.getElementById('configInterval').value = tpl.interval
  document.getElementById('configWeeklyQuota').value = tpl.weeklyQuota
  document.getElementById('configDailyMax').value = tpl.dailyMax
  document.getElementById('configMaxConcurrent').value = tpl.maxConcurrent

  // Uncheck the save box since they are using an existing template
  document.getElementById('saveAsTemplateCheck').checked = false
  toggleTemplateNameInput(document.getElementById('saveAsTemplateCheck'))
}

/**
 * Binds `input` event listeners to the configuration fields.
 * If a user manually edits any configuration value, it automatically
 * switches the template dropdown selection back to "Custom" (empty value).
 */
function setupCustomListeners () {
  const inputIds = [
    'configDuration',
    'configInterval',
    'configWeeklyQuota',
    'configDailyMax',
    'configMaxConcurrent'
  ]
  inputIds.forEach(id => {
    const el = document.getElementById(id)
    if (el) {
      el.addEventListener('input', () => {
        document.getElementById('configTemplateSelect').value = ''
      })
    }
  })
}

// Initialize listeners when the page loads
document.addEventListener('DOMContentLoaded', setupCustomListeners)

// ---------------------------------------------------------
// EXECUTION LOGIC
// ---------------------------------------------------------

/**
 * Formats the shortfall report returned from a partial schedule into a human-readable string.
 * Groups shortfalls by worker and lists sessions assigned vs. quota for each.
 *
 * @param {Array<{user_name: string, role_name: string, assigned: number, quota: number}>} shortfalls
 * @returns {string} A multi-line message ready to display in an alert or modal.
 */
function formatShortfallMessage (shortfalls) {
  if (!shortfalls || shortfalls.length === 0) return ''

  const lines = shortfalls.map(s => {
    const missing = s.quota - s.assigned
    return `  • ${s.user_name} (${s.role_name}): ${s.assigned}/${s.quota} sessions scheduled — ${missing} could not be placed`
  })

  return (
    `⚠️ Partial schedule generated. The following ${shortfalls.length} worker(s) are under their session quota:\n\n` +
    lines.join('\n') +
    '\n\nThis usually means their availability, obstructions, or room access left too few valid slots. ' +
    'You can adjust constraints and re-run, or manually assign the missing sessions.'
  )
}

/**
 * Gathers current configuration constraints from the modal UI, optionally saves a new template,
 * and sends a request to the backend auto-scheduler API. Once shifts are generated,
 * it enriches them with local data, groups them by role, caches them in local memory,
 * and finally renders the new shifts to the active grid view.
 *
 * The backend may return a partial schedule if a full solution is not achievable within
 * the time limit. In that case, a shortfall report is shown describing which workers
 * received fewer sessions than their quota.
 *
 * @async
 * @returns {Promise<void>} Resolves when the entire scheduling, fetching, parsing, and rendering cycle completes.
 */
async function executeAutoScheduler () {
  // 1. Gather all configuration variables
  const config = {
    roleId: typeof activeRoleId !== 'undefined' ? activeRoleId : null,
    duration: parseInt(document.getElementById('configDuration').value, 10),
    interval: parseInt(document.getElementById('configInterval').value, 10),
    weeklyQuota: parseInt(
      document.getElementById('configWeeklyQuota').value,
      10
    ),
    dailyMax: parseInt(document.getElementById('configDailyMax').value, 10),
    maxConcurrent: parseInt(
      document.getElementById('configMaxConcurrent').value,
      10
    )
  }

  // 2. Gather Template Saving Data
  const saveAsTemplate = document.getElementById('saveAsTemplateCheck').checked
  const newTemplateName = document.getElementById('newTemplateName').value

  if (saveAsTemplate && !newTemplateName.trim()) {
    alert('Please provide a name to save your new template.')
    return
  }

  const payload = {
    config: config,
    saveTemplate: saveAsTemplate,
    templateName: newTemplateName
  }

  // 3. UI Feedback (Show loading state on the modal's save button)
  const btn = document.querySelector('#autoScheduleConfigModal .btn-save')
  const originalText = btn.textContent
  btn.textContent = '⏳ Running Algorithm...'
  btn.disabled = true

  try {
    const res = await fetch(`/api/team/${window.TEAM_ID}/auto-schedule/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCookie('csrftoken')
      },
      body: JSON.stringify(payload)
    })

    const data = await res.json()

    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to generate schedule')
    }

    if (data.shifts.length === 0) {
      alert(
        "The algorithm couldn't find any valid slots even in partial mode.\n\n" +
        "Check that workers have availability set, rooms are open, and your constraints aren't too restrictive."
      )
      closeAutoScheduleModal()
      return
    }

    // --- ENRICHMENT & SORTING ---
    const workers =
      typeof window.WORKERS === 'string'
        ? JSON.parse(window.WORKERS)
        : window.WORKERS
    const rooms =
      typeof window.ROOMS === 'string' ? JSON.parse(window.ROOMS) : window.ROOMS

    const enrichedShifts = data.shifts.map(shift => {
      const worker = workers.find(w => w.id == shift.user_id)
      const room   = rooms.find(r => r.id == shift.room_id)
      return {
        ...shift,
        user_name: worker ? worker.name : 'Unknown Worker',
        room_name: room   ? room.name   : '',
        isSaved:   false
      }
    })

    // Group by role and save to local memory
    const shiftsByRole = {}
    enrichedShifts.forEach(shift => {
      if (!shiftsByRole[shift.role_id]) {
        shiftsByRole[shift.role_id] = []
      }
      shiftsByRole[shift.role_id].push(shift)
    })

    for (const [rId, shifts] of Object.entries(shiftsByRole)) {
      localSchedule.save(rId, shifts)
    }

    if (typeof clearInteractiveGrid === 'function') {
      clearInteractiveGrid(false)
    }

    // Draw only the active role, or all roles for master view
    if (typeof activeRoleId !== 'undefined' && activeRoleId) {
      const shiftsToRender = shiftsByRole[activeRoleId] || []
      if (typeof renderShiftsToGrid === 'function') {
        renderShiftsToGrid(shiftsToRender, true)
      }
    } else {
      await loadMasterView()
    }

    // --- SUCCESS / PARTIAL ALERTS ---
    const isPartial   = data.partial === true
    const shortfalls  = data.shortfalls || []

    if (isPartial && shortfalls.length > 0) {
      // Partial success — show shortfall detail
      const shortfallMsg = formatShortfallMessage(shortfalls)
      let msg = `📅 ${enrichedShifts.length} session(s) scheduled (partial result).\n\n`
      msg += shortfallMsg
      if (payload.saveTemplate) {
        msg += `\n\n(Template "${payload.templateName}" was also saved for next time.)`
      }
      msg += '\n\nClick your role filters to review, then Save when ready.'
      alert(msg)
    } else {
      // Full success
      let msg = `✨ Success! ${enrichedShifts.length} total shifts generated.`
      msg += ' Click your role filters to review them, then click Save!'
      if (payload.saveTemplate) {
        msg += `\n\n(Also saved "${payload.templateName}" as a new template for next time!)`
      }
      alert(msg)
    }

    closeAutoScheduleModal()
  } catch (err) {
    console.error(err)
    alert('Error running auto-scheduler: ' + err.message)
  } finally {
    if (btn) {
      btn.textContent = originalText
      btn.disabled    = false
    }
  }
}