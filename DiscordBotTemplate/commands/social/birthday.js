const { SlashCommandBuilder } = require('discord.js');
const birthdayService = require('../../lib/birthdayService');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('birthday')
		.setDescription('Set your birthday')
		.addStringOption(opt =>
			opt.setName('date')
				.setDescription('Your birthday in DDMM format (e.g., 0512 for May 12)')
				.setRequired(true)),
	async execute(interaction) {
		const dateStr = interaction.options.getString('date');

		if (!/^\d{4}$/.test(dateStr)) {
			await interaction.reply({ content: '❌ Invalid format. Use DDMM (e.g., 0512).', flags: 64 });
			return;
		}

		const dd = parseInt(dateStr.slice(0, 2), 10);
		const mm = parseInt(dateStr.slice(2, 4), 10);

		if (dd < 1 || dd > 31 || mm < 1 || mm > 12) {
			await interaction.reply({ content: '❌ Invalid date. Day must be 01-31, month 01-12.', flags: 64 });
			return;
		}

		try {
			birthdayService.setBirthday(interaction.guildId, interaction.user.id, dateStr);
			await interaction.reply({
				content: `✅ Birthday set to **${dd}/${mm}**! You'll get a notification on your birthday.`,
				flags: 64,
			});
		} catch (err) {
			await interaction.reply({ content: `❌ Error: ${err.message}`, flags: 64 });
		}
	},
};
