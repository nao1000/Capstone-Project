function copyFullCode (fullUuid, btn) {
  navigator.clipboard.writeText(fullUuid).then(() => {
    const icon = btn.querySelector('i')

    // Visual Feedback
    icon.className = 'fa-solid fa-check'
    icon.style.color = '#22c55e'

    setTimeout(() => {
      icon.className = 'fa-regular fa-copy'
      icon.style.color = ''
    }, 2000)
  })
}
