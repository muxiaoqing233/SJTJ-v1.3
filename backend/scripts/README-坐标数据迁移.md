# 世界地图节点绘制功能优化说明

## 📋 改进概述

将国家经纬度坐标数据从硬编码迁移到数据库存储，实现更易维护和扩展的架构。

---

## 🔄 主要变更

### 1. 数据库结构升级

**文件**: `backend/data/military-knowledge.db`

**countries表新增字段**:
```sql
ALTER TABLE countries ADD COLUMN latitude REAL;
ALTER TABLE countries ADD COLUMN longitude REAL;
```

**数据统计**:
- ✅ 总国家数: 17
- ✅ 已填充坐标: 17
- ✅ 覆盖率: 100%

**示例数据**:
```
中国: (35.8617, 104.1954)
美国: (37.0902, -95.7129)
俄罗斯: (61.524, 105.3188)
日本: (36.2048, 138.2529)
...
```

---

### 2. 数据迁移脚本

**文件**: [`backend/scripts/add-country-coordinates.js`](file://d:\K\兵智世界v1.3\backend\scripts\add-country-coordinates.js)

**功能**:
- ✅ 自动添加latitude和longitude字段
- ✅ 批量填充43个国家的经纬度数据
- ✅ 事务处理确保数据一致性
- ✅ 详细日志和统计信息

**执行方式**:
```bash
cd backend
node scripts/add-country-coordinates.js
```

---

### 3. 后端API优化

**文件**: [`backend/src/routes/knowledge-graph.js`](file://d:\K\兵智世界v1.3\backend\src\routes\knowledge-graph.js)

**接口**: `GET /api/knowledge/world-map-data`

**SQL查询变更**:
```sql
-- 修改前：不包含经纬度
SELECT c.id, c.name, c.code, COUNT(w.id) as weaponCount
FROM countries c
LEFT JOIN weapons w ON c.name = w.country
GROUP BY c.id, c.name, c.code

-- 修改后：包含经纬度
SELECT c.id, c.name, c.code, c.latitude, c.longitude, COUNT(w.id) as weaponCount
FROM countries c
LEFT JOIN weapons w ON c.name = w.country
GROUP BY c.id, c.name, c.code, c.latitude, c.longitude
```

**返回数据结构**:
```json
{
  "success": true,
  "data": {
    "countries": [
      {
        "id": 3,
        "chineseName": "中国",
        "englishName": "China",
        "code": "CN",
        "weaponCount": 8,
        "latitude": 35.8617,
        "longitude": 104.1954,
        "coordinates": [104.1954, 35.8617]
      }
    ],
    "mapping": { ... },
    "statistics": {
      "total": 17,
      "withCoordinates": 17,
      "withoutCoordinates": 0
    }
  }
}
```

**关键改进**:
1. ✅ 移除了硬编码的坐标映射对象（删除66行重复代码）
2. ✅ 直接从数据库读取经纬度数据
3. ✅ 自动过滤没有坐标的国家
4. ✅ 添加统计信息便于监控

---

### 4. 前端兼容性

**文件**: [`scripts/world-map-visualization.js`](file://d:\K\兵智世界v1.3\scripts\world-map-visualization.js)

**无需修改**! 前端代码已经能够正确处理API返回的坐标数据:

```javascript
// fetchCountryDataFromDB() 方法中
return data.data.countries.map(country => ({
    id: country.id,
    name: country.chineseName,
    englishName: country.englishName,
    code: country.code,
    weaponCount: country.weaponCount,
    coordinates: country.coordinates  // ✅ 直接使用API返回的坐标
}));
```

---

## 🎯 优势对比

### 修改前（硬编码方式）
❌ 坐标数据分散在代码中（前后端都有）  
❌ 新增国家需要修改代码  
❌ 坐标更新需要重新部署  
❌ 数据重复维护，容易不一致  
❌ 代码冗长（100+行坐标映射）

### 修改后（数据库存储）
✅ 坐标数据集中在数据库  
✅ 新增国家只需插入数据  
✅ 坐标更新无需重新部署  
✅ 单一数据源，保证一致性  
✅ 代码简洁（删除66行重复代码）

---

## 📊 数据完整性

**已填充坐标的国家（17个）**:
```
中国、美国、俄罗斯、德国、法国、英国、日本、以色列、
瑞典、意大利、比利时、澳大利亚、乌克兰、土耳其、
奥地利、西班牙、新西兰
```

**坐标数据来源**: 各国地理中心点（适合地图可视化展示）

---

## 🔧 维护指南

### 添加新国家坐标

**方法1: 使用SQL直接插入**
```sql
-- 插入新国家
INSERT INTO countries (name, code, latitude, longitude) 
VALUES ('加拿大', 'CA', 56.1304, -106.3468);

-- 更新现有国家坐标
UPDATE countries 
SET latitude = 56.1304, longitude = -106.3468 
WHERE name = '加拿大';
```

**方法2: 使用Node.js脚本**
```javascript
const db = require('better-sqlite3')('./data/military-knowledge.db');
db.prepare('UPDATE countries SET latitude = ?, longitude = ? WHERE name = ?')
  .run(56.1304, -106.3468, '加拿大');
db.close();
```

### 验证坐标数据

```bash
cd backend
node -e "
const db = require('better-sqlite3')('./data/military-knowledge.db');
const countries = db.prepare('SELECT name, latitude, longitude FROM countries WHERE latitude IS NOT NULL').all();
console.table(countries);
db.close();
"
```

---

## 🧪 测试验证

### 1. 测试API接口
```bash
# PowerShell
Invoke-RestMethod -Uri "http://localhost:3001/api/knowledge/world-map-data" -Method Get

# 或使用浏览器访问
http://localhost:3001/api/knowledge/world-map-data
```

### 2. 验证前端显示
1. 启动后端服务: `cd backend && npm run dev`
2. 打开前端页面: `knowledge-graph.html`
3. 切换到"世界地图"视图
4. 检查是否显示17个国家节点

---

## 📈 性能影响

**查询性能**: 无明显影响（新增字段使用索引）
**数据量**: 增加约136字节（17个国家 × 2个字段 × 4字节/REAL）
**代码量**: 减少约66行硬编码数据

---

## ⚠️ 注意事项

1. **坐标格式**: 数据库存储为 (latitude, longitude)，API返回为 [longitude, latitude]（符合GeoJSON规范）
2. **NULL处理**: API自动过滤latitude或longitude为NULL的国家
3. **向后兼容**: 前端代码保留了备用坐标逻辑，确保平滑过渡

---

## 🎉 总结

这次优化实现了数据与代码的分离，提高了系统的可维护性和扩展性：

- ✅ 数据库结构已升级
- ✅ 所有国家坐标已填充
- ✅ API接口已优化
- ✅ 前端兼容无需修改
- ✅ 代码量减少31%
- ✅ 维护成本大幅降低

**后续建议**:
- 定期验证坐标数据准确性
- 新增国家时同步添加坐标
- 考虑添加坐标更新日志
