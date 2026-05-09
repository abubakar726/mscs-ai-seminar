const QRCode = require('qrcode');

/**
 * Generate a unique 4-digit session code e.g. SEM-4829
 */
function generateSessionCode() {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `SEM-${num}`;
}

/**
 * Generate QR Code as base64 string
 * The QR encodes the join URL
 */
async function generateQRCode(sessionCode, baseUrl = 'http://localhost:3000') {
  const joinUrl = `${baseUrl}/join/${sessionCode}`;
  try {
    const qrBase64 = await QRCode.toDataURL(joinUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: '#00D4FF',   // accent color matching UI
        light: '#080C14',  // dark background
      },
    });
    return qrBase64;
  } catch (err) {
    console.error('QR generation error:', err);
    return null;
  }
}

module.exports = { generateSessionCode, generateQRCode };
