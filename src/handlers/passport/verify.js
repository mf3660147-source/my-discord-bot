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

const TEMPLATE_PATH = path.join(
    __dirname,
    '../../assets/oprp_passport_template.png'
);

function safeText(value) {
    return String(value || '').replace(/[<>&"]/g, '');
}

function makeFlightNumber() {
    const random = crypto.randomBytes(4).readUInt32BE(0) % 90000000;
    return `OPRP-${String(random + 10000000)}`;
}

function fitFontSize(name, maxSize = 42, minSize = 22, maxChars = 18) {
    if (name.length <= maxChars) return maxSize;
    return Math.max(minSize, maxSize - ((name.length - maxChars) * 2));
}

function passportSvg({ igName, flightNo, discordAvatar }) {
    const name = safeText(igName);
    const flight = safeText(flightNo);
    const fontSize = fitFontSize(name);

    // All text is rendered on top of cleared field areas.
    // Existing CITY and CITIZEN artwork is intentionally not redrawn.
    return `
    <svg width="1400" height="773" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id="avatarClip">
          <rect x="61" y="254" width="171" height="180" rx="8"/>
        </clipPath>
      </defs>

      <!-- Only the requested dynamic fields are cleared. The original red design, city text,
           approval stamp, and static CITIZEN artwork remain untouched. -->
      <rect x="242" y="286" width="330" height="64" rx="2" fill="#ed1015"/>
      <rect x="1068" y="176" width="255" height="37" rx="2" fill="#101217"/>

      <!-- Full black masks hide every old flight-number character before new text is drawn. -->
      <rect x="1062" y="461" width="174" height="48" rx="2" fill="#050609"/>
      <rect x="112" y="579" width="176" height="37" rx="2" fill="#050609"/>
      <rect x="1068" y="612" width="268" height="25" rx="2" fill="#050609"/>

      <!-- Passenger name: left field and right stub. -->
      <text x="264" y="329" font-family="Arial, Helvetica, sans-serif"
            font-size="${fontSize}" font-weight="700" fill="#ffffff">${name}</text>
      <text x="1082" y="202" font-family="Arial, Helvetica, sans-serif"
            font-size="22" font-weight="700" fill="#ffffff">${name}</text>

      <!-- Dynamic flight number, printed in the two visible flight-number fields. -->
      <text x="1072" y="493" font-family="Arial, Helvetica, sans-serif"
            font-size="18" font-weight="700" fill="#ffffff">${flight}</text>
      <text x="122" y="603" font-family="Arial, Helvetica, sans-serif"
            font-size="18" font-weight="700" fill="#ffffff">${flight}</text>
      <text x="1080" y="630" font-family="Arial, Helvetica, sans-serif"
            font-size="14" font-weight="700" fill="#ffffff">${flight}-CITIZEN</text>

      <!-- Avatar is supplied separately and clipped to the existing square. -->
      ${discordAvatar ? `<image href="${discordAvatar}" x="61" y="254" width="171" height="180" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatarClip)"/>` : ''}
    </svg>`;
}

async function createPassportImage(igName, user) {
    const flightNo = makeFlightNumber();
    const avatarUrl = user?.displayAvatarURL
        ? user.displayAvatarURL({ extension: 'png', size: 256 })
        : null;

    let avatarDataUri = null;
    if (avatarUrl) {
        try {
            const response = await fetch(avatarUrl);
            if (response.ok) {
                const avatarBuffer = Buffer.from(await response.arrayBuffer());
                const avatarPng = await sharp(avatarBuffer)
                    .resize(171, 180, { fit: 'cover' })
                    .png()
                    .toBuffer();
                avatarDataUri = `data:image/png;base64,${avatarPng.toString('base64')}`;
            }
        } catch (error) {
            console.error('Passport avatar error:', error);
        }
    }

    const svg = passportSvg({
        igName,
        flightNo,
        discordAvatar: avatarDataUri
    });

    const output = await sharp(TEMPLATE_PATH)
        .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
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
        return message.reply(
            '❌ Invalid name format. Use `Firstname_Lastname`.'
        );
    }

    try {
        // Exact case-sensitive username lookup.
        const [rows] = await db.query(
            'SELECT username, locked FROM users WHERE BINARY username = ? LIMIT 1',
            [igName]
        );

        if (!rows.length) {
            await message.react('⚠️').catch(() => {});
            return message.reply(
                `⚠️ **${igName}** is not registered in-game. Please register first!`
            );
        }

        if (Number(rows[0].locked) === 0) {
            await message.react('🔒').catch(() => {});
            return message.reply(
                `🔒 **${igName}** is already in use. Contact staff if needed.`
            );
        }

        await db.query(
            'UPDATE users SET locked = 0 WHERE BINARY username = ?',
            [igName]
        );

        const approvedRole = message.guild.roles.cache.get(PASSPORT_APPROVED_ROLE_ID);
        if (approvedRole) {
            await message.member.roles.add(approvedRole).catch(console.error);
        }

        const citizenRole = message.guild.roles.cache.get(CITIZEN_ROLE_ID);
        if (citizenRole) {
            await message.member.roles.remove(citizenRole).catch(console.error);
        }

        await message.member.setNickname(igName).catch(console.error);
        await message.react('✅').catch(() => {});

        const { output, flightNo } = await createPassportImage(igName, message.author);
        const attachment = new AttachmentBuilder(output, {
            name: `passport-${igName}.png`
        });

        const logChannel = await message.guild.channels
            .fetch(PASSPORT_LOG_CHANNEL_ID)
            .catch(() => null);

        // Log contains the approved mention, welcome line, and image only.
        if (logChannel) {
            await logChannel.send({
                content: `<@${message.author.id}> Welcome to OPRP! 🎉`,
                files: [attachment]
            });
        }

        // DM contains the image only, without extra IG/status fields.
        await message.author.send({
            files: [
                new AttachmentBuilder(output, {
                    name: `passport-${igName}.png`
                })
            ]
        }).catch(error => console.error('Passport DM error:', error));

    } catch (error) {
        console.error('Passport creation error:', error);
        return message.reply(
            '❌ An error occurred while creating your passport. Please contact staff.'
        );
    }
};
