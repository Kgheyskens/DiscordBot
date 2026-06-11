const {
	joinVoiceChannel,
	createAudioPlayer,
	createAudioResource,
	entersState,
	AudioPlayerStatus,
	VoiceConnectionStatus,
	NoSubscriberBehavior,
} = require('@discordjs/voice');
const play = require('play-dl');
const spotifyService = require('./spotifyService');

const IDLE_TIMEOUT_MS = 5 * 60_000;
const MAX_QUEUE = 1000;

// guildId -> state
const states = new Map();

function getState(guildId) {
	return states.get(guildId) || null;
}

function ensureState(guildId) {
	let state = states.get(guildId);
	if (!state) {
		state = {
			guildId,
			connection: null,
			player: null,
			queue: [],
			nowPlaying: null,
			loopMode: 'off', // 'off' | 'track' | 'queue'
			textChannelId: null,
			voiceChannelId: null,
			leaveTimer: null,
			destroyed: false,
		};
		states.set(guildId, state);
	}
	return state;
}

function clearLeaveTimer(state) {
	if (state.leaveTimer) {
		clearTimeout(state.leaveTimer);
		state.leaveTimer = null;
	}
}

function scheduleLeave(state) {
	clearLeaveTimer(state);
	state.leaveTimer = setTimeout(() => {
		destroy(state.guildId);
	}, IDLE_TIMEOUT_MS);
}

function isConnected(guildId) {
	const state = states.get(guildId);
	return Boolean(state && state.connection && !state.destroyed);
}

async function joinChannel(voiceChannel, textChannel) {
	const guildId = voiceChannel.guild.id;
	const state = ensureState(guildId);

	if (state.connection && state.voiceChannelId === voiceChannel.id) {
		return state;
	}

	const connection = joinVoiceChannel({
		channelId: voiceChannel.id,
		guildId,
		adapterCreator: voiceChannel.guild.voiceAdapterCreator,
		selfDeaf: true,
	});

	const player = createAudioPlayer({
		behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
	});

	connection.subscribe(player);

	state.connection = connection;
	state.player = player;
	state.voiceChannelId = voiceChannel.id;
	state.textChannelId = textChannel?.id || state.textChannelId;
	state.destroyed = false;

	player.on(AudioPlayerStatus.Idle, () => {
		handleTrackEnd(guildId).catch(err => console.error('handleTrackEnd failed:', err));
	});

	player.on('error', error => {
		console.error(`Audio player error in guild ${guildId}:`, error.message);
		handleTrackEnd(guildId).catch(err => console.error('handleTrackEnd after error failed:', err));
	});

	connection.on(VoiceConnectionStatus.Disconnected, async () => {
		try {
			await Promise.race([
				entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
				entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
			]);
		} catch {
			destroy(guildId);
		}
	});

	try {
		await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
	} catch (err) {
		destroy(guildId);
		throw new Error('Kon geen verbinding maken met het voice channel.');
	}

	return state;
}

// Normaliseert input naar een array van { title, query }.
async function resolveQuery(query) {
	const trimmed = (query || '').trim();
	if (!trimmed) return [];

	if (spotifyService.isSpotifyUrl(trimmed)) {
		const tracks = await spotifyService.getTracks(trimmed);
		return tracks.map(t => ({ title: `${t.title} — ${t.artist}`, query: t.searchQuery }));
	}

	const ytType = play.yt_validate(trimmed);
	if (ytType === 'video') {
		const info = await play.video_basic_info(trimmed).catch(() => null);
		const title = info?.video_details?.title || trimmed;
		return [{ title, query: trimmed, url: trimmed }];
	}
	if (ytType === 'playlist') {
		const pl = await play.playlist_info(trimmed, { incomplete: true }).catch(() => null);
		if (pl) {
			const videos = await pl.all_videos().catch(() => []);
			return videos.map(v => ({ title: v.title || 'Onbekend', query: v.url, url: v.url }));
		}
	}

	// Vrije zoekterm → YouTube
	return [{ title: trimmed, query: trimmed }];
}

async function resolvePlayable(track) {
	// Zorg dat we een afspeelbare YouTube-URL hebben.
	if (track.url && play.yt_validate(track.url) === 'video') {
		return track.url;
	}
	const results = await play.search(track.query, { limit: 1, source: { youtube: 'video' } });
	if (!results || !results.length) {
		return null;
	}
	track.url = results[0].url;
	if (!track.title || track.title === track.query) {
		track.title = results[0].title || track.title;
	}
	return results[0].url;
}

