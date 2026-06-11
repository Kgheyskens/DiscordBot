const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const musicService = require('../../lib/musicService');

const PAGE_SIZE = 10;

module.exports = {
	data: new SlashCommandBuilder()
		.setName('queue')
		.setDescription('Toon de wachtrij'),
	async execute(interaction) {
		const state = musicService.getState(interaction.guildId);
		if (!state || (!state.nowPlaying && state.queue.length === 0)) {
			await interaction.reply({ content: '📭 De wachtrij is leeg.', flags: 64 });
			return;
		}

		const lines = state.queue.slice(0, PAGE_SIZE).map((t, i) => `**${i + 1}.** ${t.title}`);
		const remaining = state.queue.length - PAGE_SIZE;

		const loopLabel = { off: 'uit', track: 'nummer', queue: 'wachtrij' }[state.loopMode] || 'uit';

		const embed = new EmbedBuilder()
			.setColor(0xb40f0f)
			.setTitle('🎶 Wachtrij')
			.setDescription([
				state.nowPlaying ? `**Nu speelt:** ${state.nowPlaying.title}` : '*Niets speelt nu.*',
				'',
				lines.length ? lines.join('\n') : '*Geen nummers in de wachtrij.*',
				remaining > 0 ? `\n…en nog **${remaining}** meer.` : '',
			].join('\n'))
			.setFooter({ text: `${state.queue.length} in wachtrij • Loop: ${loopLabel}` });

		await interaction.reply({ embeds: [embed] });
	},
};
