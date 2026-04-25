// local memory of events prior to database save

const localSchedule = {
  shifts: {},

  save (roleId, shifts) {
    Object.keys(this.shifts).forEach(key => {
      if (key.startsWith(`${roleId}-`)) delete this.shifts[key]
    })
    shifts.forEach(s => {
      const key = `${roleId}-${s.day}-${s.start_min}`
      this.shifts[key] = s
    })
  },


  getForRole (roleId) {
    return Object.values(this.shifts).filter(s => s.role_id === roleId)
  },

  getAll () {
    return Object.values(this.shifts)
  },

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
