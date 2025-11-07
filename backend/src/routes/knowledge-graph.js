const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');

const router = express.Router();

// 获取知识图谱数据
router.get('/graph-data', (req, res) => {
    try {
        const db = new Database(path.join(__dirname, '../../data/military-knowledge.db'));
        
        // 获取所有武器数据
        const weapons = db.prepare(`
            SELECT id, name, type, country, year, description 
            FROM weapons 
            ORDER BY id
        `).all();
        
        // 获取所有国家数据
        const countries = db.prepare(`
            SELECT id, name 
            FROM countries 
            ORDER BY id
        `).all();
        
        // 获取所有分类数据
        const categories = db.prepare(`
            SELECT id, name, description 
            FROM categories 
            ORDER BY id
        `).all();
        
        // 获取所有制造商数据
        const manufacturers = db.prepare(`
            SELECT id, name, country, founded, description 
            FROM manufacturers 
            ORDER BY id
        `).all();
        
        db.close();
        
        // 构建节点数据
        const nodes = [];
        const links = [];
        
        // 添加武器节点
        weapons.forEach(weapon => {
            nodes.push({
                id: `weapon_${weapon.id}`,
                labels: ["Weapon"],
                properties: {
                    name: weapon.name,
                    description: weapon.description || '',
                    year: weapon.year ? weapon.year.toString() : '',
                    type: weapon.type,
                    country: weapon.country
                }
            });
        });
        
        // 添加国家节点
        countries.forEach(country => {
            nodes.push({
                id: `country_${country.id}`,
                labels: ["Country"],
                properties: {
                    name: country.name,
                    region: getRegionByCountry(country.name)
                }
            });
        });
        
        // 添加分类节点
        categories.forEach(category => {
            nodes.push({
                id: `type_${category.id}`,
                labels: ["Type"],
                properties: {
                    name: category.name,
                    description: category.description || ''
                }
            });
        });
        
        // 添加制造商节点
        manufacturers.forEach(manufacturer => {
            nodes.push({
                id: `manufacturer_${manufacturer.id}`,
                labels: ["Manufacturer"],
                properties: {
                    name: manufacturer.name,
                    description: manufacturer.description || '',
                    country: manufacturer.country,
                    founded: manufacturer.founded || ''
                }
            });
        });
        
        // 创建关系链接
        weapons.forEach(weapon => {
            const weaponNodeId = `weapon_${weapon.id}`;
            
            // 武器 -> 国家 关系
            const countryNode = countries.find(c => c.name === weapon.country);
            if (countryNode) {
                links.push({
                    source: weaponNodeId,
                    target: `country_${countryNode.id}`,
                    type: "使用"
                });
            }
            
            // 武器 -> 类型 关系 (使用模糊匹配)
            const typeNode = findMatchingType(weapon.type, categories);
            if (typeNode) {
                links.push({
                    source: weaponNodeId,
                    target: `type_${typeNode.id}`,
                    type: "类型"
                });
            }
            
            // 武器 -> 制造商 关系 (基于武器名称和制造商推断)
            const manufacturerNode = findMatchingManufacturer(weapon, manufacturers);
            if (manufacturerNode) {
                links.push({
                    source: weaponNodeId,
                    target: `manufacturer_${manufacturerNode.id}`,
                    type: "制造"
                });
            }
        });
        
        // 制造商 -> 国家 关系
        manufacturers.forEach(manufacturer => {
            const countryNode = countries.find(c => c.name === manufacturer.country);
            if (countryNode) {
                links.push({
                    source: `manufacturer_${manufacturer.id}`,
                    target: `country_${countryNode.id}`,
                    type: "属于"
                });
            }
        });
        
        res.json({
            success: true,
            data: {
                nodes,
                links
            }
        });
        
    } catch (error) {
        console.error('获取知识图谱数据失败:', error);
        res.status(500).json({
            success: false,
            message: '获取知识图谱数据失败',
            error: error.message
        });
    }
});

// 根据国家名称获取地区
function getRegionByCountry(countryName) {
    const regionMap = {
        '美国': '北美洲',
        '俄罗斯': '欧亚大陆',
        '中国': '亚洲',
        '德国': '欧洲',
        '法国': '欧洲',
        '英国': '欧洲',
        '以色列': '中东',
        '瑞典': '欧洲',
        '意大利': '欧洲',
        '日本': '亚洲',
        '奥地利': '欧洲',
        '西班牙': '欧洲'
    };
    return regionMap[countryName] || '未知';
}

