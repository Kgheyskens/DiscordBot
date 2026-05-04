const WORDLE_WORDS = [
	// NL
	'aarde','akker','angst','appel','arena','avond','baard','baken','balie','basis',
	'beeld','beest','beker','beurs','bezem','bezig','bijna','blauw','bleek','blind',
	'bloem','bocht','boord','borst','breed','brein','brief','broek','broer','brood',
	'bruin','buurt','datum','derde','deugd','draad','draak','drank','droom','engel',
	'feest','fiets','fluit','fonds','fraai','galop','garde','geest','geluk','glans',
	'goden','goten','graan','graaf','groen','groep','haard','hagel','hemel','hoofd',
	'jacht','jaren','kaart','kabel','kader','kalfs','kamer','kanon','kasse','kasje',
	'kerel','kerst','klauw','kleur','klink','klomp','knoop','koers','koord','krans',
	'kroon','kruid','kunst','leger','lente','lepel','licht','lucht','maand','magie',
	'menig','modal','naald','nacht','noord','noten','oever','olijf','onder','paard',
	'paars','parel','pasta','pizza','plant','plein','regen','reuze','roest','snoep',
	'speer','spons','spook','stand','steen','stier','stoel','storm','taart','tafel',
	'toren','tover','troon','vlees','vlieg','vlies','vloer','vogel','vorst','vrede',
	'vrouw','wagen','wapen','water','weide','zomer','zwart',

	// EN (common + harder)
	'abide','about','above','abuse','actor','acute','adapt','admit','adopt','adore',
	'adult','after','again','agent','agile','agree','ahead','alarm','album','alert',
	'alike','alive','allow','alone','along','alter','amber','amend','angel','anger',
	'angle','angry','apart','apple','apply','arena','argue','arise','array','arrow',
	'aside','asset','audio','audit','avoid','award','aware','awful',
	'badge','badly','baker','basic','basis','beach','began','begin','begun','being',
	'below','bench','bible','birth','black','blame','blind','block','blood','board',
	'boost','booth','bound','brain','brand','bread','break','breed','brief','bring',
	'broad','broke','brown','build','built','buyer',
	'cable','calif','carry','catch','cause','chain','chair','chart','chase','cheap',
	'check','chest','chief','child','china','chose','civil','claim','class','clean',
	'clear','clerk','click','clock','close','coach','coast','could','count','court',
	'cover','craft','crash','cream','crime','cross','crowd','crown','curve','cycle',
	'daily','dance','dated','dealt','death','debut','delay','depth','doing','doubt',
	'dozen','draft','drama','drawn','dream','dress','drill','drink','drive','drove',
	'dutch','dying',
	'eager','early','earth','eight','elite','empty','enemy','enjoy','enter','entry',
	'equal','error','event','every','exact','exist','extra',
	'faith','false','fault','fiber','field','fifth','fifty','fight','final','first',
	'fixed','flash','fleet','floor','fluid','focus','force','forth','forty','forum',
	'found','frame','frank','fraud','fresh','front','fruit','fully','funny',
	'giant','given','glass','globe','going','grace','grade','grand','grant','grass',
	'great','green','gross','group','grown',
	'guard','guess','guest','guide',
	'habit','happy','harsh','heart','heavy','hence','horse','hotel','house','human',
	'humor','ideal','image','imply','index','inner','input','issue',
	'joint','judge','known','label','large','laser','later','laugh','layer','learn',
	'lease','least','leave','legal','level','light','limit','local','logic','loose',
	'lucky','lunch',
	'magic','major','maker','march','match','maybe','mayor','meant','media','metal',
	'might','minor','model','money','month','moral','motor','mount','mouse','mouth',
	'movie','music',
	'needs','never','newly','night','noise','north','noted','novel','nurse',
	'ocean','offer','often','order','other','ought','outer','owner',
	'panel','paper','party','peace','phase','phone','photo','piece','pilot','pitch',
	'place','plain','plane','plant','plate','point','pound','power','press','price',
	'pride','prime','print','prior','prize','proof','proud','prove',
	'queen','quick','quiet','quite','quote',
	'radio','raise','range','rapid','ratio','reach','react','ready','refer','right',
	'rival','river','round','route','royal','rural',
	'scale','scene','scope','score','sense','serve','seven','shall','shape','share',
	'sharp','sheet','shelf','shell','shift','shirt','shock','shoot','short','shown',
	'sight','since','sixth','sixty','skill','sleep','slide','small','smart','smile',
	'smoke','solid','solve','sorry','sound','south','space','spare','speak','speed',
	'spend','spent','split','spoke','sport','staff','stage','stake','stand','start',
	'state','steam','steel','stick','still','stock','stone','stood','store','storm',
	'story','strip','stuck','study','stuff','style','sugar','suite','super','sweet',
	'table','taken','taste','teach','teeth','terry','thank','their','theme','there',
	'these','thick','thing','think','third','those','three','threw','throw','tight',
	'times','tired','title','today','topic','total','touch','tough','tower','track',
	'trade','train','treat','trend','trial','tried','tries','truck','truly','trust',
	'truth','twice',
	'under','union','unity','until','upper','upset','urban','usage','usual',
	'value','video','visit','vital','voice','voter',
	'waste','watch','water','wheel','where','which','while','white','whole','whose',
	'woman','women','world','worry','worse','worst','worth','would','write','wrong',
	'yield','young','youth','zebra'
];

