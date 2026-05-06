import dotenv from 'dotenv';
dotenv.config({
    path: './.env'
});

import connectDB from './src/config/index.js';
import app from './src/app.js';
import authRoutes from "./src/routes/auth.routes.js";
import chatRoutes from "./src/routes/chat.routes.js";
import messageRoutes from "./src/routes/message.routes.js";

app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/message", messageRoutes);

connectDB()
.catch((err) => {
    console.log("MONGO db connection failed !!! ", err);
});

app.listen(process.env.PORT || 8000, () => {
        console.log(`Server is running at port : ${process.env.PORT || 8000}`);
    });