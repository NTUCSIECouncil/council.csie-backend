import { model } from 'mongoose';
import { articleSchema, type ArticleModel, type ArticleWithOptionalId } from './article-schema';
import { userSchema, type User } from './user-schema';
import { courseSchema, type CourseWithOptionalId } from './course-schema';
import { quizSchema, type QuizWithOptionalId, type QuizModel } from './quiz-schema';

const models = {
  Article: model<ArticleWithOptionalId, ArticleModel>('Article', articleSchema),
  User: model<User>('User', userSchema),
  Course: model<CourseWithOptionalId>('Course', courseSchema),
  Quiz: model<QuizWithOptionalId, QuizModel>('Quiz', quizSchema),
};

export { models };
