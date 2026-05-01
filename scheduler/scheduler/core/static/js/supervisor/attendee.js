/** @file Handles the logic for accepting external scheduling information */
/** @module Supervisor */

/**
 * Fetches a unique response link for the current team from the backend API 
 * and copies it directly to the user's system clipboard. Provides temporary 
 * UI feedback (disabling the button and showing success/error messages) 
 * during and after the operation.
 *
 * @async
 * @returns {Promise<void>} Resolves when the link has been successfully fetched and copied, or when the operation fails and error handling completes.
 */
async function copyResponseLink () {
  const btn = document.getElementById('copyLinkBtn')
  const status = document.getElementById('copyLinkStatus')

  btn.disabled = true
  btn.textContent = 'Getting link...'

  try {
    const res = await fetch(`/api/team/${window.TEAM_ID}/response-link/`)
    const data = await res.json()

    await navigator.clipboard.writeText(data.url)
    status.textContent = '✓ Link copied!'
    setTimeout(() => { status.textContent = '' }, 3000)
  } catch (err) {
    status.textContent = 'Failed to copy. Check console.'
    console.error(err)
  } finally {
    btn.disabled = false
    btn.textContent = 'Copy Student Link'
  }
}

// Keep a local slot height for the heatmap so the color blocks are tall enough to see clearly
const HEATMAP_SLOT_HEIGHT = 16
const HEATMAP_TOTAL_SLOTS = HOURS_TOTAL * 4 // Uses HOURS_TOTAL from config.js

// Cache the data so we only hit the server once per session
let cachedDensityData = null
let maxDensityMap = {}

/**
 * Opens the heatmap modal by applying the 'show' CSS class.
 * Clears any previously active role selections and resets the grid to its default state.
 */
