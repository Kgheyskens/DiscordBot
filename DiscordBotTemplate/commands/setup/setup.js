const {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	PermissionFlagsBits,
	SlashCommandBuilder,
} = require('discord.js');
const { getSettings, getApplicationRoles } = require('../../lib/guildSettings');
const { listCategories } = require('../../lib/roleCategoryService');

function buildOverviewEmbed(guildId) {
	const settings = getSettings(guildId);
	const ch = settings.channels;
	const r = settings.roles;
	const econ = settings.economy;
	const welcome = settings.welcome;
	const mg = settings.minigames || {};
	const cs = settings.crownshop || {};
	const challenge = settings.challenge || {};
	const hof = settings.hallOfFame || {};

	const minigameLine = ['wordle', 'hangman', 'minesweeper'].map(g => {
		const c = mg[g] || {};
		const status = c.enabled ? '✅' : '❌';
		const ch = c.channelId ? `<#${c.channelId}>` : 'overal';
		return `• ${g}: ${status} • ${ch} • ${c.rewardCrowns ?? 0} kroontjes`;
	}).join('\n');

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
		`• Sollicitatie-rollen: ${getApplicationRoles(guildId).length} ingesteld (${getApplicationRoles(guildId).filter(x => x.available).length} beschikbaar)`,
		'',
		'**Economy**',
		`• Status: ${econ.enabled ? '✅ aan' : '❌ uit'} • Crown spawn: ${econ.crownSpawnChance}%`,
		`• Work: ${econ.workMin}-${econ.workMax} (${econ.workCooldownMinutes}m) • Daily: ${econ.dailyMin}-${econ.dailyMax} (${econ.dailyCooldownHours}h)`,
		`• Pay tax: ${econ.payTaxPercent}% • Rob: ${econ.robSuccessChance}% (${econ.robCooldownHours}h)`,
		'',
		'**Welcome**',
		`• ${welcome.enabled ? '✅ aan' : '❌ uit'} • mode: ${welcome.mode}`,
		'',
		'**Counting**',
		`• ${settings.counting.enabled ? '✅ aan' : '❌ uit'} • save kost ${settings.counting.saveCost ?? 50} kroontjes`,
		'',
		'**Minigames**',
		minigameLine,
		'',
		'**Crownshop**',
		`• ${cs.xpPerCrown ?? 25} XP per kroontje`,
		'',
		'**Daily Challenge**',
		`• ${challenge.enabled ? '✅ aan' : '❌ uit'} • kanaal: ${ch.challenge ? `<#${ch.challenge}>` : '_niet ingesteld_'} • post om ${challenge.postHour ?? 9}:00 • beloning: ${challenge.rewardKroontjes ?? 10} kroontjes • ${(challenge.customPuzzles || []).length} eigen puzzels`,
		'',
		'**Hall of Fame**',
		`• ${hof.enabled ? '✅ aan' : '❌ uit'} • kanaal: ${ch.halloffame ? `<#${ch.halloffame}>` : '_niet ingesteld_'} • dag ${hof.postDay ?? 1} om ${hof.postHour ?? 10}:00`,
		'',
		'**Rol categorieën**',
		`• Aantal: ${listCategories(guildId).length}`,
	];

	return new EmbedBuilder()
		.setColor(0xb40f0f)
		.setTitle('🛠️ Server setup wizard')
		.setDescription([
			'Welkom in de setup wizard! Hieronder zie je een overzicht van de volledige bot-configuratie.',
			'',
			'**Hoe werkt het?**',
			'• Klik op een knop hieronder om een sectie te openen.',
			'• Elke sectie heeft eigen knoppen om instellingen aan/uit te zetten of te bewerken.',
			'• Modale invoer (zoals bedragen) gebruikt dezelfde Discord-invoer als andere bots.',
			'• Met **Status** ververs je dit overzicht. **Sluiten** sluit de wizard.',
			'',
			'_Tip:_ stel **Channels** en **Rollen** als eerste in — andere modules verwijzen ernaar.',
		].join('\n'))
		.addFields({ name: '📋 Huidige instellingen', value: lines.join('\n').slice(0, 4000) });
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
			new ButtonBuilder().setCustomId('setup:menu:minigames').setLabel('Minigames').setStyle(ButtonStyle.Primary),
			new ButtonBuilder().setCustomId('setup:menu:crownshop').setLabel('Crownshop').setStyle(ButtonStyle.Primary),
			new ButtonBuilder().setCustomId('setup:menu:restrict').setLabel('Restricties').setStyle(ButtonStyle.Primary),
		),
		new ActionRowBuilder().addComponents(
			new ButtonBuilder().setCustomId('setup:menu:challenge').setLabel('Daily Challenge').setStyle(ButtonStyle.Primary),
			new ButtonBuilder().setCustomId('setup:menu:halloffame').setLabel('Hall of Fame').setStyle(ButtonStyle.Primary),
			new ButtonBuilder().setCustomId('setup:menu:status').setLabel('Status').setStyle(ButtonStyle.Secondary),
			new ButtonBuilder().setCustomId('setup:menu:close').setLabel('Sluiten').setStyle(ButtonStyle.Secondary),
		),
	];
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('setup')
		.setDescription('Configureer de bot voor deze server')
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
