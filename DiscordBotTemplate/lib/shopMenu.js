const path = require('path');
const {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	ModalBuilder,
	StringSelectMenuBuilder,
	TextInputBuilder,
	TextInputStyle,
} = require('discord.js');
const { listItems, findItem, purchaseItem, categorizeItem } = require('./shopService');
const { getBalance: getCoinBalance, addBalance: addCoinBalance, subtractBalance: subtractCoinBalance } = require('./coinService');
const { getBalance: getCrownBalance, addBalance: addCrownBalance } = require('./crownService');
const { processLevelGain } = require('./levelingService');
const { isEconomyEnabled } = require('./economyService');
const { getSettings } = require('./guildSettings');
const inventoryService = require('./inventoryService');
const colorRoleService = require('./colorRoleService');
const crownshopCommand = require('../commands/crowns/crownshop');

const coinsFile = path.join(__dirname, '..', 'data', 'coins.json');
const crownsFile = path.join(__dirname, '..', 'data', 'crowns.json');
const crownsConfigFile = path.join(__dirname, '..', 'data', 'crownsConfig.json');
const levelsFile = path.join(__dirname, '..', 'data', 'levels.json');
const rewardsFile = path.join(__dirname, '..', 'data', 'roleRewards.json');
const levelsChannelFile = path.join(__dirname, '..', 'data', 'levelsChannel.json');

function navRow(active) {
	return new ActionRowBuilder().addComponents(
		new ButtonBuilder().setCustomId('shop:cat:roles').setLabel('Rollen').setEmoji('🎨').setStyle(active === 'roles' ? ButtonStyle.Primary : ButtonStyle.Secondary),
		new ButtonBuilder().setCustomId('shop:cat:upgrades').setLabel('Upgrades').setEmoji('⚡').setStyle(active === 'upgrades' ? ButtonStyle.Primary : ButtonStyle.Secondary),
		new ButtonBuilder().setCustomId('shop:cat:crowns').setLabel('Kroontjes').setEmoji('👑').setStyle(active === 'crowns' ? ButtonStyle.Primary : ButtonStyle.Secondary),
	);
}

function buildHome(interaction) {
	const coins = getCoinBalance(coinsFile, interaction.guildId, interaction.user.id);
	const crowns = getCrownBalance(crownsFile, interaction.guildId, interaction.user.id);
	const embed = new EmbedBuilder()
		.setColor(0xb40f0f)
		.setTitle('🛒 Shop')
		.setDescription([
			`Je hebt **${coins}** coins en **${crowns}** kroontjes.`,
			'',
			'**🎨 Rollen** — kleurrollen en je eigen custom rol',
			'**⚡ Upgrades** — XP boosters, lucky charms en meer',
			'**👑 Kroontjes** — koop kroontjes met coins, en counting saves',
			'',
			'Kies een categorie:',
		].join('\n'));
	return { embeds: [embed], components: [navRow(null)] };
}

function buildRolesScreen(interaction) {
	const guildId = interaction.guildId;
	const price = colorRoleService.getColorRolePrice(guildId);
	const userColors = colorRoleService.getUserColors(guildId, interaction.user.id);
	const items = listItems(guildId).filter(i => categorizeItem(i) === 'roles');

	const options = colorRoleService.COLORS.map(c => {
		const owned = userColors.owned.includes(c.key);
		const active = userColors.active === c.key;
		return {
			label: `${c.name}${active ? ' (actief)' : ''}`,
			value: `color:${c.key}`,
			description: owned ? (active ? 'Je actieve kleur' : 'In bezit — gratis wisselen') : `${price} coins`,
			emoji: c.emoji,
		};
	});

	for (const item of items.slice(0, 25 - options.length)) {
		options.push({
			label: item.name.slice(0, 100),
			value: `item:${item.id}`,
			description: `${item.price} ${item.currency || 'coins'}`.slice(0, 100),
		});
	}

	const select = new StringSelectMenuBuilder()
		.setCustomId('shop:color:pick')
		.setPlaceholder('Kies een kleur of rol')
		.addOptions(options.slice(0, 25));

	const activeColor = userColors.active ? colorRoleService.getColor(userColors.active) : null;
	const embed = new EmbedBuilder()
		.setColor(activeColor?.hex ?? 0xb40f0f)
		.setTitle('🎨 Rollen')
		.setDescription([
			`**Kleurrollen:** ${price} coins per kleur. Eenmaal gekocht blijft de kleur van jou — wisselen tussen gekochte kleuren is gratis. Je nieuwe kleur vervangt de actieve.`,
			'',
			`**Jouw actieve kleur:** ${activeColor ? `${activeColor.emoji} ${activeColor.name}` : '_geen_'}`,
			`**In bezit:** ${userColors.owned.length ? userColors.owned.map(k => colorRoleService.getColor(k)?.emoji || k).join(' ') : '_nog geen kleuren_'}`,
		].join('\n'));

	return { embeds: [embed], components: [new ActionRowBuilder().addComponents(select), navRow('roles')] };
}

