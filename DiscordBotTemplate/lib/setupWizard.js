const {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ChannelSelectMenuBuilder,
	ChannelType,
	EmbedBuilder,
	ModalBuilder,
	PermissionFlagsBits,
	RoleSelectMenuBuilder,
	StringSelectMenuBuilder,
	TextInputBuilder,
	TextInputStyle,
} = require('discord.js');
const {
	getSettings,
	saveSettings,
	setChannel,
	setRole,
	setEconomy,
	setWelcome,
	setCounting,
	setMinigame,
	setCrownshop,
	setChallenge,
	setHallOfFame,
} = require('./guildSettings');
const {
	getRule,
	setRule,
	clearRule,
	listRules,
} = require('./commandRestrictions');
const { buildOverviewEmbed, buildMainButtons } = require('../commands/setup/setup');
const {
	listCategories,
	getCategory,
	createCategory,
	updateCategory,
	deleteCategory,
	postOrUpdateCategoryMessage,
} = require('./roleCategoryService');
const minigameService = require('./minigameService');

const MINIGAMES = ['wordle', 'hangman', 'minesweeper'];

const CHANNEL_KEYS = [
	{ key: 'welcome', label: 'Welcome channel' },
	{ key: 'levels', label: 'Levels channel' },
	{ key: 'counting', label: 'Counting channel' },
	{ key: 'twitch', label: 'Twitch channel' },
	{ key: 'ticketCategory', label: 'Ticket category', categoryOnly: true },
	{ key: 'ticketPanel', label: 'Ticket panel channel' },
	{ key: 'modlog', label: 'Mod-log channel' },
	{ key: 'challenge', label: 'Daily challenge channel' },
	{ key: 'halloffame', label: 'Hall of Fame channel' },
];

const ROLE_KEYS = [
	{ key: 'ticketSupport', label: 'Ticket support rol' },
];

const RESTRICTABLE_COMMANDS = [
	'gamble', 'work', 'daily', 'crownshop', 'shop', 'pay', 'rob', 'leaderboard',
	'balance', 'level', 'minigame', 'getmeme', 'twitch',
];

function isAdmin(interaction) {
	return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
}

async function refreshOverview(interaction) {
	await interaction.update({
		embeds: [buildOverviewEmbed(interaction.guildId)],
		components: buildMainButtons(),
	}).catch(() => null);
}

function backRow() {
	return new ActionRowBuilder().addComponents(
		new ButtonBuilder().setCustomId('setup:menu:back').setLabel('Terug').setStyle(ButtonStyle.Secondary),
	);
}

