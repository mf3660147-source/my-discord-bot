const { AUTO_JOIN_ROLE_ID } = require('../config/constants');

// പുതിയ യൂസർ ജോയിൻ ചെയ്യുമ്പോൾ കൊടുക്കുന്ന റോൾ ഇവിടെ മാറ്റിയിട്ടുണ്ട്
module.exports = function (client) {
    client.on('guildMemberAdd', async (member) => {
        try {
            const role = member.guild.roles.cache.get(AUTO_JOIN_ROLE_ID);
            if (role) await member.roles.add(role);
        } catch (err) {
            console.error('Auto-role Error:', err);
        }
    });
};
