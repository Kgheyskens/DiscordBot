const { PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const { setEconomy, getSettings } = require('../../lib/guildSettings');

const FIELD_RANGES = {
	enabled: { type: 'bool' },
	crownSpawnChance: { min: 1, max: 100 },
	workMin: { min: 1, max: 1_000_000 },
	workMax: { min: 1, max: 1_000_000 },
	workCooldownMinutes: { min: 1, max: 10080 },
	dailyMin: { min: 1, max: 1_000_000 },
	dailyMax: { min: 1, max: 1_000_000 },
	dailyCooldownHours: { min: 1, max: 720 },
	payTaxPercent: { min: 0, max: 100 },
	robSuccessChance: { min: 0, max: 100 },
	robMaxStealPercent: { min: 1, max: 100 },
	robCooldownHours: { min: 1, max: 168 },
	robFailFeePercent: { min: 0, max: 100 },
	robMinVictimBalance: { min: 1, max: 1_000_000 },
};

module.exports = {
	data: new SlashCommandBuilder()
		.setName('setup-economy')
		.setDescription('Stel een economy waarde direct in')
		.setDMPermission(false)
		.addStringOption(opt =>
			opt.setName('field').setDescription('Welk veld?').setRequired(true)
				.addChoices(...Object.keys(FIELD_RANGES).map(f => ({ name: f, value: f }))))
		.addStringOption(opt =>
			opt.setName('value').setDescription('Nieuwe waarde (true/false voor enabled)').setRequired(true)),
	async execute(interaction) {
		if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
			await interaction.reply({ content: 'Alleen admins.', flags: 64 });
			return;
		}

		const field = interaction.options.getString('field');
		const rawValue = interaction.options.getString('value').trim();
		const range = FIELD_RANGES[field];
		const current = getSettings(interaction.guildId).economy;

		let newValue;
		if (range.type === 'bool') {
			if (!['true', 'false', '1', '0', 'aan', 'uit'].includes(rawValue.toLowerCase())) {
				await interaction.reply({ content: 'Gebruik true/false.', flags: 64 });
				return;
			}
			newValue = ['true', '1', 'aan'].includes(rawValue.toLowerCase());
		} else {
			const num = parseInt(rawValue, 10);
			if (Number.isNaN(num) || num < range.min || num > range.max) {
				await interaction.reply({ content: `Geef een getal tussen ${range.min} en ${range.max}.`, flags: 64 });
				return;
			}
			newValue = num;
		}

		setEconomy(interaction.guildId, { [field]: newValue });
		await interaction.reply({ content: `**${field}** ingesteld op \`${newValue}\` (was \`${current[field]}\`).`, flags: 64 });
	},
};
