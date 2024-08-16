import { randomUUID } from 'crypto';
import { model, type Model, Schema } from 'mongoose';
import { z } from 'zod';
import { ZUuidSchema } from './util-schema.ts';

const ZUserSchema = z.object({
  _id: ZUuidSchema,
  email: z.string().email(),
  name: z.string(),
});

interface User extends z.infer<typeof ZUserSchema > {};

interface UserModel extends Model<User> { };

const userSchema = new Schema<User, UserModel>({
  _id: { type: String, default: () => randomUUID() },
  email: { type: String, required: true },
  name: { type: String, required: true },
});

const UserModel = model<User>('User', userSchema);

export { type User, UserModel, ZUserSchema };
