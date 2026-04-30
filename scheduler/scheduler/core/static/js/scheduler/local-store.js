// local memory of events prior to database save
/** @module Scheduler */

/**
 * An in-memory store for managing shift data before it is persisted to the backend database.
 * This acts as a client-side cache to retain unsaved changes (like newly drawn shifts)
 * while the user navigates between different views (e.g., switching role filters).
 *
 * @namespace
 * @property {Object.<string, Object>} shifts - A dictionary storing shift objects, indexed by a composite string key (`${roleId}-${day}-${start_min}-${user_id}`).
 */
const localSchedule = {
  shifts: {},

  /**
   * Replaces all currently stored local shifts for a specific role with a new array of shifts.
   *
   * @param {string|number} roleId - The ID of the role whose shifts are being bulk-saved.
   * @param {Array<Object>} shifts - An array of shift objects to save for this role.
   */
  save (roleId, shifts) {
    Object.keys(this.shifts).forEach(key => {
      if (key.startsWith(`${roleId}-`)) delete this.shifts[key]
    })
    shifts.forEach(s => {
      // FIX: Added user_id to the key so shifts don't overwrite each other
      const key = `${roleId}-${s.day}-${s.start_min}-${s.user_id}`
      this.shifts[key] = s
    })
  },

  /**
   * Saves or updates a single shift in the local store.
   *
   * @param {Object} shift - The shift object to save.
   */
  saveOne (shift) {
    // FIX: Added user_id to the key
    const key = `${shift.role_id}-${shift.day}-${shift.start_min}-${shift.user_id}`
    this.shifts[key] = shift
  },

  /**
   * Retrieves all unsaved local shifts assigned to a specific worker.
   *
   * @param {string|number} workerId - The unique ID of the worker.
   * @param {string|number} [roleId] - (Unused) The ID of the role.
   * @returns {Array<Object>} An array of shift objects belonging to the specified worker.
   */
  getForWorker (workerId, roleId) {
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
  },

  /**
   * Removes a single shift from the local store by reconstructing its composite key.
   * Attempts an exact key match first, then falls back to a loose scan to handle
   * string/number type mismatches between dataset attributes and stored values.
   *
   * @param {Object} shift - An object identifying the shift to remove.
   * @param {string|number} shift.role_id - The role ID of the shift.
   * @param {string} shift.day - The day key (e.g. `'mon'`).
   * @param {number} shift.start_min - The start time in minutes from midnight.
   * @param {string|number} shift.user_id - The worker's user ID.
   */
  removeOne (shift) {
    const key = `${shift.role_id}-${shift.day}-${shift.start_min}-${shift.user_id}`
    if (key in this.shifts) {
      delete this.shifts[key]
      return
    }
    // Fallback: loose scan in case of type mismatch (dataset gives strings, store may have ints)
    const match = Object.keys(this.shifts).find(k => {
      const [rId, day, startMin, uId] = k.split('-')
      return (
        rId == shift.role_id &&
        day === shift.day &&
        startMin == shift.start_min &&
        uId == shift.user_id
      )
    })
    if (match) delete this.shifts[match]
  }
}
