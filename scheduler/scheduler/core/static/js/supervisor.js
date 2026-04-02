/* --- CONFIGURATION --- */
const START_HOUR = 8 // 8 AM
const END_HOUR = 19 // 6 PM (7pm not included)
const HOURS_TOTAL = END_HOUR - START_HOUR

// Updated to match our new compact CSS
const SLOT_HEIGHT = 10 // 10px = 15 mins
const PIXELS_PER_HOUR = 40 // 40px = 1 hour
const csrfToken = document
  .querySelector('meta[name="csrf-token"]')
  .getAttribute('content')

// Pull data from the hidden HTML elements
const roomElements = document.querySelectorAll('.room-info')
let roomData = Array.from(roomElements).map(el => ({
  id: el.dataset.id,
  name: el.dataset.name,
  schedule: [] // Will store objects: { day: 0, top: 0, height: 60 }
}))

// Set the first room as default
document.addEventListener('DOMContentLoaded', () => {
  let currentRoomId = roomData.length > 0 ? roomData[0].id : null

  document.getElementById('roomSelect').addEventListener('change', function () {
    loadSavedTimes()
  })

  // ... rest of your initialization code
})
/* --- INITIALIZATION --- */
document.addEventListener('DOMContentLoaded', () => {
  setupRoomGrid()
  setupDrawListeners()

  // --- Profile Dropdown Logic ---
  const profileContainer = document.querySelector('.user-profile-container')
  if (profileContainer) {
    profileContainer.addEventListener('click', event => {
      event.stopPropagation()
      profileContainer.classList.toggle('active')
    })

    document.addEventListener('click', event => {
      // Close if clicked outside the container
      if (!profileContainer.contains(event.target)) {
        profileContainer.classList.remove('active')
      }
    })
  }
  document.querySelectorAll('.member-role-select').forEach(async select => {
    const roleId = select.value
    const userId = select.dataset.userId
    if (!roleId) return

    const sectionSelect = document.querySelector(
      `.member-section-select[data-user-id="${userId}"]`
    )
    await loadSectionsIntoDropdown(roleId, sectionSelect)

    const savedSectionId = sectionSelect.dataset.currentSectionId
    if (savedSectionId) {
      sectionSelect.value = savedSectionId
    }
  })
})

/* --- GRID GENERATION --- */
/* --- GRID GENERATION --- */
function setupRoomGrid () {
  const timeCol = document.getElementById('roomTimeCol')
  timeCol.innerHTML = ''

  // Calculate a small offset to center labels in the 30-min block
  const halfBlockOffset = (0.5 * PIXELS_PER_HOUR) / 2

  for (let i = 0; i < HOURS_TOTAL; i += 0.5) {
    const label = document.createElement('div')
    label.className = 'time-label'

    // Push the label down slightly so it's centered in the row
    const topPosition = i * PIXELS_PER_HOUR + halfBlockOffset / 2
    label.style.top = `${topPosition}px`

    const totalHours = START_HOUR + i
    const hour = Math.floor(totalHours)
    const minutes = (totalHours % 1) * 60

    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    const displayMinutes = minutes === 0 ? '00' : '30'

    label.textContent = `${displayHour}:${displayMinutes} ${ampm}`
    timeCol.appendChild(label)
  }

  // Ensure the grey time column and grid lines stretch to the bottom
  const totalHeight = HOURS_TOTAL * PIXELS_PER_HOUR
  document.getElementById('roomTimeCol').style.height = `${totalHeight}px`
  document.querySelector('.grid-lines').style.height = `${totalHeight}px`
  document
    .querySelectorAll('.day-col')
    .forEach(c => (c.style.height = `${totalHeight}px`))
}

/* --- DRAG LOGIC --- */
let isDrawing = false
let currentBlock = null
let startY = 0

