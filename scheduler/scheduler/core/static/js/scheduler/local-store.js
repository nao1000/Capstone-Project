// local memory of events prior to database save
/** @module Scheduler */

/**
 * An in-memory store for managing shift data before it is persisted to the backend database.
 * This acts as a client-side cache to retain unsaved changes (like newly drawn shifts) 
 * while the user navigates between different views (e.g., switching role filters).
 *
 * @namespace
 * @property {Object.<string, Object>} shifts - A dictionary storing shift objects, indexed by a composite string key (`${roleId}-${day}-${start_min}`).
 */
const localSchedule = {
  shifts: {},

  /**
   * Replaces all currently stored local shifts for a specific role with a new array of shifts.
   * Useful when taking a snapshot of the entire grid for a role before switching views.
   *
   * @param {string|number} roleId - The ID of the role whose shifts are being bulk-saved.
   * @param {Array<Object>} shifts - An array of shift objects to save for this role.
   */
  save (roleId, shifts) {
    Object.keys(this.shifts).forEach(key => {
      if (key.startsWith(`${roleId}-`)) delete this.shifts[key]
    })
    shifts.forEach(s => {
      const key = `${roleId}-${s.day}-${s.start_min}`
      this.shifts[key] = s
    })
  },

  /**
   * Saves or updates a single shift in the local store. 
   * Generates a composite key based on the shift's role, day, and start time.
   *
   * @param {Object} shift - The shift object to save.
   * @param {string|number} shift.role_id - The ID of the role assigned to the shift.
   * @param {string} shift.day - The day of the week (e.g., 'mon', 'tue').
   * @param {number} shift.start_min - The start time of the shift in total minutes.
   */
  saveOne(shift) {
    const key = `${shift.role_id}-${shift.day}-${shift.start_min}`
    this.shifts[key] = shift
  },

  /**
   * Retrieves all unsaved local shifts assigned to a specific worker.
   *
   * @param {string|number} workerId - The unique ID of the worker.
   * @param {string|number} [roleId] - (Unused) The ID of the role.
   * @returns {Array<Object>} An array of shift objects belonging to the specified worker.
   */
  getForWorker(workerId, roleId) {
    console.log(workerId)
    return Object.values(this.shifts).filter(s => s.user_id == workerId)
  },

  /**
   * Retrieves all unsaved local shifts associated with a specific role.
   *
   * @param {string|number} roleId - The unique ID of the role to filter by.
   * @returns {Array<Object>} An array of shift objects for the specified role.
   */
  getForRole (roleId) {
    return Object.values(this.shifts).filter(s => s.role_id === roleId)
  },

  /**
   * Retrieves all unsaved shifts currently held in local memory.
   *
   * @returns {Array<Object>} A flat array of all local shift objects.
   */
  getAll () {
    return Object.values(this.shifts)
  },

  /**
   * Clears shifts from the local store. 
   * If a roleId is provided, it selectively clears only the shifts for that role. 
   * Otherwise, it clears the entire local schedule memory.
   *
   * @param {string|number|null} [roleId=null] - The ID of the role to clear, or null to clear everything.
   */
  clear (roleId = null) {
    if (roleId) {
      Object.keys(this.shifts).forEach(key => {
        if (key.startsWith(`${roleId}-`)) delete this.shifts[key]
      })
    } else {
      this.shifts = {}
    }
  }
}