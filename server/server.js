// ============================
//  Import Required Packages
// ============================

// Load environment variables from ".env" file (e.g., MONGODB_URI, PORT, etc.)
require("dotenv").config();

// Express.js framework for building APIs
const express = require("express");

// HTTP module (needed for creating server with WebSockets)
const http = require("http");

// MongoDB Client for database connection
const { MongoClient } = require("mongodb");

// Socket.io to enable real-time communication between server & clients
const { Server } = require("socket.io");

// Middleware to allow Cross-Origin Requests (frontend can connect to backend)
const cors = require("cors");

// Filesystem (to read JSON payloads)
const fs = require("fs");

// Path helper (for file paths)
const path = require("path");

// Used to make HTTP requests (fetching from APIs, sending payloads, etc.)
const fetch = require("node-fetch");

// ============================
//  Initialize Express & Server
// ============================
const app = express();
const server = http.createServer(app);

// Initialize Socket.io with CORS enabled (so frontend from another domain can connect)
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// ============================
//  Database Setup
// ============================

// Get MongoDB connection string from environment variables
const MONGODB_URI = process.env.MONGODB_URI;

// Database and collection names
const DB_NAME = "whatsapp";
const COLLECTION_NAME = "processed_messages";

// Directory to store sample webhook payloads
const PAYLOADS_DIR = path.join(__dirname, "payloads");

// ============================
//  Middleware
// ============================

// Allow frontend (either provided in .env or default to Vercel app) to connect
app.use(
  cors({
    origin:
      process.env.FRONTEND_URL || "https://whats-app-like-web-clone.vercel.app",
    methods: ["GET", "POST", "DELETE"],
    credentials: true,
  })
);

// Parse JSON request bodies (up to 10 MB in size)
app.use(express.json({ limit: "10mb" }));

// ============================
//  MongoDB Connection
// ============================
let collection; // we’ll store the messages collection here

async function connectMongo() {
  // Create Mongo client and connect
  const client = new MongoClient(MONGODB_URI);
  await client.connect();

  // Select database and collection
  const db = client.db(DB_NAME);
  collection = db.collection(COLLECTION_NAME);

  // Ensure each message has a unique `message_id`
  await collection.createIndex({ message_id: 1 }, { unique: true });

  console.log("✅ Connected to MongoDB");
}
connectMongo();

// ============================
//  Socket.io - Real-Time Events
// ============================
io.on("connection", (socket) => {
  // When a user is typing, notify others (except the sender)
  socket.on("typing", (waId) => {
    socket.broadcast.emit("typing", waId);
  });
});

// ============================
//  API Routes
// ============================

// --- Fetch users (list of conversations) ---
app.get("/api/users", async (req, res) => {
  try {
    // Get last message of each user and sort by time
    const users = await collection
      .aggregate([
        { $sort: { wa_id: 1, timestamp: -1 } }, // sort messages (by user then by time desc)
        {
          $group: {
            _id: "$wa_id", // group messages by wa_id (WhatsApp ID)
            name: { $first: "$contact_name" },
            lastMessageType: { $first: "$type" },
            lastMessageText: { $first: "$text" },
            lastMessageFileName: { $first: "$fileName" },
            lastMessageTimestamp: { $first: "$timestamp" },
          },
        },
        { $sort: { lastMessageTimestamp: -1 } }, // recent chats first
      ])
      .toArray();

    // Format the response for frontend
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

// --- Fetch all messages for a given user ---
app.get("/api/messages/:wa_id", async (req, res) => {
  try {
    const messages = await collection
      .find({ wa_id: req.params.wa_id })
      .sort({ timestamp: 1 }) // oldest to newest
      .project({ _id: 0 }) // don’t expose MongoDB’s internal _id
      .toArray();

    // Add `waId` field for frontend consistency
    messages.forEach((m) => (m.waId = m.wa_id));

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// --- Send a new message ---
app.post("/api/messages", async (req, res) => {
  const { waId, from, text, contact_name, type, fileUrl, fileName } = req.body;

  // Validate required fields
  if (!waId || !from || (!text && !fileUrl)) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Generate unique message_id
  const messageId = `msg-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
  const timestamp = Date.now();

  // Create message document
  const doc = {
    wa_id: waId,
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
    // Save message to database
    await collection.insertOne(doc);

    // Emit real-time event to clients
    io.emit("new_message", doc);

    res.status(201).json(doc);
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({ error: "Duplicate message_id" });
    res.status(500).json({ error: "Failed to send message" });
  }
});

// --- Delete a specific message by message_id ---
app.delete("/api/messages/:message_id", async (req, res) => {
  try {
    const result = await collection.deleteOne({
      message_id: req.params.message_id,
    });

    if (result.deletedCount === 1) {
      io.emit("message_deleted", req.params.message_id); // notify clients
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Message not found" });
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to delete message" });
  }
});

// --- Delete all messages for a specific user (delete chat) ---
app.delete("/api/users/:wa_id", async (req, res) => {
  try {
    const result = await collection.deleteMany({ wa_id: req.params.wa_id });
    res.json({ deletedCount: result.deletedCount });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete chat" });
  }
});

// ============================
//  Webhook (handles incoming messages & statuses)
// ============================
app.post("/api/webhook", async (req, res) => {
  const payload = req.body;
  try {
    // Ensure payload has expected structure
    if (!payload?.metaData?.entry?.[0]?.changes?.[0]?.value) {
      return res.status(400).json({ error: "Invalid webhook payload" });
    }

    const value = payload.metaData.entry[0].changes[0].value;

    // Handle new incoming messages
    if (Array.isArray(value.messages)) {
      for (const msg of value.messages) {
        const exists = await collection.findOne({ message_id: msg.id });
        if (exists) continue; // skip if already exists

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
          raw_payload: payload, // store raw WhatsApp payload for debugging
        };

        await collection.insertOne(doc);
        io.emit("new_message", doc);
      }
    }

    // Handle status updates (delivered, read, etc.)
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

// ============================
//  Process Sample Payloads
//    (helpful for testing without real WhatsApp integration)
// ============================
app.post("/api/process-sample-payloads", async (req, res) => {
  try {
    const files = fs
      .readdirSync(PAYLOADS_DIR) // read all files in /payloads folder
      .filter((f) => f.endsWith(".json"));

    for (const file of files) {
      // Read payload file
      const raw = fs.readFileSync(path.join(PAYLOADS_DIR, file), "utf8");
      const payload = JSON.parse(raw);

      // Re-send payload to webhook route
      await fetch(`http://localhost:${process.env.PORT || 3000}/api/webhook`, {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });
    }

    res.json({ processedCount: files.length });
  } catch (err) {
    res.status(500).json({ error: "Failed to process batch payloads" });
  }
});

// ============================
//  Serve Frontend
// ============================
const frontendPath = path.join(__dirname, "frontend-build");

// Serve static frontend files (built React app for example)
app.use(express.static(frontendPath));

// Catch-all route (if no API matches, serve frontend index.html)
app.get("/*", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

// ============================
//  Start the Server
// ============================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
