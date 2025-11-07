const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const router = express.Router();

// 数据库连接
const db = new Database(path.join(__dirname, '../../data/military-knowledge.db'));

// 确保上传目录存在
const uploadDir = path.join(__dirname, '../../uploads/weapons/models');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// 配置multer用于3D模型上传
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'weapon-model-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// 3D模型文件过滤器
const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'model/gltf-binary',
        'model/gltf+json', 
        'application/octet-stream', // .glb files
        'model/obj',
        'model/fbx',
        'model/dae',
        'model/3ds',
        'model/ply',
        'model/stl'
    ];
    
    const allowedExtensions = ['.glb', '.gltf', '.obj', '.fbx', '.dae', '.3ds', '.ply', '.stl'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
        cb(null, true);
    } else {
        cb(new Error('只支持 GLB, GLTF, OBJ, FBX, DAE, 3DS, PLY, STL 格式的3D模型文件'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB 限制
    }
});

// 创建weapon_models表（如果不存在）
try {
    db.exec(`
        CREATE TABLE IF NOT EXISTS weapon_models (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            weapon_id INTEGER NOT NULL,
            filename VARCHAR(255) NOT NULL,
            original_name VARCHAR(255) NOT NULL,
            file_path VARCHAR(500) NOT NULL,
            file_size INTEGER,
            mime_type VARCHAR(100),
            model_format VARCHAR(50),
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (weapon_id) REFERENCES weapons(id) ON DELETE CASCADE
        )
    `);
    console.log('weapon_models 表已创建或已存在');
} catch (error) {
    console.error('创建 weapon_models 表失败:', error);
}

// 获取指定武器的所有3D模型
router.get('/weapon/:weaponId', (req, res) => {
    try {
        const weaponId = parseInt(req.params.weaponId);
        
        if (!weaponId || weaponId <= 0) {
            return res.status(400).json({ 
                success: false, 
                message: '无效的武器ID' 
            });
        }

        const models = db.prepare(`
            SELECT id, weapon_id, filename, original_name, file_path, file_size, 
                   mime_type, model_format, description, created_at
            FROM weapon_models 
            WHERE weapon_id = ?
            ORDER BY created_at DESC
        `).all(weaponId);

        res.json({
            success: true,
            data: models
        });
    } catch (error) {
        console.error('获取武器3D模型失败:', error);
        res.status(500).json({ 
            success: false, 
            message: '获取武器3D模型失败' 
        });
    }
});

