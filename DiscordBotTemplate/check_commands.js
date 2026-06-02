require('dotenv').config();
const { REST, Routes } = require('discord.js');
const rest = new REST().setToken(process.env.CLIENT_TOKEN);

(async () => {
    const guildId = (process.env.DEV_GUILD_IDS || '').split(',')[0]?.trim();
    if (!guildId) return;
    
    const commands = await rest.get(Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId));
    console.log('✅ Total commands: ' + commands.length);
    const newOnes = ['profile', 'leaderboard', 'confess', 'birthday', 'remind', 'stats', 'warn', 'warnings', 'clearwarnings'];
    const found = commands.filter(c => newOnes.includes(c.name));
    console.log('📋 New commands found: ' + found.length);
    found.forEach(c => console.log('   ✓ /' + c.name));
    process.exit(0);
})();
