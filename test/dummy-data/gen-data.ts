import fs from 'fs/promises';
import { getBatchCourseData } from '@scripts/fetch-batch-course-data.ts';
import { type Course } from '@models/course-schema.ts';
// import { models } from '@models/index.ts';

// const CourseModel = models.Course;
// const ArticleModel = models.Article;

async function generateArticlesFromCourses() {
  try {
    // Connect to MongoDB
    // Fetch all courses
    // let courseList: Course[] = [];
    const courseList: Course[] = await getBatchCourseData(27500, 27502);

    if (courseList.length === 0) {
      console.log('No courses found. Please add courses to the database.');
      return;
    }
    for (const course of courseList) {
      const jsonString = JSON.stringify(course);
      console.log('Course:', jsonString);
      await fs.writeFile('./test/dummy-data/Course.json', jsonString);
    }
    // Generate articles based on courses
    // const sampleArticles = courses.map((course: { _id: string; lecturer?: string; names: string[] }) => {
    const sampleArticles = courseList.map((course: Course) => {
      const lecturerName = course.lecturer || 'Unknown Lecturer';
      const articleId = `${course._id}-article`;

      return {
        _id: articleId, // Generate an article ID using the course ID
        course: course._id, // Link to the course
        creator: '00000001-0001-0000-0000-000000000000', // Default creator ID
        semester: '113-2', // Sample semester
        title: `Sample Article for ${course.names[0]}`,
        lecturer: lecturerName,
        tags: [lecturerName, course.names[0]], // Tags based on course and lecturer
      };
    });

    // Insert all sample articles into the database
    // const createdArticles = await ArticleModel.insertMany(sampleArticles);

    console.log('Sample articles created:', sampleArticles);
  } catch (error) {
    console.error('Error generating articles from courses:', error);
  } finally {
    process.exit();
  }
}

// Run the script
await generateArticlesFromCourses();
