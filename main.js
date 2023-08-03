
/*
 * hazirlik
 */


"use strict";

const QRCode = require('qrcode-terminal');
const { Client, LocalAuth, MessageAck } = require('whatsapp-web.js');
const assert = require('node:assert');
const process = require('node:process');

let whitelist = [];
let config;
try {
    config = require('./config.json');
    assert(config.statusgroup !== undefined);
    whitelist = [config.statusgroup];
    if (config.usergroup !== undefined) {
        whitelist.push(config.usergroup);
    }
    if (config.usergroups !== undefined) {
        config.usergroups.forEach((e) => {
            assert(typeof e === 'string');
            whitelist.push(e);
        });
    }
} catch (err) {
    config = {};
}

console.log("whitelist:", whitelist);

const db = require ('./db.js');
const convert = require ('./converters');
const uuidv4 = require('uuid').v4;
const crypto = require('crypto');
//const Buffer = ('node:buffer');
const { TextEncoder } = require('util');
const axios = require('axios');

/*
 * cercop
 */

const HELP = `Komutlar:
 - *!ping*: alintili ping
 - *!alo*: alintisiz ping
 - *!tview* <symbol>:
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

            retval += " " + ("<" + name.substring(0,12) + ">").padStart(14);
            if (chat.isGroup) {
                if (chat.name !== undefined) {
                    retval += " " + ("("+ chat.name.substring(0,10) +")").padEnd(12);
                } else {
                    retval += " " + ("("+ "??????????" +")").padEnd(12);
                }
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
 * komutlar
 */

const command = {
    exists: (s) => { return (command[s] !== undefined); },

    "!tview": async (message, contact, chat) => {
        const args = message.body.split(' ').filter(s => s);
        if (args.length < 2) {
            let retval = "yanlis: " + message.body;
            await biara(() => { client.sendMessage(config.statusgroup, retval); });
            return;
        }

        let retval = '';
        for (let i = 1; i < args.length; ++i) {
            let symbol = args[i].toUpperCase();

            let source = tview.sources[symbol];
            if (source === undefined) {
                let hata = symbol + " icin kaynak tanimli degil";
                log.command(hata);
                await biara(() => { client.sendMessage(config.statusgroup, hata); });
                return;
            }

            let data = await tview.get(symbol, source);
            log.debug(symbol, "response:", data);
            if (i > 1) {
                retval+= '\n';
            }

            retval += symbol + ': ' + data.lp;
        }
        await biara(() => { message.reply(retval); });
        return retval;
    },

    "!alo": async (message, contact, chat) => {
        let retval = 'ne var';
        await biara(() => { client.sendMessage(message.from, retval); });
        return retval;
    },

    "!ping": async (message, contact, chat) => {
        let retval = 'pong';
        await biara(() => { message.reply('pong'); });
        return retval;
    },

    "!nedir": async (message, contact, chat) => {
        await biara(() => { message.reply(HELP); });
    },
};

/*
 * handlers
 */
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        executablePath: '/usr/bin/google-chrome-stable'
    }
});

client.on('qr', (qr) => {
    log.status("Got QR");
    QRCode.generate(qr, {small: true});
});

client.on('ready', async () => {
    log.status("Ready");
    //await biara(() => { client.sendMessage(config.statusgroup, "hop"); });
});

client.on('message_create', async (message) => {
    if (message.isStatus) {
        return;
    }

    if (message.type === 'e2e_notification'){
        return;
    }

    let chat = await message.getChat();
    let contact = await message.getContact();

    let preamble = log.fmt.preamble(message, contact, chat)

    log.debug(message);
    log.message(preamble, message.body); 

    let fromName = '';
    let toName = '';
    let sender = '';
    let recipient = '';
    if(message.fromMe){
        fromName = client.info.pushname;
        toName = chat.name;
    } else {
        fromName = chat.name;
        toName = client.info.pushname;
    }
    sender = convert.SenderOrRecipientJSON(message.from, fromName);
    recipient = convert.SenderOrRecipientJSON(message.to, toName);

    let rd_uuidv = '{' + uuidv4() + '}';
    const folderUUID = '{' + uuidv4() + '}';

    let irtMUUID = '{00000000-0000-0000-0000-000000000000}';
    let quotedMsg_MIME_ID = null;
    if (message.hasQuotedMsg) { //if there is a quoted message and it's in database
        quotedMsg_MIME_ID = (await message.getQuotedMessage())._data.id._serialized;
        if((await db.quotedMessageIsInDb(quotedMsg_MIME_ID)) === 1){
            irtMUUID = await db.getMessageIRT(quotedMsg_MIME_ID);
        }
    }

    let header = '[]';
    if (chat.isGroup){
        header = convert.hd4Groups(message.from, fromName, message.to, toName, chat.name);
    } else {
        header = convert.hd4Direct(message.from, fromName, message.to);
    }
    
    // If message is not empty, do fill body_blob and preview columns in database
    let bodyBlob = null;
    let preview = null;
    if (message.body !== null && message.body !== undefined && message.body !== ''){
        const encodedText = new TextEncoder().encode(message.body);
        preview = encodedText.slice(0, 256);

        const mHash_SHA512 = crypto.createHash('sha512').update(message.body).digest('base64');

        const contentF = await db.contentsAll_txn(rd_uuidv, encodedText, 3, 2);
        if (contentF === null) {
            bodyBlob = convert.bodyBlobB64JSON((Buffer.from(message.body, 'utf-8').toString('base64')));
        }
        else {
            bodyBlob = convert.bodyBlobJSON(contentF.reg, contentF.size, contentF.size, mHash_SHA512);
        }
    }

    let files = '[]';
    if (message.hasMedia && message.downloadMedia() !== undefined ) {
        const fmimetype = (await message.downloadMedia()).mimetype;
        const media_data = (await message.downloadMedia()).data;
        const ffilename = (await message.downloadMedia()).fileName;
        console.log("ffilename: ", ffilename);
        const fSHA512 = crypto.createHash('sha512').update(media_data).digest('base64');

        const contentF = await db.contentsAll_txn(rd_uuidv, media_data, 3, 2);
        if (contentF === null) {
            files = convert.filesB64JSON(ffilename, fmimetype, media_data);
        }
        else {
            files = convert.filesJSON(ffilename, fmimetype, contentF.reg, contentF.size, contentF.size, fSHA512, contentF.ContentID);
        }
    }

    const MessagesTable = await db.add_message_txn(rd_uuidv, message._data.id._serialized, message.timestamp, sender, recipient, files, irtMUUID, quotedMsg_MIME_ID, header, preview, bodyBlob);
    await db.folders_txn(chat.id._serialized, chat.name, chat.isGroup, MessagesTable.id, folderUUID);
    await db.mbody_txn(rd_uuidv, message.body);
                    
    if (!message.fromMe) {
        const ContactID = await db.contacts_txn(contact.id._serialized, contact.name);
        const response = await axios.get((await contact.getProfilePicUrl()), { responseType: 'arraybuffer' });
        const AvatarData = Buffer.from(response.data, 'binary');
        const fSHA512 = crypto.createHash('sha512').update(AvatarData).digest('base64');

        let avatarData;
    
        let isContactKnown = false;
        if (contact.name !== undefined) {
            isContactKnown = true;
        }
        
        const contentF = await db.contentsAll_txn(rd_uuidv, AvatarData, ContactID, 4);
        if (contentF === null) {
            avatarData = "'" + AvatarData.toString('base64') + "'";
        } else {
            const JSON_str = [[contentF.reg, String(contentF.size), String(contentF.size), fSHA512]];
            avatarData = JSON.stringify(JSON_str);
        }
    
        let ContactINF = {
            WHATSAPP_ID: contact.id._serialized ,
            WHATSAPP_PHONE_NUMBER: await contact.getFormattedNumber(),
            WHATSAPP_AVATAR: avatarData,
            WHATSAPP_NAME: contact.name,
            WHATSAPP_SHORTNAME: contact.shortName,
            WHATSAPP_PUSHNAME: contact.pushname,
            WHATSAPP_BLOCKED: contact.isBlocked,
            WHATSAPP_KNOWN: isContactKnown
        };
        console.log("CONTACT INF:", ContactINF);
        console.log("chatname: ", chat.name);
    
        await db.contactattrs_txn(ContactINF, ContactID);
    }
});

client.on('message', async (message) => {
    let cmdstr = message.body.split(" ")[0];
    let handler = command[cmdstr];
    if (handler === undefined) {
        return;
    }

    if (! whitelist.includes(message.from)) {
        log.debug("Non-whitelisted sender:", message.from);
        return;
    }

    let chat = await message.getChat();
    let contact = await message.getContact();
    let preamble = log.fmt.preamble(message, contact, chat)

    let ret = await handler(message, contact, chat);
    let logret = 'undefined';
    if (ret !== undefined) {
        logret = ret.replaceAll("\n", "\\n");
    }
    log.command(preamble, message.body, "=>", logret);
});

// example.js'den reject calls kodu
client.on('call', async (call) => {
    log.voice('Rejecting call', call);
    await call.reject();
    await client.sendMessage(call.from, `[${call.fromMe ? 'Outgoing' : 'Incoming'}] Phone call from ${call.from}, type ${call.isGroup ? 'group' : ''} ${call.isVideo ? 'video' : 'audio'} call. ${rejectCalls ? 'This call was automatically rejected by the script.' : ''}`);
});

/*
 * main
 */

console.log(process.argv);
if (process.argv.length == 3 && process.argv[2] === 'devel') {
    log.status("Booting devel ...");
    client.initialize();
}
else if (process.argv.length == 3 && process.argv[2] === 'prod') {
    log.status("Booting prod ...");
    log.debug = (...args) => {};
    client.initialize();

}
else if (process.argv.length > 3 && process.argv[2] === 'cmd') {
    let message = {
        body: process.argv[3],
        from: config.usergroup,
        timestamp: (new Date()) / 1000,
        reply: (s) => {},
    };
    let contact = {};
    let chat = {};
    let preamble = log.fmt.preamble(message, contact, chat)

    let cmdstr = message.body.split(" ")[0];
    let handler = command[cmdstr];
    if (handler === undefined) {
        log.command("ERROR: No handler found");
    }
    else {
        handler(message, contact, chat).then((ret) => {
            log.command(preamble, message.body, "=>", ret.replaceAll("\n", "\\n"));
        });
    }
}