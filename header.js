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


module.exports.hd4Groups = hd4Groups;
module.exports.hd4Direct = hd4Direct;
module.exports.senderJSON = senderJSON;