require("dotenv").config();
const express = require("express");
const http = require("http");
const { MongoClient } = require("mongodb");
const { Server } = require("socket.io");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch"); // v2 for CommonJS

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

const MONGODB_URI = process.env.MONGODB_URI || "your_mongodb_connection_string";
const DB_NAME = "whatsapp";
const COLLECTION_NAME = "processed_messages";
const PAYLOADS_DIR = path.join(__dirname, "payloads");

app.use(cors());
app.use(express.json({ limit: "10mb" }));

let collection;

async function connectMongo() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  collection = db.collection(COLLECTION_NAME);
  await collection.createIndex({ message_id: 1 }, { unique: true });
  console.log("Connected to MongoDB");
}
connectMongo();

io.on("connection", (socket) => {
  socket.on("typing", (waId) => {
    socket.broadcast.emit("typing", waId);
  });
});

// ✅ FIXED: Return last message details (type/text/fileName/timestamp) for each chat
app.get("/api/users", async (req, res) => {
  try {
    const users = await collection
      .aggregate([
        { $sort: { wa_id: 1, timestamp: -1 } },
        {
          $group: {
            _id: "$wa_id",
            name: { $first: "$contact_name" },
            lastMessageType: { $first: "$type" },
            lastMessageText: { $first: "$text" },
            lastMessageFileName: { $first: "$fileName" },
            lastMessageTimestamp: { $first: "$timestamp" },
          },
        },
        { $sort: { lastMessageTimestamp: -1 } },
      ])
      .toArray();

    res.json(
      users.map((u) => ({
        wa_id: u._id,
        waId: u._id,
        name: u.name,
        lastMessageType: u.lastMessageType,
        lastMessageText: u.lastMessageText,
        lastMessageFileName: u.lastMessageFileName,
        lastMessageTimestamp: u.lastMessageTimestamp,
      }))
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

app.get("/api/messages/:wa_id", async (req, res) => {
  try {
    const waId = req.params.wa_id;
    const messages = await collection
      .find({ wa_id: waId })
      .sort({ timestamp: 1 })
      .project({ _id: 0 })
      .toArray();
    messages.forEach((m) => (m.waId = m.wa_id));
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

app.post("/api/messages", async (req, res) => {
  const { waId, from, text, contact_name, type, fileUrl, fileName } = req.body;
  if (!waId || !from || (!text && !fileUrl)) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  const messageId = `msg-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
  const timestamp = Date.now();
  const doc = {
    wa_id: waId, // always contact's wa_id to group correctly!
    waId,
    contact_name: contact_name || null,
    message_id: messageId,
    from,
    timestamp,
    text: text || "",
    type: type || "text",
    fileUrl: fileUrl || null,
    fileName: fileName || null,
    status: "sent",
    createdAt: new Date(),
  };
  try {
    await collection.insertOne(doc);
    io.emit("new_message", doc);
    res.status(201).json(doc);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "Duplicate message_id" });
    }
    res.status(500).json({ error: "Failed to send message" });
  }
});

app.delete("/api/messages/:message_id", async (req, res) => {
  const messageId = req.params.message_id;
  try {
    const result = await collection.deleteOne({ message_id: messageId });
    if (result.deletedCount === 1) {
      io.emit("message_deleted", messageId);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Message not found" });
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to delete message" });
  }
});

app.delete("/api/users/:wa_id", async (req, res) => {
  try {
    const waId = req.params.wa_id;
    const result = await collection.deleteMany({ wa_id: waId });
    res.json({ deletedCount: result.deletedCount });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete chat" });
  }
});

app.post("/api/webhook", async (req, res) => {
  const payload = req.body;
  try {
    if (!payload?.metaData?.entry?.[0]?.changes?.[0]?.value) {
      return res.status(400).json({ error: "Invalid webhook payload" });
    }
    const value = payload.metaData.entry[0].changes[0].value;

    if (Array.isArray(value.messages)) {
      for (const msg of value.messages) {
        const exists = await collection.findOne({ message_id: msg.id });
        if (exists) continue;
        const doc = {
          wa_id: value.contacts?.[0]?.wa_id || null,
          waId: value.contacts?.[0]?.wa_id || null,
          contact_name: value.contacts?.[0]?.profile?.name || null,
          message_id: msg.id,
          from: msg.from,
          timestamp: Number(msg.timestamp),
          text: msg.text?.body || "",
          type: msg.type,
          status: "sent",
          createdAt: new Date(),
          fileUrl: msg.image?.link || msg.audio?.link || null,
          fileName: null,
          raw_payload: payload,
        };
        await collection.insertOne(doc);
        io.emit("new_message", doc);
      }
    }

    if (Array.isArray(value.statuses)) {
      for (const s of value.statuses) {
        const msgId = s.id || s.meta_msg_id;
        if (!msgId) continue;
        const result = await collection.findOneAndUpdate(
          { message_id: msgId },
          { $set: { status: s.status, status_timestamp: Number(s.timestamp) } },
          { returnDocument: "after" }
        );
        if (result.value) {
          io.emit("message_status_updated", result.value);
        }
      }
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Error handling webhook" });
  }
});

app.post("/api/process-sample-payloads", async (req, res) => {
  try {
    const files = fs
      .readdirSync(PAYLOADS_DIR)
      .filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const raw = fs.readFileSync(path.join(PAYLOADS_DIR, file), "utf8");
      const payload = JSON.parse(raw);
      await fetch(
        "http://localhost:" + (process.env.PORT || 3000) + "/api/webhook",
        {
          method: "POST",
          body: JSON.stringify(payload),
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    res.json({ processedCount: files.length });
  } catch (err) {
    res.status(500).json({ error: "Failed to process batch payloads" });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
