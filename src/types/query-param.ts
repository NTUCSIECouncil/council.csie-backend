import { type UUID } from 'crypto';

interface ArticleSearchQueryParam {
  tag?: string[];
  keyword?: string;
  categories?: string[];
  lecturer?: string;
  grade?: number;
}

interface QuizSearchParam {
  course: UUID;
  keyword?: string;
}

export { type ArticleSearchQueryParam, type QuizSearchParam };
