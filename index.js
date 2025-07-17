const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const axios = require('axios');
const { openAiApiKey } = require('./config');

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const sender = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text;

    if (text) {
      console.log(`📩 Received from ${sender}: ${text}`);
      const reply = await getGPTReply(text);
      await sock.sendMessage(sender, { text: reply });
    }
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      if (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut) {
        connectToWhatsApp();
      }
    } else if (connection === 'open') {
      console.log('✅ WhatsApp connection established');
    }
  });
}

async function getGPTReply(prompt) {
  try {
    const res = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a loving, playful, and caring virtual girlfriend. Respond with affection and emotional warmth, like a girlfriend chatting with her partner.',
          },
          {
            role: 'user',
            content: prompt
          }
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${openAiApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return res.data.choices[0].message.content.trim();
  } catch (err) {
    console.error('GPT Error:', err.response?.data || err.message);
    return "❌ Sorry, babe. I couldn't process that right now. 💔";
  }
}

connectToWhatsApp();
