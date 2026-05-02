const path = require('path');
const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { transfer, isEconomyEnabled } = require('../../lib/economyService');

const coinsFile = path.join(__dirname, '..', '..', 'data', 'coins.json');
const crownsConfigFile = path.join(__dirname, '..', '..', 'data', 'crownsConfig.json');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('pay')
		.setDescription('Stuur coins naar een ander lid')
		.addUserOption(option => option.setName('user').setDescription('Wie krijgt de coins?').setRequired(true))
		.addIntegerOption(option => option.setName('amount').setDescription('Hoeveel coins?').setMinValue(1).setRequired(true)),
	async execute(interaction) {
		if (!isEconomyEnabled(interaction.guildId, crownsConfigFile)) {
			await interaction.reply({ content: 'Het economy-systeem staat uit.', flags: 64 });
			return;
		}

		const target = interaction.options.getUser('user');
		const amount = interaction.options.getInteger('amount');

		if (target.bot) {
			await interaction.reply({ content: 'Je kunt geen coins naar een bot sturen.', flags: 64 });
			return;
		}

		const result = transfer({
			coinsFile,
			guildId: interaction.guildId,
			fromUserId: interaction.user.id,
			toUserId: target.id,
			amount,
		});

		if (result.error) {
			await interaction.reply({ content: result.error, flags: 64 });
			return;
		}

		const embed = new EmbedBuilder()
			.setColor(0xb40f0f)
			.setTitle('Overschrijving voltooid')
			.setDescription(`<@${interaction.user.id}> stuurde ${result.amount} coins naar <@${target.id}>.`)
			.addFields(
				{ name: 'Belasting', value: `${result.tax} coins`, inline: true },
				{ name: 'Ontvangen', value: `${result.received} coins`, inline: true },
				{ name: 'Jouw balans', value: `${result.fromBalance}`, inline: true },
			);

		await interaction.reply({ embeds: [embed] });
	},
};
