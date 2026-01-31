// Quick MongoDB Connection Test
// Run this to test your connection string

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const testConnection = async () => {
    console.log('Testing MongoDB connection...');
    console.log('MONGO_URI exists:', !!process.env.MONGO_URI);
    console.log('MONGO_URI starts with:', process.env.MONGO_URI?.substring(0, 20) + '...');

    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
        });
        console.log('✅ SUCCESS! MongoDB connected');
        console.log('Database:', mongoose.connection.db.databaseName);
        process.exit(0);
    } catch (err) {
        console.error('❌ FAILED! MongoDB connection error:');
        console.error('Error name:', err.name);
        console.error('Error message:', err.message);
        console.error('Error code:', err.code);
        process.exit(1);
    }
};

testConnection();
