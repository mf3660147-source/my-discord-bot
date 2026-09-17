const { EmbedBuilder } = require('discord.js');
const db = require('../../config/database');
const { hasAdminAccess } = require('../../utils/permissions');
const { SAMP_BAN_LOG_CHANNEL_ID, SAMP_UNBAN_LOG_CHANNEL_ID } = require('../../config/constants');

function parseDurationParts(days, hours, minutes) {
    const d = Number(days);
    const h = Number(hours);
    const m = Number(minutes);

    if (![d, h, m].every(Number.isInteger) || d < 0 || h < 0 || m < 0) {
        return undefined;
    }

    const totalMinutes = (d * 24 * 60) + (h * 60) + m;
    if (totalMinutes <= 0) return undefined;

    return new Date(Date.now() + totalMinutes * 60 * 1000);
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
    const ticketNumber = interaction.options.getString('ticket').trim();
    const days = interaction.options.getInteger('days');
    const hours = interaction.options.getInteger('hours');
    const minutes = interaction.options.getInteger('minutes');
    const expires = parseDurationParts(days, hours, minutes);

    if (expires === undefined) {
        return interaction.reply({ content: 'Invalid duration. Enter a total duration greater than 0 using days, hours, or minutes.', ephemeral: true });
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
        const bannedAt = new Date();
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

        const bannedAtText = `<t:${Math.floor(bannedAt.getTime() / 1000)}:F>`;
        const expiryText = expires ? `<t:${Math.floor(expires.getTime() / 1000)}:F>` : 'Permanent';
        await sendLog(
            interaction,
            SAMP_BAN_LOG_CHANNEL_ID,
            'SAMP Ban Activity',
            `**Player:** ${user.username}\n**Admin:** ${interaction.user.tag}\n**Ticket:** ${ticketNumber}\n**Reason:** ${reason}\n**Banned At:** ${bannedAtText}\n**Expires:** ${expiryText}`,
            0xE74C3C
        );

        return interaction.reply({
            content: `✅ **${user.username}** was added to the SAMP ban database.\nTicket: **${ticketNumber}**\nBanned At: **${bannedAt.toISOString()}**\nExpiry: **${expires ? expires.toISOString() : 'Permanent'}**.`,
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

        const unbannedAtText = `<t:${Math.floor(Date.now() / 1000)}:F>`;
        await sendLog(
            interaction,
            SAMP_UNBAN_LOG_CHANNEL_ID,
            'SAMP Unban Activity',
            `**Player:** ${username}\n**Unban Admin:** ${interaction.user.tag}\n**Unban Reason:** ${reason}\n**Unbanned At:** ${unbannedAtText}`,
            0x2ECC71
        );

        return interaction.reply({ content: `✅ **${username}** was unbanned.`, ephemeral: true });
    } catch (error) {
        console.error('SAMP unban error:', error);
        return interaction.reply({ content: 'Database error while removing the ban.', ephemeral: true });
    }
}

async function removeExpiredBans(client) {
    try {
        // Read expired bans first so each automatic unban can be logged with its details.
        const [expiredBans] = await db.execute(
            `SELECT username, bannedby, reason, ticket_number, date, expires_at
             FROM bans
             WHERE permanent = 0 AND expires_at IS NOT NULL AND expires_at <= NOW()`
        );

        if (!expiredBans.length) return;

        await db.execute(
            'DELETE FROM bans WHERE permanent = 0 AND expires_at IS NOT NULL AND expires_at <= NOW()'
        );

        for (const ban of expiredBans) {
            const unbannedAtText = `<t:${Math.floor(Date.now() / 1000)}:F>`;

            if (client) {
                const channel = await client.channels.fetch(SAMP_UNBAN_LOG_CHANNEL_ID).catch(() => null);
                if (channel && channel.isTextBased()) {
                    const embed = new EmbedBuilder()
                        .setTitle('Automatic SAMP Unban (Expiry)')
                        .setDescription(
                            `**Player:** ${ban.username}\n` +
                            `**Unban Admin:** BOT\n` +
                            `**Unban Reason:** Automatic Expiry\n` +
                            `**Unbanned At:** ${unbannedAtText}`
                        )
                        .setColor(0x2ECC71)
                        .setTimestamp();
                    await channel.send({ embeds: [embed] }).catch(console.error);
                }
            }

            console.log(`Auto-unbanned expired SAMP ban for ${ban.username}.`);
        }
    } catch (error) {
        console.error('Automatic SAMP unban error:', error.message);
    }
}

function startExpiryWorker(client) {
    removeExpiredBans(client);
    setInterval(() => removeExpiredBans(client), 60 * 1000);
}

module.exports = { handleSampBan, handleSampUnban, startExpiryWorker };