function openHeatmapModal () {
  const modal = document.getElementById('heatmapModal')
  if (!modal) return

  modal.classList.add('show')

  // Clear any active role selection
  document.querySelectorAll('#heatmapRoleList .room-list-item').forEach(item => item.classList.remove('active'))
  document.getElementById('selectedRoleTitle').textContent = 'Select a Role'

  const gridContainer = document.getElementById('heatmapGridContainer')
  if (gridContainer) {
    gridContainer.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:center; min-height:400px; color:#6b7280;">
        <i class="fa-solid fa-arrow-left"></i>&nbsp; Select a role to view the density heatmap
      </div>`
  }
}

/**
 * Closes the heatmap modal by removing the 'show' CSS class.
 */
function closeHeatmapModal () {
  const modal = document.getElementById('heatmapModal')
  if (modal) modal.classList.remove('show')
}

/**
 * Handles the selection of a role from the heatmap sidebar list.
 * Highlights the active item, updates the title, and triggers the heatmap render.
 *
 * @param {string} roleId - The unique identifier of the selected role.
 * @param {string} roleName - The display name of the selected role.
 * @param {HTMLElement} element - The clicked sidebar DOM element.
 */
function selectHeatmapRole (roleId, roleName, element) {
  document.querySelectorAll('#heatmapRoleList .room-list-item').forEach(item => item.classList.remove('active'))
  element.classList.add('active')

  document.getElementById('selectedRoleTitle').textContent = `Viewing: ${roleName}`
  renderPreferenceHeatmap(roleId)
}

async function renderPreferenceHeatmap (roleId) {
  const gridContainer = document.getElementById('heatmapGridContainer')
  
  if (!roleId) {
    gridContainer.innerHTML = `
      <div style="margin: auto; color: #6b7280;">
          <i class="fa-solid fa-arrow-up"></i> Select a role above to view the density heatmap
      </div>`
    return
  }
  
  gridContainer.innerHTML = '<div style="margin: auto; color: #6b7280;">Loading preferences...</div>'

  if (!cachedDensityData) {
    try {
      const response = await fetch(`/api/team/${window.TEAM_ID}/preference-density/`)
      if (!response.ok) throw new Error('Failed to fetch density data')
      
      const data = await response.json()
      cachedDensityData = data.density_data
      maxDensityMap = data.max_density
    } catch (error) {
      console.error('Error fetching preference density:', error)
      gridContainer.innerHTML = '<div style="margin: auto; color: #d9534f;">Failed to load data. Check console.</div>'
      return
    }
  }

  buildHeatmapUI(roleId, gridContainer)
}

/**
 * Constructs the DOM elements for the heatmap grid based on cached density data.
 *
 * @param {string} roleId - The unique identifier of the role being rendered.
 * @param {HTMLElement} grid - The DOM element container where the grid will be drawn.
 */
/**
 * Constructs the DOM elements for the heatmap grid based on cached density data.
 * Mimics the table-like CSS structure of the room availability scheduler.
 *
 * @param {string} roleId - The unique identifier of the role being rendered.
 * @param {HTMLElement} grid - The DOM element container where the grid will be drawn.
 */
function buildHeatmapUI (roleId, grid) {
  // Clean up the container's default placeholder styles so our new grid fits perfectly
  grid.innerHTML = '' 
  grid.style.padding = '0'
  grid.style.border = 'none'
  grid.style.background = 'transparent'
  grid.style.display = 'block'
  
  const roleData = cachedDensityData[roleId] || {}
  const maxDensity = maxDensityMap[roleId] || 1 
  const totalSlots = HOURS_TOTAL * 4

  // Outer Wrapper (Handles the main border and rounded corners)
  const gridWrapper = document.createElement('div')
  gridWrapper.style.cssText = 'width: 100%; border: 1px solid #e5e7eb; border-radius: 6px; display: flex; flex-direction: column; overflow: hidden; background: white;'
  
  // 1. HEADER ROW (Grey background, day labels)
  const headerRow = document.createElement('div')
  headerRow.style.cssText = 'display: flex; background-color: #f3f4f6; border-bottom: 1px solid #e5e7eb;'
  
  const cornerSpacer = document.createElement('div')
  cornerSpacer.style.cssText = 'width: 60px; flex-shrink: 0;' // Matches the time column width
  headerRow.appendChild(cornerSpacer)

  DAY_LABELS.forEach(day => {
    const th = document.createElement('div')
    th.style.cssText = 'flex: 1; text-align: center; font-weight: 600; font-size: 13px; padding: 12px 0; border-left: 1px solid #e5e7eb; color: #374151;'
    th.textContent = day
    headerRow.appendChild(th)
  })
  gridWrapper.appendChild(headerRow)

  // 2. BODY AREA (Scrollable if necessary, but uses config.js 10px slots to fit)
  const bodyArea = document.createElement('div')
  bodyArea.style.cssText = 'display: flex; position: relative; overflow-y: auto; max-height: 55vh;'

  // 2a. Time Column (Left side labels)
  const timeCol = document.createElement('div')
  timeCol.style.cssText = 'width: 60px; flex-shrink: 0; background: #f9fafb; position: relative;'
  
  // Add labels every 30 minutes (every 2 slots)
  for (let i = 0; i <= totalSlots; i += 2) { 
    const timeLabel = document.createElement('div')
    timeLabel.style.cssText = `position: absolute; top: ${i * SLOT_HEIGHT}px; right: 8px; transform: translateY(-50%); font-size: 10px; color: #6b7280;`
    timeLabel.textContent = formatHeatmapMin((START_HOUR * 60) + (i * 15))
    timeCol.appendChild(timeLabel)
  }
  bodyArea.appendChild(timeCol)

  // 2b. Day Columns (The actual grid)
  DAY_KEYS.forEach((dayKey) => {
    const col = document.createElement('div')
    col.style.cssText = `flex: 1; border-left: 1px solid #e5e7eb; position: relative; height: ${totalSlots * SLOT_HEIGHT}px; display: flex; flex-direction: column;`

    const dayData = roleData[dayKey] || {}

    for (let i = 0; i < totalSlots; i++) {
      const slot = document.createElement('div')
      
      // Alternate row borders: Darker line on the 30-min mark, lighter line on the 15-min mark
      const borderBottomColor = i % 2 === 1 ? '#e5e7eb' : '#f3f4f6'
      slot.style.cssText = `height: ${SLOT_HEIGHT}px; box-sizing: border-box; border-bottom: 1px solid ${borderBottomColor};`

      const count = dayData[i] || 0
      if (count > 0) {
        const intensity = 0.2 + (0.8 * (count / maxDensity))
        slot.style.backgroundColor = `rgba(99, 102, 241, ${intensity})` 
        slot.title = `${count} attendee(s) prefer this time`
        
        // Add an inner border to highlight max density without changing the slot's physical height
        if (count === maxDensity && maxDensity > 1) {
          slot.style.boxShadow = 'inset 0 0 0 1px rgba(0,0,0,0.3)'
          slot.style.zIndex = '1'
        }
      } else {
        slot.title = '0 attendees'
      }

      col.appendChild(slot)
    }
    bodyArea.appendChild(col)
  })

  gridWrapper.appendChild(bodyArea)
  grid.appendChild(gridWrapper)
}

/**
 * Formats a total minute value into a readable time string.
 * Updated to output capital AM/PM to match the room scheduler UI.
 *
 * @param {number} min - The time represented in total minutes since midnight.
 * @returns {string} The formatted 12-hour time string (e.g., "8:00AM").
 */
function formatHeatmapMin (min) {
  const h = Math.floor(min / 60)
  const m = min % 60
  const ampm = h >= 12 ? 'PM' : 'AM'
  const displayH = h > 12 ? h - 12 : h || 12
  return `${displayH}:${String(m).padStart(2, '0')}${ampm}`
}