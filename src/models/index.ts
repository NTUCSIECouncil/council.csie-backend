import { ArticleModel } from './article-schema';
import { UserModel } from './user-schema';
import { CourseModel } from './course-schema';
import { QuizModel } from './quiz-schema';

const models = {
  Article: ArticleModel,
  User: UserModel,
  Course: CourseModel,
  Quiz: QuizModel,
};

export { models };
