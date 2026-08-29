const warnings = {};

function addWarning(user) {
  warnings[user] = (warnings[user] || 0) + 1;
  return warnings[user];
}

function resetWarnings(user) {
  delete warnings[user];
}

module.exports = {
  addWarning,
  resetWarnings
};
