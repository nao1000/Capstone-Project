// GRID MODE

function setGridMode (mode) {
  currentGridMode = mode
  document.getElementById('btnBusy').classList.toggle('active', mode === 'busy')
  document.getElementById('btnPreferred').classList.toggle('active', mode === 'preferred')

  const hint = document.getElementById('toolbarHint')
  if (hint) {
    hint.textContent =
      mode === 'preferred'
        ? 'Drag to mark times you want to work • Click × to remove'
        : 'Click & Drag to add • Double-click to Edit • Ctrl+C/V to Copy/Paste'
  }
}

// Instantly finalize a "preferred" block without a modal
function finalizePreferredEvent () {
  if (!activeEvent) return

  const topPx = parseFloat(activeEvent.style.top)
  const heightPx = parseFloat(activeEvent.style.height)
  const startSlotIndex = Math.round(topPx / window.SLOT_HEIGHT)
  const slotsCount = Math.round(heightPx / window.SLOT_HEIGHT)
  const startMin = startSlotIndex * 15 + window.START_HOUR * 60
  const endMin = startMin + slotsCount * 15
  const timeString = `${formatMin(startMin)} - ${formatMin(endMin)}`

  activeEvent.classList.remove('temp')
  activeEvent.innerHTML = `
    <div class="delete-x" onclick="removeEventBlock(event, this)">×</div>
    <div class="event-content">
      <div class="event-title">Preferred</div>
      <div class="event-time">${timeString}</div>
    </div>`

  activeEvent = null
}

function clearLocalGrid () {
  if (!confirm('Clear all shifts from the grid?')) return
  document.querySelectorAll('.event-block:not(.temp)').forEach(el => el.remove())
}