function buildUpgradesScreen(interaction) {
	const items = listItems(interaction.guildId).filter(i => categorizeItem(i) === 'upgrades');
	const coins = getCoinBalance(coinsFile, interaction.guildId, interaction.user.id);

	const lines = items.length
		? items.map(i => `**${i.name}** — ${i.price} ${i.currency || 'coins'}${i.description ? `\n_${i.description}_` : ''}`)
		: ['_Geen upgrades beschikbaar. Een admin kan items toevoegen via /shopadmin._'];

	const embed = new EmbedBuilder()
		.setColor(0xb40f0f)
		.setTitle('⚡ Upgrades')
		.setDescription([`Je hebt **${coins}** coins.`, '', ...lines].join('\n'));

	const rows = [];
	let current = new ActionRowBuilder();
	for (const item of items.slice(0, 20)) {
		current.addComponents(
			new ButtonBuilder()
				.setCustomId(`shop:buy:${item.id}`)
				.setLabel(`${item.name} (${item.price})`.slice(0, 80))
				.setStyle(ButtonStyle.Primary),
		);
		if (current.components.length === 5) {
			rows.push(current);
			current = new ActionRowBuilder();
		}
		if (rows.length >= 4) break;
	}
	if (current.components.length > 0 && rows.length < 4) rows.push(current);
	rows.push(navRow('upgrades'));

	return { embeds: [embed], components: rows };
}

function buildCrownsScreen(interaction) {
	const settings = getSettings(interaction.guildId);
	const coinsPerCrown = settings.crownshop?.coinsPerCrown ?? 100;
	const saveCost = settings.counting?.saveCost ?? 50;
	const coins = getCoinBalance(coinsFile, interaction.guildId, interaction.user.id);
	const crowns = getCrownBalance(crownsFile, interaction.guildId, interaction.user.id);

	const embed = new EmbedBuilder()
		.setColor(0xffd700)
		.setTitle('👑 Kroontjes')
		.setDescription([
			`Je hebt **${coins}** coins en **${crowns}** kroontjes.`,
			'',
			`**Koers:** 1 kroontje = ${coinsPerCrown} coins`,
			`**Counting save:** ${saveCost} kroontjes per save`,
			'',
			'Koop kroontjes met coins, of saves met kroontjes:',
		].join('\n'));

	const buyRow = new ActionRowBuilder().addComponents(
		new ButtonBuilder().setCustomId('shop:crowns:buy:10').setLabel(`10 kroontjes (${10 * coinsPerCrown})`).setStyle(ButtonStyle.Primary).setEmoji('👑'),
		new ButtonBuilder().setCustomId('shop:crowns:buy:50').setLabel(`50 kroontjes (${50 * coinsPerCrown})`).setStyle(ButtonStyle.Primary).setEmoji('👑'),
		new ButtonBuilder().setCustomId('shop:crowns:buy:100').setLabel(`100 kroontjes (${100 * coinsPerCrown})`).setStyle(ButtonStyle.Primary).setEmoji('👑'),
	);
	const extraRow = new ActionRowBuilder().addComponents(
		new ButtonBuilder().setCustomId('shop:crowns:custom').setLabel('Ander aantal').setStyle(ButtonStyle.Secondary),
		new ButtonBuilder().setCustomId('shop:crowns:save').setLabel(`Koop saves (${saveCost} 👑/stuk)`).setStyle(ButtonStyle.Success).setEmoji('🛡️'),
	);

	return { embeds: [embed], components: [buyRow, extraRow, navRow('crowns')] };
}

