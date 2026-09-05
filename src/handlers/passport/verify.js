const { EmbedBuilder } = require('discord.js');
const db = require('../../config/database');
const { CITIZEN_ROLE_ID, PASSPORT_APPROVED_ROLE_ID, PASSPORT_LOG_CHANNEL_ID } = require('../../config/constants');

module.exports = async function handlePassportVerify(message) {
    // Only citizens with the required role can use this
    if (!message.member.roles.cache.has(CITIZEN_ROLE_ID)) return;

    const igName = message.content.trim();

    // Strict name format validation: Firstname_Lastname (uppercase start, letters only, no numbers/symbols)
    const nameRegex = /^[A-Z][a-z]+_[A-Z][a-z]+$/;
    if (!igName || !nameRegex.test(igName)) {
        await message.react('❌');
        return message.reply('❌ Invalid name format!\n\n✅ Correct: `Oggy_Ftw`, `Itz_Thor`\n❌ Wrong: `oggy_ftw`, `OGGY_FTW`, `Oggy123_Ftw`, `Oggy Ftw`\n\nName must be **Firstname_Lastname** — each part starting with a **capital letter**, **letters only**, no numbers or symbols.');
    }

    try {
        const [rows] = await db.query('SELECT username, locked FROM users WHERE username = ?', [igName]);

        if (rows.length === 0) {
            // Account not found in the database
            await message.react('⚠️');
            return message.reply(`⚠️ **${igName}** is not registered in-game. Please register first!`);
        }

        const user = rows[0];

        if (user.locked === 0) {
            // Account exists but locked is 0 — already used/taken
            await message.react('🔒');
            return message.reply(`🔒 **${igName}** is already in use. If this is your account, contact staff.`);
        }

        // locked === 1 → Approve: set locked to 0
        await db.query('UPDATE users SET locked = 0 WHERE username = ?', [igName]);

        // Give the approved role and remove citizen role
        const approvedRole = message.guild.roles.cache.get(PASSPORT_APPROVED_ROLE_ID);
        if (approvedRole) {
            await message.member.roles.add(approvedRole).catch(err => console.error('Role Add Error:', err));
        }
        const citizenRole = message.guild.roles.cache.get(CITIZEN_ROLE_ID);
        if (citizenRole) {
            await message.member.roles.remove(citizenRole).catch(err => console.error('Role Remove Error:', err));
        }

        // Set nickname to IG name
        await message.member.setNickname(igName).catch(err => console.error('Nickname Error:', err));

        // React with checkmark
        await message.react('✅');

        // Post approval to the log channel
        const logChannel = await message.guild.channels.fetch(PASSPORT_LOG_CHANNEL_ID).catch(() => null);
        if (logChannel) {
            const approvalEmbed = new EmbedBuilder()
                .setTitle('✅ Passport Approved')
                .setColor('#22c55e')
                .addFields(
                    { name: '👤 Discord User', value: `<@${message.author.id}>`, inline: true },
                    { name: '🎮 IG Name', value: `\`${igName}\``, inline: true }
                )
                .setFooter({ text: 'ONE PEACE ROLEPLAY • Passport System' })
                .setTimestamp();

            await logChannel.send({
                content: `<@${message.author.id}> your passport has been approved! Enjoy your RP 🎉`,
                embeds: [approvalEmbed]
            });
        }

    } catch (dbErr) {
        console.error('Passport DB Error:', dbErr);
        await message.reply('❌ An error occurred while verifying your IG name. Please try again later.');
    }
};