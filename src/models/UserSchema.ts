import { randomUUID, type UUID } from 'crypto';
import { type Model, Schema } from 'mongoose';

interface User {
  _id: UUID;
  email: string;
  name: string;
}

interface UserModel extends Model<User> { };

const userSchema = new Schema<User, UserModel>({
  _id: { type: String, default: () => randomUUID() },
  email: { type: String, required: true },
  name: { type: String, required: true }
});

export { type User, type UserModel, userSchema };
