const path = require('path');
const { SlashCommandBuilder } = require('discord.js');
const { addBalance, getBalance, subtractBalance } = require('../../lib/crownService');
const { processLevelGain } = require('../../lib/levelingService');
const { readJson, writeJson } = require('../../lib/jsonStore');
const { getSettings } = require('../../lib/guildSettings');

const crownsFile = path.join(__dirname, '..', '..', 'data', 'crowns.json');
const levelsFile = path.join(__dirname, '..', '..', 'data', 'levels.json');
const rewardsFile = path.join(__dirname, '..', '..', 'data', 'roleRewards.json');
const levelsChannelFile = path.join(__dirname, '..', '..', 'data', 'levelsChannel.json');
const countingSavesFile = path.join(__dirname, '..', '..', 'data', 'countingSaves.json');

function getCountingSaves(guildId, userId) {
	const all = readJson(countingSavesFile, {});
	return all[guildId]?.[userId] || 0;
}

function addCountingSaves(guildId, userId, amount) {
	const all = readJson(countingSavesFile, {});
	const guildSaves = all[guildId] || {};
	guildSaves[userId] = Math.max(0, (guildSaves[userId] || 0) + amount);
	all[guildId] = guildSaves;
	writeJson(countingSavesFile, all);
	return guildSaves[userId];
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('crownshop')
		.setDescription('Winkel voor kroontjes')
		.addSubcommand(subcommand =>
			subcommand
				.setName('buyxp')
				.setDescription('Koop XP met kroontjes')
				.addIntegerOption(option =>
					option
						.setName('amount')
						.setDescription('Hoeveel XP je wilt kopen')
						.setRequired(true)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('buysave')
				.setDescription('Koop counting saves')
				.addIntegerOption(option =>
					option
						.setName('amount')
						.setDescription('Hoeveel saves je wilt kopen')
						.setMinValue(1)
						.setRequired(true)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('saves')
				.setDescription('Bekijk hoeveel counting saves je hebt')),
	async execute(interaction) {
		const subcommand = interaction.options.getSubcommand();

		const settings = getSettings(interaction.guildId);
		const xpPerCrown = settings.crownshop?.xpPerCrown ?? 25;
		const saveCost = settings.counting?.saveCost ?? 50;

		if (subcommand === 'buyxp') {
			const amount = interaction.options.getInteger('amount');
			if (!amount || amount <= 0) {
				await interaction.reply({ content: 'Geef een positief XP-aantal op.', flags: 64 });
				return;
			}

			const crownsCost = Math.ceil(amount / xpPerCrown);
			const balance = getBalance(crownsFile, interaction.guildId, interaction.user.id);
			if (balance < crownsCost) {
				await interaction.reply({ content: `Je hebt ${crownsCost} kroontjes nodig maar je hebt er maar ${balance}.`, flags: 64 });
				return;
			}

			subtractBalance(crownsFile, interaction.guildId, interaction.user.id, crownsCost);
			const result = await processLevelGain({
				guild: interaction.guild,
				user: interaction.user,
				amount,
				levelsFile,
				rewardsFile,
				levelsChannelFile,
				updateLastMessageAt: false,
			});

			const newBalance = getBalance(crownsFile, interaction.guildId, interaction.user.id);
			await interaction.reply({
				content: `Je hebt ${amount} XP gekocht voor ${crownsCost} kroontjes. Nieuwe balans: ${newBalance}.${result.leveledUp ? ` Je bent nu level ${result.level}.` : ''}`,
				flags: 64,
			});
			return;
		}

		if (subcommand === 'buysave') {
			const amount = interaction.options.getInteger('amount');
			const cost = amount * saveCost;
			const balance = getBalance(crownsFile, interaction.guildId, interaction.user.id);
			if (balance < cost) {
				await interaction.reply({ content: `Je hebt ${cost} kroontjes nodig maar je hebt er maar ${balance}.`, flags: 64 });
				return;
			}

			subtractBalance(crownsFile, interaction.guildId, interaction.user.id, cost);
			const totalSaves = addCountingSaves(interaction.guildId, interaction.user.id, amount);
			const newBalance = getBalance(crownsFile, interaction.guildId, interaction.user.id);
			await interaction.reply({
				content: `Je hebt ${amount} counting save${amount === 1 ? '' : 's'} gekocht voor ${cost} kroontjes. Je hebt nu **${totalSaves}** save${totalSaves === 1 ? '' : 's'}. Nieuwe balans: ${newBalance}.`,
				flags: 64,
			});
			return;
		}

		if (subcommand === 'saves') {
			const saves = getCountingSaves(interaction.guildId, interaction.user.id);
			await interaction.reply({
				content: `Je hebt **${saves}** counting save${saves === 1 ? '' : 's'}. Een save wordt automatisch gebruikt als je een fout maakt in counting.`,
				flags: 64,
			});
			return;
		}

		await interaction.reply({ content: 'Onbekende shopactie.', flags: 64 });
	},
};
