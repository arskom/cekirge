const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const convert = require('./converters');
const path = require('path');
const fs = require('fs');

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

async function add_message_txn (uuid, mimeID, timestamp, sender, recipient, files, irtMUUID, mimeQuoted, header, preview, bodyBlob) {
  try {
    console.log("MESSAGE UUID: ", uuid);
    const date = new Date(timestamp*1000);
    let body_type = [['body-enc', 'UTF-8']];
    body_type = JSON.stringify(body_type);

    const db_main = await openDatabase('main.db');

    //messages tablosuna ekleme islemi
    const rows2 = await new Promise((resolve, reject) => {
      db_main.get("INSERT INTO messages (uuid, local_state, read, mime_id, wdate, last_update, tzoffset, mimesize, body_type, sender, recipients, files, size, in_reply_to, mime_irt, headers, preview, body_blob) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING *;", 
                              [uuid, '[{}]', 0, mimeID, date.toISOString(), date.toISOString(), (date.getTimezoneOffset()*60), 0, body_type, sender, recipient, files, 0, irtMUUID, mimeQuoted, header, preview, bodyBlob], (err, row) => {
        if (err) {
          reject (err);
        }
        else {
          resolve(row);
        }
      }
    )});

    await closeDatabase(db_main);

    console.log("add_msg_tsx CALİSTİ!!!");
    return rows2;
  } catch (err) {
    console.error(err.message);
  }
}

async function folders_txn (ChatID, ChatName, isGroup, mID, uuid) {
  const db_main = await openDatabase('main.db');

  if (isGroup) {
    console.log("This is a Group Chat.");
    const row = await new Promise((resolve, reject) => {
      db_main.get("SELECT CASE WHEN EXISTS (SELECT 1 FROM folderattrs WHERE val = ?) THEN 1 ELSE 0 END AS folder_exists;", [ChatID], (err, row) => {
        if (err) {
          reject (err);
        }
        else {
          resolve(row);
        }
      })
    });
    if (row.folder_exists === 1){
      console.log("Folder exists.");
      const folderattrs = await new Promise((resolve, reject) => {
        db_main.get("SELECT fid, key FROM folderattrs WHERE val = ?", [ChatID], (err, row) => {
          if (err) {
            reject (err);
          }
          else {
            resolve(row);
          }
        })
      });

      await db_main.run("UPDATE folderattrs SET key = ? WHERE fid = ?", [ChatName, folderattrs.fid]);
      await db_main.run("UPDATE folders SET name = ? WHERE id = ?", ['onat@arskom.net:apps/Chat/' + ChatName, folderattrs.fid]);
      await db_main.run("INSERT INTO msgfolders (mid, fid) VALUES (?,?)", [mID, folderattrs.fid]);
    } 
    else {
      console.log("Folder does not exist.");
      const folders = await new Promise((resolve, reject) => {
        db_main.get("INSERT INTO folders (name, uuid) VALUES (?,?) RETURNING *;", ['onat@arskom.net:apps/Chat/' + ChatName, uuid], (err, row) => {
          if (err) {
            reject (err);
          }
          else {
            resolve(row);
          }
        })
      });

      console.log("folders: ", folders);
      console.log("folders id: ", folders.id);

      await db_main.run("INSERT INTO folderattrs (fid,key,val) VALUES (?,?,?)", [folders.id, ChatName, ChatID]);
      await db_main.run("INSERT INTO msgfolders (mid, fid) VALUES (?,?)", [mID, folders.id]);
      console.log("NEW FOLDER CREATED");
    }
  } 
  else {
    db_main.run("INSERT INTO msgfolders (mid, fid) VALUES (?,?)", [mID, 8]);
  }
  await closeDatabase(db_main);
}

