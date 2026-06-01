// One-shot migratie: merge alle collections van "test" database in "discordbot".
//
// Hoe het werkt:
// - Voor elke collection in `test` met document _id="data":
//     pak payload.
// - Lees hetzelfde document uit `discordbot`.
// - Merge: per top-level key (meestal guildId) → behoud beide.
//   Als dezelfde guildId in beide voorkomt, merge één laag dieper (per userId).
//   Bij conflict op userId-niveau: behoud de waarde uit `discordbot` (= de
//   nieuwere store) tenzij `test` strikt hogere xp/balance heeft (dan winnen
//   die). Voor andere data-types: discordbot wint.
// - Schrijf terug naar `discordbot`.
//
// Daarna laat het script de test database staan — verwijder die HANDMATIG in
// Atlas zodra je gecontroleerd hebt dat alles klopt.

require('dotenv').config();
const { MongoClient } = require('mongodb');

function isPlainObject(v) {
	return v && typeof v === 'object' && !Array.isArray(v);
}

// Diepe merge voor nested guildId → userId → fields structuur.
// Strategie:
// - Beide objecten? recursief mergen.
// - Conflict op leaf: bewaar HOOGSTE numerieke waarde voor 'xp', 'level',
//   'balance', 'crowns', 'coins'. Anders: discordbot-waarde behouden.
function smartMerge(targetVal, testVal, keyHint = '') {
	if (testVal === undefined || testVal === null) return targetVal;
	if (targetVal === undefined || targetVal === null) return testVal;

	if (isPlainObject(targetVal) && isPlainObject(testVal)) {
		const out = { ...targetVal };
		for (const k of Object.keys(testVal)) {
			out[k] = smartMerge(targetVal[k], testVal[k], k);
		}
		return out;
	}

	// Beide primitieven / arrays
	const numericKeys = new Set(['xp', 'level', 'balance', 'crowns', 'coins', 'wins', 'amount']);
	if (numericKeys.has(keyHint) && typeof targetVal === 'number' && typeof testVal === 'number') {
		return Math.max(targetVal, testVal);
	}

	// Voor 'lastMessageAt', 'updatedAt' etc: behoud de meest recente
	if (typeof targetVal === 'number' && typeof testVal === 'number' && /At$|Timestamp/i.test(keyHint)) {
		return Math.max(targetVal, testVal);
	}

	// Arrays: pak de langste (heuristiek — beter dan willekeurig overschrijven)
	if (Array.isArray(targetVal) && Array.isArray(testVal)) {
		return testVal.length > targetVal.length ? testVal : targetVal;
	}

	return targetVal; // default: discordbot wint
}

(async () => {
	const uri = process.env.MONGODB_URI;
	if (!uri) {
		console.error('❌ MONGODB_URI ontbreekt in .env');
		process.exit(1);
	}

	const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
	await client.connect();
	console.log('✅ Verbonden met MongoDB cluster.');

	const testDb = client.db('test');
	const targetDb = client.db('discordbot');

	const testCollections = await testDb.listCollections().toArray();
	console.log(`\nGevonden ${testCollections.length} collections in "test":`);
	console.log(testCollections.map(c => c.name).join(', '));

	let mergedCount = 0;
	let skippedCount = 0;

	for (const c of testCollections) {
		const colName = c.name;
		const testDoc = await testDb.collection(colName).findOne({ _id: 'data' });

		if (!testDoc || testDoc.payload === undefined) {
			console.log(`⏭️  ${colName}: geen _id=data document — overslaan`);
			skippedCount++;
			continue;
		}

		const targetDoc = await targetDb.collection(colName).findOne({ _id: 'data' });
		const targetPayload = targetDoc?.payload ?? {};
		const merged = smartMerge(targetPayload, testDoc.payload);

		const beforeKeys = Object.keys(targetPayload).length;
		const afterKeys = Object.keys(merged).length;
		const testKeys = Object.keys(testDoc.payload).length;

		await targetDb.collection(colName).updateOne(
			{ _id: 'data' },
			{ $set: { payload: merged, updatedAt: new Date() } },
			{ upsert: true },
		);

		console.log(`✅ ${colName}: target had ${beforeKeys} key(s), test had ${testKeys}, na merge ${afterKeys}`);
		mergedCount++;
	}

	console.log(`\n📊 Samenvatting: ${mergedCount} collections gemergd, ${skippedCount} overgeslagen.`);
	console.log('\n⚠️  De "test" database is NOG NIET verwijderd.');
	console.log('   Controleer eerst in Atlas of de "discordbot" data klopt,');
	console.log('   en drop de "test" database daarna handmatig.');

	await client.close();
})().catch(err => {
	console.error('❌ Migratie mislukt:', err);
	process.exit(1);
});
