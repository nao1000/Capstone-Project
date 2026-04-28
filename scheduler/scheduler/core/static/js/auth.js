/** @file Handles UI transitions between the login and signup forms. */

/**
 * Toggles the visibility between the login and signup forms.
 */
function toggleForms() {
  const loginBox = document.querySelector('.login-card');
  const signupBox = document.querySelector('.signup-card');

  // Swap visibility states back and forth
  loginBox.classList.toggle('hidden');
  signupBox.classList.toggle('hidden');
}