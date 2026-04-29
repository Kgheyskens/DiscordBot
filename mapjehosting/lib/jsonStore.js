const fs = require('fs');
const path = require('path');

function ensureJsonFile(filePath, fallbackValue = {}) {
	if (fs.existsSync(filePath)) {
		return;
	}

	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, JSON.stringify(fallbackValue, null, 2));
}

function readJson(filePath, fallbackValue = {}) {
	ensureJsonFile(filePath, fallbackValue);

	try {
		return JSON.parse(fs.readFileSync(filePath, 'utf8'));
	} catch {
		return fallbackValue;
	}
}

function writeJson(filePath, data) {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

module.exports = {
	ensureJsonFile,
	readJson,
	writeJson,
};