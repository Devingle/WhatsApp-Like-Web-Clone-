/***********************************************************
 * WhatsApp-like Chat Backend Server (Node.js + Express + MongoDB)
 * ---------------------------------------------------------------
 * This app stores messages in MongoDB, serves APIs to fetch/send
 * messages, handles WebSocket events for real-time chat updates,
 * and processes incoming webhooks from WhatsApp API or sample files.
 *
 * We are using:
 *  - `express` for creating the server and REST APIs
 *  - `socket.io` for real-time communication between server and clients
 *  - `mongodb` to store chat data
 *  - `cors` for allowing cross-origin requests
 *  - `dotenv` to load secrets from `.env` file
 *  - `fs` and `path` for reading sample payloads from local files
 *  - `node-fetch` to simulate sending webhook data to our own API
 ***********************************************************/

// Load environment variables from `.env` file into process.env
require("dotenv").config();

// Import necessary Node.js + external libraries
const express = require("express"); // Web framework for HTTP APIs
const http = require("http"); // Required to create a server for both Express & Socket.io
const { MongoClient } = require("mongodb"); // MongoDB database client
const { Server } = require("socket.io"); // Real-time bidirectional communication
const cors = require("cors"); // Allow cross-origin API requests
const fs = require("fs"); // File system module to read/write files
const path = require("path"); // Helps with folder and file paths
const fetch = require("node-fetch"); // Used to make HTTP requests (CommonJS v2 syntax)

// Create an Express app instance
const app = express();
// Create a raw HTTP server so Socket.io can share it with Express
const server = http.createServer(app);

// Create a WebSocket server using Socket.io
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }, // Allow connections from any frontend
});

// MongoDB connection info (from .env file or default string)
const MONGODB_URI = process.env.MONGODB_URI || "your_mongodb_connection_string";
const DB_NAME = "whatsapp"; // Database name
const COLLECTION_NAME = "processed_messages"; // Collection name for chat messages

// Directory containing sample payloads to test webhook processing
const PAYLOADS_DIR = path.join(__dirname, "payloads");

// Enable middlewares for CORS and JSON request parsing
app.use(cors()); // Allow all websites to use this API
app.use(express.json({ limit: "10mb" })); // Parse incoming JSON bodies (max 10 MB)

// This will hold the MongoDB collection instance after connection
let collection;

/**
 * Connect to MongoDB and store collection reference in `collection` variable.
 */
async function connectMongo() {
  const client = new MongoClient(MONGODB_URI); // Create a new client instance
  await client.connect(); // Connect to MongoDB server
  const db = client.db(DB_NAME); // Select our database
  collection = db.collection(COLLECTION_NAME); // Select our messages collection

  // Create an index so `message_id` will be unique — prevents duplicates
  await collection.createIndex({ message_id: 1 }, { unique: true });

  console.log("✅ Connected to MongoDB");
}
connectMongo(); // Immediately connect when the server starts

/**
 * Handle new WebSocket connections (real-time)
 */
io.on("connection", (socket) => {
  // Listen for "typing" events from frontend and broadcast to everyone except sender
  socket.on("typing", (waId) => {
    socket.broadcast.emit("typing", waId);
  });
});

/**
 * API: Get a list of users with their last message info.
 * This shows:
 *  - Chat partner's ID & name
 *  - Last message type (text/image/etc.)
 *  - Last message text or file name
 *  - Timestamp of last message
 */
app.get("/api/users", async (req, res) => {
  try {
    const users = await collection
      .aggregate([
        { $sort: { wa_id: 1, timestamp: -1 } }, // Sort by wa_id, then by newest message
        {
          $group: {
            // Group messages by wa_id, taking only the most recent one
            _id: "$wa_id",
            name: { $first: "$contact_name" },
            lastMessageType: { $first: "$type" },
            lastMessageText: { $first: "$text" },
            lastMessageFileName: { $first: "$fileName" },
            lastMessageTimestamp: { $first: "$timestamp" },
          },
        },
        { $sort: { lastMessageTimestamp: -1 } }, // Show latest active chats first
      ])
      .toArray();

    // Format output for frontend
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

/**
 * API: Get all messages from a single chat (by wa_id)
 */
app.get("/api/messages/:wa_id", async (req, res) => {
  try {
    const waId = req.params.wa_id;
    const messages = await collection
      .find({ wa_id: waId })
      .sort({ timestamp: 1 }) // Oldest first
      .project({ _id: 0 }) // Remove MongoDB internal _id field
      .toArray();

    // Add `waId` field for frontend convenience
    messages.forEach((m) => (m.waId = m.wa_id));

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

/**
 * API: Send a new message (text or file)
 */
app.post("/api/messages", async (req, res) => {
  const { waId, from, text, contact_name, type, fileUrl, fileName } = req.body;

  // Basic validation
  if (!waId || !from || (!text && !fileUrl)) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Unique ID & timestamp for message
  const messageId = `msg-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
  const timestamp = Date.now();

  // Document object to insert into MongoDB
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
    await collection.insertOne(doc); // Save to database
    io.emit("new_message", doc); // Real-time broadcast to all clients
    res.status(201).json(doc);
  } catch (err) {
    if (err.code === 11000) {
      // Handle duplicate message ID
      return res.status(409).json({ error: "Duplicate message_id" });
    }
    res.status(500).json({ error: "Failed to send message" });
  }
});

/**
 * API: Delete a single message by message_id
 */
app.delete("/api/messages/:message_id", async (req, res) => {
  const messageId = req.params.message_id;
  try {
    const result = await collection.deleteOne({ message_id: messageId });
    if (result.deletedCount === 1) {
      io.emit("message_deleted", messageId); // Notify all clients in real-time
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Message not found" });
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to delete message" });
  }
});

/**
 * API: Delete all messages of a chat user
 */
app.delete("/api/users/:wa_id", async (req, res) => {
  try {
    const waId = req.params.wa_id;
    const result = await collection.deleteMany({ wa_id: waId });
    res.json({ deletedCount: result.deletedCount });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete chat" });
  }
});

/**
 * API: Webhook to receive messages/status updates from WhatsApp
 */
app.post("/api/webhook", async (req, res) => {
  const payload = req.body;
  try {
    // Validate payload format
    if (!payload?.metaData?.entry?.[0]?.changes?.[0]?.value) {
      return res.status(400).json({ error: "Invalid webhook payload" });
    }
    const value = payload.metaData.entry[0].changes[0].value;

    // Handle incoming messages
    if (Array.isArray(value.messages)) {
      for (const msg of value.messages) {
        const exists = await collection.findOne({ message_id: msg.id });
        if (exists) continue; // Skip duplicates

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
          raw_payload: payload, // Store raw payload for debugging
        };
        await collection.insertOne(doc);
        io.emit("new_message", doc);
      }
    }

    // Handle message status updates (delivered, read, failed, etc.)
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

/**
 * API: Process all sample JSON payload files in "payloads" folder
 * Useful for testing
 */
app.post("/api/process-sample-payloads", async (req, res) => {
  try {
    const files = fs
      .readdirSync(PAYLOADS_DIR)
      .filter((f) => f.endsWith(".json")); // Only JSON files

    for (const file of files) {
      const raw = fs.readFileSync(path.join(PAYLOADS_DIR, file), "utf8");
      const payload = JSON.parse(raw);

      // Simulate sending payload to our webhook endpoint
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

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
