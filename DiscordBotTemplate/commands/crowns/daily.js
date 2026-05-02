const path = require('path');
const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { claimDailyReward, formatDuration } = require('../../lib/economyService');
const { getBalance } = require('../../lib/coinService');

const coinsFile = path.join(__dirname, '..', '..', 'data', 'coins.json');
const crownsConfigFile = path.join(__dirname, '..', '..', 'data', 'crownsConfig.json');
const economyTimersFile = path.join(__dirname, '..', '..', 'data', 'economyTimers.json');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('daily')
		.setDescription('Claim je dagelijkse coin-beloning'),
	async execute(interaction) {
		await interaction.deferReply({ ephemeral: true });
		const result = claimDailyReward({
			coinsFile,
			crownsConfigFile,
			timersFile: economyTimersFile,
			guildId: interaction.guildId,
			userId: interaction.user.id,
		});

		if (result.disabled) {
			await interaction.editReply({ content: 'Het economy-systeem staat uit.' });
			return;
		}

		if (result.cooldown) {
			await interaction.editReply({ content: `Je daily is nog niet klaar. Probeer het opnieuw over ${formatDuration(result.remainingMs)}.` });
			return;
		}

		const balance = getBalance(coinsFile, interaction.guildId, interaction.user.id);
		const embed = new EmbedBuilder()
			.setColor(0xb40f0f)
			.setTitle('Daily geclaimd')
			.setDescription(`Je hebt **${result.amount} coins** gekregen.`)
			.addFields({ name: 'Nieuwe balans', value: `${balance} coins`, inline: true });

		await interaction.editReply({ embeds: [embed] });
	},
};
