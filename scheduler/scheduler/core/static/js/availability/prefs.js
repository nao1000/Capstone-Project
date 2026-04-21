// PREFERENCES

// --- Save all availability + role preferences to the server ---
async function saveAllPreferences () {
  const busyData = []
  const preferredData = []

  document.querySelectorAll('.event-block:not(.temp)').forEach(ev => {
    const day = ev.parentElement.dataset.day
    const topPx = parseFloat(ev.style.top)
    const heightPx = parseFloat(ev.style.height)
    const startSlotIndex = Math.round(topPx / window.SLOT_HEIGHT)
    const slotsCount = Math.round(heightPx / window.SLOT_HEIGHT)
    const startMin = startSlotIndex * 15 + window.START_HOUR * 60
    const endMin = startMin + slotsCount * 15
    const mode = ev.dataset.mode || 'busy'

    const entry = {
      day: parseInt(day),
      start_min: startMin,
      end_min: endMin
    }

    if (mode === 'preferred') {
      preferredData.push(entry)
    } else {
      busyData.push({
        ...entry,
        name: ev.querySelector('.event-title')?.textContent || '',
        location: ev.querySelector('.event-loc')?.textContent || ''
      })
    }
  })

  const rolePreferences = selectedRanking.map(({ roleId, sectionId }, index) => ({
    rank: index + 1,
    role_id: roleId,
    section_id: sectionId || null
  }))

  const payload = {
    busy: busyData,
    preferred: preferredData,
    role_preferences: rolePreferences
  }

  try {
    const response = await fetch(`/api/team/${window.TEAM_ID}/save-availability/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCookie('csrftoken')
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    document.getElementById('savePopupModal').classList.add('show')
  } catch (error) {
    console.error('Error saving preferences:', error)
    alert('There was an error saving the schedule. Please try again.')
  }
}

function closeSavePopup () {
  document.getElementById('savePopupModal').classList.remove('show')
}

// --- Role / Section Ranking ---

function toggleSections (checkbox, sectionsDivId) {
  const sectionDiv = document.getElementById(sectionsDivId)
  const roleId = checkbox.value
  const hasSections = sectionDiv.querySelectorAll('.section-check').length > 0

  if (checkbox.checked) {
    if (hasSections) {
      sectionDiv.style.display = 'block'
    } else {
      selectedRanking.push({ key: `role-${roleId}`, roleId, sectionId: null })
    }
  } else {
    sectionDiv.style.display = 'none'
    selectedRanking = selectedRanking.filter(item => item.roleId !== roleId)
    sectionDiv.querySelectorAll('.section-check').forEach(sc => (sc.checked = false))
  }

  updateRankDisplay()
}

function toggleSection (checkbox) {
  const sectionId = checkbox.value
  const roleId = checkbox.dataset.parentRole
  const key = `section-${sectionId}`

  if (checkbox.checked) {
    selectedRanking.push({ key, roleId, sectionId })
  } else {
    selectedRanking = selectedRanking.filter(item => item.key !== key)
  }

  updateRankDisplay()
}

function updateRankDisplay () {
  document.querySelectorAll('.rank-badge').forEach(badge => (badge.innerText = ''))

  selectedRanking.forEach(({ roleId, sectionId }, index) => {
    const badgeId = sectionId ? `rank-section-${sectionId}` : `rank-${roleId}`
    const badge = document.getElementById(badgeId)
    if (badge) badge.innerText = `#${index + 1}`
  })
}

function restoreSavedRolePreferences () {
  if (!window.SAVED_ROLES || window.SAVED_ROLES.length === 0) return

  // Sort by rank so selectedRanking ends up in the right order
  const sorted = [...window.SAVED_ROLES].sort((a, b) => a.rank - b.rank)

  sorted.forEach(pref => {
    if (pref.section_id) {
      // --- Has a section: check the parent role first (to show sections dropdown) ---
      const roleCheckbox = document.querySelector(`.role-check[value="${pref.role_id}"]`)
      if (roleCheckbox && !roleCheckbox.checked) {
        roleCheckbox.checked = true
        const sectionsDivId = `sections-${pref.role_id}`
        const sectionsDiv = document.getElementById(sectionsDivId)
        if (sectionsDiv) sectionsDiv.style.display = 'block'
      }

      // Then check the specific section
      const sectionCheckbox = document.querySelector(`.section-check[value="${pref.section_id}"]`)
      if (sectionCheckbox) {
        sectionCheckbox.checked = true
        toggleSection(sectionCheckbox)
      }
    } else {
      // --- No section: just check the role ---
      const roleCheckbox = document.querySelector(`.role-check[value="${pref.role_id}"]`)
      if (roleCheckbox) {
        roleCheckbox.checked = true
        toggleSections(roleCheckbox, `sections-${pref.role_id}`)
      }
    }
  })
}