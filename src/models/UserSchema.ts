import { Schema } from 'mongoose';

interface User {
  name: string;
  uid: string;
}

const userSchema = new Schema<User>({
  name: { type: String, required: true },
  uid: { type: String, required: true }
});

export { type User, userSchema };
