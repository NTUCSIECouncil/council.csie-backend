import { randomUUID, type UUID } from 'crypto';
import { Schema } from 'mongoose';

interface User {
  _id: UUID;
  email: string;
  name: string;
}

const userSchema = new Schema<User>({
  _id: { type: String, default: () => randomUUID() },
  email: { type: String, required: true },
  name: { type: String, required: true }
});

export { type User, userSchema };