function setupDrawListeners () {
  const cols = document.querySelectorAll('#schedulerGrid .day-col')

  cols.forEach(col => {
    const dayIndex = col.dataset.day

    col.addEventListener('mousedown', e => {
      if (
        e.target.closest('.delete-btn') ||
        e.target.classList.contains('room-block')
      )
        return

      isDrawing = true
      const rect = col.getBoundingClientRect()
      const relativeY = e.clientY - rect.top

      startY = Math.floor(relativeY / SLOT_HEIGHT) * SLOT_HEIGHT

      currentBlock = createBlock(dayIndex, startY, SLOT_HEIGHT)
      col.appendChild(currentBlock)
    })

    col.addEventListener('mousemove', e => {
      if (!isDrawing || !currentBlock) return

      const rect = col.getBoundingClientRect()
      const relativeY = e.clientY - rect.top
      const currentY = Math.floor(relativeY / SLOT_HEIGHT) * SLOT_HEIGHT

      let finalTop, finalHeight

      if (currentY >= startY) {
        finalTop = startY
        finalHeight = currentY - startY + SLOT_HEIGHT
      } else {
        finalTop = currentY
        finalHeight = startY - currentY + SLOT_HEIGHT
      }

      // Update the block's visual position
      currentBlock.style.top = `${finalTop}px`
      currentBlock.style.height = `${finalHeight}px`

      // UPDATE: Find the text span and update the label while dragging
      const timeText = currentBlock.querySelector('.time-range-text')
      if (timeText) {
        timeText.textContent = `${formatTime(finalTop)} - ${formatTime(
          finalTop + finalHeight
        )}`
      }
    })
  })

  document.addEventListener('mouseup', () => {
    isDrawing = false
    currentBlock = null
  })
}

function openScheduler() {
    // 1. Show the modal
    document.getElementById('schedulerModal').classList.add('show');

    // 2. Remove the "active" highlight from all rooms in the sidebar
    document.querySelectorAll('.room-list-item').forEach(item => {
        item.classList.remove('active');
    });

    // 3. Clear the hidden input value so the app knows NO room is selected yet
    document.getElementById('roomSelect').value = '';

    // 4. Reset the right-side UI text
    document.getElementById('selectedRoomTitle').textContent = 'New Room (Unsaved) or Select a Room';

    // 5. SHOW the grid immediately!
    document.getElementById('schedulerGrid').style.display = 'block';

    // 6. Erase any green time blocks that might be left over from the last opened room
    document.querySelectorAll('.room-block').forEach(block => block.remove());
}

function closeScheduler() {
    document.getElementById('schedulerModal').classList.remove('show');
}

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
      // Add role-block to the roles list (matches template structure)
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

      // Add to all role dropdowns (member assignment + fixed events)
      const newOption = `<option value="${data.role_id}">${data.name}</option>`
      document.querySelectorAll('select[data-user-id]').forEach(dropdown => {
        dropdown.insertAdjacentHTML('beforeend', newOption)
      })
      document
        .getElementById('eventRoleInput')
        .insertAdjacentHTML('beforeend', newOption)

      document.getElementById('newRoleInput').value = ''
    } else {
      alert(data.error || 'Failed to add role.')
    }
  } catch (error) {
    console.error(error)
    alert('An error occurred while adding the role.')
  }
}

async function deleteRole (icon) {
  const block = icon.closest('.role-block')
  const roleId = block.dataset.roleId

  if (
    !confirm('Delete this role? This will unassign all members with this role.')
  )
    return

  try {
    const response = await fetch(
      `/api/team/${window.TEAM_ID}/roles/${roleId}/delete/`,
      {
        method: 'DELETE',
        headers: { 'X-CSRFToken': csrfToken }
      }
    )

    if (response.ok) {
      block.remove()
      // Remove from all dropdowns
      document
        .querySelectorAll(`option[value="${roleId}"]`)
        .forEach(o => o.remove())
    } else {
      alert('Failed to delete role.')
    }
  } catch (error) {
    console.error(error)
    alert('An error occurred.')
  }
}

function formatTime (pixels) {
  // Calculate total minutes from the top of the grid
  const totalMinutes = (pixels / PIXELS_PER_HOUR) * 60

  // Add to START_HOUR
  let hours = START_HOUR + Math.floor(totalMinutes / 60)
  let mins = Math.floor(totalMinutes % 60)

  // Format as 12-hour AM/PM
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12 || 12 // Convert 0 to 12
  mins = mins < 10 ? '0' + mins : mins

  return `${hours}:${mins} ${ampm}`
}

