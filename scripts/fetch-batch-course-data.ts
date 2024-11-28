import { type Course } from '@models/course-schema.ts';

interface dataInterface {
    totalCount: number,
    courses: [{
        id: `${string}-${string}-${string}-${string}-${string}`,
        identifier: string,
        name: string,
        class: string,
        credits: number,
        teacher: {
            name: string,
        },
    }],
}

const postCourseSearch = async (course_number_with_prefix_0: string): Promise<Course> => {
    const url = 'https://course.ntu.edu.tw/api/v1/courses/search/quick?lang=zh_TW';
    const body = {
        query: { /* 以下的選項是「僅考慮」*/
            keyword: course_number_with_prefix_0,
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
        sorting: "correlation",
    };
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json() as dataInterface;
    const foundCourseCount = data["totalCount"];
    if(foundCourseCount == 1) {
        const courseInstance: Course = {
            _id: data["courses"][0]["id"],
            curriculum: data["courses"][0]["identifier"],
            lecturer: data["courses"][0]["teacher"]["name"],
            class: data["courses"][0]["class"],
            names: [data["courses"][0]["name"]], 
            credit: data["courses"][0]["credits"],
            categories: [],
        }
        return courseInstance;
    }
    throw new Error(`Found ${foundCourseCount} courses on single course serial number ${course_number_with_prefix_0}`);
};

const getBatchCourseData = async (startSerialNumber: number, endSerialNumber: number): Promise<Course[]> => {
    const courseBatchList: Course[] = [];
    for(let serialNumber = startSerialNumber; serialNumber <= endSerialNumber; serialNumber += 1) {
        try {
            const obj = await postCourseSearch(serialNumber.toString().padStart(5, '0'));
            courseBatchList.push(obj);
        }
        catch (err) {
            console.log(`Error on ${serialNumber} fetching`, err);
        }
    }
    return courseBatchList;
}

export { getBatchCourseData };

  