async function purchaseShopItem(interaction, item) {
	if (!isEconomyEnabled(interaction.guildId, crownsConfigFile)) {
		await interaction.reply({ content: 'Het economy-systeem staat uit.', flags: 64 });
		return;
	}

	if (item.type === 'role') {
		const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
		if (!member) {
			await interaction.reply({ content: 'Kon je lidmaatschap niet ophalen.', flags: 64 });
			return;
		}
		if (member.roles.cache.has(item.payload)) {
			await interaction.reply({ content: 'Je hebt deze rol al.', flags: 64 });
			return;
		}

		const result = purchaseItem({ guildId: interaction.guildId, userId: interaction.user.id, itemId: item.id });
		if (result.error) {
			await interaction.reply({ content: result.error, flags: 64 });
			return;
		}

		const role = interaction.guild.roles.cache.get(item.payload) || await interaction.guild.roles.fetch(item.payload).catch(() => null);
		if (!role) {
			addCoinBalance(coinsFile, interaction.guildId, interaction.user.id, item.price);
			await interaction.reply({ content: 'Rol bestaat niet meer. Aankoop teruggedraaid.', flags: 64 });
			return;
		}

		await member.roles.add(role).catch(() => null);
		await interaction.reply({ content: `Je hebt **${role.name}** gekocht voor ${item.price} coins. Nieuwe balans: ${result.newBalance}.`, flags: 64 });
		return;
	}

	if (item.type === 'xp') {
		const result = purchaseItem({ guildId: interaction.guildId, userId: interaction.user.id, itemId: item.id });
		if (result.error) {
			await interaction.reply({ content: result.error, flags: 64 });
			return;
		}

		const xpAmount = Number(item.payload);
		const levelResult = await processLevelGain({
			guild: interaction.guild,
			user: interaction.user,
			amount: xpAmount,
			levelsFile,
			rewardsFile,
			levelsChannelFile,
			updateLastMessageAt: false,
		});

		await interaction.reply({
			content: `Je hebt **${xpAmount} XP** gekocht voor ${item.price} coins.${levelResult.leveledUp ? ` Je bent nu level ${levelResult.level}.` : ''} Nieuwe balans: ${result.newBalance}.`,
			flags: 64,
		});
		return;
	}

	if (item.type === 'xpboost' || item.type === 'luckycharm') {
		const effectKey = item.type === 'xpboost' ? 'xpBooster' : 'luckyCharm';
		const result = purchaseItem({ guildId: interaction.guildId, userId: interaction.user.id, itemId: item.id });
		if (result.error) {
			await interaction.reply({ content: result.error, flags: 64 });
			return;
		}
		inventoryService.addItem(interaction.guildId, interaction.user.id, effectKey, 1);
		await interaction.reply({
			content: `✅ Je hebt **${item.name}** gekocht voor ${item.price} coins. Gebruik \`/inventory use\` om te activeren. Nieuwe balans: ${result.newBalance}.`,
			flags: 64,
		});
		return;
	}

	if (item.type === 'customrole') {
		const result = purchaseItem({ guildId: interaction.guildId, userId: interaction.user.id, itemId: item.id });
		if (result.error) {
			await interaction.reply({ content: result.error, flags: 64 });
			return;
		}
		const requestRow = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId(`customrole:request:${interaction.user.id}:${item.price}`)
				.setLabel('Vul rol-aanvraag in')
				.setStyle(ButtonStyle.Primary),
		);
		await interaction.reply({
			content: `✅ Je hebt een eigen rol-aanvraag gekocht voor ${item.price} coins. Klik hieronder om naam en kleur in te vullen — een mod beoordeelt de aanvraag.`,
			components: [requestRow],
			flags: 64,
		});
		return;
	}

	const result = purchaseItem({ guildId: interaction.guildId, userId: interaction.user.id, itemId: item.id });
	if (result.error) {
		await interaction.reply({ content: result.error, flags: 64 });
		return;
	}
	await interaction.reply({ content: `Je hebt **${item.name}** gekocht voor ${item.price} coins. ${item.description || ''} Nieuwe balans: ${result.newBalance}.`, flags: 64 });
}

