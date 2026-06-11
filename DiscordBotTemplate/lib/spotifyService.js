const axios = require('axios');

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

let cachedToken = null;
let tokenExpiresAt = 0;

function isConfigured() {
	return Boolean(CLIENT_ID && CLIENT_SECRET);
}

async function getAccessToken() {
	if (cachedToken && Date.now() < tokenExpiresAt - 10_000) {
		return cachedToken;
	}
	if (!isConfigured()) {
		throw new Error('Spotify is niet geconfigureerd (SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET ontbreken).');
	}

	const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
	const response = await axios.post(
		'https://accounts.spotify.com/api/token',
		'grant_type=client_credentials',
		{
			headers: {
				Authorization: `Basic ${basic}`,
				'Content-Type': 'application/x-www-form-urlencoded',
			},
		},
	);

	cachedToken = response.data.access_token;
	tokenExpiresAt = Date.now() + (response.data.expires_in || 3600) * 1000;
	return cachedToken;
}

// Geeft { type, id } terug, of null als het geen herkende Spotify-URL is.
function parseSpotifyUrl(url) {
	if (typeof url !== 'string') return null;
	const match = url.match(/(?:open\.spotify\.com\/(?:intl-[a-z]{2}\/)?|spotify:)(track|playlist|album)[/:]([a-zA-Z0-9]+)/);
	if (!match) return null;
	return { type: match[1], id: match[2] };
}

function isSpotifyUrl(url) {
	return parseSpotifyUrl(url) !== null;
}

function buildSearchQuery(title, artists) {
	const artistPart = Array.isArray(artists) ? artists.filter(Boolean).join(' ') : (artists || '');
	return `${title} ${artistPart}`.trim();
}

function mapTrack(track) {
	if (!track || !track.name) return null;
	const artists = (track.artists || []).map(a => a.name);
	return {
		title: track.name,
		artist: artists.join(', '),
		searchQuery: buildSearchQuery(track.name, artists),
	};
}

async function fetchTrack(id, token) {
	const { data } = await axios.get(`https://api.spotify.com/v1/tracks/${id}`, {
		headers: { Authorization: `Bearer ${token}` },
	});
	const mapped = mapTrack(data);
	return mapped ? [mapped] : [];
}

async function fetchPlaylist(id, token) {
	const results = [];
	let url = `https://api.spotify.com/v1/playlists/${id}/tracks?limit=100`;
	while (url) {
		const { data } = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
		for (const item of data.items || []) {
			const mapped = mapTrack(item.track);
			if (mapped) results.push(mapped);
		}
		url = data.next;
	}
	return results;
}

async function fetchAlbum(id, token) {
	const results = [];
	let url = `https://api.spotify.com/v1/albums/${id}/tracks?limit=50`;
	while (url) {
		const { data } = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
		for (const track of data.items || []) {
			const mapped = mapTrack(track);
			if (mapped) results.push(mapped);
		}
		url = data.next;
	}
	return results;
}

// Hoofdfunctie: geeft een lijst { title, artist, searchQuery } voor een Spotify track/playlist/album-URL.
async function getTracks(url) {
	const parsed = parseSpotifyUrl(url);
	if (!parsed) {
		throw new Error('Geen geldige Spotify-link.');
	}
	const token = await getAccessToken();
	if (parsed.type === 'track') return fetchTrack(parsed.id, token);
	if (parsed.type === 'playlist') return fetchPlaylist(parsed.id, token);
	if (parsed.type === 'album') return fetchAlbum(parsed.id, token);
	return [];
}

module.exports = {
	isConfigured,
	isSpotifyUrl,
	parseSpotifyUrl,
	getTracks,
};
