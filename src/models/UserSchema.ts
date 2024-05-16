import { Schema } from 'mongoose';

interface User {
  _id: string;
  email: string;
  name: string;
}

const userSchema = new Schema<User>({
  _id: { type: String, required: true },
  email: { type: String, required: true },
  name: { type: String, required: true }
});

export { type User, userSchema };