function createBlock (day, top, height) {
  const block = document.createElement('div')
  block.className = 'room-block'
  block.style.top = `${top}px`
  block.style.height = `${height}px`
  block.dataset.day = day

  // NEW: Create a span to hold the time text
  const timeSpan = document.createElement('span')
  timeSpan.className = 'time-range-text'
  timeSpan.textContent = `${formatTime(top)} - ${formatTime(top + height)}`
  block.appendChild(timeSpan)

  const delBtn = document.createElement('button')
  delBtn.className = 'delete-btn'
  delBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>'
  delBtn.onclick = function (ev) {
    ev.stopPropagation()
    block.remove()
  }

  block.appendChild(delBtn)
  return block
}

async function addNewRoom () {
  const roomName = prompt('Enter new room name:')
  const roomCapacity = prompt('Enter room capacity:')

  if (!roomName) return

  try {
    const response = await fetch(`/api/team/${window.TEAM_ID}/rooms/create/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken
      },
      body: JSON.stringify({
        name: roomName,
        capacity: parseInt(roomCapacity) || 0
      })
    })

    const data = await response.json()

    if (response.ok) {
      // 1. Build the new sidebar card
      const newRoomId = data.room_id || data.id; // Fallback depending on what your backend sends
      const newRoomCardHtml = `
          <div class="room-list-item" data-room-id="${newRoomId}" onclick="selectRoom('${newRoomId}', '${roomName}', this)">
              <strong>${roomName}</strong><br>
              <span style="font-size: 12px; color: #666;">Capacity: ${parseInt(roomCapacity) || 0}</span>
          </div>
      `;

      // 2. Inject it into the sidebar
      const roomListContainer = document.getElementById('roomList');
      roomListContainer.insertAdjacentHTML('beforeend', newRoomCardHtml);

      // 3. Automatically click/select the newly created room!
      const newlyAddedElement = roomListContainer.lastElementChild;
      selectRoom(newRoomId, roomName, newlyAddedElement);

      console.log('Room successfully created and added to UI with ID:', data)
    } else {
      alert(data.error || 'Failed to add room.')
    }
  } catch (error) {
    console.error('Network/Server error:', error)
    alert('An error occurred. Check your connection or login status.')
  }
}

async function loadSavedTimes () {
  const roomSelect = document.getElementById('roomSelect')
  const selectedRoomId = roomSelect.value
  console.log(selectedRoomId)

  if (!selectedRoomId || selectedRoomId === 'undefined') return

  // 1. Clear current visual blocks
  document.querySelectorAll('.room-block').forEach(block => block.remove())

  // 2. Map string days (if your DB returns 'mon', 'tue') to indices
  // If your DB already returns 0, 1, 2, you can skip this mapping
  const dayStringToInt = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6
  }

  try {
    const response = await fetch(`/api/room/${selectedRoomId}/availability/`)
    console.log(response)
    if (!response.ok) throw new Error('Failed to fetch room availability')

    const data = await response.json()
    // Extract the list from the "savedTimes" key in your JsonResponse
    const times = data.savedTimes || []

    times.forEach(item => {
      // 3. Find the correct column
      // Handle both integer days and string days
      let dayIndex
      if (typeof item.day === 'string') {
        dayIndex = dayStringToInt[item.day.toLowerCase()]
      } else {
        dayIndex = item.day
      }

      if (dayIndex === undefined) return
      const dayCol = document.querySelector(`.day-col[data-day="${dayIndex}"]`)
      if (!dayCol) return

      // 4. Calculate Time & Pixels (Matching your 15-min SLOT_HEIGHT logic)
      // If your API returns start_min (integers), use them directly.
      // If it returns "HH:MM" strings, use the split logic from your 2nd function.
      let startMin, endMin

      if (item.start_min !== undefined) {
        startMin = item.start_min
        endMin = item.end_min
      } else {
        const startParts = item.start.split(':')
        const endParts = item.end.split(':')
        startMin = parseInt(startParts[0]) * 60 + parseInt(startParts[1])
        endMin = parseInt(endParts[0]) * 60 + parseInt(endParts[1])
      }

      // Adjust relative to calendar start (e.g. 8:00 AM)
      const totalStartMin = startMin - START_HOUR * 60
      const totalEndMin = endMin - START_HOUR * 60

      if (totalStartMin < 0) return

      // Calculate Pixel Position using SLOT_HEIGHT (15-min increments)
      const topPx = (totalStartMin / 15) * SLOT_HEIGHT
      const heightPx = ((totalEndMin - totalStartMin) / 15) * SLOT_HEIGHT

      // 5. Create the Element (Matching room-block style)
      const block = createBlock(dayIndex, topPx, heightPx)

      // Optional: If you want the specific text/loc from the 2nd function:
      // block.querySelector('.time-range-text').textContent = `${item.start} - ${item.end}`;

      dayCol.appendChild(block)
    })
  } catch (error) {
    console.error('Error loading saved times:', error)
  }
}

async function saveCurrentRoom() {
    const roomSelect = document.getElementById('roomSelect');

    // 👇 THE NEW SAFETY CHECK GOES HERE 👇
    // If the hidden input is empty, it means they haven't clicked/created a room yet!
    if (!roomSelect || !roomSelect.value) {
        alert("Please click 'New Room' to create and name a room before saving its availability!");
        return; // Stops the function from trying to save
    }

    const selectedRoomId = roomSelect.value;
    const openTime = document.querySelectorAll('.room-block');
    const roomTimeData = [];

    const sHeight = SLOT_HEIGHT;
    const sHour = START_HOUR;

    openTime.forEach(ev => {
        const day = ev.parentElement.dataset.day;
        const topPx = parseFloat(ev.style.top) || 0;
        const heightPx = parseFloat(ev.style.height) || 0;

        const startSlotIndex = Math.round(topPx / sHeight);
        const slotsCount = Math.round(heightPx / sHeight);

        const startMin = startSlotIndex * 15 + sHour * 60;
        const endMin = startMin + slotsCount * 15;

        roomTimeData.push({
            day: parseInt(day),
            start_min: startMin,
            end_min: endMin,
            room: selectedRoomId
        });
    });

    try {
        const response = await fetch(
            `/api/team/${window.TEAM_ID}/rooms/save-availability/`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify({ times: roomTimeData, room_id: selectedRoomId })
            }
        );

        if (response.ok) {
            // THE BASIC ALERT
            alert('Room availability saved successfully!');

            // Optional: close the scheduler modal if the function exists
            if (typeof closeScheduler === 'function') {
                closeScheduler();
            }
        } else {
            alert(`Error: Save failed with status ${response.status}`);
        }
    } catch (error) {
        console.error('Error saving events:', error);
        alert('Could not connect to the server. Please check your connection.');
    }
}

function getCookie (name) {
  let cookieValue = null
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';')
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim()
      if (cookie.substring(0, name.length + 1) === name + '=') {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1))
        break
      }
    }
  }

  return cookieValue
}

async function deleteRoom () {
  const roomSelect = document.getElementById('roomSelect')
  const selectedRoomId = roomSelect.value

  if (!selectedRoomId) {
    alert('No room selected to delete.')
    return
  }

  if (!confirm('Are you sure you want to delete this room and all its availability?')) return

  try {
    const response = await fetch(`/api/team/${window.TEAM_ID}/rooms/delete/`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken
        },
        body: JSON.stringify({ room_id: selectedRoomId })
      }
    )

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

    // 1. Find and remove the visual card from the sidebar
    const cardToRemove = document.querySelector(`.room-list-item[data-room-id="${selectedRoomId}"]`);
    if (cardToRemove) cardToRemove.remove();

    // 2. Decide what to show next
    const remainingRooms = document.querySelectorAll('.room-list-item');
    if (remainingRooms.length > 0) {
      // If there are rooms left, automatically click the first one
      remainingRooms[0].click();
    } else {
      // NO ROOMS LEFT: Wipe everything
      clearGrid()
    }
  } catch (error) {
    console.error('Error deleting room:', error)
    alert('Failed to delete room.')
  }
}

function clearGrid () {
  // 1. Remove all green room-blocks from the columns
  const blocks = document.querySelectorAll('.room-block')
  blocks.forEach(block => block.remove())

  // 2. Clear the hidden input value
  const roomSelect = document.getElementById('roomSelect')
  roomSelect.value = ''

  // 3. Hide the grid and update the title
  document.getElementById('schedulerGrid').style.display = 'none';
  document.getElementById('selectedRoomTitle').textContent = 'Select a Room';
}

async function updateMemberRole (selectElement) {
  const workerId = selectElement.dataset.memberId // Now maps to entry.user.id
  const roleId = selectElement.value

  // UI Feedback: Disable and dim while saving
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
        worker_id: workerId, // Ensure this is the User ID
        role_id: roleId // The ID from the <option> value
      })
    })

    const data = await response.json()

    if (response.ok) {
      console.log('Success:', data.status)
      // Optional: You could add a green border briefly to show success
    } else {
      alert(data.error || 'Failed to update role.')
    }
  } catch (error) {
    console.error('Network Error:', error)
    alert('An error occurred. Check your connection.')
  } finally {
    // Restore the element
    selectElement.disabled = false
    selectElement.style.opacity = '1'
  }
}

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
  // Default end time to 1 slot after start
  endSelect.selectedIndex = 1
}

function formatMin (totalMinutes) {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  const suffix = h >= 12 ? 'PM' : 'AM'
  const displayH = h > 12 ? h - 12 : h === 0 || h === 12 ? 12 : h
  const displayM = m < 10 ? '0' + m : m
  return `${displayH}:${displayM} ${suffix}`
}

function timeToMin (timeStr) {
  // Handle both "10:00 AM" and "10:00" formats
  const cleaned = timeStr.trim()
  const parts = cleaned.split(':')
  const h = parseInt(parts[0])
  const m = parseInt(parts[1]) // parseInt ignores " AM" suffix automatically
  return h * 60 + m
}

async function addFixedEvent () {
  const name = document.getElementById('eventNameInput').value.trim()
  const roleId = document.getElementById('eventRoleInput').value
  const section = document.getElementById('eventSectionInput').value || null
  const startMin = timeToMin(document.getElementById('eventStartTime').value)
  const endMin = timeToMin(document.getElementById('eventEndTime').value)
  const checkedDays = [
    ...document.querySelectorAll('.day-check input:checked')
  ].map(cb => parseInt(cb.value))
  console.log('start:', '->', startMin)
  console.log('end:', '->', endMin)
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
    const response = await fetch(
      `/api/team/${window.TEAM_ID}/obstructions/create/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken
        },
        body: JSON.stringify({
          name: name,
          role_id: roleId,
          section: section,
          start_min: startMin,
          end_min: endMin,
          days: checkedDays // e.g. [1, 3, 5] for Mon/Wed/Fri
        })
      }
    )

    const data = await response.json()
    if (response.ok) {
      const tag = document.createElement('span')
      tag.className = 'role-tag'
      tag.dataset.obstructionId = data.obstruction_id // store the ID
      tag.innerHTML = `
    <strong>${name}</strong>&nbsp;
    ${dayLabel} &bull; ${formatMin(startMin)} - ${formatMin(endMin)}
    <i class="fa-solid fa-xmark" onclick="deleteObstruction(this)"></i>
`
      document.getElementById('fixed-events-list').appendChild(tag)

      // Clear form
      document.getElementById('eventNameInput').value = ''
      document
        .querySelectorAll('.day-check input')
        .forEach(cb => (cb.checked = false))
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
        headers: {
          'X-CSRFToken': csrfToken
        }
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

async function updateMemberSection (input) {
  const userId = input.dataset.memberId // was dataset.userId
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

// Initialize section dropdowns on page load
document.addEventListener('DOMContentLoaded', () => {
  // For each row that has a role selected, load its sections
  document.querySelectorAll('.member-role-select').forEach(async select => {
    const roleId = select.value
    const userId = select.dataset.userId
    if (!roleId) return

    const sectionSelect = document.querySelector(
      `.member-section-select[data-user-id="${userId}"]`
    )
    await loadSectionsIntoDropdown(roleId, sectionSelect)

    // Set the current section from Django context
    const currentSectionId = select
      .closest('tr')
      ?.querySelector('.member-section-select')?.dataset.currentSectionId
    if (currentSectionId) {
      sectionSelect.value = currentSectionId
    }
  })
})

async function loadSectionsIntoDropdown (roleId, sectionSelect) {
  const res = await fetch(
    `/api/team/${window.TEAM_ID}/roles/${roleId}/sections/`
  )
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

async function onRoleChange (select) {
  const userId = select.dataset.userId
  const roleId = select.value
  const sectionSelect = document.querySelector(
    `.member-section-select[data-user-id="${userId}"]`
  )

  if (!roleId) {
    sectionSelect.style.display = 'none'
    sectionSelect.innerHTML = '<option value="">No Section</option>'
    return
  }

  await loadSectionsIntoDropdown(roleId, sectionSelect)
}

async function saveAllAssignments () {
  const assignments = []

  document.querySelectorAll('.member-role-select').forEach(select => {
    const userId = select.dataset.userId
    const roleId = select.value || null
    const sectionSelect = document.querySelector(
      `.member-section-select[data-user-id="${userId}"]`
    )
    const sectionId = sectionSelect?.value || null

    assignments.push({
      user_id: userId,
      role_id: roleId,
      section_id: sectionId
    })
  })

  try {
    const res = await fetch(
      `/api/team/${window.TEAM_ID}/members/save-assignments/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken
        },
        body: JSON.stringify({ assignments })
      }
    )
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

function toggleSections (btn) {
  const sectionsDiv = btn.closest('.role-block').querySelector('.role-sections')
  const isVisible = sectionsDiv.style.display !== 'none'
  sectionsDiv.style.display = isVisible ? 'none' : 'block'
  btn.textContent = isVisible ? '+ Sections' : '- Sections'
}

async function addSection (btn) {
  const roleBlock = btn.closest('.role-block')
  const roleId = roleBlock.dataset.roleId
  const input = roleBlock.querySelector('.new-section-input')
  const name = input.value.trim()

  if (!name) return

  try {
    const res = await fetch(
      `/api/team/${window.TEAM_ID}/roles/${roleId}/sections/create/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken
        },
        body: JSON.stringify({ name })
      }
    )
    const data = await res.json()
    if (!res.ok) {
      alert(data.error || 'Failed to add section.')
      return
    }

    // Add tag to UI
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

async function onEventRoleChange (select) {
  const roleId = select.value
  const sectionSelect = document.getElementById('eventSectionInput')

  if (!roleId) {
    sectionSelect.style.display = 'none'
    sectionSelect.innerHTML = '<option value="">All sections</option>'
    return
  }

  await loadSectionsIntoDropdown(roleId, sectionSelect)
  // Override the default "No Section" label for this context
  sectionSelect.options[0].textContent = 'All sections'
}

function selectRoom(roomId, roomName, element) {
    // 1. Highlight the clicked room in the sidebar
    document.querySelectorAll('.room-list-item').forEach(item => {
        item.classList.remove('active');
    });
    element.classList.add('active');

    // 2. Update the Title and reveal the grid
    document.getElementById('selectedRoomTitle').textContent = `Editing: ${roomName}`;
    document.getElementById('schedulerGrid').style.display = 'block';

    // 3. Update the hidden input value so your existing save/delete functions still know which room is active
    const hiddenSelect = document.getElementById('roomSelect');
    hiddenSelect.value = roomId;

    // 4. Trigger whatever function you previously used to load the room's data!
    // (If you had an onchange event on your old dropdown like "loadRoomData()", call it here)

    // Example:
    // loadRoomAvailability(roomId);

    // To trigger an existing "change" event listener if you had one attached to the old dropdown:
    hiddenSelect.dispatchEvent(new Event('change'));
}

document.addEventListener('DOMContentLoaded', () => {
    // 👇 CHANGED: Now looks for the input inside the .search-wrapper div
    const searchInput = document.querySelector('.search-wrapper input');

    // Selects all the rows inside your specific table body
    const tableRows = document.querySelectorAll('.table-card tbody tr');

    if (searchInput) {
        searchInput.addEventListener('input', function() {
            // Convert search query to lowercase for case-insensitive matching
            const searchTerm = this.value.toLowerCase();

            tableRows.forEach(row => {
                // Grab all text from the row (Name, Email, Username, Role, etc.)
                const rowText = row.textContent.toLowerCase();

                // If the row contains the search term, show it. Otherwise, hide it.
                if (rowText.includes(searchTerm)) {
                    row.style.display = ''; // Shows the row
                } else {
                    row.style.display = 'none'; // Hides the row
                }
            });
        });
    }
});