// 查找匹配的类型（支持模糊匹配）
function findMatchingType(weaponType, categories) {
    // 直接匹配
    let match = categories.find(c => c.name === weaponType);
    if (match) return match;
    
    // 模糊匹配映射
    const typeMapping = {
        '步枪': ['自动步枪', '突击步枪', '步枪'],
        '手枪': ['手枪', 'pistol'],
        '坦克': ['坦克', '主战坦克'],
        '战斗机': ['战斗机', '战机'],
        '导弹': ['导弹', '火箭'],
        '直升机': ['直升机', '武装直升机'],
        '驱逐舰': ['驱逐舰', '军舰'],
        '巡洋舰': ['巡洋舰', '军舰'],
        '轰炸机': ['轰炸机', '战略轰炸机'],
        '防空系统': ['防空系统', '防空导弹']
    };
    
    for (const [key, values] of Object.entries(typeMapping)) {
        if (values.includes(weaponType)) {
            match = categories.find(c => values.includes(c.name));
            if (match) return match;
        }
    }
    
    return null;
}

// 查找匹配的制造商
function findMatchingManufacturer(weapon, manufacturers) {
    const weaponName = weapon.name.toLowerCase();
    
    // 基于武器名称的制造商映射
    const manufacturerMapping = {
        'ak-47': '卡拉什尼科夫公司',
        'ak47': '卡拉什尼科夫公司',
        'm16': '柯尔特公司',
        'glock': '格洛克公司',
        'f-22': '洛克希德·马丁',
        'f22': '洛克希德·马丁',
        'su-57': '苏霍伊设计局',
        'j-20': '成都飞机工业集团',
        '东风': '中国航天科工集团',
        '阿帕奇': '波音公司',
        'apache': '波音公司',
        'b-2': '诺斯罗普·格鲁曼',
        'tu-160': '图波列夫设计局',
        'h-6': '西安飞机工业集团',
        'f-35': '洛克希德·马丁',
        '台风': '空中客车防务与航天',
        '阵风': '达索航空',
        '055': '江南造船厂',
        '伯克': '通用动力',
        's-400': '阿尔马兹-安泰',
        '爱国者': '雷神公司',
        'hq-9': '中国航天科工集团'
    };
    
    for (const [key, manufacturerName] of Object.entries(manufacturerMapping)) {
        if (weaponName.includes(key)) {
            const manufacturer = manufacturers.find(m => m.name === manufacturerName);
            if (manufacturer) return manufacturer;
        }
    }
    
    return null;
}

// 获取世界地图国家数据
/**
 * 获取国家详细信息
 */
router.get('/country-details/:countryName', (req, res) => {
    try {
        const countryName = decodeURIComponent(req.params.countryName);
        const db = new Database(path.join(__dirname, '../../data/military-knowledge.db'));
        
        // 获取国家基本信息
        const countryInfo = db.prepare(`
            SELECT id, name, code
            FROM countries
            WHERE name = ?
        `).get(countryName);
        
        if (!countryInfo) {
            db.close();
            return res.status(404).json({
                success: false,
                message: '国家不存在'
            });
        }
        
        // 获取武器数量
        const weaponCount = db.prepare(`
            SELECT COUNT(*) as count
            FROM weapons
            WHERE country = ?
        `).get(countryName).count;
        
        // 获取制造商数量
        const manufacturerCount = db.prepare(`
            SELECT COUNT(*) as count
            FROM manufacturers
            WHERE country = ?
        `).get(countryName).count;
        
        // 获取武器类型分布
        const weaponTypes = db.prepare(`
            SELECT type, COUNT(*) as count
            FROM weapons
            WHERE country = ?
            GROUP BY type
            ORDER BY count DESC
        `).all(countryName);
        
        // 获取武器列表（前20个）
        const weapons = db.prepare(`
            SELECT id, name, type, year, description
            FROM weapons
            WHERE country = ?
            ORDER BY year DESC
            LIMIT 20
        `).all(countryName);
        
        // 获取制造商列表（前20个）
        const manufacturers = db.prepare(`
            SELECT id, name, founded, description
            FROM manufacturers
            WHERE country = ?
            ORDER BY name
            LIMIT 20
        `).all(countryName);
        
        db.close();
        
        // 中英文国家名称映射
        const countryNameMapping = {
            '中国': 'China',
            '美国': 'United States',
            '俄罗斯': 'Russia',
            '德国': 'Germany',
            '法国': 'France',
            '英国': 'United Kingdom',
            '日本': 'Japan',
            '韩国': 'South Korea',
            '印度': 'India',
            '以色列': 'Israel',
            '意大利': 'Italy',
            '西班牙': 'Spain',
            '加拿大': 'Canada',
            '澳大利亚': 'Australia'
        };
        
        res.json({
            success: true,
            data: {
                basicInfo: {
                    id: countryInfo.id,
                    chineseName: countryInfo.name,
                    englishName: countryNameMapping[countryInfo.name] || countryInfo.name,
                    code: countryInfo.code || ''
                },
                statistics: {
                    weaponCount,
                    manufacturerCount,
                    weaponTypeCount: weaponTypes.length
                },
                weaponTypes,
                weapons,
                manufacturers
            }
        });
        
    } catch (error) {
        console.error('获取国家详情失败:', error);
        res.status(500).json({
            success: false,
            message: '获取国家详情失败',
            error: error.message
        });
    }
});

