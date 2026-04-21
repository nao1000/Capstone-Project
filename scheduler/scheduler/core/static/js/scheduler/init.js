const csrfToken = document
  .querySelector('meta[name="csrf-token"]')
  .getAttribute('content')

document.addEventListener('DOMContentLoaded', async () => {
  drawTimeLabels('mainTimeCol')
  setupDragListeners()
  initFilters()
  await initSchedules()

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

  // --- Default view on page load ---
  const workerId = sessionStorage.getItem('loadWorkerId')
  const workerName = sessionStorage.getItem('loadWorkerName')
  if (workerId) {
    sessionStorage.removeItem('loadWorkerId')
    sessionStorage.removeItem('loadWorkerName')
    const element = document.querySelector(`.worker-item[data-worker-id="${workerId}"]`)
    loadWorker(workerId, window.TEAM_ID, workerName, element)
  } else {
    loadMasterView()  // default when arriving normally
  }
})