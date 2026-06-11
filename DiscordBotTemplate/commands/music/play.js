const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const musicService = require('../../lib/musicService');
const spotifyService = require('../../lib/spotifyService');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('play')
		.setDescription('Speel een nummer of playlist (Spotify-link, YouTube-link of zoekterm)')
		.addStringOption(opt =>
			opt.setName('query')
				.setDescription('Spotify-link, YouTube-link of zoekterm')
				.setRequired(true)),
	async execute(interaction) {
		const voiceChannel = interaction.member?.voice?.channel;
		if (!voiceChannel) {
			await interaction.reply({ content: '❌ Je moet eerst in een voice channel zitten.', flags: 64 });
			return;
		}

		const query = interaction.options.getString('query');

		if (spotifyService.isSpotifyUrl(query) && !spotifyService.isConfigured()) {
			await interaction.reply({
				content: '❌ Spotify-links werken niet: de bot heeft geen Spotify-credentials. Gebruik een YouTube-link of zoekterm, of laat de eigenaar `SPOTIFY_CLIENT_ID` en `SPOTIFY_CLIENT_SECRET` instellen.',
				flags: 64,
			});
			return;
		}

		await interaction.deferReply();

		let tracks;
		try {
			tracks = await musicService.resolveQuery(query);
		} catch (err) {
			console.error('resolveQuery failed:', err.message);
			await interaction.editReply({ content: `❌ Kon dit niet ophalen: ${err.message}` }).catch(() => null);
			return;
		}

		if (!tracks.length) {
			await interaction.editReply({ content: '❌ Geen resultaten gevonden.' }).catch(() => null);
			return;
		}

		try {
			await musicService.joinChannel(voiceChannel, interaction.channel);
		} catch (err) {
			await interaction.editReply({ content: `❌ ${err.message}` }).catch(() => null);
			return;
		}

		const { added, skipped } = musicService.enqueue(interaction.guildId, tracks);
		await musicService.startIfIdle(interaction.guildId);

		const embed = new EmbedBuilder().setColor(0xb40f0f);
		if (added === 1) {
			embed.setTitle('▶️ Toegevoegd aan de wachtrij').setDescription(tracks[0].title);
		} else {
			embed.setTitle('▶️ Toegevoegd aan de wachtrij')
				.setDescription(`**${added}** nummers toegevoegd.${skipped ? `\n(${skipped} overgeslagen — wachtrij vol.)` : ''}`);
		}

		await interaction.editReply({ embeds: [embed] }).catch(() => null);
	},
};
