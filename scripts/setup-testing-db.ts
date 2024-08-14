import 'dotenv/config';
import { models } from "@models/index.ts";
import { type Article } from "@models/article-schema.ts";
import { type Course } from "@models/course-schema.ts";
import { type Quiz } from "@models/quiz-schema.ts";
import { type User } from "@models/user-schema.ts";
import mongoose from 'mongoose';
import { type Model } from 'mongoose';

const dbName = "csie-council-test";
const defaultData: {User: User[], Article: Article[], Course: Course[], Quiz: Quiz[]} = {
    User: [
        {
            _id: "00000001-0001-0000-0000-000000000000",
            email: "thomaswang2003@gmail.com",
            name: "王勻",
        },
        {
            _id: "00000001-0002-0000-0000-000000000000",
            email: "b10902028@csie.ntu.edu.tw",
            name: "B10902028",
        },
        {
            _id: "00000001-0003-0000-0000-000000000000",
            email: "thomaswang@csie.ntu.edu.tw",
            name: "Thomas Wang",
        }
    ],
    Article: [
        {
            _id: "00000002-0001-0000-0000-000000000000",
            title: "高等演算法",
            lecturer: "陳和鄰",
            tag: ["腦筋急轉彎", "好兇"],
            grade: 1,
            categories: ["選修", "電機"],
            content: "# Header 1\n\n## Header 2\n\njizz",
            course: "00000003-0001-0000-0000-000000000000",
            creator: "00000001-0001-0000-0000-000000000000",
            createdAt: new Date(),
            updatedAt: new Date(),
        },
        {
            _id: "00000002-0002-0000-0000-000000000000",
            title: "人工智慧導論",
            lecturer: "薇薇安",
            tag: ["林軒田的遺產", "阿偉說的"],
            grade: 1,
            categories: ["必修", "水課"],
            content: "# Header 1\n\n## Header 2\n\njizz",
            course: "00000003-0002-0000-0000-000000000000" ,
            creator: "00000001-0002-0000-0000-000000000000",
            createdAt: new Date(),
            updatedAt: new Date(),
        }
    ],
    Course: [
        {
            _id: "00000003-0001-0000-0000-000000000000" ,
            title: "高等演算法",
            semester: "大三",
            credit: 3,
            lecturer: "陳和鄰",
            pastQuiz: "蛤",
            ratings: "蛤",
        },
        {
            _id: "00000003-0002-0000-0000-000000000000" ,
            title: "人工智慧導論",
            semester: "大三",
            credit: 3,
            lecturer: "薇薇安",
            pastQuiz: "蛤",
            ratings: "蛤",
        }
    ],
    Quiz: [
        {
            _id: "00000004-0001-0000-0000-000000000000",
            title: "期中考",
            course: "00000003-0002-0000-0000-000000000000" ,
            semester: "112-1",
            downloadLink: "https://www.berkeley.edu/",
        }
    ],
};

async function insertAll<T>(model: Model<T>, data: Partial<T>[]) {
    console.log(`Inserting ${data.length} data into`, model);
    for (let d of data) {
        const doc = new model(d);
        await doc.save();
    }
}

(async () => {
    if (process.env.MONGODB_URL === undefined) {
        console.log("env.MONGODB_URL not found");
        return;
    }
    await mongoose.connect(process.env.MONGODB_URL, {
        dbName
    });
    console.log('Connected to MongoDB');
    console.log(`Dropping database "${dbName}"`);
    await mongoose.connection.db!.dropDatabase();
    console.log(`Dropped database "${dbName}"`);

    type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

    await insertAll<PartialBy<Article, '_id'>>(models.Article, defaultData.Article);
    await insertAll<PartialBy<Course, '_id'>>(models.Course, defaultData.Course);
    await insertAll<PartialBy<Quiz, '_id'>>(models.Quiz, defaultData.Quiz);
    await insertAll<User>(models.User, defaultData.User);

    process.exit();
})();
