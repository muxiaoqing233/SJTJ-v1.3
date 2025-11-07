/**
 * 为countries表添加经纬度字段并填充数据
 */
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../data/military-knowledge.db');
const db = new Database(dbPath);

try {
    console.log('开始为countries表添加经纬度字段...');
    
    // 1. 添加latitude和longitude字段
    try {
        db.exec(`
            ALTER TABLE countries ADD COLUMN latitude REAL;
            ALTER TABLE countries ADD COLUMN longitude REAL;
        `);
        console.log('✅ 经纬度字段添加成功');
    } catch (error) {
        if (error.message.includes('duplicate column')) {
            console.log('⚠️  经纬度字段已存在，跳过添加');
        } else {
            throw error;
        }
    }
    
    // 2. 准备国家经纬度数据（中心点坐标）
    const countryCoordinates = {
        '中国': { latitude: 35.8617, longitude: 104.1954 },
        '美国': { latitude: 37.0902, longitude: -95.7129 },
        '俄罗斯': { latitude: 61.5240, longitude: 105.3188 },
        '德国': { latitude: 51.1657, longitude: 10.4515 },
        '法国': { latitude: 46.2276, longitude: 2.2137 },
        '英国': { latitude: 55.3781, longitude: -3.4360 },
        '日本': { latitude: 36.2048, longitude: 138.2529 },
        '韩国': { latitude: 35.9078, longitude: 127.7669 },
        '印度': { latitude: 20.5937, longitude: 78.9629 },
        '以色列': { latitude: 31.0461, longitude: 34.8516 },
        '意大利': { latitude: 41.8719, longitude: 12.5674 },
        '西班牙': { latitude: 40.4637, longitude: -3.7492 },
        '加拿大': { latitude: 56.1304, longitude: -106.3468 },
        '澳大利亚': { latitude: -25.2744, longitude: 133.7751 },
        '巴西': { latitude: -10.3333, longitude: -53.2 },
        '阿根廷': { latitude: -38.4161, longitude: -63.6167 },
        '墨西哥': { latitude: 23.6345, longitude: -102.5528 },
        '南非': { latitude: -30.5595, longitude: 22.9375 },
        '埃及': { latitude: 26.8206, longitude: 30.8025 },
        '土耳其': { latitude: 38.9637, longitude: 35.2433 },
        '伊朗': { latitude: 32.4279, longitude: 53.6880 },
        '沙特阿拉伯': { latitude: 23.8859, longitude: 45.0792 },
        '巴基斯坦': { latitude: 30.3753, longitude: 69.3451 },
        '朝鲜': { latitude: 40.3399, longitude: 127.5101 },
        '越南': { latitude: 14.0583, longitude: 108.2772 },
        '泰国': { latitude: 15.8700, longitude: 100.9925 },
        '马来西亚': { latitude: 4.2105, longitude: 101.9758 },
        '印度尼西亚': { latitude: -0.7893, longitude: 113.9213 },
        '菲律宾': { latitude: 12.8797, longitude: 121.7740 },
        '波兰': { latitude: 51.9194, longitude: 19.1451 },
        '乌克兰': { latitude: 48.3794, longitude: 31.1656 },
        '瑞典': { latitude: 60.1282, longitude: 18.6435 },
        '挪威': { latitude: 60.4720, longitude: 8.4689 },
        '芬兰': { latitude: 61.9241, longitude: 25.7482 },
        '丹麦': { latitude: 56.2639, longitude: 9.5018 },
        '荷兰': { latitude: 52.1326, longitude: 5.2913 },
        '比利时': { latitude: 50.5039, longitude: 4.4699 },
        '瑞士': { latitude: 46.8182, longitude: 8.2275 },
        '奥地利': { latitude: 47.5162, longitude: 14.5501 },
        '捷克': { latitude: 49.8175, longitude: 15.4720 },
        '匈牙利': { latitude: 47.1625, longitude: 19.5033 },
        '罗马尼亚': { latitude: 45.9432, longitude: 24.9668 },
        '希腊': { latitude: 39.0742, longitude: 21.8243 }
    };
    
    // 3. 获取数据库中所有国家
    const countries = db.prepare('SELECT id, name FROM countries').all();
    
    console.log(`\n找到 ${countries.length} 个国家，开始更新经纬度数据...`);
    
    // 4. 更新经纬度数据
    const updateStmt = db.prepare(`
        UPDATE countries 
        SET latitude = ?, longitude = ? 
        WHERE id = ?
    `);
    
    let updatedCount = 0;
    let notFoundCount = 0;
    
    db.transaction(() => {
        countries.forEach(country => {
            const coords = countryCoordinates[country.name];
            if (coords) {
                updateStmt.run(coords.latitude, coords.longitude, country.id);
                console.log(`✅ ${country.name}: (${coords.latitude}, ${coords.longitude})`);
                updatedCount++;
            } else {
                console.log(`⚠️  ${country.name}: 未找到经纬度数据`);
                notFoundCount++;
            }
        });
    })();
    
    console.log('\n========== 更新完成 ==========');
    console.log(`✅ 成功更新: ${updatedCount} 个国家`);
    console.log(`⚠️  未找到数据: ${notFoundCount} 个国家`);
    
    // 5. 验证更新结果
    console.log('\n========== 验证结果（前10个国家） ==========');
    const result = db.prepare(`
        SELECT name, latitude, longitude 
        FROM countries 
        WHERE latitude IS NOT NULL 
        LIMIT 10
    `).all();
    console.table(result);
    
    // 6. 统计信息
    const stats = db.prepare(`
        SELECT 
            COUNT(*) as total,
            COUNT(latitude) as with_coords,
            COUNT(*) - COUNT(latitude) as without_coords
        FROM countries
    `).get();
    
    console.log('\n========== 统计信息 ==========');
    console.log(`总国家数: ${stats.total}`);
    console.log(`有坐标: ${stats.with_coords}`);
    console.log(`无坐标: ${stats.without_coords}`);
    
} catch (error) {
    console.error('❌ 错误:', error);
    process.exit(1);
} finally {
    db.close();
    console.log('\n数据库连接已关闭');
}
