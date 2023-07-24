function hd4Groups (from, fromName, to, toName, author, authorName, listID) {
    const hd = [["From", [fromName, from]],["To", [toName, to]],["Author", [authorName, author]],["List-ID", [listID]]];
    return JSON.stringify(hd);
}

function hd4Direct (from, fromName, to) {
    const hd = [["From", [fromName, from]],["To", ["",to]]];
    return JSON.stringify(hd);
}

function senderJSON (senderID, senderName) {
    const retval = [[senderName, senderID]];
    return JSON.stringify(retval);
}

function recipientJSON (rcpID, rcpName) {
    const retval = [[rcpName, rcpID]];
    return JSON.stringify(retval);
}

function bodyBlobJSON (blobID, size, csize, sha512) {
    const retval = [[2, [[blobID, String(size), String(csize), String(sha512)]]]];
    return JSON.stringify(retval);
}

function filesJSON (fileName, mimeType, blobID, size, csize, sha512, contentID) {
    let retval;
    if (fileName === null || fileName === undefined || fileName === "") {
        retval = [["", mimeType, [blobID, String(size), String(csize), String(sha512)], String(contentID),""]];
    } else {
        retval = [[String(fileName), mimeType, [blobID, String(size), String(csize), String(sha512)], String(contentID),""]];
    }
    return JSON.stringify(retval);
}

function convertToBase64(text) {
    const retval = Buffer.from(text, 'utf8');
    return retval.toString('base64');
}

function insertCharacterAtIndex(text) {
    text = text.substring(0, 9) + '/' + text.substring(9);
    text = text.substring(0, 6) + '/' + text.substring(6);
    text = text.substring(0, 3) + '/' + text.substring(3);
    console.log("PATH : " , text);
    return text;
}

function createRegex () {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUV0123456789';

    let randomString = '';

    for (let i = 0; i < 16; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        randomString += characters.charAt(randomIndex);
    }

    return randomString;
}

function stringToHex(str) {
    const buffer = Buffer.from(str, 'utf8');
    let hexString = '';
    for (let i = 0; i < buffer.length; i++) {
      const hexValue = buffer[i].toString(16).toUpperCase().padStart(2, '0');
      hexString += hexValue + ' ';
    }
    console.log(hexString, typeof(hexString));
    return hexString.trim(); // Remove the trailing space
}


module.exports.hd4Groups = hd4Groups;
module.exports.hd4Direct = hd4Direct;
module.exports.senderJSON = senderJSON;
module.exports.recipientJSON = recipientJSON;
module.exports.bodyBlobJSON = bodyBlobJSON;
module.exports.convertToBase64 = convertToBase64;
module.exports.insertCharacterAtIndex = insertCharacterAtIndex;
module.exports.createRegex = createRegex;
module.exports.filesJSON = filesJSON;