function enqueue(guildId, tracks) {
	const state = ensureState(guildId);
	const room = MAX_QUEUE - state.queue.length;
	const toAdd = tracks.slice(0, Math.max(0, room));
	state.queue.push(...toAdd);
	return { added: toAdd.length, skipped: tracks.length - toAdd.length };
}

async function playNext(guildId) {
	const state = states.get(guildId);
	if (!state || !state.player) return;

	const next = state.queue.shift();
	if (!next) {
		state.nowPlaying = null;
		scheduleLeave(state);
		return;
	}

	clearLeaveTimer(state);
	state.nowPlaying = next;

	let url;
	try {
		url = await resolvePlayable(next);
	} catch (err) {
		console.error('resolvePlayable failed:', err.message);
		url = null;
	}

	if (!url) {
		console.warn(`Geen afspeelbare bron voor "${next.title}", overslaan.`);
		return playNext(guildId);
	}

	try {
		const source = await play.stream(url);
		const resource = createAudioResource(source.stream, { inputType: source.type });
		state.player.play(resource);
	} catch (err) {
		console.error(`Kon "${next.title}" niet streamen:`, err.message);
		return playNext(guildId);
	}
}

async function handleTrackEnd(guildId) {
	const state = states.get(guildId);
	if (!state) return;

	if (state.loopMode === 'track' && state.nowPlaying) {
		state.queue.unshift(state.nowPlaying);
	} else if (state.loopMode === 'queue' && state.nowPlaying) {
		state.queue.push(state.nowPlaying);
	}

	await playNext(guildId);
}

// Start het afspelen als er nog niets speelt.
async function startIfIdle(guildId) {
	const state = states.get(guildId);
	if (!state || !state.player) return;
	const status = state.player.state.status;
	if (status === AudioPlayerStatus.Idle && !state.nowPlaying) {
		await playNext(guildId);
	}
}

function skip(guildId) {
	const state = states.get(guildId);
	if (!state || !state.player) return false;
	// Idle-event triggert playNext; bij loop 'track' niet de huidige herhalen.
	const skipped = state.nowPlaying;
	if (state.loopMode === 'track') {
		// tijdelijk loop omzeilen voor deze skip
		state.nowPlaying = null;
	}
	state.player.stop(true);
	return skipped;
}

function stop(guildId) {
	const state = states.get(guildId);
	if (!state) return false;
	state.queue = [];
	state.loopMode = 'off';
	state.nowPlaying = null;
	if (state.player) state.player.stop(true);
	scheduleLeave(state);
	return true;
}

function pause(guildId) {
	const state = states.get(guildId);
	if (!state || !state.player) return false;
	return state.player.pause();
}

function resume(guildId) {
	const state = states.get(guildId);
	if (!state || !state.player) return false;
	return state.player.unpause();
}

function shuffle(guildId) {
	const state = states.get(guildId);
	if (!state || state.queue.length < 2) return false;
	for (let i = state.queue.length - 1; i > 0; i -= 1) {
		const j = Math.floor(Math.random() * (i + 1));
		[state.queue[i], state.queue[j]] = [state.queue[j], state.queue[i]];
	}
	return true;
}

function removeAt(guildId, position) {
	const state = states.get(guildId);
	if (!state) return null;
	const idx = position - 1;
	if (idx < 0 || idx >= state.queue.length) return null;
	return state.queue.splice(idx, 1)[0];
}

function clear(guildId) {
	const state = states.get(guildId);
	if (!state) return 0;
	const count = state.queue.length;
	state.queue = [];
	return count;
}

function setLoop(guildId, mode) {
	const state = ensureState(guildId);
	state.loopMode = mode;
	return mode;
}

function destroy(guildId) {
	const state = states.get(guildId);
	if (!state) return;
	clearLeaveTimer(state);
	try {
		if (state.player) state.player.stop(true);
	} catch { /* noop */ }
	try {
		if (state.connection) state.connection.destroy();
	} catch { /* noop */ }
	states.delete(guildId);
}

module.exports = {
	getState,
	isConnected,
	joinChannel,
	resolveQuery,
	enqueue,
	playNext,
	startIfIdle,
	skip,
	stop,
	pause,
	resume,
	shuffle,
	removeAt,
	clear,
	setLoop,
	destroy,
};
