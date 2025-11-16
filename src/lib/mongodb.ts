import mongoose from 'mongoose';
import { MongoClient } from 'mongodb'; // Import MongoClient

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    'Please define the MONGODB_URI environment variable inside .env.local'
  );
}

const cached = global as typeof global & {
  mongoose: { conn: typeof mongoose | null, promise: Promise<typeof mongoose> | null },
  mongoClientPromise: Promise<MongoClient> | null // Add for MongoClient
};

if (!cached.mongoose) {
  cached.mongoose = { conn: null, promise: null };
}
if (!cached.mongoClientPromise) {
  cached.mongoClientPromise = null;
}

async function dbConnect() {
  if (cached.mongoose.conn) {
    return cached.mongoose.conn;
  }

  if (!cached.mongoose.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.mongoose.promise = mongoose.connect(MONGODB_URI!, opts).then((mongoose) => {
      return mongoose;
    });
  }
  cached.mongoose.conn = await cached.mongoose.promise;
  return cached.mongoose.conn;
}

// Function to get MongoClient for next-auth
export async function getMongoClient(): Promise<MongoClient> {
  if (cached.mongoClientPromise) {
    return cached.mongoClientPromise;
  }

  // If mongoose connection is not established, establish it first
  await dbConnect(); 
  
  // Now that mongoose.conn is guaranteed to be set, we can get its client
  cached.mongoClientPromise = Promise.resolve(cached.mongoose.conn!.connection.getClient());
  return cached.mongoClientPromise;
}

export default dbConnect;