router.get('/world-map-data', (req, res) => {
    try {
        const db = new Database(path.join(__dirname, '../../data/military-knowledge.db'));
        
        // 获取所有国家数据，包括武器数量统计和经纬度坐标
        const countries = db.prepare(`
            SELECT 
                c.id, 
                c.name, 
                c.code,
                c.latitude,
                c.longitude,
                COUNT(w.id) as weaponCount
            FROM countries c
            LEFT JOIN weapons w ON c.name = w.country
            GROUP BY c.id, c.name, c.code, c.latitude, c.longitude
            ORDER BY c.name
        `).all();
        
        db.close();
        
        // 中英文国家名称映射表
        const countryNameMapping = {
            '中国': 'China',
            '美国': 'United States',
            '俄罗斯': 'Russia',
            '德国': 'Germany',
            '法国': 'France',
            '英国': 'United Kingdom',
            '日本': 'Japan',
            '韩国': 'South Korea',
            '印度': 'India',
            '以色列': 'Israel',
            '意大利': 'Italy',
            '西班牙': 'Spain',
            '加拿大': 'Canada',
            '澳大利亚': 'Australia',
            '巴西': 'Brazil',
            '阿根廷': 'Argentina',
            '墨西哥': 'Mexico',
            '南非': 'South Africa',
            '埃及': 'Egypt',
            '土耳其': 'Turkey',
            '伊朗': 'Iran',
            '沙特阿拉伯': 'Saudi Arabia',
            '巴基斯坦': 'Pakistan',
            '朝鲜': 'North Korea',
            '越南': 'Vietnam',
            '泰国': 'Thailand',
            '马来西亚': 'Malaysia',
            '印度尼西亚': 'Indonesia',
            '菲律宾': 'Philippines',
            '波兰': 'Poland',
            '乌克兰': 'Ukraine',
            '瑞典': 'Sweden',
            '挪威': 'Norway',
            '芬兰': 'Finland',
            '丹麦': 'Denmark',
            '荷兰': 'Netherlands',
            '比利时': 'Belgium',
            '瑞士': 'Switzerland',
            '奥地利': 'Austria',
            '捷克': 'Czech Republic',
            '匈牙利': 'Hungary',
            '罗马尼亚': 'Romania',
            '希腊': 'Greece',
            '新西兰': 'New Zealand'
        };
        
        // 构建地图数据，直接使用数据库中的经纬度坐标
        const mapData = countries
            .filter(country => country.latitude !== null && country.longitude !== null) // 过滤掉没有坐标的国家
            .map(country => {
                const englishName = countryNameMapping[country.name] || country.name;
                return {
                    id: country.id,
                    chineseName: country.name,
                    englishName: englishName,
                    code: country.code || '',
                    weaponCount: country.weaponCount || 0,
                    latitude: country.latitude,
                    longitude: country.longitude,
                    coordinates: [country.longitude, country.latitude] // [lng, lat] 格式用于D3投影
                };
            });
        
        // 统计信息
        const totalCountries = countries.length;
        const countriesWithCoords = mapData.length;
        const countriesWithoutCoords = totalCountries - countriesWithCoords;
        
        console.log(`世界地图数据: 总计${totalCountries}个国家, ${countriesWithCoords}个有坐标, ${countriesWithoutCoords}个无坐标`);
        
        res.json({
            success: true,
            data: {
                countries: mapData,
                mapping: countryNameMapping,
                statistics: {
                    total: totalCountries,
                    withCoordinates: countriesWithCoords,
                    withoutCoordinates: countriesWithoutCoords
                }
            }
        });
        
    } catch (error) {
        console.error('获取世界地图数据失败:', error);
        res.status(500).json({
            success: false,
            message: '获取世界地图数据失败',
            error: error.message
        });
    }
});

module.exports = router;