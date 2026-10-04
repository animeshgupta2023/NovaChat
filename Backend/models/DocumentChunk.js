import mongoose from "mongoose";

const documentChunkSchema = new mongoose.Schema({
    owner:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    threadId:{
        type: String,
        required: true,
        index: true,
    },
    docName: {
        type: String,
        required: true,
    },
    docSummaryId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    },
    content: {
        type: String,
        required: true,
    },
    embedding: {
        type: [Number],
        required: true,
    },
    createdAt:{
        type: Date,
        default: Date.now,
    },
});

export default mongoose.model("DocumentChunk", documentChunkSchema);

