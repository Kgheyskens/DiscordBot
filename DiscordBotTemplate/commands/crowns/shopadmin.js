const {
	EmbedBuilder,
	PermissionFlagsBits,
	SlashCommandBuilder,
} = require('discord.js');
const { listItems, addItem, removeItem } = require('../../lib/shopService');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('shopadmin')
		.setDescription('Beheer shop-items (admin)')
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.setDMPermission(false)
		.addSubcommand(sub => sub.setName('list').setDescription('Bekijk alle items met hun ID'))
		.addSubcommand(sub =>
			sub.setName('add')
				.setDescription('Voeg een item toe')
				.addStringOption(opt => opt.setName('type').setDescription('Type item').addChoices(
					{ name: 'role', value: 'role' },
					{ name: 'xp', value: 'xp' },
					{ name: 'custom', value: 'custom' },
				).setRequired(true))
				.addStringOption(opt => opt.setName('name').setDescription('Naam in de shop').setRequired(true))
				.addIntegerOption(opt => opt.setName('price').setDescription('Prijs in coins').setMinValue(1).setRequired(true))
				.addRoleOption(opt => opt.setName('role').setDescription('Bij type=role: welke rol'))
				.addIntegerOption(opt => opt.setName('xp').setDescription('Bij type=xp: hoeveel XP').setMinValue(1))
				.addStringOption(opt => opt.setName('description').setDescription('Korte omschrijving (optioneel)')))
		.addSubcommand(sub =>
			sub.setName('remove')
				.setDescription('Verwijder een item')
				.addStringOption(opt => opt.setName('item_id').setDescription('Het item ID uit /shopadmin list').setRequired(true))),
	async execute(interaction) {
		if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
			await interaction.reply({ content: 'Alleen admins mogen de shop beheren.', flags: 64 });
			return;
		}

		const subcommand = interaction.options.getSubcommand();

		if (subcommand === 'list') {
			const items = listItems(interaction.guildId);
			if (items.length === 0) {
				await interaction.reply({ content: 'De shop is leeg.', flags: 64 });
				return;
			}
			const lines = items.map(item => `**${item.name}** — ${item.price} ${item.currency || 'coins'} • type \`${item.type}\` • ID \`${item.id}\``);
			const embed = new EmbedBuilder()
				.setColor(0xb40f0f)
				.setTitle('Shop items')
				.setDescription(lines.join('\n').slice(0, 4000));
			await interaction.reply({ embeds: [embed], flags: 64 });
			return;
		}

		if (subcommand === 'add') {
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
