/** @file Handles the logic for all of the member information */
/** @module Supervisor */

// Fetches sections for a given role and populates the provided <select>
/**
 * Fetches the available sections for a specific role from the server and 
 * populates the provided HTML `<select>` element. If no sections exist for 
 * the role, the dropdown is hidden.
 *
 * @async
 * @param {string|number} roleId - The ID of the role to fetch sections for.
 * @param {HTMLSelectElement} sectionSelect - The DOM element of the select dropdown to populate.
 * @returns {Promise<void>} Resolves when the select dropdown is updated or hidden.
 */
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
/**
 * Event handler triggered when a user changes a member's assigned role.
 * Clears and hides the associated section dropdown if no role is selected. 
 * Otherwise, dynamically loads the corresponding sections for the newly selected role.
 *
 * @async
 * @param {HTMLSelectElement} select - The role select dropdown that triggered the change.
 * @returns {Promise<void>} Resolves when the related section dropdown is fully updated.
 */
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

/**
 * Sends a request to the server to update a single member's role assignment.
 * Provides brief UI feedback by disabling the select element during the request.
 *
 * @async
 * @param {HTMLSelectElement} selectElement - The select element containing the member's new role ID.
 * @returns {Promise<void>} Resolves when the server update finishes (success or failure).
 */
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

/**
 * Sends a POST request to update a specific member's section assignment.
 * Note: Uses a text value for the section payload rather than an ID, depending on the backend implementation.
 *
 * @async
 * @param {HTMLInputElement|HTMLSelectElement} input - The input or select element containing the section data.
 * @returns {Promise<void>} Resolves after the fetch request completes.
 */
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

/**
 * Iterates over all member rows on the page, compiles their current role 
 * and section assignments, and sends a single bulk POST request to save them 
 * to the database. Displays an alert indicating success or failure.
 *
 * @async
 * @returns {Promise<void>} Resolves when the bulk save operation completes.
 */
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
/**
 * Prompts for confirmation before sending a request to the server to explicitly 
 * clear a member's role and section assignments (setting them to null). 
 * On success, resets the UI dropdowns and flashes a green highlight on the member's row.
 *
 * @async
 * @param {string|number} userId - The ID of the user to reset.
 * @param {string} userName - The name of the user (used in the confirmation prompt).
 * @returns {Promise<void>} Resolves when the reset operation completes.
 */
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
    }
  } catch (error) {
    console.error('Reset error:', error)
  }
}

/**
 * Prompts for severe confirmation before permanently removing a user from the current team via API.
 * Upon success, smoothly fades out and removes the user's row from the UI table.
 *
 * @async
 * @param {string|number} userId - The ID of the user to remove.
 * @param {string} username - The user's name (used in the confirmation prompt).
 * @returns {Promise<void>} Resolves when the removal process completes.
 */
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
/**
 * Constructs the HTML string for the "Actions" dropdown menu (the three-dot menu) 
 * for a specific user in the members table.
 *
 * @param {Object} user - The user object containing at least `id` and `name` properties.
 * @returns {string} The raw HTML string representing the action dropdown.
 */
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

/**
 * Toggles the visibility of a specific member action menu (dropdown).
 * Ensures that all other open menus on the page are closed before opening the targeted one.
 *
 * @param {Event} event - The DOM click event object.
 * @param {HTMLElement} button - The action dot button that was clicked.
 */
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