async function handleColorPick(interaction) {
	const value = interaction.values[0];

	if (value.startsWith('item:')) {
		const item = findItem(interaction.guildId, value.slice(5));
		if (!item) {
			await interaction.reply({ content: 'Item niet gevonden.', flags: 64 });
			return;
		}
		await purchaseShopItem(interaction, item);
		return;
	}

	const colorKey = value.slice(6);
	const color = colorRoleService.getColor(colorKey);
	if (!color) {
		await interaction.reply({ content: 'Onbekende kleur.', flags: 64 });
		return;
	}

	const userColors = colorRoleService.getUserColors(interaction.guildId, interaction.user.id);
	const owned = userColors.owned.includes(colorKey);
	const price = colorRoleService.getColorRolePrice(interaction.guildId);
	const coins = getCoinBalance(coinsFile, interaction.guildId, interaction.user.id);

	const embed = new EmbedBuilder()
		.setColor(color.hex)
		.setTitle(`${color.emoji} ${color.name}`)
		.setDescription(owned
			? (userColors.active === colorKey
				? 'Dit is al je actieve kleur.'
				: 'Je bezit deze kleur al — wisselen is **gratis**.')
			: `Prijs: **${price} coins** (je hebt er ${coins}). Eenmaal gekocht is wisselen naar deze kleur altijd gratis.`);

	const row = new ActionRowBuilder().addComponents(
		new ButtonBuilder()
			.setCustomId(`shop:color:confirm:${colorKey}`)
			.setLabel(owned ? 'Wissel naar deze kleur' : `Koop voor ${price} coins`)
			.setStyle(owned ? ButtonStyle.Success : ButtonStyle.Primary)
			.setDisabled(userColors.active === colorKey),
		new ButtonBuilder().setCustomId('shop:cat:roles').setLabel('Terug').setStyle(ButtonStyle.Secondary),
	);

	await interaction.update({ embeds: [embed], components: [row, navRow('roles')] }).catch(() => null);
}

async function handleColorConfirm(interaction, colorKey) {
	const color = colorRoleService.getColor(colorKey);
	if (!color) {
		await interaction.reply({ content: 'Onbekende kleur.', flags: 64 });
		return;
	}

	if (!isEconomyEnabled(interaction.guildId, crownsConfigFile)) {
		await interaction.reply({ content: 'Het economy-systeem staat uit.', flags: 64 });
		return;
	}

	const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
	if (!member) {
		await interaction.reply({ content: 'Kon je lidmaatschap niet ophalen.', flags: 64 });
		return;
	}

	const userColors = colorRoleService.getUserColors(interaction.guildId, interaction.user.id);
	const owned = userColors.owned.includes(colorKey);
	const price = colorRoleService.getColorRolePrice(interaction.guildId);

	if (!owned) {
		const balance = getCoinBalance(coinsFile, interaction.guildId, interaction.user.id);
		if (balance < price) {
			await interaction.reply({ content: `Je hebt ${price} coins nodig maar hebt er ${balance}.`, flags: 64 });
			return;
		}
		subtractCoinBalance(coinsFile, interaction.guildId, interaction.user.id, price);
	}

	const result = await colorRoleService.activateColor(interaction.guild, member, colorKey);
	if (result.error) {
		if (!owned) addCoinBalance(coinsFile, interaction.guildId, interaction.user.id, price);
		await interaction.reply({ content: `❌ ${result.error}${owned ? '' : ' Je coins zijn teruggestort.'}`, flags: 64 });
		return;
	}

	const screen = buildRolesScreen(interaction);
	screen.embeds.unshift(new EmbedBuilder()
		.setColor(color.hex)
		.setDescription(owned
			? `✅ Gewisseld naar ${color.emoji} **${color.name}** (gratis).`
			: `✅ ${color.emoji} **${color.name}** gekocht voor ${price} coins en geactiveerd!`));
	await interaction.update(screen).catch(() => null);
}

async function buyCrowns(interaction, amount) {
	if (!isEconomyEnabled(interaction.guildId, crownsConfigFile)) {
		await interaction.reply({ content: 'Het economy-systeem staat uit.', flags: 64 });
		return;
	}
	if (!Number.isInteger(amount) || amount <= 0 || amount > 100000) {
		await interaction.reply({ content: 'Geef een geldig aantal kroontjes op (1-100000).', flags: 64 });
		return;
	}

	const settings = getSettings(interaction.guildId);
	const coinsPerCrown = settings.crownshop?.coinsPerCrown ?? 100;
	const cost = amount * coinsPerCrown;
	const balance = getCoinBalance(coinsFile, interaction.guildId, interaction.user.id);
	if (balance < cost) {
		await interaction.reply({ content: `Je hebt ${cost} coins nodig voor ${amount} kroontjes, maar je hebt er ${balance}.`, flags: 64 });
		return;
	}

	subtractCoinBalance(coinsFile, interaction.guildId, interaction.user.id, cost);
	addCrownBalance(crownsFile, interaction.guildId, interaction.user.id, amount);
	const newCrowns = getCrownBalance(crownsFile, interaction.guildId, interaction.user.id);
	const newCoins = getCoinBalance(coinsFile, interaction.guildId, interaction.user.id);
	await interaction.reply({
		content: `👑 Je hebt **${amount} kroontjes** gekocht voor ${cost} coins. Je hebt nu ${newCrowns} kroontjes en ${newCoins} coins.`,
		flags: 64,
	});
}

