import { connect, model } from 'mongoose';
import { userSchema, type IUser } from './UserSchema';

// function registerSchemas (): void {
//   model<IUser>('User', userSchema);
// }

(async () => {
  await connect('mongodb://127.0.0.1:27017/test');
})().catch((err) => {
  console.log(err);
});

const models = { User: model<IUser>('User', userSchema) };

export { models };
