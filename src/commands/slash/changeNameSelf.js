const db = require('../../config/database');
const { EmbedBuilder } = require('discord.js');
const { NC_ACCEPT_LOG_CHANNEL_ID } = require('../../config/constants');

const NAME_RE = /^[A-Za-z0-9_]{3,24}$/;
const PRICE_PER_LEVEL = 100000;

module.exports = async function handleSelfNameChange(interaction) {
    const newName = interaction.options.getString('new_name', true).trim();
    if (!NAME_RE.test(newName) || !newName.includes('_')) {
        return interaction.reply({ content: '❌ Name must be 3–24 characters, use letters/numbers/underscore, and contain `_` (Firstname_Lastname).', ephemeral: true });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [players] = await connection.execute(
            'SELECT uid, username, level, cash, discordid FROM users WHERE discordid = ? LIMIT 1 FOR UPDATE',
            [interaction.user.id]
        );
        if (!players.length) {
            await connection.rollback();
            return interaction.reply({ content: '❌ Your Discord account is not linked to an in-game account.', ephemeral: true });
        }

        const player = players[0];
        const oldName = player.username;
        const level = Math.max(0, Number(player.level) || 0);
        const fee = level * PRICE_PER_LEVEL;
        const cash = Number(player.cash) || 0;

        if (oldName.toLowerCase() === newName.toLowerCase()) {
            await connection.rollback();
            return interaction.reply({ content: '❌ Your new name must be different from your current name.', ephemeral: true });
        }
        if (cash < fee) {
            await connection.rollback();
            return interaction.reply({ content: `❌ You need $${fee.toLocaleString()} but you only have $${cash.toLocaleString()}.`, ephemeral: true });
        }

        const [taken] = await connection.execute(
            'SELECT uid FROM users WHERE LOWER(username) = LOWER(?) AND uid <> ? LIMIT 1',
            [newName, player.uid]
        );
        if (taken.length) {
            await connection.rollback();
            return interaction.reply({ content: '❌ That in-game name is already taken.', ephemeral: true });
        }

        // Keep property ownership names synchronized with the existing Pawn Namechange() function.
        for (const table of ['houses', 'garages', 'businesses', 'vehicles', 'lands']) {
            await connection.execute(`UPDATE ${table} SET owner = ? WHERE owner = ?`, [newName, oldName]);
        }
        await connection.execute('UPDATE users SET username = ?, cash = cash - ? WHERE uid = ?', [newName, fee, player.uid]);
        await connection.commit();

        const embed = new EmbedBuilder()
            .setTitle('✅ Self Name Change Completed')
            .setColor('#22c55e')
            .addFields(
                { name: 'Discord User', value: `<@${interaction.user.id}>`, inline: false },
                { name: 'Old Name', value: `\`${oldName}\``, inline: true },
                { name: 'New Name', value: `\`${newName}\``, inline: true },
                { name: 'Level', value: String(level), inline: true },
                { name: 'Fee', value: `$${fee.toLocaleString()}`, inline: true },
                { name: 'UID', value: String(player.uid), inline: true }
            )
            .setTimestamp();

        const logChannel = await interaction.guild?.channels.fetch(NC_ACCEPT_LOG_CHANNEL_ID).catch(() => null);
        if (logChannel) await logChannel.send({ embeds: [embed] });

        return interaction.reply({
            content: `✅ Name changed successfully: **${oldName}** → **${newName}**\n💰 Fee charged: **$${fee.toLocaleString()}**\n\n⚠️ If you are currently online, reconnect to load the new name safely.`,
            ephemeral: true
        });
    } catch (error) {
        await connection.rollback().catch(() => {});
        console.error('Self name change error:', error);
        if (!interaction.replied && !interaction.deferred) {
            return interaction.reply({ content: '❌ Name change failed. Please try again later.', ephemeral: true });
        }
    } finally {
        connection.release();
    }
};
