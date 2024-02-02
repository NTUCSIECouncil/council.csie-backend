import { Schema } from 'mongoose';

interface IUser {
  uid: string;
  email: string;
  name: string;
}

const userSchema = new Schema<IUser>({
  uid: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  name: { type: String, required: true }
});

export { type IUser, userSchema };
