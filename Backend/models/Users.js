import mongoose from "mongoose";
import plugin from "passport-local-mongoose";

const Schema = mongoose.Schema;

const passportLocalMongoose = plugin.default || plugin;

const userSchema = new Schema({
    email:{
        type: String,
        required: true,
    },
});

userSchema.plugin(passportLocalMongoose);

export default mongoose.model("User", userSchema);