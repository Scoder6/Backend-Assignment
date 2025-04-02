require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const cors = require('cors');
const os = require('os');
const mongoose = require('mongoose');

const app = express();

// Connect Database with retry logic
const connectWithRetry = () => {
    return connectDB()
        .then(() => console.log("✅ MongoDB connected successfully"))
        .catch((error) => {
            console.error("❌ MongoDB connection error:", error.message);
            console.log("Retrying connection in 5 seconds...");
            return new Promise(resolve => setTimeout(resolve, 5000))
                .then(connectWithRetry);
        });
};

connectWithRetry();

// CORS Configuration
const allowedOrigins = [
    'https://frontend-three-zeta-94.vercel.app',
    'http://localhost:3000'
];

// 1. First handle OPTIONS requests globally
app.options('*', (req, res) => {
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-auth-token');
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Vary', 'Origin');
    }
    res.status(204).end(); // 204 No Content for OPTIONS
});

// 2. Apply manual CORS headers for all responses
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Vary', 'Origin');
    }
    next();
});

// 3. Use cors middleware as additional protection
app.use(cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token'],
    credentials: true,
    optionsSuccessStatus: 204
}));

// Enhanced request logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`, {
        origin: req.headers.origin,
        'user-agent': req.headers['user-agent'],
        body: req.body ? JSON.stringify(req.body).substring(0, 100) + '...' : 'empty'
    });
    next();
});

// Timeout handling
app.use((req, res, next) => {
    req.setTimeout(15000, () => {
        console.warn(`Request timeout: ${req.method} ${req.url}`);
    });
    res.setTimeout(15000);
    next();
});

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);

// Health endpoints
app.get('/', (req, res) => {
    res.json({
        message: 'Welcome to the API',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        allowedOrigins: allowedOrigins
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

// Error handling
app.use((err, req, res, next) => {
    console.error('API Error:', err.stack);

    if (err.message.includes('CORS')) {
        return res.status(403).json({
            error: 'Forbidden - CORS',
            message: err.message,
            allowedOrigins: allowedOrigins
        });
    }

    if (err.code === 'ETIMEDOUT') {
        return res.status(504).json({
            error: 'Gateway Timeout',
            message: 'Request took too long to process'
        });
    }

    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Server startup
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, '0.0.0.0', () => {
    const networkInterfaces = os.networkInterfaces();
    const addresses = [];

    for (const name of Object.keys(networkInterfaces)) {
        for (const net of networkInterfaces[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                addresses.push(net.address);
            }
        }
    }

    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Allowed origins: ${allowedOrigins.join(', ')}`);
    if (addresses.length > 0) {
        console.log(`📡 Local network access: http://${addresses[0]}:${PORT}`);
    }
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        mongoose.connection.close(false, () => {
            console.log('MongoDB connection closed');
            process.exit(0);
        });
    });
});

module.exports = app;