const csrfToken = document
  .querySelector('meta[name="csrf-token"]')
  .getAttribute('content')

document.addEventListener('DOMContentLoaded', () => {
  drawTimeLabels('mainTimeCol')
  setupDragListeners()
  initFilters()
  initSchedules()

  const scrollArea = document.getElementById('mainScrollArea')
  const header = document.getElementById('mainGridHeader')
  if (scrollArea && header) {
    scrollArea.addEventListener('scroll', () => {
      header.scrollLeft = scrollArea.scrollLeft
    })
  }

  const mainGrid = document.getElementById('mainGrid')
  mainGrid.addEventListener('dblclick', e => {
    const block = e.target.closest('.shift-block')
    if (block && !block.classList.contains('temp')) {
      activeEvent = block
      activeCol = block.parentElement
      openModal()
      document.getElementById('modalWorkerSelect').value = block.dataset.workerId
      document.getElementById('modalRoleSelect').value = block.dataset.roleId
      document.getElementById('modalRoomSelect').value = block.dataset.roomId
    }
  })
})
