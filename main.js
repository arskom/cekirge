
/*
 * preamble
 */

"use strict";

const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const config = require('./config.json');

/*
 * misc
 */
const HELP = `Komutlar:
 - *!ping*: alintili ping
 - *!alo*: alintisiz ping
`;

const log = {
    write: (ctx, ...args) => {
        ctx = (new Date().toISOString().replace("T", " ").split(".")[0])
            + (ctx + "| ").padStart(10);
        console.log(ctx, ...args);
    },

    fmt: {
        preamble: (contact, chat) => {
            let retval = ("<" + contact.pushname.substring(0,10) + ">").padStart(12);
            if (chat.isGroup) {
                retval += " " + ("("+ chat.name.substring(0,10) +")").padEnd(12);
            }

            return retval;
        }
    },

    command: (...args) => { log.write("command", ...args); },
    message: (...args) => { log.write("message", ...args); },
    status:  (...args) => { log.write("status", ...args); },
    voice:   (...args) => { log.write("voice", ...args); },
    debug:   (...args) => { log.write("debug", ...args); },
};

const biara = (f) => {
    let delay_ms = (Math.random() * 10000) + 2000;

    return new Promise((resolve) => {
        setTimeout(() => { resolve(f()); }, delay_ms);
    });
};

/*
 * main
 */
const client = new Client({
    authStrategy: new LocalAuth(),
});

client.on('qr', (qr) => {
    log.status("Got QR");
    qrcode.generate(qr, {small: true});
});

client.on('ready', async () => {
    log.status("Ready");
    await biara(() => { client.sendMessage(config.statusgroup, "hop"); });
});

client.on('message',async (message) => {
    let chat = await message.getChat();
    let contact = await message.getContact();
    let preamble = log.fmt.preamble(contact, chat)
    log.message(preamble, message.body);

    if (message.body === '!alo') {
        await biara(() => { client.sendMessage(message.from, 'ne var'); });
        log.command(preamble, "!alo");
    }
    else if (message.body === '!ping') {
        await biara(() => { message.reply('pong'); });
        log.command(preamble, "!ping");
    }
    else if (message.body == '!nedir') {
        await biara(() => { message.reply(HELP); });
        log.command(preamble, "!nedir");
    }
});

// example.js'den reject calls kodu
client.on('call', async (call) => {
    log.voice('Rejecting call', call);
    await call.reject();
    await client.sendMessage(call.from, `[${call.fromMe ? 'Outgoing' : 'Incoming'}] Phone call from ${call.from}, type ${call.isGroup ? 'group' : ''} ${call.isVideo ? 'video' : 'audio'} call. ${rejectCalls ? 'This call was automatically rejected by the script.' : ''}`);
});

/*
 * boot
 */
log.status("Booting ...");
client.initialize();
