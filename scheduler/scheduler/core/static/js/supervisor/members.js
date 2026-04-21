// MEMBERS

// Fetches sections for a given role and populates the provided <select>
async function loadSectionsIntoDropdown (roleId, sectionSelect) {
  const res = await fetch(`/api/team/${window.TEAM_ID}/roles/${roleId}/sections/`)
  const data = await res.json()

  sectionSelect.innerHTML = '<option value="">No Section</option>'

  if (data.sections.length === 0) {
    sectionSelect.style.display = 'none'
    return
  }

  data.sections.forEach(s => {
    sectionSelect.appendChild(new Option(s.name, s.id))
  })
  sectionSelect.style.display = 'block'
}

// Called when a member's role dropdown changes — reloads available sections
async function onRoleChange (select) {
  const userId = select.dataset.userId
  const roleId = select.value
  const sectionSelect = document.querySelector(`.member-section-select[data-user-id="${userId}"]`)

  if (!roleId) {
    sectionSelect.style.display = 'none'
    sectionSelect.innerHTML = '<option value="">No Section</option>'
    return
  }

  await loadSectionsIntoDropdown(roleId, sectionSelect)
}

async function updateMemberRole (selectElement) {
  const workerId = selectElement.dataset.memberId
  const roleId = selectElement.value

  selectElement.disabled = true
  selectElement.style.opacity = '0.5'

  try {
    const response = await fetch(`/api/team/${window.TEAM_ID}/roles/assign/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken
      },
      body: JSON.stringify({
        worker_id: workerId,
        role_id: roleId
      })
    })

    const data = await response.json()
    if (!response.ok) {
      alert(data.error || 'Failed to update role.')
    }
  } catch (error) {
    console.error('Network Error:', error)
    alert('An error occurred. Check your connection.')
  } finally {
    selectElement.disabled = false
    selectElement.style.opacity = '1'
  }
}

async function updateMemberSection (input) {
  const userId = input.dataset.memberId
  const section = input.value.trim()

  await fetch(`/api/team/${window.TEAM_ID}/roles/assign/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrfToken
    },
    body: JSON.stringify({ worker_id: userId, section })
  })
}

async function saveAllAssignments () {
  const assignments = []

  document.querySelectorAll('.member-role-select').forEach(select => {
    const userId = select.dataset.userId
    const roleId = select.value || null
    const sectionSelect = document.querySelector(`.member-section-select[data-user-id="${userId}"]`)
    const sectionId = sectionSelect?.value || null

    assignments.push({ user_id: userId, role_id: roleId, section_id: sectionId })
  })

  try {
    const res = await fetch(`/api/team/${window.TEAM_ID}/members/save-assignments/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken
      },
      body: JSON.stringify({ assignments })
    })
    const data = await res.json()

    if (res.ok) {
      alert(`✓ Saved ${data.saved} assignments.`)
    } else {
      alert(data.error || 'Failed to save.')
    }
  } catch (err) {
    console.error(err)
    alert('An error occurred.')
  }
}

// Clears all role/section assignments for a member and resets the server record
async function resetMember (userId, userName) {
  if (!confirm(`Clear all current assignments for ${userName}?`)) return

  try {
    const response = await fetch(`/api/team/${window.TEAM_ID}/members/save-assignments/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken
      },
      body: JSON.stringify({
        assignments: [{ user_id: userId, role_id: null, section_id: null }]
      })
    })

    if (response.ok) {
      const row = document.querySelector(`tr[data-user-id="${userId}"]`)
      if (row) {
        const roleSelect = row.querySelector('.member-role-select')
        if (roleSelect) roleSelect.value = ''

        const sectionSelect = row.querySelector('.member-section-select')
        if (sectionSelect) {
          sectionSelect.value = ''
          sectionSelect.style.display = 'none'
        }

        row.style.backgroundColor = '#d4edda'
        setTimeout(() => (row.style.backgroundColor = ''), 800)
      }
      console.log(`Reset successful for ${userName}`)
    }
  } catch (error) {
    console.error('Reset error:', error)
  }
}

async function removeUserFromTeam (userId, username) {
  if (!confirm(`Are you sure you want to PERMANENTLY remove ${username} from ${window.TEAM_NAME}?`)) return

  try {
    const response = await fetch(`/api/team/${window.TEAM_ID}/members/remove/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken
      },
      body: JSON.stringify({ user_id: userId })
    })

    if (response.ok) {
      const row = document.querySelector(`tr[data-user-id="${userId}"]`)
      if (row) {
        row.style.transition = 'all 0.3s ease'
        row.style.opacity = '0'
        setTimeout(() => row.remove(), 300)
      }
    } else {
      const data = await response.json()
      alert('Error: ' + (data.message || 'Failed to remove member.'))
    }
  } catch (error) {
    console.error('Network error:', error)
  }
}

// Builds the actions dropdown HTML for a member row (call this when rendering table rows)
function buildMemberActionsHtml (user) {
  const viewUrl = `/team/${window.TEAM_ID}/scheduler/?worker_id=${user.id}`
  return `
    <div class="dropdown">
      <button class="action-dots" onclick="toggleActionMenu(event, this)">⋮</button>
      <div class="dropdown-content">
        <a href="${viewUrl}"><i class="fa-solid fa-calendar-days"></i> View Schedule</a>
        <a href="#" onclick="resetMember('${user.id}', '${user.name}')">Reset Assignments</a>
        <hr>
        <a href="#" class="text-danger" onclick="removeUserFromTeam('${user.id}', '${user.name}')">Remove from Team</a>
      </div>
    </div>`
}

function toggleActionMenu (event, button) {
  event.stopPropagation()
  const parent = button.parentElement

  // Close all other open menus first
  document.querySelectorAll('.dropdown').forEach(d => {
    if (d !== parent) d.classList.remove('active')
  })

  parent.classList.toggle('active')
}

// Close any open action menu when clicking elsewhere on the page
window.addEventListener('click', () => {
  document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('active'))
})