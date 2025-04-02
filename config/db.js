const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error("❌ MONGODB_URI is missing from .env file");
        }

        await mongoose.connect(process.env.MONGODB_URI);

        console.log("✅ MongoDB connected successfully...");
    } catch (err) {
        console.error("❌ MongoDB Connection Error:", err.message);
        process.exit(1); // Exit process on failure
    }
};

module.exports = connectDB;
