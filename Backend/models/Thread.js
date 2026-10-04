import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema({
    role: {
        type: String,
        enum: ["user", "assistant"],
        required: true
    },
    content: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

const DocumentMetaSchema = new mongoose.Schema({
    docName: {
        type: String, 
        required: true
    },
    summary: {
        type: String,
        required: true,
    },
    uploadedAt: {
        type: Date,
        default: Date.now,
    }
})

const ThreadSchema = new mongoose.Schema({
    threadId: {
        type: String,
        required: true,
        unique: true
    },
    title: {
        type: String,
        default: "New Chat"
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    messages: [MessageSchema], 
    documents: [DocumentMetaSchema],
    summary: {
        type: String, 
        default: ""
    },
    lastSummerizedLength: {
        type: Number,
        default: 0,
    },
    hasDocuments: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

export default mongoose.model("Thread", ThreadSchema);