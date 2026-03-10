function toggleForms () {
  const loginBox = document.querySelector('.login-card')
  const signupBox = document.querySelector('.signup-card')

  if (loginBox.classList.contains('hidden')) {
    loginBox.classList.remove('hidden')
    signupBox.classList.add('hidden')
  } else {
    loginBox.classList.add('hidden')
    signupBox.classList.remove('hidden')
  }
}
