import { model } from 'mongoose';
import { articleSchema, type Article, type ArticleModel } from './article-schema';
import { userSchema, type User } from './user-schema';
import { courseSchema, type Course } from './course-schema';
import { quizSchema, type Quiz, type QuizModel } from './quiz-schema';

const models = {
  Article: model<Article, ArticleModel>('Article', articleSchema),
  User: model<User>('User', userSchema),
  Course: model<Course>('Course', courseSchema),
  Quiz: model<Quiz, QuizModel>('Quiz', quizSchema),
};

export { models };
