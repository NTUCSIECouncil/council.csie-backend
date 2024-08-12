import { type UUID } from 'crypto';

const dbName = "csie-council-test";
const defaultData = {
    User: [
        {
            _id: "u1",
            email: "thomaswang2003@gmail.com",
            name: "王勻",
        },
        {
            _id: "u2",
            email: "b10902028@csie.ntu.edu.tw",
            name: "B10902028",
        },
        {
            _id: "u3",
            email: "thomaswang@csie.ntu.edu.tw",
            name: "Thomas Wang",
        }
    ],
    Article: [
        {
            _id: "00000002-0001-0000-0000-000000000000" as UUID,
            title: "高等演算法",
            lecturer: "陳和鄰",
            tag: ["腦筋急轉彎", "好兇"],
            grade: 1,
            categories: ["選修", "電機"],
            content: "# Header 1\n\n## Header 2\n\njizz",
            course: "00000003-0001-0000-0000-000000000000" as UUID,
            creator: "u1",
            createdAt: new Date(),
            updatedAt: new Date(),
        },
        {
            _id: "00000002-0002-0000-0000-000000000000" as UUID,
            title: "人工智慧導論",
            lecturer: "薇薇安",
            tag: ["林軒田的遺產", "阿偉說的"],
            grade: 1,
            categories: ["必修", "水課"],
            content: "# Header 1\n\n## Header 2\n\njizz",
            course: "00000003-0002-0000-0000-000000000000" as UUID,
            creator: "u2",
            createdAt: new Date(),
            updatedAt: new Date(),
        }
    ],
    Course: [
        {
            _id: "00000003-0001-0000-0000-000000000000" as UUID,
            title: "高等演算法",
            semester: "大三",
            credit: 3,
            lecturer: "陳和鄰",
            past_quiz: "蛤",
            ratings: "蛤",
        },
        {
            _id: "00000003-0002-0000-0000-000000000000" as UUID,
            title: "人工智慧導論",
            semester: "大三",
            credit: 3,
            lecturer: "薇薇安",
            past_quiz: "蛤",
            ratings: "蛤",
        }
    ],
    Quiz: [
        {
            _id: "00000004-0001-0000-0000-000000000000" as UUID,
            title: "期中考",
            course: "00000003-0002-0000-0000-000000000000" as UUID,
            semester: "112-1",
            downloadLink: "https://www.berkeley.edu/",
        }
    ],
};

import 'dotenv/config';
import { models } from "@models/index";
import { type Article } from "@models/ArticleSchema";
import { type Course } from "@models/course-schema";
import { type Quiz } from "@models/quiz-schema";
import { type User } from "@models/userschema";
import mongoose from 'mongoose';
import { type Model } from 'mongoose';

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
    await mongoose.connection.db.dropDatabase();
    console.log(`Dropped database "${dbName}"`);

    await insertAll<Article>(models.Article, defaultData.Article);
    await insertAll<Course>(models.Course, defaultData.Course);
    await insertAll<Quiz>(models.Quiz, defaultData.Quiz);
    await insertAll<User>(models.User, defaultData.User);

    process.exit();
})();
