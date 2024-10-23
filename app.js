const express = require("express");
const app = express();
require("dotenv").config();
const PCR = require("puppeteer-chromium-resolver");
const port = process.env.PORT || 3000;
const postApi = process.env.POST_API || "";
const qrcode = require("qrcode");
const cors = require("cors");
const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PCRoption = {
  revision: "",
  detectionPath: "",
  folderName: ".chromium-browser-snapshots",
  defaultHosts: [
    "https://storage.googleapis.com",
    "https://npm.taobao.org/mirrors",
  ],
  hosts: [],
  cacheRevisions: 2,
  retry: 3,
  silent: false,
};

const stats = PCR(PCRoption);

const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");

const puppeteer = {
  headless: true,
  args: [
    "--no-sandbox",
    // "--disable-setuid-sandbox",
    // "--disable-dev-shm-usage",
    // "--disable-accelerated-2d-canvas",
    // "--no-first-run",
    // "--no-zygote",
    // "--single-process",
    "--disable-gpu",
  ],
  executablePath: stats.executablePath,
};

console.log("Puppeteer path:", stats.executablePath);

const clientGenerator = (session, id) => {
  return new Client({
    session: session,
    authStrategy: new LocalAuth({ clientId: id }),
    puppeteer: puppeteer,
  });
};

const client1 = clientGenerator("./sessions/session1.json", "1");
const client2 = clientGenerator("./sessions/session2.json", "2");
const client3 = clientGenerator("./sessions/session3.json", "3");
const client4 = clientGenerator("./sessions/session4.json", "4");
const client5 = clientGenerator("./sessions/session5.json", "5");
const client6 = clientGenerator("./sessions/session6.json", "6");

clients = [
  { id: 1, client: client1, sessionPath: "./sessions/session1.json" },
  { id: 2, client: client2, sessionPath: "./sessions/session2.json" },
  { id: 3, client: client3, sessionPath: "./sessions/session3.json" },
  { id: 4, client: client4, sessionPath: "./sessions/session4.json" },
  { id: 5, client: client5, sessionPath: "./sessions/session5.json" },
  { id: 6, client: client6, sessionPath: "./sessions/session6.json" },
];

let qr_data = null;
let disconnected = true;

try {
  app.get("/", (req, res) => {
    res.send("Hello World! Please follow the documentration.");
  });

  app.get("/post", (req, res) => {
    const key = req.query.key;
    if (key == process.env.KEY) {
      res.sendFile(__dirname + "/index.html");
    } else {
      res.send("Invalid key");
    }
  });

  clients.forEach((client) => {
    let isInitialized = false;

    app.get(`/${client.id}`, (req, res) => {
      res.send(
        `API is not running! Please start the session by <a href=/${client.id}/init>Clicking here</a>.`
      );
    });

    app.get(`/${client.id}/init`, (req, res) => {
      // check if client is ready
      if (client.client.isReady) {
        res.send("Client is already ready");
        isInitialized = true;
      } else {
        client.client.initialize();
        res.send("Client is initializing");
        isInitialized = true;
      }
    });

    client.client.on("qr", (qr) => {
      console.log("QR RECEIVED", qr);
      app.get(`/${client.id}/`, (req, res) => {
        res.send(
          'API is not running! Please scan the QR code to login. <a href="/qr">Click here</a>'
        );
      });
      qrcode.toDataURL(qr, function (err, url) {
        qr_data = url;
      });
      app.get(`/${client.id}/qr`, (req, res) => {
        // check if client is authenticated
        if (client.client.authInfo) {
          res.send("Client is already authenticated");
          app.exit();
        } else {
          res.send(
            `
                            <h1>Scan the QR code</h1>
                             <img src=${qr_data} />
                             <p>Scan the QR code above to login</p>
    
                            <script>
                                setTimeout(function() {
                                    window.location.reload(1);
                                    }, 5000);
                            </script>
                        `
          );
        }
      });
    });

    client.client.on("authenticated", (session) => {
      console.log(client.id, " AUTHENTICATED");
      disconnected = false;
    });

    client.client.on("ready", () => {
      console.log(client.id, " Client is ready!");
      app.get(`/${client.id}`, (req, res) => {
        res.send("API is running!");
      });

      app.post(`/${client.id}/send`, async (req, res) => {
        try {
          const number = req.body.number;
          const message = req.body.message;
          const send = await client.client.sendMessage(number, message);
          res.send(send);
          console.log(send);
        } catch (error) {
          console.log(error);
        }
      });

      app.post(`/${client.id}/sendMedia`, async (req, res) => {
        const number = req.body.number;
        if (!req.body.mediaUrl) {
          res.send("Please provide a media url");
        }

        const mediaUrl = req.body.mediaUrl;
        const mediaType = req.body.mediaType;
        const caption = req.body.caption;

        const media = await MessageMedia.fromUrl(mediaUrl);
        const send = await client.client.sendMessage(number, media, {
          caption: caption,
        });
        res.send(send);
        console.log(send);
      });

      app.get(`/${client.id}/getChats`, async (req, res) => {
        const chats = await client.client.getChats();
        res.send(chats);
      });

      app.get(`/${client.id}/getChatMessages/:id`, async (req, res) => {
        if (!req.params.id) {
          res.send("Please provide a chat ID");
        }
        const chat = await client.client.getChatById(req.params.id);
        const messages = await chat.fetchMessages();
        res.send(messages);
      });

      client.client.on("message", async (msg) => {
        console.log("MESSAGE RECEIVED", msg);
        // auto reply
        if (msg.body == "!test") {
          msg.reply("The bot is working!");
          var chat = await msg.getChat();
          chat.sendMessage("This is a test message");
        }

        if (msg.body == "Hi") {
          msg.reply("Hello");
        }

        if (msg.body == "How are you?") {
          msg.reply("Fine");
        }

        if (postApi !== "") {
          try {
            // send a post request to external API example
            const server_url = postApi;
            const axios = require("axios");
            const data = JSON.stringify({
              instanceid: client.client.id,
              ...msg,
            });

            const config = {
              headers: {
                "Content-Type": "application/json",
              },
            };
            const response = await axios.post(server_url, data, config);
            console.log(response.data);
            // {
            //     "instanceid": "2",
            //     "reply": "Hello",
            //     "replyMedia": "https://example.com/image.jpg"
            // }
            if (response.data.reply) {
              msg.reply(response.data.reply);
            }
            if (response.data.replyMedia) {
              const media = new MessageMedia(
                "image/jpeg",
                response.data.replyMedia
              );
              msg.reply(media);
            }
          } catch (error) {
            console.log(error);
          }
        }
      });
    });

    client.client.on("disconnected", (reason) => {
      console.log("Client was logged out", reason);
      disconnected = true;
    });

    app.get(`/${client.id}/logout`, async (req, res) => {
      if (!disconnected) {
        await client.client.logout();
        res.send("Client logged out");
      } else {
        res.send("Client is not logged in");
      }
    });

    app.get(`/${client.id}/exit`, async (req, res) => {
      if (isInitialized) {
        isInitialized = false;
        client.client.destroy();
        console.log("Client exited");
        res.send("Client exited");
      } else {
        res.send("Client is not initialized");
      }
    });
  });
} catch (error) {
  console.log(error);
}

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
