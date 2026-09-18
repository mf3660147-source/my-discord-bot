const { SlashCommandBuilder, REST, Routes } = require('discord.js');
const db = require('../config/database');
const { startExpiryWorker } = require('../commands/slash/sampBan');

module.exports = function (client) {
    client.once('ready', async () => {
        console.log(`Logged in as ${client.user.tag}! Bot is ONLINE!`);

        // Test MySQL database connection
        try {
            const [rows] = await db.query('SELECT 1');
            console.log('✅ MySQL Database connected successfully!');
        } catch (dbErr) {
            console.error('❌ MySQL Database connection failed:', dbErr.message);
        }

        startExpiryWorker(client);

        const commands = [
            new SlashCommandBuilder()
                .setName('attendance-leaderboard')
                .setDescription('Shows the staff attendance leaderboard'),
            new SlashCommandBuilder()
                .setName('sampban')
                .setDescription('Ban a SAMP player through the database')
                .addStringOption(o => o.setName('player').setDescription('Exact in-game username').setRequired(true))
                .addStringOption(o => o.setName('reason').setDescription('Ban reason').setRequired(true))
                .addStringOption(o => o.setName('ticket').setDescription('Ticket number/reference').setRequired(true))
                .addIntegerOption(o => o.setName('days').setDescription('Ban duration in days (use 0 if not needed)').setMinValue(0).setRequired(true))
                .addIntegerOption(o => o.setName('hours').setDescription('Ban duration in hours (use 0 if not needed)').setMinValue(0).setRequired(true))
                .addIntegerOption(o => o.setName('minutes').setDescription('Ban duration in minutes (use 0 if not needed)').setMinValue(0).setRequired(true)),
            new SlashCommandBuilder()
                .setName('sampunban')
                .setDescription('Remove a SAMP player ban')
                .addStringOption(o => o.setName('player').setDescription('Exact in-game username').setRequired(true))
                .addStringOption(o => o.setName('reason').setDescription('Unban reason').setRequired(false)),
            new SlashCommandBuilder()
                .setName('changename')
                .setDescription('Change your own in-game name')
                .addStringOption(o =>
                o.setName('new_name')
                .setDescription('New name (Firstname_Lastname)')
                .setRequired(true)
    )
        ];

        if (!process.env.GUILD_ID) {
            console.error('❌ GUILD_ID is missing. Add CLIENT_ID and GUILD_ID in Render Environment Variables.');
            return;
        }

        const applicationId = process.env.CLIENT_ID || client.user.id;
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        try {
            // Remove only old GLOBAL sampban/sampunban commands.
            // Other existing global commands are preserved.
            const globalCommands = await rest.get(Routes.applicationCommands(applicationId));
            for (const command of globalCommands) {
                if (command.name === 'sampban' || command.name === 'sampunban') {
                    await rest.delete(Routes.applicationCommand(applicationId, command.id));
                    console.log(`🧹 Removed old global command: /${command.name}`);
                }
            }

            // Register the current command list in this server.
            // Guild registration replaces old duplicate guild commands.
            await rest.put(
                Routes.applicationGuildCommands(applicationId, process.env.GUILD_ID),
                { body: commands }
            );
            console.log('✅ Guild slash commands registered: /sampban and /sampunban');
            console.log('ℹ️ Ban logs include the admin who used the command.');
        } catch (error) {
            console.error('Slash Command Error:', error);
        }
    });
};
