import { Schema } from 'mongoose';

interface IUser {
  name: string;
  uid: string;
}

const userSchema = new Schema<IUser>({
  name: { type: String, required: true },
  uid: { type: String, required: true }
});

export { type IUser, userSchema };
