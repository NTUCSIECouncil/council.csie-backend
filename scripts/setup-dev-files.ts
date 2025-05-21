import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import mongoose from 'mongoose';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { models } from '@models/index.ts';

async function connectDB(url: string, dbName: string): Promise<void> {
  await mongoose.connect(url, { dbName });
  console.log('Successfully connected to MongoDB.');
}

async function generateArticleFile(articleDir: string): Promise<void> {
  await fs.mkdir(articleDir, { recursive: true });

  const articles = await models.Article.find().lean();
  console.log(`Found ${articles.length.toString()} articles to process.`);

  for (const article of articles) {
    const markdownContent = [
      `# ${article.title}`,
      '',
      `- id: ${article._id}`,
      `- creator: ${article.creator}`,
      `- semester: ${article.semester}`,
      `- tags: ${article.tags.join(', ')}`,
    ].join('\n');

    const outputFilePath = path.join(articleDir, `${article._id}.md`);
    await fs.writeFile(outputFilePath, markdownContent, 'utf8');
  }
}

async function generateQuizFile(quizDir: string): Promise<void> {
  await fs.mkdir(quizDir, { recursive: true });

  const quizzes = await models.Quiz.find().lean();
  console.log(`Found ${quizzes.length.toString()} quizzes to process.`);

  for (const quiz of quizzes) {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const { height } = page.getSize();

    const textContent = [
      `Quiz ID: ${quiz._id}`,
      `Course: ${quiz.course}`,
      `Uploader: ${quiz.uploader}`,
      `Semester: ${quiz.semester}`,
      `Session: ${quiz.session}`,
    ].join('\n');

    page.drawText(textContent, {
      x: 50,
      y: height - 50,
      size: 12,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    });

    const pdfBytes = await pdfDoc.save();
    const outputFilePath = path.join(quizDir, `${quiz._id}.pdf`);
    await fs.writeFile(outputFilePath, pdfBytes);
  }
}

function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function performSetupActions(): Promise<void> {
  const mongoUrl = getEnvVar('MONGODB_URL');
  const dbName = getEnvVar('MONGODB_DEV_DB_NAME');
  const articleDir = getEnvVar('ARTICLE_FILE_DIR');
  const quizDir = getEnvVar('QUIZ_FILE_DIR');

  await connectDB(mongoUrl, dbName);

  try {
    await generateArticleFile(articleDir);
    await generateQuizFile(quizDir);
    console.log('Development files setup completed successfully.');
  } catch (error) {
    console.error('An error occurred during file setup:', error);
  } finally {
    await mongoose.disconnect();
  }
}

await performSetupActions();
