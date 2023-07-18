
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
const hd = require ('./header');
const uuidv4 = require('uuid').v4;

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

    console.log("sender: ", hd.senderJSON(message.from, fromName));
    console.log("sender type : ", typeof(hd.senderJSON(message.from, fromName)));
    
    const sender = await hd.senderJSON(message.from, fromName);
    console.log("name:  ", client.info.pushname);
    let rd_uuidv = uuidv4();
    console.log("CHAT NAME:" + chat.name);
    db.add_message_txn(message.body, rd_uuidv, chat.name, message._data.id._serialized, message.timestamp, sender); //database imp demo

    let irtMUUID = '{00000000-0000-0000-0000-000000000000}';
    console.log("hasQuotedMsg: ", message.hasQuotedMsg);
    if (message.hasQuotedMsg) { //database'te kayitli olan ve cevap verilen mesajlar icin
        const mimeQuoted = (await message.getQuotedMessage())._data.id._serialized;
        const mimeQQ = await db.doesExists(mimeQuoted);
        if(mimeQQ === 1){
            irtMUUID = await db.getMessageIRT(mimeQuoted);
            db.msgIRT_txn(irtMUUID, mimeQuoted, rd_uuidv);
        } else {
            console.log("alinti yapilan mesaj database'e dahil degil !!!");
        }
    } else {
        db.msgIRT_txn(irtMUUID, null, rd_uuidv);
    }

    console.log("author: ", message.author);
    console.log("from: ", message.from);

    if ((await message.getChat()).isGroup){
        const header = hd.hd4Groups(message.from, fromName, message.to, toName, message.author, authorName, message.to);
        console.log("header type: ", header);
        db.headers_txn(rd_uuidv, header);
    } else {
        recipients = message.to;
        const header = await hd.hd4Direct(message.from, fromName, message.to);
        console.log("header: ", header);
        db.headers_txn(rd_uuidv, header);

    }

    //console.log(rd_uuidv, message.body, message.timestamp, chat.name, message._data.id._serialized, message.timestamp);
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