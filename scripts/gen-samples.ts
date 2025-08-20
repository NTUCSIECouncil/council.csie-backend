import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

import { type Article } from '@models/article-schema.ts';
import { type Course } from '@models/course-schema.ts';
import { type Quiz } from '@models/quiz-schema.ts';
import { type User } from '@models/user-schema.ts';

async function readListJsonFile<T>(filePath: string): Promise<T[]> {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data) as T[];
  } catch (error) {
    console.error('Error reading JSON file:', error);
    return [];
  }
}

async function generateArticleFiles(
  articleFileDirPath: string,
  articles: Article[],
): Promise<void> {
  await fs.mkdir(articleFileDirPath, { recursive: true });
  await Promise.all(
    articles.map(async article => {
      const mdPath = path.join(articleFileDirPath, `${article._id}.md`);
      const content = `# ${article.title}\n\nThis is a generated markdown file for article **${article._id}** \nby user **${article.creator}**.`;
      await fs.writeFile(mdPath, content, 'utf8');
    }),
  );
}

async function generateQuizFiles(
  quizFileDirPath: string,
  quizzes: Quiz[],
): Promise<void> {
  await fs.mkdir(quizFileDirPath, { recursive: true });
  await Promise.all(
    quizzes.map(async quiz => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595.28, 841.89]);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const { height } = page.getSize();
      const content = `${quiz._id}\n\nThis is a generated pdf file for course ${quiz.course} \nby user ${quiz.uploader}.`;
      page.drawText(content, {
        x: 50,
        y: height - 100,
        size: 12,
        font,
        color: rgb(0, 0, 0),
      });
      const pdfPath = path.join(quizFileDirPath, `${quiz._id}.pdf`);
      const pdfBytes = await pdfDoc.save();
      await fs.writeFile(pdfPath, pdfBytes);
    }),
  );
}

function generateUsers(num = 30): User[] {
  return Array.from(
    { length: num },
    (_, i): User => ({
      _id: randomUUID(),
      gid: `GID${i.toString()}`,
      name: `user${i.toString()}`,
      email: `user${i.toString()}@example.com`,
      nickname: `User ${i.toString()}`,
    }),
  );
}

function getRandomUser(users: User[]): User {
  if (users.length === 0) throw new Error('User list is empty');
  return users[Math.floor(Math.random() * users.length)];
}

function getRandomSection():
  | 'first'
  | 'second'
  | 'midterm'
  | 'final'
  | 'other' {
  const sections = ['first', 'second', 'midterm', 'final', 'other'] as const;
  return sections[Math.floor(Math.random() * sections.length)];
}

function generateArticles(
  courseList: Course[],
  userList: User[],
  maxNum = 30,
): Article[] {
  const articles: Article[] = [];
  const articleCount = Math.min(maxNum, courseList.length);
  for (const course of courseList.slice(0, articleCount)) {
    const dep = course.curriculum.match(/[a-zA-Z]/g)?.join('') ?? '';
    const lecturer = course.lecturer;
    const randomUploader = getRandomUser(userList);
    const ratings = {
      sweetness: Math.floor(Math.random() * 5) + 1,
      chill: Math.floor(Math.random() * 5) + 1,
      teaching: Math.floor(Math.random() * 5) + 1,
      gain: Math.floor(Math.random() * 5) + 1,
      recommend: Math.floor(Math.random() * 5) + 1,
    };
    const article: Article = {
      _id: randomUUID(),
      course: course._id,
      creator: randomUploader._id,
      title: course.names[0],
      tags: [lecturer, course.names[0], dep],
      ratings,
    };
    articles.push(article);
  }
  return articles;
}

function generateQuiz(
  courseList: Course[],
  userList: User[],
  maxNum = 30,
): Quiz[] {
  const quizzes: Quiz[] = [];
  const quizCount = Math.min(maxNum, courseList.length);
  for (const course of courseList.slice(0, quizCount)) {
    const quiz: Quiz = {
      _id: randomUUID(),
      course: course._id,
      uploader: getRandomUser(userList)._id,
      session: getRandomSection(),
    };
    quizzes.push(quiz);
  }
  return quizzes;
}

const jsonDirPath = path.join(import.meta.dirname, '..', 'samples');
const originalCourseJsonPath = path.join(jsonDirPath, 'course-original.json');
const courseJsonPath = path.join(jsonDirPath, 'course-samples.json');
const articleJsonPath = path.join(jsonDirPath, 'article-samples.json');
const articleFileDirPath = path.join(jsonDirPath, 'article-file-samples');
const quizJsonPath = path.join(jsonDirPath, 'quiz-samples.json');
const quizFileDirPath = path.join(jsonDirPath, 'quiz-file-samples');
const userJsonPath = path.join(jsonDirPath, 'user-samples.json');

await fs.mkdir(jsonDirPath, { recursive: true });

const users = generateUsers();
const courses = (await readListJsonFile<Course>(originalCourseJsonPath)).slice(
  0,
  30,
);
const articles = generateArticles(courses, users);
const quizzes = generateQuiz(courses, users);

await Promise.all([
  fs.writeFile(userJsonPath, JSON.stringify(users, null, 2)),
  fs.writeFile(courseJsonPath, JSON.stringify(courses, null, 2)),
  fs.writeFile(articleJsonPath, JSON.stringify(articles, null, 2)),
  fs.writeFile(quizJsonPath, JSON.stringify(quizzes, null, 2)),
]);

await fs.rm(articleFileDirPath, { recursive: true, force: true });
await fs.rm(quizFileDirPath, { recursive: true, force: true });

await generateArticleFiles(articleFileDirPath, articles);
await generateQuizFiles(quizFileDirPath, quizzes);