async function handleMenu(interaction, target) {
	if (!isAdmin(interaction)) {
		await interaction.reply({ content: 'Alleen admins.', flags: 64 });
		return;
	}

	if (target === 'back' || target === 'status') {
		await refreshOverview(interaction);
		return;
	}

	if (target === 'close') {
		await interaction.update({ content: 'Setup gesloten.', embeds: [], components: [] }).catch(() => null);
		return;
	}

	if (target === 'channels') {
		const select = new StringSelectMenuBuilder()
			.setCustomId('setup:select:channelKey')
			.setPlaceholder('Kies welk channel je wilt instellen')
			.addOptions(CHANNEL_KEYS.map(c => ({ label: c.label, value: c.key })));
		await interaction.update({
			embeds: [new EmbedBuilder().setColor(0xb40f0f).setTitle('Channels').setDescription('Kies een channel om in te stellen.')],
			components: [new ActionRowBuilder().addComponents(select), backRow()],
		}).catch(() => null);
		return;
	}

	if (target === 'roles') {
		const select = new StringSelectMenuBuilder()
			.setCustomId('setup:select:roleKey')
			.setPlaceholder('Kies welke rol je wilt instellen')
			.addOptions(ROLE_KEYS.map(r => ({ label: r.label, value: r.key })));
		await interaction.update({
			embeds: [new EmbedBuilder().setColor(0xb40f0f).setTitle('Rollen').setDescription('Kies een rol-functie.')],
			components: [new ActionRowBuilder().addComponents(select), backRow()],
		}).catch(() => null);
		return;
	}

	if (target === 'economy') {
		const settings = getSettings(interaction.guildId);
		const econ = settings.economy;
		const enabledLabel = econ.enabled ? 'Zet economy UIT' : 'Zet economy AAN';
		const enabledStyle = econ.enabled ? ButtonStyle.Danger : ButtonStyle.Success;

		const row1 = new ActionRowBuilder().addComponents(
			new ButtonBuilder().setCustomId('setup:economy:toggle').setLabel(enabledLabel).setStyle(enabledStyle),
			new ButtonBuilder().setCustomId('setup:economy:rewards').setLabel('Work/Daily bedragen').setStyle(ButtonStyle.Primary),
			new ButtonBuilder().setCustomId('setup:economy:dailyCooldown').setLabel('Daily cooldown').setStyle(ButtonStyle.Primary),
			new ButtonBuilder().setCustomId('setup:economy:rob').setLabel('Rob/Pay').setStyle(ButtonStyle.Primary),
			new ButtonBuilder().setCustomId('setup:economy:spawn').setLabel('Crown spawn %').setStyle(ButtonStyle.Primary),
		);

		await interaction.update({
			embeds: [new EmbedBuilder().setColor(0xb40f0f).setTitle('💰 Economy').setDescription([
				`**Status:** ${econ.enabled ? '✅ aan' : '❌ uit'}`,
				`**Crown spawn kans:** ${econ.crownSpawnChance}% per bericht`,
				`**Work:** ${econ.workMin}-${econ.workMax} coins (cooldown ${econ.workCooldownMinutes}m)`,
				`**Daily:** ${econ.dailyMin}-${econ.dailyMax} coins (cooldown ${econ.dailyCooldownHours}h)`,
				`**Pay tax:** ${econ.payTaxPercent}%`,
				`**Rob:** ${econ.robSuccessChance}% slaagkans, max ${econ.robMaxStealPercent}% buit, fail-boete ${econ.robFailFeePercent}%, cooldown ${econ.robCooldownHours}h, min slachtoffer-balans ${econ.robMinVictimBalance}`,
				'',
				'_Wijzig elke waarde via de knoppen hieronder._',
			].join('\n'))],
			components: [row1, backRow()],
		}).catch(() => null);
		return;
	}

	if (target === 'welcome') {
		const settings = getSettings(interaction.guildId);
		const w = settings.welcome;
		const row1 = new ActionRowBuilder().addComponents(
			new ButtonBuilder().setCustomId('setup:welcome:toggle').setLabel(w.enabled ? 'Zet UIT' : 'Zet AAN').setStyle(w.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
			new ButtonBuilder().setCustomId('setup:welcome:mode').setLabel(`Mode: ${w.mode}`).setStyle(ButtonStyle.Secondary),
			new ButtonBuilder().setCustomId('setup:welcome:message').setLabel('Bericht aanpassen').setStyle(ButtonStyle.Primary),
		);
		await interaction.update({
			embeds: [new EmbedBuilder().setColor(0xb40f0f).setTitle('Welcome').setDescription(
				`Status: ${w.enabled ? '✅ aan' : '❌ uit'}\nMode: ${w.mode}\n\nBericht:\n\`\`\`\n${w.message}\n\`\`\`\nGebruik {user} en {count} als placeholders.`,
			)],
			components: [row1, backRow()],
		}).catch(() => null);
		return;
	}

	if (target === 'counting') {
		const settings = getSettings(interaction.guildId);
		const c = settings.counting;
		const row1 = new ActionRowBuilder().addComponents(
			new ButtonBuilder().setCustomId('setup:counting:toggle').setLabel(c.enabled ? 'Zet UIT' : 'Zet AAN').setStyle(c.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
		);
		await interaction.update({
			embeds: [new EmbedBuilder().setColor(0xb40f0f).setTitle('Counting').setDescription(
				`Status: ${c.enabled ? '✅ aan' : '❌ uit'}\nChannel: ${settings.channels.counting ? `<#${settings.channels.counting}>` : '_niet ingesteld_'}`,
			)],
			components: [row1, backRow()],
		}).catch(() => null);
		return;
	}

	if (target === 'tickets') {
		const settings = getSettings(interaction.guildId);
		const ch = settings.channels;
		const row1 = new ActionRowBuilder().addComponents(
			new ButtonBuilder().setCustomId('setup:tickets:postpanel').setLabel('Plaats ticket-panel').setStyle(ButtonStyle.Primary).setDisabled(!ch.ticketPanel),
		);
		await interaction.update({
			embeds: [new EmbedBuilder().setColor(0xb40f0f).setTitle('Tickets').setDescription(
				`Panel channel: ${ch.ticketPanel ? `<#${ch.ticketPanel}>` : '_niet ingesteld via Channels_'}\nCategory: ${ch.ticketCategory ? `<#${ch.ticketCategory}>` : '_niet ingesteld_'}\nSupport rol: ${settings.roles.ticketSupport ? `<@&${settings.roles.ticketSupport}>` : '_niet ingesteld_'}\n\nStel eerst de channels en rol in.`,
			)],
			components: [row1, backRow()],
		}).catch(() => null);
		return;
	}

	if (target === 'rolecats') {
		await showRoleCatsList(interaction);
		return;
	}

	if (target === 'minigames') {
		await showMinigamesMenu(interaction);
		return;
	}

	if (target === 'crownshop') {
		await showCrownshopMenu(interaction);
		return;
	}

	if (target === 'challenge') {
		await showChallengeMenu(interaction);
		return;
	}

	if (target === 'halloffame') {
		await showHallOfFameMenu(interaction);
		return;
	}

	if (target === 'restrict') {
		const select = new StringSelectMenuBuilder()
			.setCustomId('setup:select:restrictCommand')
			.setPlaceholder('Kies welk command je wilt beperken')
			.addOptions(RESTRICTABLE_COMMANDS.map(name => ({ label: `/${name}`, value: name })));
		await interaction.update({
			embeds: [new EmbedBuilder().setColor(0xb40f0f).setTitle('Command-restricties').setDescription('Kies een command om kanalen/rollen voor in te stellen.')],
			components: [new ActionRowBuilder().addComponents(select), backRow()],
		}).catch(() => null);
		return;
	}
}

async function handleSelect(interaction) {
	if (!isAdmin(interaction)) {
		await interaction.reply({ content: 'Alleen admins.', flags: 64 });
		return;
	}

	const [, , kind] = interaction.customId.split(':');

	if (kind === 'channelKey') {
		const channelKey = interaction.values[0];
		const meta = CHANNEL_KEYS.find(c => c.key === channelKey);
		const select = new ChannelSelectMenuBuilder()
			.setCustomId(`setup:setChannel:${channelKey}`)
			.setPlaceholder(`Kies een channel voor ${meta?.label || channelKey}`)
			.setChannelTypes(meta?.categoryOnly ? [ChannelType.GuildCategory] : [ChannelType.GuildText, ChannelType.GuildAnnouncement]);
		await interaction.update({
			embeds: [new EmbedBuilder().setColor(0xb40f0f).setTitle(meta?.label || channelKey).setDescription('Selecteer het juiste channel.')],
			components: [new ActionRowBuilder().addComponents(select), backRow()],
		}).catch(() => null);
		return;
	}

	if (kind === 'roleKey') {
		const roleKey = interaction.values[0];
		const meta = ROLE_KEYS.find(r => r.key === roleKey);
		const select = new RoleSelectMenuBuilder()
			.setCustomId(`setup:setRole:${roleKey}`)
			.setPlaceholder(`Kies een rol voor ${meta?.label || roleKey}`);
		await interaction.update({
			embeds: [new EmbedBuilder().setColor(0xb40f0f).setTitle(meta?.label || roleKey).setDescription('Selecteer de juiste rol.')],
			components: [new ActionRowBuilder().addComponents(select), backRow()],
		}).catch(() => null);
		return;
	}

	if (kind === 'minigamePick') {
		const game = interaction.values[0];
		await showMinigameDetail(interaction, game);
		return;
	}

	if (kind === 'restrictCommand') {
		const cmd = interaction.values[0];
		const rule = getRule(interaction.guildId, cmd);
		const modeSelect = new StringSelectMenuBuilder()
			.setCustomId(`setup:restrict:mode:${cmd}`)
			.setPlaceholder(`Kies modus (huidig: ${rule.mode})`)
			.addOptions([
				{ label: 'Overal toegestaan', value: 'anywhere', default: rule.mode === 'anywhere' },
				{ label: 'Allowlist (alleen bepaalde channels)', value: 'allowlist', default: rule.mode === 'allowlist' },
				{ label: 'Blocklist (geblokkeerd in bepaalde channels)', value: 'blocklist', default: rule.mode === 'blocklist' },
			]);
		const channelSelect = new ChannelSelectMenuBuilder()
			.setCustomId(`setup:restrict:channels:${cmd}`)
			.setPlaceholder('Selecteer channels (allow/block)')
			.setMinValues(0)
			.setMaxValues(10)
			.setChannelTypes([ChannelType.GuildText, ChannelType.GuildAnnouncement]);
		const roleSelect = new RoleSelectMenuBuilder()
			.setCustomId(`setup:restrict:roles:${cmd}`)
			.setPlaceholder('Selecteer rollen die dit command mogen gebruiken (leeg = iedereen)')
			.setMinValues(0)
			.setMaxValues(10);
		const clearRow = new ActionRowBuilder().addComponents(
			new ButtonBuilder().setCustomId(`setup:restrict:clear:${cmd}`).setLabel('Wis restrictie').setStyle(ButtonStyle.Danger),
		);

		const allowedList = rule.allowedChannels.map(id => `<#${id}>`).join(', ') || '_geen_';
		const blockedList = rule.blockedChannels.map(id => `<#${id}>`).join(', ') || '_geen_';
		const roleList = rule.allowedRoles.map(id => `<@&${id}>`).join(', ') || '_iedereen_';

		await interaction.update({
			embeds: [new EmbedBuilder().setColor(0xb40f0f).setTitle(`Restrictie: /${cmd}`).setDescription(
				`Mode: **${rule.mode}**\nAllowed channels: ${allowedList}\nBlocked channels: ${blockedList}\nAllowed roles: ${roleList}`,
			)],
			components: [
				new ActionRowBuilder().addComponents(modeSelect),
				new ActionRowBuilder().addComponents(channelSelect),
				new ActionRowBuilder().addComponents(roleSelect),
				clearRow,
				backRow(),
			],
		}).catch(() => null);
		return;
	}
}

async function handleChannelSelect(interaction) {
	if (!isAdmin(interaction)) {
		await interaction.reply({ content: 'Alleen admins.', flags: 64 });
		return;
	}
	const channelKey = interaction.customId.split(':')[2];
	const channelId = interaction.values[0] || null;
	setChannel(interaction.guildId, channelKey, channelId);
	await interaction.reply({ content: `Channel voor **${channelKey}** ingesteld op ${channelId ? `<#${channelId}>` : 'niets'}.`, flags: 64 });
}

async function handleRoleSelect(interaction) {
	if (!isAdmin(interaction)) {
		await interaction.reply({ content: 'Alleen admins.', flags: 64 });
		return;
	}
	const roleKey = interaction.customId.split(':')[2];
	const roleId = interaction.values[0] || null;
	setRole(interaction.guildId, roleKey, roleId);
	await interaction.reply({ content: `Rol voor **${roleKey}** ingesteld op ${roleId ? `<@&${roleId}>` : 'niets'}.`, flags: 64 });
}

async function handleEconomyButton(interaction, action) {
	if (!isAdmin(interaction)) {
		await interaction.reply({ content: 'Alleen admins.', flags: 64 });
		return;
	}
	const settings = getSettings(interaction.guildId);
	const econ = settings.economy;

	if (action === 'toggle') {
		setEconomy(interaction.guildId, { enabled: !econ.enabled });
		await interaction.reply({ content: `Economy is nu **${!econ.enabled ? 'aan' : 'uit'}**.`, flags: 64 });
		return;
	}

	if (action === 'rewards') {
		const modal = new ModalBuilder().setCustomId('setup:modal:economyRewards').setTitle('Work / Daily bedragen');
		modal.addComponents(
			new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('workMin').setLabel('Work min (coins)').setStyle(TextInputStyle.Short).setValue(String(econ.workMin)).setRequired(true)),
			new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('workMax').setLabel('Work max (coins)').setStyle(TextInputStyle.Short).setValue(String(econ.workMax)).setRequired(true)),
			new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('workCooldownMinutes').setLabel('Work cooldown (minuten)').setStyle(TextInputStyle.Short).setValue(String(econ.workCooldownMinutes)).setRequired(true)),
			new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dailyMin').setLabel('Daily min (coins)').setStyle(TextInputStyle.Short).setValue(String(econ.dailyMin)).setRequired(true)),
			new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dailyMax').setLabel('Daily max (coins)').setStyle(TextInputStyle.Short).setValue(String(econ.dailyMax)).setRequired(true)),
		);
		await interaction.showModal(modal);
		return;
	}

	if (action === 'dailyCooldown') {
		const modal = new ModalBuilder().setCustomId('setup:modal:economyDailyCooldown').setTitle('Daily cooldown');
		modal.addComponents(
			new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dailyCooldownHours').setLabel('Daily cooldown (uren)').setStyle(TextInputStyle.Short).setValue(String(econ.dailyCooldownHours)).setRequired(true)),
		);
		await interaction.showModal(modal);
		return;
	}

	if (action === 'rob') {
		const modal = new ModalBuilder().setCustomId('setup:modal:economyRob').setTitle('Rob / Pay instellingen');
		modal.addComponents(
			new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('payTaxPercent').setLabel('Pay tax (%)').setStyle(TextInputStyle.Short).setValue(String(econ.payTaxPercent)).setRequired(true)),
			new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('robSuccessChance').setLabel('Rob succes kans (%)').setStyle(TextInputStyle.Short).setValue(String(econ.robSuccessChance)).setRequired(true)),
			new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('robMaxStealPercent').setLabel('Rob max steal (%)').setStyle(TextInputStyle.Short).setValue(String(econ.robMaxStealPercent)).setRequired(true)),
			new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('robCooldownHours').setLabel('Rob cooldown (uren)').setStyle(TextInputStyle.Short).setValue(String(econ.robCooldownHours)).setRequired(true)),
			new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('robFailFeePercent').setLabel('Boete bij fail (%)').setStyle(TextInputStyle.Short).setValue(String(econ.robFailFeePercent)).setRequired(true)),
		);
		await interaction.showModal(modal);
		return;
	}

	if (action === 'robMin') {
		const modal = new ModalBuilder().setCustomId('setup:modal:economyRobMin').setTitle('Rob minimum slachtoffer-balans');
		modal.addComponents(
			new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('robMinVictimBalance').setLabel('Min balans slachtoffer (coins)').setStyle(TextInputStyle.Short).setValue(String(econ.robMinVictimBalance)).setRequired(true)),
		);
		await interaction.showModal(modal);
		return;
	}

	if (action === 'spawn') {
		const modal = new ModalBuilder().setCustomId('setup:modal:economySpawn').setTitle('Crown spawn kans');
		modal.addComponents(
			new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('crownSpawnChance').setLabel('Spawn kans per bericht (%)').setStyle(TextInputStyle.Short).setValue(String(econ.crownSpawnChance)).setRequired(true)),
		);
		await interaction.showModal(modal);
	}
}

