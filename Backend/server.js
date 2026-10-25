import express from "express"
import "dotenv/config"
import cors from "cors"
import mongoose from "mongoose"
import passport from "passport"
import LocalStrategy from "passport-local"
import session from "express-session";

import User from "./models/Users.js"
import chatRoutes from "./routes/chat.js"
import userRoutes from "./routes/user.js"
import documentRoutes from "./routes/document.js"
import ExpressError from "./utils/ExpressError.js"

const app = express()
const PORT = process.env.PORT || 8080

app.set("trust proxy", 1);
app.use(express.json())  

const allowedOrigins = [
    process.env.CLIENT_ORIGIN,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:3000",
].filter(Boolean);

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            if (
                process.env.NODE_ENV === "production" ||
                allowedOrigins.includes(origin) ||
                /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
            ) {
                return callback(null, true);
            }
            return callback(new Error(`Not allowed by CORS: ${origin}`));
        },
        credentials: true,
    })
);

app.use(
    session({
        secret: process.env.SESSION_SECRET || "novachat_secret_key",
        resave: false,
        saveUninitialized: false,
        cookie: {
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        secure: false, // Set to true if running over HTTPS in production
        },
    })
)


app.use(passport.initialize()); // this is a middleware that initializes the passport for the each request.
app.use(passport.session()); // because of this in a single session a we can identify the user

passport.use(new LocalStrategy(User.authenticate())); // use static authenticate method of model in local Strategy
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use("/api", chatRoutes)
app.use("/auth", userRoutes)
app.use("/document", documentRoutes)

app.get("/healthz", (req, res) => {
    res.status(200).json({
        status: "ok",
        uptime: process.uptime(),
    });
});
 
app.all(/.*/, (req, res, next) => {
    next(new ExpressError(404, "page not found!"));
});

// centralized error handler
app.use((err, req, res, next)=>{
    console.error("Credentialized Error: ", err.stack);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || "Internal Server Error"
    });
});

const connectDB = async ()=>{
    try{
        const mongoUri = process.env.MONGODB_URI || process.env.LOCAL_MONGODB_URI;
        await mongoose.connect(mongoUri, {
            dbName: "NovaChat",
        });
        console.log("Connected with MongoDB Atlas database")
    } catch(err){
        console.log("Failed to connect with MongoDB Atlas database", err)
    }
}

app.listen(PORT, ()=>{
    console.log(`server running on port ${PORT}`)
    connectDB() 
}) 








// ====================================== rag feature ==============================================

// pdf-parse (or @langchain/community): extracts raw text from user-uploaded PDFs or documents.
// multer: handles multipart document uploads in Express.
// @google/genai: official SDK for Gemini embedding models.