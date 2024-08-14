import { ArticleModel } from './article-schema.ts';
import { UserModel } from './user-schema.ts';
import { CourseModel } from './course-schema.ts';
import { QuizModel } from './quiz-schema.ts';

const models = {
  Article: ArticleModel,
  User: UserModel,
  Course: CourseModel,
  Quiz: QuizModel,
};

export { models };
