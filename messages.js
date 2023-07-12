function get_message_info (uuid, message) {

}

const convertedForMain = {
    uuid: " ",
    in_reply_to: " ",
    folder: "",
    read: 0,
    localState: "[{}]", //sabit
    mimeID: " ",
    mimeIRT: " ",
    lastUpdate: " ",
    wdate: " ",
    tzoffset: 0,
    files: " ",
    body_blob: " ",
    size: 0,
    sender: " ",
    recipients: " ",    //sabit
    subject: null,
    head: " ",
    type: 2,    //sabit
    body_type: " ",
    spam_score: 0,  //sabit
    preview: " ",
};

const convertedForMbody = {
    uuid: "",
    type: 2,
    data: "",
    enc: "UTF-8" //sabit
};

const convertedForContent = {
    partytype: 2, //sabit
    parid: "",
    parsudid: 0,
    blob_id: "", //BLOB
    shaft512: "", //BLOB
};