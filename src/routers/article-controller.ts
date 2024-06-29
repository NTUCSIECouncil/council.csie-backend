import { randomUUID, type UUID } from 'crypto';
import { Router } from 'express';
import { type ArticleSearchQueryParam } from '@type/query-param';
import { models } from '@models/index';
import { type Article } from '@models/ArticleSchema';
import { portionParser } from './middleware';

const router = Router();

const ArticleModel = models.Article;

const verifyArticle = (articleInfo: Partial<Article>, uuid: UUID, complete: boolean): boolean => {
  if (articleInfo._id !== undefined && articleInfo._id !== uuid) {
    return false;
  }

  if (complete && !(articleInfo._id !== undefined &&
                    articleInfo.title !== undefined &&
                    articleInfo.lecturer !== undefined &&
                    articleInfo.creator !== undefined)) {
    return false;
  }

  return true;
};

// get all articles
router.get('/', portionParser(ArticleModel), (req, res, next) => {
  (async () => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- authChecker() checked
    const [portionNum, portionSize] = [req.portionNum!, req.portionSize!];
    console.log(`num = ${req.portionNum}, size = ${req.portionSize}`);
    const articles = await models.Article.find().skip(portionNum * portionSize).limit(portionSize).exec();
    res.json({ result: articles });
  })().catch((err) => {
    next(err);
  });
});

router.post('/', (req, res, next) => {
  (async () => {
    const uuid = randomUUID();
    const newInfo: Article = { _id: uuid, ...req.body };

    if (!verifyArticle(newInfo, uuid, true)) {
      res.sendStatus(400);
      return;
    }

    const targetArticle = new ArticleModel(newInfo);
    await targetArticle.save();
    res.status(201).json({ uuid });
  })().catch((err) => {
    next(err);
  });
});

router.get('/search', portionParser(ArticleModel), (req, res, next) => {
  (async () => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- authChecker() checked
    const [portionNum, portionSize] = [req.portionNum!, req.portionSize!];

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
      console.log(searchParams)
      const result = await models.Article.searchArticles(searchParams, portionNum, portionSize);
      res.send({ result });
    } catch (e) {
      console.log(e);
      res.sendStatus(400);
    }
  })().catch((err) => {
    next(err);
  });
});

router.get('/:uuid', (req, res, next) => {
  (async () => {
    const uuid = req.params.uuid as UUID;

    const targetArticle = await ArticleModel.findById(uuid).exec();
    if (targetArticle === null) {
      res.sendStatus(404);
    } else {
      res.status(200).json({ result: targetArticle });
    }
  })().catch(err => {
    next(err);
  });
});

router.put('/:uuid', (req, res, next) => {
  (async () => {
    const uuid = req.params.uuid as UUID;
    const newInfo: Partial<Article> = req.body;

    if (!verifyArticle(newInfo, uuid, false)) {
      res.sendStatus(400);
      return;
    }

    const targetArticle = await ArticleModel.findById(uuid).exec();
    if (targetArticle === null) {
      res.sendStatus(400);
    } else {
      targetArticle.set(newInfo);
      await targetArticle.save();
      res.sendStatus(204);
    }
  })().catch(err => {
    next(err);
  });
});

export default router;
