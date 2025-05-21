export const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'council.csie API',
    version: '1.0.0',
    description: 'council.csie 系統的 RESTful API 文件',
  },
  servers: [
    { url: 'http://localhost:3010', description: 'Local dev' },
  ],
  components: {
    schemas: {
      Article: {
        type: 'object',
        properties: {
          _id: { type: 'string', format: 'uuid' },
          course: { type: 'string', format: 'uuid', description: '關聯課程的 _id' },
          creator: { type: 'string', format: 'uuid', description: '創建者的 _id' },
          semester: { type: 'string', example: '113-2' },
          title: { type: 'string' },
          tags: {
            type: 'array',
            items: { type: 'string' },
            example: ['資料結構', '演算法'],
          },
          ratings: {
            type: 'object',
            properties: {
              sweetness: { type: 'number' },
              coolness: { type: 'number' },
              usefulness: { type: 'number' },
            },
          },
        },
        required: ['course', 'creator', 'semester', 'title', 'tags'],
      },
      PopulatedArticle: {
        type: 'object',
        properties: {
          _id: { type: 'string', format: 'uuid' },
          course: { $ref: '#/components/schemas/Course' },
          creator: { $ref: '#/components/schemas/User' },
          semester: { type: 'string', example: '113-2' },
          title: { type: 'string' },
          tags: {
            type: 'array',
            items: { type: 'string' },
            example: ['資料結構', '演算法'],
          },
          ratings: {
            type: 'object',
            properties: {
              sweetness: { type: 'number' },
              coolness: { type: 'number' },
              usefulness: { type: 'number' },
            },
          },
        },
        required: ['course', 'creator', 'semester', 'title', 'tags'],
      },
      Course: {
        type: 'object',
        properties: {
          _id: { type: 'string', format: 'uuid' },
          curriculum: { type: 'string', example: 'CSIE1212' },
          lecturer: { type: 'string', example: '王小明' },
          class: { type: 'string', example: '01' },
          names: {
            type: 'array',
            items: { type: 'string' },
            example: ['資料結構與演算法', 'DSA'],
          },
          credit: { type: 'integer', example: 3 },
          categories: {
            type: 'array',
            items: { type: 'string' },
            example: ['compulsory', 'programming'],
          },
        },
        required: ['curriculum', 'lecturer', 'names', 'credit', 'categories'],
      },
      Quiz: {
        type: 'object',
        properties: {
          _id: { type: 'string', format: 'uuid' },
          course: { type: 'string', format: 'uuid' },
          uploader: { type: 'string', format: 'uuid' },
          semester: { type: 'string', example: '113-2' },
          session: {
            type: 'string',
            enum: ['midterm', 'final', 'first', 'second'],
          },
        },
        required: ['course', 'uploader', 'semester', 'session'],
      },
      User: {
        type: 'object',
        properties: {
          _id: { type: 'string', description: 'Google API uid' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          nickname: { type: 'string' },
        },
        required: ['_id', 'email', 'name'],
      },
      Meta: {
        type: 'object',
        properties: {
          total: { type: 'integer' },
          offset: { type: 'integer' },
          limit: { type: 'integer' },
        },
      },
    },
    securitySchemes: {
      firebaseAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Firebase ID Token (放在 Authorization: Bearer <token>)',
      },
    },
  },
  paths: {
    // Article API
    '/api/articles': {
      get: {
        summary: '獲取所有文章',
        tags: ['Article'],
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: {
          200: {
            description: '成功',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    articles: {
                      oneOf: [
                        { type: 'array', items: { $ref: '#/components/schemas/Article' } },
                        { type: 'string' }, // 可能是錯誤訊息
                      ],
                      // type: 'array',
                      // items: { $ref: '#/components/schemas/Article' },
                    },
                    meta: { $ref: '#/components/schemas/Meta' },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        summary: '新增評價文',
        tags: ['Article'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  article: { $ref: '#/components/schemas/Article' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: '新增成功',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    articleId: { type: 'string', format: 'uuid' },
                  },
                },
              },
            },
          },
          400: { description: '格式錯誤' },
        },
      },
    },
    '/api/articles/search': {
      get: {
        summary: '搜尋文章',
        tags: ['Article'],
        parameters: [
          {
            name: 'categories',
            in: 'query',
            schema: { type: 'array', items: { type: 'string' } },
            style: 'form',
            explode: false,
          },
          { name: 'keyword', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
          {
            name: 'tags',
            in: 'query',
            schema: { type: 'array', items: { type: 'string' } },
            style: 'form',
            explode: false,
          },
        ],
        responses: {
          200: {
            description: '成功',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    articles: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Article' },
                    },
                    meta: { $ref: '#/components/schemas/Meta' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/articles/{articleId}': {
      get: {
        summary: '獲取指定文章',
        tags: ['Article'],
        parameters: [
          { name: 'articleId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: '成功',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    article: { $ref: '#/components/schemas/Article' },
                  },
                },
              },
            },
          },
          404: { description: '找不到目標文章' },
        },
      },
      patch: {
        summary: '更新文章',
        tags: ['Article'],
        parameters: [
          { name: 'articleId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  article: {
                    anyOf: [
                      { $ref: '#/components/schemas/Article' },
                      { type: 'object' }, // Partial<Article>
                    ],
                  },
                },
              },
            },
          },
        },
        responses: {
          204: { description: '更新成功' },
          404: { description: '找不到目標文章' },
        },
      },
    },
    '/api/articles/{articleId}/file': {
      get: {
        summary: '獲取指定文章的 Markdown 檔案',
        tags: ['Article'],
        parameters: [
          { name: 'articleId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: '成功',
            content: {
              'text/markdown': {
                schema: { type: 'string' },
              },
            },
          },
        },
      },
    },

    // Category API
    '/api/categories': {
      get: {
        summary: '獲取所有類別',
        tags: ['Category'],
        responses: {
          200: {
            description: '成功',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    categories: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    // Course API
    '/api/courses/search': {
      get: {
        summary: '搜尋課程',
        tags: ['Course'],
        parameters: [
          {
            name: 'categories',
            in: 'query',
            schema: { type: 'array', items: { type: 'string' } },
            style: 'form',
            explode: false,
          },
          { name: 'keyword', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: {
          200: {
            description: '成功',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    courses: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Course' },
                    },
                    meta: { $ref: '#/components/schemas/Meta' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/courses/{courseId}': {
      get: {
        summary: '獲取課程資訊',
        tags: ['Course'],
        parameters: [
          { name: 'courseId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: '成功',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    course: { $ref: '#/components/schemas/Course' },
                  },
                },
              },
            },
          },
          404: { description: '找不到目標課程' },
        },
      },
    },
    '/api/courses/{courseId}/quizzes': {
      get: {
        summary: '獲取課程所有考古題',
        tags: ['Course', 'Quiz'],
        parameters: [
          { name: 'courseId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: {
          200: {
            description: '成功',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    quizzes: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Quiz' },
                    },
                    meta: { $ref: '#/components/schemas/Meta' },
                  },
                },
              },
            },
          },
          404: { description: '找不到目標課程' },
        },
      },
    },

    // Quiz API
    '/api/quizzes': {
      get: {
        summary: '獲取所有考古題',
        tags: ['Quiz'],
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: {
          200: {
            description: '成功',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    quizzes: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Quiz' },
                    },
                    meta: { $ref: '#/components/schemas/Meta' },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        summary: '新增考古題',
        tags: ['Quiz'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  quiz: { $ref: '#/components/schemas/Quiz' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: '新增成功',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    quizId: { type: 'string', format: 'uuid' },
                  },
                },
              },
            },
          },
          400: { description: '格式錯誤' },
        },
      },
    },
    '/api/quizzes/{quizId}': {
      get: {
        summary: '獲取指定考古題',
        tags: ['Quiz'],
        parameters: [
          { name: 'quizId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: '成功',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    quiz: { $ref: '#/components/schemas/Quiz' },
                  },
                },
              },
            },
          },
          404: { description: '找不到目標考古題' },
        },
      },
    },
    '/api/quizzes/{quizId}/file': {
      get: {
        summary: '取得指定考古題的 PDF 檔案',
        tags: ['Quiz'],
        parameters: [
          { name: 'quizId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: '成功',
            content: {
              'application/pdf': {
                schema: { type: 'string', format: 'binary' },
              },
            },
          },
        },
      },
    },

    // Tag API
    '/api/tags': {
      get: {
        summary: '獲取所有標籤',
        tags: ['Tag'],
        responses: {
          200: {
            description: '成功',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    tags: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    // User API
    '/api/users/{userId}': {
      get: {
        summary: '獲取指定使用者（只能獲取自己）',
        tags: ['User'],
        security: [{ firebaseAuth: [] }],
        parameters: [
          { name: 'userId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: '成功',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    user: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
          403: { description: '嘗試存取他人資料' },
        },
      },
      post: {
        summary: '新增或更新指定 Google ID 的使用者（只能自己）',
        tags: ['User'],
        security: [{ firebaseAuth: [] }],
        responses: {
          201: {
            description: '新增成功',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    userId: { type: 'string' },
                  },
                },
              },
            },
          },
          204: { description: '更新成功' },
          400: { description: '格式錯誤' },
          403: { description: '嘗試存取他人資料' },
        },
      },
    },
    // 補充 "/api/users/me/*" 跟 rewrite 行為不用額外寫在 Swagger path，屬於應用層邏輯
  },
};
