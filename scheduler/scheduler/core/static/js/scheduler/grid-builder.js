const totalHeight = (END_HOUR - START_HOUR) * 4 * SLOT_HEIGHT

function buildSingleWorkerGrid (workerName) {
  const header = document.getElementById('mainGridHeader')
  const grid = document.getElementById('mainGrid')

  header.innerHTML =
    '<div class="header-cell time-header" style="width:60px;">Time</div>'
  grid.innerHTML = ''
  grid.className = 'single-worker'

  const timeCol = document.createElement('div')
  timeCol.className = 'time-col'
  timeCol.id = 'mainTimeCol'
  timeCol.style.cssText = `width:60px; flex-shrink:0; height:${totalHeight}px;`
  grid.appendChild(timeCol)
  drawTimeLabels('mainTimeCol')

  DAY_NAMES.forEach((day, i) => {
    const headerCell = document.createElement('div')
    headerCell.className = 'header-cell'
    headerCell.style.cssText = 'width:120px; flex-shrink:0; position:relative;'
    headerCell.textContent = day
    header.appendChild(headerCell)

    const col = document.createElement('div')
    col.className = 'day-col'
    col.dataset.day = i
    col.style.cssText = 'width:120px; flex-shrink:0;'
    grid.appendChild(col)
  })
  document.getElementById('mainGrid').style.height = `${totalHeight}px`
}

function buildRoleGrid (workers) {
  const header = document.getElementById('mainGridHeader')
  const grid = document.getElementById('mainGrid')
  const colWidth = 120

  header.innerHTML =
    '<div class="header-cell time-header" style="width:60px;">Time</div>'
  grid.innerHTML = ''
  grid.className = ''

  const timeCol = document.createElement('div')
  timeCol.className = 'time-col'
  timeCol.id = 'mainTimeCol'
  timeCol.style.cssText = `width:60px; flex-shrink:0; height:${totalHeight}px;`
  grid.appendChild(timeCol)
  drawTimeLabels('mainTimeCol')

  // const sortedWorkers = [...workers].sort((a, b) => {
  //   const sectionA = a.section || ''
  //   const sectionB = b.section || ''
  //   if (sectionA !== sectionB) return sectionA.localeCompare(sectionB)
  //   return a.name.localeCompare(b.name)
  // })
  let sortedWorkers = workers
  DAY_NAMES.forEach((dayName, dayIndex) => {
    const groupWidth = workers.length * colWidth

    const headerGroup = document.createElement('div')
    headerGroup.style.cssText = `display:flex; flex-direction:column; border-right:2px solid #c0c0c0; flex-shrink:0; width:${groupWidth}px;`

    const dayLabel = document.createElement('div')
    dayLabel.style.cssText =
      'text-align:center; font-weight:700; font-size:13px; text-transform:uppercase; color:#555; border-bottom:1px solid #e0e0e0; padding:4px 0; width:100%;'
    dayLabel.textContent = dayName

    const workerLabels = document.createElement('div')
    workerLabels.style.display = 'flex'

    sortedWorkers.forEach(w => {
      const wLabel = document.createElement('div')
      wLabel.style.cssText = `width:${colWidth}px; flex-shrink:0; font-size:10px; font-weight:600; text-align:center; color:#777; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; border-right:1px solid #e0e0e0; padding:2px 4px 5px;`
      wLabel.textContent = w.section ? `${w.name} (${w.section})` : w.name
      workerLabels.appendChild(wLabel)
    })

    headerGroup.appendChild(dayLabel)
    headerGroup.appendChild(workerLabels)
    header.appendChild(headerGroup)

    sortedWorkers.forEach(w => {
      const workerCol = document.createElement('div')
      workerCol.className = 'worker-sub-col day-col'
      workerCol.dataset.day = dayIndex
      workerCol.dataset.workerId = w.id
      workerCol.style.cssText = `width:${colWidth}px; flex-shrink:0; position:relative; border-right:1px solid #e0e0e0;`
      grid.appendChild(workerCol)
    })

    const separator = document.createElement('div')
    separator.style.cssText = 'width:2px; flex-shrink:0; background:#c0c0c0;'
    grid.appendChild(separator)
  })
  document.getElementById('mainGrid').style.height = `${totalHeight}px`
}

function drawTimeLabels (containerId) {
  const timeCol = document.getElementById(containerId)
  timeCol.innerHTML = ''
  const totalHours = END_HOUR - START_HOUR

  for (let h = START_HOUR; h <= END_HOUR; h++) {
    if (h === END_HOUR) continue

    const label = document.createElement('div')
    label.className = 'time-label'

    const suffix = h >= 12 ? 'PM' : 'AM'
    const displayH = h > 12 ? h - 12 : h === 0 || h === 12 ? 12 : h
    label.textContent = `${displayH} ${suffix}`

    const percentTop = ((h - START_HOUR) / totalHours) * 100
    label.style.top = `${percentTop}%`
    timeCol.appendChild(label)
  }
}
