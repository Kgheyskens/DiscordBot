const path = require('path');
const { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const { listItems, addItem, removeItem, findItem, purchaseItem } = require('../../lib/shopService');
const { addBalance } = require('../../lib/crownService');
const { processLevelGain } = require('../../lib/levelingService');
const { isEconomyEnabled } = require('../../lib/economyService');

const crownsFile = path.join(__dirname, '..', '..', 'data', 'crowns.json');
const crownsConfigFile = path.join(__dirname, '..', '..', 'data', 'crownsConfig.json');
const levelsFile = path.join(__dirname, '..', '..', 'data', 'levels.json');
const rewardsFile = path.join(__dirname, '..', '..', 'data', 'roleRewards.json');
const levelsChannelFile = path.join(__dirname, '..', '..', 'data', 'levelsChannel.json');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('shop')
		.setDescription('De server shop')
		.addSubcommand(sub => sub.setName('view').setDescription('Bekijk de shop'))
		.addSubcommand(sub =>
			sub.setName('buy')
				.setDescription('Koop een item')
				.addStringOption(opt => opt.setName('item_id').setDescription('Het item ID uit /shop view').setRequired(true)))
		.addSubcommand(sub =>
			sub.setName('add')
				.setDescription('Voeg een item toe (admin)')
				.addStringOption(opt => opt.setName('type').setDescription('Type item').addChoices(
					{ name: 'role', value: 'role' },
					{ name: 'xp', value: 'xp' },
					{ name: 'custom', value: 'custom' },
				).setRequired(true))
				.addStringOption(opt => opt.setName('name').setDescription('Naam in de shop').setRequired(true))
				.addIntegerOption(opt => opt.setName('price').setDescription('Prijs in kroontjes').setMinValue(1).setRequired(true))
				.addRoleOption(opt => opt.setName('role').setDescription('Bij type=role: welke rol'))
				.addIntegerOption(opt => opt.setName('xp').setDescription('Bij type=xp: hoeveel XP').setMinValue(1))
				.addStringOption(opt => opt.setName('description').setDescription('Korte omschrijving (optioneel)')))
		.addSubcommand(sub =>
			sub.setName('remove')
				.setDescription('Verwijder een item (admin)')
				.addStringOption(opt => opt.setName('item_id').setDescription('Het item ID').setRequired(true))),
	async execute(interaction) {
		const subcommand = interaction.options.getSubcommand();
		const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);

		if (subcommand === 'view') {
			const items = listItems(interaction.guildId);
			if (items.length === 0) {
				await interaction.reply({ content: 'De shop is leeg. Een admin kan items toevoegen met `/shop add`.', flags: 64 });
				return;
			}

			const lines = items.map(item => {
				const tag = item.type === 'role' ? `<@&${item.payload}>`
					: item.type === 'xp' ? `${item.payload} XP`
					: 'custom';
				return `**${item.name}** — ${item.price} kroontjes\nID: \`${item.id}\` • ${tag}${item.description ? `\n${item.description}` : ''}`;
			});

			const embed = new EmbedBuilder()
				.setColor(0xb40f0f)
				.setTitle('Shop')
				.setDescription(lines.join('\n\n'));
			await interaction.reply({ embeds: [embed] });
			return;
		}

		if (subcommand === 'buy') {
			if (!isEconomyEnabled(interaction.guildId, crownsConfigFile)) {
				await interaction.reply({ content: 'Het kroontjessysteem staat uit.', flags: 64 });
				return;
			}

			const itemId = interaction.options.getString('item_id');
			const item = findItem(interaction.guildId, itemId);
			if (!item) {
				await interaction.reply({ content: 'Item niet gevonden.', flags: 64 });
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

				const result = purchaseItem({ guildId: interaction.guildId, userId: interaction.user.id, itemId });
				if (result.error) {
					await interaction.reply({ content: result.error, flags: 64 });
					return;
				}

				const role = interaction.guild.roles.cache.get(item.payload) || await interaction.guild.roles.fetch(item.payload).catch(() => null);
				if (!role) {
					addBalance(crownsFile, interaction.guildId, interaction.user.id, item.price);
					await interaction.reply({ content: 'Rol bestaat niet meer. Aankoop teruggedraaid.', flags: 64 });
					return;
				}

				await member.roles.add(role).catch(() => null);
				await interaction.reply({ content: `Je hebt **${role.name}** gekocht voor ${item.price} kroontjes. Nieuwe balans: ${result.newBalance}.`, flags: 64 });
				return;
			}

			if (item.type === 'xp') {
				const result = purchaseItem({ guildId: interaction.guildId, userId: interaction.user.id, itemId });
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
					content: `Je hebt **${xpAmount} XP** gekocht voor ${item.price} kroontjes.${levelResult.leveledUp ? ` Je bent nu level ${levelResult.level}.` : ''} Nieuwe balans: ${result.newBalance}.`,
					flags: 64,
				});
				return;
			}

			const result = purchaseItem({ guildId: interaction.guildId, userId: interaction.user.id, itemId });
			if (result.error) {
				await interaction.reply({ content: result.error, flags: 64 });
				return;
			}
			await interaction.reply({ content: `Je hebt **${item.name}** gekocht voor ${item.price} kroontjes. ${item.description || ''} Nieuwe balans: ${result.newBalance}.`, flags: 64 });
			return;
		}

		if (subcommand === 'add') {
			if (!isAdmin) {
				await interaction.reply({ content: 'Alleen admins mogen items toevoegen.', flags: 64 });
				return;
			}

			const type = interaction.options.getString('type');
			const name = interaction.options.getString('name');
			const price = interaction.options.getInteger('price');
			const role = interaction.options.getRole('role');
			const xp = interaction.options.getInteger('xp');
			const description = interaction.options.getString('description') || '';

			let payload = null;
			if (type === 'role') payload = role?.id;
			else if (type === 'xp') payload = xp;
			else payload = description || name;

			const result = addItem(interaction.guildId, { type, name, price, payload, description });
			if (result.error) {
				await interaction.reply({ content: result.error, flags: 64 });
				return;
			}
			await interaction.reply({ content: `Item toegevoegd: **${result.item.name}** (ID \`${result.item.id}\`).`, flags: 64 });
			return;
		}

		if (subcommand === 'remove') {
			if (!isAdmin) {
				await interaction.reply({ content: 'Alleen admins mogen items verwijderen.', flags: 64 });
				return;
			}

			const itemId = interaction.options.getString('item_id');
			const result = removeItem(interaction.guildId, itemId);
			if (result.error) {
				await interaction.reply({ content: result.error, flags: 64 });
				return;
			}
			await interaction.reply({ content: `Item **${result.item.name}** verwijderd.`, flags: 64 });
		}
	},
};
