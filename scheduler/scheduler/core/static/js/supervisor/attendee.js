/** @file Handles the logic for accepting external scheduling information */
/** @module Supervisor */

/**
 * Fetches a unique response link for the current team from the backend API 
 * and copies it directly to the user's system clipboard. Provides temporary 
 * UI feedback (disabling the button and showing success/error messages) 
 * during and after the operation.
 *
 * @async
 * @returns {Promise<void>} Resolves when the link has been successfully fetched and copied, or when the operation fails and error handling completes.
 */
async function copyResponseLink () {
  const btn = document.getElementById('copyLinkBtn')
  const status = document.getElementById('copyLinkStatus')

  btn.disabled = true
  btn.textContent = 'Getting link...'

  try {
    const res = await fetch(`/api/team/${window.TEAM_ID}/response-link/`)
    const data = await res.json()

    await navigator.clipboard.writeText(data.url)
    status.textContent = '✓ Link copied!'
    setTimeout(() => { status.textContent = '' }, 3000)
  } catch (err) {
    status.textContent = 'Failed to copy. Check console.'
    console.error(err)
  } finally {
    btn.disabled = false
    btn.textContent = 'Copy Student Link'
  }
}