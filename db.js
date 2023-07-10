//database manipulasyonu icin burayi kullanacagim
const sqlite3 = require('sqlite3').verbose();

function openDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database('./wwdata.db', sqlite3.OPEN_READWRITE, (err) => {
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

async function qry_msg(message, uuid) {
  try {
    const db = await openDatabase();

    console.log("DB AÇIK QRY FONKSİYONU ÇALIŞIYOR");
    const escapedMessage = String.raw`${message}`;
    const escapedUuid = String.raw`${uuid}`;
    console.log("message qry: " + message);
    console.log("uuid qry:" + uuid);
    db.run("INSERT INTO messages (uuid, body) VALUES (?, ?)", [escapedUuid, escapedMessage]);

    await closeDatabase(db);
  } catch (err) {
    console.error(err.message);
  }
}

module.exports = qry_msg;