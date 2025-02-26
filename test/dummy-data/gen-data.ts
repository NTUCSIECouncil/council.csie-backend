import fs from 'fs/promises';
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

async function generateArticles(articleJsonPath: string, courseJsonPath: string, userJasonPath: string) {
  try {
    const articleList: Article[] = [];
    // read course and user data
    const userList = await readJsonFile(userJasonPath);
    const courseList = await readJsonFile(courseJsonPath);

    // generate articles for each course
    courseList.forEach((course) => {
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
  } catch (error) {
    console.error('Error generating articles from courses:', error);
  }
}

async function generateQuiz(quizJsonPath: string, courseJsonPath: string, userJasonPath: string) {
  try {
    const quizList: Quiz[] = [];
    const userList = await readJsonFile(userJasonPath);
    const courseList = await readJsonFile(courseJsonPath);

    courseList.forEach((course) => {
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
  } catch (error) {
    console.error('Error generating quizzes from courses:', error);
  }
}

// file paths
const originalCourseJsonPath = './test/dummy-data/course_original.json';
const courseJsonPath = './test/dummy-data/course_samples.json';
const articleJsonPath = './test/dummy-data/article_samples.json';
const quizJsonPath = './test/dummy-data/quiz_samples.json';
const userJasonPath = './test/dummy-data/user_samples.json';

// generate dummy data
await generateCourses(courseJsonPath, originalCourseJsonPath);
await generateArticles(articleJsonPath, courseJsonPath, userJasonPath);
await generateQuiz(quizJsonPath, courseJsonPath, userJasonPath);
