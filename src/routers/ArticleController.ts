import { Router, type Request } from 'express';
import { type Article } from '@models/ArticleSchema';
import { models } from '@models/index';

const router = Router();

// get all articles
router.get('/', (req, res) => {
  (async () => {
    const articles = await models.Article.find().exec();
    res.json({ result: articles });
  })().catch((err) => {
    console.log(err);
    res.sendStatus(500);
  });
});

// Some interfaces for articles searching
// TODO: maybe should be moved to a separated file

interface ArticleSearchParams {
  keyword: string;
}

interface ArticleSearchResult {
  results: Article[];
}

interface ArticleSearchRequest extends Request<null, ArticleSearchResult, null, ArticleSearchParams> {};

// TODO: search articles by keyword
//       (unchecked)
router.post('/search', (req: ArticleSearchRequest, res) => {
  (async () => {
    const queryParams = req.query;
    const articles: Article[] = await models.Article.find({
      $or: [
        { title: { $regex: queryParams.keyword, $options: 'i' } },
        { lecturer: { $regex: queryParams.keyword, $options: 'i' } },
        { tag: { $regex: queryParams.keyword, $options: 'i' } },
        { content: { $regex: queryParams.keyword, $options: 'i' } }
      ]
    }).exec();
    res.json({ results: articles });
  })().catch((err) => {
    console.log(err);
    res.sendStatus(500);
  });
});

export default router;
