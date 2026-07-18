const statusElement = document.getElementById('status');
const statusDot = document.querySelector('.status-dot');
const toggleButton = document.getElementById('toggle-button');
const messageElement = document.getElementById('message');
const mouseMoverApi = window.mouseMover;

function renderState({ enabled }) {
  statusElement.textContent = enabled ? 'Movement enabled' : 'Movement disabled';
  toggleButton.textContent = enabled ? 'Disable movement' : 'Enable movement';
  statusDot.classList.toggle('is-active', enabled);
}

function showMessage({ message }) {
  messageElement.textContent = message;
}

async function initialize() {
  mouseMoverApi.onStateChanged(renderState);
  mouseMoverApi.onHotkeyError(showMessage);
  mouseMoverApi.onMovementError(showMessage);
  const hotkeyStatus = await mouseMoverApi.getHotkeyStatus();
  if (!hotkeyStatus.registered) {
    showMessage({ message: hotkeyStatus.message });
  }
  renderState({ enabled: await mouseMoverApi.getState() });
}

toggleButton.addEventListener('click', async () => {
  renderState({ enabled: await mouseMoverApi.toggle() });
});

initialize().catch(error => {
  showMessage({ message: `Interface error: ${error.message}` });
});