async function mbody_txn(uuid, messageBody) {
    const db_mbody = await openDatabase('mbody.db');
    db_mbody.run("INSERT INTO messages (uuid, data, type, enc) VALUES (?, ?, ?, ?)", [uuid, messageBody, 2, 'UTF-8']);
    await closeDatabase(db_mbody);
   
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

async function quotedMessageIsInDb (mime_id){
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

async function createContent_txn(uuid, data, type, csha256, partype, parsubid, blob_id, size, csize, sha512) {
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
  return row.id;
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
  
  db_contents.run("INSERT INTO blobs (partype, parid, parsubid, blob_id, size, csize, sha512, data_id) VALUES (?,?,?,?,?,?,?,?) RETURNING *", [row.partype, uuid, row.parid, row.blob_id, row.size, row.csize, row.sha512, row.data_id]);

  await closeDatabase(db_contents);
  console.log("ROW: ", row);  
  return row;
}

async function getContentID (sha512) {
  const db_contents = await openDatabase('blob1/contents.db');
  const row = await new Promise((resolve, reject) => {
    db_contents.get("SELECT data_id FROM blobs  WHERE sha512 = ?", [sha512], (err, row) => {
      if (err) {
        reject (err);
      }
      else {
        resolve(row);
      }
    })
  });
  await closeDatabase(db_contents);
  return row.data_id;
}

async function contentsAll_txn (uuid, RawData, cid, partype) {
  const hash_SHA512 = crypto.createHash('sha512').update(RawData).digest();
  const hash_SHA256 = crypto.createHash('sha256').update(RawData).digest();
  const regex = convert.createRegex();
  let type;
  let data;
  const db_contents = await openDatabase('blob1/contents.db');
  console.log(await doesExistInContents(hash_SHA512));
  const sizeInBytes = new TextEncoder().encode(RawData).byteLength;
  if (sizeInBytes <= 512) {
    await closeDatabase(db_contents);
    return null;
  }

  if ((await doesExistInContents(hash_SHA512)) === 1) {
    console.log("BLOB EXISTS!");
    const row = await UpdateContents(uuid, hash_SHA512);
    await closeDatabase(db_contents);
    return {size: sizeInBytes, sha512: hash_SHA512, ContentID: row.data_id, reg: regex};
  }
  else {
    console.log("BLOB DOES NOT EXIST!");
    if (sizeInBytes > 16384) {
      type = 2;
      const fileData = Buffer.from(RawData, 'base64');
      console.log("fileData: ", fileData);
      let filePATH = (await convert.insertCharacterAtIndex(regex)) + '.0';
      const fileName = filePATH.slice(12);
      filePATH = filePATH.slice(0,12);
      const finalPath = path.join(filePATH, fileName);
      const directory = '/home/kene/data/profiles/onat@sobamail.com/blob1/';
      const dbPATH = 'blob1/' + finalPath;
      data = dbPATH;
      console.log("dbPATH: ", dbPATH);

      fs.mkdirSync(path.dirname(directory + finalPath), { recursive: true }, (err) => {
        if (err) {
          console.error(err);
        } else {
          console.log('Directory created successfully!');
        }
      });
      
      fs.writeFile(directory + finalPath, fileData,  (err) => {
        if (err) {
          console.error(err);
        } else {
          console.log('File written successfully!');
        }
      });
    }
    else {
      type = 1;
      data = RawData;
    }

    const contentID = await createContent_txn(uuid, data, type, hash_SHA256,
      partype, cid, regex, sizeInBytes, sizeInBytes, hash_SHA512);
    await closeDatabase(db_contents);
    return {size: sizeInBytes, sha512: hash_SHA512, contentID: contentID, reg: regex};
  }
}

async function contactattrs_txn (contact, cid) {
  console.log("contact info acildi");
  const db_main = await openDatabase('main.db');
  db_main.serialize(function() {
    db_main.run("DELETE FROM contactattrs WHERE cid = ?", [cid]);
    db_main.run("INSERT INTO contactattrs (cid, key, val) VALUES (?,?,?) --1", [cid, 'whatsapp-id', contact.WHATSAPP_ID]);
    if ( contact.WHATSAPP_PHONE_NUMBER !== undefined) {
      db_main.run("INSERT INTO contactattrs (cid, key, val) VALUES (?,?,?) --2", [cid, 'whatsapp-phone-number', contact.WHATSAPP_PHONE_NUMBER]);
    }
    if ( contact.WHATSAPP_AVATAR !== undefined) {
      db_main.run("INSERT INTO contactattrs (cid, key, val) VALUES (?,?,?) --3", [cid, 'whatsapp-avatar', contact.WHATSAPP_AVATAR]);
    }
    if ( contact.WHATSAPP_NAME !== undefined) {
      db_main.run("INSERT INTO contactattrs (cid, key, val) VALUES (?,?,?) --4", [cid, 'whatsapp-name',  contact.WHATSAPP_NAME]);
    }
    if ( contact.WHATSAPP_SHORTNAME !== undefined) {
      db_main.run("INSERT INTO contactattrs (cid, key, val) VALUES (?,?,?) --5", [cid, 'whatsapp-short-name',  contact.WHATSAPP_SHORTNAME]);
    }
    if ( contact.WHATSAPP_PUSHNAME !== undefined) {
      db_main.run("INSERT INTO contactattrs (cid, key, val) VALUES (?,?,?) --6", [cid, 'whatsapp-push-name',  contact.WHATSAPP_PUSHNAME]);
    }
    if ( contact.WHATSAPP_BLOCKED !== undefined) {
      db_main.run("INSERT INTO contactattrs (cid, key, val) VALUES (?,?,?) --7", [cid, 'whatsapp-blocked',  contact.WHATSAPP_BLOCKED]);
    }
    if ( contact.WHATSAPP_KNOWN !== undefined) {
      db_main.run("INSERT INTO contactattrs (cid, key, val) VALUES (?,?,?) --8", [cid, 'whatsapp-known',  contact.WHATSAPP_KNOWN]);
    }
  });
  await closeDatabase(db_main);
}

async function contacts_txn (wpID, wpName) {
  console.log("Contacts txn begins...");
  if (wpName === undefined) {
    wpName = null;
  }
  const db_main = await openDatabase('main.db');
  const contactRow = await new Promise((resolve, reject) => {
    db_main.get("SELECT cid FROM contactattrs WHERE key='whatsapp-id' and val=?", [wpID], (err, row) => {
      if (err) {
        reject (err);
      }
      else {
        resolve(row);
      }
    })
  });

  let retval;
  if (contactRow !== undefined && contactRow.cid !== undefined) {
    console.log("Contact is in database.")
    retval = contactRow.cid;
    await db_main.run("UPDATE contacts SET name = ? WHERE id = ?", [wpName, retval]);
    console.log("Contact updated.");
    console.log("Contact ID: ", retval);
    await closeDatabase(db_main);
    return retval;
  } 
  else {
    console.log("Contact is not in database.")
    const row = await new Promise((resolve, reject) => {
      db_main.get("INSERT INTO contacts (name, iscoll) VALUES (?,?) RETURNING id;", [wpName, true], (err, row) => {
        if (err) {
          reject (err);
        }
        else {
          resolve(row);
        }
      })
    });
    retval = row.id
    console.log("Contact inserted.");
    console.log("Contact ID: ", retval);
    await closeDatabase(db_main);
    return retval;
  }
}

module.exports.getMessageIRT = getMessageIRT;
module.exports.add_message_txn = add_message_txn;
module.exports.quotedMessageIsInDb = quotedMessageIsInDb;
module.exports.doesExistInContents = doesExistInContents;
module.exports.createContent_txn = createContent_txn;
module.exports.UpdateContents = UpdateContents;
module.exports.getContentID = getContentID;
module.exports.contactattrs_txn = contactattrs_txn;
module.exports.contentsAll_txn = contentsAll_txn;
module.exports.contacts_txn = contacts_txn;
module.exports.mbody_txn = mbody_txn;
module.exports.folders_txn = folders_txn;