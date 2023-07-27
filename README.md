# Cekirge (grasshopper)

[Cekirge](https://github.com/arskom/cekirge) is a Node.js that imports WhatsApp data into a Sobamail data store using web-whatsapp-api.js library.

## Getting Started

1. Install dependencies: 

   ```bash
   git clone https://github.com/arskom/cekirge
   cd cekirge
   npm install
   ```

2. Config file is optional.

3. Run the project:

    ```bash
    node main.js devel
    ```

4. If everything went well, you should see a QR code printed on your terminal. Use it to link your WhatsApp account.

Once linked, you should see the database files being populated with incoming messages.
