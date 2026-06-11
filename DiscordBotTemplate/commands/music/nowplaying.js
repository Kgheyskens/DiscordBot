const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const musicService = require('../../lib/musicService');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('nowplaying')
		.setDescription('Toon welk nummer nu speelt'),
	async execute(interaction) {
		const state = musicService.getState(interaction.guildId);
		if (!state?.nowPlaying) {
			await interaction.reply({ content: '❌ Er speelt nu niets.', flags: 64 });
			return;
		}

		const embed = new EmbedBuilder()
			.setColor(0xb40f0f)
			.setTitle('🎧 Nu speelt')
			.setDescription(state.nowPlaying.title)
			.setFooter({ text: `${state.queue.length} nummer(s) in de wachtrij` });

		if (state.nowPlaying.url) {
			embed.setURL(state.nowPlaying.url);
		}

		await interaction.reply({ embeds: [embed] });
	},
};
