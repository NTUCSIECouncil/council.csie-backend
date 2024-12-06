import fs from 'fs/promises';
import { type Course } from '@models/course-schema.ts';
import { getBatchCourseData } from '@scripts/fetch-batch-course-data.ts';

async function generateCourses(filePath: string, startSerialNumber = 0, endSerialNumber = 99999) {
  try {
    const courseList: Course[] = await getBatchCourseData(startSerialNumber, endSerialNumber);

    if (courseList.length === 0) {
      console.log('No courses found.');
      return;
    }

    const jsonString = JSON.stringify(courseList);
    // console.log('Course:', jsonString);
    await fs.writeFile(filePath, jsonString);
  } catch (error) {
    console.error('Error generating courses:', error);
  }
}

// set variables
const courseFilePath = './test/dummy-data/course_original2.json';
const startSerialNumber = 0;
const endSerialNumber = 9999;

// get course information
await generateCourses(courseFilePath, startSerialNumber, endSerialNumber);
