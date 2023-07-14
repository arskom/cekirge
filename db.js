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

async function add_message_txn (message, uuid, folder) {
  try {
    console.log("message qry: " + message);
    
    console.log("chat name: " + folder);

    uuid = "{" + uuid + "}";
    folder = 'onat@arskom.net:apps/Chat/' + folder;
    console.log("uuid qry: " + uuid);
    console.log("uuid qry type: " + typeof(uuid));
    console.log(folder);

    const db_main = await openDatabase('main.db');

    //messages tablosuna ekleme islemi
    db_main.run("INSERT INTO messages (uuid, local_state) VALUES (?,?)", [uuid, '[{}]']);

    //folder yoksa uret
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
    
    console.log("folder var mi: ", row.folder_exists);

    if (row.folder_exists !== 1){
      const createFolder = db_main.run("INSERT INTO folders (name) VALUES (?)", [folder]);
      console.log("if folder....... CALİSTİ");
    }

    //eklenen mesajın uuid'si sayesinde id'sini cek, folder'in id'sini cek, ikisini msgfolders tablosuna ekle
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
    console.log("mID: " + rows2.id);

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
    console.log("fID: " + folderID.id);
    
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
  
  } catch (err) {
    console.error(err.message);
  }
}

/*
async function getUuidFromData (quotedMsg) {
  const db_mbody = await openDatabase('mbody.db');
  const retval = db_mbody.get("SELECT uuid FROM messages WHERE mime_id = ?", [quotedMsg._serialized]);
  await closeDatabase(db_mbody);
  return retval;
}
*/  //VAKTI GELINCE DONULECEK!

module.exports = add_message_txn;
//module.exports = getUuidFromData;