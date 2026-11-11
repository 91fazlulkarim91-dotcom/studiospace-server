import { MongoClient } from "mongodb";
import { config } from "./env.js";

let client;
let database;

export async function connectDatabase() {
  if (database) return database;

  client = new MongoClient(config.mongodbUri);
  await client.connect();
  database = client.db(config.mongodbDb);

  const users = database.collection("users");
  const studios = database.collection("studios");
  const bookings = database.collection("bookings");
  const favorites = database.collection("favorites");

  await Promise.all([
    users.createIndex({ email: 1 }, { unique: true }),
    studios.createIndex({ ownerEmail: 1 }),
    studios.createIndex({ category: 1, createdAt: -1 }),
    studios.createIndex({ title: "text", location: "text", category: "text" }),
    bookings.createIndex({ studioId: 1, date: 1, status: 1 }),
    bookings.createIndex({ userEmail: 1, createdAt: -1 }),
    favorites.createIndex({ userEmail: 1, studioId: 1 }, { unique: true }),
  ]);

  console.log(`MongoDB connected successfully: ${database.databaseName}`);
  return database;
}

export function getCollections() {
  if (!database) throw new Error("Database is not connected. Call connectDatabase() first.");
  return {
    users: database.collection("users"),
    studios: database.collection("studios"),
    bookings: database.collection("bookings"),
    favorites: database.collection("favorites"),
  };
}

export async function closeDatabase() {
  if (client) {
    await client.close();
    client = undefined;
    database = undefined;
    console.log("MongoDB connection closed.");
  }
}
