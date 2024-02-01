import { model } from 'mongoose';
import { articleSchema, type Article } from './ArticleSchema';
import { userSchema, type IUser } from './UserSchema';

// function registerSchemas (): void {
//   model<IUser>('User', userSchema);
// }

const models = {
  Article: model<Article>('Article', articleSchema),
  User: model<IUser>('User', userSchema)
};

export { models };
