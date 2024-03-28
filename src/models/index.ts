import { model } from 'mongoose';
import { articleSchema, type Article, type ArticleModel } from './ArticleSchema';
import { userSchema, type User } from './UserSchema';
import { courseSchema, type Course } from './CourseSchema';
import { quizSchema, type Quiz } from './QuizSchema';

// function registerSchemas (): void {
//   model<User>('User', userSchema);
// }

const models = {
  Article: model<Article, ArticleModel>("Article", articleSchema),
  User: model<User>('User', userSchema),
  Course: model<Course>('Course', courseSchema),
  Quiz: model<Quiz>('Quiz', quizSchema)
};

export { models };
