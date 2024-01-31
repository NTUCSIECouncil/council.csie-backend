import mongoose, {Schema, Document} from "mongoose";

export interface IUser extends Document {
    name: string;
}

const userSchema: Schema<IUser> = new mongoose.Schema({
    name: { type: String, required: true }
});

export default userSchema;