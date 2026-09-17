const {
    EmbedBuilder,
    AttachmentBuilder
} = require('discord.js');

const { createCanvas, loadImage } = require('@napi-rs/canvas');
const path = require('path');
const fs = require('fs');

const db = require('../../config/database');
const {
    CITIZEN_ROLE_ID,
    PASSPORT_APPROVED_ROLE_ID,
    PASSPORT_LOG_CHANNEL_ID
} = require('../../config/constants');

// Put the template here:
// <your bot project>/assets/oprp_passport_template.png
const PASSPORT_TEMPLATE = path.join(
    __dirname,
    '../../assets/oprp_passport_template.png'
);

function safeText(value, fallback = 'N/A') {
    return String(value ?? fallback).replace(/[\r\n]/g, ' ').trim() || fallback;
}

async function createPassportImage(message, igName) {
    if (!fs.existsSync(PASSPORT_TEMPLATE)) {
        throw new Error(
            `Passport template not found: ${PASSPORT_TEMPLATE}`
        );
    }

    const template = await loadImage(PASSPORT_TEMPLATE);

    // Keep the original template ratio and quality.
    const canvas = createCanvas(template.width, template.height);
    const ctx = canvas.getContext('2d');

    ctx.drawImage(template, 0, 0, template.width, template.height);

    const discordName = safeText(
        message.member?.displayName || message.author.username
    );

    // Cover the original placeholder fields before writing live data.
    ctx.fillStyle = '#11151d';

    // Main card fields
    ctx.fillRect(270, 304, 320, 58);   // Main passenger placeholder
    ctx.fillRect(270, 391, 330, 58);   // Main status placeholder

    // Right ticket fields
    ctx.fillRect(1200, 180, 270, 58);  // Passenger
    ctx.fillRect(1200, 270, 250, 50);  // Status
    ctx.fillRect(1200, 350, 250, 50);  // From
    ctx.fillRect(1200, 425, 250, 50);  // To

    // Draw Discord avatar into the left photo box.
    try {
        const avatarUrl = message.author.displayAvatarURL({
            extension: 'png',
            size: 256,
            forceStatic: true
        });

        const avatar = await loadImage(avatarUrl);

        ctx.save();
        ctx.beginPath();
        ctx.rect(70, 270, 210, 205);
        ctx.clip();
        ctx.drawImage(avatar, 70, 270, 210, 205);
        ctx.restore();

        ctx.strokeStyle = '#ef233c';
        ctx.lineWidth = 5;
        ctx.strokeRect(65, 265, 220, 215);
    } catch (avatarError) {
        console.error('Passport avatar error:', avatarError);
    }

    ctx.textBaseline = 'middle';

    // Main passenger name
    ctx.font = 'bold 34px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(discordName.slice(0, 22), 285, 333);

    // Main status
    ctx.font = 'bold 30px Arial';
    ctx.fillText('CITIZEN', 300, 420);

    // Right ticket details
    ctx.font = 'bold 26px Arial';
    ctx.fillText(discordName.slice(0, 18), 1210, 208);

    ctx.font = 'bold 25px Arial';
    ctx.fillText('CITIZEN', 1210, 296);
    ctx.fillText('DISCORD', 1210, 374);
    ctx.fillText('OPRP CITY', 1210, 449);

    // Keep the in-game name visible in the main card.
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    ctx.fillText(`IG: ${igName}`.slice(0, 28), 285, 465);

    // Dynamic barcode label area
    ctx.fillStyle = '#090b10';
    ctx.fillRect(1190, 665, 315, 38);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 21px Arial';
    ctx.fillText(`OPRP-0001-${igName}`.slice(0, 28), 1210, 685);

    return canvas.toBuffer('image/png');
}

module.exports = async function handlePassportVerify(message) {
    // Only citizens with the required role can use this.
    if (!message.member?.roles.cache.has(CITIZEN_ROLE_ID)) return;

    const igName = message.content.trim();

    // Strict format: Firstname_Lastname.
    const nameRegex = /^[A-Z][a-z]+_[A-Z][a-z]+$/;

    if (!igName || !nameRegex.test(igName)) {
        await message.react('❌');
        return message.reply(
            '❌ Invalid name format!\\n\\n' +
            '✅ Correct: `Oggy_Ftw`, `Itz_Thor`\\n' +
            '❌ Wrong: `oggy_ftw`, `OGGY_FTW`, `Oggy123_Ftw`, `Oggy Ftw`\\n\\n' +
            'Name must be **Firstname_Lastname** — each part starting with a capital letter, letters only, no numbers or symbols.'
        );
    }

    try {
        const [rows] = await db.query(
            'SELECT username, locked FROM users WHERE username = ?',
            [igName]
        );

        if (rows.length === 0) {
            await message.react('⚠️');
            return message.reply(
                `⚠️ **${igName}** is not registered in-game. Please register first!`
            );
        }

        const user = rows[0];

        if (Number(user.locked) === 0) {
            await message.react('🔒');
            return message.reply(
                `🔒 **${igName}** is already in use. If this is your account, contact staff.`
            );
        }

        // Approve the account.
        await db.query(
            'UPDATE users SET locked = 0 WHERE username = ?',
            [igName]
        );

        // Give approved role and remove citizen role.
        const approvedRole = message.guild.roles.cache.get(
            PASSPORT_APPROVED_ROLE_ID
        );

        if (approvedRole) {
            await message.member.roles
                .add(approvedRole)
                .catch(err => console.error('Role Add Error:', err));
        }

        const citizenRole = message.guild.roles.cache.get(CITIZEN_ROLE_ID);

        if (citizenRole) {
            await message.member.roles
                .remove(citizenRole)
                .catch(err => console.error('Role Remove Error:', err));
        }

        // Set Discord nickname to the in-game name.
        await message.member
            .setNickname(igName)
            .catch(err => console.error('Nickname Error:', err));

        // Generate the passport image from the supplied OPRP template.
        const passportBuffer = await createPassportImage(message, igName);
        const passportAttachment = new AttachmentBuilder(passportBuffer, {
            name: `OPRP-Passport-${igName}.png`
        });

        await message.react('✅');

        // Send passport image + approval information to the log channel.
        const logChannel = await message.guild.channels
            .fetch(PASSPORT_LOG_CHANNEL_ID)
            .catch(() => null);

        const approvalEmbed = new EmbedBuilder()
            .setTitle('✅ OPRP Passport Approved')
            .setColor('#e5092f')
            .addFields(
                {
                    name: '👤 Discord User',
                    value: `<@${message.author.id}>`,
                    inline: true
                },
                {
                    name: '🎮 IG Name',
                    value: `\`${igName}\``,
                    inline: true
                },
                {
                    name: '🪪 Status',
                    value: '`CITIZEN`',
                    inline: true
                }
            )
            .setFooter({
                text: 'OPRP ROLEPLAY • Passport System'
            })
            .setTimestamp();

        if (logChannel) {
            await logChannel.send({
                content: `<@${message.author.id}> passport approved successfully!`,
                embeds: [approvalEmbed],
                files: [passportAttachment]
            });
        }

        // Also send the same passport image to the approved user's DM.
        await message.author
            .send({
                content: '✅ Your OPRP Citizen Passport has been approved!',
                files: [
                    new AttachmentBuilder(passportBuffer, {
                        name: `OPRP-Passport-${igName}.png`
                    })
                ]
            })
            .catch(err => console.error('Passport DM Error:', err));

    } catch (dbErr) {
        console.error('Passport DB/Image Error:', dbErr);

        await message.reply(
            '❌ An error occurred while creating your passport. Please contact staff.'
        );
    }
};
