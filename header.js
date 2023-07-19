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

function bodyBlobJason (body) {
    const retval = [[2, [body]]];
    return JSON.stringify(retval);
}

function convertToBase64(text) {
    const retval = Buffer.from(text, 'utf8');
    return retval.toString('base64');
}

module.exports.hd4Groups = hd4Groups;
module.exports.hd4Direct = hd4Direct;
module.exports.senderJSON = senderJSON;
module.exports.recipientJSON = recipientJSON;
module.exports.bodyBlobJason = bodyBlobJason;
module.exports.convertToBase64 = convertToBase64;