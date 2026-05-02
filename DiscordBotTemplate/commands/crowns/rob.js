const path = require('path');
const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { attemptRob, formatDuration, isEconomyEnabled } = require('../../lib/economyService');

const economyTimersFile = path.join(__dirname, '..', '..', 'data', 'economyTimers.json');
const coinsFile = path.join(__dirname, '..', '..', 'data', 'coins.json');
const crownsConfigFile = path.join(__dirname, '..', '..', 'data', 'crownsConfig.json');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('rob')
		.setDescription('Probeer coins van een ander lid te stelen')
		.addUserOption(option => option.setName('user').setDescription('Wie wil je beroven?').setRequired(true)),
	async execute(interaction) {
		if (!isEconomyEnabled(interaction.guildId, crownsConfigFile)) {
			await interaction.reply({ content: 'Het economy-systeem staat uit.', flags: 64 });
			return;
		}

		const target = interaction.options.getUser('user');
		if (target.bot) {
			await interaction.reply({ content: 'Bots beroven gaat niet.', flags: 64 });
			return;
		}

		const result = attemptRob({
			coinsFile,
			timersFile: economyTimersFile,
			guildId: interaction.guildId,
			robberId: interaction.user.id,
			victimId: target.id,
		});

		if (result.cooldown) {
			await interaction.reply({ content: `Je rob-cooldown loopt nog: ${formatDuration(result.remainingMs)}.`, flags: 64 });
			return;
		}

		if (result.error) {
			await interaction.reply({ content: result.error, flags: 64 });
			return;
		}

		if (result.success) {
			const embed = new EmbedBuilder()
				.setColor(0xb40f0f)
				.setTitle('Geslaagde overval')
				.setDescription(`<@${interaction.user.id}> heeft **${result.stolen} coins** gestolen van <@${target.id}>.`)
				.addFields(
					{ name: 'Jouw balans', value: `${result.robberBalance}`, inline: true },
					{ name: 'Slachtoffer balans', value: `${result.victimBalance}`, inline: true },
				);
			await interaction.reply({ embeds: [embed] });
			return;
		}

		const embed = new EmbedBuilder()
			.setColor(0x555555)
			.setTitle('Overval mislukt')
			.setDescription(`<@${interaction.user.id}> werd betrapt en betaalt **${result.fee} coins** boete.`)
			.addFields({ name: 'Jouw balans', value: `${result.robberBalance}`, inline: true });
		await interaction.reply({ embeds: [embed] });
	},
};
