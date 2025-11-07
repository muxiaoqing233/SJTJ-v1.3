# 武器管理API详细文档

<cite>
**本文档引用的文件**
- [weapons.js](file://backend/src/routes/weapons.js)
- [weapon.py](file://backend/routes/weapon.py)
- [weaponService.js](file://backend/src/services/weaponService.js)
- [weapon_service.py](file://backend/services/weapon_service.py)
- [validation.js](file://backend/src/middleware/validation.js)
- [auth.js](file://backend/src/middleware/auth.js)
- [index.js](file://backend/src/config/index.js)
- [app.js](file://backend/src/app.js)
- [test-weapons-data.json](file://test-weapons-data.json)
</cite>

## 目录
1. [简介](#简介)
2. [API概述](#api概述)
3. [认证机制](#认证机制)
4. [速率限制](#速率限制)
5. [核心API端点](#核心api端点)
6. [武器识别API](#武器识别api)
7. [错误处理](#错误处理)
8. [响应格式规范](#响应格式规范)
9. [使用示例](#使用示例)
10. [最佳实践](#最佳实践)

## 简介

兵智世界武器管理API提供了全面的武器信息管理功能，支持武器的增删改查、搜索、统计、相似推荐等功能。该API采用RESTful设计原则，支持多种认证方式，并具备完善的错误处理和速率限制机制。

### 主要功能特性
- **武器基础管理**：增删改查武器信息
- **高级搜索**：支持全文搜索和分类筛选
- **智能推荐**：基于武器类型和国家的相似武器推荐
- **用户行为记录**：支持浏览和收藏功能
- **武器识别**：支持图片上传和Base64编码的武器识别
- **统计分析**：提供武器类型和国家分布统计

## API概述

### 基础信息
- **基础URL**: `/api/weapons`
- **内容类型**: `application/json`
- **默认分页**: 每页20条记录
- **搜索限制**: 最多返回50条搜索结果

### 支持的HTTP方法
- **GET**: 获取列表、详情、搜索、统计
- **POST**: 创建武器
- **PUT**: 更新武器
- **DELETE**: 删除武器

## 认证机制

### 认证方式

API支持两种认证方式：

1. **JWT Token认证**（推荐）
   - 需要在请求头中包含：`Authorization: Bearer <token>`
   - 用于管理员操作和用户功能

2. **简化管理员模式**
   - 通过请求头：`X-Admin-User: true`
   - 仅用于开发和测试环境

### 权限级别

| 操作类型 | 认证要求 | 管理员权限 |
|---------|---------|-----------|
| 获取武器列表 | 可选认证 | ❌ |
| 搜索武器 | 可选认证 | ❌ |
| 获取武器详情 | 可选认证 | ❌ |
| 获取相似武器 | 可选认证 | ❌ |
| 获取统计信息 | 无需认证 | ❌ |
| 创建武器 | JWT认证 + 管理员 | ✅ |
| 更新武器 | JWT认证 + 管理员 | ✅ |
| 删除武器 | JWT认证 + 管理员 | ✅ |
| 收藏武器 | JWT认证 | ❌ |
| 取消收藏 | JWT认证 | ❌ |

**节来源**
- [auth.js](file://backend/src/middleware/auth.js#L1-L106)

## 速率限制

### 限制策略

系统采用基于IP的速率限制机制，防止API滥用和保护服务器资源。

### 配置参数

| 参数 | 默认值 | 描述 |
|-----|-------|------|
| 时间窗口 | 15分钟 | 单位：毫秒（900000ms） |
| 最大请求数 | 1000个请求 | 在时间窗口内的最大请求数 |
| 错误响应 | HTTP 429 | 请求过于频繁时的响应状态码 |

### 实现机制

```mermaid
flowchart TD
A["客户端请求"] --> B["速率限制中间件"]
B --> C{"检查请求计数"}
C --> |未超限| D["继续处理请求"]
C --> |超限| E["返回429错误"]
D --> F["执行业务逻辑"]
F --> G["返回响应"]
E --> H["客户端处理错误"]
```

**图表来源**
- [app.js](file://backend/src/app.js#L60-L75)
- [index.js](file://backend/src/config/index.js#L48-L52)

**节来源**
- [app.js](file://backend/src/app.js#L60-L75)
- [index.js](file://backend/src/config/index.js#L48-L52)

## 核心API端点

### 1. 获取武器列表

**端点**: `GET /api/weapons`

**功能**: 获取武器列表，支持分页和过滤

**请求参数**:

| 参数名 | 类型 | 必需 | 描述 | 示例 |
|-------|------|------|------|------|
| category | string | 否 | 武器类型过滤 | `步枪` |
| country | string | 否 | 制造国家过滤 | `中国` |
| page | number | 否 | 页码，默认1 | `1` |
| limit | number | 否 | 每页数量，默认20 | `20` |

**响应格式**:

```json
{
  "success": true,
  "data": {
    "weapons": [
      {
        "id": "64e4b3a2f1c9d8e7f0a1b2c3",
        "name": "95式自动步枪",
        "type": "步枪",
        "country": "中国",
        "year": 1995,
        "description": "中国制式突击步枪",
        "images": []
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

**状态码**:
- `200`: 成功
- `500`: 服务器内部错误

**节来源**
- [weapons.js](file://backend/src/routes/weapons.js#L8-L22)

### 2. 搜索武器

**端点**: `GET /api/weapons/search`

**功能**: 按关键词搜索武器，支持分类和国家过滤

**请求参数**:

| 参数名 | 类型 | 必需 | 描述 | 示例 |
|-------|------|------|------|------|
| q | string | 是 | 搜索关键词 | `步枪` |
| category | string | 否 | 武器类型过滤 | `步枪` |
| country | string | 否 | 制造国家过滤 | `中国` |

**响应格式**:

```json
{
  "success": true,
  "data": {
    "weapons": [
      {
        "id": "64e4b3a2f1c9d8e7f0a1b2c3",
        "name": "95式自动步枪",
        "type": "步枪",
        "country": "中国",
        "year": 1995,
        "description": "中国制式突击步枪"
      }
    ],
    "total": 10
  }
}
```

**状态码**:
- `200`: 成功
- `400`: 搜索关键词不能为空
- `500`: 服务器内部错误

**节来源**
- [weapons.js](file://backend/src/routes/weapons.js#L24-L42)

### 3. 获取武器详情

**端点**: `GET /api/weapons/:id`

**功能**: 获取指定ID的武器详细信息

**路径参数**:

| 参数名 | 类型 | 必需 | 描述 |
|-------|------|------|------|
| id | string | 是 | 武器唯一标识符 |

**响应格式**:

```json
{
  "success": true,
  "data": {
    "id": "64e4b3a2f1c9d8e7f0a1b2c3",
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
    "images": [],
    "documents": [],
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
    "created_at": "2023-08-25T10:30:00.000Z"
  }
}
```

**状态码**:
- `200`: 成功
- `404`: 武器不存在
- `500`: 服务器内部错误

**节来源**
- [weapons.js](file://backend/src/routes/weapons.js#L44-L70)

### 4. 获取相似武器

**端点**: `GET /api/weapons/:id/similar`

**功能**: 获取与指定武器相似的其他武器

**路径参数**:

| 参数名 | 类型 | 必需 | 描述 |
|-------|------|------|------|
| id | string | 是 | 武器唯一标识符 |

**查询参数**:

| 参数名 | 类型 | 必需 | 默认值 | 描述 |
|-------|------|------|-------|------|
| limit | number | 否 | 5 | 返回相似武器的数量 |

**响应格式**:

```json
{
  "success": true,
  "data": {
    "similar_weapons": [
      {
        "id": "64e4b3a2f1c9d8e7f0a1b2c4",
        "name": "M4卡宾枪",
        "type": "步枪",
        "country": "美国"
      }
    ]
  }
}
```

**状态码**:
- `200`: 成功
- `500`: 服务器内部错误

**节来源**
- [weapons.js](file://backend/src/routes/weapons.js#L72-L85)

### 5. 创建武器

**端点**: `POST /api/weapons`

**功能**: 创建新的武器记录（管理员权限）

**请求体**:

```json
{
  "name": "新型激光武器",
  "type": "步枪",
  "country": "中国",
  "year": 2024,
  "description": "实验性激光武器系统",
  "specifications": {
    "功率": "1000W",
    "射程": "1000m",
    "重量": "15kg"
  }
}
```

**请求体字段说明**:

| 字段名 | 类型 | 必需 | 描述 | 验证规则 |
|-------|------|------|------|----------|
| name | string | 是 | 武器名称 | 2-100字符 |
| type | string | 是 | 武器类型 | 预定义枚举值 |
| country | string | 是 | 制造国家 | 2-50字符 |
| year | number | 否 | 制造年份 | 1800-2030 |
| description | string | 否 | 武器描述 | 最多1000字符 |
| specifications | object | 否 | 技术规格 | 对象格式 |

**响应格式**:

```json
{
  "success": true,
  "message": "武器创建成功",
  "data": {
    "id": "64e4b3a2f1c9d8e7f0a1b2c3",
    "name": "新型激光武器",
    "type": "步枪",
    "country": "中国",
    "year": 2024,
    "description": "实验性激光武器系统"
  }
}
```

**状态码**:
- `201`: 武器创建成功
- `400`: 数据验证失败或创建失败
- `403`: 需要管理员权限
- `500`: 服务器内部错误

**节来源**
- [weapons.js](file://backend/src/routes/weapons.js#L87-L102)

### 6. 更新武器

**端点**: `PUT /api/weapons/:id`

**功能**: 更新现有武器信息（管理员权限）

**路径参数**:

| 参数名 | 类型 | 必需 | 描述 |
|-------|------|------|------|
| id | string | 是 | 武器唯一标识符 |

**请求体**: 与创建武器相同

**响应格式**:

```json
{
  "success": true,
  "message": "武器更新成功",
  "data": {
    "id": "64e4b3a2f1c9d8e7f0a1b2c3",
    "name": "更新后的武器名称",
    "type": "步枪",
    "country": "中国",
    "year": 2024,
    "description": "更新后的描述"
  }
}
```

**状态码**:
- `200`: 武器更新成功
- `400`: 数据验证失败或更新失败
- `403`: 需要管理员权限
- `404`: 武器不存在
- `500`: 服务器内部错误

**节来源**
- [weapons.js](file://backend/src/routes/weapons.js#L104-L121)

### 7. 删除武器

**端点**: `DELETE /api/weapons/:id`

**功能**: 删除指定武器（管理员权限）

**路径参数**:

| 参数名 | 类型 | 必需 | 描述 |
|-------|------|------|------|
| id | string | 是 | 武器唯一标识符 |

**响应格式**:

```json
{
  "success": true,
  "message": "武器删除成功"
}
```

**状态码**:
- `200`: 武器删除成功
- `400`: 删除失败
- `403`: 需要管理员权限
- `404`: 武器不存在
- `500`: 服务器内部错误

**节来源**
- [weapons.js](file://backend/src/routes/weapons.js#L123-L140)

### 8. 收藏武器

**端点**: `POST /api/weapons/:id/favorite`

**功能**: 将武器添加到用户收藏

**路径参数**:

| 参数名 | 类型 | 必需 | 描述 |
|-------|------|------|------|
| id | string | 是 | 武器唯一标识符 |

**响应格式**:

```json
{
  "success": true,
  "message": "收藏成功"
}
```

**状态码**:
- `200`: 收藏成功
- `400`: 收藏失败
- `401`: 需要登录
- `500`: 服务器内部错误

**节来源**
- [weapons.js](file://backend/src/routes/weapons.js#L142-L157)

### 9. 取消收藏

**端点**: `DELETE /api/weapons/:id/favorite`

**功能**: 从用户收藏中移除武器

**路径参数**:

| 参数名 | 类型 | 必需 | 描述 |
|-------|------|------|------|
| id | string | 是 | 武器唯一标识符 |

**响应格式**:

```json
{
  "success": true,
  "message": "取消收藏成功"
}
```

**状态码**:
- `200`: 取消收藏成功
- `400`: 取消收藏失败
- `401`: 需要登录
- `500`: 服务器内部错误

**节来源**
- [weapons.js](file://backend/src/routes/weapons.js#L159-L174)

### 10. 获取武器统计

**端点**: `GET /api/weapons/statistics`

**功能**: 获取武器分布统计信息

**响应格式**:

```json
{
  "success": true,
  "data": {
    "total_weapons": 1000,
    "by_type": [
      {
        "type": "步枪",
        "count": 400
      },
      {
        "type": "手枪",
        "count": 200
      }
    ],
    "by_country": [
      {
        "country": "中国",
        "count": 300
      },
      {
        "country": "美国",
        "count": 250
      }
    ]
  }
}
```

**状态码**:
- `200`: 成功
- `500`: 服务器内部错误

**节来源**
- [weapons.js](file://backend/src/routes/weapons.js#L54-L68)

## 武器识别API

### 图片上传识别

**端点**: `POST /api/weapon/recognize`

**功能**: 通过上传图片进行武器识别

**请求格式**: multipart/form-data

**请求参数**:

| 参数名 | 类型 | 必需 | 描述 |
|-------|------|------|------|
| image | file | 是 | 武器图片文件 |

**响应格式**:

```json
{
  "code": 200,
  "message": "识别成功",
  "result": {
    "weapon_name": "95式自动步枪",
    "confidence": 0.95,
    "weapon_type": "突击步枪",
    "description": "95式自动步枪是中国研制的一款突击步枪，具有95%的可能性是该武器。"
  }
}
```

**状态码**:
- `200`: 识别成功
- `400`: 未上传图片或未选择图片
- `500`: 识别失败

**节来源**
- [weapon.py](file://backend/routes/weapon.py#L10-L50)

### Base64编码识别

**端点**: `POST /api/weapon/recognize-base64`

**功能**: 通过Base64编码的图片数据进行武器识别

**请求体**:

```json
{
  "image_data": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ..."
}
```

**请求体字段说明**:

| 字段名 | 类型 | 必需 | 描述 |
|-------|------|------|------|
| image_data | string | 是 | Base64编码的图片数据 |

**响应格式**:

```json
{
  "code": 200,
  "message": "识别成功",
  "result": {
    "weapon_name": "95式自动步枪",
    "confidence": 0.95,
    "weapon_type": "突击步枪",
    "description": "95式自动步枪是中国研制的一款突击步枪，具有95%的可能性是该武器。"
  }
}
```

**状态码**:
- `200`: 识别成功
- `400`: 缺少图片数据
- `500`: 识别失败

**节来源**
- [weapon.py](file://backend/routes/weapon.py#L52-L97)

## 错误处理

### 错误响应格式

所有API错误都遵循统一的响应格式：

```json
{
  "success": false,
  "message": "错误描述",
  "errors": [
    {
      "field": "字段名",
      "message": "具体的错误信息"
    }
  ]
}
```

### 常见错误码

| HTTP状态码 | 错误类型 | 描述 | 解决方案 |
|-----------|---------|------|----------|
| 400 | Bad Request | 请求参数错误或数据验证失败 | 检查请求参数和数据格式 |
| 401 | Unauthorized | 访问令牌缺失或无效 | 提供有效的JWT令牌 |
| 403 | Forbidden | 需要管理员权限或权限不足 | 使用管理员账户或检查权限 |
| 404 | Not Found | 资源不存在 | 确认资源ID是否存在 |
| 429 | Too Many Requests | 请求过于频繁 | 降低请求频率或联系管理员 |
| 500 | Internal Server Error | 服务器内部错误 | 稍后重试或联系技术支持 |

### 错误处理流程

```mermaid
flowchart TD
A["API请求"] --> B{"验证请求"}
B --> |失败| C["返回400错误"]
B --> |成功| D{"检查权限"}
D --> |失败| E["返回403错误"]
D --> |成功| F{"执行业务逻辑"}
F --> |失败| G["返回500错误"]
F --> |成功| H["返回成功响应"]
C --> I["记录错误日志"]
E --> I
G --> I
I --> J["发送错误通知"]
```

**节来源**
- [weapons.js](file://backend/src/routes/weapons.js#L10-L140)
- [weapon.py](file://backend/routes/weapon.py#L10-L97)

## 响应格式规范

### 成功响应结构

```json
{
  "success": true,
  "data": {
    // 具体的数据内容
  }
}
```

### 分页响应结构

```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "current_page": 1,
      "total_pages": 10,
      "total_items": 100,
      "items_per_page": 10
    }
  }
}
```

### 错误响应结构

```json
{
  "success": false,
  "message": "错误描述",
  "errors": [
    {
      "field": "字段名",
      "message": "具体的错误信息"
    }
  ]
}
```

## 使用示例

### 获取武器列表

```bash
# 基础请求
curl -X GET "http://localhost:3000/api/weapons" \
  -H "Content-Type: application/json"

# 带分页和过滤
curl -X GET "http://localhost:3000/api/weapons?page=2&limit=10&category=步枪&country=中国" \
  -H "Content-Type: application/json"
```

### 搜索武器

```bash
# 搜索关键词
curl -X GET "http://localhost:3000/api/weapons/search?q=步枪" \
  -H "Content-Type: application/json"

# 带过滤条件
curl -X GET "http://localhost:3000/api/weapons/search?q=自动&category=步枪" \
  -H "Content-Type: application/json"
```

### 获取武器详情

```bash
# 获取单个武器详情
curl -X GET "http://localhost:3000/api/weapons/64e4b3a2f1c9d8e7f0a1b2c3" \
  -H "Content-Type: application/json"
```

### 创建武器（管理员）

```bash
# 创建新武器
curl -X POST "http://localhost:3000/api/weapons" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "name": "新型激光武器",
    "type": "步枪",
    "country": "中国",
    "year": 2024,
    "description": "实验性激光武器系统",
    "specifications": {
      "功率": "1000W",
      "射程": "1000m",
      "重量": "15kg"
    }
  }'
```

### 收藏武器

```bash
# 收藏武器
curl -X POST "http://localhost:3000/api/weapons/64e4b3a2f1c9d8e7f0a1b2c3/favorite" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 武器识别

```bash
# 图片上传识别
curl -X POST "http://localhost:3000/api/weapon/recognize" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -F "image=@weapon.jpg"

# Base64编码识别
curl -X POST "http://localhost:3000/api/weapon/recognize-base64" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "image_data": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ..."
  }'
```

## 最佳实践

### 1. 请求优化

- **合理使用分页**: 避免一次性请求过多数据
- **适当使用过滤**: 减少不必要的数据传输
- **缓存响应**: 对于不经常变化的数据实施缓存策略

### 2. 错误处理

- **检查响应状态码**: 根据不同的HTTP状态码采取相应的处理措施
- **解析错误信息**: 详细阅读错误响应中的具体错误信息
- **重试机制**: 对于临时性错误实施指数退避重试

### 3. 性能优化

- **批量操作**: 对于多个相似操作，考虑使用批量API
- **并发请求**: 合理使用并发请求提高效率
- **数据压缩**: 利用gzip压缩减少传输数据量

### 4. 安全考虑

- **令牌管理**: 安全存储和定期刷新JWT令牌
- **输入验证**: 对所有用户输入进行严格验证
- **权限控制**: 确保敏感操作只对授权用户开放

### 5. 监控和调试

- **日志记录**: 启用详细的API调用日志
- **性能监控**: 监控API响应时间和错误率
- **错误追踪**: 建立完善的错误报告和追踪机制

**节来源**
- [validation.js](file://backend/src/middleware/validation.js#L1-L178)
- [auth.js](file://backend/src/middleware/auth.js#L1-L106)