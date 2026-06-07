const path = require('path');
const {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	SlashCommandBuilder,
} = require('discord.js');
const { addBalance, getBalance, subtractBalance } = require('../../lib/crownService');
const { processLevelGain } = require('../../lib/levelingService');
const { getSettings } = require('../../lib/guildSettings');
const { addCountingSaves } = require('../../lib/countingSavesService');

const crownsFile = path.join(__dirname, '..', '..', 'data', 'crowns.json');
const levelsFile = path.join(__dirname, '..', '..', 'data', 'levels.json');
const rewardsFile = path.join(__dirname, '..', '..', 'data', 'roleRewards.json');
const levelsChannelFile = path.join(__dirname, '..', '..', 'data', 'levelsChannel.json');

async function buyXp(interaction, amount) {
	const settings = getSettings(interaction.guildId);
	const xpPerCrown = settings.crownshop?.xpPerCrown ?? 25;

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
}

async function buySaves(interaction, amount) {
	const settings = getSettings(interaction.guildId);
	const saveCost = settings.counting?.saveCost ?? 50;

	if (!amount || amount <= 0) {
		await interaction.reply({ content: 'Geef een positief aantal saves op.', flags: 64 });
		return;
	}

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
}

function buildInfoEmbed(interaction) {
	const settings = getSettings(interaction.guildId);
	const xpPerCrown = settings.crownshop?.xpPerCrown ?? 25;
	const saveCost = settings.counting?.saveCost ?? 50;
	const coinsPerCrown = settings.crownshop?.coinsPerCrown ?? 100;
	const balance = getBalance(crownsFile, interaction.guildId, interaction.user.id);

	return new EmbedBuilder()
		.setColor(0xb40f0f)
		.setTitle('👑 Crownshop')
		.setDescription([
			`Je hebt **${balance}** kroontjes.`,
			'',
			`**XP:** 1 kroontje = ${xpPerCrown} XP`,
			`**Counting save:** ${saveCost} kroontjes per save`,
			`**Kroontjes kopen:** ${coinsPerCrown} coins per kroontje (via /shop → Kroontjes)`,
		].join('\n'));
}

function buildInfoButtons() {
	return new ActionRowBuilder().addComponents(
		new ButtonBuilder().setCustomId('crownshop:buyxp').setLabel('Koop XP').setStyle(ButtonStyle.Primary).setEmoji('⚡'),
		new ButtonBuilder().setCustomId('crownshop:buysaves').setLabel('Koop saves').setStyle(ButtonStyle.Primary).setEmoji('🛡️'),
	);
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('crownshop')
		.setDescription('Bekijk kroontjes-prijzen en koop XP of saves'),
	buyXp,
	buySaves,
	buildInfoEmbed,
	buildInfoButtons,
	async execute(interaction) {
		await interaction.reply({
			embeds: [buildInfoEmbed(interaction)],
			components: [buildInfoButtons()],
			flags: 64,
		});
	},
};
