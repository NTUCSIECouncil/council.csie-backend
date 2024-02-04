import { Schema } from 'mongoose';

interface User {
  uid: string;
  email: string;
  name: string;
}

const userSchema = new Schema<User>({
  uid: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  name: { type: String, required: true }
});

export { type User, userSchema };
