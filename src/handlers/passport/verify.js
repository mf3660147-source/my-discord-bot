const crypto = require('crypto');
const { AttachmentBuilder } = require('discord.js');
const db = require('../../config/database');
const { CITIZEN_ROLE_ID, PASSPORT_APPROVED_ROLE_ID, PASSPORT_LOG_CHANNEL_ID } = require('../../config/constants');
const { renderPassport, flightNumber } = require('./passportRenderer');

const BASE_URL = (process.env.VERIFICATION_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

async function downloadAvatar(user) {
  try {
    const url = user.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Avatar download failed: ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    console.error('Avatar download error:', error);
    return null;
  }
}

module.exports = async function handlePassportVerify(message) {
  if (!message.member.roles.cache.has(CITIZEN_ROLE_ID)) return;
  const igName = message.content.trim();
  const nameRegex = /^[A-Z][a-z]+_[A-Z][a-z]+$/;
  if (!nameRegex.test(igName)) {
    await message.react('❌');
    return message.reply('❌ Invalid name format. Use `Firstname_Lastname`.');
  }

  try {
    const [rows] = await db.query('SELECT username, locked FROM users WHERE username = ?', [igName]);
    if (!rows.length) return message.reply(`⚠️ **${igName}** is not registered in-game.`);
    if (Number(rows[0].locked) === 0) return message.reply(`🔒 **${igName}** is already in use.`);

    await db.query('UPDATE users SET locked = 0 WHERE username = ?', [igName]);
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = sha256(token);
    let flight;
    for (let i = 0; i < 10; i++) {
      const candidate = flightNumber();
      const [exists] = await db.query('SELECT id FROM passport_verifications WHERE flight_number = ?', [candidate]);
      if (!exists.length) { flight = candidate; break; }
    }
    if (!flight) throw new Error('Could not generate a unique flight number');

    await db.query(
      `INSERT INTO passport_verifications (discord_user_id, username, flight_number, verification_token_hash)
       VALUES (?, ?, ?, ?)`,
      [message.author.id, igName, flight, tokenHash]
    );

    const qrUrl = BASE_URL
      ? `${BASE_URL}/verify?flight=${encodeURIComponent(flight)}&token=${encodeURIComponent(token)}`
      : null;
    const photoBuffer = await downloadAvatar(message.author);
    const image = await renderPassport({ name: igName, flight, photoBuffer, qrUrl });
    const logImage = await renderPassport({ name: igName, flight, photoBuffer });
    const dmAttachment = new AttachmentBuilder(image, { name: `passport-${flight}.png` });
    const logAttachment = new AttachmentBuilder(logImage, { name: `passport-${flight}-log.png` });

    const approvedRole = message.guild.roles.cache.get(PASSPORT_APPROVED_ROLE_ID);
    if (approvedRole) await message.member.roles.add(approvedRole).catch(console.error);
    const citizenRole = message.guild.roles.cache.get(CITIZEN_ROLE_ID);
    if (citizenRole) await message.member.roles.remove(citizenRole).catch(console.error);
    await message.member.setNickname(igName).catch(console.error);

    await message.author.send({
      content: `✅ Your OPRP Passport is approved!\n**Flight Number:** \`${flight}\`\nScan the QR code to verify your passport.`,
      files: [dmAttachment]
    }).catch(err => console.error('DM Error:', err));

    const logChannel = await message.guild.channels.fetch(PASSPORT_LOG_CHANNEL_ID).catch(() => null);
    if (logChannel) {
      await logChannel.send({
        content: `🎉 Welcome <@${message.author.id}> to OPRP City!\n✅ Your passport has been approved.\n🎮 IG Name: \`${igName}\`\n✈️ Flight Number: \`${flight}\``,
        files: [logAttachment],
        allowedMentions: { users: [message.author.id] }
      });
    }
    await message.react('✅');
  } catch (err) {
    console.error('Passport DB/Image Error:', err);
    await message.reply('❌ Passport approval failed. Please contact staff.');
  }
};
