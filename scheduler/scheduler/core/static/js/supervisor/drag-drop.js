// DRAG & DROP

let isDrawing = false
let currentBlock = null
let startY = 0

// Creates a room-block DOM element with a time label and delete button
function createBlock (day, top, height) {
  const block = document.createElement('div')
  block.className = 'room-block'
  block.style.top = `${top}px`
  block.style.height = `${height}px`
  block.dataset.day = day

  const timeSpan = document.createElement('span')
  timeSpan.className = 'time-range-text'
  timeSpan.innerHTML = `${formatTime(top)}<br>${formatTime(top + height)}`
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

// Attaches mousedown/mousemove/mouseup listeners for drawing new blocks on the grid
function setupDrawListeners () {
  const cols = document.querySelectorAll('#schedulerGrid .day-col')

  cols.forEach(col => {
    const dayIndex = col.dataset.day

    col.addEventListener('mousedown', e => {
      if (e.target.closest('.delete-btn') || e.target.classList.contains('room-block')) return

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

      currentBlock.style.top = `${finalTop}px`
      currentBlock.style.height = `${finalHeight}px`

      const timeText = currentBlock.querySelector('.time-range-text')
      if (timeText) {
        timeText.innerHTML = `${formatTime(finalTop)}<br>${formatTime(finalTop + finalHeight)}`
      }
    })
  })

  document.addEventListener('mouseup', () => {
    isDrawing = false
    currentBlock = null
  })
}