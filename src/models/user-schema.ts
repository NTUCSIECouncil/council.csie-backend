import { type Model, Schema, model } from 'mongoose';
import { z } from 'zod';

const ZUserSchema = z.object({
  _id: z.string(),
  email: z.string().email(),
  name: z.string(),
});

interface User extends z.infer<typeof ZUserSchema> {};

interface UserModel extends Model<User> { };

const userSchema = new Schema<User, UserModel>({
  _id: { type: String },
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
});

const UserModel = model<User>('User', userSchema);

export { type User, UserModel, ZUserSchema };
