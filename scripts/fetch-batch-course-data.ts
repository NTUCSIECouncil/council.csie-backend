import { type UUID } from 'crypto';
import { type Course } from '@models/course-schema.ts';

interface CourseSearchResponse {
  totalCount: number;
  courses: [{
    id: UUID;
    identifier: string;
    name: string;
    class: string;
    credits: number;
    teacher: {
      name: string;
    };
  }];
}

const postCourseSearch = async (courseSerialNumber: string): Promise<Course> => {
  const url = 'https://course.ntu.edu.tw/api/v1/courses/search/quick?lang=zh_TW';
  const body = {
    query: {
      keyword: courseSerialNumber,
      time: [[], [], [], [], [], []],
      timeStrictMatch: false,
      isFullYear: null,
      excludedKeywords: [],
      enrollMethods: [],
      isEnglishTaught: false,
      isDistanceLearning: false,
      hasChanged: false,
      isAdditionalCourse: false,
      noPrerequisite: false,
      isCanceled: false,
      isIntensive: false,
      isPrecise: true,
      departments: [],
      isCompulsory: null,
    },
    batchSize: 30,
    pageIndex: 0,
    sorting: 'correlation',
  };
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status.toString()}, message: ${await response.text()}`);
  }

  const courseResponse = await response.json() as CourseSearchResponse;
  const courseCount = courseResponse.totalCount;

  if (courseCount === 1) {
    const courseData: Course = {
      _id: courseResponse.courses[0].id,
      curriculum: courseResponse.courses[0].identifier,
      lecturer: courseResponse.courses[0].teacher.name,
      class: courseResponse.courses[0].class,
      names: [courseResponse.courses[0].name],
      credit: courseResponse.courses[0].credits,
      categories: [],
    };
    return courseData;
  }

  throw new Error(`Found ${courseCount.toString()} courses for serial number ${courseSerialNumber}`);
};

const getBatchCourseData = async (startSerial: number, endSerial: number): Promise<Course[]> => {
  const courseList: Course[] = [];

  for (let courseSerial = startSerial; courseSerial <= endSerial; courseSerial++) {
    try {
      const courseData = await postCourseSearch(courseSerial.toString().padStart(5, '0'));
      courseList.push(courseData);
    } catch (error) {
      console.error(`Error fetching course ${courseSerial.toString()}`, error);
    }
  }

  return courseList;
};

export { getBatchCourseData };
