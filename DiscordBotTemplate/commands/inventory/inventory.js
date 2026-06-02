const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { getInventory, consumeItem } = require('../../lib/inventoryService');
const { activateEffect, getActiveEffects, EFFECTS } = require('../../lib/effectService');

const CONSUMABLE_LABELS = {
	xpBooster: '⚡ XP Booster (2x XP, 1u)',
	luckyCharm: '🍀 Lucky Charm (+20% rob succes, 1u)',
};

const USE_CHOICES = Object.keys(CONSUMABLE_LABELS).map(key => ({ name: CONSUMABLE_LABELS[key].slice(0, 100), value: key }));

function formatExpiry(expiresAt) {
	if (!expiresAt) return null;
	const ms = expiresAt - Date.now();
	if (ms <= 0) return null;
	const min = Math.floor(ms / 60_000);
	if (min < 60) return `${min}m`;
	const h = Math.floor(min / 60);
	return `${h}u ${min % 60}m`;
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('inventory')
		.setDescription('Bekijk of gebruik je items')
		.addSubcommand(sub => sub.setName('view').setDescription('Bekijk je inventory'))
		.addSubcommand(sub =>
			sub.setName('use')
				.setDescription('Gebruik een consumable')
				.addStringOption(opt =>
					opt.setName('item')
						.setDescription('Welk item')
						.addChoices(...USE_CHOICES)
						.setRequired(true))),
	async execute(interaction) {
		const sub = interaction.options.getSubcommand();
		if (sub === 'view') {
			const inv = getInventory(interaction.guildId, interaction.user.id);
			const active = getActiveEffects(interaction.guildId, interaction.user.id);

			const lines = [];
			for (const [key, label] of Object.entries(CONSUMABLE_LABELS)) {
				const count = inv[key] || 0;
				const exp = formatExpiry(active[key]);
				lines.push(`${label}: **${count}**${exp ? ` _(actief: nog ${exp})_` : ''}`);
			}

			// Custom items (other inventory keys not in CONSUMABLE_LABELS)
			for (const [key, count] of Object.entries(inv)) {
				if (CONSUMABLE_LABELS[key]) continue;
				lines.push(`📦 ${key}: **${count}**`);
			}

			const embed = new EmbedBuilder()
				.setColor(0xb40f0f)
				.setTitle(`📦 Inventory — ${interaction.user.username}`)
				.setDescription(lines.join('\n') || '_Je inventory is leeg. Koop items in de /shop._');

			await interaction.reply({ embeds: [embed], flags: 64 });
			return;
		}

		if (sub === 'use') {
			const key = interaction.options.getString('item');
			if (!EFFECTS[key]) {
				await interaction.reply({ content: '❌ Onbekend item.', flags: 64 });
				return;
			}
			const result = consumeItem(interaction.guildId, interaction.user.id, key, 1);
			if (result.error) {
				await interaction.reply({ content: `❌ ${result.error}`, flags: 64 });
				return;
			}
			const activation = activateEffect(interaction.guildId, interaction.user.id, key);
			const exp = formatExpiry(activation.expiresAt);
			await interaction.reply({
				content: `✅ ${CONSUMABLE_LABELS[key]} geactiveerd! Effect duurt nog **${exp}**.`,
				flags: 64,
			});
		}
	},
};
