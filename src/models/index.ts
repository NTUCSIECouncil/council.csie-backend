import { model } from 'mongoose';
import { articleSchema, type Article } from './ArticleSchema';
import { userSchema, type User } from './UserSchema';

// function registerSchemas (): void {
//   model<User>('User', userSchema);
// }

const models = {
  Article: model<Article>('Article', articleSchema),
  User: model<User>('User', userSchema)
};

export { models };
