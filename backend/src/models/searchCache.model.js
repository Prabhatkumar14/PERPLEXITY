import mongoose from "mongoose";

const searchCacheSchema = new mongoose.Schema({
    query: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true
    },
    results: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 21600 // Cache expires in 6 hours (21600 seconds)
    }
});

const SearchCache = mongoose.model("SearchCache", searchCacheSchema);
export default SearchCache;
