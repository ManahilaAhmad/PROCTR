function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = "flex";
}

function hideModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = "none";
}

function updateElementText(elementId, text) {
  const elem = document.getElementById(elementId);
  if (elem) elem.innerText = text;
}

module.exports = {
  showModal,
  hideModal,
  updateElementText
};
