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

        startExpiryWorker();

        const commands = [
            new SlashCommandBuilder()
                .setName('attendance-leaderboard')
                .setDescription('Shows the staff attendance leaderboard'),
            new SlashCommandBuilder()
                .setName('sampban')
                .setDescription('Ban a SAMP player through the database')
                .addStringOption(o => o.setName('player').setDescription('Exact in-game username').setRequired(true))
                .addStringOption(o => o.setName('reason').setDescription('Ban reason').setRequired(true))
                .addStringOption(o => o.setName('duration').setDescription('Ban duration').setRequired(true)
                    .addChoices(
                        { name: '1 hour', value: '1h' },
                        { name: '6 hours', value: '6h' },
                        { name: '1 day', value: '1d' },
                        { name: '7 days', value: '7d' },
                        { name: '30 days', value: '30d' },
                        { name: 'Permanent', value: 'permanent' }
                    )),
            new SlashCommandBuilder()
                .setName('sampunban')
                .setDescription('Remove a SAMP player ban')
                .addStringOption(o => o.setName('player').setDescription('Exact in-game username').setRequired(true))
                .addStringOption(o => o.setName('reason').setDescription('Unban reason').setRequired(false))
        ];

        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        try {
            await rest.put(
                Routes.applicationCommands(client.user.id),
                { body: commands }
            );
            console.log('Attendance Slash commands registered successfully!');
        } catch (error) {
            console.error('Slash Command Error:', error);
        }
    });
};
