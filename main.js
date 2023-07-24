
/*
 * hazirlik
 */


"use strict";

const {TvApiAdapter} = require('tradingview-api-adapter');
const QRCode = require('qrcode-terminal');
const { Client, LocalAuth, MessageAck } = require('whatsapp-web.js');
const assert = require('node:assert');
const process = require('node:process');

const config = require('./config.json');
assert(config.statusgroup !== undefined);

let whitelist = [config.statusgroup];
if (config.usergroup !== undefined) {
    whitelist.push(config.usergroup);
}
if (config.usergroups !== undefined) {
    config.usergroups.forEach((e) => {
        assert(typeof e === 'string');
        whitelist.push(e);
    });
}

console.log("whitelist:", whitelist);

const db = require ('./db.js');
const convert = require ('./converters');
const uuidv4 = require('uuid').v4;
const crypto = require('crypto');

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
 * tview
 */

const tview = {
    // TODO: bu veriyi biyerden bulup doldurmak lazim
    sources: {
        BTCUSD: "BINANCE",
        XU100: "BIST",
        USDTRY: "FX_IDC",
        EURTRY: "FX_IDC",
        EURUSD: "FX_IDC",
    },

    get: (symbol, source) => {
        let retval = new Promise(resolve => {
            let quoter = (new TvApiAdapter()).Quote(symbol, source, ['lp', 'ch', 'chp']);
            quoter.listen(data => {
                resolve(data);
                quoter.pause();
                // FIXME: quoter leak
            });
        });

        return retval;
    },
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
});

client.on('qr', (qr) => {
    log.status("Got QR");
    QRCode.generate(qr, {small: true});
});

client.on('ready', async () => {
    log.status("Ready");
    await biara(() => { client.sendMessage(config.statusgroup, "hop"); });
});

