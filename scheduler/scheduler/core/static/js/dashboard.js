function copyFullCode (fullUuid, btn) {
  const icon = btn.querySelector('i')

  const showSuccess = () => {
    icon.className = 'fa-solid fa-check'
    icon.style.color = '#22c55e'
    setTimeout(() => {
      icon.className = 'fa-regular fa-copy'
      icon.style.color = ''
    }, 2000)
  }

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(fullUuid).then(showSuccess)
  } else {
    const textarea = document.createElement('textarea')
    textarea.value = fullUuid
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    showSuccess()
  }
}