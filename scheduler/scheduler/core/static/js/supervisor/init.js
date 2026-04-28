/** @file Handles the logic to intialize supervisor page */
/** @module Supervisor */

/**
 * Main initialization block for the admin/dashboard interface.
 * Executes once the DOM is fully parsed and ready. 
 * Responsible for bootstrapping the room scheduler layout, binding interaction listeners 
 * to dynamic UI elements (like the room selector and user profile menu), populating 
 * form dropdowns, and asynchronously pre-loading section data for members with existing roles.
 *
 * @listens document#DOMContentLoaded
 */
document.addEventListener('DOMContentLoaded', () => {
  // Room scheduler grid
  setupRoomGrid()
  setupDrawListeners()

  // Room dropdown change → reload saved availability
  document.getElementById('roomSelect')?.addEventListener('change', loadSavedTimes)

  // Profile dropdown toggle
  const profileContainer = document.querySelector('.user-profile-container')
  if (profileContainer) {
    profileContainer.addEventListener('click', event => {
      event.stopPropagation()
      profileContainer.classList.toggle('active')
    })

    document.addEventListener('click', event => {
      if (!profileContainer.contains(event.target)) {
        profileContainer.classList.remove('active')
      }
    })
  }

  // Populate fixed-event time dropdowns
  populateTimeDropdowns()

  // Pre-load section dropdowns for any members that already have a role assigned
  document.querySelectorAll('.member-role-select').forEach(async select => {
    const roleId = select.value
    const userId = select.dataset.userId
    if (!roleId) return

    const sectionSelect = document.querySelector(`.member-section-select[data-user-id="${userId}"]`)
    await loadSectionsIntoDropdown(roleId, sectionSelect)

    const currentSectionId =
      select.closest('tr')?.querySelector('.member-section-select')?.dataset.currentSectionId
    if (currentSectionId) {
      sectionSelect.value = currentSectionId
    }
  })
})