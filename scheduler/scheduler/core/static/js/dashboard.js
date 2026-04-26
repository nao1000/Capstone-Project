const csrfToken = document
  .querySelector('meta[name="csrf-token"]')
  .getAttribute('content')

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

async function deleteTeam (icon, teamId) {
  const choice = prompt(
    `Are you sure you want to delete this team?\nDeleting this team will permanently delete all information associated with the team.\nPlease type in DELETE if you wish to proceed.`
  )
  if (choice === 'DELETE') {
    try {
      const response = await fetch(`/api/team/${teamId}/delete/`, {
        method: 'DELETE',
        headers: { 'X-CSRFToken': csrfToken }
      })

      if (response.ok) {
        const block = icon.closest(".team-div")
        block.remove()
      } else {
        alert('Failed to delete team.')
      }
    } catch (error) {
      console.error(error)
      alert('An error occurred.')
    }
  }
}
