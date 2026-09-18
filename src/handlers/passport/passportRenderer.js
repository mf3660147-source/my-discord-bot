const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const QRCode = require('qrcode');

const ASSET = path.join(__dirname, '../../../assets/passport-template.png');

function escapeXml(value = '') {
  return String(value).replace(/[<>&'\"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','\"':'&quot;'}[c]));
}

function flightNumber() {
  return `OPRP-${crypto.randomInt(1000, 10000)}`;
}

async function renderPassport({ name, flight, photoPath = null, qrUrl = null }) {
  const composites = [];
  const svg = Buffer.from(`<svg width="1536" height="848" xmlns="http://www.w3.org/2000/svg">
    <style>.name{font-family:Arial,sans-serif;font-weight:700;fill:#fff}.flight{font-family:Arial,sans-serif;font-weight:700;fill:#fff;font-size:25px}</style>
    <text x="315" y="361" class="name" font-size="30">${escapeXml(name)}</text>
    <text x="1210" y="236" class="name" font-size="22">${escapeXml(name)}</text>
    <text x="145" y="651" class="flight">${escapeXml(flight)}</text>
    <text x="1195" y="535" class="flight">${escapeXml(flight)}</text>
  </svg>`);
  composites.push({ input: svg, top: 0, left: 0 });

  if (photoPath) {
    const photo = await sharp(photoPath).resize(190, 205, { fit: 'cover' }).png().toBuffer();
    composites.push({ input: photo, top: 283, left: 67 });
  }

  if (qrUrl) {
    const qr = await QRCode.toBuffer(qrUrl, { width: 170, margin: 1, errorCorrectionLevel: 'M' });
    composites.push({ input: qr, top: 310, left: 1020 });
  }

  return sharp(ASSET).composite(composites).png().toBuffer();
}

module.exports = { renderPassport, flightNumber };
