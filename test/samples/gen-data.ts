import fs from 'fs/promises';
import path from 'path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { type Article } from '@models/article-schema.ts';
import { type Course } from '@models/course-schema.ts';
import { type Quiz } from '@models/quiz-schema.ts';

async function readJsonFile(filePath: string): Promise<Course[]> {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    const jsonArray: Course[] = JSON.parse(data) as Course[];
    return jsonArray;
  } catch (error) {
    console.error('Error reading JSON file:', error);
    return [];
  }
}

async function generateCourses(courseJsonPath: string, originalCourseJsonPath: string) {
  try {
    const courseList = await readJsonFile(originalCourseJsonPath);
    // change its id to our format
    courseList.forEach((course, courseIndex) => {
      course._id = `00000003-0000-0000-0000-${courseIndex.toString().padStart(12, '0')}`;

      // remove class field if it is empty(some course on course.ntu.edu.tw doesn't have class)
      if (!course.class) delete course.class;

      // add default value for lecturer (some course on course.ntu.edu.tw doesn't have lecturer)
      course.lecturer = course.lecturer || 'N/A';
    });

    // write to file in JSON format
    const jsonString = JSON.stringify(courseList, null, 2);
    await fs.writeFile(courseJsonPath, jsonString);
  } catch (error) {
    console.error('Error generating courses:', error);
  }
}

async function generateArticles(articleJsonPath: string, articaleFileDirPath: string, courseJsonPath: string, userJasonPath: string, maxNum = 30) {
  try {
    const articleList: Article[] = [];
    // read course and user data
    const userList = await readJsonFile(userJasonPath);
    const courseList = await readJsonFile(courseJsonPath);

    const articaleCount = Math.min(maxNum, courseList.length);

    // generate articles for each course
    courseList.slice(0, articaleCount).forEach((course) => {
      // get department from curriculum(the alphabet part)
      const dep = course.curriculum.match(/[a-zA-Z]/g)?.join('') ?? '';
      const lecturer = course.lecturer || '';
      const courseId: string[] = course._id.split('-');
      // randomly select an uploader
      const randomUploader = userList[Math.floor(Math.random() * userList.length)];

      const articale: Article = {
        _id: `00000002-1131-0000-0000-${courseId[courseId.length - 1]}`,
        course: course._id,
        creator: randomUploader._id,
        semester: '113-1',
        title: course.names[0],
        tags: [lecturer, course.names[0], dep],
      };

      articleList.push(articale);
    });

    // write to the file in JSON format
    const jsonString = JSON.stringify(articleList, null, 2);
    await fs.writeFile(articleJsonPath, jsonString);

    // ensure output directory exists and generate markdown files
    await fs.mkdir(articaleFileDirPath, { recursive: true });
    for (let i = 0; i < articaleCount; i++) {
      const article = articleList[i];
      const mdPath = path.join(articaleFileDirPath, `${article._id}.md`);
      const content = `# ${article.title}\n\nThis is a generated markdown file for article **${article._id}** \n by user **${article.creator}**.`;
      await fs.writeFile(mdPath, content, 'utf8');
    }
  } catch (error) {
    console.error('Error generating articles from courses:', error);
  }
}

async function generateQuiz(quizJsonPath: string, quizFileDirPath: string, courseJsonPath: string, userJasonPath: string, maxNum = 30) {
  try {
    const quizList: Quiz[] = [];
    const userList = await readJsonFile(userJasonPath);
    const courseList = await readJsonFile(courseJsonPath);

    const quizCount = Math.min(maxNum, courseList.length);

    // generate quizzes for each course
    courseList.slice(0, quizCount).forEach((course) => {
      const sessions: ('midterm' | 'final' | 'first' | 'second')[] = ['midterm', 'final', 'first', 'second'];
      const courseId: string[] = course._id.split('-');

      sessions.forEach((session, sessionNum) => {
        // randomly select an uploader
        const randomUploader = userList[Math.floor(Math.random() * userList.length)];

        // generate quiz
        const quiz: Quiz = {
          _id: `00000004-1131-000${String(sessionNum)}-0000-${courseId[courseId.length - 1]}`,
          course: course._id,
          uploader: randomUploader._id,
          semester: '113-1',
          session: session,
        };
        quizList.push(quiz);
      });
    });

    // write to the file in JSON format
    const jsonString = JSON.stringify(quizList, null, 2);
    await fs.writeFile(quizJsonPath, jsonString);

    for (let i = 0; i < quizCount; i++) {
      const quiz = quizList[i];
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
    }
  } catch (error) {
    console.error('Error generating quizzes from courses:', error);
  }
}

// file paths
const originalCourseJsonPath = './test/samples/course_original.json';
const courseJsonPath = './test/samples/course_samples.json';
const articleJsonPath = './test/samples/article_samples.json';
const articleFileDirPath = './test/samples/article_file_samples/';
const quizJsonPath = './test/samples/quiz_samples.json';
const quizFileDirPath = './test/samples/quiz_file_samples/';
const userJasonPath = './test/samples/user_samples.json';

// generate dummy data
await generateCourses(courseJsonPath, originalCourseJsonPath);
await generateArticles(articleJsonPath, articleFileDirPath, courseJsonPath, userJasonPath);
await generateQuiz(quizJsonPath, quizFileDirPath, courseJsonPath, userJasonPath);
