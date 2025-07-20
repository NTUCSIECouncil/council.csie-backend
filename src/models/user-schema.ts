import { randomUUID } from 'crypto';
import { type Model, Schema, model } from 'mongoose';
import { z } from 'zod';
import { ZUuidSchema } from './util-schema.ts';

const ZUserSchema = z.object({
  _id: ZUuidSchema,
  gid: z.string(),
  email: z.email(),
  name: z.string(),
  nickname: z.string(),
});

interface User extends z.infer<typeof ZUserSchema> {};

interface UserModel extends Model<User> {};

const userSchema = new Schema<User, UserModel>({
  _id: { type: String, default: randomUUID },
  gid: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  nickname: { type: String, required: true },
});

const UserModel = model<User>('User', userSchema);

export { type User, UserModel, ZUserSchema };
