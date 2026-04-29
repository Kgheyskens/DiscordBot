const path = require('path');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { readJson, writeJson } = require('../../lib/jsonStore');

const levelsFile = path.join(__dirname, '..', '..', 'data', 'levels.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resetxp')
    .setDescription('Reset XP en level van een gebruiker (admin only)')
    .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true)),
  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: 'Alleen administrators kunnen dit doen.', flags: 64 });
      return;
    }

    const target = interaction.options.getUser('user');
    if (!target) {
      await interaction.reply({ content: 'Geen geldige gebruiker opgegeven.', flags: 64 });
      return;
    }

    try {
      const allLevels = readJson(levelsFile, {});
      const guildLevels = allLevels[interaction.guildId] || {};
      guildLevels[target.id] = { xp: 0, level: 0, lastMessageAt: 0 };
      allLevels[interaction.guildId] = guildLevels;
      writeJson(levelsFile, allLevels);
      await interaction.reply({ content: `XP en level van ${target.tag} zijn gereset.`, flags: 64 });
    } catch (err) {
      console.error('resetxp failed:', err);
      await interaction.reply({ content: 'Kon XP niet resetten.', flags: 64 });
    }
  },
};
