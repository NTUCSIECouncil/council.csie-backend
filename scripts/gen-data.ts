import fs from 'fs/promises';
import path from 'path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
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

async function generateArticleFiles(articleFileDirPath: string, articleList: Article[]): Promise<void> {
  await fs.mkdir(articleFileDirPath, { recursive: true });
  await Promise.all(
    articleList.map(async (article) => {
      const mdPath = path.join(articleFileDirPath, `${article._id}.md`);
      const content = `# ${article.title}\n\nThis is a generated markdown file for article **${article._id}** \n by user **${article.creator}**.`;
      await fs.writeFile(mdPath, content, 'utf8');
    }),
  );
}

async function generateQuizFiles(quizFileDirPath: string, quizList: Quiz[]): Promise<void> {
  await fs.mkdir(quizFileDirPath, { recursive: true });
  await Promise.all(
    quizList.map(async (quiz) => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595.28, 841.89]);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const { height } = page.getSize();
      const content = `${quiz._id}\n\nThis is a generated pdf file for course ${quiz.course} \n by user ${quiz.uploader}.`;
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
  const userList: User[] = [];
  for (let i = 0; i < num; i++) {
    const user: User = {
      _id: `00000001-1131-0000-0000-${i.toString().padStart(12, '0')}`,
      gid: `GID${i.toString()}`,
      name: `user${i.toString()}`,
      email: `user${i.toString()}@example.com`,
      nickname: `User ${i.toString()}`,
    };
    userList.push(user);
  }
  return userList;
}

function generateCourses(originalCourseList: Course[]): Course[] {
  originalCourseList.forEach((course, courseIndex) => {
    course._id = `00000003-0000-0000-0000-${courseIndex.toString().padStart(12, '0')}`;
    if (!course.class) delete course.class;
    course.lecturer = course.lecturer || 'N/A';
  });
  return originalCourseList;
}

function getRandomUser(userList: User[]): User {
  if (userList.length === 0) {
    throw new Error('User list is empty');
  }
  const idx = Math.floor(Math.random() * userList.length);
  const user = userList[idx];
  return user;
}

function generateArticles(
  courseList: Course[],
  userList: User[],
  maxNum = 30,
): Article[] {
  const articleList: Article[] = [];
  const articleCount = Math.min(maxNum, courseList.length);
  for (const course of courseList.slice(0, articleCount)) {
    const dep = course.curriculum.match(/[a-zA-Z]/g)?.join('') ?? '';
    const lecturer = course.lecturer || '';
    const courseIdParts = course._id.split('-');
    const randomUploader = getRandomUser(userList);
    const ratings = {
      sweetness: Math.floor(Math.random() * 5) + 1,
      chill: Math.floor(Math.random() * 5) + 1,
      teaching: Math.floor(Math.random() * 5) + 1,
      gain: Math.floor(Math.random() * 5) + 1,
      recommend: Math.floor(Math.random() * 5) + 1,
    };
    const article: Article = {
      _id: `00000002-1131-0000-0000-${courseIdParts[courseIdParts.length - 1]}`,
      course: course._id,
      creator: randomUploader._id,
      title: course.names[0],
      tags: [lecturer, course.names[0], dep],
      ratings,
    };
    articleList.push(article);
  }
  return articleList;
}

function generateQuiz(
  courseList: Course[],
  userList: User[],
  maxNum = 30,
): Quiz[] {
  const quizList: Quiz[] = [];
  const quizCount = Math.min(maxNum, courseList.length);
  for (const course of courseList.slice(0, quizCount)) {
    const sessions: Quiz['session'][] = ['midterm', 'final', 'first', 'second'];
    const courseIdParts = course._id.split('-');
    sessions.forEach((session, sessionNum) => {
      const randomUploader = getRandomUser(userList);
      const quiz: Quiz = {
        _id: `00000004-1131-000${String(sessionNum)}-0000-${courseIdParts[courseIdParts.length - 1]}`,
        course: course._id,
        uploader: randomUploader._id,
        session,
      };
      quizList.push(quiz);
    });
  }
  return quizList;
}

const jsonDirPath = path.join(import.meta.dirname, '..', 'test', 'samples');
const originalCourseJsonPath = path.join(jsonDirPath, 'course-original.json');
const courseJsonPath = path.join(jsonDirPath, 'course-samples.json');
const articleJsonPath = path.join(jsonDirPath, 'article-samples.json');
const articleFileDirPath = path.join(jsonDirPath, 'article-file-samples');
const quizJsonPath = path.join(jsonDirPath, 'quiz-samples.json');
const quizFileDirPath = path.join(jsonDirPath, 'quiz-file-samples');
const userJsonPath = path.join(jsonDirPath, 'user-samples.json');

await fs.mkdir(jsonDirPath, { recursive: true });

console.log(jsonDirPath);

const userList = generateUsers();
const originalCourseList = await readListJsonFile<Course>(originalCourseJsonPath);
const courseList = generateCourses(originalCourseList);
const articleList = generateArticles(courseList, userList);
const quizList = generateQuiz(courseList, userList);

await fs.writeFile(userJsonPath, JSON.stringify(userList, null, 2));
await fs.writeFile(courseJsonPath, JSON.stringify(courseList, null, 2));
await fs.writeFile(articleJsonPath, JSON.stringify(articleList, null, 2));
await fs.writeFile(quizJsonPath, JSON.stringify(quizList, null, 2));

await generateArticleFiles(articleFileDirPath, articleList);
await generateQuizFiles(quizFileDirPath, quizList);
