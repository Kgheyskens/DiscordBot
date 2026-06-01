const fs = require('fs');
const path = require('path');

// MongoDB-backed JSON store met dezelfde sync interface als vroeger.
// Onder de motorkap: in-memory cache + lazy async writes naar MongoDB.
//
// Hoe het werkt:
// - Eerste readJson(path) leest uit MongoDB (of seed vanuit bestaand JSON-bestand
//   als de DB nog leeg is). Het resultaat wordt in-memory gecached.
// - Alle volgende readJson(path) calls geven het cached object terug — sync, snel.
// - writeJson(path, data) update de cache meteen en queue't een async write
//   naar MongoDB op de achtergrond.
//
// Fallback: als MONGODB_URI niet gezet is, valt alles terug op de oude
// file-based opslag (zoals het origineel werkte).

const USE_MONGO = !!process.env.MONGODB_URI;

let MongoClient;
let mongoClient = null;
let mongoDb = null;
let mongoReady = null;

const cache = new Map();           // collectionName -> data object
const dirty = new Set();           // collectionName(s) met pending write
let flushTimer = null;

function collectionNameFromPath(filePath) {
	return path.basename(filePath, path.extname(filePath));
}

async function ensureMongo() {
	if (!USE_MONGO) return null;
	if (mongoReady) return mongoReady;

	mongoReady = (async () => {
		try {
			MongoClient = require('mongodb').MongoClient;
		} catch (err) {
			console.error('[jsonStore] mongodb package niet geïnstalleerd — fallback naar file storage.');
			return null;
		}

		try {
			mongoClient = new MongoClient(process.env.MONGODB_URI, {
				serverSelectionTimeoutMS: 10000,
			});
			await mongoClient.connect();
			const dbName = mongoClient.options.dbName || 'discordbot';
			mongoDb = mongoClient.db(dbName);
			console.log(`[jsonStore] Verbonden met MongoDB (database: ${dbName})`);
			return mongoDb;
		} catch (err) {
			console.error('[jsonStore] MongoDB connectie mislukt — fallback naar file storage:', err.message);
			mongoClient = null;
			mongoDb = null;
			return null;
		}
	})();

	return mongoReady;
}

function readFileSync(filePath, fallbackValue) {
	if (!fs.existsSync(filePath)) {
		return fallbackValue;
	}
	try {
		return JSON.parse(fs.readFileSync(filePath, 'utf8'));
	} catch {
		return fallbackValue;
	}
}

function writeFileSyncSafe(filePath, data) {
	try {
		fs.mkdirSync(path.dirname(filePath), { recursive: true });
		fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
	} catch (err) {
		console.error(`[jsonStore] writeFile fallback failed for ${filePath}:`, err.message);
	}
}

function ensureJsonFile(filePath, fallbackValue = {}) {
	if (fs.existsSync(filePath)) return;
	try {
		fs.mkdirSync(path.dirname(filePath), { recursive: true });
		fs.writeFileSync(filePath, JSON.stringify(fallbackValue, null, 2));
	} catch (err) {
		// negeer — als Mongo werkt hebben we dit bestand niet nodig
	}
}

// Sync hydrate: bij de allereerste read voor een collection moeten we
// blocking wachten op MongoDB. Dat doen we via een synchronous wait die
// een file-fallback gebruikt indien Mongo niet reageert.
//
// Maar `readJson` moet sync zijn (de hele codebase gebruikt het zo). We lossen
// dit op door een "preload" stap te doen via initStore() voordat de bot start.

const SEEDED = new Set();

async function hydrateCollection(filePath, fallbackValue) {
	const colName = collectionNameFromPath(filePath);
	if (cache.has(colName)) return cache.get(colName);

	const db = await ensureMongo();
	if (!db) {
		// Fallback: lees van disk
		const data = readFileSync(filePath, fallbackValue);
		cache.set(colName, data);
		return data;
	}

	const col = db.collection(colName);
	const doc = await col.findOne({ _id: 'data' }).catch(() => null);

	if (doc && doc.payload !== undefined) {
		cache.set(colName, doc.payload);
		return doc.payload;
	}

	// Niets in Mongo voor deze collection — seed vanuit bestaand bestand als dat bestaat
	if (fs.existsSync(filePath) && !SEEDED.has(colName)) {
		const fileData = readFileSync(filePath, fallbackValue);
		await col.updateOne(
			{ _id: 'data' },
			{ $set: { payload: fileData, updatedAt: new Date() } },
			{ upsert: true },
		).catch(err => console.error(`[jsonStore] Seed naar Mongo mislukt voor ${colName}:`, err.message));
		SEEDED.add(colName);
		cache.set(colName, fileData);
		console.log(`[jsonStore] Gemigreerd: ${colName} (${JSON.stringify(fileData).length} bytes) van disk naar MongoDB.`);
		return fileData;
	}

	cache.set(colName, fallbackValue);
	return fallbackValue;
}

