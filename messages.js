

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

function gmiForMain (uuid, message, folder) {
    const convertedForMain = {
        uuid: " ",
        //in_reply_to: " ",
        folder: "" ,
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

    convertedForMain.uuid = uuid;
    /*
    if (message.hasQuotedMsg) {
        in_reply_to = 
    }
    */
    convertedForMain.folder = "onat@arskom.net:apps/Chat/" + folder;
    
}