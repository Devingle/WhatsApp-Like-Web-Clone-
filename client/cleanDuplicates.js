const { MongoClient } = require("mongodb");
const uri =
  "mongodb+srv://Devingle:devingle2025@cluster0.jhiudvz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const dbName = "whatsapp";

async function cleanUpDuplicates() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection("processed_messages");

    // Step 1: Find duplicates
    const duplicates = await collection
      .aggregate([
        {
          $group: {
            _id: "$message_id",
            count: { $sum: 1 },
            ids: { $push: "$_id" },
          },
        },
        { $match: { count: { $gt: 1 } } },
      ])
      .toArray();

    // Step 2: Remove duplicates but keep one
    for (const doc of duplicates) {
      doc.ids.shift(); // Keep the first one
      for (const id of doc.ids) {
        await collection.deleteOne({ _id: id });
      }
    }
  } catch (err) {
    console.error("Error cleaning up duplicates:", err);
  } finally {
    await client.close();
  }
}

cleanUpDuplicates();
