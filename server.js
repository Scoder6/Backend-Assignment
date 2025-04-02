require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const cors = require('cors');
const os = require('os');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 5000;
const MAX_RETRIES = 5;
let retryCount = 0;

// Connect Database with retry logic
const connectWithRetry = async () => {
    try {
        await connectDB();
        console.log("✅ MongoDB connected successfully");
    } catch (error) {
        console.error("❌ MongoDB connection error:", error.message);
        if (retryCount < MAX_RETRIES) {
            retryCount++;
            console.log(`Retrying connection in 5 seconds... (${retryCount}/${MAX_RETRIES})`);
            setTimeout(connectWithRetry, 5000);
        } else {
            console.error("❌ Maximum retries reached. Exiting...");
            process.exit(1);
        }
    }
};
connectWithRetry();

// CORS Configuration
const corsOptions = {
    origin: [
        'https://frontend-three-zeta-94.vercel.app',
        'http://localhost:3000' // For local development
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    optionsSuccessStatus: 204
};

app.use(cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token'],
    credentials: true
}));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Enhanced request logging (moved after body parsers)
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`, {
        origin: req.headers.origin,
        'user-agent': req.headers['user-agent'],
        body: JSON.stringify(req.body || {}).substring(0, 100) + '...'
    });
    next();
});

// Timeout handling
app.use((req, res, next) => {
    req.on('timeout', () => {
        console.warn(`Request timeout: ${req.method} ${req.url}`);
        res.status(408).json({ error: 'Request Timeout' });
    });
    res.setTimeout(15000);
    next();
});

// Routes
app.use('/api/auth', authRoutes);

// Health Check Endpoints
app.get('/', (req, res) => {
    res.json({
        message: 'Welcome to the API',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        allowedOrigins
    });
});

app.get('/health', async (req, res) => {
    try {
        const db = mongoose.connection.db;
        await db.command({ ping: 1 });
        res.status(200).json({
            status: 'ok',
            database: 'connected',
            uptime: process.uptime()
        });
    } catch (err) {
        res.status(503).json({
            status: 'error',
            database: 'disconnected',
            error: err.message
        });
    }
});

// Global Error Handling
app.use((err, req, res, next) => {
    console.error('API Error:', err.stack);
    const statusCode = err.code === 'ETIMEDOUT' ? 504 : 500;
    res.status(statusCode).json({
        error: statusCode === 504 ? 'Gateway Timeout' : 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Server startup
const server = app.listen(PORT, '0.0.0.0', () => {
    const addresses = Object.values(os.networkInterfaces())
        .flat()
        .filter(net => net.family === 'IPv4' && !net.internal)
        .map(net => net.address);

    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Allowed origins: ${allowedOrigins.join(', ')}`);
    if (addresses.length > 0) {
        console.log(`📡 Local network access: http://${addresses[0]}:${PORT}`);
    }
});

// Graceful Shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        mongoose.connection.close(false, () => {
            console.log('MongoDB connection closed');
            process.exit(0);
        });
    });
});

// Catch Uncaught Exceptions (Prevents crashes)
process.on('uncaughtException', (err) => {
    console.error("💥 Uncaught Exception! Shutting down...");
    console.error(err);
    process.exit(1);
});

module.exports = app;