function buildAmountModal(customId, title, label) {
	return new ModalBuilder()
		.setCustomId(customId)
		.setTitle(title)
		.addComponents(new ActionRowBuilder().addComponents(
			new TextInputBuilder()
				.setCustomId('amount')
				.setLabel(label)
				.setStyle(TextInputStyle.Short)
				.setPlaceholder('Bijv. 25')
				.setRequired(true),
		));
}

function parseAmount(interaction) {
	const raw = interaction.fields.getTextInputValue('amount');
	const n = Number.parseInt(raw, 10);
	return Number.isInteger(n) && n > 0 ? n : null;
}

async function dispatch(interaction) {
	const id = interaction.customId || '';

	if (id.startsWith('shop:')) {
		if (interaction.isButton()) {
			if (id === 'shop:cat:home') { await interaction.update(buildHome(interaction)).catch(() => null); return true; }
			if (id === 'shop:cat:roles') { await interaction.update(buildRolesScreen(interaction)).catch(() => null); return true; }
			if (id === 'shop:cat:upgrades') { await interaction.update(buildUpgradesScreen(interaction)).catch(() => null); return true; }
			if (id === 'shop:cat:crowns') { await interaction.update(buildCrownsScreen(interaction)).catch(() => null); return true; }
			if (id.startsWith('shop:color:confirm:')) { await handleColorConfirm(interaction, id.split(':')[3]); return true; }
			if (id.startsWith('shop:buy:')) {
				const item = findItem(interaction.guildId, id.slice(9));
				if (!item) { await interaction.reply({ content: 'Item niet gevonden.', flags: 64 }); return true; }
				await purchaseShopItem(interaction, item);
				return true;
			}
			if (id.startsWith('shop:crowns:buy:')) { await buyCrowns(interaction, Number.parseInt(id.split(':')[3], 10)); return true; }
			if (id === 'shop:crowns:custom') {
				await interaction.showModal(buildAmountModal('shop:modal:crownsAmount', 'Kroontjes kopen', 'Hoeveel kroontjes wil je kopen?'));
				return true;
			}
			if (id === 'shop:crowns:save') {
				await interaction.showModal(buildAmountModal('shop:modal:saveAmount', 'Counting saves kopen', 'Hoeveel saves wil je kopen?'));
				return true;
			}
		}
		if (interaction.isStringSelectMenu() && id === 'shop:color:pick') {
			await handleColorPick(interaction);
			return true;
		}
		if (interaction.isModalSubmit()) {
			if (id === 'shop:modal:crownsAmount') {
				const amount = parseAmount(interaction);
				if (!amount) { await interaction.reply({ content: 'Geef een geldig positief getal op.', flags: 64 }); return true; }
				await buyCrowns(interaction, amount);
				return true;
			}
			if (id === 'shop:modal:saveAmount') {
				const amount = parseAmount(interaction);
				if (!amount) { await interaction.reply({ content: 'Geef een geldig positief getal op.', flags: 64 }); return true; }
				await crownshopCommand.buySaves(interaction, amount);
				return true;
			}
		}
		return true;
	}

	if (id.startsWith('crownshop:')) {
		if (interaction.isButton()) {
			if (id === 'crownshop:buyxp') {
				await interaction.showModal(buildAmountModal('crownshop:modal:xp', 'XP kopen', 'Hoeveel XP wil je kopen?'));
				return true;
			}
			if (id === 'crownshop:buysaves') {
				await interaction.showModal(buildAmountModal('crownshop:modal:saves', 'Saves kopen', 'Hoeveel saves wil je kopen?'));
				return true;
			}
		}
		if (interaction.isModalSubmit()) {
			if (id === 'crownshop:modal:xp') {
				const amount = parseAmount(interaction);
				if (!amount) { await interaction.reply({ content: 'Geef een geldig positief getal op.', flags: 64 }); return true; }
				await crownshopCommand.buyXp(interaction, amount);
				return true;
			}
			if (id === 'crownshop:modal:saves') {
				const amount = parseAmount(interaction);
				if (!amount) { await interaction.reply({ content: 'Geef een geldig positief getal op.', flags: 64 }); return true; }
				await crownshopCommand.buySaves(interaction, amount);
				return true;
			}
		}
		return true;
	}

	return false;
}

module.exports = {
	buildHome,
	purchaseShopItem,
	dispatch,
};
