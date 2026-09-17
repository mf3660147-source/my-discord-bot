const { EmbedBuilder } = require('discord.js');
const db = require('../../config/database');
const { hasAdminAccess } = require('../../utils/permissions');
const { SAMP_BAN_LOG_CHANNEL_ID, SAMP_UNBAN_LOG_CHANNEL_ID } = require('../../config/constants');

function parseDuration(value) {
    if (value === 'permanent') return null;
    const match = /^(\d+)\s*(m|h|d)$/.exec(String(value).trim().toLowerCase());
    if (!match) return undefined;
    const amount = Number(match[1]);
    const unit = match[2] === 'm' ? 60 * 1000 : (match[2] === 'h' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000);
    return new Date(Date.now() + amount * unit);
}

function sqlDate(date) {
    if (!date) return null;
    return date.toISOString().slice(0, 19).replace('T', ' ');
}

async function sendLog(interaction, channelId, title, description, color) {
    const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;
    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setTimestamp();
    await channel.send({ embeds: [embed] }).catch(console.error);
}

async function handleSampBan(interaction) {
    if (!hasAdminAccess(interaction.member)) {
        return interaction.reply({ content: 'You are not authorized to use this command.', ephemeral: true });
    }

    const username = interaction.options.getString('player').trim();
    const reason = interaction.options.getString('reason').trim();
    const duration = interaction.options.getString('duration').trim();
    const ticketNumber = interaction.options.getString('ticket').trim();
    const expires = parseDuration(duration);

    if (expires === undefined) {
        return interaction.reply({ content: 'Invalid duration.', ephemeral: true });
    }

    try {
        // BINARY makes the username comparison case-sensitive.
        const [users] = await db.execute(
            'SELECT username, ip FROM users WHERE BINARY username = BINARY ? LIMIT 1',
            [username]
        );

        if (!users.length) {
            return interaction.reply({ content: `Player **${username}** was not found in the users table.`, ephemeral: true });
        }

        const user = users[0];
        if (user.username !== username) {
            return interaction.reply({ content: 'Username must match the database username exactly, including capital letters and underscores.', ephemeral: true });
        }
        const permanent = expires === null ? 1 : 0;
        const expirySql = sqlDate(expires);

        await db.execute(
            `INSERT INTO bans (username, ip, bannedby, date, reason, ticket_number, permanent, expires_at)
             VALUES (?, ?, ?, NOW(), ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE reason = VALUES(reason), ticket_number = VALUES(ticket_number), bannedby = VALUES(bannedby),
             permanent = VALUES(permanent), expires_at = VALUES(expires_at), date = NOW()`,
            [user.username, user.ip || 'n/a', interaction.user.tag, reason, ticketNumber, permanent, expirySql]
        );

        const expiryText = expires ? `<t:${Math.floor(expires.getTime() / 1000)}:F>` : 'Permanent';
        await sendLog(
            interaction,
            SAMP_BAN_LOG_CHANNEL_ID,
            'SAMP Ban Activity',
            `**Player:** ${user.username}\n**IP:** ${user.ip || 'n/a'}\n**Admin:** ${interaction.user.tag}\n**Ticket:** ${ticketNumber}\n**Reason:** ${reason}\n**Expires:** ${expiryText}`,
            0xE74C3C
        );

        return interaction.reply({
            content: `✅ **${user.username}** was added to the SAMP ban database.\nTicket: **${ticketNumber}**\nExpiry: **${expires ? expires.toISOString() : 'Permanent'}**.`,
            ephemeral: true
        });
    } catch (error) {
        console.error('SAMP ban error:', error);
        return interaction.reply({ content: 'Database error while applying the ban.', ephemeral: true });
    }
}

async function handleSampUnban(interaction) {
    if (!hasAdminAccess(interaction.member)) {
        return interaction.reply({ content: 'You are not authorized to use this command.', ephemeral: true });
    }

    const username = interaction.options.getString('player').trim();
    const reason = interaction.options.getString('reason')?.trim() || 'No reason provided';

    try {
        const [result] = await db.execute('DELETE FROM bans WHERE username = ?', [username]);
        if (!result.affectedRows) {
            return interaction.reply({ content: `No active ban found for **${username}**.`, ephemeral: true });
        }

        await sendLog(
            interaction,
            SAMP_UNBAN_LOG_CHANNEL_ID,
            'SAMP Unban Activity',
            `**Player:** ${username}\n**Admin:** ${interaction.user.tag}\n**Reason:** ${reason}`,
            0x2ECC71
        );

        return interaction.reply({ content: `✅ **${username}** was unbanned.`, ephemeral: true });
    } catch (error) {
        console.error('SAMP unban error:', error);
        return interaction.reply({ content: 'Database error while removing the ban.', ephemeral: true });
    }
}

async function removeExpiredBans() {
    try {
        const [result] = await db.execute(
            'DELETE FROM bans WHERE permanent = 0 AND expires_at IS NOT NULL AND expires_at <= NOW()'
        );
        if (result.affectedRows) console.log(`Auto-unbanned ${result.affectedRows} expired SAMP ban(s).`);
    } catch (error) {
        console.error('Automatic SAMP unban error:', error.message);
    }
}

function startExpiryWorker() {
    removeExpiredBans();
    setInterval(removeExpiredBans, 60 * 1000);
}

module.exports = { handleSampBan, handleSampUnban, startExpiryWorker };
