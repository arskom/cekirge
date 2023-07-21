//database manipulasyonu icin burayi kullanacagim
const sqlite3 = require('sqlite3').verbose();

function openDatabase(str) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database('/home/kene/data/profiles/onat@sobamail.com/' + str, sqlite3.OPEN_READWRITE, (err) => {
      if (err) {
        reject(err);
      } else {
        console.log("DB connection successful");
        resolve(db);
      }
    });
  });
}

function closeDatabase(db) {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) {
        reject(err);
      } else {
        console.log("DB closed");
        resolve();
      }
    });
  });
}

async function add_message_txn (message, uuid, folder, mimeID, timestamp, sender, recipient, files) {
  try {
    console.log("MESSAGE UUID: ", uuid);
    folder = 'onat@arskom.net:apps/Chat/' + folder;
    const date = new Date(timestamp*1000);
    let body_type = [['body-enc', 'UTF-8']];
    body_type = JSON.stringify(body_type);
    const db_main = await openDatabase('main.db');

    //messages tablosuna ekleme islemi
    db_main.run("INSERT INTO messages (uuid, local_state, read, mime_id, wdate, last_update, tzoffset, mimesize, body_type, sender, recipients, files, size) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [uuid, '[{}]', 0, mimeID, date.toISOString(), date.toISOString(), (date.getTimezoneOffset()*60), 0, body_type, sender, recipient, files, 0]);

    /* BURASI FOLDER HANDLING ---- BURASI FOLDER HANDLING ---- BURASI FOLDER HANDLING ---- BURASI FOLDER HANDLING ---- BURASI FOLDER HANDLING*/
    const row = await new Promise((resolve, reject) => {
      db_main.get("SELECT CASE WHEN EXISTS (SELECT 1 FROM folders WHERE name = ?) THEN 1 ELSE 0 END AS folder_exists;", [folder], (err, row) => {
        if (err) {
          reject (err);
        }
        else {
          resolve(row);
        }
      })
    });

    if (row.folder_exists !== 1){
      const createFolder = db_main.run("INSERT INTO folders (name) VALUES (?)", [folder]);
      console.log("NEW FOLDER CREATED");
    }

    const rows2 = await new Promise((resolve, reject) => {
      db_main.get("SELECT id FROM messages WHERE uuid = ?;", [uuid], (err, row) => {
        if (err) {
          reject (err);
        }
        else {
          resolve(row);
        }
      }
    )});

    const folderID = await new Promise((resolve, reject) => {
      db_main.get("SELECT id From folders WHERE name = ?", [folder], (err, row) => {
        if (err) {
          reject (err);
        }
        else {
          resolve (row);
        }
      })
    });

    const insert2folders = await new Promise ((resolve, reject) => {
      db_main.run("INSERT INTO msgfolders (mid, fid) VALUES (?,?)", [rows2.id, folderID.id], (err, row) => {
        if (err) {
          reject (err);
        }
        else {
          resolve (row);
        }
      })
    });
    /* BURASI FOLDER HANDLING BITTI ---- BURASI FOLDER HANDLING BITTI ---- BURASI FOLDER HANDLING BITTI ---- BURASI FOLDER HANDLING BITTI */
    
    await closeDatabase(db_main);

    //mbody tablosuna bilgileri ekle. DONE!!!
    const db_mbody = await openDatabase('mbody.db');
    db_mbody.run("INSERT INTO messages (uuid, data, type, enc) VALUES (?, ?, ?, ?)", [uuid, String(message), 2, 'UTF-8']);
    await closeDatabase(db_mbody);

    /*
    const db_contents = await openDatabase('blob1/contents.db');
    db_contents.run("INSERT INTO messages (uuid, data, type) VALUES (?, ?, ?)", [uuid, String(message), 5]); //type icin 5 degeri tamamen sallama
    await closeDatabase(db_contents);
    */
    
    console.log("add_msg_tsx CALİSTİ!!!");
  } catch (err) {
    console.error(err.message);
  }
}

async function getMessageIRT(mimeID) {
  console.log("1");
  const db_main = await openDatabase('main.db');
  console.log("2");
  const row = await new Promise ((resolve, reject) => {
    console.log("2.1");
    db_main.get("SELECT uuid FROM messages WHERE mime_id = ?;", [mimeID], (err, row) => {
      console.log("2.2", err, row);
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
  console.log("3");
  await closeDatabase(db_main);
  console.log("ROW: ", row);
  return row.uuid;
}

async function msgIRT_txn (irtMUUID, mimeIRT, msgUUID) {
  const db_main = await openDatabase('main.db');
  console.log("msgUUID:", msgUUID);
  await db_main.run("UPDATE messages SET in_reply_to = ?, mime_irt = ? WHERE uuid = ?", [irtMUUID, mimeIRT, msgUUID]);

  await closeDatabase(db_main);
}

async function doesExists (mime_id){
  const db_main = await openDatabase('main.db');

  const row = await new Promise((resolve, reject) => {
    db_main.get("SELECT CASE WHEN EXISTS (SELECT 1 FROM messages WHERE mime_id = ?) THEN 1 ELSE 0 END AS mimeID", [mime_id], (err, row) => {
      if (err) {
        reject (err);
      }
      else {
        resolve(row);
      }
    })
  });
  console.log("row.mimeID:", row.mimeID);
  if (row.mimeID === 0){
    return null;
  }
  await closeDatabase(db_main); 

  return row.mimeID;
}

async function headers_txn (uuid, header) {
  const db_main = await openDatabase('main.db');
  await db_main.run("UPDATE messages SET headers = ? WHERE uuid = ?", [header, uuid]);
  await closeDatabase(db_main); 
}

async function doesExistInContents (msgData) {
  const db_contents = await openDatabase('blob1/contents.db');
  const row = await new Promise((resolve, reject) => {
    db_contents.get("SELECT CASE WHEN EXISTS (SELECT 1 FROM blobs WHERE sha512 = ?) THEN 1 ELSE 0 END AS sha512;", [msgData], (err, row) => {
      if (err) {
        reject (err);
      }
      else {
        resolve(row);
      }
    })
  });
  await closeDatabase(db_contents);
  return row.sha512;
}

async function body_blob_txn (uuid, blob) {
  const db_main = await openDatabase('main.db');
  await db_main.run("UPDATE messages SET body_blob = ? WHERE uuid = ?", [blob, uuid]);
  await closeDatabase(db_main); 
}

async function preview_txn (uuid, body) {

  const encoder = new TextEncoder();
  const bodyTo8byte = encoder.encode(body);
  body = bodyTo8byte.slice(0, 256);

  const db_main = await openDatabase('main.db');
  await db_main.run("UPDATE messages SET preview = ? WHERE uuid = ?", [body, uuid]);
  await closeDatabase(db_main); 
}

async function files_txn (uuid, files) {
  const db_main = await openDatabase('main.db');
  await db_main.run("UPDATE messages SET files = ? WHERE uuid = ?", [blob, uuid]);
  await closeDatabase(db_main); 
}

async function createContent_txn(uuid, data, type, csha256, partype, parsubid, blob_id, size, csize, sha512) {
  /*
  if (!(data instanceof Buffer)) {
    console.log("data: ", data);
    data = new TextEncoder("utf-8").encode(data);
    console.log("data: ", data);
    data = Buffer.from(data.buffer);
  }

  console.log("data: ", data);
  console.log("data type: ", typeof(data));
  console.log("csha256: ", csha256);
  console.log("csha256 type: ", typeof(csha256));
 */
  const db_contents = await openDatabase('blob1/contents.db');
  const row = await new Promise((resolve, reject) => {
    db_contents.get(
      "INSERT INTO blob_data (compression, type, data, csha256) VALUES (?,?,?,?) RETURNING id",
                                                       [0, type, data, csha256],
      (err, row) => {
        if (err) {
          reject (err);
        }
        else {
          resolve(row);
        }
      })
    });

  await db_contents.run(
    "INSERT INTO blobs (partype, parid, parsubid, blob_id, size, csize, sha512, data_id) VALUES (?,?,?,?,?,?,?,?)",
               [partype, uuid, parsubid, blob_id, size, csize, sha512, row.id]);
  await closeDatabase(db_contents);
}

async function UpdateContents (uuid, hash) {
  const db_contents = await openDatabase('blob1/contents.db');

  const row = await new Promise((resolve, reject) => {
    db_contents.get("SELECT * FROM blobs WHERE sha512 = ?;", [hash], (err, row) => {
      if (err) {
        reject (err);
      }
      else {
        resolve(row);
      }
    })
  });
  
  db_contents.run("INSERT INTO blobs (partype, parid, parsubid, blob_id, size, csize, sha512, data_id) VALUES (?,?,?,?,?,?,?,?)", [row.partype, uuid, row.parid, row.blob_id, row.size, row.csize, row.sha512, row.data_id]);

  await closeDatabase(db_contents);
  console.log("ROW: ", row);  
}

module.exports.getMessageIRT = getMessageIRT;
module.exports.add_message_txn = add_message_txn;
module.exports.msgIRT_txn = msgIRT_txn;
module.exports.doesExists = doesExists;
module.exports.headers_txn = headers_txn;
module.exports.body_blob_txn = body_blob_txn;
module.exports.files_txn = files_txn;
module.exports.doesExistInContents = doesExistInContents;
module.exports.preview_txn = preview_txn;
module.exports.createContent_txn = createContent_txn;
module.exports.UpdateContents = UpdateContents;
