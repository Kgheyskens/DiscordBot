function getRequiredXp(level) {
	return 100 + (level * 75);
}

module.exports = {
	getRequiredXp,
};