// INIT
// Bootstraps all modules once the DOM is ready.
/** @module Availability */

/**
 * Main initialization block. Attaches an event listener to the `DOMContentLoaded` event
 * to bootstrap all core modules of the application once the HTML is fully parsed.
 * This includes setting up the dynamic layout, attaching drag/selection/keyboard listeners,
 * restoring user preferences, and populating the grid with saved event data.
 *
 * @listens document#DOMContentLoaded
 */
document.addEventListener('DOMContentLoaded', () => {
  // Layout
  initLayout()
  window.addEventListener('resize', initLayout)

  // Grid interactions
  setupDragListeners()

  // Selection & keyboard
  setupSelectionListeners()
  setupDoubleClickEdit()
  setupKeyboardShortcuts()
  restoreSavedRolePreferences()

  // Restore saved events from server
  addSavedEventsToGrid()
})