function clampInt(value, min, max, fallback) {
	const num = parseInt(value, 10);
	if (Number.isNaN(num)) return fallback;
	return Math.max(min, Math.min(max, num));
}

async function handleModalSubmit(interaction) {
	if (!isAdmin(interaction)) {
		await interaction.reply({ content: 'Alleen admins.', flags: 64 });
		return;
	}

	const [, , kind] = interaction.customId.split(':');
	const settings = getSettings(interaction.guildId);
	const econ = settings.economy;

	if (kind === 'economyRewards') {
		const workMin = clampInt(interaction.fields.getTextInputValue('workMin'), 1, 1_000_000, econ.workMin);
		const workMax = clampInt(interaction.fields.getTextInputValue('workMax'), 1, 1_000_000, econ.workMax);
		const dailyMin = clampInt(interaction.fields.getTextInputValue('dailyMin'), 1, 1_000_000, econ.dailyMin);
		const dailyMax = clampInt(interaction.fields.getTextInputValue('dailyMax'), 1, 1_000_000, econ.dailyMax);
		if (workMin > workMax) {
			await interaction.reply({ content: '❌ Work min mag niet groter zijn dan work max.', flags: 64 });
			return;
		}
		if (dailyMin > dailyMax) {
			await interaction.reply({ content: '❌ Daily min mag niet groter zijn dan daily max.', flags: 64 });
			return;
		}
		setEconomy(interaction.guildId, {
			workMin,
			workMax,
			workCooldownMinutes: clampInt(interaction.fields.getTextInputValue('workCooldownMinutes'), 1, 10_080, econ.workCooldownMinutes),
			dailyMin,
			dailyMax,
		});
		await interaction.reply({ content: '✅ Work/Daily bedragen bijgewerkt.', flags: 64 });
		return;
	}

	if (kind === 'economyDailyCooldown') {
		const v = clampInt(interaction.fields.getTextInputValue('dailyCooldownHours'), 1, 720, econ.dailyCooldownHours);
		setEconomy(interaction.guildId, { dailyCooldownHours: v });
		await interaction.reply({ content: `✅ Daily cooldown ingesteld op **${v} uur**.`, flags: 64 });
		return;
	}

	if (kind === 'economyRobMin') {
		const v = clampInt(interaction.fields.getTextInputValue('robMinVictimBalance'), 0, 1_000_000, econ.robMinVictimBalance);
		setEconomy(interaction.guildId, { robMinVictimBalance: v });
		await interaction.reply({ content: `✅ Min slachtoffer-balans is nu **${v} coins**.`, flags: 64 });
		return;
	}

	if (kind === 'economyRob') {
		const patch = {
			payTaxPercent: clampInt(interaction.fields.getTextInputValue('payTaxPercent'), 0, 100, econ.payTaxPercent),
			robSuccessChance: clampInt(interaction.fields.getTextInputValue('robSuccessChance'), 0, 100, econ.robSuccessChance),
			robMaxStealPercent: clampInt(interaction.fields.getTextInputValue('robMaxStealPercent'), 1, 100, econ.robMaxStealPercent),
			robCooldownHours: clampInt(interaction.fields.getTextInputValue('robCooldownHours'), 1, 168, econ.robCooldownHours),
			robFailFeePercent: clampInt(interaction.fields.getTextInputValue('robFailFeePercent'), 0, 100, econ.robFailFeePercent),
		};
		setEconomy(interaction.guildId, patch);
		await interaction.reply({ content: 'Rob/Pay instellingen bijgewerkt.', flags: 64 });
		return;
	}

	if (kind === 'economySpawn') {
		const patch = {
			crownSpawnChance: clampInt(interaction.fields.getTextInputValue('crownSpawnChance'), 1, 100, econ.crownSpawnChance),
		};
		setEconomy(interaction.guildId, patch);
		await interaction.reply({ content: 'Crown spawn kans bijgewerkt.', flags: 64 });
		return;
	}

	if (kind === 'welcomeMessage') {
		const message = interaction.fields.getTextInputValue('message').slice(0, 1500);
		setWelcome(interaction.guildId, { message });
		await interaction.reply({ content: 'Welcome bericht bijgewerkt.', flags: 64 });
	}
}

