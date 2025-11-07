# 武器管理API详细文档

<cite>
**本文档引用的文件**
- [backend/src/routes/weapons.js](file://backend/src/routes/weapons.js)
- [backend/src/routes/weapons-simple.js](file://backend/src/routes/weapons-simple.js)
- [backend/src/services/weaponService.js](file://backend/src/services/weaponService.js)
- [backend/routes/weapon.py](file://backend/routes/weapon.py)
- [backend/services/weapon_service.py](file://backend/services/weapon_service.py)
- [backend/src/middleware/auth.js](file://backend/src/middleware/auth.js)
- [backend/src/middleware/validation.js](file://backend/src/middleware/validation.js)
- [backend/src/app.js](file://backend/src/app.js)
- [backend/app.py](file://backend/app.py)
- [test-weapons-data.json](file://test-weapons-data.json)
- [test-3d-models.html](file://test-3d-models.html)
</cite>

## 目录
1. [简介](#简介)
2. [API架构概览](#api架构概览)
3. [认证与授权](#认证与授权)
4. [核心API接口](#核心api接口)
5. [武器列表查询](#武器列表查询)
6. [武器详情获取](#武器详情获取)
7. [武器搜索功能](#武器搜索功能)
8. [管理员操作接口](#管理员操作接口)
9. [用户收藏功能](#用户收藏功能)
10. [错误处理与状态码](#错误处理与状态码)
11. [请求示例与响应格式](#请求示例与响应格式)
12. [最佳实践](#最佳实践)

## 简介

兵智世界武器管理API是一个功能完整的RESTful API系统，提供武器数据的增删改查、搜索、统计分析等功能。该API采用前后端分离架构，支持多种数据源（MongoDB + Neo4j），提供灵活的查询和过滤功能。

### 主要特性
- **多数据源支持**：同时使用MongoDB存储武器详细信息，Neo4j存储武器关系图谱
- **灵活的查询系统**：支持分页、过滤、搜索等多种查询方式
- **权限控制**：区分普通用户和管理员权限
- **实时统计**：提供武器类型的统计分析功能
- **用户互动**：支持收藏、兴趣记录等用户功能

## API架构概览

```mermaid
graph TB
subgraph "前端层"
WebUI[Web界面]
MobileApp[移动应用]
ThirdParty[第三方应用]
end
subgraph "API网关层"
Gateway[API网关]
CORS[CORS跨域]
RateLimit[限流控制]
end
subgraph "业务逻辑层"
AuthMiddleware[认证中间件]
ValidationMiddleware[验证中间件]
WeaponService[武器服务]
end
subgraph "数据访问层"
Mongo[MongoDB]
Neo4j[Neo4j图数据库]
SQLite[SQLite数据库]
end
WebUI --> Gateway
MobileApp --> Gateway
ThirdParty --> Gateway
Gateway --> CORS
CORS --> RateLimit
RateLimit --> AuthMiddleware
AuthMiddleware --> ValidationMiddleware
ValidationMiddleware --> WeaponService
WeaponService --> Mongo
WeaponService --> Neo4j
WeaponService --> SQLite
```

**图表来源**
- [backend/src/app.js](file://backend/src/app.js#L1-L248)
- [backend/src/routes/weapons.js](file://backend/src/routes/weapons.js#L1-L218)

## 认证与授权

### 认证机制

API使用JWT（JSON Web Token）进行用户认证，支持两种认证模式：

1. **标准JWT认证**：使用Bearer Token
2. **简化管理员模式**：通过HTTP头`X-Admin-User: true`启用

### 权限级别

| 权限级别 | 描述 | 需要的认证 |
|---------|------|-----------|
| 匿名用户 | 只能访问公开数据 | 无需认证 |
| 普通用户 | 可以收藏、记录兴趣 | JWT Token |
| 管理员 | 可以管理武器数据 | JWT Token + admin角色 |

### 认证流程

```mermaid
sequenceDiagram
participant Client as 客户端
participant Auth as 认证中间件
participant Service as 武器服务
participant DB as 数据库
Client->>Auth : 发送请求 + Token
Auth->>Auth : 验证JWT Token
alt Token有效
Auth->>Service : 转发请求
Service->>DB : 查询数据
DB-->>Service : 返回结果
Service-->>Client : 返回响应
else Token无效
Auth-->>Client : 403 Forbidden
end
```

**图表来源**
- [backend/src/middleware/auth.js](file://backend/src/middleware/auth.js#L1-L106)

**章节来源**
- [backend/src/middleware/auth.js](file://backend/src/middleware/auth.js#L1-L106)

## 核心API接口

### API根端点

```http
GET /api
```

返回API服务的基本信息和可用端点。

**响应示例：**
```json
{
  "success": true,
  "message": "兵智世界后端API服务",
  "version": "1.0.0",
  "endpoints": {
    "auth": "/api/auth",
    "weapons": "/api/weapons",
    "knowledge": "/api/knowledge"
  }
}
```

### 健康检查

```http
GET /health
```

用于检查服务健康状态。

**响应示例：**
```json
{
  "success": true,
  "message": "服务运行正常",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 3600
}
```

## 武器列表查询

### 接口描述

获取武器列表，支持分页、分类和国家过滤。

```http
GET /api/weapons?category={category}&country={country}&page={page}&limit={limit}
```

### 参数说明

| 参数名 | 类型 | 必需 | 描述 | 示例值 |
|--------|------|------|------|--------|
| category | string | 否 | 武器类型过滤 | "步枪" |
| country | string | 否 | 制造国家过滤 | "中国" |
| page | number | 否 | 页码，默认1 | 1 |
| limit | number | 否 | 每页数量，默认20 | 20 |

### 支持的武器类型

- 步枪
- 手枪  
- 机枪
- 狙击枪
- 火箭筒
- 坦克
- 战斗机
- 军舰
- 导弹
- 火炮
- 其他

### 响应格式

```json
{
  "success": true,
  "data": {
    "weapons": [
      {
        "id": "123",
        "name": "95式自动步枪",
        "type": "步枪",
        "country": "中国",
        "year": 1995,
        "description": "中国制式突击步枪",
        "manufacturer": "北方工业"
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_pages": 5,
      "total_items": 100,
      "items_per_page": 20
    }
  }
}
```

### 分页计算

- **总页数**：`Math.ceil(total_items / items_per_page)`
- **偏移量**：`(page - 1) * limit`

**章节来源**
- [backend/src/routes/weapons.js](file://backend/src/routes/weapons.js#L8-L25)
- [backend/src/routes/weapons-simple.js](file://backend/src/routes/weapons-simple.js#L8-L50)

## 武器详情获取

### 接口描述

获取单个武器的详细信息，并记录用户的浏览兴趣。

```http
GET /api/weapons/{id}
```

### 路径参数

| 参数名 | 类型 | 必需 | 描述 |
|--------|------|------|------|
| id | string | 是 | 武器唯一标识符 |

### 响应格式

```json
{
  "success": true,
  "data": {
    "id": "123",
    "name": "95式自动步枪",
    "type": "步枪",
    "country": "中国",
    "year": 1995,
    "description": "中国制式突击步枪",
    "specifications": {
      "口径": "5.8×42mm",
      "全长": "746mm",
      "重量": "3.25kg",
      "射速": "650发/分钟",
      "有效射程": "400m"
    },
    "images": [
      "https://example.com/images/95.jpg"
    ],
    "performance_data": {},
    "relationships": [
      {
        "type": "BELONGS_TO",
        "related_entity": {
          "labels": ["Category"],
          "properties": {
            "name": "步枪"
          }
        }
      }
    ],
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

### 错误处理

- **404 Not Found**：武器不存在
- **500 Internal Server Error**：服务器内部错误

**章节来源**
- [backend/src/routes/weapons.js](file://backend/src/routes/weapons.js#L50-L75)
- [backend/src/routes/weapons-simple.js](file://backend/src/routes/weapons-simple.js#L150-L190)

## 武器搜索功能

### 接口描述

根据关键词搜索武器，支持模糊匹配和过滤。

```http
GET /api/weapons/search?q={searchTerm}&category={category}&country={country}
```

### 参数说明

| 参数名 | 类型 | 必需 | 描述 | 示例值 |
|--------|------|------|------|--------|
| q | string | 是 | 搜索关键词 | "AK" |
| category | string | 否 | 武器类型过滤 | "步枪" |
| country | string | 否 | 制造国家过滤 | "俄罗斯" |

### 搜索范围

搜索会匹配以下字段：
- 武器名称
- 武器类型
- 制造国家
- 武器描述
- 制造商名称

### 响应格式

```json
{
  "success": true,
  "data": {
    "weapons": [
      {
        "id": "123",
        "name": "AK-47突击步枪",
        "type": "步枪",
        "country": "俄罗斯",
        "year": 1947,
        "description": "经典的苏联突击步枪"
      }
    ],
    "total": 5
  }
}
```

### 搜索限制

- 最大返回结果：50条
- 关键词长度：1-1000字符
- 支持模糊匹配（大小写不敏感）

**章节来源**
- [backend/src/routes/weapons.js](file://backend/src/routes/weapons.js#L27-L48)
- [backend/src/routes/weapons-simple.js](file://backend/src/routes/weapons-simple.js#L52-L120)

## 管理员操作接口

### 创建武器

```http
POST /api/weapons
Content-Type: application/json
Authorization: Bearer <token>
X-Admin-User: true
```

### 请求体格式

```json
{
  "name": "新型武器",
  "type": "步枪",
  "country": "中国",
  "year": 2024,
  "description": "最新研发的武器系统",
  "specifications": {
    "口径": "5.8×42mm",
    "全长": "750mm",
    "重量": "3.3kg"
  },
  "manufacturer": {
    "name": "北方工业",
    "country": "中国",
    "founded": 1980,
    "description": "中国主要武器制造商"
  }
}
```

### 更新武器

```http
PUT /api/weapons/{id}
Content-Type: application/json
Authorization: Bearer <token>
X-Admin-User: true
```

### 删除武器

```http
DELETE /api/weapons/{id}
Authorization: Bearer <token>
X-Admin-User: true
```

### 验证规则

API使用Joi验证框架进行数据验证：

| 字段 | 验证规则 | 错误消息 |
|------|----------|----------|
| name | 长度2-100字符，必填 | 武器名称是必填项 |
| type | 预定义枚举值，必填 | 武器类型是必填项 |
| country | 长度2-50字符，必填 | 制造国家是必填项 |
| year | 1800-2030年，可选 | 年份必须在1800-2030之间 |
| specifications | JSON对象，可选 | 技术规格必须是对象格式 |

### 权限要求

- 需要管理员权限
- 支持简化管理员模式（X-Admin-User: true）
- 自动同步到MongoDB和Neo4j

**章节来源**
- [backend/src/routes/weapons.js](file://backend/src/routes/weapons.js#L80-L120)
- [backend/src/middleware/validation.js](file://backend/src/middleware/validation.js#L60-L100)

## 用户收藏功能

### 收藏武器

```http
POST /api/weapons/{id}/favorite
Authorization: Bearer <token>
```

### 取消收藏

```http
DELETE /api/weapons/{id}/favorite
Authorization: Bearer <token>
```

### 响应格式

```json
{
  "success": true,
  "message": "收藏成功"
}
```

### 功能特点

- **用户兴趣记录**：自动记录用户的收藏行为
- **个性化推荐**：基于用户收藏生成相似武器推荐
- **跨设备同步**：收藏数据与用户账户关联

**章节来源**
- [backend/src/routes/weapons.js](file://backend/src/routes/weapons.js#L170-L190)

## 错误处理与状态码

### HTTP状态码

| 状态码 | 描述 | 场景 |
|--------|------|------|
| 200 | 成功 | 请求处理成功 |
| 201 | 创建成功 | 新资源创建成功 |
| 400 | 请求错误 | 参数错误、数据验证失败 |
| 401 | 未授权 | 缺少认证信息 |
| 403 | 禁止访问 | 权限不足 |
| 404 | 资源不存在 | 请求的资源不存在 |
| 500 | 服务器错误 | 内部服务器错误 |
| 503 | 服务不可用 | 数据库连接错误 |

### 错误响应格式

```json
{
  "success": false,
  "message": "错误描述",
  "error": {
    "code": "ERROR_CODE",
    "details": "详细错误信息"
  }
}
```

### 常见错误类型

| 错误类型 | HTTP状态码 | 描述 |
|----------|------------|------|
| 认证失败 | 401 | JWT令牌无效或已过期 |
| 权限不足 | 403 | 需要管理员权限 |
| 资源不存在 | 404 | 武器ID不存在 |
| 数据验证失败 | 400 | 请求数据不符合验证规则 |
| 数据库错误 | 500 | 数据库操作失败 |

**章节来源**
- [backend/src/app.js](file://backend/src/app.js#L120-L180)

## 请求示例与响应格式

### 获取武器列表

**请求：**
```bash
curl -X GET "http://localhost:3001/api/weapons?page=1&limit=10&category=步枪&country=中国" \
-H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**响应：**
```json
{
  "success": true,
  "data": {
    "weapons": [
      {
        "id": "123",
        "name": "95式自动步枪",
        "type": "步枪",
        "country": "中国",
        "year": 1995,
        "description": "中国制式突击步枪"
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_pages": 10,
      "total_items": 100,
      "items_per_page": 10
    }
  }
}
```

### 获取武器详情

**请求：**
```bash
curl -X GET "http://localhost:3001/api/weapons/123" \
-H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**响应：**
```json
{
  "success": true,
  "data": {
    "id": "123",
    "name": "95式自动步枪",
    "type": "步枪",
    "country": "中国",
    "year": 1995,
    "description": "中国制式突击步枪",
    "specifications": {
      "口径": "5.8×42mm",
      "全长": "746mm",
      "重量": "3.25kg"
    }
  }
}
```

### 武器搜索

**请求：**
```bash
curl -X GET "http://localhost:3001/api/weapons/search?q=AK-47&category=步枪" \
-H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**响应：**
```json
{
  "success": true,
  "data": {
    "weapons": [
      {
        "id": "456",
        "name": "AK-47",
        "type": "步枪",
        "country": "俄罗斯",
        "year": 1947,
        "description": "经典突击步枪"
      }
    ],
    "total": 1
  }
}
```

### 创建武器（管理员）

**请求：**
```bash
curl -X POST "http://localhost:3001/api/weapons" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer <admin_token>" \
-H "X-Admin-User: true" \
-d '{
  "name": "新型激光武器",
  "type": "其他",
  "country": "中国",
  "year": 2024,
  "description": "实验性激光武器系统",
  "specifications": {
    "功率": "10kW",
    "射程": "1km"
  }
}'
```

**响应：**
```json
{
  "success": true,
  "message": "武器创建成功",
  "data": {
    "id": "789",
    "name": "新型激光武器",
    "type": "其他",
    "country": "中国",
    "year": 2024,
    "description": "实验性激光武器系统"
  }
}
```

### 收藏武器

**请求：**
```bash
curl -X POST "http://localhost:3001/api/weapons/123/favorite" \
-H "Authorization: Bearer <user_token>"
```

**响应：**
```json
{
  "success": true,
  "message": "收藏成功"
}
```

## 最佳实践

### 性能优化建议

1. **合理使用分页**
   ```javascript
   // 推荐：小批量分页
   const weapons = await fetch('/api/weapons?limit=20&page=1');
   
   // 避免：大批量一次性获取
   const allWeapons = await fetch('/api/weapons?limit=1000');
   ```

2. **缓存策略**
   - 对于不经常变化的数据（如武器类型、国家列表）实施客户端缓存
   - 使用ETag进行条件请求

3. **搜索优化**
   - 限制搜索关键词长度
   - 使用索引优化数据库查询
   - 实施搜索频率限制

### 安全建议

1. **认证安全**
   - 使用HTTPS传输
   - 实施JWT令牌刷新机制
   - 设置合理的令牌过期时间

2. **输入验证**
   - 始终验证用户输入
   - 防止SQL注入和XSS攻击
   - 限制请求频率

3. **权限控制**
   - 实施最小权限原则
   - 记录敏感操作日志
   - 定期审计访问权限

### 错误处理

1. **优雅降级**
   ```javascript
   try {
     const response = await fetch('/api/weapons');
     const data = await response.json();
     // 处理成功响应
   } catch (error) {
     // 显示友好的错误消息
     showError('无法加载武器数据，请稍后重试');
   }
   ```

2. **重试机制**
   ```javascript
   async function fetchWithRetry(url, options = {}, retries = 3) {
     try {
       const response = await fetch(url, options);
       if (!response.ok) {
         throw new Error(`HTTP ${response.status}`);
       }
       return response.json();
     } catch (error) {
       if (retries > 0) {
         return fetchWithRetry(url, options, retries - 1);
       }
       throw error;
     }
   }
   ```

### 监控与调试

1. **API监控**
   - 监控响应时间和成功率
   - 跟踪错误率和错误类型
   - 分析用户行为模式

2. **日志记录**
   ```javascript
   // 记录API调用
   logger.info('API调用', {
     endpoint: '/api/weapons',
     method: 'GET',
     userId: user?.id,
     timestamp: new Date()
   });
   ```

3. **性能分析**
   ```javascript
   // 测量API响应时间
   const startTime = performance.now();
   const response = await fetch('/api/weapons');
   const endTime = performance.now();
   
   console.log(`API响应时间: ${endTime - startTime}ms`);
   ```

**章节来源**
- [test-3d-models.html](file://test-3d-models.html#L1-L320)
- [test-weapons-data.json](file://test-weapons-data.json#L1-L142)