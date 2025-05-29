import { type Model, Schema, model } from 'mongoose';
import { z } from 'zod/v4';

const ZUserSchema = z.object({
  _id: z.string(),
  gid: z.string(),
  email: z.email(),
  name: z.string(),
  nickname: z.string(),
});

interface User extends z.infer<typeof ZUserSchema> {};

interface UserModel extends Model<User> {};

const userSchema = new Schema<User, UserModel>({
  _id: { type: String, immutable: true },
  gid: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  nickname: { type: String, required: true },
});

const UserModel = model<User>('User', userSchema);

export { type User, UserModel, ZUserSchema };
