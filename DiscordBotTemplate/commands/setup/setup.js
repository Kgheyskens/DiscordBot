const {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	PermissionFlagsBits,
	SlashCommandBuilder,
} = require('discord.js');
const { getSettings } = require('../../lib/guildSettings');
const { listCategories } = require('../../lib/roleCategoryService');

function buildOverviewEmbed(guildId) {
	const settings = getSettings(guildId);
	const ch = settings.channels;
	const r = settings.roles;
	const econ = settings.economy;
	const welcome = settings.welcome;

	const lines = [
		'**Channels**',
		`• Welcome: ${ch.welcome ? `<#${ch.welcome}>` : '_niet ingesteld_'}`,
		`• Levels: ${ch.levels ? `<#${ch.levels}>` : '_niet ingesteld_'}`,
		`• Counting: ${ch.counting ? `<#${ch.counting}>` : '_niet ingesteld_'}`,
		`• Twitch: ${ch.twitch ? `<#${ch.twitch}>` : '_niet ingesteld_'}`,
		`• Ticket category: ${ch.ticketCategory ? `<#${ch.ticketCategory}>` : '_niet ingesteld_'}`,
		'',
		'**Rollen**',
		`• Ticket support: ${r.ticketSupport ? `<@&${r.ticketSupport}>` : '_niet ingesteld_'}`,
		'',
		'**Economy**',
		`• Status: ${econ.enabled ? '✅ aan' : '❌ uit'}`,
		`• Crown spawn: ${econ.crownSpawnChance}% per bericht`,
		`• Work: ${econ.workMin}-${econ.workMax} kroontjes / ${econ.workCooldownMinutes} min cooldown`,
		`• Daily: ${econ.dailyMin}-${econ.dailyMax} kroontjes / ${econ.dailyCooldownHours}h cooldown`,
		`• Pay tax: ${econ.payTaxPercent}%`,
		`• Rob: ${econ.robSuccessChance}% kans, max ${econ.robMaxStealPercent}% steal, ${econ.robCooldownHours}h cooldown`,
		'',
		'**Welcome**',
		`• Status: ${welcome.enabled ? '✅ aan' : '❌ uit'} (mode: ${welcome.mode})`,
		'',
		'**Counting**',
		`• Status: ${settings.counting.enabled ? '✅ aan' : '❌ uit'}`,
		'',
		'**Rol categorieën**',
		`• Aantal: ${listCategories(guildId).length}`,
	];

	return new EmbedBuilder()
		.setColor(0xb40f0f)
		.setTitle('Server setup')
		.setDescription('Kies een categorie om te configureren.')
		.addFields({ name: 'Huidige instellingen', value: lines.join('\n') });
}

function buildMainButtons() {
	return [
		new ActionRowBuilder().addComponents(
			new ButtonBuilder().setCustomId('setup:menu:channels').setLabel('Channels').setStyle(ButtonStyle.Primary),
			new ButtonBuilder().setCustomId('setup:menu:roles').setLabel('Rollen').setStyle(ButtonStyle.Primary),
			new ButtonBuilder().setCustomId('setup:menu:economy').setLabel('Economy').setStyle(ButtonStyle.Primary),
			new ButtonBuilder().setCustomId('setup:menu:welcome').setLabel('Welcome').setStyle(ButtonStyle.Primary),
			new ButtonBuilder().setCustomId('setup:menu:counting').setLabel('Counting').setStyle(ButtonStyle.Primary),
		),
		new ActionRowBuilder().addComponents(
			new ButtonBuilder().setCustomId('setup:menu:tickets').setLabel('Tickets').setStyle(ButtonStyle.Primary),
			new ButtonBuilder().setCustomId('setup:menu:rolecats').setLabel('Rol categorieën').setStyle(ButtonStyle.Primary),
			new ButtonBuilder().setCustomId('setup:menu:restrict').setLabel('Restricties').setStyle(ButtonStyle.Primary),
			new ButtonBuilder().setCustomId('setup:menu:status').setLabel('Status').setStyle(ButtonStyle.Secondary),
			new ButtonBuilder().setCustomId('setup:menu:close').setLabel('Sluiten').setStyle(ButtonStyle.Secondary),
		),
	];
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('setup')
		.setDescription('Configureer de bot voor deze server')
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.setDMPermission(false),
	async execute(interaction) {
		if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
			await interaction.reply({ content: 'Alleen admins kunnen /setup gebruiken.', flags: 64 });
			return;
		}

		await interaction.reply({
			embeds: [buildOverviewEmbed(interaction.guildId)],
			components: buildMainButtons(),
			flags: 64,
		});
	},
	buildOverviewEmbed,
	buildMainButtons,
};
