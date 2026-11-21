/** Navigate back to the home lobby. */
export function goLobby(event) {
  if (event) event.preventDefault();
  location.href = 'index.html';
}

export function bindLobbyLinks(root = document) {
  root.querySelectorAll(`a[href="index.html"]`).forEach((link) => {
    link.addEventListener('click', goLobby);
  });
}
