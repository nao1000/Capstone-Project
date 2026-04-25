// Dummy templates for now (We will eventually pass these from Django via window.TEMPLATES)
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

function openAutoScheduleModal () {
  document.getElementById('autoScheduleConfigModal').style.display = 'flex'
}

function closeAutoScheduleModal () {
  document.getElementById('autoScheduleConfigModal').style.display = 'none'

  // Reset the "Save Template" form inputs
  document.getElementById('saveAsTemplateCheck').checked = false
  document.getElementById('newTemplateNameDiv').style.display = 'none'
  document.getElementById('newTemplateName').value = ''
}

function toggleTemplateNameInput (checkbox) {
  const div = document.getElementById('newTemplateNameDiv')
  div.style.display = checkbox.checked ? 'block' : 'none'
}

// ---------------------------------------------------------
// TEMPLATE HANDLING
// ---------------------------------------------------------

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

// Automatically switch dropdown to "Custom" if they manually change a number
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
    console.log('Sending payload to backend:', payload)

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
        "The algorithm couldn't find any valid slots! Check your constraints."
      )
      closeAutoScheduleModal()
      return
    }

    // --- ENRICHMENT & MAILROOM SORTING ---
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
        user_name: worker ? worker.name : 'Unknown Worker',
        room_name: room ? room.name : '',
        isSaved: false
      }
    })

    // Group the shifts into their respective roles
    const shiftsByRole = {}
    enrichedShifts.forEach(shift => {
      if (!shiftsByRole[shift.role_id]) {
        shiftsByRole[shift.role_id] = []
      }
      shiftsByRole[shift.role_id].push(shift)
    })

    // Save each bucket to local memory so they persist across role tab switches
    for (const [rId, shifts] of Object.entries(shiftsByRole)) {
      localSchedule.save(rId, shifts)
    }

    if (typeof clearInteractiveGrid === 'function') {
      clearInteractiveGrid(false)
    }

    // ONLY draw the shifts that belong to the role you are currently looking at
    console.log(localSchedule)
    if (typeof activeRoleId !== 'undefined' && activeRoleId) {
      const shiftsToRender = shiftsByRole[activeRoleId] || []
      if (typeof renderShiftsToGrid === 'function') {
        
        renderShiftsToGrid(shiftsToRender, true)
      }
    } else {
      // Master view — render all roles
      await loadMasterView()
    }

    // --- SUCCESS ALERTS ---
    let successMsg = `✨ Success! ${enrichedShifts.length} total shifts generated. Click your role filters to review them, then click Save!`
    if (payload.saveTemplate) {
      successMsg += `\n\n(Also saved "${payload.templateName}" as a new template for next time!)`
    }
    alert(successMsg)

    // Close the modal upon total success
    closeAutoScheduleModal()
  } catch (err) {
    console.error(err)
    alert('Error running auto-scheduler: ' + err.message)
  } finally {
    // Revert button state
    if (btn) {
      btn.textContent = originalText
      btn.disabled = false
    }
  }
}
