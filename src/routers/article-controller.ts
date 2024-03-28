import { Router } from 'express';
import { type ArticleSearchQueryParam } from '@type/query-param';
import { models } from '@models/index';

const router = Router();

// get all articles
router.get('/', (req, res, next) => {
  (async () => {
    const articles = await models.Article.find().exec();
    res.json({ result: articles });
  })().catch((err) => {
    next(err);
  });
});

router.get('/search', (req, res, next) => {
  (async () => {
    const queryParams = req.query;
    let key: string;
    const searchParams: ArticleSearchQueryParam = {};
    try {
      for (key in queryParams) {
        if (key === 'tag') {
          searchParams.tag = [];
          let value: string;
          for (value of queryParams.tag as string[]) searchParams.tag.push(value);
        } else if (key === 'keyword') {
          searchParams.keyword = queryParams.keyword as string;
        } else if (key === 'categories') {
          searchParams.categories = [];
          let value: string;
          for (value of queryParams.categories as string[]) searchParams.categories.push(value);
        } else if (key === 'lecturer') {
          searchParams.lecturer = queryParams.lecture as string;
        } else if (key === 'grade') {
          searchParams.grade = Number(queryParams.grade);
          if (!(searchParams.grade >= 1 && searchParams.grade <= 4)) throw Error();
        } else {
          throw Error();
        }
      }
      const resault = await models.Article.findArticles(searchParams);
      res.send(resault);
    } catch (e) {
      console.log(e);
      res.sendStatus(400);
      return;
    }
    console.log(searchParams);
  })().catch((err) => {
    next(err);
  });
});

export default router;
