
// preamble
"use strict";

const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');

// util
const log = {
    write: (ctx, ...args) => {
        ctx = (ctx + "| ").padStart(10);
        console.log(ctx, ...args);
    },

    message: (...args) => { log.write("message", ...args); },
    status:  (...args) => { log.write("status", ...args); },
    voice:   (...args) => { log.write("voice", ...args); },
};

// main
const client = new Client({
    authStrategy: new LocalAuth(),
});

client.on('qr', (qr) => {
    log.status("Got QR");
    qrcode.generate(qr, {small: true});
});

client.on('ready', () => {
    log.status("Ready");
});

client.on('message', message => {
    log.message(message);

    if (message.body === '!alo') {
        client.sendMessage(message.from, 'ne var');
    }
    else if (message.body === '!ping') {
        message.reply('pong');
    }
});

// example.js'den reject calls kodu
client.on('call', async (call) => {
    log.voice('Rejecting call', call);
    await call.reject();
    await client.sendMessage(call.from, `[${call.fromMe ? 'Outgoing' : 'Incoming'}] Phone call from ${call.from}, type ${call.isGroup ? 'group' : ''} ${call.isVideo ? 'video' : 'audio'} call. ${rejectCalls ? 'This call was automatically rejected by the script.' : ''}`);
});

log.status("Boot");
client.initialize();
