import { model } from 'mongoose';
import { userSchema, type IUser } from './UserSchema';

// function registerSchemas (): void {
//   model<IUser>('User', userSchema);
// }

const models = { User: model<IUser>('User', userSchema) };

export { models };
