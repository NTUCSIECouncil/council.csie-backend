# council.csie 前後端文件

## Commit Style Guide

<https://gist.github.com/ericavonb/3c79e5035567c8ef3267>

## Object Interface

### Note

- `_id` 欄位是物件在資料庫中使用的 UUID。該值通常由後端指定，並且在創建之後不可更改。因此，對於 `POST` 的創建類 API，前端給出的 `_id` 欄位通常被忽視（`Omit<Object, '_id'>`）；`PATCH` 更新 API 中，則不必給出，若給出，那必須與原值相同。

### Article

評價文。

```ts!
interface Article {
  _id: UUID;
  course: UUID; // the _id of the associated course
  creator: UUID; // the _id of the creator
  semester: string; // 學期, e.g. '113-2'
  title: string;
  tags: string[]; // e.g. ['資料結構', '演算法', '田涼']
}
```

### Course

課程。

```ts!
interface Course {
  _id: UUID;
  curriculum: string // 課號, e.g. 'CSIE1212'
  lecturer: string;
  class?: string; // 班次, e.g. '01'
  names: string[] // 課程名稱, e.g. ['資料結構與演算法', 'Data Structures and Algorithms', 'DSA']
  credit: number; // 學分數, e.g. 3
  categories: string[], // 課程類別, e.g. ['compulsory', 'programming']
}
```

### Quiz

考古題。

```ts!
interface Quiz {
  _id: UUID;
  course: UUID; // the _id of the associated course
  uploader: UUID; // the _id of the uploader
  semester: string; // 學期, e.g. '113-2'
  session: 'midterm' | 'final' | 'first' | 'second'
}
```

### User

使用者相關資訊。

```ts!
interface User {
  _id: string;
  email: string;
  name: string;
}
```

`_id` 欄位必須與該 Google user 在 Google API 裡面的 uid 相同。

## API

### 功能請求

- 請放在這裡

### Note

- URL 中，`:x` 表示這裡應該填入一個將被當作 `x` 變數詮釋的字串。例如，當 API 寫`/api/users/:uid`，表示 `/api/users/1234` 被理解成 `uid = '1234'`。
- Query parameters 是應該要填在 URL 最後面的參數。例如，當 API 寫對於 `/api/articles/search`，有 query parameter `keyward?: string`，你可以傳 `/api/articles/search?keyward=wangboss`，後端會理解成 `keyward=wangboss` 查詢。
- body 欄位表示 `req.body` 應該要填入的物件。
- return 欄位表示 `await response.json()` 應該要回傳的物件。
- 如果 query parameters 包含，那麼 `offset` 代表想要跳過幾筆資源，須為非負整數；`limit` 代表預期回傳數量，須為正整數。兩者的預設值分別是是 0 筆和 10 筆，除非另有註明。
- Status code 遵循通常的意義，盡力遵循 [RFC 9110](https://httpwg.org/specs/rfc9110.html#overview.of.status.codes)。

### 範例

```json
GET /api/example/:uuid
query parameter:
{
  question: string,
}
body: {}
return:
{
  message: string,
}
```

### Article

#### `GET /api/articles`

獲取所有文章。

Query Parameter:

| name   | type   | required | description |
|--------|--------|----------|-------------|
| offset | number | False    | 跳過幾筆資源      |

Response:

- `200`：成功獲取
  Body:

  ```ts!
  {
    items: Article[],
  }
  ```

---

```json
POST /api/articles
body: Omit<Article, '_id'>
return:
{
  uuid: UUID,
}
```

創造新評價文。

可能 status code：

- 201：成功創造
- 400：格式錯誤

---

```json
GET /api/articles/search
query parameter:
{
  offset?: number,
  limit?: number,
  tag?: string[],
  keyword?: string,
  categories?: string[],
  lecturer?: string,
  grade?: number,
}
body: {}
return:  
{
  items: Article[],
}
```

搜尋所有文章。

可能 status code：

- 209：成功獲取
- 400：格式錯誤

---

```json
GET /api/articles/:uuid
body: {}
return:  
{
  item: Article,
}
```

獲得 `uuid` 文章。

可能 status code：

- 200：成功獲取
- 400：格式錯誤
- 404：獲取目標不存在

---

```json
PATCH /api/articles/:uuid
body: Partial<Article, '_id'>
return: {}
```

更新 `uuid` 文章。

可能 status code：

- 204：成功更新
- 400：格式錯誤或修改目標不存在

### Quiz

```json
GET /api/quizzes
query parameters:
{
  offset?: number,
  limit?: number,
}
body: {}
return:
{
  items: Quiz[],
}
```

可能 status code：

- 200：成功獲取

---

```json
POST /api/quizzes
body: Omit<Quiz, '_id'>
return:
{
  uuid: UUID,
}
```

創造新的考古題。

可能 status code：

- 201：成功創造
- 400：格式錯誤

---

```json
GET /api/quizzes/search
query parameter:
{
  offset?: number,
  limit?: number,
  keyword?: string,
  course: UUID,
}
body: {}
return: 
{
    items: Quiz[],
}
```

搜索 `cource` 跟 `keyword` 的考古題。

可能 status code：

- 200：成功獲取
- 400：格式錯誤

---

```json
GET /api/quizzes/:uuid
body: {}
return: 
{
  item: Quiz,
}
```

可能 status code：

- 200：成功獲取
- 400：格式錯誤
- 404：獲取目標不存在

### User

`/api/users/myself/*` 會是 `/api/users/<user-uuid>/*` 的別名。

---

```json
GET /api/users/:uuid
body: {}
return:
{
  item: User,
}
```

取得 UUID 為 `uuid` 的使用者的資料。必須是該使用者本人才可以會成功，否則回傳 `403`。

可能 status code：

- 200：成功獲取
- 403：嘗試存取其他使用者的資訊
- 404：獲取目標不存在

---

```json
POST /api/users/:uuid
body: {}
return: {}
```

建立（如果還不存在） `/api/users/:uuid`，並根據使用者 Google 的資訊重新設定如下：

```ts!
{
  _id: guser.uid,
  name: guser.name,
  email: guser.email,
}
```

必須是該使用者本人才可以會成功。

可能 status code：

- 201：成功創造
- 204：成功更改
- 403：嘗試幫其他使用者創建資訊

### Course

```json
GET /api/courses/:uuid
body: {}
return: 
{
  item: Course,
}
```

可能 status code：

- 200：成功獲取
- 400：格式錯誤
- 404：獲取目標不存在
