const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const { AttachmentBuilder } = require('discord.js');

const db = require('../../config/database');
const {
    CITIZEN_ROLE_ID,
    PASSPORT_APPROVED_ROLE_ID,
    PASSPORT_LOG_CHANNEL_ID
} = require('../../config/constants');

const TEMPLATE_PATH = path.join(__dirname, '../../assets/oprp_passport_template.png');

function safeText(value) {
    return String(value || '').replace(/[<>&"']/g, (char) => ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&apos;'
    }[char]));
}

function makeFlightNumber() {
    const random = crypto.randomInt(100000, 99999999);
    return `OPRP-${random}`;
}

function fitFontSize(name, maxSize = 42, minSize = 22, maxChars = 18) {
    if (name.length <= maxChars) return maxSize;
    return Math.max(minSize, maxSize - ((name.length - maxChars) * 2));
}

function passportSvg({ igName, flightNo }) {
    const name = safeText(igName);
    const flight = safeText(flightNo);
    const fontSize = fitFontSize(String(igName || ''));

    return `
    <svg width="1400" height="773" viewBox="0 0 1400 773" xmlns="http://www.w3.org/2000/svg">
      <!-- Clear only dynamic fields; keep the original red design unchanged. -->
      <rect x="242" y="286" width="330" height="64" rx="2" fill="#ed1015"/>
      <rect x="1068" y="176" width="255" height="37" rx="2" fill="#101217"/>

      <!-- Hide old flight numbers completely before drawing the new number. -->
      <rect x="1062" y="461" width="174" height="48" fill="#050609"/>
      <rect x="112" y="579" width="176" height="37" fill="#050609"/>
      <rect x="1068" y="612" width="268" height="25" fill="#050609"/>

      <!-- Passenger names. -->
      <text x="264" y="329" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="700" fill="#ffffff">${name}</text>
      <text x="1082" y="202" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" fill="#ffffff">${name}</text>

      <!-- Flight numbers. -->
      <text x="1072" y="493" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700" fill="#ffffff">${flight}</text>
      <text x="122" y="603" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700" fill="#ffffff">${flight}</text>
      <text x="1080" y="630" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="700" fill="#ffffff">${flight}-CITIZEN</text>
    </svg>`;
}

async function createAvatarLayer(user) {
    const avatarUrl = user?.displayAvatarURL
        ? user.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true })
        : null;

    if (!avatarUrl) return null;

    try {
        const response = await fetch(avatarUrl);
        if (!response.ok) return null;

        const avatarBuffer = Buffer.from(await response.arrayBuffer());

        // Create a clean square avatar with rounded corners. Do not embed base64
        // images inside the SVG because that can trigger Sharp/libvips errors.
        const mask = Buffer.from(`
          <svg width="171" height="180" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="0" width="171" height="180" rx="8" fill="white"/>
          </svg>`);

        return await sharp(avatarBuffer)
            .resize(171, 180, { fit: 'cover', position: 'centre' })
            .composite([{ input: mask, blend: 'dest-in' }])
            .png()
            .toBuffer();
    } catch (error) {
        console.error('Passport avatar error:', error);
        return null;
    }
}

async function createPassportImage(igName, user) {
    const flightNo = makeFlightNumber();
    const svg = passportSvg({ igName, flightNo });
    const avatarLayer = await createAvatarLayer(user);

    const layers = [{ input: Buffer.from(svg), top: 0, left: 0 }];
    if (avatarLayer) layers.push({ input: avatarLayer, top: 254, left: 61 });

    const output = await sharp(TEMPLATE_PATH)
        .composite(layers)
        .png()
        .toBuffer();

    return { output, flightNo };
}

module.exports = async function handlePassportVerify(message) {
    if (!message.member.roles.cache.has(CITIZEN_ROLE_ID)) return;

    const igName = message.content.trim();
    const nameRegex = /^[A-Z][A-Za-z]+_[A-Z][A-Za-z]+$/;

    if (!igName || !nameRegex.test(igName)) {
        await message.react('❌').catch(() => {});
        return message.reply('❌ Invalid name format. Use `Firstname_Lastname`.');
    }

    try {
        const [rows] = await db.query(
            'SELECT username, locked FROM users WHERE BINARY username = ? LIMIT 1',
            [igName]
        );

        if (!rows.length) {
            await message.react('⚠️').catch(() => {});
            return message.reply(`⚠️ **${igName}** is not registered in-game. Please register first!`);
        }

        if (Number(rows[0].locked) === 0) {
            await message.react('🔒').catch(() => {});
            return message.reply(`🔒 **${igName}** is already in use. Contact staff if needed.`);
        }

        await db.query('UPDATE users SET locked = 0 WHERE BINARY username = ?', [igName]);

        const approvedRole = message.guild.roles.cache.get(PASSPORT_APPROVED_ROLE_ID);
        if (approvedRole) await message.member.roles.add(approvedRole).catch(console.error);

        const citizenRole = message.guild.roles.cache.get(CITIZEN_ROLE_ID);
        if (citizenRole) await message.member.roles.remove(citizenRole).catch(console.error);

        await message.member.setNickname(igName).catch(console.error);
        await message.react('✅').catch(() => {});

        const { output } = await createPassportImage(igName, message.author);
        const attachment = new AttachmentBuilder(output, { name: `passport-${igName}.png` });

        const logChannel = await message.guild.channels.fetch(PASSPORT_LOG_CHANNEL_ID).catch(() => null);
        if (logChannel) {
            await logChannel.send({
                content: `<@${message.author.id}> Welcome to OPRP! 🎉`,
                files: [attachment]
            });
        }

        await message.author.send({
            files: [new AttachmentBuilder(output, { name: `passport-${igName}.png` })]
        }).catch((error) => console.error('Passport DM error:', error));
    } catch (error) {
        console.error('Passport creation error:', error);
        return message.reply('❌ An error occurred while creating your passport. Please contact staff.');
    }
};
