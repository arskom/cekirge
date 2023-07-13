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
    console.log("uuid qry: " + uuid);
    console.log("chat name: " + folder);
    const db_main = await openDatabase('main.db');

    //const is_folderExist = db_main.get("SELECT CASE WHEN EXISTS (SELECT 1 FROM messages WHERE folder = ? ) THEN TRUE ELSE FALSE END", ['onat@arskom.net:apps/Chat/' + folder] );
    /*
    function is_folderExist (folder) {
      const row = await db_main.get("SELECT CASE WHEN EXISTS (SELECT 1 FROM messages WHERE folder = ?) THEN 1 ELSE 0 END AS folder_exists;", ['onat@arskom.net:apps/Chat/' + folder] );
      const boo = row.folder_exists === 1;
      console.log("BU OBJE ICINDE:" + boo);
      return boo;
    } 
    */

    const row = await db_main.get("SELECT CASE WHEN EXISTS (SELECT 1 FROM messages WHERE folder = ?) THEN 1 ELSE 0 END AS folder_exists;", ['onat@arskom.net:apps/Chat/' + folder] );
    const boo = row.folder_exists === 1;
    console.log("row: " + row);
    console.log("boo:" + boo);

    if (!!boo){
      db_main.run("INSERT INTO folders (name) VALUES (?)", ['onat@arskom.net:apps/Chat/' + folder]);
    }
    
    //const checkFolder = is_folderExist(folder);
    //console.log(is_folderExist(folder));


    db_main.run("INSERT INTO messages (uuid, local_state) VALUES (?,?)", [uuid, '[{}]' ]);
    await closeDatabase(db_main);

    const db_mbody = await openDatabase('mbody.db'); //DONE
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