async function handleWelcomeButton(interaction, action) {
	if (!isAdmin(interaction)) {
		await interaction.reply({ content: 'Alleen admins.', flags: 64 });
		return;
	}
	const w = getSettings(interaction.guildId).welcome;

	if (action === 'toggle') {
		setWelcome(interaction.guildId, { enabled: !w.enabled });
		await interaction.reply({ content: `Welcome is nu **${!w.enabled ? 'aan' : 'uit'}**.`, flags: 64 });
		return;
	}
	if (action === 'mode') {
		const next = w.mode === 'channel' ? 'dm' : 'channel';
		setWelcome(interaction.guildId, { mode: next });
		await interaction.reply({ content: `Welcome mode is nu **${next}**.`, flags: 64 });
		return;
	}
	if (action === 'message') {
		const modal = new ModalBuilder().setCustomId('setup:modal:welcomeMessage').setTitle('Welcome bericht');
		modal.addComponents(new ActionRowBuilder().addComponents(
			new TextInputBuilder().setCustomId('message').setLabel('Bericht ({user}, {count})').setStyle(TextInputStyle.Paragraph).setValue(w.message).setRequired(true),
		));
		await interaction.showModal(modal);
	}
}

async function handleCountingButton(interaction, action) {
	if (!isAdmin(interaction)) {
		await interaction.reply({ content: 'Alleen admins.', flags: 64 });
		return;
	}
	const c = getSettings(interaction.guildId).counting;
	if (action === 'toggle') {
		setCounting(interaction.guildId, { enabled: !c.enabled });
		await interaction.reply({ content: `Counting is nu **${!c.enabled ? 'aan' : 'uit'}**.`, flags: 64 });
	}
}

async function handleRestrictInteraction(interaction) {
	if (!isAdmin(interaction)) {
		await interaction.reply({ content: 'Alleen admins.', flags: 64 });
		return;
	}

	const parts = interaction.customId.split(':');
	const action = parts[2];
	const cmd = parts[3];

	if (action === 'mode') {
		const mode = interaction.values[0];
		setRule(interaction.guildId, cmd, { mode });
		await interaction.reply({ content: `Mode voor /${cmd} ingesteld op **${mode}**.`, flags: 64 });
		return;
	}
	if (action === 'channels') {
		const rule = getRule(interaction.guildId, cmd);
		const ids = interaction.values || [];
		if (rule.mode === 'allowlist') {
			setRule(interaction.guildId, cmd, { allowedChannels: ids });
		} else if (rule.mode === 'blocklist') {
			setRule(interaction.guildId, cmd, { blockedChannels: ids });
		} else {
			setRule(interaction.guildId, cmd, { allowedChannels: ids });
		}
		await interaction.reply({ content: `Channels voor /${cmd} bijgewerkt (${ids.length}).`, flags: 64 });
		return;
	}
	if (action === 'roles') {
		const ids = interaction.values || [];
		setRule(interaction.guildId, cmd, { allowedRoles: ids });
		await interaction.reply({ content: `Rollen voor /${cmd} bijgewerkt (${ids.length}).`, flags: 64 });
		return;
	}
	if (action === 'clear') {
		clearRule(interaction.guildId, cmd);
		await interaction.reply({ content: `Restrictie voor /${cmd} verwijderd.`, flags: 64 });
	}
}

async function postTicketPanel(interaction) {
	if (!isAdmin(interaction)) {
		await interaction.reply({ content: 'Alleen admins.', flags: 64 });
		return;
	}

	const settings = getSettings(interaction.guildId);
	const channelId = settings.channels.ticketPanel;
	if (!channelId) {
		await interaction.reply({ content: 'Stel eerst een ticket-panel channel in via Channels.', flags: 64 });
		return;
	}

	const channel = interaction.guild.channels.cache.get(channelId) || await interaction.guild.channels.fetch(channelId).catch(() => null);
	if (!channel?.isTextBased()) {
		await interaction.reply({ content: 'Het ticket-panel channel kon niet gevonden worden.', flags: 64 });
		return;
	}

	const embed = new EmbedBuilder()
		.setColor(0xb40f0f)
		.setTitle('Open een ticket')
		.setDescription('Klik op een knop om een ticket te openen.');

	const row = new ActionRowBuilder().addComponents(
		new ButtonBuilder().setCustomId('ticketpanel:partnerships').setLabel('Partnerships').setStyle(ButtonStyle.Danger),
		new ButtonBuilder().setCustomId('ticketpanel:vragen').setLabel('Vragen').setStyle(ButtonStyle.Danger),
		new ButtonBuilder().setCustomId('ticketpanel:twitch_promotie').setLabel('Twitch promotie').setStyle(ButtonStyle.Danger),
		new ButtonBuilder().setCustomId('ticketpanel:sollicitaties').setLabel('Sollicitaties').setStyle(ButtonStyle.Danger),
	);

	const sent = await channel.send({ embeds: [embed], components: [row] }).catch(() => null);
	if (!sent) {
		await interaction.reply({ content: 'Kon panel niet plaatsen (permissies?).', flags: 64 });
		return;
	}

	const path = require('path');
	const { readJson, writeJson } = require('./jsonStore');
	const ticketPanelsFile = path.join(__dirname, '..', 'data', 'ticketPanels.json');
	const all = readJson(ticketPanelsFile, {});
	all[interaction.guildId] = {
		...(all[interaction.guildId] || {}),
		channelId: channel.id,
		messageId: sent.id,
		categoryId: settings.channels.ticketCategory || all[interaction.guildId]?.categoryId || null,
		supportRoleId: settings.roles.ticketSupport || all[interaction.guildId]?.supportRoleId || null,
	};
	writeJson(ticketPanelsFile, all);

	await interaction.reply({ content: `Ticket panel geplaatst in <#${channel.id}>.`, flags: 64 });
}

async function showMinigamesMenu(interaction) {
	const settings = getSettings(interaction.guildId);
	const mg = settings.minigames || {};
	const lines = MINIGAMES.map(g => {
		const c = mg[g] || {};
		return `**${g}** — ${c.enabled ? '✅ aan' : '❌ uit'} • kanaal: ${c.channelId ? `<#${c.channelId}>` : '_overal_'} • beloning: ${c.rewardCrowns ?? 0} kroontjes`;
	}).join('\n');

	const select = new StringSelectMenuBuilder()
		.setCustomId('setup:select:minigamePick')
		.setPlaceholder('Kies een minigame om te bewerken')
		.addOptions(MINIGAMES.map(g => ({ label: g, value: g })));

	const embed = new EmbedBuilder()
		.setColor(0xb40f0f)
		.setTitle('Minigames')
		.setDescription(`Per minigame kun je toggelen, kanaal koppelen, beloning instellen en eigen woordenlijst beheren.\n\n${lines}`);

	const payload = {
		embeds: [embed],
		components: [new ActionRowBuilder().addComponents(select), backRow()],
	};
	if (interaction.update) await interaction.update(payload).catch(() => null);
	else await interaction.reply({ ...payload, flags: 64 }).catch(() => null);
}

