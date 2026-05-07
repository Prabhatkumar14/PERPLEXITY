import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';

const app = express();

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || "https://seekrx.vercel.app",
    credentials: true
}));

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

// Routes
app.get('/', (req, res) => {
    res.send('Server is running!');
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

export default app;