const path = require('path');
const fs = require('fs');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const db = require('../../config/database');
const {
    CITIZEN_ROLE_ID,
    PASSPORT_APPROVED_ROLE_ID,
    PASSPORT_LOG_CHANNEL_ID,
    PASSPORT_INPUT_CHANNEL_ID
} = require('../../config/constants');

const TEMPLATE_PATH = path.resolve(__dirname, '../../../assets/oprp_passport_template.png');

function fitText(ctx, text, maxWidth, maxSize, minSize = 12) {
    let size = maxSize;
    while (size > minSize) {
        ctx.font = `bold ${size}px Arial`;
        if (ctx.measureText(text).width <= maxWidth) return size;
        size--;
    }
    return minSize;
}

function drawTextFit(ctx, text, x, y, maxWidth, maxSize, minSize = 12, color = '#ffffff') {
    const size = fitText(ctx, text, maxWidth, maxSize, minSize);
    ctx.font = `bold ${size}px Arial`;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
}

async function getAvatarImage(message) {
    try {
        const url = message.author.displayAvatarURL({ extension: 'png', size: 512 });
        const response = await fetch(url);
        if (!response.ok) return null;
        return await loadImage(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
        console.error('Passport avatar error:', error.message);
        return null;
    }
}

function createFlightNumber() {
    return `OPRP-${Math.floor(1000 + Math.random() * 9000)}`;
}

async function createPassportImage(message, igName) {
    if (!fs.existsSync(TEMPLATE_PATH)) {
        throw new Error(`Passport template not found: ${TEMPLATE_PATH}`);
    }

    const template = await loadImage(TEMPLATE_PATH);
    const canvas = createCanvas(template.width, template.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(template, 0, 0, template.width, template.height);

    const avatar = await getAvatarImage(message);

    // Clip the applicant photo strictly inside the frame.
    const photoX = 72, photoY = 275, photoW = 173, photoH = 181;
    ctx.save();
    ctx.beginPath();
    ctx.rect(photoX, photoY, photoW, photoH);
    ctx.clip();

    if (avatar) {
        const scale = Math.max(photoW / avatar.width, photoH / avatar.height);
        const width = avatar.width * scale;
        const height = avatar.height * scale;
        ctx.drawImage(avatar, photoX + (photoW - width) / 2, photoY + (photoH - height) / 2, width, height);
    } else {
        ctx.fillStyle = '#20242b';
        ctx.fillRect(photoX, photoY, photoW, photoH);
    }
    ctx.restore();

    // Current applicant's IG name in both Passenger fields.
    drawTextFit(ctx, igName, 315, 350, 285, 30, 14, '#ffffff');
    drawTextFit(ctx, igName, 1205, 241, 245, 21, 12, '#ffffff');

    drawTextFit(ctx, 'CITIZEN', 342, 437, 220, 28, 16, '#ffffff');
    drawTextFit(ctx, 'CITIZEN', 1205, 299, 190, 21, 13, '#ffffff');

    const flightNumber = createFlightNumber();
    drawTextFit(ctx, flightNumber, 132, 653, 165, 22, 12, '#ffffff');
    drawTextFit(ctx, flightNumber, 1175, 531, 175, 20, 11, '#ffffff');
    drawTextFit(ctx, `${flightNumber}-CITIZEN`, 1190, 760, 250, 15, 10, '#ffffff');

    return canvas.toBuffer('image/png');
}

async function sendPassportToLog(message, passportBuffer) {
    const logChannel = await message.guild.channels.fetch(PASSPORT_LOG_CHANNEL_ID).catch(() => null);
    if (!logChannel || !logChannel.isTextBased()) return;

    await logChannel.send({
        files: [{ attachment: passportBuffer, name: 'oprp_passport.png' }]
    });
}

async function sendPassportToDM(message, passportBuffer) {
    try {
        await message.author.send({
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
            '❌ Invalid name format!\n\n✅ Correct: `Oggy_Ftw`, `Itz_Thor`\n' +
            '❌ Wrong: `oggy_ftw`, `OGGY_FTW`, `Oggy123_Ftw`, `Oggy Ftw`\n\n' +
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

        if (Number(rows[0].locked) === 0) {
            await message.react('🔒').catch(() => {});
            return message.reply(`🔒 **${igName}** is already in use. If this is your account, contact staff.`);
        }

        await db.query('UPDATE users SET locked = 0 WHERE BINARY username = BINARY ?', [igName]);

        const approvedRole = message.guild.roles.cache.get(PASSPORT_APPROVED_ROLE_ID);
        if (approvedRole) await message.member.roles.add(approvedRole);

        const citizenRole = message.guild.roles.cache.get(CITIZEN_ROLE_ID);
        if (citizenRole) await message.member.roles.remove(citizenRole);

        await message.member.setNickname(igName).catch(error => {
            console.error('Nickname Error:', error.message);
        });

        const passportBuffer = await createPassportImage(message, igName);
        await message.react('✅').catch(() => {});
        await sendPassportToLog(message, passportBuffer);
        await sendPassportToDM(message, passportBuffer);
    } catch (error) {
        console.error('Passport creation/verification error:', error);
        await message.reply('❌ An error occurred while creating your passport. Please contact staff.');
    }
};
