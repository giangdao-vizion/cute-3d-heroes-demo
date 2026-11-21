/** Navigate back to the home lobby without breaking iOS Home Screen standalone. */
export const CLOSE_SURVIVOR_MSG = 'cute-heroes-close-survivor';

export function goLobby(event) {
  if (event) event.preventDefault();
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: CLOSE_SURVIVOR_MSG }, location.origin);
      return;
    }
  } catch (_) {
    /* cross-origin parent — fall through */
  }
  location.href = 'index.html';
}

export function bindLobbyLinks(root = document) {
  root.querySelectorAll(`a[href="index.html"]`).forEach((link) => {
    link.addEventListener('click', goLobby);
  });
}
