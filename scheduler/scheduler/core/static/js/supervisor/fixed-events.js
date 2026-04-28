// FIXED EVENTS (OBSTRUCTIONS)
/** @file Handles the logic for fixed events tied to certain roles that users can't be scheduled during */
/** @module Supervisor */

// Populates the start/end time dropdowns in 15-min increments from 7 AM to 10 PM
/**
 * Populates the start and end time select dropdowns for the fixed event form.
 * Generates options in 15-minute increments from 7:00 AM to 10:00 PM (22:00).
 *
 * @returns {void}
 */
function populateTimeDropdowns () {
  const startSelect = document.getElementById('eventStartTime')
  const endSelect = document.getElementById('eventEndTime')

  for (let h = 7; h <= 22; h++) {
    for (let m = 0; m < 60; m += 15) {
      const totalMin = h * 60 + m
      const label = formatMin(totalMin)
      startSelect.appendChild(new Option(label, totalMin))
      endSelect.appendChild(new Option(label, totalMin))
    }
  }
  endSelect.selectedIndex = 1
}

/**
 * Gathers form data for a new fixed event (obstruction), validates the inputs, 
 * and sends a POST request to the server to create the event. On success, 
 * dynamically appends a new event tag to the UI and clears the form.
 *
 * @async
 * @returns {Promise<void>} Resolves when the creation process completes.
 */
async function addFixedEvent () {
  const name = document.getElementById('eventNameInput').value.trim()
  const location = document.getElementById('eventLocationInput').value.trim()
  const roleId = document.getElementById('eventRoleInput').value
  const section = document.getElementById('eventSectionInput').value || null
  // Note: timeToMin requires a standard time format (e.g., "10:00 AM" or "14:30")
  // Make sure the dropdown values match what timeToMin expects, or adjust if they are already in minutes.
  // In the current implementation, populateTimeDropdowns sets values as total minutes, so timeToMin might not be needed if reading .value, depending on how timeToMin handles pure numbers. Assuming it handles the formatted string here based on previous utils.
  const startMin = timeToMin(document.getElementById('eventStartTime').options[document.getElementById('eventStartTime').selectedIndex].text)
  const endMin = timeToMin(document.getElementById('eventEndTime').options[document.getElementById('eventEndTime').selectedIndex].text)
  
  const checkedDays = [...document.querySelectorAll('.day-check input:checked')].map(cb =>
    parseInt(cb.value)
  )

  if (!name) {
    alert('Please enter an event name.')
    return
  }
  if (checkedDays.length === 0) {
    alert('Please select at least one day.')
    return
  }
  if (endMin <= startMin) {
    alert('End time must be after start time.')
    return
  }

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dayLabel = checkedDays.map(d => dayNames[d]).join(', ')

  try {
    const response = await fetch(`/api/team/${window.TEAM_ID}/obstructions/create/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken
      },
      body: JSON.stringify({
        name,
        location,
        role_id: roleId,
        section,
        start_min: startMin,
        end_min: endMin,
        days: checkedDays
      })
    })

    const data = await response.json()

    if (response.ok) {
      const tag = document.createElement('span')
      tag.className = 'role-tag'
      tag.dataset.obstructionId = data.obstruction_id
      tag.innerHTML = `
        <strong>${name}</strong>&nbsp;
        <em>${location}</em>&nbsp;
        ${dayLabel} &bull; ${formatMin(startMin)} - ${formatMin(endMin)}
        <i class="fa-solid fa-xmark" onclick="deleteObstruction(this)"></i>`

      document.getElementById('fixed-events-list').appendChild(tag)

      // Clear form inputs
      document.getElementById('eventNameInput').value = ''
      document.querySelectorAll('.day-check input').forEach(cb => (cb.checked = false))
    } else {
      alert(data.error || 'Failed to add obstruction.')
    }
  } catch (error) {
    console.error('Error adding obstruction:', error)
    alert('An error occurred while adding the obstruction.')
  }
}

/**
 * Prompts the user for confirmation, then sends a DELETE request to the API 
 * to remove a specific fixed event (obstruction). On success, removes the 
 * event's DOM element from the UI.
 *
 * @async
 * @param {HTMLElement} icon - The DOM element of the delete icon that was clicked.
 * @returns {Promise<void>} Resolves when the deletion process completes.
 */
async function deleteObstruction (icon) {
  const tag = icon.closest('.role-tag')
  const obstructionId = tag.dataset.obstructionId

  if (!confirm('Remove this obstruction?')) return

  try {
    const response = await fetch(
      `/api/team/${window.TEAM_ID}/obstructions/${obstructionId}/delete/`,
      {
        method: 'DELETE',
        headers: { 'X-CSRFToken': csrfToken }
      }
    )

    if (response.ok) {
      tag.remove()
    } else {
      alert('Failed to delete obstruction.')
    }
  } catch (error) {
    console.error('Error deleting obstruction:', error)
    alert('An error occurred.')
  }
}

// Reloads the section dropdown when the role on the fixed-event form changes
/**
 * Event handler triggered when the role selection changes in the fixed event form.
 * It hides or populates the corresponding section dropdown based on the selected role.
 *
 * @async
 * @param {HTMLSelectElement} select - The role select dropdown element.
 * @returns {Promise<void>} Resolves when the section dropdown is updated.
 */
async function onEventRoleChange (select) {
  const roleId = select.value
  const sectionSelect = document.getElementById('eventSectionInput')

  if (!roleId) {
    sectionSelect.style.display = 'none'
    sectionSelect.innerHTML = '<option value="">All sections</option>'
    return
  }

  await loadSectionsIntoDropdown(roleId, sectionSelect)
  sectionSelect.options[0].textContent = 'All sections'
}