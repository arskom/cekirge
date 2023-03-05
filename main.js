
const qrcode = require('qrcode-terminal');

const { Client, LocalAuth } = require('whatsapp-web.js');

const client = new Client({
    authStrategy: new LocalAuth()
});

client.on('qr', (qr) => {
    console.log('[status]   QR received!');
    qrcode.generate(qr, {small: true});
});

client.on('ready', () => {
    console.log('[status]   Client is ready!');
});

client.on('message', message => {
    console.log('[message] ', message);

    if (message.body === '!alo') {
        client.sendMessage(message.from, 'ne var');
    }
    else if (message.body === '!ping') {
        message.reply('pong');
    }
});

// example.js'den reject calls kodu
client.on('call', async (call) => {
    console.log('[voice]    Rejecting call', call);
    await call.reject();
    await client.sendMessage(call.from, `[${call.fromMe ? 'Outgoing' : 'Incoming'}] Phone call from ${call.from}, type ${call.isGroup ? 'group' : ''} ${call.isVideo ? 'video' : 'audio'} call. ${rejectCalls ? 'This call was automatically rejected by the script.' : ''}`);
});

console.log("[status]   Boot");
client.initialize();
