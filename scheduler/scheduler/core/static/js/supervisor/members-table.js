// MEMBERS TABLE

document.addEventListener('DOMContentLoaded', () => {
  const tableBody = document.querySelector('.table-card tbody')
  if (!tableBody) return

  // --- Sortable Column Headers ---
  const tableHeaders = document.querySelectorAll('.table-card th')
  let sortDirections = Array.from(tableHeaders).map(() => false)

  tableHeaders.forEach((header, index) => {
    header.style.cursor = 'pointer'

    header.addEventListener('click', () => {
      const rows = Array.from(tableBody.querySelectorAll('tr'))
      const isDescending = sortDirections[index]
      sortDirections[index] = !isDescending

      // Reset all sort icons, then set the clicked column's icon
      tableHeaders.forEach(th => {
        const icon = th.querySelector('i')
        if (icon) icon.className = 'fa-solid fa-sort'
      })
      const clickedIcon = header.querySelector('i')
      if (clickedIcon) {
        clickedIcon.className = isDescending ? 'fa-solid fa-sort-down' : 'fa-solid fa-sort-up'
      }

      // Extract cell values once before sorting for performance
      const mappedRows = rows.map(row => {
        const cell = row.querySelectorAll('td')[index]
        let combinedText = ''

        if (cell) {
          const selects = cell.querySelectorAll('select')
          if (selects.length > 0) {
            selects.forEach(select => {
              if (select.selectedIndex >= 0 && select.value !== '') {
                combinedText += select.options[select.selectedIndex].text + ' '
              }
            })
          } else {
            combinedText = cell.textContent
          }
        }

        return {
          htmlRow: row,
          value: combinedText.trim().toLowerCase()
        }
      })

      mappedRows.sort((a, b) => {
        if (a.value < b.value) return isDescending ? 1 : -1
        if (a.value > b.value) return isDescending ? -1 : 1
        return 0
      })

      // Re-render rows using a DocumentFragment to minimize reflows
      const fragment = document.createDocumentFragment()
      mappedRows.forEach(item => fragment.appendChild(item.htmlRow))
      tableBody.appendChild(fragment)
    })
  })

  // --- Search Bar ---
  const searchInput = document.getElementById('memberSearchInput')
  if (searchInput) {
    searchInput.addEventListener('input', function () {
      const searchTerm = this.value.toLowerCase()
      tableBody.querySelectorAll('tr').forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(searchTerm) ? '' : 'none'
      })
    })
  }
})