async function initStore() {
	if (!USE_MONGO) return;
	await ensureMongo();
}

// Pre-hydrate alle JSON-bestanden in een directory (zodat sync reads daarna werken)
async function preloadDirectory(dataDir) {
	if (!USE_MONGO) return;
	await ensureMongo();
	if (!mongoDb) return;

	try {
		// 1) Hydrate vanuit alle al bestaande Mongo collections
		const collections = await mongoDb.listCollections().toArray().catch(() => []);
		for (const c of collections) {
			const colName = c.name;
			if (cache.has(colName)) continue;
			const doc = await mongoDb.collection(colName).findOne({ _id: 'data' }).catch(() => null);
			if (doc && doc.payload !== undefined) {
				cache.set(colName, doc.payload);
			}
		}

		// 2) Seed vanuit bestaande JSON-bestanden die nog niet in Mongo staan
		if (fs.existsSync(dataDir)) {
			const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
			for (const file of files) {
				const colName = path.basename(file, '.json');
				if (cache.has(colName)) continue; // al uit Mongo geladen
				const filePath = path.join(dataDir, file);
				const fileData = readFileSync(filePath, {});
				await mongoDb.collection(colName).updateOne(
					{ _id: 'data' },
					{ $set: { payload: fileData, updatedAt: new Date() } },
					{ upsert: true },
				).catch(err => console.error(`[jsonStore] Seed mislukt voor ${colName}:`, err.message));
				cache.set(colName, fileData);
				SEEDED.add(colName);
				console.log(`[jsonStore] Initieel gemigreerd: ${file} → Mongo collection "${colName}"`);
			}
		}
	} catch (err) {
		console.error('[jsonStore] preloadDirectory failed:', err.message);
	}
}

function readJson(filePath, fallbackValue = {}) {
	const colName = collectionNameFromPath(filePath);

	if (cache.has(colName)) {
		return cache.get(colName);
	}

	if (!USE_MONGO || !mongoDb) {
		// File-fallback (Mongo niet beschikbaar of nog niet verbonden bij eerste read)
		ensureJsonFile(filePath, fallbackValue);
		const data = readFileSync(filePath, fallbackValue);
		cache.set(colName, data);
		return data;
	}

	// Mongo is verbonden maar deze collection is nog niet in de cache.
	// We seed'en hier sync vanuit het bestand (als dat bestaat) en triggeren
	// een achtergrond-hydrate uit Mongo. In de praktijk wordt preloadDirectory()
	// bij startup aangeroepen, dus deze tak wordt zelden gebruikt.
	const seedData = readFileSync(filePath, fallbackValue);
	cache.set(colName, seedData);
	hydrateCollection(filePath, fallbackValue).then(actual => {
		if (actual !== undefined) cache.set(colName, actual);
	}).catch(() => null);
	return seedData;
}

function scheduleFlush() {
	if (flushTimer) return;
	flushTimer = setTimeout(() => {
		flushTimer = null;
		flushDirty().catch(err => console.error('[jsonStore] flushDirty failed:', err.message));
	}, 250);
}

async function flushDirty() {
	if (!USE_MONGO) return;
	const db = await ensureMongo();
	if (!db) return;

	const toFlush = Array.from(dirty);
	dirty.clear();
	for (const colName of toFlush) {
		const payload = cache.get(colName);
		try {
			await db.collection(colName).updateOne(
				{ _id: 'data' },
				{ $set: { payload, updatedAt: new Date() } },
				{ upsert: true },
			);
		} catch (err) {
			console.error(`[jsonStore] Mongo write mislukt voor ${colName}:`, err.message);
			dirty.add(colName); // probeer later opnieuw
		}
	}
}

function writeJson(filePath, data) {
	const colName = collectionNameFromPath(filePath);
	cache.set(colName, data);

	if (USE_MONGO) {
		dirty.add(colName);
		scheduleFlush();
	} else {
		writeFileSyncSafe(filePath, data);
	}
}

// Graceful shutdown — flush pending writes
async function close() {
	if (flushTimer) {
		clearTimeout(flushTimer);
		flushTimer = null;
	}
	await flushDirty().catch(() => null);
	if (mongoClient) {
		await mongoClient.close().catch(() => null);
	}
}

process.on('SIGINT', () => { close().finally(() => process.exit(0)); });
process.on('SIGTERM', () => { close().finally(() => process.exit(0)); });

module.exports = {
	ensureJsonFile,
	readJson,
	writeJson,
	initStore,
	preloadDirectory,
	flushDirty,
	close,
};
