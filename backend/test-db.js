import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ipl-auction';

console.log(`Testing connection to: ${MONGO_URI}`);

mongoose.connect(MONGO_URI)
    .then(() => {
        console.log('✅ MongoDB Connection Successful!');
        console.log(`Database Name: ${mongoose.connection.name}`);
        console.log(`Host: ${mongoose.connection.host}`);
        console.log(`Port: ${mongoose.connection.port}`);
        process.exit(0);
    })
    .catch(err => {
        console.error('❌ MongoDB Connection Failed:', err.message);
        process.exit(1);
    });
