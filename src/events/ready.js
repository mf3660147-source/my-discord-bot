const { SlashCommandBuilder, REST, Routes } = require('discord.js');
const db = require('../config/database');

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

        const commands = [
            new SlashCommandBuilder()
                .setName('attendance-leaderboard')
                .setDescription('Shows the staff attendance leaderboard')
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
