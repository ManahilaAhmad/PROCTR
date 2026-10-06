function formatTime(dateString) {
  if (!dateString) return new Date().toLocaleTimeString();
  return new Date(dateString).toLocaleTimeString();
}

function truncateText(text, maxLength = 60) {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

module.exports = {
  formatTime,
  truncateText
};