async function showMinigameDetail(interaction, game) {
	const settings = getSettings(interaction.guildId);
	const cfg = settings.minigames?.[game] || {};
	const customWords = minigameService.getCustomWords(interaction.guildId, game);

	const embed = new EmbedBuilder()
		.setColor(0xb40f0f)
		.setTitle(`Minigame: ${game}`)
		.setDescription([
			`Status: ${cfg.enabled ? '✅ aan' : '❌ uit'}`,
			`Kanaal: ${cfg.channelId ? `<#${cfg.channelId}>` : '_overal toegestaan_'}`,
			`Beloning: ${cfg.rewardCrowns ?? 0} kroontjes`,
			`Eigen woorden (${customWords.length}): ${customWords.length ? customWords.slice(0, 30).join(', ') + (customWords.length > 30 ? '…' : '') : '_geen_'}`,
		].join('\n'));

	const channelSelect = new ChannelSelectMenuBuilder()
		.setCustomId(`setup:minigame:channel:${game}`)
		.setPlaceholder('Beperk tot kanaal (leeg = overal)')
		.setChannelTypes([ChannelType.GuildText, ChannelType.GuildAnnouncement])
		.setMinValues(0)
		.setMaxValues(1);

	const buttonRow = new ActionRowBuilder().addComponents(
		new ButtonBuilder().setCustomId(`setup:minigame:toggle:${game}`).setLabel(cfg.enabled ? 'Zet UIT' : 'Zet AAN').setStyle(cfg.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
		new ButtonBuilder().setCustomId(`setup:minigame:reward:${game}`).setLabel('Beloning aanpassen').setStyle(ButtonStyle.Primary),
		new ButtonBuilder().setCustomId(`setup:minigame:addword:${game}`).setLabel('Woord toevoegen').setStyle(ButtonStyle.Primary).setDisabled(game === 'minesweeper'),
		new ButtonBuilder().setCustomId(`setup:minigame:removeword:${game}`).setLabel('Woord verwijderen').setStyle(ButtonStyle.Danger).setDisabled(game === 'minesweeper'),
	);

	const navRow = new ActionRowBuilder().addComponents(
		new ButtonBuilder().setCustomId('setup:menu:minigames').setLabel('Terug minigames').setStyle(ButtonStyle.Secondary),
		new ButtonBuilder().setCustomId('setup:menu:back').setLabel('Hoofdmenu').setStyle(ButtonStyle.Secondary),
	);

	const payload = {
		embeds: [embed],
		components: [new ActionRowBuilder().addComponents(channelSelect), buttonRow, navRow],
	};
	if (interaction.replied || interaction.deferred) await interaction.editReply(payload).catch(() => null);
	else if (interaction.update) await interaction.update(payload).catch(() => null);
	else await interaction.reply({ ...payload, flags: 64 }).catch(() => null);
}

async function handleMinigameInteraction(interaction) {
	if (!isAdmin(interaction)) {
		await interaction.reply({ content: 'Alleen admins.', flags: 64 });
		return;
	}
	const parts = interaction.customId.split(':');
	const action = parts[2];
	const game = parts[3];

	if (action === 'channel' && interaction.isChannelSelectMenu()) {
		const id = interaction.values?.[0] || null;
		setMinigame(interaction.guildId, game, { channelId: id });
		await showMinigameDetail(interaction, game);
		return;
	}

	if (action === 'toggle' && interaction.isButton()) {
		const cur = getSettings(interaction.guildId).minigames?.[game] || {};
		setMinigame(interaction.guildId, game, { enabled: !cur.enabled });
		await showMinigameDetail(interaction, game);
		return;
	}

	if (action === 'reward' && interaction.isButton()) {
		const cur = getSettings(interaction.guildId).minigames?.[game] || {};
		const modal = new ModalBuilder().setCustomId(`setup:modal:minigameReward:${game}`).setTitle(`Beloning ${game}`);
		modal.addComponents(new ActionRowBuilder().addComponents(
			new TextInputBuilder().setCustomId('reward').setLabel('Kroontjes per win').setStyle(TextInputStyle.Short).setValue(String(cur.rewardCrowns ?? 0)).setRequired(true),
		));
		await interaction.showModal(modal);
		return;
	}

	if (action === 'addword' && interaction.isButton()) {
		const modal = new ModalBuilder().setCustomId(`setup:modal:minigameAddWord:${game}`).setTitle(`Woord toevoegen (${game})`);
		modal.addComponents(new ActionRowBuilder().addComponents(
			new TextInputBuilder().setCustomId('word').setLabel(game === 'wordle' ? '5-letter woord' : 'Woord').setStyle(TextInputStyle.Short).setRequired(true),
		));
		await interaction.showModal(modal);
		return;
	}

	if (action === 'removeword' && interaction.isButton()) {
		const modal = new ModalBuilder().setCustomId(`setup:modal:minigameRemoveWord:${game}`).setTitle(`Woord verwijderen (${game})`);
		modal.addComponents(new ActionRowBuilder().addComponents(
			new TextInputBuilder().setCustomId('word').setLabel('Woord om te verwijderen').setStyle(TextInputStyle.Short).setRequired(true),
		));
		await interaction.showModal(modal);
	}
}

async function handleMinigameModal(interaction) {
	const parts = interaction.customId.split(':');
	const kind = parts[2];
	const game = parts[3];

	if (kind === 'minigameReward') {
		const reward = clampInt(interaction.fields.getTextInputValue('reward'), 0, 1_000_000, 0);
		setMinigame(interaction.guildId, game, { rewardCrowns: reward });
		await interaction.reply({ content: `Beloning voor **${game}** ingesteld op ${reward} kroontjes.`, flags: 64 });
		return;
	}
	if (kind === 'minigameAddWord') {
		const word = interaction.fields.getTextInputValue('word');
		if (game === 'wordle' && word.trim().length !== 5) {
			await interaction.reply({ content: 'Wordle woorden moeten exact 5 letters zijn.', flags: 64 });
			return;
		}
		const result = minigameService.addCustomWord(interaction.guildId, game, word);
		await interaction.reply({ content: result.error || `Woord toegevoegd aan **${game}**.`, flags: 64 });
		return;
	}
	if (kind === 'minigameRemoveWord') {
		const word = interaction.fields.getTextInputValue('word');
		const result = minigameService.removeCustomWord(interaction.guildId, game, word);
		await interaction.reply({ content: result.error || `Woord verwijderd uit **${game}**.`, flags: 64 });
	}
}

async function showCrownshopMenu(interaction) {
	const settings = getSettings(interaction.guildId);
	const cs = settings.crownshop || {};
	const counting = settings.counting || {};

	const embed = new EmbedBuilder()
		.setColor(0xb40f0f)
		.setTitle('Crownshop instellingen')
		.setDescription([
			`XP per kroontje (buyxp): **${cs.xpPerCrown ?? 25}** XP/kroontje`,
			`Counting save prijs: **${counting.saveCost ?? 50}** kroontjes per save`,
		].join('\n'));

	const buttons = new ActionRowBuilder().addComponents(
		new ButtonBuilder().setCustomId('setup:crownshop:xp').setLabel('XP-conversie').setStyle(ButtonStyle.Primary),
		new ButtonBuilder().setCustomId('setup:crownshop:savecost').setLabel('Save-prijs').setStyle(ButtonStyle.Primary),
	);

	const payload = { embeds: [embed], components: [buttons, backRow()] };
	if (interaction.update) await interaction.update(payload).catch(() => null);
	else await interaction.reply({ ...payload, flags: 64 }).catch(() => null);
}

async function handleCrownshopButton(interaction, action) {
	if (!isAdmin(interaction)) {
		await interaction.reply({ content: 'Alleen admins.', flags: 64 });
		return;
	}
	const settings = getSettings(interaction.guildId);
	if (action === 'xp') {
		const modal = new ModalBuilder().setCustomId('setup:modal:crownshopXp').setTitle('XP per kroontje');
		modal.addComponents(new ActionRowBuilder().addComponents(
			new TextInputBuilder().setCustomId('xpPerCrown').setLabel('Hoeveel XP geeft 1 kroontje').setStyle(TextInputStyle.Short).setValue(String(settings.crownshop?.xpPerCrown ?? 25)).setRequired(true),
		));
		await interaction.showModal(modal);
		return;
	}
	if (action === 'savecost') {
		const modal = new ModalBuilder().setCustomId('setup:modal:crownshopSaveCost').setTitle('Save-prijs');
		modal.addComponents(new ActionRowBuilder().addComponents(
			new TextInputBuilder().setCustomId('saveCost').setLabel('Kroontjes per counting save').setStyle(TextInputStyle.Short).setValue(String(settings.counting?.saveCost ?? 50)).setRequired(true),
		));
		await interaction.showModal(modal);
	}
}

async function handleCrownshopModal(interaction) {
	const parts = interaction.customId.split(':');
	const kind = parts[2];
	if (kind === 'crownshopXp') {
		const v = clampInt(interaction.fields.getTextInputValue('xpPerCrown'), 1, 10_000, 25);
		setCrownshop(interaction.guildId, { xpPerCrown: v });
		await interaction.reply({ content: `XP per kroontje is nu **${v}**.`, flags: 64 });
		return;
	}
	if (kind === 'crownshopSaveCost') {
		const v = clampInt(interaction.fields.getTextInputValue('saveCost'), 1, 1_000_000, 50);
		setCounting(interaction.guildId, { saveCost: v });
		await interaction.reply({ content: `Save prijs is nu **${v}** kroontjes.`, flags: 64 });
	}
}

async function showChallengeMenu(interaction) {
	const settings = getSettings(interaction.guildId);
	const c = settings.challenge || {};
	const channelId = settings.channels?.challenge;

	const embed = new EmbedBuilder()
		.setColor(0xb40f0f)
		.setTitle('Daily Challenge')
		.setDescription([
			`Status: ${c.enabled ? '✅ aan' : '❌ uit'}`,
			`Kanaal: ${channelId ? `<#${channelId}>` : '_niet ingesteld (zet via Channels → Daily challenge channel)_'}`,
			`Tijdstip: **${c.postHour ?? 9}:00** lokale tijd`,
			`Beloning: **${c.rewardKroontjes ?? 10} kroontjes** voor de eerste juiste antwoord`,
			`Eigen puzzels: **${(c.customPuzzles || []).length}** (gebruik /challenge add)`,
		].join('\n'));

	const buttons = new ActionRowBuilder().addComponents(
		new ButtonBuilder().setCustomId('setup:challenge:toggle').setLabel(c.enabled ? 'Uitzetten' : 'Aanzetten').setStyle(c.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
		new ButtonBuilder().setCustomId('setup:challenge:hour').setLabel('Tijdstip').setStyle(ButtonStyle.Primary),
		new ButtonBuilder().setCustomId('setup:challenge:reward').setLabel('Beloning').setStyle(ButtonStyle.Primary),
	);

	const payload = { embeds: [embed], components: [buttons, backRow()] };
	if (interaction.update) await interaction.update(payload).catch(() => null);
	else await interaction.reply({ ...payload, flags: 64 }).catch(() => null);
}

async function handleChallengeButton(interaction, action) {
	if (!isAdmin(interaction)) {
		await interaction.reply({ content: 'Alleen admins.', flags: 64 });
		return;
	}
	const settings = getSettings(interaction.guildId);
	if (action === 'toggle') {
		setChallenge(interaction.guildId, { enabled: !settings.challenge?.enabled });
		await showChallengeMenu(interaction);
		return;
	}
	if (action === 'hour') {
		const modal = new ModalBuilder().setCustomId('setup:modal:challengeHour').setTitle('Tijdstip daily challenge');
		modal.addComponents(new ActionRowBuilder().addComponents(
			new TextInputBuilder().setCustomId('postHour').setLabel('Uur (0-23)').setStyle(TextInputStyle.Short).setValue(String(settings.challenge?.postHour ?? 9)).setRequired(true),
		));
		await interaction.showModal(modal);
		return;
	}
	if (action === 'reward') {
		const modal = new ModalBuilder().setCustomId('setup:modal:challengeReward').setTitle('Kroontjes-beloning');
		modal.addComponents(new ActionRowBuilder().addComponents(
			new TextInputBuilder().setCustomId('rewardKroontjes').setLabel('Aantal kroontjes voor winnaar').setStyle(TextInputStyle.Short).setValue(String(settings.challenge?.rewardKroontjes ?? 10)).setRequired(true),
		));
		await interaction.showModal(modal);
	}
}

async function handleChallengeModal(interaction) {
	const kind = interaction.customId.split(':')[2];
	if (kind === 'challengeHour') {
		const v = clampInt(interaction.fields.getTextInputValue('postHour'), 0, 23, 9);
		setChallenge(interaction.guildId, { postHour: v });
		await interaction.reply({ content: `Daily challenge wordt nu om **${v}:00** gepost.`, flags: 64 });
		return;
	}
	if (kind === 'challengeReward') {
		const v = clampInt(interaction.fields.getTextInputValue('rewardKroontjes'), 0, 1_000_000, 10);
		setChallenge(interaction.guildId, { rewardKroontjes: v });
		await interaction.reply({ content: `Beloning is nu **${v} kroontjes**.`, flags: 64 });
	}
}

async function showHallOfFameMenu(interaction) {
	const settings = getSettings(interaction.guildId);
	const h = settings.hallOfFame || {};
	const channelId = settings.channels?.halloffame;

	const embed = new EmbedBuilder()
		.setColor(0xb40f0f)
		.setTitle('Hall of Fame')
		.setDescription([
			`Status: ${h.enabled ? '✅ aan' : '❌ uit'}`,
			`Kanaal: ${channelId ? `<#${channelId}>` : '_niet ingesteld (zet via Channels → Hall of Fame channel)_'}`,
			`Post: dag **${h.postDay ?? 1}** van de maand om **${h.postHour ?? 10}:00**`,
			'',
			'Toont elke maand de top-3 challenge-winnaars van de vorige maand.',
		].join('\n'));

	const buttons = new ActionRowBuilder().addComponents(
		new ButtonBuilder().setCustomId('setup:halloffame:toggle').setLabel(h.enabled ? 'Uitzetten' : 'Aanzetten').setStyle(h.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
		new ButtonBuilder().setCustomId('setup:halloffame:day').setLabel('Dag van maand').setStyle(ButtonStyle.Primary),
		new ButtonBuilder().setCustomId('setup:halloffame:hour').setLabel('Tijdstip').setStyle(ButtonStyle.Primary),
	);

	const payload = { embeds: [embed], components: [buttons, backRow()] };
	if (interaction.update) await interaction.update(payload).catch(() => null);
	else await interaction.reply({ ...payload, flags: 64 }).catch(() => null);
}

async function handleHallOfFameButton(interaction, action) {
	if (!isAdmin(interaction)) {
		await interaction.reply({ content: 'Alleen admins.', flags: 64 });
		return;
	}
	const settings = getSettings(interaction.guildId);
	if (action === 'toggle') {
		setHallOfFame(interaction.guildId, { enabled: !settings.hallOfFame?.enabled });
		await showHallOfFameMenu(interaction);
		return;
	}
	if (action === 'day') {
		const modal = new ModalBuilder().setCustomId('setup:modal:halloffameDay').setTitle('Dag van de maand');
		modal.addComponents(new ActionRowBuilder().addComponents(
			new TextInputBuilder().setCustomId('postDay').setLabel('Dag (1-28)').setStyle(TextInputStyle.Short).setValue(String(settings.hallOfFame?.postDay ?? 1)).setRequired(true),
		));
		await interaction.showModal(modal);
		return;
	}
	if (action === 'hour') {
		const modal = new ModalBuilder().setCustomId('setup:modal:halloffameHour').setTitle('Tijdstip Hall of Fame');
		modal.addComponents(new ActionRowBuilder().addComponents(
			new TextInputBuilder().setCustomId('postHour').setLabel('Uur (0-23)').setStyle(TextInputStyle.Short).setValue(String(settings.hallOfFame?.postHour ?? 10)).setRequired(true),
		));
		await interaction.showModal(modal);
	}
}

async function handleHallOfFameModal(interaction) {
	const kind = interaction.customId.split(':')[2];
	if (kind === 'halloffameDay') {
		const v = clampInt(interaction.fields.getTextInputValue('postDay'), 1, 28, 1);
		setHallOfFame(interaction.guildId, { postDay: v });
		await interaction.reply({ content: `Hall of Fame post nu op dag **${v}** van de maand.`, flags: 64 });
		return;
	}
	if (kind === 'halloffameHour') {
		const v = clampInt(interaction.fields.getTextInputValue('postHour'), 0, 23, 10);
		setHallOfFame(interaction.guildId, { postHour: v });
		await interaction.reply({ content: `Hall of Fame post nu om **${v}:00**.`, flags: 64 });
	}
}

async function showRoleCatsList(interaction) {
	const cats = listCategories(interaction.guildId);
	const lines = cats.length
		? cats.map(c => `• **${c.name}** — ${c.roleIds.length} rol(len), ${c.exclusive ? 'exclusief' : 'meerdere'}, kanaal: ${c.channelId ? `<#${c.channelId}>` : '_geen_'}`).join('\n')
		: '_Nog geen categorieën._';

	const rows = [
		new ActionRowBuilder().addComponents(
			new ButtonBuilder().setCustomId('setup:rolecats:new').setLabel('Nieuwe categorie').setStyle(ButtonStyle.Success),
		),
	];

	if (cats.length) {
		const select = new StringSelectMenuBuilder()
			.setCustomId('setup:rolecats:pick')
			.setPlaceholder('Kies een categorie om te bewerken')
			.addOptions(cats.slice(0, 25).map(c => ({ label: c.name.slice(0, 100), value: c.id })));
		rows.push(new ActionRowBuilder().addComponents(select));
	}
	rows.push(backRow());

	const embed = new EmbedBuilder()
		.setColor(0xb40f0f)
		.setTitle('Rol categorieën')
		.setDescription(`Maak categorieën zoals "Geslacht" en voeg er rol-knoppen aan toe.\n\n${lines}`);

	const payload = { embeds: [embed], components: rows };
	if (interaction.replied || interaction.deferred) {
		await interaction.editReply(payload).catch(() => null);
	} else if (interaction.update) {
		await interaction.update(payload).catch(() => null);
	} else {
		await interaction.reply({ ...payload, flags: 64 }).catch(() => null);
	}
}

async function showRoleCatDetail(interaction, categoryId, options = {}) {
	const cat = getCategory(interaction.guildId, categoryId);
	if (!cat) {
		await interaction.reply({ content: 'Categorie niet gevonden.', flags: 64 });
		return;
	}

	const roleList = cat.roleIds.length
		? cat.roleIds.map(id => `<@&${id}>`).join(', ')
		: '_geen rollen_';

	const embed = new EmbedBuilder()
		.setColor(0xb40f0f)
		.setTitle(`Categorie: ${cat.name}`)
		.setDescription(cat.description || '_Geen beschrijving_')
		.addFields(
			{ name: 'Rollen', value: roleList },
			{ name: 'Modus', value: cat.exclusive ? 'Exclusief (1 rol)' : 'Meerdere rollen toegestaan', inline: true },
			{ name: 'Kanaal', value: cat.channelId ? `<#${cat.channelId}>` : '_niet ingesteld_', inline: true },
			{ name: 'Bericht', value: cat.messageId ? `\`${cat.messageId}\`` : '_nog niet geplaatst_', inline: true },
		);

	const rolesSelect = new RoleSelectMenuBuilder()
		.setCustomId(`setup:rolecat:roles:${cat.id}`)
		.setPlaceholder('Kies rollen voor deze categorie')
		.setMinValues(0)
		.setMaxValues(25);

	const channelSelect = new ChannelSelectMenuBuilder()
		.setCustomId(`setup:rolecat:channel:${cat.id}`)
		.setPlaceholder('Kies het kanaal voor het rolmenu')
		.setChannelTypes([ChannelType.GuildText, ChannelType.GuildAnnouncement])
		.setMinValues(0)
		.setMaxValues(1);

	const buttonsRow = new ActionRowBuilder().addComponents(
		new ButtonBuilder().setCustomId(`setup:rolecat:rename:${cat.id}`).setLabel('Naam/desc').setStyle(ButtonStyle.Primary),
		new ButtonBuilder().setCustomId(`setup:rolecat:exclusive:${cat.id}`).setLabel(cat.exclusive ? 'Modus: 1 rol → meerdere' : 'Modus: meerdere → 1 rol').setStyle(ButtonStyle.Secondary),
		new ButtonBuilder().setCustomId(`setup:rolecat:post:${cat.id}`).setLabel(cat.messageId ? 'Bericht updaten' : 'Bericht plaatsen').setStyle(ButtonStyle.Success),
		new ButtonBuilder().setCustomId(`setup:rolecat:delete:${cat.id}`).setLabel('Verwijder').setStyle(ButtonStyle.Danger),
	);

	const navRow = new ActionRowBuilder().addComponents(
		new ButtonBuilder().setCustomId('setup:rolecats:list').setLabel('Terug naar lijst').setStyle(ButtonStyle.Secondary),
		new ButtonBuilder().setCustomId('setup:menu:back').setLabel('Hoofdmenu').setStyle(ButtonStyle.Secondary),
	);

	const payload = {
		embeds: [embed],
		components: [
			new ActionRowBuilder().addComponents(rolesSelect),
			new ActionRowBuilder().addComponents(channelSelect),
			buttonsRow,
			navRow,
		],
	};

	if (options.flash) {
		payload.content = options.flash;
	}

	if (interaction.replied || interaction.deferred) {
		await interaction.editReply(payload).catch(() => null);
	} else if (interaction.update) {
		await interaction.update(payload).catch(() => null);
	} else {
		await interaction.reply({ ...payload, flags: 64 }).catch(() => null);
	}
}

async function handleRoleCatInteraction(interaction) {
	if (!isAdmin(interaction)) {
		await interaction.reply({ content: 'Alleen admins.', flags: 64 });
		return;
	}

	const parts = interaction.customId.split(':');
	const action = parts[2];
	const categoryId = parts[3];

	if (action === 'roles' && interaction.isRoleSelectMenu()) {
		const ids = interaction.values || [];
		updateCategory(interaction.guildId, categoryId, { roleIds: ids });
		await showRoleCatDetail(interaction, categoryId);
		return;
	}

	if (action === 'channel' && interaction.isChannelSelectMenu()) {
		const id = interaction.values?.[0] || null;
		updateCategory(interaction.guildId, categoryId, { channelId: id, messageId: null });
		await showRoleCatDetail(interaction, categoryId);
		return;
	}

	if (action === 'rename' && interaction.isButton()) {
		const cat = getCategory(interaction.guildId, categoryId);
		if (!cat) {
			await interaction.reply({ content: 'Categorie niet gevonden.', flags: 64 });
			return;
		}
		const modal = new ModalBuilder().setCustomId(`setup:modal:rolecatRename:${categoryId}`).setTitle('Categorie aanpassen');
		modal.addComponents(
			new ActionRowBuilder().addComponents(
				new TextInputBuilder().setCustomId('name').setLabel('Naam').setStyle(TextInputStyle.Short).setValue(cat.name).setRequired(true),
			),
			new ActionRowBuilder().addComponents(
				new TextInputBuilder().setCustomId('description').setLabel('Beschrijving').setStyle(TextInputStyle.Paragraph).setValue(cat.description || '').setRequired(false),
			),
		);
		await interaction.showModal(modal);
		return;
	}

	if (action === 'exclusive' && interaction.isButton()) {
		const cat = getCategory(interaction.guildId, categoryId);
		if (!cat) {
			await interaction.reply({ content: 'Categorie niet gevonden.', flags: 64 });
			return;
		}
		updateCategory(interaction.guildId, categoryId, { exclusive: !cat.exclusive });
		await showRoleCatDetail(interaction, categoryId);
		return;
	}

	if (action === 'post' && interaction.isButton()) {
		const cat = getCategory(interaction.guildId, categoryId);
		if (!cat) {
			await interaction.reply({ content: 'Categorie niet gevonden.', flags: 64 });
			return;
		}
		await interaction.deferUpdate().catch(() => null);
		const result = await postOrUpdateCategoryMessage(interaction.guild, cat);
		if (result.error) {
			await showRoleCatDetail(interaction, categoryId, { flash: `❌ ${result.error}` });
			return;
		}
		await showRoleCatDetail(interaction, categoryId, { flash: '✅ Bericht geplaatst/geüpdatet.' });
		return;
	}

	if (action === 'delete' && interaction.isButton()) {
		deleteCategory(interaction.guildId, categoryId);
		await showRoleCatsList(interaction);
	}
}

async function handleRoleCatsButton(interaction, action) {
	if (!isAdmin(interaction)) {
		await interaction.reply({ content: 'Alleen admins.', flags: 64 });
		return;
	}

	if (action === 'new') {
		const modal = new ModalBuilder().setCustomId('setup:modal:rolecatNew').setTitle('Nieuwe rol categorie');
		modal.addComponents(
			new ActionRowBuilder().addComponents(
				new TextInputBuilder().setCustomId('name').setLabel('Naam (bv. Geslacht)').setStyle(TextInputStyle.Short).setRequired(true),
			),
			new ActionRowBuilder().addComponents(
				new TextInputBuilder().setCustomId('description').setLabel('Beschrijving').setStyle(TextInputStyle.Paragraph).setRequired(false),
			),
			new ActionRowBuilder().addComponents(
				new TextInputBuilder().setCustomId('exclusive').setLabel('Exclusief? (ja/nee)').setStyle(TextInputStyle.Short).setValue('nee').setRequired(true),
			),
		);
		await interaction.showModal(modal);
		return;
	}

	if (action === 'list') {
		await showRoleCatsList(interaction);
	}
}

async function handleRoleCatsSelect(interaction) {
	if (!isAdmin(interaction)) {
		await interaction.reply({ content: 'Alleen admins.', flags: 64 });
		return;
	}
	const categoryId = interaction.values?.[0];
	if (!categoryId) return;
	await showRoleCatDetail(interaction, categoryId);
}

async function handleRoleCatModal(interaction) {
	const parts = interaction.customId.split(':');
	const kind = parts[2];

	if (kind === 'rolecatNew') {
		const name = interaction.fields.getTextInputValue('name');
		const description = interaction.fields.getTextInputValue('description') || '';
		const exclusiveRaw = interaction.fields.getTextInputValue('exclusive') || 'nee';
		const exclusive = /^(ja|yes|y|true|1)$/i.test(exclusiveRaw.trim());
		const result = createCategory(interaction.guildId, { name, description, exclusive });
		if (result.error) {
			await interaction.reply({ content: result.error, flags: 64 });
			return;
		}
		await interaction.reply({ content: `Categorie **${result.category.name}** aangemaakt. Selecteer rollen en kanaal in het detailscherm.`, flags: 64 });
		return;
	}

	if (kind === 'rolecatRename') {
		const categoryId = parts[3];
		const name = interaction.fields.getTextInputValue('name');
		const description = interaction.fields.getTextInputValue('description') || '';
		updateCategory(interaction.guildId, categoryId, { name, description });
		await interaction.reply({ content: 'Categorie bijgewerkt.', flags: 64 });
	}
}

async function dispatch(interaction) {
	const id = interaction.customId || '';
	if (!id.startsWith('setup:')) return false;

	try {
		const parts = id.split(':');
		const section = parts[1];
		const action = parts[2];

		if (interaction.isButton()) {
			if (section === 'menu') { await handleMenu(interaction, action); return true; }
			if (section === 'economy') { await handleEconomyButton(interaction, action); return true; }
			if (section === 'welcome') { await handleWelcomeButton(interaction, action); return true; }
			if (section === 'counting') { await handleCountingButton(interaction, action); return true; }
			if (section === 'tickets' && action === 'postpanel') { await postTicketPanel(interaction); return true; }
			if (section === 'restrict' && action === 'clear') { await handleRestrictInteraction(interaction); return true; }
			if (section === 'rolecats') { await handleRoleCatsButton(interaction, action); return true; }
			if (section === 'rolecat') { await handleRoleCatInteraction(interaction); return true; }
			if (section === 'minigame') { await handleMinigameInteraction(interaction); return true; }
			if (section === 'crownshop') { await handleCrownshopButton(interaction, action); return true; }
			if (section === 'challenge') { await handleChallengeButton(interaction, action); return true; }
			if (section === 'halloffame') { await handleHallOfFameButton(interaction, action); return true; }
		}
		if (interaction.isStringSelectMenu()) {
			if (section === 'select') { await handleSelect(interaction); return true; }
			if (section === 'restrict' && action === 'mode') { await handleRestrictInteraction(interaction); return true; }
			if (section === 'rolecats' && action === 'pick') { await handleRoleCatsSelect(interaction); return true; }
		}
		if (interaction.isChannelSelectMenu()) {
			if (section === 'setChannel') { await handleChannelSelect(interaction); return true; }
			if (section === 'restrict' && action === 'channels') { await handleRestrictInteraction(interaction); return true; }
			if (section === 'rolecat' && action === 'channel') { await handleRoleCatInteraction(interaction); return true; }
			if (section === 'minigame' && action === 'channel') { await handleMinigameInteraction(interaction); return true; }
		}
		if (interaction.isRoleSelectMenu()) {
			if (section === 'setRole') { await handleRoleSelect(interaction); return true; }
			if (section === 'restrict' && action === 'roles') { await handleRestrictInteraction(interaction); return true; }
			if (section === 'rolecat' && action === 'roles') { await handleRoleCatInteraction(interaction); return true; }
		}
		if (interaction.isModalSubmit()) {
			if (section === 'modal' && (action === 'rolecatNew' || action === 'rolecatRename')) {
				await handleRoleCatModal(interaction);
				return true;
			}
			if (section === 'modal' && (action === 'minigameReward' || action === 'minigameAddWord' || action === 'minigameRemoveWord')) {
				await handleMinigameModal(interaction);
				return true;
			}
			if (section === 'modal' && (action === 'crownshopXp' || action === 'crownshopSaveCost')) {
				await handleCrownshopModal(interaction);
				return true;
			}
			if (section === 'modal' && (action === 'challengeHour' || action === 'challengeReward')) {
				await handleChallengeModal(interaction);
				return true;
			}
			if (section === 'modal' && (action === 'halloffameDay' || action === 'halloffameHour')) {
				await handleHallOfFameModal(interaction);
				return true;
			}
			await handleModalSubmit(interaction);
			return true;
		}
	} catch (err) {
		console.error('Setup wizard handler failed:', err);
		try {
			if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
				await interaction.reply({ content: 'Setup actie mislukt.', flags: 64 });
			}
		} catch {}
	}
	return true;
}

module.exports = { dispatch, RESTRICTABLE_COMMANDS };
