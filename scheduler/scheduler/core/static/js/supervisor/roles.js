/** @file Handles the logic showing and creating roles and sections */
/** @module Supervisor */

/**
 * Reads the role name from the input field, sends a request to the server to create it,
 * and dynamically updates the UI to display the new role in the roles list, 
 * member-assignment dropdowns, fixed events, and the heatmap modal.
 *
 * @async
 * @returns {Promise<void>} Resolves when the role is successfully created and the UI is updated.
 */
async function addRole () {
  const roleName = document.getElementById('newRoleInput').value.trim()
  if (!roleName) {
    alert('Please enter a role name.')
    return
  }

  try {
    const response = await fetch(`/api/team/${window.TEAM_ID}/roles/create/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken
      },
      body: JSON.stringify({ name: roleName })
    })

    const data = await response.json()

    if (response.ok) {
      const rolesList = document.getElementById('roles-list')
      const block = document.createElement('div')
      block.className = 'role-block'
      block.dataset.roleId = data.role_id
      block.innerHTML = `
        <div class="role-block-header">
          <span class="role-name">${data.name}</span>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-secondary" style="padding:2px 8px; font-size:11px;"
                onclick="toggleSections(this)">+ Sections</button>
            <i class="fa-solid fa-xmark" style="cursor:pointer; color:#999;"
                onclick="deleteRole(this)"></i>
          </div>
        </div>
        <div class="role-sections" style="display:none; margin-top:8px;">
          <div class="sections-list"></div>
          <div style="display:flex; gap:6px; margin-top:6px;">
            <input type="text" class="new-section-input" placeholder="e.g. 001"
                style="width:80px; padding:4px 8px; border:1px solid #ccc; border-radius:4px; font-size:12px;">
            <button class="btn btn-secondary" style="padding:2px 8px; font-size:11px;"
                onclick="addSection(this)">Add</button>
          </div>
        </div>`
      rolesList.appendChild(block)

      // 1. Add the new role to all member-assignment dropdowns
      const newOption = `<option value="${data.role_id}">${data.name}</option>`
      document.querySelectorAll('select[data-user-id]').forEach(dropdown => {
        dropdown.insertAdjacentHTML('beforeend', newOption)
      })
      
      // 2. Update the fixed-event role input
      const eventRoleInput = document.getElementById('eventRoleInput');
      if (eventRoleInput) {
        eventRoleInput.insertAdjacentHTML('beforeend', newOption);
      }

      // 3. Update the Heatmap Modal role list
      const heatmapRoleList = document.getElementById('heatmapRoleList'); 
      if (heatmapRoleList) {
          const newHeatmapItem = `
            <div class="room-list-item" data-role-id="${data.role_id}"
                 onclick="selectHeatmapRole('${data.role_id}', '${data.name}', this)">
                <strong>${data.name}</strong>
            </div>
          `;
          heatmapRoleList.insertAdjacentHTML('beforeend', newHeatmapItem);
      }

      document.getElementById('newRoleInput').value = ''
    } else {
      alert(data.error || 'Failed to add role.')
    }
  } catch (error) {
    console.error(error)
    alert('An error occurred while adding the role.')
  }
}

/**
 * Prompts for confirmation, deletes a specified role via the API, and removes 
 * the corresponding role block and associated dropdown options from the DOM.
 *
 * @async
 * @param {HTMLElement} icon - The DOM element of the delete icon clicked by the user.
 * @returns {Promise<void>} Resolves when the role is successfully deleted.
 */
async function deleteRole (icon) {
  const block = icon.closest('.role-block')
  const roleId = block.dataset.roleId

  if (!confirm('Delete this role? This will unassign all members with this role.')) return

  try {
    const response = await fetch(`/api/team/${window.TEAM_ID}/roles/${roleId}/delete/`, {
      method: 'DELETE',
      headers: { 'X-CSRFToken': csrfToken }
    })

    if (response.ok) {
      block.remove()
      document.querySelectorAll(`option[value="${roleId}"]`).forEach(o => o.remove())
    } else {
      alert('Failed to delete role.')
    }
  } catch (error) {
    console.error(error)
    alert('An error occurred.')
  }
}

/**
 * Toggles the visibility of the sections container within a specific role block,
 * and updates the toggle button text ('+ Sections' or '- Sections') accordingly.
 *
 * @param {HTMLElement} btn - The toggle button DOM element that was clicked.
 */
function toggleSections (btn) {
  const sectionsDiv = btn.closest('.role-block').querySelector('.role-sections')
  const isVisible = sectionsDiv.style.display !== 'none'
  sectionsDiv.style.display = isVisible ? 'none' : 'block'
  btn.textContent = isVisible ? '+ Sections' : '- Sections'
}

/**
 * Reads the section name from the input field within a role block, sends a POST request 
 * to create the section on the server, and dynamically appends the new section tag to the UI.
 *
 * @async
 * @param {HTMLElement} btn - The "Add" button DOM element that was clicked inside the sections panel.
 * @returns {Promise<void>} Resolves when the section is created and the tag is added to the DOM.
 */
async function addSection (btn) {
  const roleBlock = btn.closest('.role-block')
  const roleId = roleBlock.dataset.roleId
  const input = roleBlock.querySelector('.new-section-input')
  const name = input.value.trim()

  if (!name) return

  try {
    const res = await fetch(`/api/team/${window.TEAM_ID}/roles/${roleId}/sections/create/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken
      },
      body: JSON.stringify({ name })
    })
    const data = await res.json()

    if (!res.ok) {
      alert(data.error || 'Failed to add section.')
      return
    }

    const sectionsList = roleBlock.querySelector('.sections-list')
    const tag = document.createElement('span')
    tag.className = 'section-tag'
    tag.dataset.sectionId = data.id
    tag.innerHTML = `${data.name} <i class="fa-solid fa-xmark" onclick="deleteSection(this)"></i>`
    sectionsList.appendChild(tag)

    input.value = ''
  } catch (err) {
    console.error(err)
  }
}

/**
 * Prompts for confirmation, deletes a specified section via the API, and removes 
 * its corresponding tag element from the DOM.
 *
 * @async
 * @param {HTMLElement} icon - The DOM element of the delete icon inside the section tag.
 * @returns {Promise<void>} Resolves when the section is successfully deleted.
 */
async function deleteSection (icon) {
  const tag = icon.closest('.section-tag')
  const sectionId = tag.dataset.sectionId
  const roleBlock = tag.closest('.role-block')
  const roleId = roleBlock.dataset.roleId

  if (!confirm('Delete this section?')) return

  try {
    const res = await fetch(
      `/api/team/${window.TEAM_ID}/roles/${roleId}/sections/${sectionId}/delete/`,
      {
        method: 'DELETE',
        headers: { 'X-CSRFToken': csrfToken }
      }
    )
    if (res.ok) tag.remove()
  } catch (err) {
    console.error(err)
  }
}