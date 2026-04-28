/** @file Initialization and setup logic for the main scheduling grid view. */
/** @module Scheduler */

/**
 * The CSRF token extracted from the page's meta tag.
 * Used to securely authenticate state-changing API requests to the server.
 * * @type {string|null}
 */
const csrfToken = document
  .querySelector('meta[name="csrf-token"]')
  .getAttribute('content')

/**
 * Initializes the core application logic once the DOM is fully parsed.
 *
 * @description
 * 1. Bootstraps UI components: Time labels, drag listeners, filters, and fetches initial schedule data.
 * 2. Synchronizes horizontal scrolling between the main grid content and the fixed top header.
 * 3. Binds a double-click event to the grid body that captures specific shift data attributes and opens the edit modal.
 * 4. Checks `sessionStorage` for a queued worker ID to immediately load a specific individual's schedule upon navigation;
 * otherwise, it defaults to loading the master team view.
 *
 * @listens document#DOMContentLoaded
 * @async
 */
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

      // Set these BEFORE openModal so it can read them
      window.pendingShift = {
        id: block.dataset.shiftId,
        user_id: block.dataset.workerId,
        role_id: block.dataset.roleId,
        room_id: block.dataset.roomId
      }

      openModal(window.pendingShift)
    }
  })

  // --- Default view on page load ---
  const workerId = sessionStorage.getItem('loadWorkerId')
  const workerName = sessionStorage.getItem('loadWorkerName')
  if (workerId) {
    sessionStorage.removeItem('loadWorkerId')
    sessionStorage.removeItem('loadWorkerName')
    const element = document.querySelector(
      `.worker-item[data-worker-id="${workerId}"]`
    )
    loadWorker(workerId, window.TEAM_ID, workerName, element)
  } else {
    loadMasterView() // default when arriving normally
  }
})