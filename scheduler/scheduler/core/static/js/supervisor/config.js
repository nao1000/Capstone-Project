// CONFIG

const START_HOUR = 8        // 8 AM
const END_HOUR = 19         // 7 PM
const HOURS_TOTAL = END_HOUR - START_HOUR

const SLOT_HEIGHT = 10      // 10px = 15 mins
const PIXELS_PER_HOUR = 40  // 40px = 1 hour

const csrfToken = document
  .querySelector('meta[name="csrf-token"]')
  .getAttribute('content')

// Pull room data from hidden HTML elements rendered by Django
const roomElements = document.querySelectorAll('.room-info')
let roomData = Array.from(roomElements).map(el => ({
  id: el.dataset.id,
  name: el.dataset.name,
  schedule: [] // { day: 0, top: 0, height: 60 }
}))