function toggleForms() {
  const loginBox = document.querySelector('.login-card');
  const signupBox = document.querySelector('.signup-card');

  // classList.toggle is a cleaner way to flip the hidden state
  loginBox.classList.toggle('hidden');
  signupBox.classList.toggle('hidden');
}