// ROOM SCHEDULER

function openScheduler () {
  document.getElementById('schedulerModal').classList.add('show')

  // Clear any active room selection
  document.querySelectorAll('.room-list-item').forEach(item => item.classList.remove('active'))
  document.getElementById('roomSelect').value = ''
  document.getElementById('selectedRoomTitle').textContent = 'Click New Room or Select a Room'

  // Show the grid and clear leftover blocks
  document.getElementById('schedulerGrid').style.display = 'block'
  document.querySelectorAll('.room-block').forEach(block => block.remove())
}

function closeScheduler () {
  document.getElementById('schedulerModal').classList.remove('show')
}

// Highlights the selected room in the sidebar, updates the title, and loads its availability
function selectRoom (roomId, roomName, element) {
  document.querySelectorAll('.room-list-item').forEach(item => item.classList.remove('active'))
  element.classList.add('active')

  document.getElementById('selectedRoomTitle').textContent = `Editing: ${roomName}`
  document.getElementById('schedulerGrid').style.display = 'block'

  // Sync the hidden input so save/delete functions know which room is active
  const hiddenSelect = document.getElementById('roomSelect')
  hiddenSelect.value = roomId
  hiddenSelect.dispatchEvent(new Event('change'))
}

function clearGrid () {
  document.querySelectorAll('.room-block').forEach(block => block.remove())
  document.getElementById('roomSelect').value = ''
  document.getElementById('schedulerGrid').style.display = 'none'
  document.getElementById('selectedRoomTitle').textContent = 'Select a Room'
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
      const newRoomId = data.room_id || data.id
      const newRoomCardHtml = `
        <div class="room-list-item" data-room-id="${newRoomId}"
             onclick="selectRoom('${newRoomId}', '${roomName}', this)">
          <strong>${roomName}</strong><br>
          <span style="font-size: 12px; color: #666;">Capacity: ${parseInt(roomCapacity) || 0}</span>
        </div>`

      const roomListContainer = document.getElementById('roomList')
      roomListContainer.insertAdjacentHTML('beforeend', newRoomCardHtml)

      // Automatically select the newly created room
      selectRoom(newRoomId, roomName, roomListContainer.lastElementChild)
    } else {
      alert(data.error || 'Failed to add room.')
    }
  } catch (error) {
    console.error('Network/Server error:', error)
    alert('An error occurred. Check your connection or login status.')
  }
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
    })

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

    const cardToRemove = document.querySelector(`.room-list-item[data-room-id="${selectedRoomId}"]`)
    if (cardToRemove) cardToRemove.remove()

    const remainingRooms = document.querySelectorAll('.room-list-item')
    if (remainingRooms.length > 0) {
      remainingRooms[0].click()
    } else {
      clearGrid()
    }
  } catch (error) {
    console.error('Error deleting room:', error)
    alert('Failed to delete room.')
  }
}

async function loadSavedTimes () {
  const roomSelect = document.getElementById('roomSelect')
  const selectedRoomId = roomSelect.value

  if (!selectedRoomId || selectedRoomId === 'undefined') return

  document.querySelectorAll('.room-block').forEach(block => block.remove())

  const dayStringToInt = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }

  try {
    const response = await fetch(`/api/room/${selectedRoomId}/availability/`)
    if (!response.ok) throw new Error('Failed to fetch room availability')

    const data = await response.json()
    const times = data.savedTimes || []

    times.forEach(item => {
      let dayIndex
      if (typeof item.day === 'string') {
        dayIndex = dayStringToInt[item.day.toLowerCase()]
      } else {
        dayIndex = item.day
      }

      if (dayIndex === undefined) return
      const dayCol = document.querySelector(`.day-col[data-day="${dayIndex}"]`)
      if (!dayCol) return

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

      const totalStartMin = startMin - START_HOUR * 60
      const totalEndMin = endMin - START_HOUR * 60

      if (totalStartMin < 0) return

      const topPx = (totalStartMin / 15) * SLOT_HEIGHT
      const heightPx = ((totalEndMin - totalStartMin) / 15) * SLOT_HEIGHT

      dayCol.appendChild(createBlock(dayIndex, topPx, heightPx))
    })
  } catch (error) {
    console.error('Error loading saved times:', error)
  }
}

async function saveCurrentRoom () {
  const roomSelect = document.getElementById('roomSelect')

  if (!roomSelect || !roomSelect.value) {
    alert("Please click 'New Room' to create and name a room before saving its availability!")
    return
  }

  const selectedRoomId = roomSelect.value
  const roomTimeData = []

  document.querySelectorAll('.room-block').forEach(ev => {
    const day = ev.parentElement.dataset.day
    const topPx = parseFloat(ev.style.top) || 0
    const heightPx = parseFloat(ev.style.height) || 0

    const startSlotIndex = Math.round(topPx / SLOT_HEIGHT)
    const slotsCount = Math.round(heightPx / SLOT_HEIGHT)

    const startMin = startSlotIndex * 15 + START_HOUR * 60
    const endMin = startMin + slotsCount * 15

    roomTimeData.push({
      day: parseInt(day),
      start_min: startMin,
      end_min: endMin,
      room: selectedRoomId
    })
  })

  try {
    const response = await fetch(`/api/team/${window.TEAM_ID}/rooms/save-availability/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCookie('csrftoken')
      },
      body: JSON.stringify({ times: roomTimeData, room_id: selectedRoomId })
    })

    if (response.ok) {
      alert('Room availability saved successfully!')
    } else {
      alert(`Error: Save failed with status ${response.status}`)
    }
  } catch (error) {
    console.error('Error saving events:', error)
    alert('Could not connect to the server. Please check your connection.')
  }
}