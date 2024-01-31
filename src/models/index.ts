import mongoose, {Document} from "mongoose";
import userSchema, { IUser } from "./UserSchema";

function registerSchemas() {
  mongoose.model<IUser>("User", userSchema);
}

export { registerSchemas };