client.on('message_create', async (message) => {
    if (message.isStatus) {
        return;
    }

    let cmdstr = message.body.split(" ")[0];
    if (command.exists(cmdstr) && whitelist.includes(message.from)) {
        return;
    }

    let chat = await message.getChat();
    let contact = await message.getContact();
    let preamble = log.fmt.preamble(message, contact, chat)

    log.debug(message);
    log.message(preamble, message.body); 

    let fromName = '';
    let toName = '';
    let authorName = null;
    if(message.fromMe){
        fromName = client.info.pushname;
        authorName = client.info.pushname;
        toName = (await message.getChat()).name;
    } else {
        fromName = (await message.getChat()).name;
        toName = client.info.pushname;
        authorName = (await message.getContact()).pushname;
    }

    let rd_uuidv = '{' + uuidv4() + '}';

    let irtMUUID = '{00000000-0000-0000-0000-000000000000}';
    let mimeQuoted = null;
    if (message.hasQuotedMsg) { //database'te kayitli olan ve cevap verilen mesajlar icin
        mimeQuoted = (await message.getQuotedMessage())._data.id._serialized;
        const mimeQQ = await db.doesExists(mimeQuoted);
        if(mimeQQ === 1){
            irtMUUID = await db.getMessageIRT(mimeQuoted);
        }
    }

    let header = '[]';
    if ((await message.getChat()).isGroup){
        header = convert.hd4Groups(message.from, fromName, message.to, toName, message.author, authorName, message.to);
    } else {
        header = convert.hd4Direct(message.from, fromName, message.to);
    }
    
    // If message is not empty, do fill body_blob and preview columns in database
    let bodyBlob = null;
    let preview = null;
    if (message.body !== null && message.body !== undefined && message.body !== ''){
        const encoder = new TextEncoder();
        const bodyTo8byte = encoder.encode(message.body);
        preview = bodyTo8byte.slice(0, 256);

        const hash_SHA512 = crypto.createHash('sha512').update(message.body).digest();
        const mHash_SHA512 = crypto.createHash('sha512').update(message.body).digest('base64');
        const hash_SHA256 = crypto.createHash('sha256').update(message.body).digest();

        const mBodyBlobID = convert.createRegex();

        const encodedText = encoder.encode(message.body);
        let mSize = encodedText.byteLength;

        if ((await db.doesExistInContents(hash_SHA512)) === 1){ //VAR MI YOK MU?
            await db.UpdateContents(rd_uuidv, hash_SHA512);
        }
        else {
            console.log("SIZE IN BYTES: ", mSize);
            const data = new TextEncoder("utf-8").encode(message.body);
            const fileData = Buffer.from(data.buffer);
            console.log("BLOB_ID: ", mBodyBlobID);
            if (mSize >= 16384) {
                const type = 2;
                const filePATH = './home/kene/data/profiles/onat@sobamail.com/blob1/' + (await convert.insertCharacterAtIndex(mFileBlobID)) + '.0';

                /*
                fs.mkdirSync(filePATH, { recursive: true }, (err) => {
                    if (err) {
                      console.error('Error creating directory:', err);
                    } else {
                      console.log('Directory created:', directoryPath);
                    }
                });

                fs.writeFile(filePATH, fileData, (err) => {
                    if (err) {
                      console.error('Error writing to file:', err);
                    } else {
                      console.log('File created and data written successfully!');
                    }
                });
                */

                await db.createContent_txn(rd_uuidv, filePATH, type, hash_SHA256,
                    3, 2, mBodyBlobID, mSize, mSize, hash_SHA512);
            }
            else {
                const type = 1;
                await db.createContent_txn(rd_uuidv, fileData, type, hash_SHA256,
                          3, 2, mBodyBlobID, mSize, mSize, hash_SHA512);
            }
        }
        bodyBlob = convert.bodyBlobJSON(mBodyBlobID, mSize, mSize, mHash_SHA512);
    }

    let files = '[]';
    if (message.hasMedia) {
        const fmimetype = (await message.downloadMedia()).mimetype;
        const media_data = (await message.downloadMedia()).data;
        const ffilename = (await message.downloadMedia()).fileName;

        const hash_SHA512 = crypto.createHash('sha512').update(media_data).digest();
        const fSHA512 = crypto.createHash('sha512').update(media_data).digest('base64');
        const hash_SHA256 = crypto.createHash('sha256').update(media_data).digest();

        const mFileBlobID = convert.createRegex();
        let sizeInBytes = 0;
        if ((await db.doesExistInContents(hash_SHA512)) === 1) {
            console.log("CONTENT EXISTS!");
            await db.UpdateContents(rd_uuidv, hash_SHA512);
        } else {
            console.log("CONTENT DOES NOT EXISTS!!!");
            const encoder = new TextEncoder();
            const encodedText = encoder.encode(media_data);
            sizeInBytes = encodedText.byteLength;
            console.log("SIZE IN BYTES: ", sizeInBytes);

            console.log("BLOB_ID: ", mFileBlobID);
            if (sizeInBytes >= 16384) {
                const type = 2;
                const data = new TextEncoder("utf-8").encode(media_data);
                const fileData = Buffer.from(data.buffer);
                const filePATH = (await convert.insertCharacterAtIndex(mFileBlobID)) + '.0';
                const directory = './home/kene/data/profiles/onat@sobamail.com/blob1/';

                /*
                await fs.mkdirSync(directory + filePATH);
                await fs.writeFileSync(path.join(directory, filePATH), fileData);
                */

                await db.createContent_txn(rd_uuidv, filePATH, type, hash_SHA256,
                    2, 3, mFileBlobID, sizeInBytes, sizeInBytes, hash_SHA512);
            }
            else {
                console.log("DATA KUCUK!!!");
                const type = 1;
                let data = new TextEncoder("utf-8").encode(media_data);
                data = Buffer.from(data.buffer);
                await db.createContent_txn(rd_uuidv, data, type, hash_SHA256,
                          2, 3, mFileBlobID, sizeInBytes, sizeInBytes, hash_SHA512);
            }
        }
        const contentID = await db.getContentID(hash_SHA512);
        console.log("contentID: ", contentID);
        files = convert.filesJSON(ffilename, fmimetype, mFileBlobID, sizeInBytes, sizeInBytes, fSHA512, contentID);
    }


    await db.add_message_txn(message.body, rd_uuidv, chat.name, message._data.id._serialized, 
        message.timestamp, convert.senderJSON(message.from, fromName), 
                    convert.recipientJSON(message.to, toName), files, irtMUUID, mimeQuoted, header, preview, bodyBlob); //database imp demo
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
