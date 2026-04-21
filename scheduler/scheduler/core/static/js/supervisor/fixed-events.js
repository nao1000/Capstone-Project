// FIXED EVENTS (OBSTRUCTIONS)

// Populates the start/end time dropdowns in 15-min increments from 7 AM to 10 PM
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

async function addFixedEvent () {
  const name = document.getElementById('eventNameInput').value.trim()
  const location = document.getElementById('eventLocationInput').value.trim()
  const roleId = document.getElementById('eventRoleInput').value
  const section = document.getElementById('eventSectionInput').value || null
  const startMin = timeToMin(document.getElementById('eventStartTime').value)
  const endMin = timeToMin(document.getElementById('eventEndTime').value)
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
    }
  } catch (error) {
    console.error('Error adding obstruction:', error)
    alert('An error occurred while adding the obstruction.')
  }
}

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