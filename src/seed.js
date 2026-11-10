
import "dotenv/config";
import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI);

const demoStudios = [
  {
    seedKey: "demo-daylight-loft",
    title: "Daylight Loft",
    category: "Photography",
    rate: 1200,
    deposit: 1000,
    capacity: 8,
    location: "Dhanmondi, Dhaka",
    imageUrl: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1200",
    amenities: ["Natural Light", "Cyclorama Wall", "Changing Room", "WiFi"],
    description: "A beautiful daylight photography studio with professional lighting, spacious shooting areas and a modern creative environment.",
    ownerName: "Maya Chen",
    ownerEmail: "maya@studiospace.demo",
    isDemo: true,
    rating: 4.9,
    reviewCount: 24,
    featured: true,
  },
  {
    seedKey: "demo-analog-house",
    title: "Analog House",
    category: "Recording",
    rate: 1800,
    deposit: 1500,
    capacity: 6,
    location: "Gulshan, Dhaka",
    imageUrl: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=1200",
    amenities: ["Mixing Console", "Studio Microphones", "Soundproof Room", "Headphones"],
    description: "Professional music recording space equipped for vocal recording, mixing and music production.",
    ownerName: "Alex Morgan",
    ownerEmail: "alex@studiospace.demo",
    isDemo: true,
    rating: 4.8,
    reviewCount: 18,
    featured: true,
  },
  {
    seedKey: "demo-room-tone",
    title: "Room Tone Podcast Studio",
    category: "Podcast",
    rate: 1000,
    deposit: 500,
    capacity: 5,
    location: "Banani, Dhaka",
    imageUrl: "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=1200",
    amenities: ["Podcast Microphones", "Audio Mixer", "Acoustic Panels", "WiFi"],
    description: "A cozy podcast recording studio with professional microphones and acoustic treatment.",
    ownerName: "Sarah Ahmed",
    ownerEmail: "sarah@studiospace.demo",
    isDemo: true,
    rating: 4.7,
    reviewCount: 15,
    featured: true,
  },
  {
    seedKey: "demo-soft-focus",
    title: "Soft Focus Studio",
    category: "Videography",
    rate: 2000,
    deposit: 2000,
    capacity: 10,
    location: "Uttara, Dhaka",
    imageUrl: "https://images.unsplash.com/photo-1492619375914-88005aa9e8fb?w=1200",
    amenities: ["Cinema Camera", "LED Lighting", "Tripods", "Green Screen"],
    description: "A versatile video production studio for commercials, interviews, music videos and creative productions.",
    ownerName: "Daniel Smith",
    ownerEmail: "daniel@studiospace.demo",
    isDemo: true,
    rating: 4.9,
    reviewCount: 31,
    featured: true,
  },
  {
    seedKey: "demo-listening-room",
    title: "The Listening Room",
    category: "Music",
    rate: 1500,
    deposit: 1000,
    capacity: 7,
    location: "Mirpur, Dhaka",
    imageUrl: "https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?w=1200",
    amenities: ["Piano", "Speakers", "Acoustic Treatment", "Instruments"],
    description: "An inspiring music practice and production space for musicians and creative teams.",
    ownerName: "Noah Wilson",
    ownerEmail: "noah@studiospace.demo",
    isDemo: true,
    rating: 4.6,
    reviewCount: 12,
    featured: false,
  },
  {
    seedKey: "demo-clay-house",
    title: "Clay House Workshop",
    category: "Workshop",
    rate: 900,
    deposit: 500,
    capacity: 12,
    location: "Mohammadpur, Dhaka",
    imageUrl: "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=1200",
    amenities: ["Pottery Wheels", "Work Tables", "Clay Tools", "Storage"],
    description: "A creative workshop for pottery, ceramic art and hands-on craft sessions.",
    ownerName: "Olivia Brown",
    ownerEmail: "olivia@studiospace.demo",
    isDemo: true,
    rating: 4.8,
    reviewCount: 20,
    featured: false,
  },
  {
    seedKey: "demo-creative-hub",
    title: "Creative Hub",
    category: "Creative Workspace",
    rate: 700,
    deposit: 500,
    capacity: 15,
    location: "Bashundhara, Dhaka",
    imageUrl: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1200",
    amenities: ["High Speed WiFi", "Meeting Table", "Projector", "Coffee"],
    description: "A collaborative workspace for designers, freelancers and creative professionals.",
    ownerName: "James Miller",
    ownerEmail: "james@studiospace.demo",
    isDemo: true,
    rating: 4.7,
    reviewCount: 16,
    featured: false,
  },
  {
    seedKey: "demo-cyclorama-stage",
    title: "White Cyclorama Stage",
    category: "Photography",
    rate: 1600,
    deposit: 1500,
    capacity: 10,
    location: "Tejgaon, Dhaka",
    imageUrl: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=1200",
    amenities: ["White Backdrop", "Studio Lights", "Camera Stand", "Changing Room"],
    description: "A professional white cyclorama stage ideal for fashion, product and commercial photography.",
    ownerName: "Maya Chen",
    ownerEmail: "maya@studiospace.demo",
    isDemo: true,
    rating: 4.9,
    reviewCount: 27,
    featured: true,
  },
  {
    seedKey: "demo-sound-stage",
    title: "Sound Stage Pro",
    category: "Recording",
    rate: 2200,
    deposit: 2000,
    capacity: 8,
    location: "Baridhara, Dhaka",
    imageUrl: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=1200",
    amenities: ["Audio Interface", "Studio Monitors", "Microphones", "Soundproofing"],
    description: "A premium recording environment for professional musicians, voice artists and audio producers.",
    ownerName: "Alex Morgan",
    ownerEmail: "alex@studiospace.demo",
    isDemo: true,
    rating: 4.8,
    reviewCount: 22,
    featured: false,
  },
  {
    seedKey: "demo-content-studio",
    title: "Content Creation Studio",
    category: "Videography",
    rate: 1300,
    deposit: 1000,
    capacity: 6,
    location: "Khilgaon, Dhaka",
    imageUrl: "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=1200",
    amenities: ["Ring Lights", "Camera", "Tripod", "Green Screen", "WiFi"],
    description: "A modern content creation studio for YouTube videos, social media content and interviews.",
    ownerName: "Sarah Ahmed",
    ownerEmail: "sarah@studiospace.demo",
    isDemo: true,
    rating: 4.7,
    reviewCount: 14,
    featured: false,
  },
];

async function seedDatabase() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is missing from .env");
    }

    await client.connect();

    const db = client.db(process.env.MONGODB_DB || "studiospace");
    const studios = db.collection("studios");

    console.log("Connected to MongoDB:", db.databaseName);

    let inserted = 0;
    let existing = 0;

    for (const studio of demoStudios) {
      const now = new Date();

      const result = await studios.updateOne(
        { seedKey: studio.seedKey },
        {
          $setOnInsert: {
            ...studio,
            createdAt: now,
            updatedAt: now,
          },
        },
        { upsert: true }
      );

      if (result.upsertedCount === 1) {
        inserted++;
        console.log("Added:", studio.title);
      } else {
        existing++;
        console.log("Already exists:", studio.title);
      }
    }

    console.log("\nSeed completed!");
    console.log("New studios:", inserted);
    console.log("Already existed:", existing);
    console.log("Total demo studios:", demoStudios.length);

    const total = await studios.countDocuments();
    console.log("Total studios in database:", total);
  } catch (error) {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

seedDatabase();