const HANGMAN_WORDS = [
	'auto','fiets','kasteel','olifant','computer','koekje','kroontje','voetbal',
	'wereld','hoofdstad','vlaanderen','nederland','gitaar','piano','zonnebril',
	'paraplu','sleutel','bibliotheek','school','rugzak','handschoen','vlinder',
	'avontuur','speelplaats','restaurant','museum','theater','bioscoop','station',
	'luchthaven','kantoor','fabriek','ziekenhuis','apotheek','bakkerij','slager',
	'kapper','bloemist','detective','piraat','astronaut','kunstenaar','schrijver',
	'dichter','fotograaf','tekenaar','koffie','thee','chocolade','aardbei',
	'banaan','sinaasappel','citroen','druiven','kers','peer','mango','ananas',
	'kiwi','tomaat','komkommer','wortel','aardappel','spinazie','broccoli',
	'pizza','pasta','lasagne','soep','salade','pannenkoek','wafel','taart',
	'cupcake','donut','ijsje','pudding','snoep','tafel','stoel','kast','bed',
	'lamp','vaas','klok','spiegel','tapijt','gordijn','bank','zetel','kussen',

	// extra (kort + normaal)
	'regen','zomer','winter','herfst','lente','storm','donder','bliksem',
	'strand','duinen','bos','berg','rivier','meer','eiland',
	'vriend','familie','leraar','student','dokter','verpleegster',
	'agent','brandweer','piloot','chauffeur',

	// langere woorden (leuk voor moeilijkheid)
	'verjaardag','schoolreisje','kinderfeestje','pretpark','speelgoedwinkel',
	'zwembad','bibliothecaris','wetenschapper','programmeur','ingenieur',
	'verkeerslicht','treinstation','vliegveldterminal','supermarkt',
	'boodschappenlijst','afstandsbediening','televisiescherm',
	'koelkastdeur','wasmachine','vaatwasser','stofzuiger',
	'computerspel','spelcomputer','internetverbinding','wachtwoord',
	'gebruikersnaam','toetsenbord','beeldscherm','koptelefoon',

	// moeilijkere / samengestelde woorden
	'arbeidsongeschikt','zorgverzekering','belastingdienst',
	'klimaatverandering','duurzaamheid','milieubescherming',
	'energieleverancier','waterzuivering','luchtvervuiling',
	'voedingsmiddelen','gezondheidszorg','onderwijsniveau',
	'samenwerking','verantwoordelijkheid','zelfvertrouwen',
	'doorzettingsvermogen','tijdschriftartikel','krantenkop',
	'nieuwsbericht','weersvoorspelling','temperatuurverschil'
];

function buildSet(words, opts = {}) {
	const out = new Set();
	for (const w of words) {
		const cleaned = String(w).toLowerCase().replace(/[^a-z]/g, '');
		if (!cleaned) continue;
		if (opts.length && cleaned.length !== opts.length) continue;
		out.add(cleaned);
	}
	return out;
}

const fs = require('fs');
const path = require('path');

const WORDLE_SET = buildSet(WORDLE_WORDS, { length: 5 });
const HANGMAN_SET = buildSet(HANGMAN_WORDS);

const WORDLE_DICTIONARY = new Set(WORDLE_SET);

function loadDictionaryFile(filePath, length) {
	try {
		const raw = fs.readFileSync(filePath, 'utf8');
		const lines = raw.split(/\r?\n/);
		for (const line of lines) {
			const cleaned = String(line || '').toLowerCase().replace(/[^a-z]/g, '');
			if (!cleaned) continue;
			if (length && cleaned.length !== length) continue;
			WORDLE_DICTIONARY.add(cleaned);
		}
	} catch (err) {
		console.warn(`[wordList] Could not load dictionary ${filePath}:`, err.message);
	}
}

loadDictionaryFile(path.join(__dirname, '..', 'data', 'wordlist5_nl.txt'), 5);

async function isValidWordleWordOnline(word) {
	const cleaned = String(word || '').toLowerCase().replace(/[^a-z]/g, '');
	if (cleaned.length !== 5) return false;
	if (typeof fetch !== 'function') return false;

	const TIMEOUT_MS = 1500;
	const tryFetch = async url => {
		try {
			const res = await fetch(url, {
				method: 'HEAD',
				signal: AbortSignal.timeout?.(TIMEOUT_MS),
			});
			return res.ok;
		} catch {
			return false;
		}
	};

	const urls = [
		`https://en.wiktionary.org/wiki/${encodeURIComponent(cleaned)}`,
		`https://nl.wiktionary.org/wiki/${encodeURIComponent(cleaned)}`,
	];

	return new Promise(resolve => {
		let pending = urls.length;
		let resolved = false;
		for (const url of urls) {
			tryFetch(url).then(ok => {
				if (resolved) return;
				if (ok) {
					resolved = true;
					resolve(true);
					return;
				}
				pending -= 1;
				if (pending === 0) resolve(false);
			});
		}
	});
}

function isValidWord(game, word) {
	const cleaned = String(word || '').toLowerCase().replace(/[^a-z]/g, '');
	if (!cleaned) return false;
	if (game === 'wordle') return WORDLE_DICTIONARY.has(cleaned);
	if (game === 'hangman') return HANGMAN_SET.has(cleaned);
	return true;
}

function addWordleDictionaryWord(word) {
	const cleaned = String(word || '').toLowerCase().replace(/[^a-z]/g, '');
	if (cleaned.length !== 5) return false;
	WORDLE_DICTIONARY.add(cleaned);
	return true;
}

function getWordleWords() {
	return [...WORDLE_SET];
}

function getHangmanWords() {
	return [...HANGMAN_SET];
}

module.exports = {
	isValidWord,
	isValidWordleWordOnline,
	addWordleDictionaryWord,
	getWordleWords,
	getHangmanWords,
};
