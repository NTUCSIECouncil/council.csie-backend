import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import mongoose from 'mongoose'; // Use type imports and sort
import { models } from '@models/index.ts';

interface EnvConfig {
  mongoURL: string;
  dbName: string;
  articleFileDir: string;
  quizFileDir: string;
}

function getEnvVariables(): EnvConfig {
  const { MONGODB_URL, MONGODB_DEV_DB_NAME, ARTICLE_FILE_DIR, QUIZ_FILE_DIR } = process.env;

  if (!MONGODB_URL || !MONGODB_DEV_DB_NAME || !ARTICLE_FILE_DIR || !QUIZ_FILE_DIR) {
    console.error(
      'Error: MONGODB_URL, MONGODB_DEV_DB_NAME, ARTICLE_FILE_DIR, and QUIZ_FILE_DIR must be defined in your .env file.',
    );
    process.exit(1);
  }
  return {
    mongoURL: MONGODB_URL,
    dbName: MONGODB_DEV_DB_NAME,
    articleFileDir: ARTICLE_FILE_DIR,
    quizFileDir: QUIZ_FILE_DIR,
  };
}

async function connectToMongoDB(url: string, dbName: string): Promise<void> {
  await mongoose.connect(url, { dbName });
  console.log(`Successfully connected to MongoDB database: ${dbName}`);
}

async function disconnectFromMongoDB(): Promise<void> {
  if (
    mongoose.connection.readyState === mongoose.ConnectionStates.connected
    || mongoose.connection.readyState === mongoose.ConnectionStates.connecting
  ) {
    await mongoose.disconnect();
    console.log('Successfully disconnected from MongoDB.');
  }
}

async function deleteModelFiles(
  model: 'Article' | 'Quiz',
  fileDir: string,
  fileSuffix: string,
  modelNameForLog: string,
): Promise<void> {
  console.log(`Attempting to delete ${modelNameForLog} files based on database entries...`);
  let entries;
  if (model == 'Article') {
    entries = await models.Article.find().lean();
  } else {
    entries = await models.Quiz.find().lean();
  }

  let filesDeleted = 0;

  for (const entry of entries) {
    const filePath = path.join(fileDir, `${entry._id.toString()}${fileSuffix}`);
    try {
      await fs.unlink(filePath);
      // console.log(`Deleted ${modelNameForLog} file: ${filePath}`);
      filesDeleted++;
    } catch (e: unknown) {
      console.error(`Error deleting ${modelNameForLog} file ${filePath}:`, e);
    }
  }
  console.log(
    `Finished attempting to delete ${modelNameForLog} files. ${filesDeleted.toString()} files deleted out of ${entries.length.toString()} database entries.`,
  );
}

async function dropDatabase(dbName: string): Promise<void> {
  console.log(`Attempting to drop database: ${dbName}...`);
  if (mongoose.connection.db) {
    await mongoose.connection.db.dropDatabase();
    console.log(`Successfully dropped database: ${dbName}`);
  } else {
    console.warn(
      `Could not drop database ${dbName} as mongoose.connection.db is undefined.`,
    );
  }
}

async function performCleanup(): Promise<void> {
  const config = getEnvVariables();

  await connectToMongoDB(config.mongoURL, config.dbName);

  await deleteModelFiles('Article', config.articleFileDir, '.md', 'article');
  await deleteModelFiles('Quiz', config.quizFileDir, '.pdf', 'quiz');

  await dropDatabase(config.dbName);
}

async function main(): Promise<void> {
  try {
    await performCleanup();
  } catch (error) {
    console.error('An error occurred during the cleanup process:', error);
    process.exitCode = 1; // Indicate an error exit
  } finally {
    await disconnectFromMongoDB();
  }
  console.log('Cleanup process finished.');
}

main().catch((err) => {
  console.error('An unexpected error occurred at the top level:', err);
  process.exit(1);
});
