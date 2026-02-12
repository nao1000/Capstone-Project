// availability-logic.js

let isDrawing = false
let startY = 0
let startDayIndex = 0
let pendingBlockData = null // Store block data while modal is open
const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

document.addEventListener('DOMContentLoaded', () => {
  initBackgroundGrid()
  setupDrawingListeners()
  loadExistingData()
  styleModalElements() // NEW: Style modal on load
})

function initBackgroundGrid () {
  const bg = document.getElementById('gridBackground')
  if (!bg) return
  bg.innerHTML = ''
  for (let hour = window.START_HOUR; hour < window.END_HOUR; hour++) {
    for (let quarter = 0; quarter < 60; quarter += 15) {
      const label = document.createElement('div')
      label.className = 'time-slot-label'
      label.textContent = quarter === 0 ? `${hour}:00` : ''
      bg.appendChild(label)
      for (let d = 0; d < 7; d++) {
        const cell = document.createElement('div')
        cell.className = 'grid-cell-bg'
        cell.dataset.day = d
        bg.appendChild(cell)
      }
    }
  }
}

function loadExistingData() {
    if (!window.SAVED_AVAILABILITY) return;

    const dayMap = { 'sun': 0, 'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6 };

    window.SAVED_AVAILABILITY.forEach(avail => {
        // 1. Map the day string to index
        const dayIdx = dayMap[avail.day.toLowerCase()];
        if (dayIdx === undefined) return;

        // 2. Parse times
        const [sH, sM] = avail.start.split(':').map(Number);
        const [eH, eM] = avail.end.split(':').map(Number);

        const startTotalMins = sH * 60 + sM;
        const endTotalMins = eH * 60 + eM;

        // 3. Convert to Grid Pixels
        // Formula: (Minutes from grid start / 15-min increments) * pixel height
        const gridStartMins = window.START_HOUR * 60;
        const topPx = ((startTotalMins - gridStartMins) / 15) * 25;
        const bottomPx = ((endTotalMins - gridStartMins) / 15) * 25;

        // 4. Render
        renderBlockOnGrid({
            dayIndex: dayIdx,
            top: topPx,
            height: bottomPx - topPx,
            roleIds: avail.roleIds || [],
            roleNames: avail.roleNames || avail.event_name || 'Saved Range',
            building: avail.building || avail.location || '',
            color: avail.color || '#4a90e2',
            startTime: startTotalMins,
            endTime: endTotalMins,
            eventName: avail.event_name || ''
        });
    });
}

function setupDrawingListeners () {
  const wrapper = document.getElementById('gridWrapper')
  const overlay = document.getElementById('drawingOverlay')

  wrapper.onmousedown = e => {
    const cell = e.target.closest('.grid-cell-bg')
    if (!cell) return
    isDrawing = true
    const rect = wrapper.getBoundingClientRect()
    startDayIndex = parseInt(cell.dataset.day)
    startY = e.clientY - rect.top
    overlay.classList.remove('d-none')
  }

  window.onmousemove = e => {
    if (!isDrawing) return
    const rect = wrapper.getBoundingClientRect()
    const currentY = e.clientY - rect.top
    const top = Math.min(startY, currentY)
    const height = Math.abs(currentY - startY)
    const colWidth = (wrapper.offsetWidth - 60) / 7

    overlay.style.top = top + 'px'
    overlay.style.height = height + 'px'
    overlay.style.left = 60 + startDayIndex * colWidth + 'px'
    overlay.style.width = colWidth + 'px'
  }

  window.onmouseup = e => {
    if (!isDrawing) return
    isDrawing = false
    document.getElementById('drawingOverlay').classList.add('d-none')
    const rect = wrapper.getBoundingClientRect()
    finalizeDrawing(startY, e.clientY - rect.top)
  }
}

function finalizeDrawing (y1, y2) {
  const top = Math.floor(Math.min(y1, y2) / 25) * 25
  const bottom = Math.ceil(Math.max(y1, y2) / 25) * 25

  // Minimal block size (15 mins)
  if (bottom - top < 25) {
    console.log('Block too small, minimum is 25px')
    return
  }

  console.log('Opening modal for block:', {
    dayIndex: startDayIndex,
    top,
    height: bottom - top
  })

  // Calculate time range
  const startTotalMins = (top / 25) * 15 + window.START_HOUR * 60
  const endTotalMins = startTotalMins + ((bottom - top) / 25) * 15

  // Store pending block data and open modal
  pendingBlockData = {
    dayIndex: startDayIndex,
    top: top,
    height: bottom - top,
    startTotalMins: startTotalMins,
    endTotalMins: endTotalMins
  }

  // Display time range in modal
  const timeDisplay = formatTimeRange(startTotalMins, endTotalMins)
  const timeRangeEl = document.getElementById('timeRangeDisplay')
  if (timeRangeEl) {
    timeRangeEl.textContent = timeDisplay
  }

  // Open the modal
  const modalElement = document.getElementById('eventModal')
  if (!modalElement) {
    console.error('Modal element not found!')
    return
  }

  console.log('Modal element found, attempting to show')

  if (typeof bootstrap !== 'undefined') {
    console.log('Bootstrap available, using Modal API')
    try {
      const modal = new bootstrap.Modal(modalElement)
      modal.show()
    } catch (e) {
      console.error('Bootstrap modal error:', e)
      showModalFallback(modalElement)
    }
  } else {
    console.log('Bootstrap not available, using fallback')
    showModalFallback(modalElement)
  }
}

function formatTimeRange (startMins, endMins) {
  const toTimeStr = totalMins => {
    const h = Math.floor(totalMins / 60)
    const m = totalMins % 60
    const period = h >= 12 ? 'PM' : 'AM'
    const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h
    return `${displayH}:${m.toString().padStart(2, '0')} ${period}`
  }
  return `${toTimeStr(startMins)} - ${toTimeStr(endMins)}`
}

function showModalFallback (modalElement) {
  modalElement.style.display = 'block'
  modalElement.classList.add('show')
  document.body.classList.add('modal-open')
  document.body.style.overflow = 'hidden'
  console.log('Modal shown with fallback')
}

function closeEventModal () {
  const modalElement = document.getElementById('eventModal')
  if (modalElement) {
    if (typeof bootstrap !== 'undefined') {
      try {
        const modal = bootstrap.Modal.getInstance(modalElement)
        if (modal) modal.hide()
      } catch (e) {
        hideModalFallback(modalElement)
      }
    } else {
      hideModalFallback(modalElement)
    }
  }
  pendingBlockData = null
}

function hideModalFallback (modalElement) {
  modalElement.style.display = 'none'
  modalElement.classList.remove('show')
  document.body.classList.remove('modal-open')
  document.body.style.overflow = 'auto'
}

function confirmEventDetails () {
  if (!pendingBlockData) return

  const eventName = document.getElementById('modalEventName').value || 'Event'
  const location = document.getElementById('modalLocation').value || 'Any'

  renderBlockOnGrid({
    dayIndex: pendingBlockData.dayIndex,
    top: pendingBlockData.top,
    height: pendingBlockData.height,
    roleIds: [],
    building: location,
    color: '#4a90e2',
    startTime: pendingBlockData.startTotalMins,
    endTime: pendingBlockData.endTotalMins,
    eventName: eventName
  })

  // Close modal and reset
  closeEventModal()
  document.getElementById('modalEventName').value = ''
  document.getElementById('modalLocation').value = ''
}

async function saveAll () {
  const blocks = document.querySelectorAll('.pref-block')
  const checkedRoles = document.querySelectorAll('.role-checkbox:checked')

  const payload = {
    ranges: Array.from(blocks).map(block => ({
      day: DAYS[Math.round(parseFloat(block.style.left) / (100 / 7))],
      start: pixelsToTime(parseInt(block.style.top)),
      end: pixelsToTime(
        parseInt(block.style.top) + parseInt(block.style.height)
      ),
      building: block.dataset.building
    })),
    role_ids: Array.from(checkedRoles).map(cb => cb.value)
  }
}

function renderBlockOnGrid (data) {
  const layer = document.getElementById('blocks-layer')
  const block = document.createElement('div')
  block.className = 'pref-block'

  block.dataset.roleIds = JSON.stringify(data.roleIds)
  block.dataset.building = data.building
  block.dataset.startTime = data.startTime
  block.dataset.endTime = data.endTime
  block.dataset.eventName = data.eventName || ''

  block.style.top = data.top + 'px'
  block.style.height = data.height + 'px'
  block.style.left = data.dayIndex * (100 / 7) + '%'
  block.style.width = 100 / 7 + '%'
  block.style.backgroundColor = data.color

  block.innerHTML = `
        <button class="delete-btn" onclick="this.parentElement.remove()">×</button>
        <div style="padding: 2px;">
            <div class="fw-bold" style="font-size: 10px;">${
              data.eventName || 'Event'
            }</div>
            <div style="font-size: 9px;">${data.building}</div>
            <div style="font-size: 8px; color: #333;">${formatTimeRange(
              data.startTime,
              data.endTime
            )}</div>
        </div>
    `
  layer.appendChild(block)
}

/**
 * Collects all blocks and POSTs them to Django
 */
document
  .getElementById('saveAllBtn')
  .addEventListener('click', saveAllPreferences)

async function saveAllPreferences () {
  const blocks = document.querySelectorAll('.pref-block')
  const checkedRoles = document.querySelectorAll('.role-checkbox:checked')

  // Helper function to convert minutes to 24-hour HH:MM format for Django
  const toTimeStr24 = totalMins => {
    const h = Math.floor(totalMins / 60)
    const m = totalMins % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
  }

  // 1. Prepare the Data Payload
  const payload = {
    role_ids: Array.from(checkedRoles).map(cb => cb.value),
    ranges: Array.from(blocks).map(block => {
      // Get Day Index from left percentage (e.g., "14.28%")
      const leftPercent = parseFloat(block.style.left)
      const dayIdx = Math.round(leftPercent / (100 / 7))

      // Use stored time data instead of recalculating from pixels!
      const startTotalMins = block.dataset.startTime
      const endTotalMins = block.dataset.endTime
      console.log('Block data for payload:', {
        day: DAYS[dayIdx],
        startTotalMins,
        endTotalMins,
        building: block.dataset.building,
        eventName: block.dataset.eventName || ''
      })

      return {
        day: DAYS[dayIdx],
        start: toTimeStr24(startTotalMins), // Changed to 24-hour format
        end: toTimeStr24(endTotalMins), // Changed to 24-hour format
        building: block.dataset.building,
        eventName: block.dataset.eventName || '',
        location: block.dataset.building
      }
    })
  }

  // 2. Send to Django
  try {
    const response = await fetch(
      `/api/team/${window.TEAM_ID}/save-availability/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify(payload)
      }
    )

    if (response.ok) {
      alert('All preferences saved successfully!')
    } else {
      const errorData = await response.json()
      alert('Error: ' + errorData.message)
    }
  } catch (err) {
    console.error('Save failed:', err)
    alert('Server error. Check console.')
  }
}

// Helper to get CSRF token from cookies
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

function styleModalElements () {
  // Style input fields with black border
  const inputs = document.querySelectorAll('#modalEventName, #modalLocation')
  inputs.forEach(input => {
    input.style.borderColor = '#000'
    input.style.borderWidth = '2px'
  })

  // Style modal content with blue border and white background
  const modalContent = document.querySelector('#eventModal .modal-content')
  if (modalContent) {
    modalContent.style.borderColor = '#0066cc'
    modalContent.style.borderWidth = '3px'
    modalContent.style.backgroundColor = '#ffffff'
  }
}
