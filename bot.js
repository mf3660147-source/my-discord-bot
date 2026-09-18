require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const client = require('./src/config/client');
const db = require('./src/config/database');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.get('/', (req, res) => res.send('OPRP Discord Bot is Online!'));
app.get('/verify', (req, res) => {
  const { flight = '', token = '' } = req.query;
  res.send(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>OPRP Verification</title></head><body style="font-family:Arial;max-width:420px;margin:40px auto;padding:20px"><h2>OPRP Passport Verification</h2><form method="POST" action="/verify"><input type="hidden" name="token" value="${String(token).replace(/"/g,'&quot;')}"><label>Flight Number</label><input name="flight" value="${String(flight).replace(/"/g,'&quot;')}" required style="width:100%;padding:10px;margin:10px 0"><button style="padding:10px 18px">Verify</button></form></body></html>`);
});
app.post('/verify', async (req, res) => {
  try {
    const { flight, token } = req.body;
    if (!flight || !token) return res.status(400).send('Missing verification details.');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const [rows] = await db.query('SELECT username, flight_number, created_at FROM passport_verifications WHERE flight_number = ? AND verification_token_hash = ?', [flight, hash]);
    if (!rows.length) return res.status(403).send('Invalid flight number or verification token.');
    await db.query('UPDATE passport_verifications SET verified_at = CURRENT_TIMESTAMP WHERE flight_number = ?', [flight]);
    const row = rows[0];
    res.send(`<h2>✅ OPRP Passport Verified</h2><p><b>Citizen:</b> ${row.username}</p><p><b>Flight:</b> ${row.flight_number}</p><p><b>Issued:</b> ${row.created_at}</p>`);
  } catch (e) { console.error(e); res.status(500).send('Verification service error.'); }
});
app.listen(process.env.PORT || 3000, () => console.log('Verification server ready'));

require('./src/events/ready')(client);
require('./src/events/guildMemberAdd')(client);
require('./src/events/messageCreate')(client);
require('./src/events/interactionCreate')(client);
client.login(process.env.DISCORD_TOKEN);
