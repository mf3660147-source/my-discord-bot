const path = require('path');
const fs = require('fs');
const { EmbedBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const db = require('../../config/database');
const {
    CITIZEN_ROLE_ID,
    PASSPORT_APPROVED_ROLE_ID,
    PASSPORT_LOG_CHANNEL_ID,
    PASSPORT_INPUT_CHANNEL_ID
} = require('../../config/constants');

const TEMPLATE_PATH = path.resolve(__dirname, '../../../assets/oprp_passport_template.png');

function fitText(ctx, text, maxWidth, maxSize, minSize = 12, font = 'Arial') {
    let size = maxSize;
    while (size > minSize) {
        ctx.font = `bold ${size}px ${font}`;
        if (ctx.measureText(text).width <= maxWidth) return size;
        size -= 1;
    }
    ctx.font = `bold ${minSize}px ${font}`;
    return minSize;
}

function drawTextFit(ctx, text, x, y, maxWidth, maxSize, minSize = 12, color = '#ffffff') {
    const size = fitText(ctx, text, maxWidth, maxSize, minSize);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
}

async function getAvatarImage(message) {
    try {
        const avatarUrl = message.author.displayAvatarURL({ extension: 'png', size: 256 });
        const response = await fetch(avatarUrl);
        if (!response.ok) return null;
        const buffer = Buffer.from(await response.arrayBuffer());
        return await loadImage(buffer);
    } catch (error) {
        console.error('Passport avatar error:', error.message);
        return null;
    }
}

async function createPassportImage(message, igName) {
    if (!fs.existsSync(TEMPLATE_PATH)) {
        throw new Error(`Passport template not found: ${TEMPLATE_PATH}`);
    }

    const template = await loadImage(TEMPLATE_PATH);
    const canvas = createCanvas(template.width, template.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(template, 0, 0, template.width, template.height);

    const discordName = message.author.username;
    const avatar = await getAvatarImage(message);

    // Profile photo box on the left side of the template.
    const photoX = 68;
    const photoY = 264;
    const photoW = 242;
    const photoH = 218;

    ctx.save();
    ctx.beginPath();
    ctx.rect(photoX, photoY, photoW, photoH);
    ctx.clip();
    if (avatar) {
        const scale = Math.max(photoW / avatar.width, photoH / avatar.height);
        const drawW = avatar.width * scale;
        const drawH = avatar.height * scale;
        ctx.drawImage(avatar, photoX + (photoW - drawW) / 2, photoY + (photoH - drawH) / 2, drawW, drawH);
    } else {
        ctx.fillStyle = '#20242b';
        ctx.fillRect(photoX, photoY, photoW, photoH);
        ctx.fillStyle = '#9ca3af';
        ctx.beginPath();
        ctx.arc(photoX + photoW / 2, photoY + 78, 40, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(photoX + 48, photoY + 125, 146, 70);
    }
    ctx.restore();

    // Main left panel.
    ctx.font = 'bold 25px Arial';
    drawTextFit(ctx, discordName, 316, 331, 290, 28, 15, '#101827');
    drawTextFit(ctx, 'CITIZEN', 316, 423, 250, 28, 16, '#ffffff');
    drawTextFit(ctx, `IG: ${igName}`, 316, 467, 290, 22, 12, '#ffffff');

    // Right boarding-pass panel.
    drawTextFit(ctx, discordName, 1208, 289, 270, 22, 12, '#ffffff');
    drawTextFit(ctx, 'CITIZEN', 1208, 353, 210, 22, 14, '#ffffff');
    drawTextFit(ctx, 'DISCORD', 1208, 415, 210, 22, 14, '#ffffff');
    drawTextFit(ctx, 'OPRP CITY', 1208, 477, 220, 22, 14, '#ffffff');
    drawTextFit(ctx, `IG: ${igName}`, 1208, 535, 250, 18, 11, '#ffffff');

    // Bottom flight details.
    const flightNumber = `OPRP-${String(message.author.id).slice(-4)}`;
    drawTextFit(ctx, flightNumber, 174, 674, 150, 23, 13, '#ffffff');
    drawTextFit(ctx, flightNumber, 1190, 602, 130, 18, 11, '#ffffff');
    drawTextFit(ctx, `OPRP-${String(message.author.id).slice(-4)}-CITIZEN`, 1170, 731, 280, 16, 10, '#ffffff');

    return canvas.toBuffer('image/png');
}

async function sendPassportToLog(message, igName, passportBuffer) {
    const logChannel = await message.guild.channels.fetch(PASSPORT_LOG_CHANNEL_ID).catch(() => null);
    if (!logChannel || !logChannel.isTextBased()) return;

    const approvalEmbed = new EmbedBuilder()
        .setTitle('✅ Passport Approved')
        .setColor('#22c55e')
        .addFields(
            { name: '👤 Discord User', value: `<@${message.author.id}>`, inline: true },
            { name: '🎮 IG Name', value: `\`${igName}\``, inline: true },
            { name: '🏙️ Destination', value: 'OPRP CITY', inline: true },
            { name: '🪪 Status', value: 'CITIZEN', inline: true }
        )
        .setFooter({ text: 'ONE PEACE ROLEPLAY • Passport System' })
        .setTimestamp();

    await logChannel.send({
        content: `<@${message.author.id}> your passport has been approved!`,
        embeds: [approvalEmbed],
        files: [{ attachment: passportBuffer, name: 'oprp_passport.png' }]
    });
}

async function sendPassportToDM(message, passportBuffer) {
    try {
        await message.author.send({
            content: '✅ Your OPRP passport has been approved!',
            files: [{ attachment: passportBuffer, name: 'oprp_passport.png' }]
        });
    } catch (error) {
        console.error('Passport DM error:', error.message);
    }
}

module.exports = async function handlePassportVerify(message) {
    if (message.channel.id !== PASSPORT_INPUT_CHANNEL_ID) return;
    if (!message.member?.roles.cache.has(CITIZEN_ROLE_ID)) return;

    const igName = message.content.trim();
    const nameRegex = /^[A-Z][a-z]+_[A-Z][a-z]+$/;

    if (!igName || !nameRegex.test(igName)) {
        await message.react('❌').catch(() => {});
        return message.reply(
            '❌ Invalid name format!\\n\\n✅ Correct: `Oggy_Ftw`, `Itz_Thor`\\n' +
            '❌ Wrong: `oggy_ftw`, `OGGY_FTW`, `Oggy123_Ftw`, `Oggy Ftw`\\n\\n' +
            'Name must be **Firstname_Lastname** — each part starting with a capital letter.'
        );
    }

    try {
        const [rows] = await db.query(
            'SELECT username, locked FROM users WHERE BINARY username = BINARY ? LIMIT 1',
            [igName]
        );

        if (!rows.length) {
            await message.react('⚠️').catch(() => {});
            return message.reply(`⚠️ **${igName}** is not registered in-game. Please register first!`);
        }

        const user = rows[0];

        if (Number(user.locked) === 0) {
            await message.react('🔒').catch(() => {});
            return message.reply(`🔒 **${igName}** is already in use. If this is your account, contact staff.`);
        }

        await db.query('UPDATE users SET locked = 0 WHERE BINARY username = BINARY ?', [igName]);

        const approvedRole = message.guild.roles.cache.get(PASSPORT_APPROVED_ROLE_ID);
        if (approvedRole) {
            await message.member.roles.add(approvedRole);
        }

        const citizenRole = message.guild.roles.cache.get(CITIZEN_ROLE_ID);
        if (citizenRole) {
            await message.member.roles.remove(citizenRole);
        }

        await message.member.setNickname(igName).catch(err => console.error('Nickname Error:', err.message));
        const passportBuffer = await createPassportImage(message, igName);

        await message.react('✅').catch(() => {});
        await sendPassportToLog(message, igName, passportBuffer);
        await sendPassportToDM(message, passportBuffer);

    } catch (error) {
        console.error('Passport creation/verification error:', error);
        await message.reply('❌ An error occurred while creating your passport. Please contact staff.');
    }
};
