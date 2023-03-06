
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
        is_string: (s) => { return Object.prototype.toString.call(s) === '[object String]' },
        timestamp: (t) => {
            if (! (t instanceof Date)) {
                t = new Date(t);
            }
            return t.toISOString().replace("T", " ").split(".")[0];
        },

        preamble: (message, contact, chat) => {
            let retval = log.fmt.timestamp(message.timestamp * 1000);

            let name = contact.pushname;
            if (! log.fmt.is_string(name)) {
                name = contact.name;
            }
            if (! log.fmt.is_string(name)) {
                name = contact.number;
            }
            if (! log.fmt.is_string(name)) {
                console.error("Unable to read contact name from:", contact);
                name = "??????";
            }

            retval += " " + ("<" + name.substring(0,10) + ">").padStart(12);
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
 * commands
 */

const command = {
    exists: (s) => { return (command[s] !== undefined); },

    "!alo": async (message, contact, chat) => {
        await biara(() => { client.sendMessage(message.from, 'ne var'); });
    },

    "!ping": async (message, contact, chat) => {
        await biara(() => { message.reply('pong'); });
    },

    "!nedir": async (message, contact, chat) => {
        await biara(() => { message.reply(HELP); });
    },
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

client.on('message_create', async (message) => {
    let cmdstr = message.body.split(" ")[0];
    if (command.exists(cmdstr)) {
        return;
    }

    let chat = await message.getChat();
    let contact = await message.getContact();
    let preamble = log.fmt.preamble(message, contact, chat)

    log.message(preamble, message.body);
});

client.on('message', async (message) => {
    if (message.fromMe) {
        return;
    }

    let cmdstr = message.body.split(" ")[0];
    let handler = command[cmdstr];
    if (handler === undefined) {
        log.debug("Unknown command: ", cmdstr);
        return;
    }

    await handler(message, contact, chat);
    log.command(preamble, command);

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