// 上传3D模型
router.post('/weapon/:weaponId/upload', upload.single('model'), (req, res) => {
    try {
        const weaponId = parseInt(req.params.weaponId);
        const file = req.file;
        const description = req.body.description || '';

        if (!weaponId || weaponId <= 0) {
            return res.status(400).json({ 
                success: false, 
                message: '无效的武器ID' 
            });
        }

        if (!file) {
            return res.status(400).json({ 
                success: false, 
                message: '请选择要上传的3D模型文件' 
            });
        }

        // 验证武器是否存在
        const weapon = db.prepare('SELECT id FROM weapons WHERE id = ?').get(weaponId);
        if (!weapon) {
            // 删除已上传的文件
            if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
            }
            return res.status(404).json({ 
                success: false, 
                message: '武器不存在' 
            });
        }

        // 确定模型格式
        const fileExtension = path.extname(file.originalname).toLowerCase();
        const modelFormat = fileExtension.replace('.', '').toUpperCase();

        // 保存模型信息到数据库 - 使用相对路径
        const relativePath = path.relative(path.join(__dirname, '../..'), file.path);
        const stmt = db.prepare(`
            INSERT INTO weapon_models (weapon_id, filename, original_name, file_path, file_size, mime_type, model_format, description)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(
            weaponId,
            file.filename,
            file.originalname,
            relativePath,
            file.size,
            file.mimetype,
            modelFormat,
            description
        );

        res.json({
            success: true,
            message: '3D模型上传成功',
            data: {
                id: result.lastInsertRowid,
                filename: file.filename,
                originalName: file.originalname,
                fileSize: file.size,
                mimeType: file.mimetype,
                modelFormat: modelFormat,
                description: description
            }
        });

    } catch (error) {
        console.error('上传3D模型失败:', error);
        
        // 如果有文件上传，删除文件
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({ 
            success: false, 
            message: '上传3D模型失败: ' + error.message 
        });
    }
});

// 获取3D模型文件
router.get('/file/:filename', (req, res) => {
    try {
        const filename = req.params.filename;

        if (!filename) {
            return res.status(400).json({ 
                success: false, 
                message: '无效的文件名' 
            });
        }

        // 从数据库获取模型信息
        const model = db.prepare(`
            SELECT file_path, filename, mime_type, file_size, model_format
            FROM weapon_models 
            WHERE filename = ?
        `).get(filename);

        if (!model) {
            return res.status(404).json({ 
                success: false, 
                message: '3D模型不存在' 
            });
        }

        // 构建完整文件路径 - 统一处理路径分隔符
        let fullPath;
        if (path.isAbsolute(model.file_path)) {
            fullPath = model.file_path;
        } else {
            // 将反斜杠转换为正斜杠，然后构建路径
            const normalizedPath = model.file_path.replace(/\\/g, '/');
            fullPath = path.join(__dirname, '../..', normalizedPath);
        }

        console.log(`尝试访问文件: ${fullPath}`);

        // 检查文件是否存在
        if (!fs.existsSync(fullPath)) {
            console.error(`3D模型文件不存在: ${fullPath}`);
            
            // 尝试直接在uploads目录中查找文件
            const directPath = path.join(__dirname, '../../uploads/weapons/models', filename);
            console.log(`尝试直接路径: ${directPath}`);
            
            if (fs.existsSync(directPath)) {
                fullPath = directPath;
                console.log(`找到文件在直接路径: ${directPath}`);
            } else {
                return res.status(404).json({ 
                    success: false, 
                    message: '3D模型文件不存在',
                    debug: {
                        originalPath: model.file_path,
                        fullPath: fullPath,
                        directPath: directPath
                    }
                });
            }
        }

        // 设置CORS头部
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        // 设置正确的Content-Type
        let contentType = model.mime_type;
        if (!contentType || contentType === 'application/octet-stream') {
            const ext = path.extname(fullPath).toLowerCase();
            switch (ext) {
                case '.glb':
                    contentType = 'model/gltf-binary';
                    break;
                case '.gltf':
                    contentType = 'model/gltf+json';
                    break;
                case '.obj':
                    contentType = 'model/obj';
                    break;
                case '.fbx':
                    contentType = 'model/fbx';
                    break;
                default:
                    contentType = 'application/octet-stream';
            }
        }

        // 获取文件统计信息
        const stats = fs.statSync(fullPath);
        
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', stats.size);
        res.setHeader('Content-Disposition', `inline; filename="${model.filename}"`);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        
        // 支持Range请求（用于大文件）
        const range = req.headers.range;
        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
            const chunksize = (end - start) + 1;
            
            res.status(206);
            res.setHeader('Content-Range', `bytes ${start}-${end}/${stats.size}`);
            res.setHeader('Accept-Ranges', 'bytes');
            res.setHeader('Content-Length', chunksize);
            
            const stream = fs.createReadStream(fullPath, { start, end });
            stream.pipe(res);
        } else {
            const fileStream = fs.createReadStream(fullPath);
            fileStream.pipe(res);
        }

    } catch (error) {
        console.error('获取3D模型文件失败:', error);
        res.status(500).json({ 
            success: false, 
            message: '获取3D模型文件失败',
            error: error.message
        });
    }
});

// 更新3D模型信息
router.put('/:modelId', (req, res) => {
    try {
        const modelId = parseInt(req.params.modelId);
        const { description } = req.body;

        if (!modelId) {
            return res.status(400).json({ 
                success: false, 
                message: '无效的模型ID' 
            });
        }

        // 验证模型是否存在
        const model = db.prepare(`
            SELECT id FROM weapon_models 
            WHERE id = ?
        `).get(modelId);

        if (!model) {
            return res.status(404).json({ 
                success: false, 
                message: '3D模型不存在' 
            });
        }

        // 更新模型描述
        const stmt = db.prepare(`
            UPDATE weapon_models 
            SET description = ?
            WHERE id = ?
        `);

        stmt.run(description || '', modelId);

        res.json({
            success: true,
            message: '3D模型信息更新成功'
        });

    } catch (error) {
        console.error('更新3D模型信息失败:', error);
        res.status(500).json({ 
            success: false, 
            message: '更新3D模型信息失败' 
        });
    }
});

// 删除3D模型
router.delete('/:modelId', (req, res) => {
    try {
        const modelId = parseInt(req.params.modelId);

        if (!modelId) {
            return res.status(400).json({ 
                success: false, 
                message: '无效的模型ID' 
            });
        }

        // 获取模型信息
        const model = db.prepare(`
            SELECT file_path FROM weapon_models 
            WHERE id = ?
        `).get(modelId);

        if (!model) {
            return res.status(404).json({ 
                success: false, 
                message: '3D模型不存在' 
            });
        }

        // 删除数据库记录
        const stmt = db.prepare(`
            DELETE FROM weapon_models 
            WHERE id = ?
        `);
        
        const result = stmt.run(modelId);

        if (result.changes > 0) {
            // 构建完整文件路径并删除文件
            const fullPath = path.isAbsolute(model.file_path) 
                ? model.file_path 
                : path.join(__dirname, '../..', model.file_path);
            
            if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath);
            }

            res.json({
                success: true,
                message: '3D模型删除成功'
            });
        } else {
            res.status(404).json({ 
                success: false, 
                message: '3D模型不存在' 
            });
        }

    } catch (error) {
        console.error('删除3D模型失败:', error);
        res.status(500).json({ 
            success: false, 
            message: '删除3D模型失败' 
        });
    }
});

// 获取武器3D模型统计信息
router.get('/weapon/:weaponId/stats', (req, res) => {
    try {
        const weaponId = parseInt(req.params.weaponId);

        if (!weaponId || weaponId <= 0) {
            return res.status(400).json({ 
                success: false, 
                message: '无效的武器ID' 
            });
        }

        const stats = db.prepare(`
            SELECT 
                COUNT(*) as total_models,
                SUM(file_size) as total_size,
                AVG(file_size) as avg_size,
                GROUP_CONCAT(DISTINCT model_format) as formats
            FROM weapon_models 
            WHERE weapon_id = ?
        `).get(weaponId);

        res.json({
            success: true,
            data: {
                ...stats,
                formats: stats.formats ? stats.formats.split(',') : []
            }
        });
    } catch (error) {
        console.error('获取3D模型统计失败:', error);
        res.status(500).json({ 
            success: false, 
            message: '获取3D模型统计失败' 
        });
    }
});

module.exports = router;