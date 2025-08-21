import fs from 'fs/promises';
import path from 'path';

import { z } from 'zod';

import { ZUuidSchema } from '@/models/util-schema.ts';
import { type Course } from '@models/course-schema.ts';

if (process.env.SAMPLES_DIR === undefined) {
  console.error('environment variable SAMPLES_DIR is not set');
  console.error('Exiting...');
  process.exit();
}

const ZCourseFromApiSchema = z.object({
  id: ZUuidSchema,
  identifier: z.string(),
  name: z.string(),
  class: z.string().nullable(),
  credits: z.number().nonnegative(),
  teacher: z.object({ name: z.string() }).partial(),
  semester: z.string(),
  // Additional fields can be added as needed
});

interface CourseFromApi extends z.infer<typeof ZCourseFromApiSchema> {}

const ZCourseSearchResponseSchema = z.object({
  totalCount: z.number().int().nonnegative(),
  courses: z.array(ZCourseFromApiSchema),
});

interface CourseSearchResponse
  extends z.infer<typeof ZCourseSearchResponseSchema> {}

const DEFAULT_BATCH_SIZE = 30;
const API_URL =
  'https://course.ntu.edu.tw/api/v1/courses/search/quick?lang=zh_TW';

const fetchCoursePage = async (
  keyword: string,
  pageIndex: number,
  batchSize: number,
  semester: string, // Added semester as a parameter
): Promise<CourseSearchResponse> => {
  const body = {
    query: {
      keyword: keyword,
      time: [[], [], [], [], [], []], // Default empty time slots
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
      semester: semester,
    },
    batchSize: batchSize,
    pageIndex: pageIndex,
    sorting: 'correlation',
  };

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `HTTP error! Status: ${response.status.toString()}, message: ${errorText}`,
    );
  }

  let courseSearchResponse;
  try {
    courseSearchResponse = ZCourseSearchResponseSchema.parse(
      await response.json(),
    );
  } catch (error) {
    throw new Error(
      `Failed to parse course search response with keyword "${keyword}", batch size ${batchSize.toString()}, page index ${pageIndex.toString()}, semester ${semester}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (pageIndex % 10 === 0) {
    console.log(
      `Fetched page ${pageIndex.toString()} for keyword "${keyword}" (Semester: ${semester})`,
    );
  }
  return courseSearchResponse;
};

const transformApiCourseToCourse = (apiCourse: CourseFromApi): Course => {
  return {
    _id: apiCourse.id,
    curriculum: apiCourse.identifier,
    lecturer: apiCourse.teacher.name ?? 'Unknown Lecturer',
    class: apiCourse.class ?? undefined,
    names: [apiCourse.name],
    credit: apiCourse.credits,
    semester: apiCourse.semester,
  };
};

const getBatchCourseData = async (
  keyword: string,
  semester: string,
): Promise<Course[]> => {
  const allProcessedCourses: Course[] = [];
  let currentPageIndex = 0;
  let totalCount = 0;
  let fetchedCoursesOnPage = 0;

  console.log(
    `Starting to fetch all courses for keyword: "${keyword}", Semester: ${semester}`,
  );

  do {
    try {
      const pageResponse = await fetchCoursePage(
        keyword,
        currentPageIndex,
        DEFAULT_BATCH_SIZE,
        semester, // Pass semester to fetchCoursePage
      );

      if (currentPageIndex === 0) {
        totalCount = pageResponse.totalCount;
        if (totalCount === 0) {
          console.log(
            `No courses found for keyword "${keyword}", Semester: ${semester}.`,
          );
          break;
        }
        console.log(
          `Total courses to fetch for keyword "${keyword}", Semester: ${semester}: ${totalCount.toString()}`,
        );
      }

      fetchedCoursesOnPage = pageResponse.courses.length;

      if (
        fetchedCoursesOnPage === 0 &&
        totalCount > 0 &&
        currentPageIndex * DEFAULT_BATCH_SIZE < totalCount
      ) {
        console.warn(
          `Warning: API returned no courses on page ${currentPageIndex.toString()} for keyword "${keyword}", Semester: ${semester}, even though more were expected. Stopping.`,
        );
        break;
      }

      for (const apiCourse of pageResponse.courses) {
        allProcessedCourses.push(transformApiCourseToCourse(apiCourse));
      }

      currentPageIndex++;
    } catch (error) {
      console.error(
        `Error fetching page ${currentPageIndex.toString()} for keyword "${keyword}", Semester: ${semester}:`,
        error,
      );
      break;
    }
  } while (allProcessedCourses.length < totalCount && fetchedCoursesOnPage > 0);

  console.log(
    `Finished fetching. Total fetched pages: ${currentPageIndex.toString()} and ${allProcessedCourses.length.toString()} courses for keyword "${keyword}", Semester: ${semester}`,
  );
  return allProcessedCourses;
};

const jsonDirPath = process.env.SAMPLES_DIR;
console.log(`Writing course data to ${jsonDirPath}`);

const originalCourseJsonPath = path.join(jsonDirPath, 'course-original.json');

await fs.mkdir(jsonDirPath, { recursive: true });
const courseList = await getBatchCourseData('', '113-2');
await fs.writeFile(originalCourseJsonPath, JSON.stringify(courseList, null, 2));

console.log(`Finished writing course data to ${originalCourseJsonPath}`);
