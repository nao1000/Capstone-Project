// INIT
// Bootstraps all modules once the DOM is ready.

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