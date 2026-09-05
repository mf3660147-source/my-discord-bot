const { hasAdminAccess } = require('../utils/permissions');
const { PASSPORT_INPUT_CHANNEL_ID } = require('../config/constants');

// Setup commands
const setupNameChange = require('../commands/setup/nameChange');
const setupSupport = require('../commands/setup/support');
const setupFaction = require('../commands/setup/faction');
const setupGangApp = require('../commands/setup/gangApp');
const setupVip = require('../commands/setup/vip');
const setupAdmin = require('../commands/setup/admin');
const setupAttendance = require('../commands/setup/attendance');

// Passport handler
const passportVerify = require('../handlers/passport/verify');

module.exports = function (client) {
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;

        try {
            // --- SETUP COMMANDS ---
            if (message.content === '!setup-nc') {
                if (!hasAdminAccess(message.member)) {
                    return message.reply('❌ Only admins can setup the Name Change Portal!');
                }
                return await setupNameChange(message);
            }

            if (message.content === '!setup-support') {
                return await setupSupport(message);
            }

            if (message.content === '!setup-faction') {
                return await setupFaction(message);
            }

            if (message.content === '!setup-gangapp') {
                return await setupGangApp(message);
            }

            if (message.content === '!setup-vip') {
                return await setupVip(message);
            }

            if (message.content === '!setup-admin') {
                return await setupAdmin(message);
            }

            if (message.content === '!setup-attendance') {
                if (!hasAdminAccess(message.member)) {
                    return message.reply('❌ Only admins can setup attendance!');
                }
                return await setupAttendance(message);
            }

            // --- PASSPORT / IG NAME VERIFICATION SYSTEM ---
            if (message.channel.id === PASSPORT_INPUT_CHANNEL_ID) {
                return await passportVerify(message);
            }

        } catch (err) {
            console.error('Command Execution Error:', err);
        }
    });
};
